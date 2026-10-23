import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cacheExpiry, isCacheFresh, routeCacheKey } from "./cache";
import { approximateEstimate } from "./fallback";
import { MapboxRoutingProvider } from "./mapbox";

const A = { latitude: 51.5, longitude: -0.1 };
const B = { latitude: 51.6, longitude: -0.2 };

describe("routeCacheKey", () => {
  it("est déterministe", () => expect(routeCacheKey("mapbox", "driving", A, B)).toBe(routeCacheKey("mapbox", "driving", A, B)));
  it("diffère selon le mode : jamais de réutilisation voiture → marche", () => {
    expect(routeCacheKey("mapbox", "driving", A, B)).not.toBe(routeCacheKey("mapbox", "walking", A, B));
    expect(routeCacheKey("mapbox", "driving", A, B)).not.toBe(routeCacheKey("mapbox", "public_transport", A, B));
  });
  it("diffère selon l'origine, la destination et le fournisseur", () => {
    expect(routeCacheKey("mapbox", "driving", A, B)).not.toBe(routeCacheKey("mapbox", "driving", B, A));
    expect(routeCacheKey("mapbox", "driving", A, B)).not.toBe(routeCacheKey("other", "driving", A, B));
  });
  it("ignore des écarts inférieurs à ~1 m", () => {
    expect(routeCacheKey("mapbox", "driving", A, B)).toBe(routeCacheKey("mapbox", "driving", { latitude: 51.500001, longitude: -0.1 }, B));
  });
});

describe("expiration du cache", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  it("valide avant expiration, périmé après", () => {
    expect(isCacheFresh("2026-10-20T12:00:01Z", now)).toBe(true);
    expect(isCacheFresh("2026-10-20T12:00:00Z", now)).toBe(false);
    expect(isCacheFresh("2026-10-19T00:00:00Z", now)).toBe(false);
  });
  it("date illisible = périmée", () => expect(isCacheFresh("pas une date", now)).toBe(false));
  it("calcule l'expiration à partir du TTL", () => expect(cacheExpiry(3600, now)).toBe("2026-10-20T13:00:00.000Z"));
});

describe("approximateEstimate (repli)", () => {
  it("pas de repli pour les transports en commun", () => {
    expect(approximateEstimate("public_transport", { straightLineM: 5000 })).toBeNull();
  });
  it("basé sur la distance à vol d'oiseau : marqué straight_line", () => {
    const e = approximateEstimate("walking", { straightLineM: 4800 });
    expect(e).toMatchObject({ status: "approximate", basis: "straight_line", mode: "walking" });
    expect(e?.durationS).toBeCloseTo(3600, 0); // 4,8 km à 4,8 km/h
  });
  it("utilise la distance routière réelle quand elle existe", () => {
    expect(approximateEstimate("driving", { straightLineM: 1000, roadDistanceM: 40_000 })).toMatchObject({ basis: "road_distance", distanceM: 40_000 });
  });
  it("null sans aucune distance", () => expect(approximateEstimate("driving", { straightLineM: null })).toBeNull());
});

describe("MapboxRoutingProvider", () => {
  const originalToken = process.env.MAPBOX_SERVER_TOKEN;
  beforeEach(() => {
    process.env.MAPBOX_SERVER_TOKEN = "test-token";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalToken === undefined) delete process.env.MAPBOX_SERVER_TOKEN;
    else process.env.MAPBOX_SERVER_TOKEN = originalToken;
  });

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("ne prend pas en charge les transports en commun et n'appelle pas le réseau", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const res = await new MapboxRoutingProvider().estimateMany([A], B, "public_transport");
    expect(res[0]).toMatchObject({ status: "unsupported_mode" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("sans jeton : not_configured, sans appel réseau", async () => {
    delete process.env.MAPBOX_SERVER_TOKEN;
    const spy = vi.spyOn(globalThis, "fetch");
    const res = await new MapboxRoutingProvider().estimateMany([A], B, "driving");
    expect(res[0]).toMatchObject({ status: "not_configured" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("valide et convertit une réponse Matrix (réponse simulée)", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ code: "Ok", durations: [[600], [null]], distances: [[5000], [null]] }),
    );
    const res = await new MapboxRoutingProvider().estimateMany([A, { latitude: 52, longitude: 0 }], B, "walking");
    expect(res[0]).toMatchObject({ status: "ok", distanceM: 5000, durationS: 600, provider: "mapbox", mode: "walking", source: "provider" });
    expect(res[1]).toMatchObject({ status: "no_route" });
    const url = String(spy.mock.calls[0]?.[0]);
    expect(url).toContain("/directions-matrix/v1/mapbox/walking/");
    expect(url).toContain("sources=1;2");
  });

  it("n'utilise pas le profil driving-traffic (pas de promesse de trafic)", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ code: "Ok", durations: [[60]], distances: [[500]] }));
    await new MapboxRoutingProvider().estimateMany([A], B, "driving");
    expect(String(spy.mock.calls[0]?.[0])).not.toContain("driving-traffic");
  });

  it("réponse malformée → erreur explicite, jamais de valeur inventée", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ code: "Ok", durations: "oops" }));
    const res = await new MapboxRoutingProvider().estimateMany([A], B, "driving");
    expect(res[0]).toMatchObject({ status: "error" });
  });

  it("429 → rate_limited ; 401 → not_configured ; 500 → error", async () => {
    const p = new MapboxRoutingProvider();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({}, 429));
    expect((await p.estimateMany([A], B, "driving"))[0]).toMatchObject({ status: "rate_limited" });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({}, 401));
    expect((await p.estimateMany([A], B, "driving"))[0]).toMatchObject({ status: "not_configured" });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({}, 500));
    expect((await p.estimateMany([A], B, "driving"))[0]).toMatchObject({ status: "error" });
  });

  it("panne réseau → error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));
    expect((await new MapboxRoutingProvider().estimateMany([A], B, "driving"))[0]).toMatchObject({ status: "error" });
  });

  it("découpe en lots de 24 origines", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const n = String(url).split("sources=")[1]?.split("&")[0]?.split(";").length ?? 0;
      return json({ code: "Ok", durations: Array.from({ length: n }, () => [60]), distances: Array.from({ length: n }, () => [500]) });
    });
    const origins = Array.from({ length: 30 }, (_, i) => ({ latitude: 51 + i / 1000, longitude: 0 }));
    const res = await new MapboxRoutingProvider().estimateMany(origins, B, "driving");
    expect(spy).toHaveBeenCalledTimes(2);
    expect(res).toHaveLength(30);
    expect(res.every((r) => r.status === "ok")).toBe(true);
  });

  it("géométrie : null si le fournisseur n'en renvoie pas", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ code: "NoRoute", routes: [] }));
    expect(await new MapboxRoutingProvider().routeGeometry(A, B, "driving")).toBeNull();
  });

  it("géométrie réelle renvoyée telle quelle", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ code: "Ok", routes: [{ geometry: { coordinates: [[0, 0.1], [0.1, 0.2]] } }] }));
    expect(await new MapboxRoutingProvider().routeGeometry(A, B, "driving")).toEqual({ coordinates: [[0, 0.1], [0.1, 0.2]] });
  });
});
