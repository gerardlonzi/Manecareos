import { describe, expect, it } from "vitest";
import { fieldErrorsFrom, missionInputSchema, staffInputSchema } from "./validation";

describe("staffInputSchema", () => {
  it("normalise les champs et les compétences", () => {
    const r = staffInputSchema.parse({ full_name: "  Jane  ", country_code: "gb", email: "JANE@X.COM", skills: "Care; Night, care", phone: "", availability_status: "available" });
    expect(r.full_name).toBe("Jane");
    expect(r.country_code).toBe("GB");
    expect(r.email).toBe("jane@x.com");
    expect(r.phone).toBeNull();
    expect(r.skills).toEqual(["care", "night"]);
  });
  it("refuse un nom vide et un e-mail invalide", () => {
    const r = staffInputSchema.safeParse({ full_name: " ", country_code: "GB", email: "pas-un-email" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = fieldErrorsFrom(r.error);
      expect(e.full_name).toBeTruthy();
      expect(e.email).toBeTruthy();
    }
  });
  it("la disponibilité manquante devient « unknown », jamais « available »", () => {
    expect(staffInputSchema.parse({ full_name: "A", country_code: "GB" }).availability_status).toBe("unknown");
  });
  it("refuse une disponibilité inconnue", () => {
    expect(staffInputSchema.safeParse({ full_name: "A", country_code: "GB", availability_status: "maybe" }).success).toBe(false);
  });
});

describe("missionInputSchema", () => {
  const base = { title: "Remplacement", country_code: "gb", required_staff_count: "3" };
  it("convertit le nombre de staff requis", () => expect(missionInputSchema.parse(base).required_staff_count).toBe(3));
  it("refuse 0, un décimal et une valeur excessive", () => {
    expect(missionInputSchema.safeParse({ ...base, required_staff_count: 0 }).success).toBe(false);
    expect(missionInputSchema.safeParse({ ...base, required_staff_count: 1.5 }).success).toBe(false);
    expect(missionInputSchema.safeParse({ ...base, required_staff_count: 5000 }).success).toBe(false);
  });
  it("transport par défaut : voiture ; mode inconnu refusé", () => {
    expect(missionInputSchema.parse(base).transport_mode).toBe("driving");
    expect(missionInputSchema.safeParse({ ...base, transport_mode: "teleport" }).success).toBe(false);
  });
});
