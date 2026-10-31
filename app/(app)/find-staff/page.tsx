import { FindStaffClient } from "@/components/search/find-staff-client";
import { requireSession } from "@/lib/auth";
import { mapboxPublicToken } from "@/lib/env";
import { getRoutingCapabilities } from "@/lib/routing/service";

export const metadata = {
  title: "Trouver du staff",
};

export default async function FindStaffPage() {
  const { profile } = await requireSession();

  return (
    <>
      {/* Pas de bandeau de titre ici : le menu indique déjà la page, et les blocs collants restent bien sous l’en-tête. */}
      <FindStaffClient
        defaultCountry={profile.country_code}
        routing={getRoutingCapabilities()}
        mapToken={mapboxPublicToken()}
        unit={profile.distance_unit}
        timeZone={profile.timezone}
        defaults={{
          radiusKm: profile.default_search_radius_km,
          // Les indisponibles restent visibles (marqués en rouge) : le filtre « disponibles uniquement » se choisit dans les filtres.
          availability: "all",
          mode: profile.default_transport_mode,
        }}
      />
    </>
  );
}