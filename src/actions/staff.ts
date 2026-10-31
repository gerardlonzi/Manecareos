"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { APP_CONFIG } from "@/config/app";
import { logActivity, notify } from "@/lib/activity";
import { notifyWeeklyCap } from "@/lib/compliance";
import { parseHoursInput } from "@/lib/hours";
import { mapWithConcurrency } from "@/lib/concurrency";
import { computeLocation, type LocationPrev } from "@/lib/location/apply";
import { resolveLocation, resolveMany } from "@/lib/location/service";
import { PHOTO_BUCKET, PHOTO_MAX_BYTES, PHOTO_URL_TTL_SECONDS, detectPhotoType } from "@/lib/photos";
import { normalizePhone } from "@/lib/phone";
import type { ActionResult, AvailabilityStatus, Staff } from "@/lib/types";
import { fieldErrorsFrom, locationInputSchema, staffInputSchema, uuidList, uuidSchema } from "@/lib/validation";
import { isUniqueViolation, withSession } from "./helpers";

const refresh = () => {
  revalidatePath("/staff");
  revalidatePath("/dashboard");
};

export async function saveStaff(raw: unknown, id?: string): Promise<ActionResult<{ id: string }>> {
  return withSession(async ({ supabase, user }) => {
    const parsed = staffInputSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Formulaire invalide", fieldErrors: fieldErrorsFrom(parsed.error) };
    const input = parsed.data;
    if (id && !uuidSchema.safeParse(id).success) return { ok: false, error: "Identifiant invalide" };

    let phone: string | null = null;
    if (input.phone) {
      const p = normalizePhone(input.phone, input.phone_country_code ?? input.country_code);
      if (!p.ok) return { ok: false, error: "Formulaire invalide", fieldErrors: { phone: p.reason } };
      phone = p.e164;
    }

    let prev: Staff | null = null;
    if (id) {
      const { data } = await supabase.from("staff").select("*").eq("id", id).maybeSingle();
      prev = data as Staff | null;
      if (!prev) return { ok: false, error: "Staff introuvable" };
    }

    const loc = await computeLocation(input, prev as LocationPrev | null);
    if (!loc.ok) return { ok: false, error: "Localisation invalide", fieldErrors: { [loc.field]: loc.message } };

    const generatedCode = `STF-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    const row = {
      staff_code: input.staff_code || (id ? prev?.staff_code : generatedCode) || generatedCode,
      full_name: input.full_name,
      phone,
      email: input.email,
      skills: input.skills,
      availability_status: input.availability_status,
      notes: input.notes,
      weekly_hours: input.weekly_hours,
      ...loc.fields,
    };

    let savedId = id ?? "";
    if (id) {
      const { error } = await supabase.from("staff").update(row).eq("id", id);
      if (error) {
        if (isUniqueViolation(error)) return { ok: false, error: "Code staff déjà utilisé", fieldErrors: { staff_code: "Ce code staff existe déjà" } };
        return { ok: false, error: "Enregistrement impossible. Réessayez." };
      }
    } else {
      // owner_id vient de la session, jamais du client.
      const { data, error } = await supabase.from("staff").insert({ ...row, owner_id: user.id }).select("id").single();
      if (error || !data) {
        if (isUniqueViolation(error)) return { ok: false, error: "Code staff déjà utilisé", fieldErrors: { staff_code: "Ce code staff existe déjà" } };
        return { ok: false, error: "Enregistrement impossible. Réessayez." };
      }
      savedId = data.id as string;
    }

    const events = [
      {
        event_type: id ? "staff_updated" : "staff_created",
        staff_id: savedId,
        description: `${id ? "Staff modifié" : "Staff créé"} : ${input.full_name}`,
      },
    ];
    if (prev && prev.availability_status !== input.availability_status) {
      events.push({
        event_type: "availability_changed", staff_id: savedId,
        description: `${input.full_name} : disponibilité ${prev.availability_status} → ${input.availability_status}`,
      });
    }
    if (loc.event) {
      events.push({ event_type: loc.event.type, staff_id: savedId, description: `${input.full_name} : ${loc.event.description}` });
    }
    await logActivity(supabase, user.id, events);
    if (loc.event?.type === "location_failed") {
      await notify(supabase, user.id, {
        type: "location_failed", title: "Localisation non résolue",
        message: `${input.full_name} : ${loc.event.description}. Ce staff est exclu des recherches géographiques tant que sa localisation n'est pas vérifiée.`,
        link: `/staff/${savedId}`,
      });
    }

    refresh();
    revalidatePath(`/staff/${savedId}`);
    return {
      ok: true, data: { id: savedId },
      message: loc.fields.location_status === "resolved" ? "Staff enregistré, localisation vérifiée" : "Staff enregistré — localisation à vérifier",
    };
  });
}

const availabilitySchema = z.enum(["available", "unavailable", "unknown"]);

export async function setAvailability(ids: string[], status: AvailabilityStatus): Promise<ActionResult<{ count: number }>> {
  return withSession(async ({ supabase, user }) => {
    const idsP = uuidList().safeParse(ids);
    const stP = availabilitySchema.safeParse(status);
    if (!idsP.success || !stP.success) return { ok: false, error: "Requête invalide" };

    const { data: before } = await supabase.from("staff").select("id, full_name, availability_status").in("id", idsP.data).is("archived_at", null);
    const rows = (before ?? []) as Pick<Staff, "id" | "full_name" | "availability_status">[];
    const toChange = rows.filter((r) => r.availability_status !== stP.data);
    if (toChange.length === 0) return { ok: true, data: { count: 0 }, message: "Aucun changement" };

    const { error } = await supabase.from("staff").update({ availability_status: stP.data }).in("id", toChange.map((r) => r.id));
    if (error) return { ok: false, error: "Modification impossible. Réessayez." };

    await logActivity(
      supabase, user.id,
      toChange.length <= 20
        ? toChange.map((r) => ({
            event_type: "availability_changed", staff_id: r.id,
            description: `${r.full_name} : disponibilité ${r.availability_status} → ${stP.data}`,
          }))
        : [{ event_type: "availability_changed", description: `${toChange.length} staff passés en « ${stP.data} »`, metadata: { count: toChange.length } }],
    );
    refresh();
    revalidatePath("/staff/[id]", "page");
    return { ok: true, data: { count: toChange.length }, message: `${toChange.length} disponibilité(s) mise(s) à jour` };
  });
}

export async function archiveStaff(ids: string[], archive = true): Promise<ActionResult<{ count: number }>> {
  return withSession(async ({ supabase, user }) => {
    const p = uuidList().safeParse(ids);
    if (!p.success) return { ok: false, error: "Requête invalide" };
    const { data, error } = await supabase
      .from("staff").update({ archived_at: archive ? new Date().toISOString() : null }).in("id", p.data).select("id, full_name");
    if (error) return { ok: false, error: "Opération impossible. Réessayez." };
    const rows = (data ?? []) as { id: string; full_name: string }[];
    await logActivity(
      supabase, user.id,
      rows.length <= 20
        ? rows.map((r) => ({ event_type: "staff_archived", staff_id: r.id, description: `${r.full_name} : ${archive ? "archivé" : "restauré"}` }))
        : [{ event_type: "staff_archived", description: `${rows.length} staff ${archive ? "archivés" : "restaurés"}` }],
    );
    refresh();
    return { ok: true, data: { count: rows.length }, message: `${rows.length} staff ${archive ? "archivé(s)" : "restauré(s)"}` };
  });
}

/** Le manager déclare avoir contacté la personne. L'application n'a aucun moyen de le vérifier et ne le prétend pas. */
export async function markContacted(staffId: string): Promise<ActionResult> {
  return withSession(async ({ supabase, user }) => {
    if (!uuidSchema.safeParse(staffId).success) return { ok: false, error: "Identifiant invalide" };
    const { data, error } = await supabase.from("staff").update({ last_contacted_at: new Date().toISOString() }).eq("id", staffId).select("full_name").maybeSingle();
    if (error || !data) return { ok: false, error: "Staff introuvable" };
    await logActivity(supabase, user.id, { event_type: "staff_contacted", staff_id: staffId, description: `${data.full_name} : marqué comme contacté par le manager` });
    revalidatePath(`/staff/${staffId}`);
    return { ok: true, message: "Marqué comme contacté" };
  });
}

export type LocationPreview = { label: string; city: string | null; region: string | null; postalDisplay: string | null; provider: string; postalDerived: boolean };

/** Aperçu de géocodage pour le bouton « Valider la localisation ». N'enregistre rien. */
export async function previewLocation(raw: unknown): Promise<ActionResult<LocationPreview>> {
  return withSession(async () => {
    const p = locationInputSchema.safeParse(raw);
    if (!p.success) return { ok: false, error: "Localisation invalide", fieldErrors: fieldErrorsFrom(p.error) };
    const r = await resolveLocation({ countryCode: p.data.country_code, postalCode: p.data.postal_code, city: p.data.city, region: p.data.region });
    if (!r.ok) return { ok: false, error: r.message };
    return { ok: true, data: { label: r.label, city: r.city, region: r.region, postalDisplay: r.postalDisplay, provider: r.provider, postalDerived: r.postal_derived === true } };
  });
}

/** (Re)résout les localisations : sélection explicite, ou tous les staff « pending » / « failed ». */
export async function resolveStaffLocations(ids?: string[]): Promise<ActionResult<{ resolved: number; failed: number; skipped: number }>> {
  return withSession(async ({ supabase, user }) => {
    if (ids && !uuidList(200).safeParse(ids).success) return { ok: false, error: "Requête invalide" };
    let q = supabase.from("staff").select("*").is("archived_at", null).limit(200);
    q = ids ? q.in("id", ids) : q.in("location_status", ["pending", "failed"]);
    const { data, error } = await q;
    if (error) return { ok: false, error: "Lecture impossible. Réessayez." };
    const list = ((data ?? []) as Staff[]).filter((s) => s.postal_code || s.city);
    const skipped = (data?.length ?? 0) - list.length;

    // Une seule requête de géocodage par adresse distincte, concurrence bornée.
    await resolveMany(list.map((s) => ({ countryCode: s.country_code, postalCode: s.postal_code, city: s.city, region: s.region })));

    let resolved = 0;
    let failed = 0;
    const events: { event_type: string; staff_id: string; description: string }[] = [];
    await mapWithConcurrency(list, APP_CONFIG.geocoding.concurrency, async (s) => {
      const loc = await computeLocation(
        { country_code: s.country_code, postal_code: s.postal_code, city: s.city, region: s.region },
        s as LocationPrev, { force: Boolean(ids) },
      );
      if (!loc.ok) { failed++; return; }
      const { error: upErr } = await supabase.from("staff").update(loc.fields).eq("id", s.id);
      if (upErr) { failed++; return; }
      if (loc.fields.location_status === "resolved") resolved++; else failed++;
      if (loc.event) events.push({ event_type: loc.event.type, staff_id: s.id, description: `${s.full_name} : ${loc.event.description}` });
    });

    await logActivity(supabase, user.id, events.slice(0, 100));
    if (failed > 0) {
      await notify(supabase, user.id, {
        type: "location_failed", title: "Localisations non résolues",
        message: `${failed} staff n'ont pas pu être localisés (adresse introuvable ou service indisponible).`,
        link: "/staff?location=failed",
      });
    }
    refresh();
    return { ok: true, data: { resolved, failed, skipped }, message: `${resolved} localisation(s) vérifiée(s), ${failed} en échec` };
  });
}

export async function clearStaffLocation(id: string): Promise<ActionResult> {
  return withSession(async ({ supabase, user }) => {
    if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Identifiant invalide" };
    const { data, error } = await supabase.from("staff")
      .update({ postal_code: null, postal_code_normalized: null, city: null, region: null, latitude: null, longitude: null, location_status: "pending", location_updated_at: null })
      .eq("id", id).select("full_name").maybeSingle();
    if (error || !data) return { ok: false, error: "Staff introuvable" };
    await logActivity(supabase, user.id, { event_type: "staff_updated", staff_id: id, description: `${data.full_name} : localisation effacée` });
    revalidatePath(`/staff/${id}`);
    refresh();
    return { ok: true, message: "Localisation effacée" };
  });
}

/**
 * Téléverse la photo d'un staff (champ « photo », 2 Mo max, JPEG/PNG/WebP vérifiés par les octets de tête).
 * Le propriétaire n'est jamais lu depuis le client : le chemin est `<user.id>/<staffId>.<ext>` et le staff est relu sous RLS.
 */
export async function uploadStaffPhoto(staffId: string, formData: FormData): Promise<ActionResult<{ photoUrl: string }>> {
  return withSession(async ({ supabase, user }) => {
    if (!uuidSchema.safeParse(staffId).success) return { ok: false, error: "Identifiant invalide" };
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Aucune photo reçue" };
    if (file.size > PHOTO_MAX_BYTES) return { ok: false, error: "Photo trop volumineuse (2 Mo maximum)" };

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > PHOTO_MAX_BYTES) return { ok: false, error: "Photo trop volumineuse (2 Mo maximum)" };
    const type = detectPhotoType(bytes);
    if (!type) return { ok: false, error: "Format de photo non pris en charge (JPEG, PNG ou WebP)" };

    const { data: staff } = await supabase.from("staff").select("id, full_name, photo_path").eq("id", staffId).maybeSingle();
    if (!staff) return { ok: false, error: "Staff introuvable" };

    const path = `${user.id}/${staffId}.${type.ext}`;
    const bucket = supabase.storage.from(PHOTO_BUCKET);
    const { error: upErr } = await bucket.upload(path, bytes, { contentType: type.mime, upsert: true, cacheControl: "3600" });
    if (upErr) return { ok: false, error: "Téléversement impossible. Réessayez." };

    const { error: dbErr } = await supabase.from("staff").update({ photo_path: path }).eq("id", staffId);
    if (dbErr) {
      if (staff.photo_path !== path) await bucket.remove([path]);
      return { ok: false, error: "Enregistrement impossible. Réessayez." };
    }
    // Ancienne photo d'un autre format (ex. .png remplacé par .jpg) : on ne laisse pas d'orphelin.
    if (staff.photo_path && staff.photo_path !== path && staff.photo_path.startsWith(`${user.id}/`)) {
      await bucket.remove([staff.photo_path]);
    }

    await logActivity(supabase, user.id, { event_type: "staff_updated", staff_id: staffId, description: `${staff.full_name} : photo mise à jour` });
    revalidatePath(`/staff/${staffId}`);
    refresh();
    const { data: signed } = await bucket.createSignedUrl(path, PHOTO_URL_TTL_SECONDS);
    return { ok: true, data: { photoUrl: signed?.signedUrl ?? "" }, message: "Photo mise à jour" };
  });
}

export async function removeStaffPhoto(staffId: string): Promise<ActionResult> {
  return withSession(async ({ supabase, user }) => {
    if (!uuidSchema.safeParse(staffId).success) return { ok: false, error: "Identifiant invalide" };
    const { data: staff } = await supabase.from("staff").select("id, full_name, photo_path").eq("id", staffId).maybeSingle();
    if (!staff) return { ok: false, error: "Staff introuvable" };
    if (!staff.photo_path) return { ok: true, message: "Aucune photo à supprimer" };

    const { error } = await supabase.from("staff").update({ photo_path: null }).eq("id", staffId);
    if (error) return { ok: false, error: "Suppression impossible. Réessayez." };
    // Seuls les objets du dossier de l'utilisateur sont supprimés (la RLS Storage l'impose aussi).
    if (staff.photo_path.startsWith(`${user.id}/`)) await supabase.storage.from(PHOTO_BUCKET).remove([staff.photo_path]);

    await logActivity(supabase, user.id, { event_type: "staff_updated", staff_id: staffId, description: `${staff.full_name} : photo supprimée` });
    revalidatePath(`/staff/${staffId}`);
    refresh();
    return { ok: true, message: "Photo supprimée" };
  });
}

/** Modifie les heures de travail hebdomadaires d'un staff (vide = aucun plafond) et alerte si le plafond est déjà atteint. */
export async function setWeeklyHours(staffId: string, raw: string): Promise<ActionResult<{ weekly_hours: number | null }>> {
  return withSession(async ({ supabase, user }) => {
    if (!uuidSchema.safeParse(staffId).success) return { ok: false, error: "Requête invalide" };
    const v = raw.trim();
    const hours = v === "" ? null : parseHoursInput(v);
    if (v !== "" && (hours === null || hours > 168)) return { ok: false, error: "Heures invalides (ex. 7,5 ou 7h30)", fieldErrors: { weekly_hours: "Entre 0 et 168 heures" } };
    const { data, error } = await supabase.from("staff").update({ weekly_hours: hours }).eq("id", staffId).select("*").maybeSingle();
    if (error || !data) return { ok: false, error: "Enregistrement impossible. Réessayez." };
    const staff = data as Staff;
    await logActivity(supabase, user.id, { event_type: "staff_updated", staff_id: staffId, description: `Heures hebdomadaires de ${staff.full_name} : ${hours ?? "aucun plafond"}` });
    await notifyWeeklyCap(supabase, user.id, staff, null);
    revalidatePath("/staff"); revalidatePath(`/staff/${staffId}`); revalidatePath("/find-staff"); revalidatePath("/hours");
    return { ok: true, data: { weekly_hours: hours }, message: "Heures enregistrées" };
  });
}
