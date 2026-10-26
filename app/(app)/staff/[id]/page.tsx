import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, Mail, Pencil } from "lucide-react";
import LocationMap from "@/components/map/location-map-lazy";
import { ProfileActions } from "@/components/staff/profile-actions";
import { ContactButtons } from "@/components/staff/contact-buttons";
import { Avatar } from "@/components/ui/avatar";
import { AssignmentBadge, AvailabilityBadge, Badge, LocationBadge, MissionStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Flag } from "@/components/ui/flag";
import { EVENT_LABELS, EVENT_LABELS_EN } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { getCountryOption, optionIdFor } from "@/config/countries";
import { skillLabel } from "@/config/skills";
import { mapboxPublicToken } from "@/lib/env";
import { getT } from "@/lib/i18n-server";
import { describeActivity } from "@/lib/messages";
import { signPhotoUrls } from "@/lib/photos";
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
  const [{ supabase, profile }, { t, locale }] = await Promise.all([requireSession(), getT()]);

  const [{ data }, { data: logs }, { data: assigns }] = await Promise.all([
    supabase.from("staff").select("*").eq("id", id).maybeSingle(),
    supabase.from("activity_logs").select("*").eq("staff_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("mission_staff").select("id, assignment_status, mission_id, missions(id, title, status)").eq("staff_id", id).order("selected_at", { ascending: false }).limit(10),
  ]);
  const s = data as Staff | null;
  if (!s) notFound();
  const photos = await signPhotoUrls(supabase, [s]);
  const tz = profile.timezone;
  const token = mapboxPublicToken();
  const hasCoords = s.location_status === "resolved" && s.latitude !== null && s.longitude !== null;
  const country = getCountryOption(optionIdFor(s.country_code, s.region));
  type AssignRow = { id: string; assignment_status: AssignmentStatus; mission_id: string; missions: { id: string; title: string; status: MissionStatus } | { id: string; title: string; status: MissionStatus }[] | null };
  const assignments = ((assigns ?? []) as unknown as AssignRow[]).map((a) => ({ ...a, mission: Array.isArray(a.missions) ? a.missions[0] : a.missions }));
  const labels = locale === "fr" ? EVENT_LABELS : EVENT_LABELS_EN;

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3"><Avatar name={s.full_name} photoUrl={photos[s.id]} size={40} />{s.full_name}{s.archived_at ? <Badge>{t("Archivé", "Archived")}</Badge> : null}</span>}
        description={s.staff_code ? `${t("Code staff", "Staff ID")} : ${s.staff_code}` : undefined}
        actions={<><Link href="/staff" className="inline-flex h-10 items-center gap-1 rounded-lg px-3 text-sm text-muted hover:bg-primary-soft hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden />{t("Annuaire", "Directory")}</Link><LinkButton href={`/staff/${s.id}/edit`} variant="secondary"><Pencil className="h-4 w-4" aria-hidden /> {t("Modifier", "Edit")}</LinkButton></>}
      />
      <div className="mb-6"><ProfileActions id={s.id} name={s.full_name} availability={s.availability_status} archived={Boolean(s.archived_at)} /></div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title="Contact" />
            <CardBody>
              <dl className="divide-y divide-line">
                <Row label={t("Téléphone", "Phone")}>{s.phone ?? "—"}</Row>
                <Row label="E-mail">{s.email ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`mailto:${s.email}`}><Mail className="h-3.5 w-3.5" aria-hidden />{s.email}</a> : "—"}</Row>
                <Row label={t("Dernier contact", "Last contact")}>{s.last_contacted_at ? `${formatDateTime(s.last_contacted_at, tz)} ${t("(déclaré par le manager)", "(declared by the manager)")}` : "—"}</Row>
              </dl>
              <div className="mt-3"><ContactButtons phone={s.phone} size="md" /></div>
              <p className="mt-2 text-xs text-muted">{t("Appeler ou écrire ouvre votre application ; Manecare ne sait pas si l’appel ou le message a abouti.", "Calling or messaging opens your app; Manecare cannot tell whether the call or message went through.")}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("Profil", "Profile")} />
            <CardBody>
              <dl className="divide-y divide-line">
                <Row label={t("Disponibilité", "Availability")}><AvailabilityBadge status={s.availability_status} /></Row>
                <Row label={t("Heures par semaine", "Hours per week")}>{s.weekly_hours != null ? <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-primary" aria-hidden />{s.weekly_hours} h</span> : "—"}</Row>
                <Row label={t("Compétences", "Skills")}>{s.skills.length ? <span className="flex flex-wrap gap-1">{s.skills.map((k) => <Badge key={k} tone="blue">{skillLabel(k, locale)}</Badge>)}</span> : "—"}</Row>
                <Row label="Notes"><span className="whitespace-pre-wrap">{s.notes ?? "—"}</span></Row>
                <Row label={t("Créé le", "Created")}>{formatDateTime(s.created_at, tz)}</Row>
                <Row label={t("Mis à jour le", "Updated")}>{formatDateTime(s.updated_at, tz)}</Row>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Missions" description={t("Sélection ≠ acceptation : le statut indique où en est chaque affectation.", "Selected ≠ accepted: the status shows where each assignment stands.")} />
            <CardBody>
              {assignments.length === 0 ? <p className="text-sm text-muted">{t("Aucune affectation.", "No assignments.")}</p> : (
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
            <CardHeader title={t("Historique", "History")} />
            <CardBody>
              {(logs ?? []).length === 0 ? <p className="text-sm text-muted">{t("Aucun événement.", "No events.")}</p> : (
                <ul className="divide-y divide-line">
                  {((logs ?? []) as ActivityLog[]).map((l) => (
                    <li key={l.id} className="py-2.5 text-sm">
                      <p>{describeActivity(l, locale)}</p>
                      <p className="text-xs text-muted">{labels[l.event_type] ?? l.event_type} · {formatDateTime(l.created_at, tz)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t("Localisation enregistrée", "Saved location")} />
            <CardBody className="space-y-3">
              <dl className="divide-y divide-line">
                <Row label={t("Pays", "Country")}><span className="inline-flex items-center gap-2"><Flag code={s.country_code} region={s.region} />{country?.[locale] ?? s.country_code}</span></Row>
                <Row label={t("Ville", "City")}>{s.city ?? "—"}</Row>
                <Row label={t("Région", "Region")}>{s.region ?? "—"}</Row>
                <Row label={t("Code postal", "Postcode")}><span className="font-mono">{s.postal_code ?? "—"}</span></Row>
                <Row label={t("Statut", "Status")}><LocationBadge status={s.location_status} /></Row>
                <Row label={t("Dernière vérification", "Last verified")}>{s.location_updated_at ? formatDateTime(s.location_updated_at, tz) : t("Jamais vérifiée", "Never verified")}</Row>
              </dl>
              {hasCoords ? (
                <LocationMap latitude={s.latitude as number} longitude={s.longitude as number} label={s.full_name} token={token} />
              ) : (
                <Alert tone="warning" title={t("Pas de coordonnées vérifiées", "No verified coordinates")}>{t("Cette personne est exclue des recherches par distance. Modifiez la fiche et validez la localisation.", "This person is excluded from distance searches. Edit the profile and validate the location.")}</Alert>
              )}
              <p className="text-xs text-muted">{t("Position approximative déduite du code postal ou de la ville. Elle ne prouve pas où se trouve la personne en ce moment.", "Approximate position derived from the postcode or city. It does not show where the person is right now.")}</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
