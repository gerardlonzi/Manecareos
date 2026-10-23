import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Search } from "lucide-react";
import LocationMap from "@/components/map/location-map-lazy";
import { AssignmentsPanel, type AssignmentRow } from "@/components/missions/assignments-panel";
import { CancelMissionButton, ExportMissionStaffButton, RevalidateLocationButton, StatusSelect } from "@/components/missions/mission-actions";
import { missionLocation } from "@/components/missions/mission-card";
import { Badge, LocationBadge, MissionStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { TRANSPORT_LABELS } from "@/config/app";
import { EVENT_LABELS } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { mapboxPublicToken } from "@/lib/env";
import type { ActivityLog, AssignmentStatus, AvailabilityStatus, MissionOverview } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { uuidSchema } from "@/lib/validation";

export const metadata = { title: "Détail de la mission" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="col-span-2 min-w-0 break-words">{children}</dd>
    </div>
  );
}

export default async function MissionDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!uuidSchema.safeParse(id).success) notFound();
  const { supabase, profile } = await requireSession();
  const tz = profile.timezone;

  const [{ data }, { data: assigns }, { data: logs }] = await Promise.all([
    supabase.from("mission_overview").select("*").eq("id", id).maybeSingle(),
    supabase.from("mission_staff")
      .select("id, assignment_status, staff_id, selected_at, staff:staff_id(id, full_name, phone, availability_status, archived_at)")
      .eq("mission_id", id).order("selected_at", { ascending: true }),
    supabase.from("activity_logs").select("*").eq("mission_id", id).order("created_at", { ascending: false }).limit(15),
  ]);
  const m = data as MissionOverview | null;
  if (!m) notFound();

  type S = { id: string; full_name: string; phone: string | null; availability_status: AvailabilityStatus; archived_at: string | null };
  type A = { id: string; assignment_status: AssignmentStatus; staff_id: string; staff: S | S[] | null };
  const rows: AssignmentRow[] = ((assigns ?? []) as unknown as A[]).flatMap((a) => {
    const s = Array.isArray(a.staff) ? a.staff[0] : a.staff;
    return s ? [{ id: a.id, status: a.assignment_status, staffId: a.staff_id, name: s.full_name, phone: s.phone, availability: s.availability_status, archived: Boolean(s.archived_at) }] : [];
  });

  const closed = m.status === "cancelled" || m.status === "completed";
  const hasCoords = m.location_status === "resolved" && m.latitude !== null && m.longitude !== null;
  const canSearch = hasCoords && !closed;

  return (
    <>
      <Link href="/missions" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour aux missions</Link>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{m.title}<MissionStatusBadge status={m.status} /></span>}
        description={m.mission_reference ? `Référence : ${m.mission_reference}` : undefined}
        actions={
          <>
            {!closed ? <LinkButton href={`/missions/${m.id}/staff`}><Search className="h-4 w-4" aria-hidden /> Trouver du staff</LinkButton> : null}
            {m.status !== "cancelled" ? <LinkButton href={`/missions/${m.id}/edit`} variant="secondary"><Pencil className="h-4 w-4" aria-hidden /> Modifier</LinkButton> : null}
          </>
        }
      />

      {sp.created ? (
        <Alert tone="success" title="Mission enregistrée" className="mb-4">
          <p>{canSearch ? "Le lieu est vérifié : vous pouvez chercher du staff dès maintenant." : "Le lieu n’est pas encore vérifié : la recherche par distance sera disponible une fois le lieu validé."}</p>
          {canSearch ? <div className="mt-2"><LinkButton href={`/missions/${m.id}/staff`} size="sm">Trouver du staff pour cette mission</LinkButton></div> : null}
        </Alert>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {!closed || m.status === "completed" ? <StatusSelect id={m.id} status={m.status} confirmed={m.confirmed_count} required={m.required_staff_count} /> : null}
        {m.status !== "cancelled" ? <CancelMissionButton id={m.id} title={m.title} /> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title="Avancement du recrutement" />
            <CardBody>
              <p className="text-2xl font-semibold">{m.selected_count} sur {m.required_staff_count} <span className="text-base font-normal text-muted">sélectionné(s)</span></p>
              <p className="mt-1 text-sm text-muted">{m.confirmed_count} confirmé(s). La mission n’est « pourvue » que lorsque l’effectif requis est confirmé : une sélection n’est pas une acceptation.</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={m.required_staff_count} aria-valuenow={Math.min(m.selected_count, m.required_staff_count)} aria-label="Staff sélectionné">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (m.selected_count / m.required_staff_count) * 100)}%` }} />
              </div>
            </CardBody>
          </Card>

          <Card id="staff">
            <CardHeader
              title="Staff sélectionné"
              actions={rows.length > 0 ? <ExportMissionStaffButton id={m.id} /> : undefined}
            />
            <CardBody>
              <AssignmentsPanel rows={rows} locked={m.status === "cancelled"} />
              {canSearch ? <div className="mt-4"><LinkButton href={`/missions/${m.id}/staff`} variant="secondary" size="sm">Chercher d’autres candidats</LinkButton></div> : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Détails" />
            <CardBody>
              <dl className="divide-y divide-line">
                <Row label="Description"><span className="whitespace-pre-wrap">{m.description ?? "—"}</span></Row>
                <Row label="Début">{m.scheduled_start_at ? formatDateTime(m.scheduled_start_at, tz) : "—"}</Row>
                <Row label="Fin">{m.scheduled_end_at ? formatDateTime(m.scheduled_end_at, tz) : "—"}</Row>
                <Row label="Compétences requises">{m.required_skills.length ? <span className="flex flex-wrap gap-1">{m.required_skills.map((k) => <Badge key={k} tone="blue">{k}</Badge>)}</span> : "—"}</Row>
                <Row label="Transport préféré">{TRANSPORT_LABELS[m.transport_mode]}</Row>
                <Row label="Notes"><span className="whitespace-pre-wrap">{m.notes ?? "—"}</span></Row>
                <Row label="Mise à jour">{formatDateTime(m.updated_at, tz)}</Row>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Historique de la mission" />
            <CardBody>
              {(logs ?? []).length === 0 ? <p className="text-sm text-muted">Aucun événement.</p> : (
                <ul className="divide-y divide-line">
                  {((logs ?? []) as ActivityLog[]).map((l) => (
                    <li key={l.id} className="py-2.5 text-sm">
                      <p>{l.description}</p>
                      <p className="text-xs text-muted">{EVENT_LABELS[l.event_type] ?? l.event_type} · {formatDateTime(l.created_at, tz)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Lieu de la mission" actions={m.location_status !== "resolved" ? <RevalidateLocationButton id={m.id} /> : undefined} />
            <CardBody className="space-y-3">
              <dl className="divide-y divide-line">
                <Row label="Adresse">{missionLocation(m)}</Row>
                <Row label="Statut"><LocationBadge status={m.location_status} /></Row>
                <Row label="Dernière vérification">{m.location_updated_at ? formatDateTime(m.location_updated_at, tz) : "Jamais vérifié"}</Row>
              </dl>
              {hasCoords ? (
                <LocationMap latitude={m.latitude as number} longitude={m.longitude as number} label={`${m.title} — lieu de la mission`} token={mapboxPublicToken()} />
              ) : (
                <Alert tone="warning" title="Lieu non vérifié">La recherche par distance est indisponible. Modifiez la mission et validez le lieu, ou utilisez « Revalider le lieu ».</Alert>
              )}
              <p className="text-xs text-muted">Position approximative déduite du code postal ou de la ville.</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
