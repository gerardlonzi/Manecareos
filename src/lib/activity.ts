import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityInput = {
  event_type: string;
  description: string;
  staff_id?: string | null;
  mission_id?: string | null;
  /** Données minimales uniquement : jamais de mot de passe, de jeton, ni de coordonnées exactes. */
  metadata?: Record<string, unknown>;
};

export const EVENT_LABELS: Record<string, string> = {
  staff_created: "Staff créé",
  staff_updated: "Staff modifié",
  staff_archived: "Staff archivé",
  availability_changed: "Disponibilité modifiée",
  location_resolved: "Localisation résolue",
  location_failed: "Échec de localisation",
  staff_contacted: "Staff marqué comme contacté",
  mission_created: "Mission créée",
  mission_updated: "Mission modifiée",
  mission_status_changed: "Statut de mission modifié",
  mission_cancelled: "Mission annulée",
  staff_selected: "Staff sélectionné",
  assignment_status_changed: "Statut d'affectation modifié",
  import_completed: "Import CSV terminé",
  export_completed: "Export CSV terminé",
  routing_failed: "Échec du calcul d'itinéraire",
};

/** Journal append-only. Un échec de journalisation ne doit pas annuler l'action métier : il est consigné côté serveur. */
export async function logActivity(supabase: SupabaseClient, ownerId: string, e: ActivityInput | ActivityInput[]): Promise<void> {
  const list = (Array.isArray(e) ? e : [e]).map((x) => ({
    owner_id: ownerId,
    staff_id: x.staff_id ?? null,
    mission_id: x.mission_id ?? null,
    event_type: x.event_type,
    description: x.description.slice(0, 500),
    metadata: x.metadata ?? {},
  }));
  if (list.length === 0) return;
  const { error } = await supabase.from("activity_logs").insert(list);
  if (error) console.error("[activity] insertion impossible:", error.code, error.message);
}

export type NotificationInput = { type: string; title: string; message: string; link?: string | null };

export async function notify(supabase: SupabaseClient, ownerId: string, n: NotificationInput): Promise<void> {
  const link = n.link && n.link.startsWith("/") && !n.link.startsWith("//") ? n.link : null;
  const { error } = await supabase.from("notifications").insert({
    owner_id: ownerId,
    type: n.type,
    title: n.title.slice(0, 200),
    message: n.message.slice(0, 1000),
    link,
  });
  if (error) console.error("[notify] insertion impossible:", error.code, error.message);
}
