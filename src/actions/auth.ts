"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { COUNTRIES } from "@/config/countries";
import { isSupabaseConfigured, siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { fieldErrorsFrom } from "@/lib/validation";
import { safeNextPath } from "@/lib/utils";

const NOT_CONFIGURED = { ok: false, error: "Supabase n'est pas configuré : renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (voir INSTRUCTIONS.md)." } as const;

const email = z.string().trim().toLowerCase().max(254).pipe(z.email("Adresse e-mail invalide"));
const password = z.string().min(8, "8 caractères minimum").max(128).regex(/[A-Za-z]/, "Ajoutez au moins une lettre").regex(/\d/, "Ajoutez au moins un chiffre");

type AuthErr = { code?: string; status?: number; message: string };
function friendly(e: AuthErr): string {
  if (e.status === 429 || e.code === "over_request_rate_limit" || e.code === "over_email_send_rate_limit") return "Trop de tentatives. Patientez quelques minutes avant de réessayer.";
  switch (e.code) {
    case "invalid_credentials": return "E-mail ou mot de passe incorrect.";
    case "email_not_confirmed": return "Adresse e-mail non confirmée. Vérifiez votre boîte de réception.";
    case "user_already_exists":
    case "email_exists": return "Un compte existe déjà avec cet e-mail. Connectez-vous ou réinitialisez votre mot de passe.";
    case "weak_password": return "Mot de passe trop faible. Utilisez au moins 8 caractères avec lettres et chiffres.";
    case "otp_expired": return "Ce code ou ce lien a expiré. Demandez-en un nouveau.";
    case "signup_disabled": return "Les inscriptions sont désactivées pour ce projet.";
    default: return "Une erreur est survenue. Réessayez dans un instant.";
  }
}

export async function login(raw: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const p = z.object({ email, password: z.string().min(1, "Mot de passe requis"), next: z.string().optional() }).safeParse(raw);
  if (!p.success) return { ok: false, error: "Formulaire invalide", fieldErrors: fieldErrorsFrom(p.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: p.data.email, password: p.data.password });
  if (error) {
    if (error.code === "email_not_confirmed") return { ok: true, data: { redirectTo: `/auth/verify?email=${encodeURIComponent(p.data.email)}` } };
    return { ok: false, error: friendly(error) };
  }
  return { ok: true, data: { redirectTo: safeNextPath(p.data.next) } };
}

export async function signup(raw: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const p = z.object({
    full_name: z.string().trim().min(2, "Nom trop court").max(200),
    email, password, confirm: z.string(),
    company_name: z.string().trim().max(200).optional(),
    country_code: z.string().trim().toUpperCase().refine((c) => c in COUNTRIES, "Choisissez un pays"),
  }).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Les mots de passe ne correspondent pas" }).safeParse(raw);
  if (!p.success) return { ok: false, error: "Formulaire invalide", fieldErrors: fieldErrorsFrom(p.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: p.data.email, password: p.data.password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/dashboard`,
      // Métadonnées lues par le trigger SQL handle_new_user : le profil est créé côté base, avec l'id d'auth.users.
      data: { full_name: p.data.full_name, company_name: p.data.company_name ?? "", country_code: p.data.country_code },
    },
  });
  if (error) return { ok: false, error: friendly(error) };
  // Avec la confirmation d'e-mail activée, un e-mail déjà inscrit renvoie un utilisateur sans identités.
  if (data.user && data.user.identities?.length === 0) return { ok: false, error: friendly({ code: "user_already_exists", message: "" }) };
  if (data.session) return { ok: true, data: { redirectTo: "/dashboard" } };
  return { ok: true, data: { redirectTo: `/auth/verify?email=${encodeURIComponent(p.data.email)}` } };
}

export async function resendConfirmation(raw: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const p = z.object({ email }).safeParse(raw);
  if (!p.success) return { ok: false, error: "Adresse e-mail invalide" };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email: p.data.email, options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/dashboard` } });
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, message: "Nouveau message envoyé" };
}

export async function verifyCode(raw: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const p = z.object({ email, code: z.string().trim().regex(/^\d{6,8}$/, "Code à 6 chiffres") }).safeParse(raw);
  if (!p.success) return { ok: false, error: "Code invalide", fieldErrors: fieldErrorsFrom(p.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: p.data.email, token: p.data.code, type: "signup" });
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, data: { redirectTo: "/dashboard" } };
}

export async function forgotPassword(raw: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const p = z.object({ email }).safeParse(raw);
  if (!p.success) return { ok: false, error: "Adresse e-mail invalide", fieldErrors: fieldErrorsFrom(p.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(p.data.email, { redirectTo: `${siteUrl()}/auth/callback?next=/settings/security` });
  if (error && (error.status === 429 || error.code === "over_email_send_rate_limit")) return { ok: false, error: friendly(error) };
  // Réponse identique que le compte existe ou non (pas d'énumération de comptes).
  return { ok: true, message: "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé." };
}

export async function logout(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
