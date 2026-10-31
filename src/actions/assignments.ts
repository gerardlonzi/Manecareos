"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ASSIGNMENT_STATUS_LABELS } from "@/config/app";
import { logActivity, notify } from "@/lib/activity";
import { syncMissionStatus } from "@/lib/missions";
import { guardAssignment, notifyWeeklyCap } from "@/lib/compliance";
import { hoursBetween, parseHoursInput } from "@/lib/hours";
import { zonedLocalToUtcIso } from "@/lib/time";
import type { ActionResult, AssignmentStatus, Mission, Staff } from "@/lib/types";
import { fieldErrorsFrom, uuidSchema } from "@/lib/validation";
import { isUniqueViolation, withSession } from "./helpers";

const refresh = (missionId: string) => {
  revalidatePath(`/missions/${missionId}`);
  revalidatePath(`/missions/${missionId}/staff`);
  revalidatePath("/missions");
  revalidatePath("/dashboard");
};

/** Sélection ≠ acceptation : l'affectation démarre à « Sélectionné ». La mission ET le staff doivent appartenir au manager (RLS + trigger SQL). */
export async function selectStaffForMission(missionId: string, staffId: string, confirmWarnings = false): Promise<ActionResult<{ assignmentId: string }>> {
  return withSession(async ({ supabase, user }) => {
    if (!uuidSchema.safeParse(missionId).success || !uuidSchema.safeParse(staffId).success) return { ok: false, error: "Requête invalide" };

    const [{ data: mData }, { data: sData }] = await Promise.all([
      supabase.from("missions").select("*").eq("id", missionId).maybeSingle(),
      supabase.from("staff").select("*").eq("id", staffId).maybeSingle(),
    ]);
    const mission = mData as Mission | null;
    const staff = sData as Staff | null;
    if (!mission || !staff) return { ok: false, error: "Mission ou staff introuvable" };
    if (mission.status === "cancelled" || mission.status === "completed") return { ok: false, error: "Cette mission est clôturée : plus de sélection possible." };
    if (staff.archived_at) return { ok: false, error: "Ce staff est archivé." };

    // Contrôles : documents obligatoires (bloquant), expiration, indisponibilité, chevauchement, plafond d'heures (confirmation).
    const guard = await guardAssignment(supabase, staff, mission);
    if (guard.blocked) return { ok: false, error: "Attribution impossible : dossier du staff incomplet ou document expiré.", issues: guard.issues };
    if (guard.issues.length > 0 && !confirmWarnings) return { ok: false, error: "Points d’attention à confirmer avant d’attribuer.", issues: guard.issues };

    const { data, error } = await supabase
      .from("mission_staff").insert({ owner_id: user.id, mission_id: missionId, staff_id: staffId }).select("id").single();
    if (error || !data) {
      if (isUniqueViolation(error)) return { ok: false, error: `${staff.full_name} est déjà sélectionné pour cette mission.` };
      return { ok: false, error: "Sélection impossible. Réessayez." };
    }

    await logActivity(supabase, user.id, {
      event_type: "staff_selected", staff_id: staffId, mission_id: missionId,
      description: `${staff.full_name} sélectionné pour « ${mission.title} »`,
    });
    await notifyWeeklyCap(supabase, user.id, staff, mission.scheduled_start_at);
    const after = await syncMissionStatus(supabase, user.id, missionId);
    if (after && after.selected_count === after.required_staff_count) {
      await notify(supabase, user.id, {
        type: "staffing_progress", title: "Effectif sélectionné atteint",
        message: `« ${mission.title} » : ${after.selected_count} sélectionné(s). Il reste à obtenir leur confirmation.`, link: `/missions/${missionId}`,
      });
    }
    refresh(missionId);
    return { ok: true, data: { assignmentId: data.id as string }, message: `${staff.full_name} sélectionné — en attente de contact et de confirmation` };
  });
}

const statusSchema = z.enum(["selected", "contacted", "confirmed", "declined", "cancelled", "completed"]);

export async function setAssignmentStatus(assignmentId: string, status: AssignmentStatus): Promise<ActionResult> {
  return withSession(async ({ supabase, user }) => {
    if (!uuidSchema.safeParse(assignmentId).success || !statusSchema.safeParse(status).success) return { ok: false, error: "Requête invalide" };

    const { data: a } = await supabase.from("mission_staff").select("id, mission_id, staff_id, assignment_status").eq("id", assignmentId).maybeSingle();
    if (!a) return { ok: false, error: "Affectation introuvable" };
    if (a.assignment_status === status) return { ok: true, message: "Statut inchangé" };

    const [{ data: s }, { data: m }] = await Promise.all([
      supabase.from("staff").select("full_name").eq("id", a.staff_id).maybeSingle(),
      supabase.from("missions").select("title, status").eq("id", a.mission_id).maybeSingle(),
    ]);
    if (!s || !m) return { ok: false, error: "Données liées introuvables" };
    if (m.status === "cancelled") return { ok: false, error: "Mission annulée : affectation non modifiable." };

    const { error } = await supabase.from("mission_staff").update({ assignment_status: status }).eq("id", assignmentId);
    if (error) {
      if (isUniqueViolation(error)) return { ok: false, error: "Ce staff a déjà une affectation active pour cette mission." };
      return { ok: false, error: "Modification impossible. Réessayez." };
    }
    if (status === "contacted") await supabase.from("staff").update({ last_contacted_at: new Date().toISOString() }).eq("id", a.staff_id);

    await logActivity(supabase, user.id, {
      event_type: "assignment_status_changed", staff_id: a.staff_id, mission_id: a.mission_id,
      description: `${s.full_name} · « ${m.title} » : ${ASSIGNMENT_STATUS_LABELS[a.assignment_status as AssignmentStatus]} → ${ASSIGNMENT_STATUS_LABELS[status]}`,
      metadata: { from: a.assignment_status, to: status },
    });
    if (status === "declined") {
      await notify(supabase, user.id, {
        type: "assignment_declined", title: "Un staff a refusé",
        message: `${s.full_name} a refusé « ${m.title} ». Il faut trouver un remplaçant.`, link: `/missions/${a.mission_id}/staff`,
      });
    }
    await syncMissionStatus(supabase, user.id, a.mission_id);
    refresh(a.mission_id);
    return { ok: true, message: `Statut : ${ASSIGNMENT_STATUS_LABELS[status]}` };
  });
}

/** « Retirer » = annuler l'affectation (l'historique reste consultable). */
export async function removeAssignment(assignmentId: string): Promise<ActionResult> {
  return setAssignmentStatus(assignmentId, "cancelled");
}

const shiftSchema = z.object({
  shift_start_local: z.string().trim().max(16).optional().transform((v) => v || null),
  shift_end_local: z.string().trim().max(16).optional().transform((v) => v || null),
  hours: z.string().trim().max(8).optional().transform((v) => v || null),
  pay_rate: z.string().trim().max(10).optional().transform((v) => v || null),
  completed: z.boolean(),
});

/** Heures réellement travaillées (début/fin → calcul auto, ou saisie directe), paie et case « terminée ». */
export async function updateAssignmentShift(assignmentId: string, raw: unknown): Promise<ActionResult> {
  return withSession(async ({ supabase, user, profile }) => {
    if (!uuidSchema.safeParse(assignmentId).success) return { ok: false, error: "Requête invalide" };
    const p = shiftSchema.safeParse(raw);
    if (!p.success) return { ok: false, error: "Formulaire invalide", fieldErrors: fieldErrorsFrom(p.error) };
    const v = p.data;

    const { data: a } = await supabase.from("mission_staff").select("id, mission_id, staff_id, assignment_status").eq("id", assignmentId).maybeSingle();
    if (!a) return { ok: false, error: "Affectation introuvable" };
    const [{ data: m }, { data: s }] = await Promise.all([
      supabase.from("missions").select("title, status, planned_hours, pay_rate, scheduled_start_at").eq("id", a.mission_id).maybeSingle(),
      supabase.from("staff").select("*").eq("id", a.staff_id).maybeSingle(),
    ]);
    const staff = s as Staff | null;
    if (!m || !staff) return { ok: false, error: "Données liées introuvables" };
    if (m.status === "cancelled") return { ok: false, error: "Mission annulée : affectation non modifiable." };
    if (a.assignment_status === "declined" || a.assignment_status === "cancelled") return { ok: false, error: "Affectation refusée ou annulée : non modifiable." };

    const fieldErrors: Record<string, string> = {};
    const startIso = v.shift_start_local ? zonedLocalToUtcIso(v.shift_start_local, profile.timezone) : null;
    const endIso = v.shift_end_local ? zonedLocalToUtcIso(v.shift_end_local, profile.timezone) : null;
    if (v.shift_start_local && !startIso) fieldErrors.shift_start_local = "Date invalide";
    if (v.shift_end_local && !endIso) fieldErrors.shift_end_local = "Date invalide";
    if (startIso && endIso && Date.parse(endIso) < Date.parse(startIso)) fieldErrors.shift_end_local = "La fin ne peut pas précéder le début";

    let worked: number | null = null;
    if (v.hours) { worked = parseHoursInput(v.hours); if (worked === null || worked > 744) fieldErrors.hours = "Heures invalides (ex. 7,5 ou 7h30)"; }
    else worked = hoursBetween(startIso, endIso);
    let rate: number | null = null;
    if (v.pay_rate) { const n = Number(v.pay_rate.replace(",", ".")); if (!Number.isFinite(n) || n < 0 || n > 100000) fieldErrors.pay_rate = "Montant invalide"; else rate = Math.round(n * 100) / 100; }
    if (Object.keys(fieldErrors).length) return { ok: false, error: "Formulaire invalide", fieldErrors };

    if (v.completed && worked === null) worked = (m as { planned_hours: number | null }).planned_hours ?? null;
    if (v.completed && worked === null) return { ok: false, error: "Indiquez les heures travaillées (début/fin ou durée) pour terminer.", fieldErrors: { hours: "Heures requises" } };

    const status: AssignmentStatus = v.completed ? "completed" : a.assignment_status === "completed" ? "confirmed" : a.assignment_status;
    const { error } = await supabase.from("mission_staff").update({
      shift_start_at: startIso, shift_end_at: endIso, hours_worked: worked, pay_rate: rate,
      assignment_status: status, completed_at: v.completed ? new Date().toISOString() : null,
    }).eq("id", assignmentId);
    if (error) return { ok: false, error: "Enregistrement impossible. Réessayez." };

    await logActivity(supabase, user.id, {
      event_type: v.completed ? "assignment_completed" : "assignment_hours_updated", staff_id: a.staff_id, mission_id: a.mission_id,
      description: `${staff.full_name} · « ${m.title} » : ${worked ?? 0} h${v.completed ? " — terminée" : ""}`,
    });
    await notifyWeeklyCap(supabase, user.id, staff, startIso ?? (m as { scheduled_start_at: string | null }).scheduled_start_at);
    await syncMissionStatus(supabase, user.id, a.mission_id);
    refresh(a.mission_id); revalidatePath(`/staff/${a.staff_id}`); revalidatePath("/hours");
    return { ok: true, message: v.completed ? "Mission terminée enregistrée" : "Heures enregistrées" };
  });
}
