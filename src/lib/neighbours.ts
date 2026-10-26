export type NeighbourCandidate = { id: string; city: string | null; region: string | null; straightLineM: number };

export type TownGroup<T> = { town: string; region: string | null; items: T[]; minDistanceM: number };

export type TownGrouping<T> = { sameTown: T[]; towns: TownGroup<T>[] };

export const UNKNOWN_TOWN = "Unknown";

const townKey = (city: string | null | undefined) => (city ?? "").trim().toLowerCase();
const byDistance = (a: { straightLineM: number }, b: { straightLineM: number }) => a.straightLineM - b.straightLineM;

/**
 * Regroupe des candidats par ville (clé = ville nettoyée, en minuscules), triés par distance.
 * - sameTown : candidats de la ville d'origine (originCity) et/ou à moins de sameTownRadiusM de la cible.
 * - towns : les autres, par ville, la plus proche d'abord ; les villes inconnues (city vide) en dernier sous « Unknown ».
 * Fonction pure : ne modifie pas l'entrée.
 */
export function groupByTown<T extends NeighbourCandidate>(
  candidates: readonly T[],
  opts: { originCity?: string | null; sameTownRadiusM?: number } = {},
): TownGrouping<T> {
  const originKey = townKey(opts.originCity);
  const radius = typeof opts.sameTownRadiusM === "number" && Number.isFinite(opts.sameTownRadiusM) ? opts.sameTownRadiusM : null;

  const sameTown: T[] = [];
  const groups = new Map<string, { display: string; region: string | null; items: T[] }>();

  for (const c of [...candidates].sort(byDistance)) {
    const key = townKey(c.city);
    const isSame = (originKey !== "" && key === originKey) || (radius !== null && c.straightLineM <= radius);
    if (isSame) {
      sameTown.push(c);
      continue;
    }
    const g = groups.get(key);
    if (g) {
      g.items.push(c);
      if (g.region === null && c.region?.trim()) g.region = c.region.trim();
    } else {
      groups.set(key, {
        display: key === "" ? UNKNOWN_TOWN : (c.city as string).trim(),
        region: c.region?.trim() || null,
        items: [c],
      });
    }
  }

  const towns: (TownGroup<T> & { unknown: boolean })[] = [...groups.entries()].map(([key, g]) => ({
    town: g.display,
    region: g.region,
    items: g.items, // déjà triés par distance
    minDistanceM: g.items[0]?.straightLineM ?? 0,
    unknown: key === "",
  }));
  towns.sort((a, b) => Number(a.unknown) - Number(b.unknown) || a.minDistanceM - b.minDistanceM || a.town.localeCompare(b.town));

  return { sameTown, towns: towns.map(({ unknown: _unknown, ...t }) => t) };
}
