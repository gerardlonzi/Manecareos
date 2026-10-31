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
import { EVENT_LABELS, EVENT_LABELS_EN } from "@/lib/activity";
import { workplaceLabel } from "@/config/workplaces";
import { skillLabel } from "@/config/skills";
import { getT } from "@/lib/i18n-server";
import { describeActivity } from "@/lib/messages";
import { signPhotoUrls } from "@/lib/photos";
import { requireSession } from "@/lib/auth";
import { mapboxPublicToken } from "@/lib/env";
import type { ActivityLog, AssignmentStatus, AvailabilityStatus, MissionOverview } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { uuidSchema } from "@/lib/validation";
import { utcIsoToZonedLocal } from "@/lib/time";

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
  const [{ supabase, profile }, { t, locale }] = await Promise.all([requireSession(), getT()]);
  const tz = profile.timezone;

  const [{ data }, { data: assigns }, { data: logs }] = await Promise.all([
    supabase.from("mission_overview").select("*").eq("id", id).maybeSingle(),
    supabase.from("mission_staff")
      .select("id, assignment_status, staff_id, selected_at, shift_start_at, shift_end_at, hours_worked, pay_rate, completed_at, staff:staff_id(id, full_name, phone, availability_status, archived_at, photo_path)")
      .eq("mission_id", id).order("selected_at", { ascending: true }),
    supabase.from("activity_logs").select("*").eq("mission_id", id).order("created_at", { ascending: false }).limit(15),
  ]);
  const m = data as MissionOverview | null;
  if (!m) notFound();

  type S = { id: string; full_name: string; phone: string | null; availability_status: AvailabilityStatus; archived_at: string | null; photo_path: string | null };
  type A = { id: string; assignment_status: AssignmentStatus; staff_id: string; shift_start_at: string | null; shift_end_at: string | null; hours_worked: number | null; pay_rate: number | null; completed_at: string | null; staff: S | S[] | null };
  const photoMap = await signPhotoUrls(supabase, ((assigns ?? []) as unknown as A[]).flatMap((a) => { const s = Array.isArray(a.staff) ? a.staff[0] : a.staff; return s ? [{ id: s.id, photo_path: s.photo_path }] : []; }));
  const rows: AssignmentRow[] = ((assigns ?? []) as unknown as A[]).flatMap((a) => {
    const s = Array.isArray(a.staff) ? a.staff[0] : a.staff;
    return s ? [{ photoUrl: photoMap[s.id], id: a.id, status: a.assignment_status, staffId: a.staff_id, name: s.full_name, phone: s.phone, availability: s.availability_status, archived: Boolean(s.archived_at), shiftStart: utcIsoToZonedLocal(a.shift_start_at, profile.timezone), shiftEnd: utcIsoToZonedLocal(a.shift_end_at, profile.timezone), hoursWorked: a.hours_worked, payRate: a.pay_rate ?? m.pay_rate, currency: m.pay_currency, plannedHours: m.planned_hours }] : [];
  });

  const closed = m.status === "cancelled" || m.status === "completed";
  const hasCoords = m.location_status === "resolved" && m.latitude !== null && m.longitude !== null;
  const canSearch = hasCoords && !closed;

  return (
    <>
      <Link href="/missions" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden /> {t("Retour aux missions", "Back to assignments")}</Link>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{m.title}<MissionStatusBadge status={m.status} /></span>}
        description={[workplaceLabel(m.workplace_type, m.workplace_name, locale), m.mission_reference ? `${t("Référence", "Reference")} : ${m.mission_reference}` : null].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            {!closed ? <LinkButton href={`/missions/${m.id}/staff`}><Search className="h-4 w-4" aria-hidden /> {t("Trouver du staff", "Find staff")}</LinkButton> : null}
            {m.status !== "cancelled" ? <LinkButton href={`/missions/${m.id}/edit`} variant="secondary"><Pencil className="h-4 w-4" aria-hidden /> {t("Modifier", "Edit")}</LinkButton> : null}
          </>
        }
      />

      {sp.created ? (
        <Alert tone="success" title={t("Mission enregistrée", "Assignment saved")} className="mb-4">
          <p>{canSearch ? t("Le lieu est vérifié : vous pouvez chercher du staff dès maintenant.", "The location is verified: you can search for staff right now.") : t("Le lieu n’est pas encore vérifié : la recherche par distance sera disponible une fois le lieu validé.", "The location is not verified yet: distance search will be available once it is validated.")}</p>
          {canSearch ? <div className="mt-2"><LinkButton href={`/missions/${m.id}/staff`} size="sm">{t("Trouver du staff pour cette mission", "Find staff for this assignment")}</LinkButton></div> : null}
        </Alert>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {!closed || m.status === "completed" ? <StatusSelect id={m.id} status={m.status} confirmed={m.confirmed_count} required={m.required_staff_count} /> : null}
        {m.status !== "cancelled" ? <CancelMissionButton id={m.id} title={m.title} /> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title={t("Avancement du recrutement", "Staffing progress")} />
            <CardBody>
              <p className="text-2xl font-semibold">{m.selected_count} / {m.required_staff_count} <span className="text-base font-normal text-muted">{t("sélectionné(s)", "selected")}</span></p>
              <p className="mt-1 text-sm text-muted">{m.confirmed_count} {t("confirmé(s). La mission n’est « pourvue » que lorsque l’effectif requis est confirmé : une sélection n’est pas une acceptation.", "confirmed. The assignment is only “staffed” once the required headcount is confirmed: being selected is not accepting.")}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={m.required_staff_count} aria-valuenow={Math.min(m.selected_count, m.required_staff_count)} aria-label={t("Staff sélectionné", "Selected staff")}>
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (m.selected_count / m.required_staff_count) * 100)}%` }} />
              </div>
            </CardBody>
          </Card>

          <Card id="staff">
            <CardHeader
              title={t("Staff sélectionné", "Selected staff")}
              actions={<ExportMissionStaffButton id={m.id} disabled={rows.length === 0} />}
            />
            <CardBody>
              <AssignmentsPanel rows={rows} locked={m.status === "cancelled"} />
              {canSearch ? <div className="mt-4"><LinkButton href={`/missions/${m.id}/staff`} variant="secondary" size="sm">{t("Chercher d’autres candidats", "Look for more candidates")}</LinkButton></div> : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("Détails", "Details")} />
            <CardBody>
              <dl className="divide-y divide-line">
                <Row label="Description"><span className="whitespace-pre-wrap">{m.description ?? "—"}</span></Row>
                <Row label={t("Début", "Start")}>{m.scheduled_start_at ? formatDateTime(m.scheduled_start_at, tz) : "—"}</Row>
                <Row label={t("Fin", "End")}>{m.scheduled_end_at ? formatDateTime(m.scheduled_end_at, tz) : "—"}</Row>
                <Row label={t("Lieu de travail", "Place of work")}>{workplaceLabel(m.workplace_type, m.workplace_name, locale) ?? "—"}</Row>
                <Row label={t("Compétences requises", "Required skills")}>{m.required_skills.length ? <span className="flex flex-wrap gap-1">{m.required_skills.map((k) => <Badge key={k} tone="blue">{skillLabel(k, locale)}</Badge>)}</span> : "—"}</Row>
                <Row label={t("Transport préféré", "Preferred transport")}>{({ driving: t("Voiture", "Car"), walking: t("Marche", "Walking"), cycling: t("Vélo", "Bicycle"), public_transport: t("Transports en commun", "Public transport") } as const)[m.transport_mode]}</Row>
                <Row label="Notes"><span className="whitespace-pre-wrap">{m.notes ?? "—"}</span></Row>
                <Row label={t("Mise à jour", "Updated")}>{formatDateTime(m.updated_at, tz)}</Row>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("Historique de la mission", "Assignment history")} />
            <CardBody>
              {(logs ?? []).length === 0 ? <p className="text-sm text-muted">{t("Aucun événement.", "No events.")}</p> : (
                <ul className="divide-y divide-line">
                  {((logs ?? []) as ActivityLog[]).map((l) => (
                    <li key={l.id} className="py-2.5 text-sm">
                      <p>{describeActivity(l, locale)}</p>
                      <p className="text-xs text-muted">{(locale === "fr" ? EVENT_LABELS : EVENT_LABELS_EN)[l.event_type] ?? l.event_type} · {formatDateTime(l.created_at, tz)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t("Lieu de la mission", "Assignment location")} actions={m.location_status !== "resolved" ? <RevalidateLocationButton id={m.id} /> : undefined} />
            <CardBody className="space-y-3">
              <dl className="divide-y divide-line">
                <Row label={t("Adresse", "Address")}>{missionLocation(m)}</Row>
                <Row label={t("Statut", "Status")}><LocationBadge status={m.location_status} /></Row>
                <Row label={t("Dernière vérification", "Last verified")}>{m.location_updated_at ? formatDateTime(m.location_updated_at, tz) : t("Jamais vérifié", "Never verified")}</Row>
              </dl>
              {hasCoords ? (
                <LocationMap latitude={m.latitude as number} longitude={m.longitude as number} label={m.title} token={mapboxPublicToken()} />
              ) : (
                <Alert tone="warning" title={t("Lieu non vérifié", "Location not verified")}>{t("La recherche par distance est indisponible. Modifiez la mission et validez le lieu, ou utilisez « Revalider le lieu ».", "Distance search is unavailable. Edit the assignment and validate the location, or use “Revalidate location”.")}</Alert>
              )}
              <p className="text-xs text-muted">{t("Position approximative déduite du code postal ou de la ville.", "Approximate position derived from the postcode or city.")}</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
