import Link from "next/link";
import { Activity, X } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { APP_CONFIG } from "@/config/app";
import { EVENT_LABELS } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import type { ActivityLog } from "@/lib/types";
import { formatDateTime, sanitizeSearchTerm, toQuery } from "@/lib/utils";
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

  return (
    <>
      <PageHeader title="Activité" description="Journal en ajout seul : les événements ne peuvent être ni modifiés ni supprimés depuis l’application." actions={<RefreshButton />} />

      <form method="get" role="search" aria-label="Filtres d’activité" className="mb-4 space-y-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select name="type" defaultValue={type} aria-label="Type d’événement">
            <option value="">Tous les événements</option>
            {Object.entries(EVENT_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
          <Input name="from" type="date" defaultValue={from} aria-label="Du" />
          <Input name="to" type="date" defaultValue={to} aria-label="Au" />
          <Select name="mission" defaultValue={missionId} aria-label="Mission">
            <option value="">Toutes les missions</option>
            {((missions ?? []) as { id: string; title: string }[]).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </Select>
          <Input name="staff" defaultValue={staffQ} aria-label="Nom du staff" placeholder="Nom du staff" />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="submit" variant="secondary" size="sm">Filtrer</Button>
          <LinkButton href="/activity" variant="ghost" size="sm"><X className="h-4 w-4" aria-hidden /> Effacer les filtres</LinkButton>
        </div>
      </form>

      {error ? <Alert tone="danger" title="Lecture impossible">Le journal n’a pas pu être chargé.</Alert> : null}
      {!error && rows.length === 0 ? (
        <EmptyState icon={<Activity className="h-8 w-8" aria-hidden />} title={hasFilters ? "Aucun événement" : "Aucune activité pour l’instant"} description={hasFilters ? "Aucun événement ne correspond à ces filtres." : "Les actions importantes apparaîtront ici."} />
      ) : null}

      {rows.length > 0 ? (
        <>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-card">
            {rows.map((l) => (
              <li key={l.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p>{l.description}</p>
                  <p className="text-xs text-muted">{EVENT_LABELS[l.event_type] ?? l.event_type} · {formatDateTime(l.created_at, tz)}</p>
                </div>
                <div className="flex gap-3 text-xs">
                  {l.staff_id ? <Link className="text-primary hover:underline" href={`/staff/${l.staff_id}`}>Voir le staff</Link> : null}
                  {l.mission_id ? <Link className="text-primary hover:underline" href={`/missions/${l.mission_id}`}>Voir la mission</Link> : null}
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={pageSize} total={count ?? 0} hrefFor={hrefFor} />
        </>
      ) : null}
    </>
  );
}
