import { isValidCoordinate } from "./haversine";

const EARTH_RADIUS_M = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Polygone (anneau fermé, [lon, lat]) approchant un cercle géodésique de rayon `radiusKm`, pour afficher le rayon de recherche. */
export function circlePolygon(latitude: number, longitude: number, radiusKm: number, steps = 64): [number, number][] {
  if (!isValidCoordinate(latitude, longitude) || !(radiusKm > 0)) return [];
  const d = (radiusKm * 1000) / EARTH_RADIUS_M;
  const lat1 = rad(latitude);
  const lon1 = rad(longitude);
  const ring: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const brng = (2 * Math.PI * i) / steps;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    ring.push([((deg(lon2) + 540) % 360) - 180, deg(lat2)]);
  }
  ring.push(ring[0] as [number, number]);
  return ring;
}
