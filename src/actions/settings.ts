"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { APP_CONFIG } from "@/config/app";
import { COUNTRIES } from "@/config/countries";
import { getRoutingCapabilities } from "@/lib/routing/service";
import { isValidTimeZone } from "@/lib/time";
import type { ActionResult } from "@/lib/types";
import { fieldErrorsFrom } from "@/lib/validation";
import { withSession } from "./helpers";

const country = z.string().trim().length(2).transform((v) => v.toUpperCase());

export async function updateProfile(raw: unknown): Promise<ActionResult> {
  return withSession(async ({ supabase, user }) => {
    const p = z.object({
      full_name: z.string().trim().min(1, "Le nom est obligatoire").max(200),
      company_name: z.string().trim().max(200).optional().nullable().transform((v) => v || null),
      country_code: country,
      timezone: z.string().trim().refine(isValidTimeZone, "Fuseau horaire invalide"),
    }).safeParse(raw);
    if (!p.success) return { ok: false, error: "Formulaire invalide", fieldErrors: fieldErrorsFrom(p.error) };
    const { error } = await supabase.from("profiles").update(p.data).eq("id", user.id);
    if (error) return { ok: false, error: "Enregistrement impossible. Réessayez." };
    revalidatePath("/", "layout");
    return { ok: true, message: "Profil mis à jour" };
  });
}

export async function updateLocationPrefs(raw: unknown): Promise<ActionResult> {
  return withSession(async ({ supabase, user }) => {
    const supported = getRoutingCapabilities().supportedModes;
    const p = z.object({
      country_code: country.refine((c) => c in COUNTRIES, "Pays non pris en charge"),
      default_search_radius_km: z.coerce.number().refine((n) => (APP_CONFIG.search.radiiKm as readonly number[]).includes(n), "Rayon non proposé"),
      default_availability_filter: z.enum(["available", "all"]),
      default_transport_mode: z.enum(["driving", "walking", "cycling", "public_transport"]).refine((m) => supported.includes(m), "Mode non pris en charge par le fournisseur d'itinéraires"),
      distance_unit: z.enum(["km", "mi"]),
      allow_fallback_estimates: z.boolean(),
    }).safeParse(raw);
    if (!p.success) return { ok: false, error: "Formulaire invalide", fieldErrors: fieldErrorsFrom(p.error) };
    const { error } = await supabase.from("profiles").update(p.data).eq("id", user.id);
    if (error) return { ok: false, error: "Enregistrement impossible. Réessayez." };
    revalidatePath("/", "layout");
    return { ok: true, message: "Préférences enregistrées" };
  });
}

export async function resetLocationPrefs(): Promise<ActionResult> {
  return withSession(async ({ supabase, user }) => {
    const { error } = await supabase.from("profiles").update({
      default_search_radius_km: APP_CONFIG.search.defaultRadiusKm,
      default_availability_filter: APP_CONFIG.search.defaultAvailability,
      default_transport_mode: "driving",
      distance_unit: COUNTRIES[APP_CONFIG.defaultCountry]?.distanceUnit ?? "km",
      allow_fallback_estimates: false,
    }).eq("id", user.id);
    if (error) return { ok: false, error: "Réinitialisation impossible. Réessayez." };
    revalidatePath("/", "layout");
    return { ok: true, message: "Préférences réinitialisées" };
  });
}

/** Supprime les estimations d'itinéraire en cache du manager (elles seront recalculées à la demande). */
export async function clearRouteCache(): Promise<ActionResult> {
  return withSession(async ({ supabase, user }) => {
    const { error } = await supabase.from("route_estimates").delete().eq("owner_id", user.id);
    if (error) return { ok: false, error: "Suppression impossible. Réessayez." };
    return { ok: true, message: "Cache d'itinéraires vidé" };
  });
}

const passwordSchema = z.string().min(10, "10 caractères minimum").max(128).regex(/[A-Za-z]/, "Ajoutez une lettre").regex(/\d/, "Ajoutez un chiffre");

export async function changePassword(raw: unknown): Promise<ActionResult> {
  return withSession(async ({ supabase }) => {
    const p = z.object({ password: passwordSchema, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Les mots de passe ne correspondent pas" }).safeParse(raw);
    if (!p.success) return { ok: false, error: "Formulaire invalide", fieldErrors: fieldErrorsFrom(p.error) };
    const { error } = await supabase.auth.updateUser({ password: p.data.password });
    if (error) {
      if (error.code === "same_password") return { ok: false, error: "Le nouveau mot de passe doit être différent de l'ancien.", fieldErrors: { password: "Identique à l'ancien" } };
      if (error.code === "weak_password") return { ok: false, error: "Mot de passe trop faible.", fieldErrors: { password: "Trop faible" } };
      return { ok: false, error: "Changement impossible. Reconnectez-vous puis réessayez." };
    }
    return { ok: true, message: "Mot de passe modifié" };
  });
}

export async function signOutOtherSessions(): Promise<ActionResult> {
  return withSession(async ({ supabase }) => {
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) return { ok: false, error: "Opération impossible. Réessayez." };
    return { ok: true, message: "Les autres sessions ont été fermées" };
  });
}

/** Envoi automatique des e-mails de rappel d'expiration aux staffs (tâche quotidienne). */
export async function setAutoEmailDocuments(enabled: boolean): Promise<ActionResult> {
  return withSession(async ({ supabase, user }) => {
    if (typeof enabled !== "boolean") return { ok: false, error: "Requête invalide" };
    const { error } = await supabase.from("profiles").update({ auto_email_documents: enabled }).eq("id", user.id);
    if (error) return { ok: false, error: "Enregistrement impossible. Réessayez." };
    revalidatePath("/settings/documents");
    return { ok: true, message: enabled ? "Envoi automatique activé" : "Envoi automatique désactivé" };
  });
}
