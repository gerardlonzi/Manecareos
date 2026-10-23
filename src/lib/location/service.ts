import "server-only";
import { APP_CONFIG } from "@/config/app";
import { getCountry } from "@/config/countries";
import { mapWithConcurrency } from "@/lib/concurrency";
import { normalizePostalCode } from "@/lib/geo/postal";
import { MapboxGeocoder, type Geocoder, type GeocodeQuery, type GeocodeResult } from "./geocoder";

let geocoder: Geocoder | null = null;
export function getGeocoder(): Geocoder {
  geocoder ??= new MapboxGeocoder();
  return geocoder;
}

/** Cache mémoire du processus : évite de re-géocoder une adresse identique. Ne contient aucune donnée personnelle. */
const MAX_ENTRIES = 2000;
const memo = new Map<string, GeocodeResult>();

export function locationKey(q: GeocodeQuery): string {
  const pc = q.postalCode ? normalizePostalCode(q.countryCode, q.postalCode) : null;
  return [
    q.countryCode.toUpperCase(),
    pc && pc.ok ? pc.key : "",
    (q.city ?? "").trim().toLowerCase(),
    (q.region ?? "").trim().toLowerCase(),
  ].join("|");
}

export type ResolveOutcome =
  | { ok: true; latitude: number; longitude: number; label: string; city: string | null; region: string | null; postalDisplay: string | null; provider: string }
  | { ok: false; reason: string; message: string };

/** Valide le code postal, géocode, et valide le résultat. N'invente jamais de coordonnées. */
export async function resolveLocation(q: GeocodeQuery): Promise<ResolveOutcome> {
  const country = getCountry(q.countryCode);
  let postalDisplay: string | null = null;

  if (q.postalCode?.trim()) {
    const pc = normalizePostalCode(q.countryCode, q.postalCode);
    if (!pc.ok) return { ok: false, reason: "invalid_input", message: pc.reason };
    postalDisplay = pc.display;
  } else if (country && country.postalReliable && !q.city?.trim()) {
    return { ok: false, reason: "invalid_input", message: "Indiquez un code postal ou une ville." };
  }
  if (!q.postalCode?.trim() && !q.city?.trim()) {
    return { ok: false, reason: "invalid_input", message: "Indiquez un code postal ou une ville." };
  }

  const key = locationKey(q);
  let result = memo.get(key);
  if (!result) {
    result = await getGeocoder().geocode({ ...q, postalCode: postalDisplay ?? q.postalCode });
    // On ne mémorise que les succès et les « introuvable » (stables) ; pas les pannes temporaires.
    if (result.ok || result.reason === "not_found") {
      if (memo.size >= MAX_ENTRIES) memo.delete(memo.keys().next().value as string);
      memo.set(key, result);
    }
  }

  if (!result.ok) return { ok: false, reason: result.reason, message: result.message };
  return {
    ok: true,
    latitude: result.latitude,
    longitude: result.longitude,
    label: result.label,
    city: result.city,
    region: result.region,
    postalDisplay,
    provider: result.provider,
  };
}

/** Résout plusieurs lieux en dédupliquant les adresses identiques, avec une concurrence bornée. */
export async function resolveMany(queries: GeocodeQuery[]): Promise<Map<string, ResolveOutcome>> {
  const unique = new Map<string, GeocodeQuery>();
  for (const q of queries) unique.set(locationKey(q), q);
  const entries = [...unique.entries()];
  const results = await mapWithConcurrency(entries, APP_CONFIG.geocoding.concurrency, async ([, q]) => resolveLocation(q));
  const out = new Map<string, ResolveOutcome>();
  entries.forEach(([key], i) => {
    const r = results[i];
    if (r) out.set(key, r);
  });
  return out;
}

export function resetLocationCacheForTests() {
  memo.clear();
}
