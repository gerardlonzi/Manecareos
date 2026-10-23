import { describe, expect, it } from "vitest";
import { circlePolygon } from "./circle";
import { haversineMeters } from "./haversine";

describe("circlePolygon", () => {
  const center = { latitude: 51.5, longitude: -0.12 };
  it("tous les points sont au rayon demandé (±0,5 %)", () => {
    const ring = circlePolygon(center.latitude, center.longitude, 10);
    expect(ring.length).toBe(65);
    for (const [lon, lat] of ring) {
      const d = haversineMeters(center, { latitude: lat, longitude: lon }) as number;
      expect(Math.abs(d - 10_000)).toBeLessThan(50);
    }
  });
  it("l'anneau est fermé", () => {
    const ring = circlePolygon(center.latitude, center.longitude, 5);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
  it("renvoie un anneau vide pour des entrées invalides", () => {
    expect(circlePolygon(200, 0, 5)).toEqual([]);
    expect(circlePolygon(51, 0, 0)).toEqual([]);
  });
});
