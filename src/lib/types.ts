export type LocationStatus = "pending" | "resolved" | "failed";
export type AvailabilityStatus = "available" | "unavailable" | "unknown";
export type TransportMode = "driving" | "walking" | "cycling" | "public_transport";
export type MissionStatus = "draft" | "open" | "staffing_in_progress" | "staffed" | "completed" | "cancelled";
export type AssignmentStatus = "selected" | "contacted" | "confirmed" | "declined" | "cancelled" | "completed";

export type Profile = {
  id: string;
  full_name: string;
  company_name: string | null;
  country_code: string;
  timezone: string;
  default_search_radius_km: number;
  default_transport_mode: TransportMode;
  default_availability_filter: "available" | "all";
  distance_unit: "km" | "mi";
  allow_fallback_estimates: boolean;
  auto_email_documents?: boolean;
};

export type Staff = {
  id: string;
  owner_id: string;
  staff_code: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  country_code: string;
  postal_code: string | null;
  postal_code_normalized: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  location_status: LocationStatus;
  location_updated_at: string | null;
  availability_status: AvailabilityStatus;
  skills: string[];
  notes: string | null;
  /** Chemin de la photo dans le bucket privé « staff-photos » (`<owner_id>/<staff_id>.<ext>`). */
  photo_path: string | null;
  /** Heures de travail par semaine (0–168), ou null. */
  weekly_hours: number | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type Mission = {
  id: string;
  owner_id: string;
  mission_reference: string | null;
  title: string;
  description: string | null;
  country_code: string;
  postal_code: string | null;
  postal_code_normalized: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  location_status: LocationStatus;
  location_updated_at: string | null;
  required_skills: string[];
  required_staff_count: number;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  /** Heures prévues, paie horaire et devise (optionnels). */
  planned_hours: number | null;
  /** Lieu principal : type d'établissement + nom */
  workplace_type: string | null;
  workplace_name: string | null;
  pay_rate: number | null;
  pay_currency: string;
  transport_mode: TransportMode;
  status: MissionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type MissionOverview = Mission & { selected_count: number; confirmed_count: number; missing_count: number };

export type MissionStaff = {
  id: string;
  owner_id: string;
  mission_id: string;
  staff_id: string;
  assignment_status: AssignmentStatus;
  selected_at: string;
  updated_at: string;
  notes: string | null;
  shift_start_at: string | null;
  shift_end_at: string | null;
  hours_worked: number | null;
  pay_rate: number | null;
  completed_at: string | null;
};

export type ActivityLog = {
  id: string;
  owner_id: string;
  staff_id: string | null;
  mission_id: string | null;
  event_type: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Notification = {
  id: string;
  owner_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
  email_sent_at?: string | null;
};

import type { GuardIssue } from "./assignment-guard";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; issues?: GuardIssue[] };
