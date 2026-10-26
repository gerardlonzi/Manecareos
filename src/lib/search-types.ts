import type { RouteEstimate } from "@/lib/routing/types";
import type { AssignmentStatus, AvailabilityStatus, LocationStatus, MissionStatus, TransportMode } from "@/lib/types";

export type SearchTarget =
  | { kind: "mission"; missionId: string }
  /** Point de référence de recherche (code postal / ville). Ce n'est la position de personne. */
  | { kind: "point"; latitude: number; longitude: number; label?: string };

export type SearchParams = {
  target: SearchTarget;
  radiusKm: number;
  availability: "available" | "all";
  skills: string[];
  maxResults: number;
};

export type CandidateDTO = {
  id: string;
  fullName: string;
  staffCode: string | null;
  phone: string | null;
  email: string | null;
  countryCode: string;
  postalCode: string | null;
  city: string | null;
  region: string | null;
  latitude: number;
  longitude: number;
  locationStatus: LocationStatus;
  locationUpdatedAt: string | null;
  availability: AvailabilityStatus;
  skills: string[];
  straightLineM: number;
  /** URL signée (1 h) de la photo, ou null : l'interface retombe alors sur les initiales. */
  photoUrl: string | null;
  weeklyHours: number | null;
  assignment: { id: string; status: AssignmentStatus } | null;
};

export type NearbyResult = {
  origin: { latitude: number; longitude: number; label: string };
  mission: { id: string; title: string; status: MissionStatus; requiredStaffCount: number; transportMode: TransportMode; requiredSkills: string[] } | null;
  candidates: CandidateDTO[];
  truncated: boolean;
  /** Staff correspondant aux filtres mais exclus car leur localisation n'est pas vérifiée. */
  excludedUnresolved: number;
};

export type RouteMap = Record<string, RouteEstimate>;

/** supportedModes : itinéraires réels. estimateOnlyModes : estimations approximatives uniquement (ex. train). */
export type RoutingCapabilitiesDTO = { provider: string; configured: boolean; supportedModes: TransportMode[]; estimateOnlyModes: TransportMode[] };
