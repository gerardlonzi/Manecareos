"use server";

import { logActivity } from "@/lib/activity";
import { haversineMeters, isValidCoordinate } from "@/lib/geo/haversine";
import { resolveLocation } from "@/lib/location/service";
import { approximateEstimate } from "@/lib/routing/fallback";
import { getRouteEstimates, getRoutingCapabilities, getRoutingProvider } from "@/lib/routing/service";
import type { RouteEstimate } from "@/lib/routing/types";
import { findNearbyCandidates, resolveTarget, searchParamsSchema } from "@/lib/search";
import type { NearbyResult, RouteMap, RoutingCapabilitiesDTO, SearchTarget } from "@/lib/search-types";
import type { ActionResult, TransportMode } from "@/lib/types";
import { fieldErrorsFrom, locationInputSchema } from "@/lib/validation";
import { withSession } from "./helpers";
import { z } from "zod";

export async function getRoutingInfo(): Promise<RoutingCapabilitiesDTO> {
  return getRoutingCapabilities();
}

/** Étape 1 de la recherche : distance à vol d'oiseau uniquement. Rapide, sans fournisseur d'itinéraires. */
export async function searchNearby(raw: unknown): Promise<ActionResult<NearbyResult>> {
  return withSession(async ({ supabase }) => {
    const p = searchParamsSchema.safeParse(raw);
    if (!p.success) return { ok: false, error: "Paramètres de recherche invalides", fieldErrors: fieldErrorsFrom(p.error) };
    const r = await findNearbyCandidates(supabase, p.data);
    return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error };
  });
}

const estimateSchema = z.object({
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("mission"), missionId: z.uuid() }),
    z.object({ kind: z.literal("point"), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), label: z.string().max(200).optional() }),
  ]),
  staffIds: z.array(z.uuid()).min(1).max(60),
  mode: z.enum(["driving", "walking", "cycling", "public_transport"]),
  refresh: z.boolean().optional(),
});

/**
 * Étape 2 : itinéraires réels pour un lot borné de candidats.
 * Les origines sont relues en base sous RLS : on ne peut pas calculer de trajet pour un staff qui n'est pas à soi.
 */
export async function estimateRoutes(raw: unknown): Promise<ActionResult<{ estimates: RouteMap; capabilities: RoutingCapabilitiesDTO }>> {
  return withSession(async ({ supabase, user, profile }) => {
    const p = estimateSchema.safeParse(raw);
    if (!p.success) return { ok: false, error: "Requête invalide" };
    const t = await resolveTarget(supabase, p.data.target as SearchTarget);
    if (!t.ok) return { ok: false, error: t.error };

    const { data } = await supabase
      .from("staff").select("id, latitude, longitude")
      .in("id", p.data.staffIds).eq("location_status", "resolved").is("archived_at", null);
    const origins = ((data ?? []) as { id: string; latitude: number; longitude: number }[])
      .filter((s) => isValidCoordinate(s.latitude, s.longitude))
      .map((s) => ({ id: s.id, latitude: s.latitude, longitude: s.longitude }));
    if (origins.length === 0) return { ok: false, error: "Aucun staff éligible au calcul d'itinéraire." };

    const map = await getRouteEstimates(supabase, user.id, origins, t.origin, p.data.mode as TransportMode, { forceRefresh: p.data.refresh });
    const estimates: RouteMap = {};
    const failures = new Set<string>();

    for (const o of origins) {
      let est: RouteEstimate | undefined = map.get(o.id);
      if (!est) continue; // au-delà du lot borné : « non calculé », jamais inventé
      // Repli approximatif : uniquement si le manager l'a autorisé, étiqueté « approximate », jamais pour un trajet réel.
      if (est.status !== "ok" && profile.allow_fallback_estimates) {
        const approx = approximateEstimate(p.data.mode as TransportMode, { straightLineM: haversineMeters(o, t.origin) });
        if (approx) est = approx;
      }
      if (est.status === "error" || est.status === "rate_limited") failures.add(est.status);
      estimates[o.id] = est;
    }

    if (failures.size > 0) {
      await logActivity(supabase, user.id, {
        event_type: "routing_failed",
        mission_id: p.data.target.kind === "mission" ? p.data.target.missionId : null,
        description: `Calcul d'itinéraire en échec (${[...failures].join(", ")}) pour le mode ${p.data.mode}`,
        metadata: { mode: p.data.mode, statuses: [...failures] },
      });
    }
    return { ok: true, data: { estimates, capabilities: getRoutingCapabilities() } };
  });
}

/** Tracé réel d'un itinéraire, uniquement si le fournisseur en renvoie un. Jamais de ligne droite déguisée. */
export async function getRouteGeometry(raw: unknown): Promise<ActionResult<{ coordinates: [number, number][] | null }>> {
  return withSession(async ({ supabase }) => {
    const p = z.object({ target: estimateSchema.shape.target, staffId: z.uuid(), mode: estimateSchema.shape.mode }).safeParse(raw);
    if (!p.success) return { ok: false, error: "Requête invalide" };
    const t = await resolveTarget(supabase, p.data.target as SearchTarget);
    if (!t.ok) return { ok: false, error: t.error };
    const { data } = await supabase.from("staff").select("latitude, longitude").eq("id", p.data.staffId).eq("location_status", "resolved").maybeSingle();
    if (!data || !isValidCoordinate(data.latitude, data.longitude)) return { ok: false, error: "Staff introuvable ou non localisé." };
    const geom = await getRoutingProvider().routeGeometry({ latitude: data.latitude, longitude: data.longitude }, t.origin, p.data.mode as TransportMode);
    return { ok: true, data: { coordinates: geom?.coordinates ?? null } };
  });
}

/** Résout un point de référence (code postal / ville) pour la recherche libre. */
export async function geocodeSearchPoint(raw: unknown): Promise<ActionResult<{ latitude: number; longitude: number; label: string }>> {
  return withSession(async () => {
    const p = locationInputSchema.safeParse(raw);
    if (!p.success) return { ok: false, error: "Recherche invalide", fieldErrors: fieldErrorsFrom(p.error) };
    const r = await resolveLocation({ countryCode: p.data.country_code, postalCode: p.data.postal_code, city: p.data.city, region: p.data.region });
    if (!r.ok) return { ok: false, error: r.message };
    return { ok: true, data: { latitude: r.latitude, longitude: r.longitude, label: r.label } };
  });
}

