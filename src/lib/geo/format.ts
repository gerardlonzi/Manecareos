export type DistanceUnit = "km" | "mi";

const M_PER_MILE = 1609.344;

/** Formate une distance sans fausse précision. Retourne "—" si la valeur est absente ou invalide. */
export function formatDistance(meters: number | null | undefined, unit: DistanceUnit = "km"): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters) || meters < 0) return "—";
  if (unit === "mi") {
    const miles = meters / M_PER_MILE;
    if (miles < 0.1) return "< 0,1 mi";
    return `${(miles < 100 ? miles.toFixed(1) : Math.round(miles).toString()).replace(".", ",")} mi`;
  }
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return `${(km < 100 ? km.toFixed(1) : Math.round(km).toString()).replace(".", ",")} km`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return "< 1 min";
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export function kmToMeters(km: number): number {
  return km * 1000;
}
