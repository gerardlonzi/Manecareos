/**
 * Jeton signé (HMAC-SHA256, Web Crypto) : utilisable aussi bien dans le proxy (Edge) que dans les actions serveur (Node).
 * Format : `<userId>.<expiresAtSeconds>.<signature hex>`. Le secret ne quitte jamais le serveur.
 */
export const TWO_FACTOR_COOKIE = "mc_2fa";
export const TWO_FACTOR_TTL_SECONDS = 12 * 60 * 60;

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

/** Comparaison en temps constant de deux chaînes hexadécimales de même longueur. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function twoFactorSecret(): string | null {
  const s = process.env.AUTH_2FA_SECRET;
  return s && s.length >= 32 ? s : null;
}

export const isTwoFactorRequired = () => process.env.AUTH_2FA_DISABLED !== "true";

export async function signTwoFactorToken(userId: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  const exp = nowSeconds + TWO_FACTOR_TTL_SECONDS;
  return `${userId}.${exp}.${await hmac(secret, `2fa:${userId}.${exp}`)}`;
}

export async function verifyTwoFactorToken(token: string | undefined | null, userId: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!token || !userId) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [uid, expRaw, sig] = parts as [string, string, string];
  const exp = Number(expRaw);
  if (uid !== userId || !Number.isInteger(exp) || exp <= nowSeconds) return false;
  return safeEqual(sig, await hmac(secret, `2fa:${uid}.${exp}`));
}

/** Empreinte d'un code de connexion, liée à l'utilisateur (un code volé d'un autre compte ne sert à rien). */
export async function hashLoginCode(userId: string, code: string, secret: string): Promise<string> {
  return hmac(secret, `code:${userId}:${code}`);
}
