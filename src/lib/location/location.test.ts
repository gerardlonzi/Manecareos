import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapboxGeocoder } from "./geocoder";
import { locationKey, resetLocationCacheForTests, resolveLocation, resolveMany } from "./service";
import { chunk, mapWithConcurrency } from "@/lib/concurrency";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const feature = (lon: number, lat: number) => ({
  features: [{ geometry: { coordinates: [lon, lat] }, properties: { full_address: "SW1A 1AA, London", context: { place: { name: "London" }, region: { name: "England" } } } }],
});

describe("locationKey", () => {
  it("normalise le code postal et la casse", () => {
    expect(locationKey({ countryCode: "gb", postalCode: "sw1a 1aa" })).toBe(locationKey({ countryCode: "GB", postalCode: "SW1A1AA" }));
  });
});

describe("resolveLocation", () => {
  const originalToken = process.env.MAPBOX_SERVER_TOKEN;
  beforeEach(() => {
    process.env.MAPBOX_SERVER_TOKEN = "t";
    resetLocationCacheForTests();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalToken === undefined) delete process.env.MAPBOX_SERVER_TOKEN;
    else process.env.MAPBOX_SERVER_TOKEN = originalToken;
  });

  it("résout un code postal valide (réponse simulée)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(feature(-0.1419, 51.501)));
    const r = await resolveLocation({ countryCode: "GB", postalCode: "sw1a1aa" });
    expect(r).toMatchObject({ ok: true, latitude: 51.501, longitude: -0.1419, postalDisplay: "SW1A 1AA", city: "London" });
  });
  it("n'appelle pas le réseau pour un code postal invalide", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const r = await resolveLocation({ countryCode: "GB", postalCode: "ZZZ" });
    expect(r).toMatchObject({ ok: false, reason: "invalid_input" });
    expect(spy).not.toHaveBeenCalled();
  });
  it("ne géocode pas deux fois la même adresse", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(feature(-0.14, 51.5)));
    await resolveLocation({ countryCode: "GB", postalCode: "SW1A 1AA" });
    await resolveLocation({ countryCode: "GB", postalCode: "sw1a1aa" });
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it("ne mémorise pas les pannes temporaires", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({}, 500)).mockResolvedValueOnce(json(feature(-0.14, 51.5)));
    expect((await resolveLocation({ countryCode: "GB", postalCode: "SW1A 1AA" })).ok).toBe(false);
    expect((await resolveLocation({ countryCode: "GB", postalCode: "SW1A 1AA" })).ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });
  it("aucun résultat → not_found, sans coordonnées inventées", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ features: [] }));
    expect(await resolveLocation({ countryCode: "GB", postalCode: "SW1A 1AA" })).toMatchObject({ ok: false, reason: "not_found" });
  });
  it("coordonnées hors bornes dans la réponse → rejetées", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(feature(500, 500)));
    expect(await resolveLocation({ countryCode: "GB", postalCode: "SW1A 1AA" })).toMatchObject({ ok: false, reason: "invalid_response" });
  });
  it("429 → rate_limited ; sans jeton → not_configured", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({}, 429));
    expect(await resolveLocation({ countryCode: "GB", postalCode: "SW1A 1AA" })).toMatchObject({ ok: false, reason: "rate_limited" });
    delete process.env.MAPBOX_SERVER_TOKEN;
    resetLocationCacheForTests();
    expect(await new MapboxGeocoder().geocode({ countryCode: "GB", postalCode: "SW1A 1AA" })).toMatchObject({ ok: false, reason: "not_configured" });
  });
  it("pays sans code postal fiable : géocode par ville", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(feature(9.7, 4.05)));
    const r = await resolveLocation({ countryCode: "CM", city: "Douala" });
    expect(r.ok).toBe(true);
    expect(decodeURIComponent(String(spy.mock.calls[0]?.[0]))).toContain("q=Douala");
  });
  it("resolveMany déduplique les adresses identiques", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(feature(-0.14, 51.5)));
    const out = await resolveMany([
      { countryCode: "GB", postalCode: "SW1A 1AA" },
      { countryCode: "GB", postalCode: "sw1a1aa" },
      { countryCode: "GB", postalCode: "M1 1AE" },
    ]);
    expect(out.size).toBe(2);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("concurrence bornée", () => {
  it("ne dépasse jamais la limite et conserve l'ordre", async () => {
    let active = 0;
    let peak = 0;
    const res = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 3, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n * 2;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(res).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
  });
  it("chunk découpe en lots", () => expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]));
});
