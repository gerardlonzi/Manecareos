export type LatLon = { latitude: number; longitude: number };

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function isValidCoordinate(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === "number" && typeof lon === "number" &&
    Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
    // (0,0) est presque toujours une valeur par défaut erronée, pas un lieu réel.
    !(lat === 0 && lon === 0)
  );
}

/** Distance à vol d'oiseau en mètres, ou null si une coordonnée est invalide. */
export function haversineMeters(a: LatLon, b: LatLon): number | null {
  if (!isValidCoordinate(a.latitude, a.longitude) || !isValidCoordinate(b.latitude, b.longitude)) return null;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type WithDistance<T> = T & { straightLineM: number };

/** Filtre par rayon et trie par distance à vol d'oiseau. Les points invalides sont exclus. */
export function filterByRadius<T extends LatLon>(
  items: readonly T[],
  center: LatLon,
  radiusM: number,
): WithDistance<T>[] {
  const out: WithDistance<T>[] = [];
  for (const item of items) {
    const d = haversineMeters(center, item);
    if (d !== null && d <= radiusM) out.push({ ...item, straightLineM: d });
  }
  return out.sort((x, y) => x.straightLineM - y.straightLineM);
}
