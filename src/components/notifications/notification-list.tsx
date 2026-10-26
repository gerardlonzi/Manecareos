"use client";
import { friendlyError } from "@/lib/user-message";
import { usePreferences } from "@/components/providers/preferences-provider";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, CheckCheck, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
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

function translatedNotification(n: Notification, locale: "fr" | "en", t: (fr: string, en: string) => string) {
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
          <p className="mt-2 text-xs font-medium text-muted">{formatDateTime(n.created_at, timeZone)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
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
