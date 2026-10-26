"use client";
import Link from "next/link";
import { usePreferences } from "@/components/providers/preferences-provider";
import { CalendarClock, MapPin, Users } from "lucide-react";
import { MissionStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import type { MissionOverview } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function missionLocation(m: Pick<MissionOverview, "postal_code" | "city" | "region" | "country_code">): string {
  return [m.postal_code, m.city, m.region].filter(Boolean).join(" · ") || m.country_code;
}

/** Carte de mission : l’effectif « sélectionné » et « confirmé » sont affichés séparément. */
export function MissionCard({ m, timeZone }: { m: MissionOverview; timeZone: string }) {
  const { t } = usePreferences();
  const closed = m.status === "cancelled" || m.status === "completed";
  return (
    <div className="card-surface lift p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link href={`/missions/${m.id}`} className="min-w-0 font-medium hover:text-primary hover:underline">{m.title}</Link>
        <MissionStatusBadge status={m.status} />
      </div>
      <dl className="mt-2 space-y-1 text-sm text-muted">
        <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /><dd>{missionLocation(m)}{m.location_status !== "resolved" ? ` (${t("lieu à vérifier", "location to verify")})` : ""}</dd></div>
        <div className="flex items-center gap-2"><CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden /><dd>{m.scheduled_start_at ? formatDateTime(m.scheduled_start_at, timeZone) : t("Date non définie", "No date set")}</dd></div>
        <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5 shrink-0" aria-hidden /><dd>{t(`${m.selected_count} sur ${m.required_staff_count} sélectionné(s) · ${m.confirmed_count} confirmé(s)`, `${m.selected_count} of ${m.required_staff_count} selected · ${m.confirmed_count} confirmed`)}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <LinkButton href={`/missions/${m.id}`} variant="secondary" size="sm">{t("Voir la mission", "View assignment")}</LinkButton>
        {!closed ? <LinkButton href={`/missions/${m.id}/staff`} size="sm">{t("Trouver du staff", "Find staff")}</LinkButton> : null}
        {!closed ? <LinkButton href={`/missions/${m.id}/edit`} variant="ghost" size="sm">{t("Modifier", "Edit")}</LinkButton> : null}
      </div>
    </div>
  );
}
