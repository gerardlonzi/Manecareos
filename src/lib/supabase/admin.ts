import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/env";

/**
 * Client « service » : contourne la RLS. À n'utiliser QUE côté serveur, pour les tâches système
 * (codes de connexion, tâche quotidienne). La clé n'a pas le préfixe NEXT_PUBLIC_ : elle n'est jamais envoyée au navigateur.
 */
export function isAdminConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) && Boolean(supabaseEnv().url);
}

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
  return createClient(supabaseEnv().url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
