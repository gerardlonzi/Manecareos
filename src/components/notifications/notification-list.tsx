"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteNotification, markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import type { Notification } from "@/lib/types";

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button variant="secondary" disabled={disabled} pending={pending} onClick={() => start(async () => {
      const r = await markAllNotificationsRead();
      if (r.ok) toast.success(r.message ?? "Fait"); else toast.error(r.error);
      router.refresh();
    })}>
      {!pending ? <CheckCheck className="h-4 w-4" aria-hidden /> : null} Tout marquer comme lu
    </Button>
  );
}

function Item({ n, timeZone }: { n: Notification; timeZone: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const unread = n.read_at === null;
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Opération impossible"); else if (r.message) toast.success(r.message);
      router.refresh();
    });
  return (
    <li className={cn("flex flex-wrap items-start justify-between gap-3 px-4 py-3", unread && "bg-primary-soft/40")}>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium">
          {unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden /> : null}
          {n.title}{unread ? <span className="sr-only"> (non lue)</span> : null}
        </p>
        <p className="mt-0.5 text-sm text-muted">{n.message}</p>
        <p className="mt-1 text-xs text-muted">{formatDateTime(n.created_at, timeZone)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {n.link ? <Link href={n.link} onClick={() => { if (unread) void markNotificationRead(n.id); }} className="text-sm text-primary hover:underline">Ouvrir</Link> : null}
        {unread ? <Button size="sm" variant="secondary" pending={pending} onClick={() => run(() => markNotificationRead(n.id))}>Marquer comme lue</Button> : null}
        <Button size="icon" variant="ghost" aria-label={`Supprimer la notification « ${n.title} »`} disabled={pending} onClick={() => run(() => deleteNotification(n.id))}><Trash2 className="h-4 w-4" aria-hidden /></Button>
      </div>
    </li>
  );
}

export function NotificationList({ items, timeZone }: { items: Notification[]; timeZone: string }) {
  return <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-card">{items.map((n) => <Item key={n.id} n={n} timeZone={timeZone} />)}</ul>;
}
