import Link from "next/link";
import { Bell } from "lucide-react";
import { DeleteReadButton, MarkAllReadButton, NotificationList } from "@/components/notifications/notification-list";
import { T } from "@/components/providers/t";
import { Alert, EmptyState, PageHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { SearchInput } from "@/components/ui/search-input";
import { APP_CONFIG } from "@/config/app";
import { requireSession } from "@/lib/auth";
import type { Notification } from "@/lib/types";
import { cn, sanitizeSearchTerm, toQuery } from "@/lib/utils";

export const metadata = { title: "Notifications" };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireSession();
  const raw = Number(one(sp.page));
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;
  const filter = one(sp.filter) === "unread" ? "unread" : "all";
  const q = sanitizeSearchTerm(one(sp.q));
  const pageSize = APP_CONFIG.pagination.defaultPageSize;

  let query = supabase.from("notifications").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (filter === "unread") query = query.is("read_at", null);
  if (q) query = query.or(`title.ilike.%${q}%,message.ilike.%${q}%`);

  const [{ data, count, error }, { count: unread }, { count: read }] = await Promise.all([
    query.range((page - 1) * pageSize, page * pageSize - 1),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase.from("notifications").select("id", { count: "exact", head: true }).not("read_at", "is", null),
  ]);
  const items = (data ?? []) as Notification[];
  const tab = (active: boolean) => cn("inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition", active ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-primary-soft hover:text-ink");

  return (
    <>
      <PageHeader
        title="Notifications"
        description={<T fr="Imports, localisations à revoir, missions à pourvoir, affectations. Aucune notification push." en="Imports, locations to review, assignments to staff, confirmations. No push notifications." />}
        actions={<><MarkAllReadButton disabled={(unread ?? 0) === 0} /><DeleteReadButton disabled={(read ?? 0) === 0} /><RefreshButton /></>}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput className="w-full sm:max-w-xs" />
            <nav aria-label="Filtre" className="inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
              <Link href={`/notifications${toQuery({ q })}`} className={tab(filter === "all")}><T fr="Toutes" en="All" /></Link>
              <Link href={`/notifications${toQuery({ q, filter: "unread" })}`} className={tab(filter === "unread")}><T fr="Non lues" en="Unread" />{(unread ?? 0) > 0 ? <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", filter === "unread" ? "bg-white/25" : "bg-primary text-white")}>{unread}</span> : null}</Link>
            </nav>
          </div>
        }
      />
      <div className="py-5">
        {error ? <Alert tone="danger" title={<T fr="Lecture impossible" en="Unable to load" />}><T fr="Les notifications n’ont pas pu être chargées." en="Notifications could not be loaded." /></Alert> : null}
        {!error && items.length === 0 ? <EmptyState icon={<Bell className="h-8 w-8" aria-hidden />} title={<T fr="Aucune notification" en="No notifications" />} description={q || filter === "unread" ? <T fr="Rien ne correspond à ce filtre." en="Nothing matches this filter." /> : <T fr="Vous serez prévenu ici des imports terminés, des localisations à revoir et de l’avancement de vos missions." en="You will be told here about finished imports, locations to review and assignment progress." />} /> : null}
        {items.length > 0 ? (
          <>
            <NotificationList items={items} timeZone={profile.timezone} />
            <Pagination page={page} pageSize={pageSize} total={count ?? 0} basePath="/notifications" params={{ q, filter: filter === "unread" ? "unread" : "" }} />
          </>
        ) : null}
      </div>
    </>
  );
}
