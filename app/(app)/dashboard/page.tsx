import Link from "next/link";
import { Briefcase, MapPinOff, Plus, Search, Upload, Users } from "lucide-react";
import { MissionCard } from "@/components/missions/mission-card";
import { LinkButton } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { RefreshButton } from "@/components/ui/refresh-button";
import { EVENT_LABELS } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import type { ActivityLog, MissionOverview } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Tableau de bord" };

type Stats = {
  total_staff: number; available_staff: number; unavailable_staff: number; verified_locations: number;
  unresolved_locations: number; active_missions: number; missions_needing_staff: number;
};

const SELECT = "*";

export default async function DashboardPage() {
  const { supabase, profile } = await requireSession();
  const tz = profile.timezone;
  const nowIso = new Date().toISOString();

  const [stats, upcoming, awaiting, staffing, completed, logs, missionCount] = await Promise.all([
    supabase.rpc("dashboard_stats"),
    supabase.from("mission_overview").select(SELECT).is("archived_at", null).in("status", ["open", "staffing_in_progress", "staffed"]).gte("scheduled_start_at", nowIso).order("scheduled_start_at", { ascending: true }).limit(4),
    supabase.from("mission_overview").select(SELECT).is("archived_at", null).eq("status", "open").order("created_at", { ascending: false }).limit(4),
    supabase.from("mission_overview").select(SELECT).is("archived_at", null).eq("status", "staffing_in_progress").order("updated_at", { ascending: false }).limit(4),
    supabase.from("mission_overview").select(SELECT).is("archived_at", null).eq("status", "completed").order("updated_at", { ascending: false }).limit(4),
    supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(8),
    supabase.from("missions").select("id", { count: "exact", head: true }).is("archived_at", null),
  ]);

  if (stats.error || !stats.data) {
    return (
      <>
        <PageHeader title="Tableau de bord" />
        <Alert tone="danger" title="Impossible de charger les indicateurs">
          <p>Vérifiez la configuration Supabase et que les migrations SQL ont été appliquées.</p>
          <div className="mt-3"><RefreshButton label="Réessayer" /></div>
        </Alert>
      </>
    );
  }

  const s = stats.data as Stats;
  const kpis = [
    { label: "Staff total", value: s.total_staff, href: "/staff" },
    { label: "Staff disponible", value: s.available_staff, href: "/staff?availability=available" },
    { label: "Staff indisponible", value: s.unavailable_staff, href: "/staff?availability=unavailable" },
    { label: "Localisations vérifiées", value: s.verified_locations, href: "/staff?location=resolved" },
    { label: "Missions actives", value: s.active_missions, href: "/missions?status=active" },
    { label: "Missions à pourvoir", value: s.missions_needing_staff, href: "/missions?status=needs_staff" },
  ];

  const empty = s.total_staff === 0 && (missionCount.count ?? 0) === 0;
  const sections: { title: string; rows: MissionOverview[]; empty: string }[] = [
    { title: "Missions à venir", rows: (upcoming.data ?? []) as MissionOverview[], empty: "Aucune mission planifiée à venir." },
    { title: "En attente de staff", rows: (awaiting.data ?? []) as MissionOverview[], empty: "Aucune mission ouverte sans sélection." },
    { title: "Recrutement en cours", rows: (staffing.data ?? []) as MissionOverview[], empty: "Aucune mission en cours de recrutement." },
    { title: "Terminées", rows: (completed.data ?? []) as MissionOverview[], empty: "Aucune mission terminée." },
  ];

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description="Chiffres issus de vos données enregistrées. Les localisations sont celles des fiches, pas des positions en direct."
        actions={
          <>
            <LinkButton href="/staff/new"><Plus className="h-4 w-4" aria-hidden /> Ajouter un staff</LinkButton>
            <LinkButton href="/staff/import" variant="secondary"><Upload className="h-4 w-4" aria-hidden /> Importer du staff</LinkButton>
            <LinkButton href="/missions/new" variant="secondary"><Briefcase className="h-4 w-4" aria-hidden /> Nouvelle mission</LinkButton>
            <LinkButton href="/find-staff" variant="secondary"><Search className="h-4 w-4" aria-hidden /> Trouver du staff</LinkButton>
          </>
        }
      />

      {empty ? (
        <EmptyState
          icon={<Users className="h-8 w-8" aria-hidden />} title="Bienvenue sur StaffFlow"
          description="Commencez par ajouter ou importer votre staff, puis créez une mission pour trouver les personnes disponibles les plus proches."
          actions={<><LinkButton href="/staff/new">Ajouter un staff</LinkButton><LinkButton href="/missions/new" variant="secondary">Nouvelle mission</LinkButton></>}
        />
      ) : (
        <div className="space-y-6">
          <section aria-label="Indicateurs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map((k) => (
              <Link key={k.label} href={k.href} className="rounded-xl border border-line bg-surface p-5 shadow-card transition-colors hover:border-primary">
                <p className="text-sm text-muted">{k.label}</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight">{k.value}</p>
              </Link>
            ))}
          </section>

          {s.unresolved_locations > 0 ? (
            <Alert tone="warning" title={`${s.unresolved_locations} staff sans localisation vérifiée`}>
              <p className="flex items-start gap-2"><MapPinOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Ils n’apparaissent pas dans les recherches par distance. <Link className="underline" href="/staff?location=pending">Voir et résoudre</Link></p>
            </Alert>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            {sections.map((sec) => (
              <Card key={sec.title}>
                <CardHeader title={sec.title} actions={<LinkButton href="/missions" variant="ghost" size="sm">Toutes les missions</LinkButton>} />
                <CardBody className="space-y-3">
                  {sec.rows.length === 0 ? <p className="text-sm text-muted">{sec.empty}</p> : sec.rows.map((m) => <MissionCard key={m.id} m={m} timeZone={tz} />)}
                </CardBody>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader title="Activité récente" actions={<div className="flex gap-2"><RefreshButton variant="ghost" /><LinkButton href="/activity" variant="secondary" size="sm">Voir toute l’activité</LinkButton></div>} />
            <CardBody>
              {(logs.data ?? []).length === 0 ? <p className="text-sm text-muted">Aucune activité pour l’instant.</p> : (
                <ul className="divide-y divide-line">
                  {((logs.data ?? []) as ActivityLog[]).map((l) => (
                    <li key={l.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
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
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
