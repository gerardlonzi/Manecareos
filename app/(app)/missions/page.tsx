import Link from "next/link";
import { Briefcase, Plus, Search, X } from "lucide-react";
import { CancelMissionButton, ExportMissionsButton } from "@/components/missions/mission-actions";
import { missionLocation } from "@/components/missions/mission-card";
import { MissionStatusBadge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { APP_CONFIG, MISSION_STATUS_LABELS } from "@/config/app";
import { COUNTRY_LIST } from "@/config/countries";
import { requireSession } from "@/lib/auth";
import { applyMissionFilters, missionFiltersToParams, parseMissionFilters } from "@/lib/missions-query";
import type { MissionOverview } from "@/lib/types";
import { formatDateTime, formatDate, toQuery } from "@/lib/utils";

export const metadata = { title: "Missions" };

export default async function MissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, profile } = await requireSession();
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
        description="Créez une mission, vérifiez son lieu, puis cherchez le staff disponible le plus proche."
        actions={<><LinkButton href="/missions/new"><Plus className="h-4 w-4" aria-hidden /> Nouvelle mission</LinkButton><ExportMissionsButton /><RefreshButton /></>}
      />

      <form method="get" role="search" aria-label="Filtres des missions" className="mb-4 space-y-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input name="q" defaultValue={f.q} aria-label="Titre ou référence" placeholder="Titre ou référence" />
          <Input name="postal" defaultValue={f.postal} aria-label="Code postal" placeholder="Code postal" />
          <Input name="city" defaultValue={f.city} aria-label="Ville" placeholder="Ville" />
          <Select name="country" defaultValue={f.country} aria-label="Pays">
            <option value="">Tous les pays</option>
            {COUNTRY_LIST.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
          <Select name="status" defaultValue={f.status} aria-label="Statut">
            <option value="all">Tous les statuts</option>
            <option value="active">Actives (ouverte, en cours, pourvue)</option>
            <option value="needs_staff">À pourvoir</option>
            {(Object.keys(MISSION_STATUS_LABELS) as (keyof typeof MISSION_STATUS_LABELS)[]).map((s) => <option key={s} value={s}>{MISSION_STATUS_LABELS[s]}</option>)}
          </Select>
          <Select name="staffing" defaultValue={f.staffing} aria-label="Avancement du recrutement">
            <option value="all">Tout avancement</option>
            <option value="missing">Effectif incomplet</option>
            <option value="complete">Effectif sélectionné atteint</option>
          </Select>
          <Input name="from" type="date" defaultValue={f.from} aria-label="Début à partir du" />
          <Input name="to" type="date" defaultValue={f.to} aria-label="Début jusqu’au" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Select name="pageSize" defaultValue={String(f.pageSize)} aria-label="Lignes par page" className="w-40">
            {APP_CONFIG.pagination.pageSizes.map((n) => <option key={n} value={n}>{n} par page</option>)}
          </Select>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" size="sm"><Search className="h-4 w-4" aria-hidden /> Rechercher</Button>
            <LinkButton href="/missions" variant="ghost" size="sm"><X className="h-4 w-4" aria-hidden /> Effacer les filtres</LinkButton>
          </div>
        </div>
      </form>

      {error ? <Alert tone="danger" title="Lecture impossible">La liste n’a pas pu être chargée. Vérifiez la configuration Supabase et les migrations.</Alert> : null}

      {!error && rows.length === 0 ? (
        hasFilters ? (
          <EmptyState icon={<Briefcase className="h-8 w-8" aria-hidden />} title="Aucune mission trouvée" description="Aucune mission ne correspond à ces filtres." actions={<LinkButton href="/missions" variant="secondary">Effacer les filtres</LinkButton>} />
        ) : (
          <EmptyState icon={<Briefcase className="h-8 w-8" aria-hidden />} title="Aucune mission pour l’instant" description="Créez votre première mission pour trouver du staff près de son lieu." actions={<LinkButton href="/missions/new">Créer une mission</LinkButton>} />
        )
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <thead className="border-b border-line bg-bg text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">Réf.</th><th scope="col" className="px-4 py-3">Titre</th><th scope="col" className="px-4 py-3">Lieu</th>
                  <th scope="col" className="px-4 py-3">Début</th><th scope="col" className="px-4 py-3">Requis</th><th scope="col" className="px-4 py-3">Sélectionnés</th>
                  <th scope="col" className="px-4 py-3">Statut</th><th scope="col" className="px-4 py-3">Mise à jour</th><th scope="col" className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((m) => {
                  const closed = m.status === "cancelled" || m.status === "completed";
                  return (
                    <tr key={m.id} className="align-top hover:bg-bg/60">
                      <td className="px-4 py-3 text-muted">{m.mission_reference ?? "—"}</td>
                      <td className="px-4 py-3 font-medium"><Link href={`/missions/${m.id}`} className="hover:text-primary hover:underline">{m.title}</Link></td>
                      <td className="px-4 py-3">{missionLocation(m)}{m.location_status !== "resolved" ? <span className="block text-xs text-warning">Lieu à vérifier</span> : null}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{m.scheduled_start_at ? formatDateTime(m.scheduled_start_at, tz) : "—"}</td>
                      <td className="px-4 py-3">{m.required_staff_count}</td>
                      <td className="px-4 py-3">{m.selected_count} <span className="text-xs text-muted">({m.confirmed_count} confirmé{m.confirmed_count > 1 ? "s" : ""})</span></td>
                      <td className="px-4 py-3"><MissionStatusBadge status={m.status} /></td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDate(m.updated_at, tz)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <LinkButton href={`/missions/${m.id}`} variant="secondary" size="sm">Voir</LinkButton>
                          {!closed ? <LinkButton href={`/missions/${m.id}/edit`} variant="secondary" size="sm">Modifier</LinkButton> : null}
                          {!closed ? <LinkButton href={`/missions/${m.id}/staff`} size="sm">Trouver du staff</LinkButton> : null}
                          <LinkButton href={`/missions/${m.id}#staff`} variant="ghost" size="sm">Staff sélectionné</LinkButton>
                          {m.status !== "cancelled" ? <CancelMissionButton id={m.id} title={m.title} size="sm" /> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={f.page} pageSize={f.pageSize} total={total} hrefFor={(p) => `/missions${toQuery(missionFiltersToParams(f, { page: p <= 1 ? "" : p }))}`} />
        </>
      ) : null}
    </>
  );
}
