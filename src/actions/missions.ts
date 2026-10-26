"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity, notify } from "@/lib/activity";
import { computeLocation, type LocationPrev } from "@/lib/location/apply";
import { getRoutingCapabilities } from "@/lib/routing/service";
import { syncMissionStatus } from "@/lib/missions";
import { zonedLocalToUtcIso } from "@/lib/time";
import type { ActionResult, Mission, MissionOverview, MissionStatus } from "@/lib/types";
import { fieldErrorsFrom, missionInputSchema, uuidSchema } from "@/lib/validation";
import { isUniqueViolation, withSession } from "./helpers";

const refresh = (id?: string) => {
  revalidatePath("/missions");
  revalidatePath("/dashboard");
  if (id) {
    revalidatePath(`/missions/${id}`);
    revalidatePath(`/missions/${id}/staff`);
  }
};

export async function saveMission(raw: unknown, id?: string): Promise<ActionResult<{ id: string }>> {
  return withSession(async ({ supabase, user, profile }) => {
    const parsed = missionInputSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Formulaire invalide", fieldErrors: fieldErrorsFrom(parsed.error) };
    const input = parsed.data;
    if (id && !uuidSchema.safeParse(id).success) return { ok: false, error: "Identifiant invalide" };

    const fieldErrors: Record<string, string> = {};
    const start = input.scheduled_start_local ? zonedLocalToUtcIso(input.scheduled_start_local, profile.timezone) : null;
    const end = input.scheduled_end_local ? zonedLocalToUtcIso(input.scheduled_end_local, profile.timezone) : null;
    if (input.scheduled_start_local && !start) fieldErrors.scheduled_start_local = "Date de début invalide";
    if (input.scheduled_end_local && !end) fieldErrors.scheduled_end_local = "Date de fin invalide";
    if (start && end && Date.parse(end) < Date.parse(start)) fieldErrors.scheduled_end_local = "La fin ne peut pas précéder le début";

    // On ne propose et n'accepte que les modes réellement calculables (jamais de transports en commun simulés).
    if (!getRoutingCapabilities().supportedModes.includes(input.transport_mode)) {
      fieldErrors.transport_mode =
        input.transport_mode === "public_transport"
          ? "Les estimations en transports en commun ne sont pas prises en charge (aucun fournisseur d'horaires configuré)."
          : "Mode de transport non pris en charge.";
    }
    if (Object.keys(fieldErrors).length > 0) return { ok: false, error: "Formulaire invalide", fieldErrors };

    let prev: Mission | null = null;
    if (id) {
      const { data } = await supabase.from("missions").select("*").eq("id", id).maybeSingle();
      prev = data as Mission | null;
      if (!prev) return { ok: false, error: "Mission introuvable" };
      if (prev.status === "cancelled") return { ok: false, error: "Une mission annulée ne peut plus être modifiée." };
    }

    const loc = await computeLocation(input, prev as LocationPrev | null);
    if (!loc.ok) return { ok: false, error: "Localisation invalide", fieldErrors: { [loc.field]: loc.message } };

    const row = {
      mission_reference: input.mission_reference,
      title: input.title,
      description: input.description,
      required_skills: input.required_skills,
      required_staff_count: input.required_staff_count,
      scheduled_start_at: start,
      scheduled_end_at: end,
      transport_mode: input.transport_mode,
      notes: input.notes,
      ...loc.fields,
    };
    const uniqueErr = { ok: false, error: "Référence déjà utilisée", fieldErrors: { mission_reference: "Cette référence existe déjà" } } as const;

    let savedId = id ?? "";
    if (id && prev) {
      const status: MissionStatus = prev.status === "draft" && input.intent === "open" ? "open" : prev.status;
      const { error } = await supabase.from("missions").update({ ...row, status }).eq("id", id);
      if (error) return isUniqueViolation(error) ? uniqueErr : { ok: false, error: "Enregistrement impossible. Réessayez." };
      if (status !== prev.status) await syncMissionStatus(supabase, user.id, id);
    } else {
      const { data, error } = await supabase.from("missions").insert({ ...row, owner_id: user.id, status: input.intent }).select("id").single();
      if (error || !data) return isUniqueViolation(error) ? uniqueErr : { ok: false, error: "Enregistrement impossible. Réessayez." };
      savedId = data.id as string;
    }

    const events = [
      { event_type: id ? "mission_updated" : "mission_created", mission_id: savedId, description: `${id ? "Mission modifiée" : "Mission créée"} : ${input.title}` },
    ];
    if (loc.event) events.push({ event_type: loc.event.type, mission_id: savedId, description: `Mission « ${input.title} » : ${loc.event.description}` });
    await logActivity(supabase, user.id, events);

    if (!id && input.intent === "open") {
      await notify(supabase, user.id, {
        type: "mission_needs_staff", title: "Nouvelle mission à pourvoir",
        message: `« ${input.title} » : ${input.required_staff_count} personne(s) à trouver.`, link: `/missions/${savedId}/staff`,
      });
    }
    if (loc.event?.type === "location_failed") {
      await notify(supabase, user.id, {
        type: "location_failed", title: "Localisation de mission non résolue",
        message: `« ${input.title} » : la recherche par distance reste indisponible tant que le lieu n'est pas vérifié.`, link: `/missions/${savedId}/edit`,
      });
    }
    refresh(savedId);
    return {
      ok: true, data: { id: savedId },
      message: loc.fields.location_status === "resolved" ? "Mission enregistrée, lieu vérifié" : "Mission enregistrée — lieu à vérifier",
    };
  });
}

const MANUAL_STATUSES = ["draft", "open", "staffing_in_progress", "staffed", "completed", "cancelled"] as const;

export async function changeMissionStatus(id: string, status: MissionStatus): Promise<ActionResult> {
  return withSession(async ({ supabase, user }) => {
    if (!uuidSchema.safeParse(id).success || !z.enum(MANUAL_STATUSES).safeParse(status).success) return { ok: false, error: "Requête invalide" };
    const { data } = await supabase.from("mission_overview").select("*").eq("id", id).maybeSingle();
    const m = data as MissionOverview | null;
    if (!m) return { ok: false, error: "Mission introuvable" };
    if (m.status === status) return { ok: true, message: "Statut inchangé" };
    if (m.status === "cancelled") return { ok: false, error: "Une mission annulée ne peut pas être rouverte." };
    if (status === "staffed" && m.confirmed_count < m.required_staff_count) {
      return { ok: false, error: `« Pourvue » exige des affectations confirmées : ${m.confirmed_count} sur ${m.required_staff_count}.` };
    }
    if (status === "cancelled") return cancelMissionInner(supabase, user.id, m);
    const { error } = await supabase.from("missions").update({ status }).eq("id", id);
    if (error) return { ok: false, error: "Modification impossible. Réessayez." };
    await logActivity(supabase, user.id, { event_type: "mission_status_changed", mission_id: id, description: `Mission « ${m.title} » : statut ${m.status} → ${status}`, metadata: { from: m.status, to: status } });
    refresh(id);
    return { ok: true, message: "Statut mis à jour" };
  });
}

export async function cancelMission(id: string): Promise<ActionResult> {
  return withSession(async ({ supabase, user }) => {
    if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Identifiant invalide" };
    const { data } = await supabase.from("mission_overview").select("*").eq("id", id).maybeSingle();
    const m = data as MissionOverview | null;
    if (!m) return { ok: false, error: "Mission introuvable" };
    if (m.status === "cancelled") return { ok: true, message: "Déjà annulée" };
    return cancelMissionInner(supabase, user.id, m);
  });
}

async function cancelMissionInner(supabase: Parameters<typeof logActivity>[0], ownerId: string, m: MissionOverview): Promise<ActionResult> {
  const { error } = await supabase.from("missions").update({ status: "cancelled" }).eq("id", m.id);
  if (error) return { ok: false, error: "Annulation impossible. Réessayez." };
  // Les affectations encore actives sont annulées (l'historique est conservé).
  await supabase.from("mission_staff").update({ assignment_status: "cancelled" }).eq("mission_id", m.id).in("assignment_status", ["selected", "contacted", "confirmed"]);
  await logActivity(supabase, ownerId, { event_type: "mission_cancelled", mission_id: m.id, description: `Mission annulée : ${m.title}`, metadata: { cancelled_assignments: m.selected_count } });
  refresh(m.id);
  return { ok: true, message: "Mission annulée" };
}

export async function revalidateMissionLocation(id: string): Promise<ActionResult> {
  return withSession(async ({ supabase, user }) => {
    if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Identifiant invalide" };
    const { data } = await supabase.from("missions").select("*").eq("id", id).maybeSingle();
    const m = data as Mission | null;
    if (!m) return { ok: false, error: "Mission introuvable" };
    const loc = await computeLocation(m, m as LocationPrev, { force: true });
    if (!loc.ok) return { ok: false, error: loc.message };
    const { error } = await supabase.from("missions").update(loc.fields).eq("id", id);
    if (error) return { ok: false, error: "Mise à jour impossible. Réessayez." };
    if (loc.event) await logActivity(supabase, user.id, { event_type: loc.event.type, mission_id: id, description: `Mission « ${m.title} » : ${loc.event.description}` });
    refresh(id);
    return loc.fields.location_status === "resolved" ? { ok: true, message: "Lieu vérifié" } : { ok: false, error: loc.event?.description ?? "Lieu non résolu" };
  });
}
