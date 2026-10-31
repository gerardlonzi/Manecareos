/** Heures de travail : semaines, mois, durées, chevauchements, heures restantes (pur et testable). */
const MS_H = 3_600_000;

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Durée en heures entre deux instants ISO (arrondie à 0,01 h), ou null si invalide / négative. */
export function hoursBetween(startIso: string | null | undefined, endIso: string | null | undefined): number | null {
  if (!startIso || !endIso) return null;
  const a = Date.parse(startIso), b = Date.parse(endIso);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return round2((b - a) / MS_H);
}

/** Saisie libre d'une durée : « 7.5 », « 7,5 », « 7h30 », « 7:30 » → heures décimales. */
export function parseHoursInput(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(",", ".");
  if (!s) return null;
  const hm = s.match(/^(\d{1,3})\s*[h:]\s*(\d{1,2})?$/);
  if (hm) { const m = Number(hm[2] ?? 0); return m < 60 ? round2(Number(hm[1]) + m / 60) : null; }
  if (/^\d{1,3}(\.\d{1,2})?$/.test(s)) return round2(Number(s));
  return null;
}

/** Lundi 00:00 UTC de la semaine contenant la date, et lundi suivant. */
export function weekRange(date: Date): { from: Date; to: Date } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // lundi = 0
  const from = new Date(d.getTime() - dow * 86_400_000);
  return { from, to: new Date(from.getTime() + 7 * 86_400_000) };
}

/** « 2026-10 » → bornes UTC du mois. */
export function monthRange(ym: string): { from: Date; to: Date } | null {
  const m = ym.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1;
  return { from: new Date(Date.UTC(y, mo, 1)), to: new Date(Date.UTC(y, mo + 1, 1)) };
}

export const currentMonth = (now = new Date()) => now.toISOString().slice(0, 7);

export type Interval = { start: string; end: string };
export function overlaps(a: Interval, b: Interval): boolean {
  const as = Date.parse(a.start), ae = Date.parse(a.end), bs = Date.parse(b.start), be = Date.parse(b.end);
  if ([as, ae, bs, be].some(Number.isNaN)) return false;
  return as < be && bs < ae;
}

export type HoursBudget = { cap: number | null; used: number; remaining: number | null; over: boolean; atCap: boolean };
/** Plafond hebdomadaire vs heures déjà réservées/travaillées. cap null/0 = pas de plafond. */
export function hoursBudget(cap: number | null | undefined, used: number): HoursBudget {
  if (!cap || cap <= 0) return { cap: null, used: round2(used), remaining: null, over: false, atCap: false };
  const remaining = round2(cap - used);
  return { cap, used: round2(used), remaining, over: remaining < 0, atCap: remaining <= 0 };
}
