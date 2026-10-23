"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { APP_CONFIG } from "@/config/app";
import { logActivity, notify } from "@/lib/activity";
import { mapWithConcurrency } from "@/lib/concurrency";
import { computeLocation } from "@/lib/location/apply";
import { resolveMany } from "@/lib/location/service";
import { normalizePhone } from "@/lib/phone";
import type { ActionResult } from "@/lib/types";
import { normalizeSkills } from "@/lib/utils";
import { isUniqueViolation, withSession } from "./helpers";

export type ImportRowFailure = { rowNumber: number; field: string; message: string };
export type ImportBatchResult = { inserted: number; failures: ImportRowFailure[]; located: number; locationPending: number };

/** Codes staff et e-mails déjà présents, pour détecter les doublons à l'aperçu (données du manager uniquement, via RLS). */
export async function getExistingIdentifiers(): Promise<ActionResult<{ codes: string[]; emails: string[] }>> {
  return withSession(async ({ supabase }) => {
    const codes: string[] = [];
    const emails: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("staff").select("staff_code, email").range(from, from + 999);
      if (error) return { ok: false, error: "Lecture impossible. Réessayez." };
      for (const r of (data ?? []) as { staff_code: string | null; email: string | null }[]) {
        if (r.staff_code) codes.push(r.staff_code);
        if (r.email) emails.push(r.email);
      }
      if (!data || data.length < 1000) break;
    }
    return { ok: true, data: { codes, emails } };
  });
}

// Le navigateur envoie des lignes déjà analysées, mais le serveur les re-valide intégralement : rien n'est présumé fiable,
// et owner_id n'est jamais lu depuis ces données.
const rowSchema = z.object({
  rowNumber: z.number().int().positive(),
  full_name: z.string().trim().min(1).max(200),
  staff_code: z.string().trim().max(50).nullable(),
  phone: z.string().max(32).nullable(),
  email: z.string().max(254).nullable(),
  country_code: z.string().regex(/^[A-Za-z]{2}$/),
  postal_code: z.string().max(16).nullable(),
  city: z.string().max(120).nullable(),
  region: z.string().max(120).nullable(),
  skills: z.array(z.string().max(60)).max(30),
  availability_status: z.enum(["available", "unavailable", "unknown"]),
  notes: z.string().max(4000).nullable(),
});

export async function importStaffBatch(raw: unknown): Promise<ActionResult<ImportBatchResult>> {
  return withSession(async ({ supabase, user }) => {
    if (!Array.isArray(raw)) return { ok: false, error: "Requête invalide" };
    if (raw.length === 0 || raw.length > APP_CONFIG.import.batchSize) return { ok: false, error: `Un lot contient entre 1 et ${APP_CONFIG.import.batchSize} lignes.` };

    const failures: ImportRowFailure[] = [];
    type Valid = { rowNumber: number; row: z.infer<typeof rowSchema>; country: string; phone: string | null; email: string | null };
    const valid: Valid[] = [];

    for (const item of raw) {
      const p = rowSchema.safeParse(item);
      const rowNumber = typeof (item as { rowNumber?: unknown })?.rowNumber === "number" ? (item as { rowNumber: number }).rowNumber : 0;
      if (!p.success) { failures.push({ rowNumber, field: String(p.error.issues[0]?.path[0] ?? "ligne"), message: p.error.issues[0]?.message ?? "Ligne invalide" }); continue; }
      const country = p.data.country_code.toUpperCase();
      let phone: string | null = null;
      if (p.data.phone) {
        const ph = normalizePhone(p.data.phone, country);
        if (!ph.ok) { failures.push({ rowNumber, field: "phone", message: ph.reason }); continue; }
        phone = ph.e164;
      }
      let email: string | null = null;
      if (p.data.email) {
        if (!z.email().safeParse(p.data.email).success) { failures.push({ rowNumber, field: "email", message: "Adresse e-mail invalide" }); continue; }
        email = p.data.email.toLowerCase();
      }
      valid.push({ rowNumber, row: p.data, country, phone, email });
    }

    // Une seule résolution par adresse distincte du lot (concurrence bornée), puis calcul par ligne depuis le cache mémoire.
    await resolveMany(valid.filter((v) => v.row.postal_code || v.row.city).map((v) => ({ countryCode: v.country, postalCode: v.row.postal_code, city: v.row.city, region: v.row.region })));

    let located = 0;
    let locationPending = 0;
    const toInsert: { rowNumber: number; record: Record<string, unknown> }[] = [];
    await mapWithConcurrency(valid, APP_CONFIG.geocoding.concurrency, async (v) => {
      const loc = await computeLocation({ country_code: v.country, postal_code: v.row.postal_code, city: v.row.city, region: v.row.region });
      if (!loc.ok) { failures.push({ rowNumber: v.rowNumber, field: loc.field, message: loc.message }); return; }
      if (loc.fields.location_status === "resolved") located++; else if (v.row.postal_code || v.row.city) locationPending++;
      toInsert.push({
        rowNumber: v.rowNumber,
        record: {
          owner_id: user.id,
          staff_code: v.row.staff_code || null, full_name: v.row.full_name, phone: v.phone, email: v.email,
          skills: normalizeSkills(v.row.skills), availability_status: v.row.availability_status, notes: v.row.notes || null,
          ...loc.fields,
        },
      });
    });
    toInsert.sort((a, b) => a.rowNumber - b.rowNumber);

    let inserted = 0;
    if (toInsert.length > 0) {
      const { error } = await supabase.from("staff").insert(toInsert.map((t) => t.record));
      if (!error) inserted = toInsert.length;
      else {
        // Un doublon ou une contrainte bloque tout le lot : on isole les lignes fautives une par une.
        for (const t of toInsert) {
          const { error: e } = await supabase.from("staff").insert(t.record);
          if (!e) inserted++;
          else failures.push({ rowNumber: t.rowNumber, field: isUniqueViolation(e) ? "staff_code" : "ligne", message: isUniqueViolation(e) ? "Ce code staff existe déjà" : "Insertion refusée par la base" });
        }
      }
    }
    return { ok: true, data: { inserted, failures: failures.sort((a, b) => a.rowNumber - b.rowNumber), located, locationPending } };
  });
}

const summarySchema = z.object({
  fileName: z.string().max(200).optional(),
  totalRows: z.number().int().min(0).max(100000),
  inserted: z.number().int().min(0),
  rejected: z.number().int().min(0),
  located: z.number().int().min(0),
  locationPending: z.number().int().min(0),
});

export async function finalizeImport(raw: unknown): Promise<ActionResult> {
  return withSession(async ({ supabase, user }) => {
    const p = summarySchema.safeParse(raw);
    if (!p.success) return { ok: false, error: "Résumé invalide" };
    const s = p.data;
    await logActivity(supabase, user.id, {
      event_type: "import_completed",
      description: `Import CSV terminé : ${s.inserted} importé(s), ${s.rejected} rejeté(s) sur ${s.totalRows}`,
      metadata: { total: s.totalRows, inserted: s.inserted, rejected: s.rejected, located: s.located, location_pending: s.locationPending },
    });
    await notify(supabase, user.id, {
      type: "import_completed", title: "Import terminé",
      message: `${s.inserted} staff importé(s) sur ${s.totalRows} ligne(s). ${s.located} localisation(s) vérifiée(s).`, link: "/staff",
    });
    if (s.rejected > 0) {
      await notify(supabase, user.id, { type: "import_errors", title: "Lignes rejetées à l'import", message: `${s.rejected} ligne(s) n'ont pas été importées. Téléchargez le rapport d'erreurs depuis la page d'import.`, link: "/staff/import" });
    }
    if (s.locationPending > 0) {
      await notify(supabase, user.id, { type: "location_failed", title: "Localisations à vérifier", message: `${s.locationPending} staff importé(s) n'ont pas pu être localisés. Relancez la résolution depuis l'annuaire.`, link: "/staff?location=pending" });
    }
    revalidatePath("/staff");
    revalidatePath("/dashboard");
    return { ok: true };
  });
}
