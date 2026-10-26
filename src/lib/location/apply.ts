import "server-only";
import { normalizePostalCode } from "@/lib/geo/postal";
import type { LocationStatus } from "@/lib/types";
import { resolveLocation } from "./service";

export type LocationInput = { country_code: string; postal_code: string | null; city: string | null; region: string | null };
export type LocationPrev = LocationInput & {
  postal_code_normalized: string | null;
  latitude: number | null;
  longitude: number | null;
  location_status: LocationStatus;
  location_updated_at: string | null;
};

export type LocationFields = {
  country_code: string;
  postal_code: string | null;
  postal_code_normalized: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  location_status: LocationStatus;
  location_updated_at: string | null;
};

export type LocationComputation =
  | { ok: true; fields: LocationFields; event?: { type: "location_resolved" | "location_failed"; description: string; reason?: string }; reused: boolean }
  | { ok: false; field: "postal_code" | "city"; message: string };

const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/**
 * Calcule les champs de localisation à enregistrer.
 * - Les coordonnées viennent TOUJOURS du serveur (géocodeur) ; celles envoyées par le navigateur ne sont jamais lues.
 * - Adresse inchangée et déjà vérifiée : on conserve coordonnées ET date de vérification (pas de re-géocodage inutile,
 *   pas de date « rafraîchie » artificiellement).
 * - Adresse modifiée : l'ancien résultat est invalidé (coordonnées effacées) avant la nouvelle résolution.
 * - Échec temporaire (réseau, quota, clé absente) → « pending » (à réessayer) ; échec définitif (introuvable) → « failed ».
 */
export async function computeLocation(input: LocationInput, prev?: LocationPrev | null, opts: { force?: boolean } = {}): Promise<LocationComputation> {
  const base = { country_code: input.country_code, city: input.city, region: input.region };

  if (!input.postal_code && !input.city) {
    return {
      ok: true, reused: false,
      fields: { ...base, postal_code: null, postal_code_normalized: null, latitude: null, longitude: null, location_status: "pending", location_updated_at: null },
    };
  }

  let display: string | null = null;
  let key: string | null = null;
  if (input.postal_code) {
    const pc = normalizePostalCode(input.country_code, input.postal_code);
    if (!pc.ok) return { ok: false, field: "postal_code", message: pc.reason };
    display = pc.display;
    key = pc.key;
  }

  // Ville seule : le code postal enregistré (dérivé lors d'une précédente résolution) ne compte pas comme un changement.
  const keepPrevPostal = key === null;
  const unchanged =
    !opts.force && prev && prev.location_status === "resolved" && prev.latitude !== null && prev.longitude !== null &&
    same(prev.country_code, input.country_code) && (keepPrevPostal || (prev.postal_code_normalized ?? null) === key) && same(prev.city, input.city) && same(prev.region, input.region);
  if (unchanged && prev) {
    return {
      ok: true, reused: true,
      fields: { ...base, postal_code: keepPrevPostal ? prev.postal_code : display, postal_code_normalized: keepPrevPostal ? prev.postal_code_normalized : key, latitude: prev.latitude, longitude: prev.longitude, location_status: "resolved", location_updated_at: prev.location_updated_at },
    };
  }

  const r = await resolveLocation({ countryCode: input.country_code, postalCode: display, city: input.city, region: input.region });
  if (r.ok) {
    // Code postal dérivé (ville seule) : stocké seulement s'il est valide ; un code saisi n'est jamais remplacé.
    let savedDisplay = display;
    let savedKey = key;
    if (!display && r.postal_derived && r.postalDisplay) {
      const pc = normalizePostalCode(input.country_code, r.postalDisplay);
      if (pc.ok) {
        savedDisplay = pc.display;
        savedKey = pc.key;
      }
    }
    return {
      ok: true, reused: false,
      event: { type: "location_resolved", description: "Localisation résolue" },
      fields: {
        ...base, city: input.city ?? r.city, region: input.region ?? r.region,
        postal_code: savedDisplay, postal_code_normalized: savedKey,
        latitude: r.latitude, longitude: r.longitude,
        location_status: "resolved", location_updated_at: new Date().toISOString(),
      },
    };
  }
  if (r.reason === "invalid_input") return { ok: false, field: input.postal_code ? "postal_code" : "city", message: r.message };

  const definitive = r.reason === "not_found" || r.reason === "invalid_response";
  return {
    ok: true, reused: false,
    event: { type: "location_failed", description: `Localisation non résolue : ${r.message}`, reason: r.reason },
    fields: {
      ...base, postal_code: display, postal_code_normalized: key,
      latitude: null, longitude: null, location_status: definitive ? "failed" : "pending", location_updated_at: null,
    },
  };
}
