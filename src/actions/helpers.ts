import "server-only";
import { getSession, type Session } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

export const UNAUTHENTICATED = { ok: false, error: "Session expirée. Veuillez vous reconnecter." } as const satisfies ActionResult;

export async function withSession<T>(fn: (s: Session) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  const s = await getSession();
  if (!s) return UNAUTHENTICATED;
  try {
    return await fn(s);
  } catch (e) {
    console.error("[action] erreur inattendue:", e instanceof Error ? e.message : e);
    return { ok: false, error: "Une erreur inattendue est survenue. Réessayez." };
  }
}

export const isUniqueViolation = (e: { code?: string } | null | undefined) => e?.code === "23505";
