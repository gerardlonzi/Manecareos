import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/activity";
import { evaluateAssignment, type GuardIssue } from "@/lib/assignment-guard";
import { expiringBefore, staffCompliance, type Compliance, type DocType, type StaffDoc } from "@/lib/documents";
import { hoursBetween, overlaps, weekRange } from "@/lib/hours";
import type { Mission, Staff } from "@/lib/types";

/** Types de documents du manager (crée les 5 types par défaut à la première visite). */
export async function loadDocTypes(supabase: SupabaseClient, opts: { includeArchived?: boolean } = {}): Promise<DocType[]> {
  const read = async () => {
    let q = supabase.from("document_types").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
    if (!opts.includeArchived) q = q.is("archived_at", null);
    const { data } = await q;
    return (data ?? []) as DocType[];
  };
  let list = await read();
  if (list.length === 0) { await supabase.rpc("ensure_default_document_types"); list = await read(); }
  return list;
}

export async function loadDocsByStaff(supabase: SupabaseClient, staffIds: string[]): Promise<Map<string, StaffDoc[]>> {
  const map = new Map<string, StaffDoc[]>();
  if (staffIds.length === 0) return map;
  const { data } = await supabase.from("staff_documents")
    .select("id, staff_id, type_id, expires_at, no_expiry, file_public_id, file_name, link_url, note, issued_at").in("staff_id", staffIds.slice(0, 1000));
  for (const d of (data ?? []) as StaffDoc[]) { const l = map.get(d.staff_id) ?? []; l.push(d); map.set(d.staff_id, l); }
  return map;
}

export async function complianceFor(supabase: SupabaseClient, staffIds: string[]): Promise<{ types: DocType[]; byStaff: Map<string, Compliance>; docs: Map<string, StaffDoc[]> }> {
  const [types, docs] = await Promise.all([loadDocTypes(supabase), loadDocsByStaff(supabase, staffIds)]);
  const byStaff = new Map<string, Compliance>();
  for (const id of staffIds) byStaff.set(id, staffCompliance(types, docs.get(id) ?? []));
  return { types, byStaff, docs };
}

export type HoursUse = { reserved: number; worked: number; total: number; missions: number; completed: number };

/** Heures par staff sur une période (RPC staff_hours_summary, RLS appliquée). */
export async function hoursSummary(supabase: SupabaseClient, from: Date, to: Date): Promise<Map<string, HoursUse>> {
  const { data } = await supabase.rpc("staff_hours_summary", { p_from: from.toISOString(), p_to: to.toISOString() });
  const map = new Map<string, HoursUse>();
  for (const r of (data ?? []) as { staff_id: string; reserved_hours: number | string; worked_hours: number | string; missions_count: number; completed_count: number }[]) {
    const reserved = Number(r.reserved_hours), worked = Number(r.worked_hours);
    map.set(r.staff_id, { reserved, worked, total: Math.round((reserved + worked) * 100) / 100, missions: r.missions_count, completed: r.completed_count });
  }
  return map;
}

export const currentWeekHours = (supabase: SupabaseClient, now = new Date()) => { const w = weekRange(now); return hoursSummary(supabase, w.from, w.to); };

/** Règles à vérifier avant d'attribuer ce staff à cette mission. */
export async function guardAssignment(supabase: SupabaseClient, staff: Staff, mission: Mission): Promise<{ issues: GuardIssue[]; blocked: boolean }> {
  const [types, docsMap] = await Promise.all([loadDocTypes(supabase), loadDocsByStaff(supabase, [staff.id])]);
  const docs = docsMap.get(staff.id) ?? [];
  const compliance = staffCompliance(types, docs);

  const start = mission.scheduled_start_at, end = mission.scheduled_end_at ?? mission.scheduled_start_at;
  const endDay = end ? end.slice(0, 10) : null;
  const expiringDuring = endDay ? expiringBefore(types, docs, endDay).map((e) => e.type) : [];

  let overlappingCount = 0;
  if (start && mission.scheduled_end_at) {
    const { data } = await supabase.from("mission_staff")
      .select("mission_id, shift_start_at, shift_end_at, missions!inner(scheduled_start_at, scheduled_end_at)")
      .eq("staff_id", staff.id).in("assignment_status", ["selected", "contacted", "confirmed"]).neq("mission_id", mission.id);
    for (const r of (data ?? []) as unknown as { shift_start_at: string | null; shift_end_at: string | null; missions: { scheduled_start_at: string | null; scheduled_end_at: string | null } | { scheduled_start_at: string | null; scheduled_end_at: string | null }[] }[]) {
      const m = Array.isArray(r.missions) ? r.missions[0] : r.missions;
      const s = r.shift_start_at ?? m?.scheduled_start_at, e = r.shift_end_at ?? m?.scheduled_end_at;
      if (s && e && overlaps({ start, end: mission.scheduled_end_at }, { start: s, end: e })) overlappingCount++;
    }
  }

  const newHours = mission.planned_hours ?? hoursBetween(mission.scheduled_start_at, mission.scheduled_end_at) ?? 0;
  const week = weekRange(start ? new Date(start) : new Date());
  const used = (await hoursSummary(supabase, week.from, week.to)).get(staff.id)?.total ?? 0;

  return evaluateAssignment({ compliance, expiringDuringMission: expiringDuring, available: staff.availability_status !== "unavailable", overlappingCount, weeklyCap: staff.weekly_hours, hoursUsedThatWeek: used, newHours });
}

/** Notifie (une fois par semaine et par staff) quand le plafond d'heures hebdomadaires est atteint ou dépassé. */
export async function notifyWeeklyCap(supabase: SupabaseClient, ownerId: string, staff: Staff, refIso: string | null) {
  if (!staff.weekly_hours) return;
  const week = weekRange(refIso ? new Date(refIso) : new Date());
  const used = (await hoursSummary(supabase, week.from, week.to)).get(staff.id)?.total ?? 0;
  if (used < staff.weekly_hours) return;
  const key = `${staff.id}:${week.from.toISOString().slice(0, 10)}`;
  const { data: dup } = await supabase.from("notifications").select("id").eq("type", "hours_cap_reached").contains("metadata", { key }).limit(1);
  if (dup && dup.length) return;
  await notify(supabase, ownerId, {
    type: "hours_cap_reached", title: "Plafond d’heures atteint",
    message: `${staff.full_name} atteint ${Math.round(used * 100) / 100} h sur ${staff.weekly_hours} h cette semaine${used > staff.weekly_hours ? " (dépassement)" : ""}.`,
    link: `/staff/${staff.id}`, metadata: { key, staff_id: staff.id, used, cap: staff.weekly_hours },
  });
}

