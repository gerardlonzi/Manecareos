import { MissionForm } from "@/components/missions/mission-form";
import { PageHeader } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { getRoutingCapabilities } from "@/lib/routing/service";

export const metadata = { title: "Nouvelle mission" };

export default async function NewMissionPage() {
  const { profile } = await requireSession();
  const caps = getRoutingCapabilities();
  return (
    <>
      <PageHeader title="Nouvelle mission" description="Le lieu est validé par le fournisseur de géocodage ; aucune coordonnée n’est inventée." />
      <div className="max-w-3xl">
        <MissionForm defaultCountry={profile.country_code} timeZone={profile.timezone} supportedModes={caps.supportedModes} defaultMode={profile.default_transport_mode} />
      </div>
    </>
  );
}
