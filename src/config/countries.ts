/**
 * Règles propres à chaque pays : code postal, indicatif téléphonique, unité de distance.
 * Pour un pays absent de la liste, la saisie reste possible (validation souple).
 */
export type CountryConfig = {
  code: string;
  name: string;
  dialCode: string;
  /** Regex appliquée à la clé normalisée (majuscules, sans espaces). null = pas de format strict. */
  postalPattern: RegExp | null;
  /** Met en forme l'affichage canonique à partir de la clé normalisée. */
  formatPostal?: (key: string) => string;
  distanceUnit: "km" | "mi";
  /** Les codes postaux ne sont pas fiables / inexistants : on géocode alors par ville. */
  postalReliable: boolean;
};

const spaceBeforeLast3 = (k: string) => (k.length > 3 ? `${k.slice(0, -3)} ${k.slice(-3)}` : k);

export const COUNTRIES: Record<string, CountryConfig> = {
  GB: {
    code: "GB", name: "Royaume-Uni", dialCode: "44",
    postalPattern: /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/, formatPostal: spaceBeforeLast3,
    distanceUnit: "mi", postalReliable: true,
  },
  IE: {
    code: "IE", name: "Irlande", dialCode: "353",
    postalPattern: /^[A-Z]\d{2}[A-Z\d]{4}$|^[A-Z]{3}[A-Z\d]{4}$/, formatPostal: (k) => (k.length === 7 ? `${k.slice(0, 3)} ${k.slice(3)}` : k),
    distanceUnit: "km", postalReliable: true,
  },
  FR: { code: "FR", name: "France", dialCode: "33", postalPattern: /^\d{5}$/, distanceUnit: "km", postalReliable: true },
  DE: { code: "DE", name: "Allemagne", dialCode: "49", postalPattern: /^\d{5}$/, distanceUnit: "km", postalReliable: true },
  ES: { code: "ES", name: "Espagne", dialCode: "34", postalPattern: /^\d{5}$/, distanceUnit: "km", postalReliable: true },
  IT: { code: "IT", name: "Italie", dialCode: "39", postalPattern: /^\d{5}$/, distanceUnit: "km", postalReliable: true },
  BE: { code: "BE", name: "Belgique", dialCode: "32", postalPattern: /^\d{4}$/, distanceUnit: "km", postalReliable: true },
  US: {
    code: "US", name: "États-Unis", dialCode: "1",
    postalPattern: /^\d{5}(\d{4})?$/, formatPostal: (k) => (k.length === 9 ? `${k.slice(0, 5)}-${k.slice(5)}` : k),
    distanceUnit: "mi", postalReliable: true,
  },
  CA: {
    code: "CA", name: "Canada", dialCode: "1",
    postalPattern: /^[A-Z]\d[A-Z]\d[A-Z]\d$/, formatPostal: (k) => (k.length === 6 ? `${k.slice(0, 3)} ${k.slice(3)}` : k),
    distanceUnit: "km", postalReliable: true,
  },
  CM: { code: "CM", name: "Cameroun", dialCode: "237", postalPattern: null, distanceUnit: "km", postalReliable: false },
  NG: { code: "NG", name: "Nigéria", dialCode: "234", postalPattern: /^\d{6}$/, distanceUnit: "km", postalReliable: false },
  SN: { code: "SN", name: "Sénégal", dialCode: "221", postalPattern: null, distanceUnit: "km", postalReliable: false },
  CI: { code: "CI", name: "Côte d'Ivoire", dialCode: "225", postalPattern: null, distanceUnit: "km", postalReliable: false },
};

export const COUNTRY_LIST = Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name, "fr"));

export function getCountry(code: string | null | undefined): CountryConfig | undefined {
  return code ? COUNTRIES[code.toUpperCase()] : undefined;
}
