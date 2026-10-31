import { describe, expect, it } from "vitest";
import { currentMonth, hoursBetween, hoursBudget, monthRange, overlaps, parseHoursInput, weekRange } from "./hours";
import { evaluateAssignment, describeIssue } from "./assignment-guard";
import { staffCompliance } from "./documents";

describe("heures", () => {
  it("calcule la durée d'une garde, y compris de nuit", () => {
    expect(hoursBetween("2026-10-28T09:00:00Z", "2026-10-28T17:30:00Z")).toBe(8.5);
    expect(hoursBetween("2026-10-28T22:00:00Z", "2026-10-29T06:00:00Z")).toBe(8);
    expect(hoursBetween("2026-10-28T17:00:00Z", "2026-10-28T09:00:00Z")).toBeNull();
    expect(hoursBetween(null, "2026-10-28T09:00:00Z")).toBeNull();
  });
  it("lit les heures saisies à la main", () => {
    expect(parseHoursInput("7.5")).toBe(7.5);
    expect(parseHoursInput("7,5")).toBe(7.5);
    expect(parseHoursInput("7h30")).toBe(7.5);
    expect(parseHoursInput("9:14")).toBe(9.23);
    expect(parseHoursInput("7h75")).toBeNull();
    expect(parseHoursInput("abc")).toBeNull();
    expect(parseHoursInput("")).toBeNull();
  });
  it("semaine du lundi au lundi et mois", () => {
    const w = weekRange(new Date("2026-10-28T10:00:00Z")); // mercredi
    expect(w.from.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(w.to.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(weekRange(new Date("2026-11-01T23:00:00Z")).from.toISOString()).toBe("2026-10-26T00:00:00.000Z"); // dimanche
    expect(monthRange("2026-12")?.to.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(monthRange("2026-13")).toBeNull();
    expect(currentMonth(new Date("2026-10-28T10:00:00Z"))).toBe("2026-10");
  });
  it("détecte les chevauchements (bords exclus)", () => {
    expect(overlaps({ start: "2026-10-28T09:00:00Z", end: "2026-10-28T17:00:00Z" }, { start: "2026-10-28T16:00:00Z", end: "2026-10-28T20:00:00Z" })).toBe(true);
    expect(overlaps({ start: "2026-10-28T09:00:00Z", end: "2026-10-28T17:00:00Z" }, { start: "2026-10-28T17:00:00Z", end: "2026-10-28T20:00:00Z" })).toBe(false);
  });
  it("budget d'heures", () => {
    expect(hoursBudget(40, 32)).toMatchObject({ remaining: 8, over: false, atCap: false });
    expect(hoursBudget(40, 40)).toMatchObject({ remaining: 0, atCap: true, over: false });
    expect(hoursBudget(40, 44.5)).toMatchObject({ remaining: -4.5, over: true });
    expect(hoursBudget(null, 99)).toMatchObject({ cap: null, remaining: null, over: false });
  });
});

describe("règles d'attribution", () => {
  const okCompliance = staffCompliance([], [], "2026-10-28");
  const base = { compliance: okCompliance, expiringDuringMission: [], available: true, overlappingCount: 0, weeklyCap: 40, hoursUsedThatWeek: 10, newHours: 8 };
  it("aucun problème", () => expect(evaluateAssignment(base)).toEqual({ issues: [], blocked: false }));
  it("bloque si dossier incomplet", () => {
    const c = staffCompliance([{ id: "a", key: "a", name_fr: "Passeport", name_en: "Passport", mandatory: true, can_expire: true, alert_days: [] }], [], "2026-10-28");
    const r = evaluateAssignment({ ...base, compliance: c });
    expect(r.blocked).toBe(true);
    expect(describeIssue(r.issues[0]!, "fr")).toContain("Passeport");
    expect(describeIssue(r.issues[0]!, "en")).toContain("Passport");
  });
  it("avertit (sans bloquer) : indisponible, chevauchement, plafond", () => {
    const r = evaluateAssignment({ ...base, available: false, overlappingCount: 1, hoursUsedThatWeek: 36 });
    expect(r.blocked).toBe(false);
    expect(r.issues.map((i) => i.code)).toEqual(["unavailable", "overlap", "hours_over"]);
    expect(evaluateAssignment({ ...base, hoursUsedThatWeek: 32 }).issues.map((i) => i.code)).toEqual(["hours_at_cap"]);
  });
});
