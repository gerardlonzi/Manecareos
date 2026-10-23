import { LocationPrefsForm } from "@/components/settings/settings-forms";
import { APP_CONFIG } from "@/config/app";
import { requireSession } from "@/lib/auth";
import { getRoutingCapabilities } from "@/lib/routing/service";

export const metadata = { title: "Recherche et trajets" };

export default async function LocationSettingsPage() {
  const { profile } = await requireSession();
  return <LocationPrefsForm profile={profile} supportedModes={getRoutingCapabilities().supportedModes} defaultCountry={APP_CONFIG.defaultCountry} />;
}
