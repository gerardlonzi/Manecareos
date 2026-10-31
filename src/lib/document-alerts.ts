import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { alertThreshold, daysUntil, todayIso, type DocType } from "@/lib/documents";
import { isEmailConfigured, sendEmail } from "@/lib/email/brevo";
import { documentExpiryEmail } from "@/lib/email/templates";

export type DocAlertInput = {
  ownerId: string; documentId: string; staffId: string;
  staff: { full_name: string; email: string | null };
  type: Pick<DocType, "name_fr" | "name_en" | "alert_days">;
  expiresOn: string;
  /** Envoyer aussi l'e-mail automatiquement (réglage « e-mails automatiques ») */
  autoEmail: boolean;
  company: string;
};

/**
 * Crée la notification d'un document expiré ou bientôt expiré (une seule fois par document / échéance / seuil).
 * Utilisée à la saisie d'une date (réaction immédiate) ET par la tâche quotidienne (idempotent : pas de doublon).
 * Le bouton « Envoyer un rappel » de la notification envoie ensuite l'e-mail au staff.
 */
export async function raiseDocumentAlert(db: SupabaseClient, p: DocAlertInput): Promise<"notified" | "skipped"> {
  const daysLeft = daysUntil(p.expiresOn, todayIso());
  const threshold = alertThreshold(daysLeft, p.type.alert_days?.length ? p.type.alert_days : [60, 30, 14, 7, 0]);
  if (threshold === null) return "skipped";

  const { error: dup } = await db.from("document_alerts").insert({ owner_id: p.ownerId, document_id: p.documentId, expires_on: p.expiresOn, threshold_days: threshold, kind: "notification" });
  if (dup) return "skipped";

  const expired = daysLeft < 0;
  let emailedAt: string | null = null;
  if (p.autoEmail && p.staff.email && isEmailConfigured()) {
    const mail = documentExpiryEmail({ staffName: p.staff.full_name, documentName: { fr: p.type.name_fr, en: p.type.name_en }, expiresOn: p.expiresOn, daysLeft, company: p.company });
    const sent = await sendEmail({ to: p.staff.email, toName: p.staff.full_name, ...mail });
    if (sent.ok) {
      emailedAt = new Date().toISOString();
      await db.from("document_alerts").insert({ owner_id: p.ownerId, document_id: p.documentId, expires_on: p.expiresOn, threshold_days: threshold, kind: "email" });
      await db.from("document_access_log").insert({ owner_id: p.ownerId, staff_id: p.staffId, document_id: p.documentId, action: "email_sent" });
    }
  }

  const reasonFr = expired ? `a expiré le ${p.expiresOn}` : daysLeft === 0 ? "expire aujourd’hui" : `expire dans ${daysLeft} jour(s) (${p.expiresOn})`;
  const { error } = await db.from("notifications").insert({
    owner_id: p.ownerId, type: expired ? "document_expired" : "document_expiring",
    title: expired ? "Document expiré" : "Document bientôt expiré",
    message: `${p.staff.full_name} : « ${p.type.name_fr} » ${reasonFr}.` + (emailedAt ? " Un e-mail de rappel a été envoyé automatiquement au staff." : ""),
    link: `/staff/${p.staffId}`, email_sent_at: emailedAt,
    metadata: { document_id: p.documentId, staff_id: p.staffId, staff_name: p.staff.full_name, expires_on: p.expiresOn, days_left: daysLeft, threshold, auto_email: Boolean(emailedAt), doc_fr: p.type.name_fr, doc_en: p.type.name_en },
  });
  if (error) { console.error("[document-alert] notification impossible:", error.code, error.message); return "skipped"; }
  return "notified";
}
