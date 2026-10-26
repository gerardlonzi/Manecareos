import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PHOTO_BUCKET = "staff-photos";
export const PHOTO_URL_TTL_SECONDS = 3600;

/**
 * URL signées (1 h) des photos de staff, indexées par id de staff.
 * Ne lève jamais : bucket absent, droits insuffisants ou erreur réseau → on renvoie ce qui a pu être signé
 * (au pire une table vide) et l'interface retombe sur les initiales.
 */
export async function signPhotoUrls(
  supabase: SupabaseClient,
  items: { id: string; photo_path?: string | null }[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const withPath = items.filter((i): i is { id: string; photo_path: string } => typeof i.photo_path === "string" && i.photo_path.length > 0);
  if (withPath.length === 0) return out;
  try {
    const paths = [...new Set(withPath.map((i) => i.photo_path))];
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, PHOTO_URL_TTL_SECONDS);
    if (error || !data) return out;
    const byPath = new Map<string, string>();
    for (const row of data) {
      if (row.path && row.signedUrl && !row.error) byPath.set(row.path, row.signedUrl);
    }
    for (const i of withPath) {
      const url = byPath.get(i.photo_path);
      if (url) out[i.id] = url;
    }
  } catch {
    // volontairement silencieux : les photos sont un confort, jamais bloquantes.
  }
  return out;
}

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export type PhotoType = { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

/** Détecte le vrai format à partir des octets de tête (le type MIME envoyé par le navigateur n'est jamais cru). */
export function detectPhotoType(bytes: Uint8Array): PhotoType | null {
  const at = (i: number) => bytes[i] ?? -1;
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => at(i) === b)) return { mime: "image/png", ext: "png" };
  if (
    bytes.length >= 12 &&
    [0x52, 0x49, 0x46, 0x46].every((b, i) => at(i) === b) && // "RIFF"
    [0x57, 0x45, 0x42, 0x50].every((b, i) => at(8 + i) === b) // "WEBP"
  ) return { mime: "image/webp", ext: "webp" };
  return null;
}
