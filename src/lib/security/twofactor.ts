import "server-only";
import { cookies } from "next/headers";
import { TWO_FACTOR_COOKIE, TWO_FACTOR_TTL_SECONDS, isTwoFactorRequired, signTwoFactorToken, twoFactorSecret, verifyTwoFactorToken } from "./token";

/**
 * Le code à 6 chiffres est envoyé et contrôlé par Supabase Auth (signInWithOtp / verifyOtp).
 * Ce module ne gère que le cookie signé qui prouve, côté serveur et proxy, que le code a bien été saisi.
 */

/** Cookie de vérification valide pour cet utilisateur ? (true si la vérification est désactivée explicitement en développement). */
export async function hasValidTwoFactor(userId: string): Promise<boolean> {
  if (!isTwoFactorRequired()) return true;
  const secret = twoFactorSecret();
  if (!secret) return false; // sans secret configuré, on refuse : jamais d'accès « par défaut »
  const jar = await cookies();
  return verifyTwoFactorToken(jar.get(TWO_FACTOR_COOKIE)?.value, userId, secret);
}

export async function setTwoFactorCookie(userId: string): Promise<void> {
  const secret = twoFactorSecret();
  if (!secret) return;
  const jar = await cookies();
  jar.set(TWO_FACTOR_COOKIE, await signTwoFactorToken(userId, secret), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TWO_FACTOR_TTL_SECONDS });
}

export async function clearTwoFactorCookie(): Promise<void> {
  (await cookies()).delete(TWO_FACTOR_COOKIE);
}
