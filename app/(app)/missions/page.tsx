import Link from "next/link";
import { Briefcase, Plus } from "lucide-react";
import { CancelMissionButton, ExportMissionsButton } from "@/components/missions/mission-actions";
import { MissionsToolbar } from "@/components/missions/missions-toolbar";
import { T } from "@/components/providers/t";
import { missionLocation } from "@/components/missions/mission-card";
import { MissionStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { applyMissionFilters, missionFiltersToParams, parseMissionFilters } from "@/lib/missions-query";
import type { MissionOverview } from "@/lib/types";
import { formatDateTime, toQuery } from "@/lib/utils";

export const metadata = { title: "Missions" };

const th = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted whitespace-nowrap";

export default async function MissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ supabase, profile }, { t }] = await Promise.all([requireSession(), getT()]);
  const f = parseMissionFilters(await searchParams);
  const from = (f.page - 1) * f.pageSize;
  const { data, count, error } = await applyMissionFilters(
    supabase.from("mission_overview").select("*", { count: "exact" }).order("created_at", { ascending: false }), f,
  ).range(from, from + f.pageSize - 1);
  const rows = (data ?? []) as MissionOverview[];
  const total = count ?? 0;
  const tz = profile.timezone;
  const hasFilters = Boolean(f.q || f.postal || f.city || f.country || f.status !== "all" || f.from || f.to || f.staffing !== "all");

  return (
    <>
      <PageHeader
        title="Missions"
        description={<T fr="Créez une mission, vérifiez son lieu, puis cherchez le staff disponible le plus proche." en="Create an assignment, verify its location, then find the nearest available staff." />}
        actions={<><LinkButton href="/missions/new"><Plus className="h-4 w-4" aria-hidden /> <T fr="Nouvelle mission" en="New assignment" /></LinkButton><ExportMissionsButton disabled={total === 0} /><RefreshButton /></>}
        toolbar={<MissionsToolbar filters={f} />}
      />
      {error ? <Alert tone="danger" title={<T fr="Lecture impossible" en="Unable to load" />}><T fr="La liste n’a pas pu être chargée. Réessayez dans un instant." en="The list could not be loaded. Please try again shortly." /></Alert> : null}
      {!error && rows.length === 0 ? (
        hasFilters ? (
          <EmptyState icon={<Briefcase className="h-8 w-8" aria-hidden />} title={<T fr="Aucune mission trouvée" en="No assignments found" />} description={<T fr="Aucune mission ne correspond à ces filtres." en="No assignments match these filters." />} actions={<LinkButton href="/missions" variant="secondary"><T fr="Effacer les filtres" en="Clear filters" /></LinkButton>} />
        ) : (
          <EmptyState icon={<Briefcase className="h-8 w-8" aria-hidden />} title={<T fr="Aucune mission pour l’instant" en="No assignments yet" />} description={<T fr="Créez votre première mission pour trouver du staff près de son lieu." en="Create your first assignment to find nearby staff." />} actions={<LinkButton href="/missions/new"><T fr="Nouvelle mission" en="New assignment" /></LinkButton>} />
        )
      ) : null}
      {rows.length > 0 ? (
        <>
          <div className="overflow-x-auto md:overflow-visible">
            <table className="data-table w-full min-w-[56rem] border-separate border-spacing-0 rounded-xl border border-line bg-surface text-sm shadow-[var(--shadow-card)]">
              <thead><tr>
                <th className={th}>{t("Mission", "Assignment")}</th><th className={th}>{t("Lieu", "Location")}</th><th className={th}>{t("Début", "Start")}</th>
                <th className={th}>{t("Effectif", "Staffing")}</th><th className={th}>{t("Statut", "Status")}</th><th className={`${th} text-right`}>{t("Actions", "Actions")}</th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((m) => {
                  const closed = m.status === "cancelled" || m.status === "completed";
                  const pct = Math.min(100, Math.round((m.selected_count / Math.max(1, m.required_staff_count)) * 100));
                  return (
                    <tr key={m.id} className="border-t border-line">
                      <td className="px-3 py-2.5"><Link href={`/missions/${m.id}`} className="block max-w-[18rem] truncate font-medium hover:text-primary">{m.title}</Link><span className="font-mono text-[11px] text-muted">{m.mission_reference ?? "—"}</span></td>
                      <td className="px-3 py-2.5"><span className="block max-w-[14rem] truncate">{missionLocation(m)}</span>{m.location_status !== "resolved" ? <span className="text-xs text-warning">{t("Lieu à vérifier", "Location to verify")}</span> : null}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{m.scheduled_start_at ? formatDateTime(m.scheduled_start_at, tz) : "—"}</td>
                      <td className="px-3 py-2.5"><div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-line"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div><span className="whitespace-nowrap text-xs tabular-nums text-muted">{m.selected_count}/{m.required_staff_count} · {m.confirmed_count} {t("conf.", "conf.")}</span></div></td>
                      <td className="px-3 py-2.5"><MissionStatusBadge status={m.status} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          {!closed ? <LinkButton href={`/missions/${m.id}/staff`} size="sm"><T fr="Trouver du staff" en="Find staff" /></LinkButton> : null}
                          <LinkButton href={`/missions/${m.id}`} variant="secondary" size="sm"><T fr="Voir" en="View" /></LinkButton>
                          {!closed ? <LinkButton href={`/missions/${m.id}/edit`} variant="ghost" size="sm"><T fr="Modifier" en="Edit" /></LinkButton> : null}
                          {m.status !== "cancelled" ? <CancelMissionButton id={m.id} title={m.title} size="sm" /> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={f.page} pageSize={f.pageSize} total={total} basePath="/missions" params={missionFiltersToParams(f, { page: "" })} />
        </>
      ) : null}
    </>
  );
}
