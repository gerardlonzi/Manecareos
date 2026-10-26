/**
 * Conversion entre une date locale saisie (« 2026-11-03T09:30 », sans fuseau) et un instant UTC,
 * selon le fuseau horaire du manager. Évite de dépendre du fuseau du serveur.
 */
function offsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** « YYYY-MM-DDTHH:mm » exprimé dans `timeZone` → ISO UTC, ou null si invalide. */
export function zonedLocalToUtcIso(local: string | null | undefined, timeZone: string): string | null {
  if (!local) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!m) return null;
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(naive)) return null;
  let guess = naive - offsetMinutes(naive, tz) * 60000;
  guess = naive - offsetMinutes(guess, tz) * 60000; // second passage : gère les changements d'heure
  const dt = new Date(guess);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

/** ISO UTC → « YYYY-MM-DDTHH:mm » dans `timeZone`, pour pré-remplir un champ datetime-local. */
export function utcIsoToZonedLocal(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(t));
  const g = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}
