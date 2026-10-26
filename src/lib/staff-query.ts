import { APP_CONFIG } from "@/config/app";
import { sanitizeSearchTerm } from "@/lib/utils";

export type StaffFilters = {
  q: string;
  availability: "all" | "available" | "unavailable" | "unknown";
  country: string;
  city: string;
  region: string;
  skill: string;
  location: "all" | "resolved" | "pending" | "failed";
  archived: "active" | "archived" | "all";
  page: number;
  pageSize: number;
};

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const pick = <T extends string>(v: string, allowed: readonly T[], fallback: T): T => ((allowed as readonly string[]).includes(v) ? (v as T) : fallback);

export function parseStaffFilters(sp: Raw): StaffFilters {
  const pageSize = Number(one(sp.pageSize));
  const page = Number(one(sp.page));
  return {
    q: sanitizeSearchTerm(one(sp.q)),
    availability: pick(one(sp.availability), ["all", "available", "unavailable", "unknown"] as const, "all"),
    country: one(sp.country).toUpperCase().slice(0, 2),
    city: sanitizeSearchTerm(one(sp.city)),
    region: sanitizeSearchTerm(one(sp.region)),
    skill: sanitizeSearchTerm(one(sp.skill)).toLowerCase(),
    location: pick(one(sp.location), ["all", "resolved", "pending", "failed"] as const, "all"),
    archived: pick(one(sp.archived), ["active", "archived", "all"] as const, "active"),
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: (APP_CONFIG.pagination.pageSizes as readonly number[]).includes(pageSize) ? pageSize : APP_CONFIG.pagination.defaultPageSize,
  };
}

/** Structure minimale d'un builder PostgREST : suffit pour appliquer les filtres sans dépendre de ses génériques. */
type Filterable<T> = {
  eq(c: string, v: string): T; is(c: string, v: null): T; not(c: string, op: string, v: null): T;
  ilike(c: string, p: string): T; or(f: string): T; contains(c: string, v: string[]): T;
};

export function applyStaffFilters<T extends Filterable<T>>(query: T, f: StaffFilters): T {
  let q = query;
  if (f.archived === "active") q = q.is("archived_at", null);
  if (f.archived === "archived") q = q.not("archived_at", "is", null);
  if (f.availability !== "all") q = q.eq("availability_status", f.availability);
  if (f.location !== "all") q = q.eq("location_status", f.location);
  if (f.country) q = q.eq("country_code", f.country);
  if (f.city) q = q.ilike("city", `%${f.city}%`);
  if (f.region) q = q.ilike("region", `%${f.region}%`);
  if (f.skill) q = q.contains("skills", [f.skill]);
  if (f.q) {
    const like = `%${f.q}%`;
    const branches = [`full_name.ilike.${like}`, `staff_code.ilike.${like}`, `email.ilike.${like}`, `city.ilike.${like}`, `postal_code.ilike.${like}`];
    const digits = f.q.replace(/\D/g, "");
    if (digits.length >= 3) branches.push(`phone.ilike.%${digits}%`);
    const key = f.q.toUpperCase().replace(/[\s-]/g, "");
    if (key.length >= 2) branches.push(`postal_code_normalized.ilike.%${key}%`);
    if (/^[a-z0-9_-]+$/i.test(f.q)) branches.push(`skills.cs.{${f.q.toLowerCase()}}`);
    q = q.or(branches.join(","));
  }
  return q;
}

/** Pour conserver les filtres dans les liens de pagination. */
export function staffFiltersToParams(f: StaffFilters, overrides: Partial<Record<keyof StaffFilters, string | number>> = {}) {
  const base: Record<string, string | number | undefined> = {
    q: f.q, availability: f.availability === "all" ? "" : f.availability, country: f.country, city: f.city, region: f.region, skill: f.skill,
    location: f.location === "all" ? "" : f.location, archived: f.archived === "active" ? "" : f.archived,
    page: f.page === 1 ? "" : f.page, pageSize: f.pageSize === APP_CONFIG.pagination.defaultPageSize ? "" : f.pageSize,
  };
  return { ...base, ...overrides };
}
