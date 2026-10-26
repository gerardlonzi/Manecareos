import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Autorise uniquement les chemins relatifs internes (anti open-redirect). */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

export function formatDateTime(iso: string | null | undefined, timeZone = "UTC"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone }).format(d);
  } catch {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(d);
  }
}

export function formatDate(iso: string | null | undefined, timeZone = "UTC"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone }).format(d);
  } catch {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(d);
  }
}

/** Query-string à partir d'un objet, en ignorant les valeurs vides. */
export function toQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v) !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Supprime les caractères qui ont un sens dans la syntaxe de filtre PostgREST (.or(), ilike). */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()%*\\"':;{}[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function normalizeSkills(input: string | string[] | null | undefined): string[] {
  const list = Array.isArray(input) ? input : (input ?? "").split(/[;|,\n]/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of list) {
    const t = s.trim().toLowerCase();
    if (t && t.length <= 60 && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out.slice(0, 30);
}
