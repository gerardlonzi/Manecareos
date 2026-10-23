import { getCountry } from "@/config/countries";

export type PostalResult =
  | { ok: true; display: string; key: string; strict: boolean }
  | { ok: false; reason: string };

/** Clé de comparaison : majuscules, sans espaces ni tirets. */
export function postalKey(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-.]/g, "");
}

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
    return { ok: true, display: key, key, strict: false };
  }
  if (!country.postalPattern.test(key)) {
    return { ok: false, reason: `Format de code postal invalide pour ${country.name}` };
  }
  return { ok: true, display: country.formatPostal ? country.formatPostal(key) : key, key, strict: true };
}
