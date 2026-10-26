import { notFound } from "next/navigation";
import { MissionForm } from "@/components/missions/mission-form";
import { Alert, PageHeader } from "@/components/ui/card";
import { T } from "@/components/providers/t";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { getRoutingCapabilities } from "@/lib/routing/service";
import type { Mission } from "@/lib/types";
import { uuidSchema } from "@/lib/validation";

export const metadata = { title: "Modifier la mission" };

export default async function EditMissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const [{ supabase, profile }, { t }] = await Promise.all([requireSession(), getT()]);
  const { data } = await supabase.from("missions").select("*").eq("id", id).maybeSingle();
  const mission = data as Mission | null;
  if (!mission) notFound();
  const caps = getRoutingCapabilities();
  return (
    <>
      <PageHeader title={<T fr="Modifier la mission" en="Edit assignment" />} description={mission.title} />
      {mission.status === "cancelled" ? (
        <Alert tone="warning" title={t("Mission annulée", "Assignment cancelled")}>{t("Une mission annulée ne peut plus être modifiée.", "A cancelled assignment can no longer be edited.")}</Alert>
      ) : (
        <MissionForm mission={mission} defaultCountry={profile.country_code} timeZone={profile.timezone} supportedModes={caps.supportedModes} defaultMode={profile.default_transport_mode} />
      )}
    </>
  );
}
