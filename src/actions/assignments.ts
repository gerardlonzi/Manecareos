"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ASSIGNMENT_STATUS_LABELS } from "@/config/app";
import { logActivity, notify } from "@/lib/activity";
import { syncMissionStatus } from "@/lib/missions";
import type { ActionResult, AssignmentStatus, Mission, Staff } from "@/lib/types";
import { uuidSchema } from "@/lib/validation";
import { isUniqueViolation, withSession } from "./helpers";

const refresh = (missionId: string) => {
  revalidatePath(`/missions/${missionId}`);
  revalidatePath(`/missions/${missionId}/staff`);
  revalidatePath("/missions");
  revalidatePath("/dashboard");
};

/** Sélection ≠ acceptation : l'affectation démarre à « Sélectionné ». La mission ET le staff doivent appartenir au manager (RLS + trigger SQL). */
export async function selectStaffForMission(missionId: string, staffId: string): Promise<ActionResult<{ assignmentId: string }>> {
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
