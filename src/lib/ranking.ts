import type { AvailabilityStatus } from "@/lib/types";
import type { RouteEstimate } from "@/lib/routing/types";

export type SortKey = "default" | "straight_line" | "road_distance" | "travel_time" | "name";

export type Candidate = {
  id: string;
  fullName: string;
  availability: AvailabilityStatus;
  straightLineM: number | null;
  route?: RouteEstimate;
};

const okRoute = (c: Candidate) => (c.route && c.route.status === "ok" ? c.route : null);

/** Valeur triable, ou null si absente. Une valeur absente n'est JAMAIS traitée comme zéro. */
function value(c: Candidate, key: Exclude<SortKey, "default" | "name">): number | null {
  if (key === "straight_line") return c.straightLineM;
  const r = okRoute(c);
  if (!r) return null;
  return key === "road_distance" ? r.distanceM : r.durationS;
}

/** Compare deux nombres nullable : les valeurs absentes passent en dernier. */
function cmpNullable(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

const availabilityRank = (a: AvailabilityStatus) => (a === "available" ? 0 : a === "unknown" ? 1 : 2);

/**
 * Classement. Les filtres (disponibilité, compétences, rayon) sont appliqués en amont.
 * "default" : disponibles d'abord, puis durée de trajet réelle si connue, puis distance à vol d'oiseau.
 * Pas de score de « pertinence » opaque : l'ordre découle de critères affichés.
 */
export function rankCandidates<T extends Candidate>(items: readonly T[], sort: SortKey = "default"): T[] {
  const arr = [...items];
  arr.sort((a, b) => {
    switch (sort) {
      case "name":
        return a.fullName.localeCompare(b.fullName, "fr");
      case "straight_line":
      case "road_distance":
      case "travel_time": {
        const c = cmpNullable(value(a, sort), value(b, sort));
        return c !== 0 ? c : cmpNullable(a.straightLineM, b.straightLineM);
      }
      default: {
        const av = availabilityRank(a.availability) - availabilityRank(b.availability);
        if (av !== 0) return av;
        const t = cmpNullable(value(a, "travel_time"), value(b, "travel_time"));
        if (t !== 0) return t;
        return cmpNullable(a.straightLineM, b.straightLineM);
      }
    }
  });
  return arr;
}
