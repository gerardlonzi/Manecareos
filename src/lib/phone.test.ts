import { describe, expect, it } from "vitest";
import { normalizePhone, telHref, whatsappHref } from "./phone";

describe("normalizePhone", () => {
  it("UK : retire le 0 national", () => expect(normalizePhone("07700 900123", "GB")).toEqual({ ok: true, e164: "+447700900123" }));
  it("garde un numéro déjà international", () => expect(normalizePhone("+44 (0) 7700-900123".replace("(0) ", ""), "GB")).toEqual({ ok: true, e164: "+447700900123" }));
  it("00 → +", () => expect(normalizePhone("0033 6 12 34 56 78", "GB")).toEqual({ ok: true, e164: "+33612345678" }));
  it("Cameroun : 9 chiffres sans zéro", () => expect(normalizePhone("677 00 00 00", "CM")).toEqual({ ok: true, e164: "+237677000000" }));
  it("indicatif déjà présent sans +", () => expect(normalizePhone("237677000000", "CM")).toEqual({ ok: true, e164: "+237677000000" }));
  it("refuse vide, lettres et longueurs absurdes", () => {
    expect(normalizePhone("", "GB").ok).toBe(false);
    expect(normalizePhone("abc123", "GB").ok).toBe(false);
    expect(normalizePhone("12", "GB").ok).toBe(false);
    expect(normalizePhone("+1234567890123456789", "GB").ok).toBe(false);
  });
  it("pays inconnu sans + → refusé", () => expect(normalizePhone("0700000000", "ZZ").ok).toBe(false));
  it("liens tel et WhatsApp", () => {
    expect(telHref("+447700900123")).toBe("tel:+447700900123");
    expect(whatsappHref("+447700900123")).toBe("https://wa.me/447700900123");
  });
});
