import { MissionForm } from "@/components/missions/mission-form";
import { PageHeader } from "@/components/ui/card";
import { T } from "@/components/providers/t";
import { requireSession } from "@/lib/auth";
import { getRoutingCapabilities } from "@/lib/routing/service";

export const metadata = { title: "Nouvelle mission" };

export default async function NewMissionPage() {
  const { profile } = await requireSession();
  const caps = getRoutingCapabilities();
  return (
    <>
      <PageHeader title={<T fr="Nouvelle mission" en="New assignment" />} description={<T fr="Choisir une ville remplit automatiquement le code postal." en="Choosing a city fills in the postcode automatically." />} />
      <MissionForm defaultCountry={profile.country_code} timeZone={profile.timezone} supportedModes={caps.supportedModes} defaultMode={profile.default_transport_mode} />
    </>
  );
}
