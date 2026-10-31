/**
 * Configuration centralisée de Manecare.
 * Rien ici ne dépend d'un pays en particulier : le pays de lancement vient de l'environnement.
 */
export const APP_CONFIG = {
  /** Repère de version : affiché dans le menu du profil pour vérifier que la bonne copie du projet tourne. */
  version: "2026.10.31",
  name: "Manecare",
  company: "Maneliza Care",
  tagline: "Trouvez le bon personnel, près de la mission, en quelques secondes.",
  defaultCountry: (process.env.NEXT_PUBLIC_DEFAULT_COUNTRY ?? "GB").toUpperCase(),

  search: {
    radiiKm: [5, 10, 20, 30, 50] as const,
    defaultRadiusKm: 10,
    defaultAvailability: "available" as "available" | "all",
    maxCandidates: 200,
    /** Nombre maximal de candidats pour lesquels on demande un itinéraire réel. */
    maxRouteCandidates: 24,
    routeConcurrency: 3,
    maxResultsOptions: [10, 25, 50, 100] as const,
  },

  routing: {
    cacheTtlSeconds: 7 * 24 * 60 * 60,
    requestTimeoutMs: 8000,
    /** Vitesses moyennes (km/h) du repli approximatif — jamais présenté comme un itinéraire réel. */
    fallbackSpeedsKmh: { driving: 40, walking: 4.8, cycling: 15 } as Record<string, number>,
    /** Train : ESTIMATION par vitesse moyenne supposée, jamais un horaire. */
    trainDetourFactor: 1.2,
    trainSpeedKmh: 80,
    /** Attente + embarquement ajoutés à chaque trajet en train. */
    trainOverheadMinutes: 12,
  },

  geocoding: {
    concurrency: 4,
    requestTimeoutMs: 8000,
  },

  pagination: {
    pageSizes: [25, 50, 100] as const,
    defaultPageSize: 25,
  },

  import: {
    maxRows: 5000,
    maxFileBytes: 5 * 1024 * 1024,
    batchSize: 200,
  },

  export: {
    maxRows: 20000,
  },
} as const;

export const AVAILABILITY_LABELS = {
  available: "Disponible",
  unavailable: "Indisponible",
  unknown: "Inconnue",
} as const;

export const LOCATION_STATUS_LABELS = {
  resolved: "Localisation vérifiée",
  pending: "Localisation à vérifier",
  failed: "Localisation à revoir",
} as const;

export const MISSION_STATUS_LABELS = {
  draft: "Brouillon",
  open: "Ouverte",
  staffing_in_progress: "Recrutement en cours",
  staffed: "Pourvue",
  completed: "Terminée",
  cancelled: "Annulée",
} as const;

export const ASSIGNMENT_STATUS_LABELS = {
  selected: "Sélectionné",
  contacted: "Contacté",
  confirmed: "Confirmé",
  declined: "A refusé",
  cancelled: "Annulé",
  completed: "Terminé",
} as const;

export const TRANSPORT_LABELS = {
  driving: "Voiture",
  walking: "Marche",
  cycling: "Vélo",
  public_transport: "Transports en commun",
} as const;
