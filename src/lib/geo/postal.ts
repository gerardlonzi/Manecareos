import { getCountry } from "@/config/countries";

/** full = code complet ; sector = secteur (« B1 1 ») ; outward = partie sortante seule (« B1 », « SW1A »). */
export type PostalPrecision = "full" | "sector" | "outward";

export type PostalResult =
  | { ok: true; display: string; key: string; strict: boolean; precision: PostalPrecision }
  | { ok: false; reason: string };

/** Clé de comparaison : majuscules, sans espaces ni tirets. */
export function postalKey(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-.]/g, "");
}

/** Formes partielles de code postal britannique que Mapbox peut renvoyer. */
const GB_OUTWARD = /^[A-Z]{1,2}\d[A-Z\d]?$/;
const GB_SECTOR_INPUT = /^([A-Z]{1,2}\d[A-Z\d]?)[\s\-.]+(\d)$/;

/**
 * Normalise un code postal selon le pays.
 * strict=true  : le format du pays a été vérifié.
 * strict=false : pays sans format connu, seule une validation souple a été faite.
 */
export function normalizePostalCode(countryCode: string, raw: string | null | undefined): PostalResult {
  const input = (raw ?? "").trim();
  if (!input) return { ok: false, reason: "Code postal vide" };
  if (input.length > 16) return { ok: false, reason: "Code postal trop long" };
  const key = postalKey(input);
  if (!/^[A-Z0-9]+$/.test(key)) return { ok: false, reason: "Caractères non autorisés dans le code postal" };

  const country = getCountry(countryCode);
  if (!country || !country.postalPattern) {
    return { ok: true, display: key, key, strict: false, precision: "full" };
  }
  if (country.code === "GB") {
    const sectorFirst = GB_SECTOR_INPUT.exec(input.toUpperCase());
    if (sectorFirst) return { ok: true, display: `${sectorFirst[1]} ${sectorFirst[2]}`, key, strict: true, precision: "sector" };
  }
  if (!country.postalPattern.test(key)) {
    if (country.code === "GB") {
      // Mapbox peut renvoyer un secteur (« B1 1 ») ou une partie sortante (« B1 », « SW1A ») : on les accepte, sans les faire passer pour complets.
      const sector = GB_SECTOR_INPUT.exec(input.toUpperCase());
      if (sector) return { ok: true, display: `${sector[1]} ${sector[2]}`, key, strict: true, precision: "sector" };
      if (GB_OUTWARD.test(key)) return { ok: true, display: key, key, strict: true, precision: "outward" };
    }
    return { ok: false, reason: `Format de code postal invalide pour ${country.name}` };
  }
  const gbLike = ["GB", "IM", "JE", "GG"].includes(country.code);
  const precision = gbLike && !/\d[A-Z]{2}$/.test(key) ? "outward" : "full";
  return { ok: true, display: country.formatPostal ? country.formatPostal(key) : key, key, strict: true, precision };
}
