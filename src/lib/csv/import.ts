import Papa from "papaparse";
import { z } from "zod";
import { APP_CONFIG } from "@/config/app";
import { getCountry } from "@/config/countries";
import { normalizePostalCode } from "@/lib/geo/postal";
import { normalizePhone } from "@/lib/phone";
import type { AvailabilityStatus } from "@/lib/types";
import { toCsv } from "./export";

export const CSV_FIELDS = [
  "full_name", "staff_code", "phone", "email", "country_code",
  "postal_code", "city", "region", "skills", "availability", "notes",
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

export function parseSkills(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw.split(/[;|,]/)) {
    const t = s.trim();
    const k = t.toLowerCase();
    if (t && t.length <= 60 && !seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  }
  return out.slice(0, 30);
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
  availability_status: AvailabilityStatus;
  notes: string | null;
};

export type RowIssue = { rowNumber: number; field: string; message: string; raw?: string };

export type ImportParseResult = {
  headers: { original: string; mapped: CsvField | null }[];
  missingRequired: string[];
  rows: ParsedStaffRow[];
  issues: RowIssue[];
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
  if (missingRequired.length > 0) {
    return { headers: headerMap, missingRequired, rows: [], issues, totalRows: parsed.data.length, truncated: false };
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

    const fullName = get("full_name");
    if (!fullName) bad("full_name", "Nom complet obligatoire");
    else if (fullName.length > 200) bad("full_name", "Nom trop long (200 caractères max)");

    let country = get("country_code").toUpperCase() || defaultCountry;
    if (!/^[A-Z]{2}$/.test(country)) {
      bad("country_code", "Code pays invalide (2 lettres, ex. GB)", country);
      country = defaultCountry;
    } else if (!getCountry(country)) {
      // Pays non listé : accepté, validation du code postal souple.
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
      else bad("email", "Adresse e-mail invalide", rawEmail);
    }

    const rawPhone = get("phone");
    let phone: string | null = null;
    if (rawPhone) {
      const p = normalizePhone(rawPhone, country);
      if (p.ok) phone = p.e164;
      else bad("phone", p.reason, rawPhone);
    }

    const rawAvail = get("availability").toLowerCase();
    const availability = AVAILABILITY_MAP[rawAvail];
    if (availability === undefined) bad("availability", "Valeur inconnue (available, unavailable, unknown)", rawAvail);

    const code = get("staff_code") || null;
    if (code) {
      const k = code.toLowerCase();
      const firstSeen = seenCodes.get(k);
      if (firstSeen !== undefined) bad("staff_code", `Doublon dans le fichier (déjà ligne ${firstSeen})`, code);
      else if (existingCodes.has(k)) bad("staff_code", "Ce code staff existe déjà", code);
      else seenCodes.set(k, rowNumber);
    }
    if (email) {
      const firstSeen = seenEmails.get(email);
      if (firstSeen !== undefined) bad("email", `Doublon dans le fichier (déjà ligne ${firstSeen})`, email);
      else if (existingEmails.has(email)) bad("email", "Cet e-mail existe déjà", email);
      else seenEmails.set(email, rowNumber);
    }

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
      region: get("region") || null,
      skills: parseSkills(get("skills")),
      availability_status: availability ?? "unknown",
      notes: get("notes").slice(0, 4000) || null,
    });
  });

  return { headers: headerMap, missingRequired, rows, issues, totalRows: parsed.data.length, truncated };
}

export function importTemplateCsv(): string {
  return toCsv(
    CSV_FIELDS,
    [
      ["Jane Doe", "S-001", "+44 7700 900123", "jane.doe@example.com", "GB", "SW1A 1AA", "London", "Greater London", "care;night-shift", "available", "Exemple"],
      ["Paul Mbarga", "S-002", "677 00 00 00", "", "CM", "", "Douala", "Littoral", "driver", "unknown", ""],
    ],
    { bom: true },
  );
}

export function errorReportCsv(issues: readonly RowIssue[]): string {
  return toCsv(["ligne", "champ", "erreur", "valeur"], issues.map((i) => [i.rowNumber, i.field, i.message, i.raw ?? ""]), { bom: true });
}
