import type { LatLon } from "@/lib/geo/haversine";
import type { TransportMode } from "@/lib/types";

/** Arrondi à 5 décimales (~1 m) pour que de minuscules écarts ne cassent pas le cache. */
const r5 = (n: number) => n.toFixed(5);

/**
 * Clé déterministe : le mode et le fournisseur en font partie, donc une estimation en voiture
 * n'est jamais réutilisée pour la marche, le vélo ou les transports en commun.
 */
export function routeCacheKey(provider: string, mode: TransportMode, origin: LatLon, destination: LatLon): string {
  return `${provider}|${mode}|${r5(origin.latitude)},${r5(origin.longitude)}>${r5(destination.latitude)},${r5(destination.longitude)}`;
}

export function isCacheFresh(expiresAt: string | Date, now: Date = new Date()): boolean {
  const t = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);
  return Number.isFinite(t) && t > now.getTime();
}

export function cacheExpiry(ttlSeconds: number, now: Date = new Date()): string {
  return new Date(now.getTime() + ttlSeconds * 1000).toISOString();
}
