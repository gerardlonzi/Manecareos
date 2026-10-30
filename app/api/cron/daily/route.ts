import { NextResponse } from "next/server";
import { alertThreshold, daysUntil, todayIso, type DocType } from "@/lib/documents";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isEmailConfigured, sendEmail } from "@/lib/email/brevo";
import { documentExpiryEmail } from "@/lib/email/templates";
import { safeEqual } from "@/lib/security/token";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Row = {
  id: string; owner_id: string; staff_id: string; expires_at: string; type_id: string;
  document_types: Pick<DocType, "name_fr" | "name_en" | "alert_days" | "mandatory" | "archived_at"> | Pick<DocType, "name_fr" | "name_en" | "alert_days" | "mandatory" | "archived_at">[] | null;
  staff: { full_name: string; email: string | null } | { full_name: string; email: string | null }[] | null;
};
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

/** Tâche quotidienne (Vercel Cron) : alertes d’expiration + e-mails automatiques + purge des données anciennes. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || secret.length < 16 || !safeEqual(auth, `Bearer ${secret}`)) return new NextResponse("Unauthorized", { status: 401 });
  if (!isAdminConfigured()) return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 });

  const db = createAdminClient();
  const today = todayIso();
  const horizon = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const stats = { scanned: 0, notified: 0, emailed: 0, purged: {} as Record<string, unknown> };

  const { data: profiles } = await db.from("profiles").select("id, company_name, auto_email_documents");
  const prof = new Map((profiles ?? []).map((p: { id: string; company_name: string | null; auto_email_documents: boolean | null }) => [p.id, p]));

  const { data } = await db.from("staff_documents")
    .select("id, owner_id, staff_id, expires_at, type_id, document_types(name_fr, name_en, alert_days, mandatory, archived_at), staff(full_name, email)")
    .eq("no_expiry", false).not("expires_at", "is", null).lte("expires_at", horizon).limit(5000);

  for (const r of (data ?? []) as unknown as Row[]) {
    const type = one(r.document_types), staff = one(r.staff);
    if (!type || !staff || type.archived_at) continue;
    stats.scanned++;
    const daysLeft = daysUntil(r.expires_at, today);
    const threshold = alertThreshold(daysLeft, type.alert_days?.length ? type.alert_days : [60, 30, 14, 7, 0]);
    if (threshold === null) continue;

    // Une seule alerte par document / échéance / seuil (idempotent : le cron peut être relancé sans doublon).
    const { error: dup } = await db.from("document_alerts").insert({ owner_id: r.owner_id, document_id: r.id, expires_on: r.expires_at, threshold_days: threshold, kind: "notification" });
    if (dup) continue;

    const expired = daysLeft < 0;
    const p = prof.get(r.owner_id);
    let emailedAt: string | null = null;

    if (p?.auto_email_documents && staff.email && isEmailConfigured()) {
      const mail = documentExpiryEmail({ staffName: staff.full_name, documentName: { fr: type.name_fr, en: type.name_en }, expiresOn: r.expires_at, daysLeft, company: p.company_name || "Maneliza Care" });
      const sent = await sendEmail({ to: staff.email, toName: staff.full_name, ...mail });
      if (sent.ok) {
        emailedAt = new Date().toISOString();
        await db.from("document_alerts").insert({ owner_id: r.owner_id, document_id: r.id, expires_on: r.expires_at, threshold_days: threshold, kind: "email" });
        await db.from("document_access_log").insert({ owner_id: r.owner_id, staff_id: r.staff_id, document_id: r.id, action: "email_sent" });
        stats.emailed++;
      }
    }

    const reasonFr = expired ? `a expiré le ${r.expires_at}` : daysLeft === 0 ? "expire aujourd’hui" : `expire dans ${daysLeft} jour(s) (${r.expires_at})`;
    await db.from("notifications").insert({
      owner_id: r.owner_id, type: expired ? "document_expired" : "document_expiring",
      title: expired ? "Document expiré" : "Document bientôt expiré",
      message: `${staff.full_name} : « ${type.name_fr} » ${reasonFr}.` + (emailedAt ? " Un e-mail de rappel a été envoyé automatiquement au staff." : ""),
      link: `/staff/${r.staff_id}`, email_sent_at: emailedAt,
      metadata: { document_id: r.id, staff_id: r.staff_id, staff_name: staff.full_name, expires_on: r.expires_at, days_left: daysLeft, threshold, auto_email: Boolean(emailedAt), doc_fr: type.name_fr, doc_en: type.name_en },
    });
    stats.notified++;
  }

  // Purge : activité > 21 jours, journal d’accès > 12 mois, codes de connexion périmés.
  const [a, b, c] = await Promise.all([db.rpc("purge_old_activity", { p_days: 21 }), db.rpc("purge_old_access_log", { p_days: 365 }), db.rpc("purge_login_codes")]);
  stats.purged = { activity: a.error ? "error" : a.data, access_log: b.error ? "error" : b.data, login_codes: c.error ? "error" : c.data };
  return NextResponse.json({ ok: true, ...stats });
}
