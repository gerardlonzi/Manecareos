import { NextResponse } from "next/server";
import { raiseDocumentAlert } from "@/lib/document-alerts";
import { todayIso, type DocType } from "@/lib/documents";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
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
    const p = prof.get(r.owner_id);
    const res = await raiseDocumentAlert(db, { ownerId: r.owner_id, documentId: r.id, staffId: r.staff_id, staff, type, expiresOn: r.expires_at, autoEmail: Boolean(p?.auto_email_documents), company: p?.company_name || "Maneliza Care" });
    if (res === "notified") stats.notified++;
  }

  // Purge : activité > 21 jours, journal d’accès > 12 mois, codes de connexion périmés.
  const [a, b, c] = await Promise.all([db.rpc("purge_old_activity", { p_days: 21 }), db.rpc("purge_old_access_log", { p_days: 365 }), db.rpc("purge_login_codes")]);
  stats.purged = { activity: a.error ? "error" : a.data, access_log: b.error ? "error" : b.data, login_codes: c.error ? "error" : c.data };
  return NextResponse.json({ ok: true, ...stats });
}
