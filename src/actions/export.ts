"use server";

import { z } from "zod";
import { APP_CONFIG } from "@/config/app";
import { logActivity } from "@/lib/activity";
import { toCsv } from "@/lib/csv/export";
import { rankCandidates, type SortKey } from "@/lib/ranking";
import { getRouteEstimates } from "@/lib/routing/service";
import { approximateEstimate } from "@/lib/routing/fallback";
import type { RouteEstimate } from "@/lib/routing/types";
import { findNearbyCandidates, searchParamsSchema } from "@/lib/search";
import { applyStaffFilters, parseStaffFilters } from "@/lib/staff-query";
import type { ActionResult, MissionOverview, Staff, TransportMode } from "@/lib/types";
import { uuidList, uuidSchema } from "@/lib/validation";
import { withSession } from "./helpers";

type CsvFile = { filename: string; csv: string; count: number };
const stamp = () => new Date().toISOString().slice(0, 10);

const STAFF_COLUMNS = ["full_name", "staff_code", "phone", "email", "country_code", "postal_code", "city", "region", "skills", "availability", "notes", "location_status", "last_location_verification"] as const;

const staffRow = (s: Staff) => [
  s.full_name, s.staff_code, s.phone, s.email, s.country_code, s.postal_code, s.city, s.region,
  s.skills.join(";"), s.availability_status, s.notes, s.location_status, s.location_updated_at,
];

/** Exporte tous les staff, les staff filtrés ou une sélection. Rien n'est tronqué silencieusement : au-delà de la limite, l'export est refusé. */
export async function exportStaffCsv(raw: unknown): Promise<ActionResult<CsvFile>> {
  return withSession(async ({ supabase, user }) => {
    const p = z.object({
      scope: z.enum(["all", "filtered", "selected"]),
      filters: z.record(z.string(), z.string()).optional(),
      ids: uuidList(1000).optional(),
    }).safeParse(raw);
    if (!p.success || (p.data.scope === "selected" && !p.data.ids)) return { ok: false, error: "Requête d'export invalide" };

    const limit = APP_CONFIG.export.maxRows;
    let q = supabase.from("staff").select("*", { count: "exact" }).order("full_name", { ascending: true });
    if (p.data.scope === "selected") q = q.in("id", p.data.ids ?? []);
    else if (p.data.scope === "filtered") q = applyStaffFilters(q, parseStaffFilters(p.data.filters ?? {}));
    else q = q.is("archived_at", null);

    const { data, count, error } = await q.range(0, limit - 1);
    if (error) return { ok: false, error: "Export impossible. Réessayez." };
    if ((count ?? 0) > limit) return { ok: false, error: `Trop d'enregistrements (${count}). Affinez les filtres : la limite est de ${limit} par export.` };

    const rows = (data ?? []) as Staff[];
    const csv = toCsv(STAFF_COLUMNS, rows.map(staffRow), { bom: true });
    await logActivity(supabase, user.id, { event_type: "export_completed", description: `Export CSV staff (${p.data.scope}) : ${rows.length} ligne(s)`, metadata: { scope: p.data.scope, count: rows.length } });
    return { ok: true, data: { filename: `staff-${p.data.scope}-${stamp()}.csv`, csv, count: rows.length } };
  });
}

const exportCandidatesSchema = z.object({
  params: searchParamsSchema,
  mode: z.enum(["driving", "walking", "cycling", "public_transport"]),
  sort: z.enum(["default", "straight_line", "road_distance", "travel_time", "name"]).default("default"),
});

/**
 * Exporte les candidats d'une recherche. Les distances à vol d'oiseau et les itinéraires sont recalculés côté serveur
 * (les itinéraires viennent du cache ou du fournisseur) : on n'exporte jamais des valeurs fournies par le navigateur.
 */
export async function exportCandidatesCsv(raw: unknown): Promise<ActionResult<CsvFile>> {
  return withSession(async ({ supabase, user, profile }) => {
    const p = exportCandidatesSchema.safeParse(raw);
    if (!p.success) return { ok: false, error: "Requête d'export invalide" };
    const near = await findNearbyCandidates(supabase, p.data.params);
    if (!near.ok) return { ok: false, error: near.error };

    const mode = p.data.mode as TransportMode;
    const first = near.data.candidates.slice(0, APP_CONFIG.search.maxRouteCandidates);
    const routes = await getRouteEstimates(supabase, user.id, first.map((c) => ({ id: c.id, latitude: c.latitude, longitude: c.longitude })), near.data.origin, mode);
    const withRoutes = near.data.candidates.map((c) => {
      let route: RouteEstimate | undefined = routes.get(c.id);
      if (route && route.status !== "ok" && profile.allow_fallback_estimates) route = approximateEstimate(mode, { straightLineM: c.straightLineM }) ?? route;
      return { ...c, route };
    });
    const ranked = rankCandidates(withRoutes.map((c) => ({ ...c, fullName: c.fullName, availability: c.availability, straightLineM: c.straightLineM })), p.data.sort as SortKey);

    const headers = [
      "full_name", "staff_code", "phone", "email", "availability", "skills", "postal_code", "city", "region", "location_status", "last_location_verification",
      "straight_line_distance_km", "road_distance_km", "estimated_travel_time_min", "transport_mode", "estimate_status", "estimate_calculated_at", "reference_point",
    ];
    const rows = ranked.map((c) => {
      const r = c.route;
      const ok = r && r.status === "ok";
      const approx = r && r.status === "approximate";
      const status = !r ? "not_calculated" : ok ? "ok" : approx ? "approximate_fallback" : r.status;
      return [
        c.fullName, c.staffCode, c.phone, c.email, c.availability, c.skills.join(";"), c.postalCode, c.city, c.region, c.locationStatus, c.locationUpdatedAt,
        Number((c.straightLineM / 1000).toFixed(2)),
        ok ? Number((r.distanceM / 1000).toFixed(2)) : "",
        ok || approx ? Math.round(r.durationS / 60) : "",
        mode, status,
        ok || approx ? r.estimatedAt : "",
        near.data.mission ? `mission: ${near.data.mission.title}` : `point de recherche: ${near.data.origin.label}`,
      ];
    });
    const csv = toCsv(headers, rows, { bom: true });
    await logActivity(supabase, user.id, {
      event_type: "export_completed", mission_id: near.data.mission?.id ?? null,
      description: `Export CSV candidats : ${rows.length} ligne(s)`, metadata: { count: rows.length, mode },
    });
    return { ok: true, data: { filename: `candidats-${stamp()}.csv`, csv, count: rows.length } };
  });
}

export async function exportMissionStaffCsv(missionId: string): Promise<ActionResult<CsvFile>> {
  return withSession(async ({ supabase, user }) => {
    if (!uuidSchema.safeParse(missionId).success) return { ok: false, error: "Identifiant invalide" };
    const { data: m } = await supabase.from("missions").select("title").eq("id", missionId).maybeSingle();
    if (!m) return { ok: false, error: "Mission introuvable" };
    const { data, error } = await supabase
      .from("mission_staff")
      .select("assignment_status, selected_at, notes, staff:staff_id(full_name, staff_code, phone, email, availability_status, last_contacted_at)")
      .eq("mission_id", missionId).order("selected_at", { ascending: true });
    if (error) return { ok: false, error: "Export impossible. Réessayez." };
    type Row = { assignment_status: string; selected_at: string; notes: string | null; staff: { full_name: string; staff_code: string | null; phone: string | null; email: string | null; availability_status: string; last_contacted_at: string | null } | { full_name: string; staff_code: string | null; phone: string | null; email: string | null; availability_status: string; last_contacted_at: string | null }[] | null };
    const rows = ((data ?? []) as unknown as Row[]).map((r) => {
      const s = Array.isArray(r.staff) ? r.staff[0] : r.staff;
      return [s?.full_name, s?.staff_code, s?.phone, s?.email, r.assignment_status, r.selected_at, s?.last_contacted_at, s?.availability_status, r.notes];
    });
    const csv = toCsv(["full_name", "staff_code", "phone", "email", "assignment_status", "selected_at", "last_contacted_at", "availability", "assignment_notes"], rows, { bom: true });
    await logActivity(supabase, user.id, { event_type: "export_completed", mission_id: missionId, description: `Export CSV du staff de « ${m.title} » : ${rows.length} ligne(s)` });
    return { ok: true, data: { filename: `mission-staff-${stamp()}.csv`, csv, count: rows.length } };
  });
}

export async function exportMissionsCsv(): Promise<ActionResult<CsvFile>> {
  return withSession(async ({ supabase, user }) => {
    const { data, error } = await supabase.from("mission_overview").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(APP_CONFIG.export.maxRows);
    if (error) return { ok: false, error: "Export impossible. Réessayez." };
    const rows = ((data ?? []) as MissionOverview[]).map((m) => [
      m.mission_reference, m.title, m.country_code, m.postal_code, m.city, m.region, m.status, m.required_staff_count, m.selected_count, m.confirmed_count,
      m.scheduled_start_at, m.scheduled_end_at, m.transport_mode, m.location_status,
    ]);
    const csv = toCsv(["reference", "title", "country", "postal_code", "city", "region", "status", "required_staff", "selected_staff", "confirmed_staff", "start_utc", "end_utc", "transport_mode", "location_status"], rows, { bom: true });
    await logActivity(supabase, user.id, { event_type: "export_completed", description: `Export CSV missions : ${rows.length} ligne(s)` });
    return { ok: true, data: { filename: `missions-${stamp()}.csv`, csv, count: rows.length } };
  });
}
