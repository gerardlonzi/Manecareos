import { describe, expect, it } from "vitest";
import { isValidTimeZone, utcIsoToZonedLocal, zonedLocalToUtcIso } from "./time";

describe("zonedLocalToUtcIso", () => {
  it("Europe/London en hiver = UTC", () => expect(zonedLocalToUtcIso("2026-01-15T09:00", "Europe/London")).toBe("2026-01-15T09:00:00.000Z"));
  it("Europe/London en été = UTC+1", () => expect(zonedLocalToUtcIso("2026-07-15T09:00", "Europe/London")).toBe("2026-07-15T08:00:00.000Z"));
  it("Africa/Douala = UTC+1 toute l'année", () => expect(zonedLocalToUtcIso("2026-10-21T08:15", "Africa/Douala")).toBe("2026-10-21T07:15:00.000Z"));
  it("America/New_York en hiver = UTC-5", () => expect(zonedLocalToUtcIso("2026-01-15T09:00", "America/New_York")).toBe("2026-01-15T14:00:00.000Z"));
  it("valeurs vides ou invalides", () => {
    expect(zonedLocalToUtcIso("", "UTC")).toBeNull();
    expect(zonedLocalToUtcIso(null, "UTC")).toBeNull();
    expect(zonedLocalToUtcIso("pas une date", "UTC")).toBeNull();
  });
  it("fuseau inconnu : repli sur UTC", () => expect(zonedLocalToUtcIso("2026-01-15T09:00", "Nope/Zone")).toBe("2026-01-15T09:00:00.000Z"));
});

describe("utcIsoToZonedLocal", () => {
  it("aller-retour fidèle", () => {
    const iso = zonedLocalToUtcIso("2026-07-15T09:00", "Europe/London") as string;
    expect(utcIsoToZonedLocal(iso, "Europe/London")).toBe("2026-07-15T09:00");
  });
  it("vide si absent", () => expect(utcIsoToZonedLocal(null, "UTC")).toBe(""));
});

describe("isValidTimeZone", () => {
  it("détecte les fuseaux valides", () => {
    expect(isValidTimeZone("Africa/Douala")).toBe(true);
    expect(isValidTimeZone("Nope/Zone")).toBe(false);
  });
});
