import type { Compliance } from "./documents";
import { hoursBudget } from "./hours";

/** Règles avant d'attribuer un staff à une mission. `block` empêche l'attribution ; `warn` demande une confirmation. */
export type GuardIssue =
  | { level: "block"; code: "docs_missing"; names: { fr: string; en: string }[] }
  | { level: "block"; code: "docs_expired"; names: { fr: string; en: string }[] }
  | { level: "warn"; code: "docs_expire_during"; names: { fr: string; en: string }[] }
  | { level: "warn"; code: "unavailable" }
  | { level: "warn"; code: "overlap"; count: number }
  | { level: "warn"; code: "hours_over"; over: number; cap: number }
  | { level: "warn"; code: "hours_at_cap"; cap: number };

export type GuardInput = {
  compliance: Compliance;
  expiringDuringMission: { name_fr: string; name_en: string }[];
  available: boolean;
  overlappingCount: number;
  weeklyCap: number | null;
  hoursUsedThatWeek: number;
  newHours: number;
};

const names = (list: { name_fr: string; name_en: string }[]) => list.map((t) => ({ fr: t.name_fr, en: t.name_en }));

export function evaluateAssignment(i: GuardInput): { issues: GuardIssue[]; blocked: boolean } {
  const issues: GuardIssue[] = [];
  if (i.compliance.missing.length) issues.push({ level: "block", code: "docs_missing", names: names(i.compliance.missing) });
  if (i.compliance.expired.length) issues.push({ level: "block", code: "docs_expired", names: names(i.compliance.expired.map((e) => e.type)) });
  if (i.expiringDuringMission.length) issues.push({ level: "warn", code: "docs_expire_during", names: names(i.expiringDuringMission) });
  if (!i.available) issues.push({ level: "warn", code: "unavailable" });
  if (i.overlappingCount > 0) issues.push({ level: "warn", code: "overlap", count: i.overlappingCount });
  const b = hoursBudget(i.weeklyCap, i.hoursUsedThatWeek + i.newHours);
  if (b.cap && b.over) issues.push({ level: "warn", code: "hours_over", over: Math.abs(b.remaining ?? 0), cap: b.cap });
  else if (b.cap && b.atCap) issues.push({ level: "warn", code: "hours_at_cap", cap: b.cap });
  return { issues, blocked: issues.some((x) => x.level === "block") };
}

export function describeIssue(issue: GuardIssue, locale: "fr" | "en"): string {
  const list = (n: { fr: string; en: string }[]) => n.map((x) => x[locale]).join(", ");
  const fr = locale === "fr";
  switch (issue.code) {
    case "docs_missing": return fr ? `Documents obligatoires manquants : ${list(issue.names)}.` : `Mandatory documents missing: ${list(issue.names)}.`;
    case "docs_expired": return fr ? `Documents expirés : ${list(issue.names)}.` : `Expired documents: ${list(issue.names)}.`;
    case "docs_expire_during": return fr ? `Expire avant la fin de la mission : ${list(issue.names)}.` : `Expires before the assignment ends: ${list(issue.names)}.`;
    case "unavailable": return fr ? "Ce staff est marqué comme indisponible." : "This staff member is marked as unavailable.";
    case "overlap": return fr ? `Chevauche ${issue.count} autre(s) mission(s) du même staff.` : `Overlaps ${issue.count} other assignment(s) for this staff member.`;
    case "hours_over": return fr ? `Dépasse le plafond hebdomadaire de ${issue.cap} h (de ${issue.over} h).` : `Exceeds the weekly cap of ${issue.cap} h (by ${issue.over} h).`;
    case "hours_at_cap": return fr ? `Atteint le plafond hebdomadaire de ${issue.cap} h.` : `Reaches the weekly cap of ${issue.cap} h.`;
  }
}
