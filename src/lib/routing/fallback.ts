import { APP_CONFIG } from "@/config/app";
import type { TransportMode } from "@/lib/types";
import type { RouteEstimate } from "./types";

/** Modes sans fournisseur d'itinéraires : uniquement des estimations approximatives. */
export const ESTIMATE_ONLY_MODES: TransportMode[] = ["public_transport"];
export const isEstimateOnlyMode = (mode: TransportMode) => ESTIMATE_ONLY_MODES.includes(mode);

export const TRAIN_ESTIMATE_NOTE = "Estimation approximative (vitesse moyenne supposée), pas un horaire de train.";

/**
 * Estimation « train » : distance à vol d'oiseau × facteur de détour ferroviaire, vitesse moyenne supposée,
 * plus un temps fixe d'attente/embarquement. C'est une estimation, jamais un horaire.
 */
export function trainEstimate(straightLineM: number | null, now: Date = new Date()): Extract<RouteEstimate, { status: "approximate" }> | null {
  if (straightLineM === null || !Number.isFinite(straightLineM) || straightLineM < 0) return null;
  const { trainDetourFactor, trainSpeedKmh, trainOverheadMinutes } = APP_CONFIG.routing;
  const distanceM = straightLineM * trainDetourFactor;
  return {
    status: "approximate",
    mode: "public_transport",
    basis: "straight_line",
    kind: "train_estimate",
    note: TRAIN_ESTIMATE_NOTE,
    distanceM,
    durationS: (distanceM / 1000 / trainSpeedKmh) * 3600 + trainOverheadMinutes * 60,
    estimatedAt: now.toISOString(),
  };
}

/**
 * Repli à vitesse moyenne. Toujours étiqueté « approximate », jamais présenté comme un itinéraire réel.
 * - Voiture / marche / vélo : seulement si le manager l'a explicitement autorisé (décision de l'appelant).
 * - Transports en commun : estimation « train » (voir trainEstimate), sans horaire.
 * - Sans distance routière réelle, le calcul part de la distance à vol d'oiseau (basis = "straight_line").
 */
export function approximateEstimate(
  mode: TransportMode,
  input: { straightLineM: number | null; roadDistanceM?: number | null },
  now: Date = new Date(),
): Extract<RouteEstimate, { status: "approximate" }> | null {
  if (isEstimateOnlyMode(mode)) return trainEstimate(input.straightLineM, now);
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
