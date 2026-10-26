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
