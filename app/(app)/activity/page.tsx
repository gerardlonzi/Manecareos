import Link from "next/link";
import { Activity, BriefcaseBusiness, Download, MapPin, Upload, UserCheck, Users } from "lucide-react";
import { Alert, EmptyState, PageHeader } from "@/components/ui/card";
import { ActivityFilters } from "@/components/activity/activity-filters";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { APP_CONFIG } from "@/config/app";
import { EVENT_LABELS, EVENT_LABELS_EN } from "@/lib/activity";
import { getLocale } from "@/lib/i18n-server";
import { describeActivity } from "@/lib/messages";
import { T } from "@/components/providers/t";
import { requireSession } from "@/lib/auth";
import type { ActivityLog } from "@/lib/types";
import { sanitizeSearchTerm, toQuery } from "@/lib/utils";
import { uuidSchema } from "@/lib/validation";

export const metadata = { title: "Activité" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireSession();
  const tz = profile.timezone;

  const type = Object.hasOwn(EVENT_LABELS, one(sp.type)) ? one(sp.type) : "";
  const from = isDay(one(sp.from)) ? one(sp.from) : "";
  const to = isDay(one(sp.to)) ? one(sp.to) : "";
  const missionId = uuidSchema.safeParse(one(sp.mission)).success ? one(sp.mission) : "";
  const staffQ = sanitizeSearchTerm(one(sp.staff));
  const pageNum = Number(one(sp.page));
  const page = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;
  const pageSize = APP_CONFIG.pagination.defaultPageSize;

  // Filtre staff par nom : on résout d’abord les identifiants (sous RLS), puis on filtre le journal.
  let staffIds: string[] | null = null;
  if (staffQ) {
    const { data } = await supabase.from("staff").select("id").ilike("full_name", `%${staffQ}%`).limit(50);
    staffIds = ((data ?? []) as { id: string }[]).map((s) => s.id);
  }

  let q = supabase.from("activity_logs").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (type) q = q.eq("event_type", type);
  if (from) q = q.gte("created_at", `${from}T00:00:00Z`);
  if (to) q = q.lte("created_at", `${to}T23:59:59Z`);
  if (missionId) q = q.eq("mission_id", missionId);
  if (staffIds) q = staffIds.length > 0 ? q.in("staff_id", staffIds) : q.in("staff_id", ["00000000-0000-0000-0000-000000000000"]);

  const [{ data, count, error }, { data: missions }] = await Promise.all([
    q.range((page - 1) * pageSize, page * pageSize - 1),
    supabase.from("missions").select("id, title").order("created_at", { ascending: false }).limit(100),
  ]);

  const rows = (data ?? []) as ActivityLog[];
  const hasFilters = Boolean(type || from || to || missionId || staffQ);
  const hrefFor = (p: number) => `/activity${toQuery({ type, from, to, mission: missionId, staff: staffQ, page: p <= 1 ? "" : p })}`;

  const loc = (await getLocale());
  const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, dateStyle: "short" }).format(new Date(iso));
  const dayLabel = (iso: string) => new Intl.DateTimeFormat(loc === "fr" ? "fr-FR" : "en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
  const timeOf = (iso: string) => new Intl.DateTimeFormat(loc === "fr" ? "fr-FR" : "en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const groups: { key: string; label: string; items: ActivityLog[] }[] = [];
  for (const l of rows) {
    const k = dayKey(l.created_at);
    const g = groups[groups.length - 1];
    if (g && g.key === k) g.items.push(l); else groups.push({ key: k, label: dayLabel(l.created_at), items: [l] });
  }

  return (
    <>
      <PageHeader
        title={<T fr="Activité" en="Activity" />}
        description={<T fr="Journal en ajout seul : les événements ne peuvent être ni modifiés ni supprimés." en="Append-only log: events cannot be edited or deleted." />}
        actions={<RefreshButton />}
        toolbar={<ActivityFilters type={type} from={from} to={to} missionId={missionId} staffQ={staffQ} missions={((missions ?? []) as { id: string; title: string }[])} />}
      />
      <div className="py-5">
        {error ? <Alert tone="danger" title={<T fr="Lecture impossible" en="Unable to load activity" />}><T fr="Le journal n’a pas pu être chargé." en="The activity log could not be loaded." /></Alert> : null}
        {!error && rows.length === 0 ? (
          <EmptyState icon={<Activity className="h-8 w-8" aria-hidden />} title={hasFilters ? <T fr="Aucun événement" en="No events" /> : <T fr="Aucune activité pour l’instant" en="No activity yet" />} description={hasFilters ? <T fr="Aucun événement ne correspond à ces filtres." en="No events match these filters." /> : <T fr="Les actions importantes apparaîtront ici." en="Important actions will appear here." />} />
        ) : null}
        {rows.length > 0 ? (
          <>
            <div className="space-y-6">
              {groups.map((g) => (
                <section key={g.key} aria-label={g.label}>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted first-letter:uppercase">{g.label}</h2>
                  <ol className="stagger divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
                    {g.items.map((l) => {
                      const Icon = iconFor(l.event_type);
                      return (
                        <li key={l.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="h-4 w-4" aria-hidden /></span>
                          <div className="min-w-0 flex-1">
                            <p className="leading-snug">{describeActivity(l, loc)}</p>
                            <p className="mt-0.5 text-xs text-muted"><T fr={EVENT_LABELS[l.event_type] ?? l.event_type} en={EVENT_LABELS_EN[l.event_type] ?? l.event_type} /> · {timeOf(l.created_at)}</p>
                          </div>
                          <div className="flex shrink-0 flex-wrap justify-end gap-1.5 text-xs">
                            {l.staff_id ? <Link className="rounded-md bg-surface-2 px-2 py-1 font-medium text-primary hover:bg-primary-soft" href={`/staff/${l.staff_id}`}><T fr="Voir le staff" en="View staff" /></Link> : null}
                            {l.mission_id ? <Link className="rounded-md bg-surface-2 px-2 py-1 font-medium text-primary hover:bg-primary-soft" href={`/missions/${l.mission_id}`}><T fr="Voir la mission" en="View assignment" /></Link> : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
            <Pagination page={page} pageSize={pageSize} total={count ?? 0} basePath="/activity" params={{ type, from, to, mission: missionId, staff: staffQ }} />
          </>
        ) : null}
      </div>
    </>
  );
}

function iconFor(type: string) {
  if (type.startsWith("staff")) return Users;
  if (type.startsWith("mission") || type.startsWith("assignment")) return BriefcaseBusiness;
  if (type.startsWith("import")) return Upload;
  if (type.startsWith("export")) return Download;
  if (type.startsWith("location")) return MapPin;
  if (type.startsWith("availability")) return UserCheck;
  return Activity;
}
