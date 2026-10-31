import { describe, expect, it } from "vitest";
import { hashLoginCode, safeEqual, signTwoFactorToken, verifyTwoFactorToken } from "./token";

const SECRET = "s".repeat(40);
const USER = "11111111-1111-1111-1111-111111111111";

describe("jeton de double authentification", () => {
  it("accepte un jeton valide pour le bon utilisateur", async () => {
    const t = await signTwoFactorToken(USER, SECRET, 1000);
    expect(await verifyTwoFactorToken(t, USER, SECRET, 1001)).toBe(true);
  });
  it("refuse un autre utilisateur, un jeton expiré, falsifié ou vide", async () => {
    const t = await signTwoFactorToken(USER, SECRET, 1000);
    expect(await verifyTwoFactorToken(t, "22222222-2222-2222-2222-222222222222", SECRET, 1001)).toBe(false);
    expect(await verifyTwoFactorToken(t, USER, SECRET, 1000 + 13 * 3600)).toBe(false);
    expect(await verifyTwoFactorToken(t.slice(0, -1) + (t.endsWith("0") ? "1" : "0"), USER, SECRET, 1001)).toBe(false);
    expect(await verifyTwoFactorToken(t, USER, "x".repeat(40), 1001)).toBe(false);
    expect(await verifyTwoFactorToken("", USER, SECRET)).toBe(false);
    expect(await verifyTwoFactorToken("a.b", USER, SECRET)).toBe(false);
  });
  it("l'empreinte d'un code dépend de l'utilisateur et du code", async () => {
    const a = await hashLoginCode(USER, "123456", SECRET);
    expect(a).toBe(await hashLoginCode(USER, "123456", SECRET));
    expect(a).not.toBe(await hashLoginCode(USER, "123457", SECRET));
    expect(a).not.toBe(await hashLoginCode("22222222-2222-2222-2222-222222222222", "123456", SECRET));
  });
  it("safeEqual compare en temps constant", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });
});
