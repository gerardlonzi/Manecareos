import "server-only";
import { z } from "zod";
import { APP_CONFIG } from "@/config/app";
import { isValidCoordinate } from "@/lib/geo/haversine";

export type GeocodeQuery = {
  countryCode: string;
  postalCode?: string | null;
  city?: string | null;
  region?: string | null;
};

export type GeocodeFailure = "not_configured" | "not_found" | "rate_limited" | "invalid_response" | "network" | "invalid_input";

export type GeocodeResult =
  | {
      ok: true;
      latitude: number;
      longitude: number;
      label: string;
      city: string | null;
      region: string | null;
      provider: string;
      /** Un centroïde de code postal est approximatif : on le dit. */
      approximate: true;
    }
  | { ok: false; reason: GeocodeFailure; message: string };

export interface Geocoder {
  readonly id: string;
  isConfigured(): boolean;
  geocode(q: GeocodeQuery): Promise<GeocodeResult>;
}

const featureSchema = z.object({
  features: z
    .array(
      z.object({
        geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
        properties: z.object({
          full_address: z.string().optional(),
          name: z.string().optional(),
          place_formatted: z.string().optional(),
          context: z
            .object({
              place: z.object({ name: z.string() }).partial().optional(),
              locality: z.object({ name: z.string() }).partial().optional(),
              region: z.object({ name: z.string() }).partial().optional(),
            })
            .partial()
            .optional(),
        }),
      }),
    )
    .default([]),
});

export class MapboxGeocoder implements Geocoder {
  readonly id = "mapbox-geocoding-v6";

  private get token(): string | undefined {
    return process.env.MAPBOX_SERVER_TOKEN || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.token);
  }

  async geocode(q: GeocodeQuery): Promise<GeocodeResult> {
    if (!this.token) {
      return { ok: false, reason: "not_configured", message: "Géocodage non configuré (MAPBOX_SERVER_TOKEN)." };
    }
    const parts = [q.postalCode, q.city, q.region].map((s) => s?.trim()).filter(Boolean) as string[];
    if (parts.length === 0) {
      return { ok: false, reason: "invalid_input", message: "Indiquez un code postal ou une ville." };
    }
    const types = q.postalCode?.trim() ? "postcode,place,locality" : "place,locality,district";
    const url =
      `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(parts.join(", "))}` +
      `&country=${encodeURIComponent(q.countryCode.toLowerCase())}&types=${types}&limit=1&access_token=${encodeURIComponent(this.token)}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), APP_CONFIG.geocoding.requestTimeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (res.status === 429) return { ok: false, reason: "rate_limited", message: "Limite du service de géocodage atteinte. Réessayez plus tard." };
      if (res.status === 401 || res.status === 403) return { ok: false, reason: "not_configured", message: "Jeton de géocodage refusé." };
      if (!res.ok) return { ok: false, reason: "network", message: `Le service de géocodage a répondu ${res.status}.` };

      const parsed = featureSchema.safeParse(await res.json().catch(() => null));
      if (!parsed.success) return { ok: false, reason: "invalid_response", message: "Réponse de géocodage invalide." };
      const f = parsed.data.features[0];
      if (!f) return { ok: false, reason: "not_found", message: "Aucun lieu trouvé pour cette adresse." };

      const [lon, lat] = f.geometry.coordinates;
      if (!isValidCoordinate(lat, lon)) return { ok: false, reason: "invalid_response", message: "Coordonnées reçues invalides." };

      const ctx = f.properties.context;
      return {
        ok: true,
        latitude: lat,
        longitude: lon,
        label: f.properties.full_address ?? [f.properties.name, f.properties.place_formatted].filter(Boolean).join(", "),
        city: ctx?.place?.name ?? ctx?.locality?.name ?? null,
        region: ctx?.region?.name ?? null,
        provider: this.id,
        approximate: true,
      };
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      return { ok: false, reason: "network", message: aborted ? "Le service de géocodage n'a pas répondu à temps." : "Erreur réseau vers le service de géocodage." };
    } finally {
      clearTimeout(timer);
    }
  }
}
