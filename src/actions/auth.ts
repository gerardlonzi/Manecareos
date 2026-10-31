"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { COUNTRIES } from "@/config/countries";
import { isSupabaseConfigured, siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { fieldErrorsFrom } from "@/lib/validation";
import { getAuthUser } from "@/lib/auth";
import { clearTwoFactorCookie, setTwoFactorCookie } from "@/lib/security/twofactor";
import { isTwoFactorRequired, twoFactorSecret } from "@/lib/security/token";
import { safeNextPath } from "@/lib/utils";

const NOT_CONFIGURED = { ok: false, error: "Supabase n'est pas configuré : renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (voir INSTRUCTIONS.md)." } as const;

const email = z.string().trim().toLowerCase().max(254).pipe(z.email("Adresse e-mail invalide"));
const password = z.string().min(10, "10 caractères minimum").max(128).regex(/[A-Za-z]/, "Ajoutez au moins une lettre").regex(/\d/, "Ajoutez au moins un chiffre");

type AuthErr = { code?: string; status?: number; message: string };
function friendly(e: AuthErr): string {
  if (e.code === "over_email_send_rate_limit" || /once every \d+ seconds/i.test(e.message)) return "Un e-mail vient d’être envoyé. Patientez 60 secondes avant d’en demander un autre.";
  if (e.status === 429 || e.code === "over_request_rate_limit") return "Trop de tentatives. Patientez quelques minutes avant de réessayer.";
  switch (e.code) {
    case "invalid_credentials": return "E-mail ou mot de passe incorrect.";
    case "email_not_confirmed": return "Adresse e-mail non confirmée. Vérifiez votre boîte de réception.";
    case "user_already_exists":
    case "email_exists": return "Un compte existe déjà avec cet e-mail. Connectez-vous ou réinitialisez votre mot de passe.";
    case "weak_password": return "Mot de passe trop faible. Utilisez au moins 10 caractères avec lettres et chiffres.";
    case "otp_expired": return "Code incorrect ou expiré. Demandez-en un nouveau si besoin.";
    case "signup_disabled": return "Les inscriptions sont désactivées pour ce projet.";
    default:
      if ((e.status ?? 0) >= 500 || /smtp|email/i.test(e.message)) return "L’e-mail de vérification n’a pas pu être envoyé. Vérifiez la configuration SMTP dans Supabase (Authentication → Emails → SMTP).";
      return "Une erreur est survenue. Réessayez dans un instant.";
  }
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Envoie le code à 6 chiffres par e-mail avec Supabase Auth (modèle « Magic Link » : {{ .Token }}). */
async function sendLoginOtp(supabase: SupabaseClient, mail: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.auth.signInWithOtp({ email: mail, options: { shouldCreateUser: false } });
  if (error) {
    console.error("[LOGIN CODE]", { message: error.message, code: error.code, status: error.status });
    return { ok: false, error: friendly(error) };
  }
  return { ok: true };
}

export async function login(raw: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const p = z.object({ email, password: z.string().min(1, "Mot de passe requis"), next: z.string().optional() }).safeParse(raw);
  if (!p.success) return { ok: false, error: "Formulaire invalide", fieldErrors: fieldErrorsFrom(p.error) };
  const supabase = await createClient();
  await clearTwoFactorCookie(); // chaque connexion repart de zéro : le code e-mail est toujours redemandé
  const { data, error } = await supabase.auth.signInWithPassword({ email: p.data.email, password: p.data.password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      await supabase.auth.resend({ type: "signup", email: p.data.email });
      return { ok: true, data: { redirectTo: `/auth/verify?email=${encodeURIComponent(p.data.email)}` } };
    }
    return { ok: false, error: friendly(error) };
  }
  const next = safeNextPath(p.data.next);
  if (!isTwoFactorRequired()) return { ok: true, data: { redirectTo: next } };
  if (!twoFactorSecret()) {
    await supabase.auth.signOut();
    return { ok: false, error: "AUTH_2FA_SECRET manquant dans .env.local (32 caractères minimum)." };
  }

  const sent = await sendLoginOtp(supabase, data.user.email ?? p.data.email);
  if (!sent.ok) {
    await supabase.auth.signOut(); // pas de session à moitié ouverte si le code n'a pas pu être envoyé
    return { ok: false, error: sent.error };
  }
  return { ok: true, data: { redirectTo: `/auth/verify?sent=1&next=${encodeURIComponent(next)}` } };
}

/** Deuxième étape : saisie du code à 6 chiffres reçu par e-mail (contrôlé par Supabase). */
export async function submitLoginCode(raw: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const p = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Code à 6 chiffres"), next: z.string().optional() }).safeParse(raw);
  if (!p.success) return { ok: false, error: "Entrez le code à 6 chiffres.", fieldErrors: fieldErrorsFrom(p.error) };
  const user = await getAuthUser();
  if (!user?.email) return { ok: false, error: "Session expirée. Veuillez vous reconnecter." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email: user.email, token: p.data.code, type: "email" });
  if (error || !data.user) return { ok: false, error: error ? friendly(error) : "Code incorrect ou expiré." };
  await setTwoFactorCookie(data.user.id); // la session est maintenant « vérifiée » pour 12 h
  return { ok: true, data: { redirectTo: safeNextPath(p.data.next) } };
}

export async function resendLoginCode(): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const user = await getAuthUser();
  if (!user?.email) return { ok: false, error: "Session expirée. Veuillez vous reconnecter." };
  const supabase = await createClient();
  const r = await sendLoginOtp(supabase, user.email);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, message: "Nouveau code envoyé" };
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
  if (error) {
    console.error("[SIGNUP ERROR]", { message: error.message, code: error.code, status: error.status });
    return { ok: false, error: friendly(error) };
  }
  // Avec la confirmation d'e-mail activée, un e-mail déjà inscrit renvoie un utilisateur sans identités.
  if (data.user && data.user.identities?.length === 0) return { ok: false, error: friendly({ code: "user_already_exists", message: "" }) };
  if (data.session) {
    // « Confirm email » désactivé dans Supabase : session ouverte directement, on demande alors le code de connexion.
    if (!isTwoFactorRequired()) return { ok: true, data: { redirectTo: "/dashboard" } };
    const sent = await sendLoginOtp(supabase, p.data.email);
    if (!sent.ok) { await supabase.auth.signOut(); return { ok: false, error: sent.error }; }
    return { ok: true, data: { redirectTo: "/auth/verify?sent=1" } };
  }
  // Supabase vient d'envoyer l'e-mail de confirmation (modèle « Confirm signup » : {{ .Token }}).
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
  const p = z.object({ email, code: z.string().trim().regex(/^\d{6}$/, "Code à 6 chiffres") }).safeParse(raw);
  if (!p.success) return { ok: false, error: "Code invalide", fieldErrors: fieldErrorsFrom(p.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email: p.data.email, token: p.data.code, type: "signup" });
  if (error || !data.user) return { ok: false, error: error ? friendly(error) : "Code incorrect ou expiré." };
  // Le code reçu par e-mail prouve déjà la possession de l'adresse : une seule vérification, pas de second code.
  await setTwoFactorCookie(data.user.id);
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
    await clearTwoFactorCookie();
  }
  redirect("/login");
}
