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

/** Code complet (« B11AA ») → « B1 1AA ». Un code partiel (secteur / district) est gardé tel quel. */
const spaceBeforeLast3 = (k: string) => (/\d[A-Z]{2}$/.test(k) && k.length > 4 ? `${k.slice(0, -3)} ${k.slice(-3)}` : k);
const UK_LIKE = /^[A-Z]{1,2}\d[A-Z\d]?(\d[A-Z]{2}|\d)?$/;

export const COUNTRIES: Record<string, CountryConfig> = {
  GB: {
    code: "GB", name: "Royaume-Uni", dialCode: "44",
    postalPattern: UK_LIKE, formatPostal: spaceBeforeLast3,
    distanceUnit: "mi", postalReliable: true,
  },
  IE: {
    code: "IE", name: "Irlande", dialCode: "353",
    postalPattern: /^[A-Z]\d{2}[A-Z\d]{4}$|^[A-Z]{3}[A-Z\d]{4}$/, formatPostal: (k) => (k.length === 7 ? `${k.slice(0, 3)} ${k.slice(3)}` : k),
    distanceUnit: "km", postalReliable: true,
  },
  IM: { code: "IM", name: "Île de Man", dialCode: "44", postalPattern: UK_LIKE, formatPostal: spaceBeforeLast3, distanceUnit: "mi", postalReliable: true },
  JE: { code: "JE", name: "Jersey", dialCode: "44", postalPattern: UK_LIKE, formatPostal: spaceBeforeLast3, distanceUnit: "mi", postalReliable: true },
  GG: { code: "GG", name: "Guernesey", dialCode: "44", postalPattern: UK_LIKE, formatPostal: spaceBeforeLast3, distanceUnit: "mi", postalReliable: true },
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

  AL: { code: "AL", name: "Albanie", dialCode: "355", postalPattern: /^\d{4}$/, distanceUnit: "km", postalReliable: true },
  AD: { code: "AD", name: "Andorre", dialCode: "376", postalPattern: /^AD\d{3}$/, distanceUnit: "km", postalReliable: true },
  AT: { code: "AT", name: "Autriche", dialCode: "43", postalPattern: /^\d{4}$/, distanceUnit: "km", postalReliable: true },
  BY: { code: "BY", name: "Biélorussie", dialCode: "375", postalPattern: /^\d{6}$/, distanceUnit: "km", postalReliable: true },
  BA: { code: "BA", name: "Bosnie-Herzégovine", dialCode: "387", postalPattern: /^\d{5}$/, distanceUnit: "km", postalReliable: true },
  BG: { code: "BG", name: "Bulgarie", dialCode: "359", postalPattern: /^\d{4}$/, distanceUnit: "km", postalReliable: true },
  HR: { code: "HR", name: "Croatie", dialCode: "385", postalPattern: /^\d{5}$/, distanceUnit: "km", postalReliable: true },
  CY: { code: "CY", name: "Chypre", dialCode: "357", postalPattern: /^\d{4}$/, distanceUnit: "km", postalReliable: true },
  CZ: { code: "CZ", name: "Tchéquie", dialCode: "420", postalPattern: /^\d{3} ?\d{2}$/, distanceUnit: "km", postalReliable: true },
  DK: { code: "DK", name: "Danemark", dialCode: "45", postalPattern: /^\d{4}$/, distanceUnit: "km", postalReliable: true },
  EE: { code: "EE", name: "Estonie", dialCode: "372", postalPattern: /^\d{5}$/, distanceUnit: "km", postalReliable: true },
  FI: { code: "FI", name: "Finlande", dialCode: "358", postalPattern: /^\d{5}$/, distanceUnit: "km", postalReliable: true },
  GR: { code: "GR", name: "Grèce", dialCode: "30", postalPattern: /^\d{5}$/, distanceUnit: "km", postalReliable: true },
  HU: { code: "HU", name: "Hongrie", dialCode: "36", postalPattern: /^\d{4}$/, distanceUnit: "km", postalReliable: true },
  IS: { code: "IS", name: "Islande", dialCode: "354", postalPattern: /^\d{3}$/, distanceUnit: "km", postalReliable: true },
  XK: { code: "XK", name: "Kosovo", dialCode: "383", postalPattern: /^\d{5}$/, distanceUnit: "km", postalReliable: true },
  LV: { code: "LV", name: "Lettonie", dialCode: "371", postalPattern: /^LV-?\d{4}$/, distanceUnit: "km", postalReliable: true },
  LI: { code: "LI", name: "Liechtenstein", dialCode: "423", postalPattern: /^\d{4}$/, distanceUnit: "km", postalReliable: true },
  LT: { code: "LT", name: "Lituanie", dialCode: "370", postalPattern: /^LT-?\d{5}$/, distanceUnit: "km", postalReliable: true },
  LU: { code: "LU", name: "Luxembourg", dialCode: "352", postalPattern: /^\d{4}$/, distanceUnit: "km", postalReliable: true },
  MT: { code: "MT", name: "Malte", dialCode: "356", postalPattern: /^[A-Z]{3} ?\d{4}$/, distanceUnit: "km", postalReliable: true },
  MD: { code: "MD", name: "Moldavie", dialCode: "373", postalPattern: /^MD-?\d{4}$/, distanceUnit: "km", postalReliable: true },
  MC: { code: "MC", name: "Monaco", dialCode: "377", postalPattern: /^980\d{2}$/, distanceUnit: "km", postalReliable: true },
  ME: { code: "ME", name: "Monténégro", dialCode: "382", postalPattern: /^\d{5}$/, distanceUnit: "km", postalReliable: true },
  NL: { code: "NL", name: "Pays-Bas", dialCode: "31", postalPattern: /^\d{4} ?[A-Z]{2}$/, distanceUnit: "km", postalReliable: true },
  MK: { code: "MK", name: "Macédoine du Nord", dialCode: "389", postalPattern: /^\d{4}$/, distanceUnit: "km", postalReliable: true },
  NO: { code: "NO", name: "Norvège", dialCode: "47", postalPattern: /^\d{4}$/, distanceUnit: "km", postalReliable: true },
  PL: { code: "PL", name: "Pologne", dialCode: "48", postalPattern: /^\d{2}-?\d{3}$/, distanceUnit: "km", postalReliable: true },
  PT: { code: "PT", name: "Portugal", dialCode: "351", postalPattern: /^\d{4}-?\d{3}$/, distanceUnit: "km", postalReliable: true },
  RO: { code: "RO", name: "Roumanie", dialCode: "40", postalPattern: /^\d{6}$/, distanceUnit: "km", postalReliable: true },
  RU: { code: "RU", name: "Russie", dialCode: "7", postalPattern: /^\d{6}$/, distanceUnit: "km", postalReliable: true },
  SM: { code: "SM", name: "Saint-Marin", dialCode: "378", postalPattern: /^4789\d$/, distanceUnit: "km", postalReliable: true },
  RS: { code: "RS", name: "Serbie", dialCode: "381", postalPattern: /^\d{5}$/, distanceUnit: "km", postalReliable: true },
  SK: { code: "SK", name: "Slovaquie", dialCode: "421", postalPattern: /^\d{3} ?\d{2}$/, distanceUnit: "km", postalReliable: true },
  SI: { code: "SI", name: "Slovénie", dialCode: "386", postalPattern: /^\d{4}$/, distanceUnit: "km", postalReliable: true },
  SE: { code: "SE", name: "Suède", dialCode: "46", postalPattern: /^\d{3} ?\d{2}$/, distanceUnit: "km", postalReliable: true },
  CH: { code: "CH", name: "Suisse", dialCode: "41", postalPattern: /^\d{4}$/, distanceUnit: "km", postalReliable: true },
  TR: { code: "TR", name: "Turquie", dialCode: "90", postalPattern: /^\d{5}$/, distanceUnit: "km", postalReliable: true },
  UA: { code: "UA", name: "Ukraine", dialCode: "380", postalPattern: /^\d{5}$/, distanceUnit: "km", postalReliable: true },
  VA: { code: "VA", name: "Vatican", dialCode: "379", postalPattern: null, distanceUnit: "km", postalReliable: false },
};

export const COUNTRY_LIST = Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name, "fr"));

export function getCountry(code: string | null | undefined): CountryConfig | undefined {
  return code ? COUNTRIES[code.toUpperCase()] : undefined;
}

export function countryName(code: string, locale: "fr" | "en" = "fr"): string {
  try { return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? getCountry(code)?.name ?? code; }
  catch { return getCountry(code)?.name ?? code; }
}


/** Drapeau emoji (secours) — l'interface utilise le composant <Flag/> (SVG), fiable sur Windows. */
export function countryFlag(code: string): string {
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "🌐";
  return String.fromCodePoint(...[...upper].map((letter) => 127397 + letter.charCodeAt(0)));
}


/* ───────── Options de pays pour les listes déroulantes (nations du Royaume-Uni + voisins) ───────── */
export type CountryOption = { id: string; code: string; nation: string | null; flag: string; dialCode: string; fr: string; en: string };

const NATIONS: { id: string; nation: string; flag: string; fr: string; en: string }[] = [
  { id: "GB-ENG", nation: "England", flag: "gb-eng", fr: "Angleterre", en: "England" },
  { id: "GB-SCT", nation: "Scotland", flag: "gb-sct", fr: "Écosse", en: "Scotland" },
  { id: "GB-WLS", nation: "Wales", flag: "gb-wls", fr: "Pays de Galles", en: "Wales" },
  { id: "GB-NIR", nation: "Northern Ireland", flag: "gb-nir", fr: "Irlande du Nord", en: "Northern Ireland" },
];

const PRIORITY = ["GB", "GB-ENG", "GB-SCT", "GB-WLS", "GB-NIR", "IE", "IM", "JE", "GG"];

function build(): CountryOption[] {
  const list: CountryOption[] = [];
  for (const c of COUNTRY_LIST) {
    list.push({ id: c.code, code: c.code, nation: null, flag: c.code.toLowerCase(), dialCode: c.dialCode, fr: countryName(c.code, "fr"), en: countryName(c.code, "en") });
  }
  for (const n of NATIONS) list.push({ id: n.id, code: "GB", nation: n.nation, flag: n.flag, dialCode: "44", fr: n.fr, en: n.en });
  const rank = (id: string) => { const i = PRIORITY.indexOf(id); return i === -1 ? 999 : i; };
  return list.sort((a, b) => rank(a.id) - rank(b.id) || a.en.localeCompare(b.en, "en"));
}
export const COUNTRY_OPTIONS: CountryOption[] = build();
const BY_ID = new Map(COUNTRY_OPTIONS.map((o) => [o.id, o]));

const NATION_BY_REGION: Record<string, string> = { england: "GB-ENG", scotland: "GB-SCT", wales: "GB-WLS", "northern ireland": "GB-NIR" };

/** Identifiant d'option à partir du code pays enregistré et de la région (Mapbox renvoie la nation pour le Royaume-Uni). */
export function optionIdFor(code: string | null | undefined, region?: string | null): string {
  const cc = (code ?? "").toUpperCase();
  if (cc === "GB" && region) return NATION_BY_REGION[region.trim().toLowerCase()] ?? "GB";
  return cc;
}
export const getCountryOption = (id: string | null | undefined): CountryOption | undefined => (id ? BY_ID.get(id.toUpperCase()) : undefined);
export const optionLabel = (id: string, locale: "fr" | "en") => { const o = getCountryOption(id); return o ? o[locale] : id; };
/** Classe flag-icons (ex. « gb-sct ») pour un pays + région. */
export const flagCodeFor = (code: string | null | undefined, region?: string | null) => getCountryOption(optionIdFor(code, region))?.flag ?? (code ?? "").toLowerCase();
