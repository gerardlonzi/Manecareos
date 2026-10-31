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

export { EVENT_LABELS, EVENT_LABELS_EN } from "@/config/activity-labels";

/**
 * Journal d'activité : on n'enregistre QUE les événements importants (création, archivage, missions, affectations,
 * imports/exports, suppression ou rappel de documents). Les modifications courantes (fiche, photo, heures,
 * disponibilité, enregistrement d'un document, recherches…) ne sont pas journalisées, pour ne pas saturer la base.
 */
export const IMPORTANT_EVENTS: ReadonlySet<string> = new Set([
  "staff_created", "staff_archived",
  "mission_created", "mission_cancelled", "mission_status_changed",
  "staff_selected", "assignment_status_changed", "assignment_completed",
  "import_completed", "export_completed",
  "document_deleted", "document_email_sent",
]);

/** Journal append-only. Un échec de journalisation ne doit pas annuler l'action métier : il est consigné côté serveur. */
export async function logActivity(supabase: SupabaseClient, ownerId: string, e: ActivityInput | ActivityInput[]): Promise<void> {
  const list = (Array.isArray(e) ? e : [e]).filter((x) => IMPORTANT_EVENTS.has(x.event_type)).map((x) => ({
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

export type NotificationInput = { type: string; title: string; message: string; link?: string | null; metadata?: Record<string, unknown> };

export async function notify(supabase: SupabaseClient, ownerId: string, n: NotificationInput): Promise<string | null> {
  const link = n.link && n.link.startsWith("/") && !n.link.startsWith("//") ? n.link : null;
  const { data, error } = await supabase.from("notifications").insert({
    owner_id: ownerId,
    type: n.type,
    title: n.title.slice(0, 200),
    message: n.message.slice(0, 1000),
    link,
    metadata: n.metadata ?? {},
  }).select("id").single();
  if (error) { console.error("[notify] insertion impossible:", error.code, error.message); return null; }
  return (data as { id: string } | null)?.id ?? null;
}
