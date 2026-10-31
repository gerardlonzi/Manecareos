"use client";
import { friendlyError } from "@/lib/user-message";
import { usePreferences } from "@/components/providers/preferences-provider";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, CheckCheck, ChevronRight, Mail, MailCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { sendDocumentEmail } from "@/actions/documents";
import { deleteNotification, deleteReadNotifications, markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import type { Notification } from "@/lib/types";

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const { t } = usePreferences();
  const [pending, start] = React.useTransition();
  return (
    <Button variant="secondary" disabled={disabled} pending={pending} onClick={() => start(async () => {
      const r = await markAllNotificationsRead();
      if (r.ok) toast.success(r.message ?? "Fait"); else toast.error(friendlyError(r.error));
      router.refresh();
    })}>
      {!pending ? <CheckCheck className="h-4 w-4" aria-hidden /> : null} {t("Tout marquer comme lu", "Mark all as read")}
    </Button>
  );
}

export function DeleteReadButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const { t, tm } = usePreferences();
  const [pending, start] = React.useTransition();
  return (
    <Button variant="secondary" disabled={disabled} pending={pending} onClick={() => start(async () => {
      const r = await deleteReadNotifications();
      if (r.ok) toast.success(tm(r.message ?? "Fait")); else toast.error(friendlyError(r.error));
      router.refresh();
    })}>
      {!pending ? <Trash2 className="h-4 w-4" aria-hidden /> : null} {t("Supprimer les lues", "Delete read")}
    </Button>
  );
}

type Meta = { document_id?: string; staff_name?: string; doc_fr?: string; doc_en?: string; days_left?: number; expires_on?: string; auto_email?: boolean; used?: number; cap?: number; emailed_to?: string };

/** Notifications de documents / heures : le texte est reconstruit depuis les métadonnées, dans la langue choisie. */
function metaNotification(n: Notification, locale: "fr" | "en"): { title: string; message: string } | null {
  const m = (n.metadata ?? {}) as Meta;
  if (!m.staff_name) return null;
  const fr = locale === "fr";
  const doc = (fr ? m.doc_fr : m.doc_en) ?? m.doc_fr ?? "";
  if (n.type === "document_expired" || n.type === "document_expiring") {
    const left = m.days_left ?? 0;
    const when = left < 0 ? (fr ? `a expiré le ${m.expires_on}` : `expired on ${m.expires_on}`) : left === 0 ? (fr ? "expire aujourd’hui" : "expires today") : (fr ? `expire dans ${left} jour(s) (${m.expires_on})` : `expires in ${left} day(s) (${m.expires_on})`);
    return { title: n.type === "document_expired" ? (fr ? "Document expiré" : "Document expired") : (fr ? "Document bientôt expiré" : "Document expiring soon"), message: `${m.staff_name} : « ${doc} » ${when}.` };
  }
  if (n.type === "document_email_sent") return { title: fr ? "Rappel envoyé" : "Reminder sent", message: fr ? `Un rappel a été envoyé à ${m.staff_name} : le document « ${doc} » doit être renouvelé.` : `A reminder was sent to ${m.staff_name}: the document “${doc}” needs to be renewed.` };
  if (n.type === "hours_cap_reached") return { title: fr ? "Plafond d’heures atteint" : "Weekly hours cap reached", message: fr ? `${m.staff_name} atteint ${m.used} h sur ${m.cap} h cette semaine.` : `${m.staff_name} reaches ${m.used} h out of ${m.cap} h this week.` };
  return null;
}

function translatedNotification(n: Notification, locale: "fr" | "en", t: (fr: string, en: string) => string) {
  const meta = metaNotification(n, locale);
  if (meta) return meta;
  if (locale === "fr") return { title: n.title, message: n.message };
  const titleMap: Record<string, string> = {
    mission_staffed: "Assignment fully staffed", staffing_progress: "Selected staffing target reached", assignment_declined: "A staff member declined", mission_needs_staff: "New assignment needs staff", import_completed: "Import completed", import_errors: "Rows rejected during import",
  };
  const titleByFrench: Record<string, string> = {
    "Localisation non résolue": "Location could not be resolved", "Localisations non résolues": "Locations could not be resolved", "Localisation de mission non résolue": "Assignment location could not be resolved", "Localisations à vérifier": "Locations need review",
  };
  let message = n.message;
  const missionName = n.message.match(/[«“](.*?)[»”]/)?.[1];
  if (n.type === "mission_staffed") {
    const m = n.message.match(/a (\d+) affectation\(s\) confirmée\(s\) sur (\d+) requise\(s\)/);
    if (missionName && m) message = `“${missionName}” has ${m[1]} confirmed assignment(s) out of ${m[2]} required.`;
  } else if (n.type === "staffing_progress") {
    const count = n.message.match(/(\d+) sélectionné\(s\)/)?.[1];
    if (missionName && count) message = `“${missionName}”: ${count} selected. Their confirmations are still needed.`;
  } else if (n.type === "assignment_declined") {
    const name = n.message.split(" a refusé")[0];
    if (name && missionName) message = `${name} declined “${missionName}”. Find a replacement to continue.`;
  } else if (n.type === "mission_needs_staff") {
    const count = n.message.match(/(\d+) personne\(s\) à trouver/)?.[1];
    if (missionName && count) message = `“${missionName}”: ${count} person/people still needed.`;
  } else if (n.type === "import_completed") {
    const m = n.message.match(/(\d+) staff importé\(s\) sur (\d+) ligne\(s\)\. (\d+) localisation\(s\) vérifiée\(s\)/);
    if (m) message = `${m[1]} staff record(s) imported from ${m[2]} row(s). ${m[3]} location(s) verified.`;
  } else if (n.type === "import_errors") {
    const count = n.message.match(/(\d+) ligne\(s\)/)?.[1];
    if (count) message = `${count} row(s) were not imported. Download the error report from the import page.`;
  } else if (n.type === "location_failed") {
    if (n.title === "Localisation de mission non résolue" && missionName) message = `“${missionName}”: distance-based search stays unavailable until the location is verified.`;
    else if (n.title === "Localisations non résolues") { const count = n.message.match(/^(\d+)/)?.[1]; if (count) message = `${count} staff member(s) could not be located. Check the saved addresses or try again later.`; }
    else if (n.title === "Localisations à vérifier") { const count = n.message.match(/^(\d+)/)?.[1]; if (count) message = `${count} imported staff member(s) could not be located. Retry location resolution from the directory.`; }
    else { const name = n.message.split(":")[0]; message = `${name}: the saved location could not be resolved. This profile will not appear in geographic searches until its location is verified.`; }
  }
  return { title: titleMap[n.type] ?? titleByFrench[n.title] ?? n.title, message };
}

function Item({ n, timeZone }: { n: Notification; timeZone: string }) {
  const router = useRouter();
  const { t, locale } = usePreferences();
  const [pending, start] = React.useTransition();
  const unread = n.read_at === null;
  const display = translatedNotification(n, locale, t);
  const meta = (n.metadata ?? {}) as Meta;
  const isDocAlert = (n.type === "document_expired" || n.type === "document_expiring") && Boolean(meta.document_id);
  const emailed = Boolean(n.email_sent_at);
  const reason = (meta.days_left ?? 0) < 0 ? t("document expiré", "expired document") : t("document bientôt expiré", "document expiring soon");
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(friendlyError(r.error ?? "Opération impossible")); else if (r.message) toast.success(r.message);
      router.refresh();
    });
  return (
    <li className={cn("group flex flex-col gap-4 rounded-[var(--radius-card)] border bg-surface p-4 shadow-card transition-all sm:flex-row sm:items-start sm:justify-between", unread ? "border-primary/25 bg-primary-soft/20" : "border-line hover:shadow-md")}>
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <span className={cn("relative grid h-11 w-11 shrink-0 place-items-center rounded-xl", unread ? "bg-primary-soft text-primary" : "bg-bg text-muted")}><BellRing className="h-5 w-5" aria-hidden />{unread ? <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-surface bg-primary"/> : null}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-ink">{display.title}{unread ? <span className="sr-only"> ({t("non lue", "unread")})</span> : null}</p>{unread ? <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">{t("Nouveau", "New")}</span> : null}</div>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted">{display.message}</p>
          {isDocAlert ? (
            emailed
              ? <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success"><MailCheck className="h-3.5 w-3.5" aria-hidden />{t(`Rappel envoyé le ${formatDateTime(n.email_sent_at!, timeZone)} — motif : ${reason}`, `Reminder sent on ${formatDateTime(n.email_sent_at!, timeZone)} — reason: ${reason}`)}{meta.auto_email ? ` (${t("automatique", "automatic")})` : ""}</p>
              : <p className="mt-2 text-xs text-warning">{t("Aucun rappel envoyé à ce staff pour l’instant.", "No reminder sent to this staff member yet.")}</p>
          ) : null}
          <p className="mt-2 text-xs font-medium text-muted">{formatDateTime(n.created_at, timeZone)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        {isDocAlert && !emailed ? <Button size="sm" pending={pending} onClick={() => run(() => sendDocumentEmail(meta.document_id!, n.id))}><Mail className="h-4 w-4" aria-hidden />{t("Envoyer un rappel", "Send reminder")}</Button> : null}
        {n.link ? <Link href={n.link} onClick={() => { if (unread) void markNotificationRead(n.id); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary-soft">{t("Ouvrir", "Open")} <ChevronRight className="h-4 w-4" aria-hidden /></Link> : null}
        {unread ? <Button size="sm" variant="secondary" pending={pending} onClick={() => run(() => markNotificationRead(n.id))}>{t("Marquer comme lue", "Mark as read")}</Button> : null}
        <Button size="icon" variant="ghost" aria-label={t(`Supprimer la notification « ${n.title} »`, `Delete notification “${n.title}”`)} disabled={pending} onClick={() => run(() => deleteNotification(n.id))}><Trash2 className="h-4 w-4" aria-hidden /></Button>
      </div>
    </li>
  );
}

export function NotificationList({ items, timeZone }: { items: Notification[]; timeZone: string }) {
  return <ul className="stagger space-y-3">{items.map((n) => <Item key={n.id} n={n} timeZone={timeZone} />)}</ul>;
}
