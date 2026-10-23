import "server-only";
import { z } from "zod";
import { APP_CONFIG } from "@/config/app";
import { chunk } from "@/lib/concurrency";
import { isValidCoordinate, type LatLon } from "@/lib/geo/haversine";
import type { TransportMode } from "@/lib/types";
import type { RouteEstimate, RouteGeometry, RoutingProvider } from "./types";

const PROFILE: Partial<Record<TransportMode, string>> = {
  driving: "driving", // sans trafic : on n'affirme donc jamais que le trafic en direct est inclus
  walking: "walking",
  cycling: "cycling",
};

const MATRIX_MAX_COORDS = 25; // 1 destination + 24 origines

const matrixSchema = z.object({
  code: z.string(),
  durations: z.array(z.array(z.number().nullable())).optional(),
  distances: z.array(z.array(z.number().nullable())).optional(),
});

const directionsSchema = z.object({
  code: z.string(),
  routes: z
    .array(z.object({ geometry: z.object({ coordinates: z.array(z.tuple([z.number(), z.number()])).min(2) }) }))
    .default([]),
});

const coord = (p: LatLon) => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`;

export class MapboxRoutingProvider implements RoutingProvider {
  readonly id = "mapbox";

  private get token(): string | undefined {
    return process.env.MAPBOX_SERVER_TOKEN || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.token);
  }

  supportedModes(): TransportMode[] {
    return Object.keys(PROFILE) as TransportMode[];
  }

  private fail(mode: TransportMode, status: Exclude<RouteEstimate["status"], "ok" | "approximate">, message: string): RouteEstimate {
    return { status, mode, message };
  }

  private async fetchJson(url: string): Promise<{ status: number; json: unknown }> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), APP_CONFIG.routing.requestTimeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      return { status: res.status, json };
    } finally {
      clearTimeout(timer);
    }
  }

  async estimateMany(origins: LatLon[], destination: LatLon, mode: TransportMode): Promise<RouteEstimate[]> {
    const profile = PROFILE[mode];
    if (!profile) {
      const msg =
        mode === "public_transport"
          ? "Les estimations en transports en commun ne sont pas prises en charge : aucun fournisseur d'horaires n'est configuré."
          : "Mode de transport non pris en charge par le fournisseur.";
      return origins.map(() => this.fail(mode, "unsupported_mode", msg));
    }
    if (!this.token) {
      return origins.map(() => this.fail(mode, "not_configured", "Jeton serveur Mapbox non configuré (MAPBOX_SERVER_TOKEN)."));
    }
    if (!isValidCoordinate(destination.latitude, destination.longitude)) {
      return origins.map(() => this.fail(mode, "error", "Coordonnées de destination invalides."));
    }

    const results: RouteEstimate[] = [];
    for (const group of chunk(origins, MATRIX_MAX_COORDS - 1)) {
      results.push(...(await this.matrixChunk(group, destination, mode, profile)));
    }
    return results;
  }

  private async matrixChunk(origins: LatLon[], destination: LatLon, mode: TransportMode, profile: string): Promise<RouteEstimate[]> {
    // Index 0 = destination, 1..n = origines.
    const coords = [destination, ...origins].map(coord).join(";");
    const sources = origins.map((_, i) => i + 1).join(";");
    const url =
      `https://api.mapbox.com/directions-matrix/v1/mapbox/${profile}/${coords}` +
      `?sources=${sources}&destinations=0&annotations=duration,distance&access_token=${encodeURIComponent(this.token as string)}`;

    try {
      const { status, json } = await this.fetchJson(url);
      if (status === 429) return origins.map(() => this.fail(mode, "rate_limited", "Limite de requêtes du fournisseur atteinte. Réessayez dans un instant."));
      if (status === 401 || status === 403) return origins.map(() => this.fail(mode, "not_configured", "Jeton Mapbox refusé par le fournisseur."));
      if (status < 200 || status >= 300) return origins.map(() => this.fail(mode, "error", `Le fournisseur a répondu avec le statut ${status}.`));

      const parsed = matrixSchema.safeParse(json);
      if (!parsed.success || parsed.data.code !== "Ok" || !parsed.data.durations || !parsed.data.distances) {
        return origins.map(() => this.fail(mode, "error", "Réponse du fournisseur invalide ou incomplète."));
      }
      const { durations, distances } = parsed.data;
      const now = new Date().toISOString();
      return origins.map((_, i): RouteEstimate => {
        const duration = durations[i]?.[0];
        const distance = distances[i]?.[0];
        if (typeof duration !== "number" || typeof distance !== "number") {
          return this.fail(mode, "no_route", "Aucun itinéraire trouvé entre ces deux points.");
        }
        return { status: "ok", mode, provider: this.id, distanceM: distance, durationS: duration, estimatedAt: now, source: "provider" };
      });
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      return origins.map(() => this.fail(mode, "error", aborted ? "Le fournisseur n'a pas répondu à temps." : "Erreur réseau vers le fournisseur."));
    }
  }

  async routeGeometry(origin: LatLon, destination: LatLon, mode: TransportMode): Promise<RouteGeometry | null> {
    const profile = PROFILE[mode];
    if (!profile || !this.token) return null;
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coord(origin)};${coord(destination)}` +
      `?geometries=geojson&overview=full&access_token=${encodeURIComponent(this.token)}`;
    try {
      const { status, json } = await this.fetchJson(url);
      if (status < 200 || status >= 300) return null;
      const parsed = directionsSchema.safeParse(json);
      const route = parsed.success && parsed.data.code === "Ok" ? parsed.data.routes[0] : undefined;
      return route ? { coordinates: route.geometry.coordinates } : null;
    } catch {
      return null;
    }
  }
}
