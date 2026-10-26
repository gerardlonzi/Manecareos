import { getCountry } from "@/config/countries";

export type PhoneResult = { ok: true; e164: string } | { ok: false; reason: string };

/**
 * Normalise un numéro au format E.164 (+<indicatif><numéro>).
 * Sans « + », le numéro est supposé national du pays donné ; un 0 initial (préfixe national) est retiré.
 */
export function normalizePhone(raw: string | null | undefined, countryCode: string): PhoneResult {
  const input = (raw ?? "").trim();
  if (!input) return { ok: false, reason: "Numéro vide" };
  if (/[^\d+\s().\-]/.test(input)) return { ok: false, reason: "Caractères non autorisés dans le numéro" };

  let digits = input.replace(/\D/g, "");
  const hasPlus = input.startsWith("+");
  const dial = getCountry(countryCode)?.dialCode;

  if (hasPlus) {
    // Format international explicite
  } else if (input.startsWith("00")) {
    digits = digits.slice(2);
  } else if (dial) {
    if (digits.startsWith(dial) && digits.length >= dial.length + 8) {
      // L'indicatif est déjà présent sans « + »
    } else {
      digits = dial + digits.replace(/^0/, "");
    }
  } else {
    return { ok: false, reason: "Indicatif pays inconnu : utilisez le format international (+...)" };
  }

  if (digits.length < 8 || digits.length > 15) return { ok: false, reason: "Longueur de numéro invalide" };
  return { ok: true, e164: `+${digits}` };
}

export function telHref(e164: string): string {
  return `tel:${e164}`;
}

/** wa.me attend les chiffres seuls, sans « + ». */
export function whatsappHref(e164: string): string {
  return `https://wa.me/${e164.replace(/\D/g, "")}`;
}
