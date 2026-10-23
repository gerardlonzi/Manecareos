import type { LatLon } from "@/lib/geo/haversine";
import type { TransportMode } from "@/lib/types";

export type RouteFailureStatus =
  | "unsupported_mode"   // le fournisseur ne sait pas calculer ce mode
  | "not_configured"     // jeton absent
  | "no_route"           // aucun itinéraire trouvé
  | "rate_limited"
  | "error";

export type RouteEstimate =
  | {
      status: "ok";
      mode: TransportMode;
      provider: string;
      distanceM: number;
      durationS: number;
      estimatedAt: string;
      source: "provider" | "cache";
    }
  | {
      /** Repli explicite, autorisé par le manager. Jamais un vrai itinéraire. */
      status: "approximate";
      mode: TransportMode;
      basis: "straight_line" | "road_distance";
      distanceM: number;
      durationS: number;
      estimatedAt: string;
    }
  | { status: RouteFailureStatus; mode: TransportMode; message: string };

export type RouteGeometry = { coordinates: [number, number][] }; // [lon, lat]

export interface RoutingProvider {
  readonly id: string;
  isConfigured(): boolean;
  supportedModes(): TransportMode[];
  /** Une destination, plusieurs origines. Retourne un résultat par origine, dans le même ordre. */
  estimateMany(origins: LatLon[], destination: LatLon, mode: TransportMode): Promise<RouteEstimate[]>;
  /** Géométrie réelle d'un itinéraire, ou null si le fournisseur n'en renvoie pas. */
  routeGeometry(origin: LatLon, destination: LatLon, mode: TransportMode): Promise<RouteGeometry | null>;
}
