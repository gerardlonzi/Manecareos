import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { APP_CONFIG } from "@/config/app";
import { haversineMeters, isValidCoordinate, type LatLon } from "@/lib/geo/haversine";
import type { CandidateDTO, NearbyResult, SearchParams, SearchTarget } from "@/lib/search-types";
import type { AssignmentStatus, Mission } from "@/lib/types";
import { normalizeSkills } from "@/lib/utils";

export const searchParamsSchema = z.object({
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("mission"), missionId: z.uuid() }),
    z.object({ kind: z.literal("point"), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), label: z.string().max(200).optional() }),
  ]),
  radiusKm: z.number().min(1).max(200),
  availability: z.enum(["available", "all"]),
  skills: z.array(z.string().max(60)).max(30).default([]),
  maxResults: z.number().int().min(1).max(APP_CONFIG.search.maxCandidates),
});

export type ResolvedTarget =
  | { ok: true; origin: LatLon & { label: string }; mission: Mission | null }
  | { ok: false; error: string };

/** Les coordonnées d'une mission viennent de la base (via RLS), jamais du navigateur. */
export async function resolveTarget(supabase: SupabaseClient, target: SearchTarget): Promise<ResolvedTarget> {
  if (target.kind === "point") {
    if (!isValidCoordinate(target.latitude, target.longitude)) return { ok: false, error: "Point de recherche invalide." };
    return { ok: true, origin: { latitude: target.latitude, longitude: target.longitude, label: target.label ?? "Point de recherche" }, mission: null };
  }
  const { data } = await supabase.from("missions").select("*").eq("id", target.missionId).maybeSingle();
  const m = data as Mission | null;
  if (!m) return { ok: false, error: "Mission introuvable." };
  if (m.archived_at) return { ok: false, error: "Mission archivée." };
  if (m.location_status !== "resolved" || m.latitude === null || m.longitude === null || !isValidCoordinate(m.latitude, m.longitude)) {
    return { ok: false, error: "Le lieu de la mission n'est pas vérifié : la recherche par distance est indisponible. Validez le lieu dans la mission." };
  }
  const label = [m.postal_code, m.city].filter(Boolean).join(" · ") || m.title;
  return { ok: true, origin: { latitude: m.latitude, longitude: m.longitude, label }, mission: m };
}

type RpcRow = {
  id: string; full_name: string; staff_code: string | null; phone: string | null; email: string | null;
  country_code: string; postal_code: string | null; city: string | null; region: string | null;
  latitude: number; longitude: number; location_status: "pending" | "resolved" | "failed"; location_updated_at: string | null;
  availability_status: "available" | "unavailable" | "unknown"; skills: string[]; straight_line_m: number;
};

/** Étape 1 : candidats proches par distance à vol d'oiseau (index + Haversine côté base). Aucun appel au fournisseur d'itinéraires. */
export async function findNearbyCandidates(supabase: SupabaseClient, params: SearchParams): Promise<{ ok: true; data: NearbyResult } | { ok: false; error: string }> {
  const t = await resolveTarget(supabase, params.target);
  if (!t.ok) return t;
  const skills = normalizeSkills(params.skills);

  const { data, error } = await supabase.rpc("staff_within_radius", {
    p_lat: t.origin.latitude,
    p_lon: t.origin.longitude,
    p_radius_m: params.radiusKm * 1000,
    p_availability: params.availability,
    p_skills: skills,
    p_limit: params.maxResults + 1,
  });
  if (error) return { ok: false, error: "Recherche impossible. Vérifiez que les migrations SQL ont été appliquées." };

  const rows = ((data ?? []) as RpcRow[]).filter((r) => isValidCoordinate(r.latitude, r.longitude));
  const truncated = rows.length > params.maxResults;
  const kept = rows.slice(0, params.maxResults);

  let assignments = new Map<string, { id: string; status: AssignmentStatus }>();
  if (t.mission) {
    const { data: a } = await supabase
      .from("mission_staff").select("id, staff_id, assignment_status").eq("mission_id", t.mission.id)
      .in("assignment_status", ["selected", "contacted", "confirmed", "completed"]);
    assignments = new Map(((a ?? []) as { id: string; staff_id: string; assignment_status: AssignmentStatus }[]).map((x) => [x.staff_id, { id: x.id, status: x.assignment_status }]));
  }

  // Transparence : combien de staff correspondent aux filtres mais n'ont pas de localisation vérifiée ?
  let ex = supabase.from("staff").select("id", { count: "exact", head: true }).is("archived_at", null).neq("location_status", "resolved");
  if (params.availability === "available") ex = ex.eq("availability_status", "available");
  if (skills.length > 0) ex = ex.contains("skills", skills);
  const { count: excluded } = await ex;

  const candidates: CandidateDTO[] = kept.map((r) => ({
    id: r.id, fullName: r.full_name, staffCode: r.staff_code, phone: r.phone, email: r.email,
    countryCode: r.country_code, postalCode: r.postal_code, city: r.city, region: r.region,
    latitude: r.latitude, longitude: r.longitude,
    locationStatus: r.location_status, locationUpdatedAt: r.location_updated_at,
    availability: r.availability_status, skills: r.skills,
    // Recalcul applicatif de contrôle ; repli sur la valeur SQL si besoin.
    straightLineM: haversineMeters(t.origin, r) ?? r.straight_line_m,
    assignment: assignments.get(r.id) ?? null,
  }));
  candidates.sort((a, b) => a.straightLineM - b.straightLineM);

  return {
    ok: true,
    data: {
      origin: t.origin,
      mission: t.mission
        ? { id: t.mission.id, title: t.mission.title, status: t.mission.status, requiredStaffCount: t.mission.required_staff_count, transportMode: t.mission.transport_mode, requiredSkills: t.mission.required_skills }
        : null,
      candidates, truncated, excludedUnresolved: excluded ?? 0,
    },
  };
}
