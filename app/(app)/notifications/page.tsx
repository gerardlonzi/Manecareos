import { Bell } from "lucide-react";
import { MarkAllReadButton, NotificationList } from "@/components/notifications/notification-list";
import { Alert, EmptyState, PageHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { APP_CONFIG } from "@/config/app";
import { requireSession } from "@/lib/auth";
import type { Notification } from "@/lib/types";
import { toQuery } from "@/lib/utils";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireSession();
  const raw = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;
  const pageSize = APP_CONFIG.pagination.defaultPageSize;

  const [{ data, count, error }, { count: unread }] = await Promise.all([
    supabase.from("notifications").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  const items = (data ?? []) as Notification[];

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Notifications dans l’application (imports, localisations en échec, missions à pourvoir, affectations). Aucune notification push."
        actions={<><MarkAllReadButton disabled={(unread ?? 0) === 0} /><RefreshButton /></>}
      />
      {error ? <Alert tone="danger" title="Lecture impossible">Les notifications n’ont pas pu être chargées.</Alert> : null}
      {!error && items.length === 0 ? <EmptyState icon={<Bell className="h-8 w-8" aria-hidden />} title="Aucune notification" description="Vous serez prévenu ici des imports terminés, des localisations à revoir et de l’avancement de vos missions." /> : null}
      {items.length > 0 ? (
        <>
          <NotificationList items={items} timeZone={profile.timezone} />
          <Pagination page={page} pageSize={pageSize} total={count ?? 0} hrefFor={(p) => `/notifications${toQuery({ page: p <= 1 ? "" : p })}`} />
        </>
      ) : null}
    </>
  );
}
