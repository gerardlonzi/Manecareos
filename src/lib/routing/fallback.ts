import { APP_CONFIG } from "@/config/app";
import type { TransportMode } from "@/lib/types";
import type { RouteEstimate } from "./types";

/**
 * Repli à vitesse moyenne. À n'utiliser que si le manager l'a explicitement autorisé.
 * - Pas de repli pour les transports en commun (aucune vitesse moyenne défendable).
 * - Sans distance routière réelle, le calcul part de la distance à vol d'oiseau : c'est une
 *   approximation grossière (basis = "straight_line"), pas une estimation d'arrivée fiable.
 */
export function approximateEstimate(
  mode: TransportMode,
  input: { straightLineM: number | null; roadDistanceM?: number | null },
  now: Date = new Date(),
): Extract<RouteEstimate, { status: "approximate" }> | null {
  const speedKmh = APP_CONFIG.routing.fallbackSpeedsKmh[mode];
  if (!speedKmh) return null;
  const hasRoad = typeof input.roadDistanceM === "number" && Number.isFinite(input.roadDistanceM);
  const distanceM = hasRoad ? (input.roadDistanceM as number) : input.straightLineM;
  if (distanceM === null || !Number.isFinite(distanceM) || distanceM < 0) return null;
  return {
    status: "approximate",
    mode,
    basis: hasRoad ? "road_distance" : "straight_line",
    distanceM,
    durationS: (distanceM / 1000 / speedKmh) * 3600,
    estimatedAt: now.toISOString(),
  };
}
