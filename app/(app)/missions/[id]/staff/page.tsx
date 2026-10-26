import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { CandidateSearch } from "@/components/search/candidate-search";
import { MissionStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Alert, PageHeader } from "@/components/ui/card";
import { missionLocation } from "@/components/missions/mission-card";
import { RefreshButton } from "@/components/ui/refresh-button";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { mapboxPublicToken } from "@/lib/env";
import { getRoutingCapabilities } from "@/lib/routing/service";
import type { MissionOverview } from "@/lib/types";
import { uuidSchema } from "@/lib/validation";

export const metadata = { title: "Trouver du staff pour la mission" };

export default async function MissionStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const [{ supabase, profile }, { t }] = await Promise.all([requireSession(), getT()]);
  const { data } = await supabase.from("mission_overview").select("*").eq("id", id).maybeSingle();
  const m = data as MissionOverview | null;
  if (!m) notFound();

  const routing = getRoutingCapabilities();
  const hasCoords = m.location_status === "resolved" && m.latitude !== null && m.longitude !== null;
  const closed = m.status === "cancelled" || m.status === "completed";

  return (
    <>
      <Link href={`/missions/${m.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden /> {t("Retour à la mission", "Back to assignment")}</Link>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{m.title}<MissionStatusBadge status={m.status} /></span>}
        description={`${missionLocation(m)} · ${m.selected_count}/${m.required_staff_count} ${t("sélectionné(s)", "selected")} · ${m.confirmed_count} ${t("confirmé(s)", "confirmed")}`}
        actions={<><LinkButton href={`/missions/${m.id}`} variant="secondary">{t("Retour à la mission", "Back to assignment")}</LinkButton>{m.status !== "cancelled" ? <LinkButton href={`/missions/${m.id}/edit`} variant="secondary"><Pencil className="h-4 w-4" aria-hidden /> {t("Modifier", "Edit")}</LinkButton> : null}<RefreshButton /></>}
      />

      {closed ? <Alert tone="warning" title={t("Mission clôturée", "Assignment closed")} className="mb-4">{t("La sélection de staff est désactivée pour une mission annulée ou terminée.", "Staff selection is disabled for a cancelled or completed assignment.")}</Alert> : null}

      {!hasCoords ? (
        <Alert tone="warning" title={t("Lieu de la mission non vérifié", "Assignment location not verified")}>
          {t("La recherche par distance est indisponible tant que le lieu n’a pas de coordonnées vérifiées.", "Distance search is unavailable until the location has verified coordinates.")} <Link className="underline" href={`/missions/${m.id}/edit`}>{t("Modifier la mission et valider le lieu", "Edit the assignment and validate the location")}</Link>.
        </Alert>
      ) : (
        <CandidateSearch
          target={{ kind: "mission", missionId: m.id }}
          routing={routing}
          mapToken={mapboxPublicToken()}
          unit={profile.distance_unit}
          timeZone={profile.timezone}
          defaults={{ radiusKm: profile.default_search_radius_km, availability: profile.default_availability_filter, mode: m.transport_mode }}
          mission={{ id: m.id, title: m.title, status: m.status, requiredStaffCount: m.required_staff_count, selectedCount: m.selected_count }}
        />
      )}
    </>
  );
}
