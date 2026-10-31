import "server-only";
import { createHash } from "node:crypto";

/**
 * Cloudinary, sans SDK : envoi signé côté serveur et téléchargement par lien temporaire.
 * Les fichiers sont déposés en mode « authenticated » : aucune URL publique n'existe, l'accès passe toujours par notre serveur.
 */
export const DOC_MAX_BYTES = 5 * 1024 * 1024;
export const DOC_MIME = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

export function cloudinaryConfigured(): boolean {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) && !/your-/i.test(process.env.CLOUDINARY_API_SECRET ?? "");
}

const cfg = () => ({ cloud: process.env.CLOUDINARY_CLOUD_NAME!, key: process.env.CLOUDINARY_API_KEY!, secret: process.env.CLOUDINARY_API_SECRET! });

/** Signature Cloudinary : paramètres triés `k=v&k=v` + secret, SHA-1 hexadécimal. */
export function signParams(params: Record<string, string | number>, secret: string): string {
  const base = Object.keys(params).filter((k) => params[k] !== "" && params[k] !== undefined).sort().map((k) => `${k}=${params[k]}`).join("&");
  return createHash("sha1").update(base + secret).digest("hex");
}

/** Type réel d'après les premiers octets (le type annoncé par le navigateur n'est jamais cru). */
export function detectDocumentType(bytes: Uint8Array): keyof typeof DOC_MIME | null {
  const b = bytes;
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "application/pdf";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

export type UploadedFile = { publicId: string; resourceType: "image" | "raw" | "video"; format: string; bytes: number };

export async function uploadPrivateFile(file: Uint8Array, mime: keyof typeof DOC_MIME, folder: string): Promise<{ ok: true; file: UploadedFile } | { ok: false; error: string }> {
  if (!cloudinaryConfigured()) return { ok: false, error: "Stockage de fichiers non configuré (Cloudinary)." };
  const { cloud, key, secret } = cfg();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder, timestamp, type: "authenticated", use_filename: "false", unique_filename: "true", overwrite: "false" };
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.append(k, String(v));
  form.append("api_key", key);
  form.append("signature", signParams(params, secret));
  form.append("file", new Blob([file as BlobPart], { type: mime }), `document.${DOC_MIME[mime]}`);
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/auto/upload`, { method: "POST", body: form, signal: AbortSignal.timeout(30_000) });
    const json = (await res.json().catch(() => ({}))) as { public_id?: string; resource_type?: string; format?: string; bytes?: number; error?: { message?: string } };
    if (!res.ok || !json.public_id) { console.error("[cloudinary] envoi refusé:", res.status, json.error?.message); return { ok: false, error: "L’envoi du fichier a échoué." }; }
    const rt = json.resource_type === "raw" || json.resource_type === "video" ? json.resource_type : "image";
    return { ok: true, file: { publicId: json.public_id, resourceType: rt, format: json.format ?? DOC_MIME[mime], bytes: json.bytes ?? file.length } };
  } catch (e) {
    console.error("[cloudinary] erreur réseau:", e instanceof Error ? e.message : e);
    return { ok: false, error: "L’envoi du fichier a échoué." };
  }
}

export async function deletePrivateFile(publicId: string, resourceType: string): Promise<void> {
  if (!cloudinaryConfigured()) return;
  const { cloud, key, secret } = cfg();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id: publicId, timestamp, type: "authenticated", invalidate: "true" };
  const form = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: key, signature: signParams(params, secret) });
  try {
    await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/destroy`, { method: "POST", body: form, signal: AbortSignal.timeout(15_000) });
  } catch (e) {
    console.error("[cloudinary] suppression impossible:", e instanceof Error ? e.message : e);
  }
}

/** Lien de téléchargement signé, valable quelques minutes. */
export function privateDownloadUrl(publicId: string, format: string, resourceType: string, ttlSeconds = 120): string {
  const { cloud, key, secret } = cfg();
  const now = Math.floor(Date.now() / 1000);
  const params = { public_id: publicId, format, type: "authenticated", expires_at: now + ttlSeconds, timestamp: now };
  const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: key, signature: signParams(params, secret) });
  return `https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/download?${q}`;
}
