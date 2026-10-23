import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Pencil } from "lucide-react";
import LocationMap from "@/components/map/location-map-lazy";
import { ProfileActions } from "@/components/staff/profile-actions";
import { ContactButtons } from "@/components/staff/contact-buttons";
import { AssignmentBadge, AvailabilityBadge, Badge, LocationBadge, MissionStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { EVENT_LABELS } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { mapboxPublicToken } from "@/lib/env";
import type { ActivityLog, AssignmentStatus, MissionStatus, Staff } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { uuidSchema } from "@/lib/validation";

export const metadata = { title: "Fiche staff" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="col-span-2 min-w-0 break-words">{children}</dd>
    </div>
  );
}

export default async function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const { supabase, profile } = await requireSession();

  const [{ data }, { data: logs }, { data: assigns }] = await Promise.all([
    supabase.from("staff").select("*").eq("id", id).maybeSingle(),
    supabase.from("activity_logs").select("*").eq("staff_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("mission_staff").select("id, assignment_status, mission_id, missions(id, title, status)").eq("staff_id", id).order("selected_at", { ascending: false }).limit(10),
  ]);
  const s = data as Staff | null;
  if (!s) notFound();
  const tz = profile.timezone;
  const token = mapboxPublicToken();
  const hasCoords = s.location_status === "resolved" && s.latitude !== null && s.longitude !== null;
  type AssignRow = { id: string; assignment_status: AssignmentStatus; mission_id: string; missions: { id: string; title: string; status: MissionStatus } | { id: string; title: string; status: MissionStatus }[] | null };
  const assignments = ((assigns ?? []) as unknown as AssignRow[]).map((a) => ({ ...a, mission: Array.isArray(a.missions) ? a.missions[0] : a.missions }));

  return (
    <>
      <Link href="/staff" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour à l’annuaire</Link>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{s.full_name}{s.archived_at ? <Badge>Archivé</Badge> : null}</span>}
        description={s.staff_code ? `Code staff : ${s.staff_code}` : undefined}
        actions={<LinkButton href={`/staff/${s.id}/edit`} variant="secondary"><Pencil className="h-4 w-4" aria-hidden /> Modifier</LinkButton>}
      />

      <div className="mb-6"><ProfileActions id={s.id} name={s.full_name} availability={s.availability_status} archived={Boolean(s.archived_at)} /></div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title="Contact" />
            <CardBody>
              <dl className="divide-y divide-line">
                <Row label="Téléphone">{s.phone ?? "—"}</Row>
                <Row label="E-mail">{s.email ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`mailto:${s.email}`}><Mail className="h-3.5 w-3.5" aria-hidden />{s.email}</a> : "—"}</Row>
                <Row label="Dernier contact">{s.last_contacted_at ? `${formatDateTime(s.last_contacted_at, tz)} (déclaré par le manager)` : "—"}</Row>
              </dl>
              <div className="mt-3"><ContactButtons phone={s.phone} size="md" /></div>
              <p className="mt-2 text-xs text-muted">Appeler ou écrire ouvre votre application ; StaffFlow ne sait pas si l’appel ou le message a abouti.</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Profil" />
            <CardBody>
              <dl className="divide-y divide-line">
                <Row label="Disponibilité"><AvailabilityBadge status={s.availability_status} /></Row>
                <Row label="Compétences">{s.skills.length ? <span className="flex flex-wrap gap-1">{s.skills.map((k) => <Badge key={k} tone="blue">{k}</Badge>)}</span> : "—"}</Row>
                <Row label="Notes"><span className="whitespace-pre-wrap">{s.notes ?? "—"}</span></Row>
                <Row label="Créé le">{formatDateTime(s.created_at, tz)}</Row>
                <Row label="Mis à jour le">{formatDateTime(s.updated_at, tz)}</Row>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Missions" description="Sélection ≠ acceptation : le statut indique où en est chaque affectation." />
            <CardBody>
              {assignments.length === 0 ? <p className="text-sm text-muted">Aucune affectation.</p> : (
                <ul className="divide-y divide-line">
                  {assignments.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      {a.mission ? <Link className="font-medium hover:text-primary hover:underline" href={`/missions/${a.mission.id}`}>{a.mission.title}</Link> : <span>Mission</span>}
                      <span className="flex items-center gap-2">{a.mission ? <MissionStatusBadge status={a.mission.status} /> : null}<AssignmentBadge status={a.assignment_status} /></span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Historique" />
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
            <CardHeader title="Localisation enregistrée" />
            <CardBody className="space-y-3">
              <dl className="divide-y divide-line">
                <Row label="Pays">{s.country_code}</Row>
                <Row label="Code postal">{s.postal_code ?? "—"}</Row>
                <Row label="Ville">{s.city ?? "—"}</Row>
                <Row label="Région">{s.region ?? "—"}</Row>
                <Row label="Statut"><LocationBadge status={s.location_status} /></Row>
                <Row label="Dernière vérification">{s.location_updated_at ? formatDateTime(s.location_updated_at, tz) : "Jamais vérifiée"}</Row>
              </dl>
              {hasCoords ? (
                <LocationMap latitude={s.latitude as number} longitude={s.longitude as number} label={`${s.full_name} — localisation enregistrée`} token={token} />
              ) : (
                <Alert tone="warning" title="Pas de coordonnées vérifiées">Cette personne est exclue des recherches par distance. Modifiez la fiche et validez la localisation.</Alert>
              )}
              <p className="text-xs text-muted">Position approximative déduite du code postal ou de la ville enregistré. Elle ne prouve pas où se trouve la personne en ce moment.</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
