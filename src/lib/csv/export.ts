export type CsvCell = string | number | boolean | null | undefined | Date;

const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Échappe une cellule CSV (RFC 4180) et neutralise l'injection de formules tableur :
 * une chaîne commençant par = + - @ TAB ou CR est préfixée par une apostrophe.
 * Les nombres JS ne sont jamais préfixés (un -5 numérique reste un nombre).
 */
export function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (typeof value === "number") s = Number.isFinite(value) ? String(value) : "";
  else if (typeof value === "boolean") s = value ? "true" : "false";
  else if (value instanceof Date) s = value.toISOString();
  else {
    s = value;
    if (FORMULA_START.test(s)) s = `'${s}`;
  }
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[], opts: { bom?: boolean } = {}): string {
  const lines = [headers.map(escapeCsvCell).join(","), ...rows.map((r) => r.map(escapeCsvCell).join(","))];
  return (opts.bom ? "﻿" : "") + lines.join("\r\n") + "\r\n";
}
