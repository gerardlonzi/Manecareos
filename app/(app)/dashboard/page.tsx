
import Link from "next/link";
import {
  ShieldAlert,
  Activity,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  Clock3,
  MapPin,
  Plus,
  Users,
  UserCheck,
  UserRoundSearch,
} from "lucide-react";

import { T } from "@/components/providers/t";
import { LinkButton } from "@/components/ui/button";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui/card";
import { RefreshButton } from "@/components/ui/refresh-button";
import { getLocale } from "@/lib/i18n-server";
import { describeActivity } from "@/lib/messages";
import { MissionStatusBadge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth";
import { complianceFor } from "@/lib/compliance";
import type { ActivityLog, Mission } from "@/lib/types";

export const metadata = { title: "Vue d’ensemble" };

type Stats = {
  total_staff: number;
  available_staff: number;
  unavailable_staff: number;
  verified_locations: number;
  unresolved_locations: number;
  active_missions: number;
  missions_needing_staff: number;
};

export default async function DashboardPage() {
  const { supabase, profile } = await requireSession();

  const [statsResult, logsResult, missionsResult] = await Promise.all([
    supabase.rpc("dashboard_stats"),
    supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("missions")
      .select(
        "id,title,city,postal_code,status,scheduled_start_at,required_staff_count,mission_reference",
      )
      .is("archived_at", null)
      .in("status", ["open", "staffing_in_progress"])
      .order("scheduled_start_at", {
        ascending: true,
        nullsFirst: false,
      })
      .limit(4),
  ]);

  if (statsResult.error || !statsResult.data) {
    return (
      <>
        <PageHeader
          title={<T fr="Vue d’ensemble" en="Overview" />}
        />

        <Alert
          tone="danger"
          title={
            <T
              fr="Impossible de charger le tableau de bord"
              en="Unable to load the dashboard"
            />
          }
        >
          <p>
            <T
              fr="Les données ne sont pas disponibles pour le moment. Réessayez dans quelques instants."
              en="The data is unavailable right now. Please try again shortly."
            />
          </p>

          <div className="mt-3">
            <RefreshButton label="Réessayer / Try again" />
          </div>
        </Alert>
      </>
    );
  }

  const s = statsResult.data as Stats;
  const loc = await getLocale();
  const logs = (logsResult.data ?? []) as ActivityLog[];
  const missions = (missionsResult.data ?? []) as Pick<Mission, "id" | "title" | "city" | "postal_code" | "status" | "scheduled_start_at" | "required_staff_count" | "mission_reference">[];
  const when = (iso: string | null) => iso ? new Intl.DateTimeFormat(loc === "fr" ? "fr-FR" : "en-GB", { timeZone: profile.timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—";
  const greeting = profile.full_name?.split(" ")[0] ?? "";

  // Conformité : dossiers incomplets / documents qui expirent bientôt (staff actifs).
  const { data: activeStaff } = await supabase.from("staff").select("id").is("archived_at", null).limit(1000);
  const comp = await complianceFor(supabase, ((activeStaff ?? []) as { id: string }[]).map((x) => x.id));
  const incomplete = [...comp.byStaff.values()].filter((c) => !c.complete).length;
  const expiringSoon = [...comp.byStaff.values()].filter((c) => c.level === "expiring").length;

  const kpis = [
    { key: "staff", href: "/staff", icon: Users, fr: "Staff actif", en: "Active staff", value: s.total_staff, tone: "primary" },
    { key: "avail", href: "/staff?availability=available", icon: UserCheck, fr: "Disponibles", en: "Available", value: s.available_staff, tone: "success" },
    { key: "missions", href: "/missions", icon: BriefcaseBusiness, fr: "Missions en cours", en: "Active assignments", value: s.active_missions, tone: "primary" },
    { key: "need", href: "/missions?status=open", icon: CalendarClock, fr: "À pourvoir", en: "Need staff", value: s.missions_needing_staff, tone: s.missions_needing_staff > 0 ? "warning" : "success" },
    { key: "loc", href: "/staff?location=resolved", icon: MapPin, fr: "Localisations vérifiées", en: "Verified locations", value: s.verified_locations, tone: "success" },
    { key: "docs", href: "/staff", icon: ShieldAlert, fr: "Dossiers incomplets", en: "Incomplete files", value: incomplete, tone: incomplete > 0 ? "danger" : "success" },
    { key: "expiring", href: "/staff", icon: CalendarClock, fr: "Documents bientôt expirés", en: "Documents expiring soon", value: expiringSoon, tone: expiringSoon > 0 ? "warning" : "success" },
    { key: "review", href: "/staff?location=failed", icon: Clock3, fr: "À revoir", en: "To review", value: s.unresolved_locations, tone: s.unresolved_locations > 0 ? "danger" : "muted" },
  ] as const;
  const tone = { primary: "bg-primary-soft text-primary", success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger", muted: "bg-muted/10 text-muted" };

  return (
    <>
      <PageHeader
        title={<T fr={`Bonjour${greeting ? `, ${greeting}` : ""}`} en={`Hello${greeting ? `, ${greeting}` : ""}`} />}
        description={<T fr="Voici où en est votre activité aujourd’hui." en="Here is where your activity stands today." />}
        actions={<><RefreshButton /><LinkButton href="/find-staff" variant="secondary"><UserRoundSearch className="h-4 w-4" aria-hidden /><T fr="Trouver du staff" en="Find staff" /></LinkButton><LinkButton href="/missions/new"><Plus className="h-4 w-4" aria-hidden /><T fr="Nouvelle mission" en="New assignment" /></LinkButton></>}
      />
      <div className="space-y-6 py-5">
        <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {kpis.map((k) => (
            <Link key={k.key} href={k.href} className="card-surface lift group block p-4">
              <span className={`grid h-9 w-9 place-items-center rounded-lg ${tone[k.tone]}`}><k.icon className="h-[18px] w-[18px]" aria-hidden /></span>
              <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{k.value}</p>
              <p className="mt-0.5 flex items-center justify-between text-xs text-muted"><span><T fr={k.fr} en={k.en} /></span><ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" aria-hidden /></p>
            </Link>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
          <Card>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold"><T fr="Missions à pourvoir" en="Assignments to staff" /></h2>
              <Link href="/missions" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><T fr="Tout voir" en="View all" /><ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
            </div>
            {missions.length === 0 ? (
              <EmptyState icon={<BriefcaseBusiness className="h-7 w-7" aria-hidden />} title={<T fr="Aucune mission à pourvoir" en="Nothing to staff right now" />} description={<T fr="Créez une mission pour trouver du personnel près de l’établissement." en="Create an assignment to find staff near the care home." />} actions={<LinkButton href="/missions/new"><Plus className="h-4 w-4" aria-hidden /><T fr="Nouvelle mission" en="New assignment" /></LinkButton>} />
            ) : (
              <ul className="divide-y divide-line">
                {missions.map((m) => (
                  <li key={m.id}>
                    <Link href={`/missions/${m.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-primary-soft/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{m.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">{[m.city, m.postal_code].filter(Boolean).join(" · ")} · {when(m.scheduled_start_at)}</p>
                      </div>
                      <span className="hidden shrink-0 text-xs text-muted sm:block">{m.required_staff_count} <T fr="requis" en="needed" /></span>
                      <MissionStatusBadge status={m.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold"><T fr="Activité récente" en="Recent activity" /></h2>
              <Link href="/activity" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><T fr="Tout voir" en="View all" /><ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
            </div>
            {logs.length === 0 ? (
              <EmptyState icon={<Activity className="h-7 w-7" aria-hidden />} title={<T fr="Aucune activité" en="No activity yet" />} description={<T fr="Les actions importantes apparaîtront ici." en="Important actions will appear here." />} />
            ) : (
              <ul className="divide-y divide-line">
                {logs.map((l) => (
                  <li key={l.id} className="px-5 py-3 text-sm">
                    <p className="leading-snug">{describeActivity(l, loc)}</p>
                    <p className="mt-0.5 text-xs text-muted">{when(l.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
