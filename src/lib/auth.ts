import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { APP_CONFIG } from "@/config/app";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export type Session = { supabase: SupabaseClient; user: User; profile: Profile };

function fallbackProfile(user: User): Profile {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: user.id,
    full_name: typeof meta.full_name === "string" ? meta.full_name : "",
    company_name: typeof meta.company_name === "string" ? meta.company_name : null,
    country_code: APP_CONFIG.defaultCountry,
    timezone: "UTC",
    default_search_radius_km: APP_CONFIG.search.defaultRadiusKm,
    default_transport_mode: "driving",
    default_availability_filter: APP_CONFIG.search.defaultAvailability,
    distance_unit: "km",
    allow_fallback_estimates: false,
  };
}

/** Session de l'utilisateur courant, ou null. Utilise getUser() : le jeton est vérifié auprès de Supabase Auth. */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  return { supabase, user: data.user, profile: (profile as Profile | null) ?? fallbackProfile(data.user) };
});

/** Pour les pages et layouts privés. */
export async function requireSession(): Promise<Session> {
  if (!isSupabaseConfigured()) redirect("/login?error=config");
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
