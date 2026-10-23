import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logActivity, notify } from "@/lib/activity";
import type { MissionOverview, MissionStatus } from "@/lib/types";

/**
 * Aligne le statut de la mission sur les affectations réelles.
 * - « staffed » exige des affectations CONFIRMÉES (une simple sélection ne suffit pas).
 * - Seuls open / staffing_in_progress / staffed sont ajustés automatiquement ; brouillon, terminée et annulée ne bougent jamais seules.
 */
export async function syncMissionStatus(supabase: SupabaseClient, ownerId: string, missionId: string): Promise<MissionOverview | null> {
  const { data } = await supabase.from("mission_overview").select("*").eq("id", missionId).maybeSingle();
  const m = data as MissionOverview | null;
  if (!m) return null;
  if (!(["open", "staffing_in_progress", "staffed"] as MissionStatus[]).includes(m.status)) return m;

  let next: MissionStatus = m.status;
  if (m.confirmed_count >= m.required_staff_count) next = "staffed";
  else if (m.selected_count > 0) next = "staffing_in_progress";
  else next = "open";

  if (next !== m.status) {
    const { error } = await supabase.from("missions").update({ status: next }).eq("id", missionId);
    if (!error) {
      await logActivity(supabase, ownerId, {
        event_type: "mission_status_changed", mission_id: missionId,
        description: `Mission « ${m.title} » : statut ${m.status} → ${next}`,
        metadata: { from: m.status, to: next },
      });
      if (next === "staffed") {
        await notify(supabase, ownerId, {
          type: "mission_staffed", title: "Mission pourvue",
          message: `« ${m.title} » a ${m.confirmed_count} affectation(s) confirmée(s) sur ${m.required_staff_count} requise(s).`,
          link: `/missions/${missionId}`,
        });
      }
      return { ...m, status: next };
    }
  }
  return m;
}
