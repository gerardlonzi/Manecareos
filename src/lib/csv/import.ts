import Papa from "papaparse";
import { z } from "zod";
import { APP_CONFIG } from "@/config/app";
import { COUNTRY_OPTIONS, getCountry } from "@/config/countries";
import { resolveSkillToken } from "@/config/skills";
import { normalizePostalCode } from "@/lib/geo/postal";
import { normalizePhone } from "@/lib/phone";
import type { AvailabilityStatus } from "@/lib/types";
import { toCsv } from "./export";

export const CSV_FIELDS = [
  "full_name", "staff_code", "phone", "email", "country_code",
  "postal_code", "city", "region", "skills", "availability", "notes", "weekly_hours",
] as const;
export type CsvField = (typeof CSV_FIELDS)[number];

/** Synonymes d'en-têtes acceptés (FR/EN). */
const HEADER_ALIASES: Record<string, CsvField> = {
  full_name: "full_name", name: "full_name", nom: "full_name", "nom complet": "full_name", fullname: "full_name",
  staff_code: "staff_code", code: "staff_code", matricule: "staff_code", staffcode: "staff_code",
  phone: "phone", telephone: "phone", "téléphone": "phone", tel: "phone", mobile: "phone",
  email: "email", mail: "email", "e-mail": "email",
  country_code: "country_code", country: "country_code", pays: "country_code",
  postal_code: "postal_code", postcode: "postal_code", zip: "postal_code", "code postal": "postal_code", cp: "postal_code",
  city: "city", ville: "city", town: "city",
  region: "region", "région": "region", county: "region",
  skills: "skills", competences: "skills", "compétences": "skills",
  availability: "availability", disponibilite: "availability", "disponibilité": "availability",
  notes: "notes", note: "notes", commentaire: "notes",
  weekly_hours: "weekly_hours", hours: "weekly_hours", "weekly hours": "weekly_hours", "heures par semaine": "weekly_hours", heures: "weekly_hours",
};

export function normalizeHeader(h: string): CsvField | null {
  const k = h.replace(/^﻿/, "").trim().toLowerCase().replace(/[\s-]+/g, " ");
  return HEADER_ALIASES[k] ?? HEADER_ALIASES[k.replace(/ /g, "_")] ?? null;
}

/** Annule l'apostrophe ajoutée à l'export pour neutraliser les formules, pour un aller-retour fidèle. */
function unescapeFormulaPrefix(v: string): string {
  return /^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v;
}

const AVAILABILITY_MAP: Record<string, AvailabilityStatus> = {
  available: "available", disponible: "available", yes: "available", oui: "available", true: "available", "1": "available",
  unavailable: "unavailable", indisponible: "unavailable", no: "unavailable", non: "unavailable", false: "unavailable", "0": "unavailable",
  unknown: "unknown", inconnu: "unknown", inconnue: "unknown", "": "unknown",
};

/** « SW / HCA », « support worker; nurse » → identifiants canoniques (SW → support worker, HCA → healthcare assistant). */
export function parseSkills(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (t: string) => {
    const clean = t.trim();
    if (!clean || clean.length > 60) return;
    const id = resolveSkillToken(clean) ?? clean;
    const k = id.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(id); }
  };
  for (const part of raw.split(/[;|,]/)) {
    // « driver / own transport » est une compétence du catalogue : on la reconnaît avant de séparer sur « / ».
    if (resolveSkillToken(part)) push(part);
    else for (const sub of part.split(/[/+&]/)) push(sub);
  }
  return out.slice(0, 30);
}

/** « 20hours », « 20 h », « Full Time » (= 37,5 h), « 37.5 » → heures par semaine. */
export const FULL_TIME_HOURS = 37.5;
export function parseWeeklyHours(raw: string): number | null | "invalid" {
  const v = raw.trim().toLowerCase().replace(",", ".");
  if (!v) return null;
  if (/^(full[\s-]?time|temps plein|ft)$/.test(v)) return FULL_TIME_HOURS;
  const m = v.match(/^(\d{1,3}(?:\.\d{1,2})?)\s*(h|hr|hrs|hour|hours|heures?)?(\s*(\/|per|par)\s*(week|wk|semaine))?$/);
  if (!m) return "invalid";
  const n = Number(m[1]);
  return n >= 0 && n <= 168 ? n : "invalid";
}

/** « England », « Royaume-Uni », « GB » → code pays (+ nation britannique éventuelle). */
export function resolveCountry(raw: string): { code: string; nation: string | null } | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^[A-Za-z]{2}$/.test(v)) return { code: v.toUpperCase(), nation: null };
  const k = v.toLowerCase();
  if (["uk", "united kingdom", "royaume-uni", "royaume uni", "great britain"].includes(k)) return { code: "GB", nation: null };
  const o = COUNTRY_OPTIONS.find((c) => c.fr.toLowerCase() === k || c.en.toLowerCase() === k || c.nation?.toLowerCase() === k);
  return o ? { code: o.code, nation: o.nation } : null;
}

export type ParsedStaffRow = {
  rowNumber: number; // numéro de ligne dans le fichier (en-tête = 1)
  full_name: string;
  staff_code: string | null;
  phone: string | null;
  email: string | null;
  country_code: string;
  postal_code: string | null;
  postal_code_normalized: string | null;
  city: string | null;
  region: string | null;
  skills: string[];
  /** null = colonne vide : à la mise à jour, la valeur existante est conservée. */
  availability_status: AvailabilityStatus | null;
  notes: string | null;
  weekly_hours: number | null;
  /** « create » : nouvelle fiche ; « update » : fiche existante (même code ou même e-mail) mise à jour. */
  action: "create" | "update";
};

export type RowIssue = { rowNumber: number; field: string; message: string; raw?: string };

export type ImportParseResult = {
  headers: { original: string; mapped: CsvField | null }[];
  missingRequired: string[];
  rows: ParsedStaffRow[];
  issues: RowIssue[];
  warnings: RowIssue[];
  skippedEmpty: number;
  totalRows: number;
  truncated: boolean;
};

const emailSchema = z.email();

export function parseStaffCsv(
  text: string,
  opts: { defaultCountry?: string; existingCodes?: Iterable<string>; existingEmails?: Iterable<string> } = {},
): ImportParseResult {
  const defaultCountry = (opts.defaultCountry ?? APP_CONFIG.defaultCountry).toUpperCase();
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const originalHeaders = parsed.meta.fields ?? [];
  const headerMap = originalHeaders.map((original) => ({ original, mapped: normalizeHeader(original) }));
  const mappedFields = new Set(headerMap.map((h) => h.mapped));
  const missingRequired: string[] = [];
  if (!mappedFields.has("full_name")) missingRequired.push("full_name");

  const issues: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  let skippedEmpty = 0;
  if (missingRequired.length > 0) {
    return { headers: headerMap, missingRequired, rows: [], issues, warnings, skippedEmpty, totalRows: parsed.data.length, truncated: false };
  }

  const seenCodes = new Map<string, number>();
  const seenEmails = new Map<string, number>();
  const existingCodes = new Set([...(opts.existingCodes ?? [])].map((c) => c.toLowerCase()));
  const existingEmails = new Set([...(opts.existingEmails ?? [])].map((c) => c.toLowerCase()));

  const truncated = parsed.data.length > APP_CONFIG.import.maxRows;
  const dataRows = parsed.data.slice(0, APP_CONFIG.import.maxRows);
  const rows: ParsedStaffRow[] = [];

  dataRows.forEach((record, idx) => {
    const rowNumber = idx + 2;
    const get = (field: CsvField): string => {
      const h = headerMap.find((x) => x.mapped === field);
      return h ? unescapeFormulaPrefix((record[h.original] ?? "").trim()) : "";
    };
    const before = issues.length;
    const bad = (field: string, message: string, raw?: string) => issues.push({ rowNumber, field, message, raw });
    const warn = (field: string, message: string, raw?: string) => warnings.push({ rowNumber, field, message, raw });

    // Ligne « fantôme » (ni nom, ni code, ni contact, ni adresse) : ignorée sans erreur (cellule résiduelle, formule orpheline…).
    if (!get("full_name") && !get("staff_code") && !get("phone") && !get("email") && !get("postal_code") && !get("city")) { skippedEmpty++; return; }

    const fullName = get("full_name");
    if (!fullName) bad("full_name", "Nom complet obligatoire");
    else if (fullName.length > 200) bad("full_name", "Nom trop long (200 caractères max)");

    let country = defaultCountry;
    let nation: string | null = null;
    const rawCountry = get("country_code");
    if (rawCountry) {
      const rc = resolveCountry(rawCountry);
      if (rc) { country = rc.code; nation = rc.nation; }
      else bad("country_code", "Pays non reconnu (ex. England, Wales, GB, FR)", rawCountry);
    }

    const rawPostal = get("postal_code");
    let postalDisplay: string | null = null;
    let postalKey: string | null = null;
    if (rawPostal) {
      const pc = normalizePostalCode(country, rawPostal);
      if (pc.ok) {
        postalDisplay = pc.display;
        postalKey = pc.key;
      } else bad("postal_code", pc.reason, rawPostal);
    }

    const rawEmail = get("email");
    let email: string | null = null;
    if (rawEmail) {
      if (emailSchema.safeParse(rawEmail).success) email = rawEmail.toLowerCase();
      else warn("email", "Adresse e-mail invalide : ignorée (la fiche est importée sans e-mail)", rawEmail);
    }

    const rawPhone = get("phone");
    let phone: string | null = null;
    if (rawPhone) {
      const p = normalizePhone(rawPhone, country);
      if (p.ok) phone = p.e164;
      else bad("phone", p.reason, rawPhone);
    }

    const rawAvail = get("availability").toLowerCase();
    const availability = rawAvail === "" ? null : AVAILABILITY_MAP[rawAvail];
    if (availability === undefined) bad("availability", "Valeur inconnue (available, unavailable, unknown)", rawAvail);

    const code = get("staff_code") || null;
    let action: "create" | "update" = "create";
    if (code) {
      const k = code.toLowerCase();
      const firstSeen = seenCodes.get(k);
      if (firstSeen !== undefined) bad("staff_code", `Doublon dans le fichier (déjà ligne ${firstSeen})`, code);
      else { seenCodes.set(k, rowNumber); if (existingCodes.has(k)) action = "update"; }
    }
    if (email) {
      const firstSeen = seenEmails.get(email);
      if (firstSeen !== undefined) { warn("email", `E-mail déjà utilisé ligne ${firstSeen} : ignoré pour cette ligne`, email); email = null; }
      else { seenEmails.set(email, rowNumber); if (existingEmails.has(email)) action = "update"; }
    }

    const rawWeekly = get("weekly_hours");
    const weekly = parseWeeklyHours(rawWeekly);
    if (weekly === "invalid") warn("weekly_hours", "Heures par semaine non reconnues (ex. 20, 20hours, Full Time) : ignorées", rawWeekly);

    if (issues.length > before) return; // ligne rejetée : jamais importée partiellement
    rows.push({
      rowNumber,
      full_name: fullName,
      staff_code: code,
      phone,
      email,
      country_code: country,
      postal_code: postalDisplay,
      postal_code_normalized: postalKey,
      city: get("city") || null,
      region: get("region") || nation,
      skills: parseSkills(get("skills")),
      availability_status: availability ?? null,
      notes: get("notes").slice(0, 4000) || null,
      weekly_hours: weekly === "invalid" ? null : weekly,
      action,
    });
  });

  return { headers: headerMap, missingRequired, rows, issues, warnings, skippedEmpty, totalRows: parsed.data.length - skippedEmpty, truncated };
}

/** Colonnes du modèle (identiques au fichier Excel de référence). */
export const TEMPLATE_HEADERS = ["Code", "full_name", "Phone", "email", "country", "POSTCODE", "city", "region", "skills", "availability", "notes", "weekly hours"] as const;
export const TEMPLATE_EXAMPLES: (string | number)[][] = [
  ["C111002", "AMANDA HUDSON", "07867057833", "amanda.hudson@example.com", "England", "M6 5JF", "Salford", "North West", "SW / HCA", "", "", "20hours"],
  ["C051289", "JOHN SMITH", "07350171823", "john.smith@example.com", "England", "S40 2SR", "Chesterfield", "East Midlands", "SW / HCA", "available", "Night shifts", "Full Time"],
];

export function importTemplateCsv(): string {
  return toCsv(TEMPLATE_HEADERS, TEMPLATE_EXAMPLES, { bom: true });
}

export function errorReportCsv(issues: readonly RowIssue[]): string {
  return toCsv(["ligne", "champ", "erreur", "valeur"], issues.map((i) => [i.rowNumber, i.field, i.message, i.raw ?? ""]), { bom: true });
}
