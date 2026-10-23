import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_CONFIG } from "@/config/app";
import { mapWithConcurrency, chunk } from "@/lib/concurrency";
import type { LatLon } from "@/lib/geo/haversine";
import type { TransportMode } from "@/lib/types";
import { cacheExpiry, isCacheFresh, routeCacheKey } from "./cache";
import { MapboxRoutingProvider } from "./mapbox";
import type { RouteEstimate, RoutingProvider } from "./types";

let provider: RoutingProvider | null = null;
export function getRoutingProvider(): RoutingProvider {
  provider ??= new MapboxRoutingProvider();
  return provider;
}

/** Modes réellement calculables avec la configuration actuelle (pour l'interface). */
export function getRoutingCapabilities() {
  const p = getRoutingProvider();
  return { provider: p.id, configured: p.isConfigured(), supportedModes: p.supportedModes() };
}

type CacheRow = {
  cache_key: string;
  distance_meters: number;
  duration_seconds: number;
  estimated_at: string;
  expires_at: string;
  provider: string;
  transport_mode: TransportMode;
};

export type OriginInput = { id: string } & LatLon;

/**
 * Estimations d'itinéraire pour plusieurs origines vers une destination.
 * - Les origines doivent venir de requêtes déjà soumises à la RLS (le client Supabase est celui du manager).
 * - Lecture du cache, puis appel fournisseur uniquement pour les manquants, par lots bornés.
 * - Seules les réponses réussies sont mises en cache.
 */
export async function getRouteEstimates(
  supabase: SupabaseClient,
  ownerId: string,
  origins: OriginInput[],
  destination: LatLon,
  mode: TransportMode,
  opts: { forceRefresh?: boolean } = {},
): Promise<Map<string, RouteEstimate>> {
  const p = getRoutingProvider();
  const out = new Map<string, RouteEstimate>();
  const bounded = origins.slice(0, APP_CONFIG.search.maxRouteCandidates);

  if (!p.supportedModes().includes(mode) || !p.isConfigured()) {
    const [first] = await p.estimateMany(bounded.slice(0, 1), destination, mode);
    for (const o of bounded) if (first) out.set(o.id, first);
    return out;
  }

  const keyOf = (o: OriginInput) => routeCacheKey(p.id, mode, o, destination);
  const keys = bounded.map(keyOf);

  const cached = new Map<string, CacheRow>();
  if (!opts.forceRefresh && keys.length > 0) {
    const { data } = await supabase
      .from("route_estimates")
      .select("cache_key, distance_meters, duration_seconds, estimated_at, expires_at, provider, transport_mode")
      .eq("owner_id", ownerId)
      .eq("transport_mode", mode)
      .in("cache_key", keys);
    for (const row of (data ?? []) as CacheRow[]) {
      if (row.transport_mode === mode && isCacheFresh(row.expires_at)) cached.set(row.cache_key, row);
    }
  }

  const missing: OriginInput[] = [];
  for (const o of bounded) {
    const row = cached.get(keyOf(o));
    if (row) {
      out.set(o.id, {
        status: "ok", mode, provider: row.provider,
        distanceM: row.distance_meters, durationS: row.duration_seconds,
        estimatedAt: row.estimated_at, source: "cache",
      });
    } else {
      missing.push(o);
    }
  }

  // Lots de 24 origines (une requête Matrix chacun), avec concurrence bornée.
  const batches = chunk(missing, 24);
  const batchResults = await mapWithConcurrency(batches, APP_CONFIG.search.routeConcurrency, (batch) =>
    p.estimateMany(batch, destination, mode),
  );

  const toCache: Record<string, unknown>[] = [];
  const expires = cacheExpiry(APP_CONFIG.routing.cacheTtlSeconds);
  batches.forEach((batch, bi) => {
    batch.forEach((o, oi) => {
      const est = batchResults[bi]?.[oi];
      if (!est) return;
      out.set(o.id, est);
      if (est.status === "ok") {
        toCache.push({
          owner_id: ownerId,
          cache_key: keyOf(o),
          origin_latitude: o.latitude, origin_longitude: o.longitude,
          destination_latitude: destination.latitude, destination_longitude: destination.longitude,
          transport_mode: mode, provider: est.provider,
          distance_meters: est.distanceM, duration_seconds: est.durationS,
          estimated_at: est.estimatedAt, expires_at: expires,
        });
      }
    });
  });

  if (toCache.length > 0) {
    // Échec d'écriture du cache : non bloquant, les estimations restent valides.
    await supabase.from("route_estimates").upsert(toCache, { onConflict: "owner_id,cache_key" });
  }
  return out;
}
