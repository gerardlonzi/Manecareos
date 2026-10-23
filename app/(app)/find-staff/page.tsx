import { FindStaffClient } from "@/components/search/find-staff-client";
import { PageHeader } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { mapboxPublicToken } from "@/lib/env";
import { getRoutingCapabilities } from "@/lib/routing/service";

export const metadata = { title: "Trouver du staff" };

export default async function FindStaffPage() {
  const { profile } = await requireSession();
  return (
    <>
      <PageHeader title="Trouver du staff" description="Recherche géographique sans mission : indiquez un lieu, obtenez les staff disponibles les plus proches." />
      <FindStaffClient
        defaultCountry={profile.country_code}
        routing={getRoutingCapabilities()}
        mapToken={mapboxPublicToken()}
        unit={profile.distance_unit}
        timeZone={profile.timezone}
        defaults={{ radiusKm: profile.default_search_radius_km, availability: profile.default_availability_filter, mode: profile.default_transport_mode }}
      />
    </>
  );
}
