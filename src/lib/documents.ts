/** Logique de conformité des documents du staff (pure, testable, sans accès base). Dates au format AAAA-MM-JJ. */
export type DocType = { id: string; key: string; name_fr: string; name_en: string; mandatory: boolean; can_expire: boolean; alert_days: number[]; archived_at?: string | null; sort_order?: number };
export type StaffDoc = { id: string; link_url?: string | null; issued_at?: string | null; staff_id: string; type_id: string; expires_at: string | null; no_expiry: boolean; file_public_id?: string | null; file_name?: string | null; note?: string | null };

export type DocStatus = "valid" | "expiring" | "expired";
export const EXPIRING_SOON_DAYS = 60;

const MS_DAY = 86_400_000;
const toUtc = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const todayIso = (now = new Date()) => now.toISOString().slice(0, 10);

/** Jours restants avant la date (négatif si dépassée). */
export function daysUntil(date: string, today = todayIso()): number {
  return Math.round((toUtc(date) - toUtc(today)) / MS_DAY);
}

export function docStatus(doc: Pick<StaffDoc, "expires_at" | "no_expiry">, today = todayIso(), soonDays = EXPIRING_SOON_DAYS): DocStatus {
  if (doc.no_expiry || !doc.expires_at) return "valid";
  const d = daysUntil(doc.expires_at, today);
  if (d < 0) return "expired";
  return d <= soonDays ? "expiring" : "valid";
}

export const docName = (t: Pick<DocType, "name_fr" | "name_en">, locale: "fr" | "en") => (locale === "fr" ? t.name_fr : t.name_en);

export type Compliance = {
  /** Tous les documents obligatoires sont présents ET en cours de validité. */
  complete: boolean;
  level: "compliant" | "expiring" | "non_compliant";
  missing: DocType[];
  expired: { type: DocType; doc: StaffDoc }[];
  expiring: { type: DocType; doc: StaffDoc; daysLeft: number }[];
  requiredCount: number;
  validCount: number;
};

export function staffCompliance(types: DocType[], docs: StaffDoc[], today = todayIso()): Compliance {
  const required = types.filter((t) => t.mandatory && !t.archived_at);
  const byType = new Map(docs.map((d) => [d.type_id, d]));
  const missing: DocType[] = [];
  const expired: Compliance["expired"] = [];
  const expiring: Compliance["expiring"] = [];
  let validCount = 0;
  for (const type of required) {
    const doc = byType.get(type.id);
    if (!doc) { missing.push(type); continue; }
    const st = docStatus(doc, today);
    if (st === "expired") { expired.push({ type, doc }); continue; }
    validCount++;
    if (st === "expiring" && doc.expires_at) expiring.push({ type, doc, daysLeft: daysUntil(doc.expires_at, today) });
  }
  const complete = missing.length === 0 && expired.length === 0;
  return { complete, level: !complete ? "non_compliant" : expiring.length ? "expiring" : "compliant", missing, expired, expiring, requiredCount: required.length, validCount };
}

/** Documents obligatoires qui seront expirés à la date donnée (ex. fin de mission). */
export function expiringBefore(types: DocType[], docs: StaffDoc[], date: string): { type: DocType; doc: StaffDoc }[] {
  const byType = new Map(docs.map((d) => [d.type_id, d]));
  const out: { type: DocType; doc: StaffDoc }[] = [];
  for (const type of types) {
    if (!type.mandatory || type.archived_at) continue;
    const doc = byType.get(type.id);
    if (doc && !doc.no_expiry && doc.expires_at && doc.expires_at < date) out.push({ type, doc });
  }
  return out;
}

/** Seuil d'alerte atteint aujourd'hui pour un document (le plus petit seuil ≥ jours restants), ou null. */
export function alertThreshold(daysLeft: number, alertDays: number[]): number | null {
  const sorted = [...alertDays].sort((a, b) => a - b);
  if (daysLeft < 0) return -1; // déjà expiré
  const t = sorted.find((d) => daysLeft <= d);
  return t === undefined ? null : t;
}
