/** Les variables NEXT_PUBLIC_* doivent être référencées statiquement pour être injectées côté client. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isPlaceholder = (v: string | undefined) => !v || /YOUR-|your-|placeholder/i.test(v);

export function isSupabaseConfigured(): boolean {
  return !isPlaceholder(url) && !isPlaceholder(key) && /^https?:\/\//.test(url ?? "");
}

export function supabaseEnv(): { url: string; key: string } {
  return { url: url ?? "", key: key ?? "" };
}

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const mapboxPublicToken = () => {
  const t = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  return t && !/your-/i.test(t) ? t : undefined;
};
