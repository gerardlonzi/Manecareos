import { describe, expect, it } from "vitest";
import { filterByRadius, haversineMeters, isValidCoordinate } from "./haversine";
import { formatDistance, formatDuration } from "./format";
import { normalizePostalCode } from "./postal";

describe("isValidCoordinate", () => {
  it("accepte des coordonnées valides", () => expect(isValidCoordinate(51.5, -0.12)).toBe(true));
  it("refuse hors bornes, NaN, non numériques et (0,0)", () => {
    expect(isValidCoordinate(91, 0)).toBe(false);
    expect(isValidCoordinate(0, 181)).toBe(false);
    expect(isValidCoordinate(Number.NaN, 2)).toBe(false);
    expect(isValidCoordinate("51" as unknown, 2)).toBe(false);
    expect(isValidCoordinate(0, 0)).toBe(false);
  });
});

describe("haversineMeters", () => {
  const london = { latitude: 51.5074, longitude: -0.1278 };
  const paris = { latitude: 48.8566, longitude: 2.3522 };
  it("Londres–Paris ≈ 343 km", () => {
    const d = haversineMeters(london, paris) as number;
    expect(d).toBeGreaterThan(340_000);
    expect(d).toBeLessThan(346_000);
  });
  it("distance nulle pour le même point", () => expect(haversineMeters(london, london)).toBe(0));
  it("est symétrique", () => expect(haversineMeters(london, paris)).toBeCloseTo(haversineMeters(paris, london) as number, 6));
  it("renvoie null si une coordonnée est invalide", () => {
    expect(haversineMeters(london, { latitude: 200, longitude: 0 })).toBeNull();
  });
  it("1 degré de latitude ≈ 111,2 km", () => {
    const d = haversineMeters({ latitude: 10, longitude: 20 }, { latitude: 11, longitude: 20 }) as number;
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });
});

describe("filterByRadius", () => {
  const center = { latitude: 51.5, longitude: -0.1 };
  const pts = [
    { id: "far", latitude: 52.5, longitude: -0.1 },
    { id: "near", latitude: 51.51, longitude: -0.1 },
    { id: "mid", latitude: 51.55, longitude: -0.1 },
    { id: "bad", latitude: 999, longitude: 0 },
  ];
  it("filtre par rayon, trie par distance et exclut les points invalides", () => {
    const res = filterByRadius(pts, center, 10_000);
    expect(res.map((r) => r.id)).toEqual(["near", "mid"]);
    expect(res[0]?.straightLineM).toBeLessThan(res[1]?.straightLineM ?? 0);
  });
  it("rayon plus grand = plus de résultats", () => expect(filterByRadius(pts, center, 200_000)).toHaveLength(3));
});

describe("formatDistance", () => {
  it("mètres arrondis à 10 m sous 1 km", () => expect(formatDistance(847)).toBe("850 m"));
  it("kilomètres avec une décimale", () => expect(formatDistance(2412)).toBe("2,4 km"));
  it("sans décimale à partir de 100 km", () => expect(formatDistance(250_400)).toBe("250 km"));
  it("miles", () => expect(formatDistance(16_093.44, "mi")).toBe("10,0 mi"));
  it("valeurs absentes ou invalides", () => {
    expect(formatDistance(null)).toBe("—");
    expect(formatDistance(Number.NaN)).toBe("—");
    expect(formatDistance(-5)).toBe("—");
  });
});

describe("formatDuration", () => {
  it("formate minutes et heures", () => {
    expect(formatDuration(30)).toBe("< 1 min");
    expect(formatDuration(25 * 60)).toBe("25 min");
    expect(formatDuration(3600)).toBe("1 h");
    expect(formatDuration(3600 + 5 * 60)).toBe("1 h 05");
    expect(formatDuration(null)).toBe("—");
  });
});

describe("normalizePostalCode", () => {
  it("code postal UK : majuscules et espace canonique", () => {
    expect(normalizePostalCode("GB", "sw1a1aa")).toEqual({ ok: true, display: "SW1A 1AA", key: "SW1A1AA", strict: true });
    expect(normalizePostalCode("GB", " m1 1ae ")).toMatchObject({ ok: true, display: "M1 1AE" });
  });
  it("refuse un code UK invalide", () => expect(normalizePostalCode("GB", "12345").ok).toBe(false));
  it("France : 5 chiffres", () => {
    expect(normalizePostalCode("FR", "75001")).toMatchObject({ ok: true, display: "75001" });
    expect(normalizePostalCode("FR", "7500").ok).toBe(false);
  });
  it("pays sans format strict : validation souple", () => {
    expect(normalizePostalCode("CM", "bp 123")).toMatchObject({ ok: true, strict: false });
  });
  it("refuse vide, trop long et caractères spéciaux", () => {
    expect(normalizePostalCode("GB", "").ok).toBe(false);
    expect(normalizePostalCode("GB", "A".repeat(20)).ok).toBe(false);
    expect(normalizePostalCode("CM", "<script>").ok).toBe(false);
  });
});
