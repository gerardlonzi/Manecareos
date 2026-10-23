import { APP_CONFIG } from "@/config/app";
import { sanitizeSearchTerm } from "@/lib/utils";

export type MissionFilters = {
  q: string;
  postal: string;
  city: string;
  country: string;
  status: "all" | "active" | "needs_staff" | "draft" | "open" | "staffing_in_progress" | "staffed" | "completed" | "cancelled";
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  staffing: "all" | "missing" | "complete";
  page: number;
  pageSize: number;
};

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const STATUSES = ["all", "active", "needs_staff", "draft", "open", "staffing_in_progress", "staffed", "completed", "cancelled"] as const;
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export function parseMissionFilters(sp: Raw): MissionFilters {
  const status = one(sp.status);
  const staffing = one(sp.staffing);
  const page = Number(one(sp.page));
  const pageSize = Number(one(sp.pageSize));
  return {
    q: sanitizeSearchTerm(one(sp.q)),
    postal: sanitizeSearchTerm(one(sp.postal)),
    city: sanitizeSearchTerm(one(sp.city)),
    country: one(sp.country).toUpperCase().slice(0, 2),
    status: (STATUSES as readonly string[]).includes(status) ? (status as MissionFilters["status"]) : "all",
    from: isDay(one(sp.from)) ? one(sp.from) : "",
    to: isDay(one(sp.to)) ? one(sp.to) : "",
    staffing: staffing === "missing" || staffing === "complete" ? staffing : "all",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: (APP_CONFIG.pagination.pageSizes as readonly number[]).includes(pageSize) ? pageSize : APP_CONFIG.pagination.defaultPageSize,
  };
}

type Filterable<T> = {
  eq(c: string, v: string): T; is(c: string, v: null): T; ilike(c: string, p: string): T; or(f: string): T;
  in(c: string, v: string[]): T; gte(c: string, v: string): T; lte(c: string, v: string): T; gt(c: string, v: number): T;
};

export function applyMissionFilters<T extends Filterable<T>>(query: T, f: MissionFilters): T {
  let q = query.is("archived_at", null);
  if (f.status === "active") q = q.in("status", ["open", "staffing_in_progress", "staffed"]);
  else if (f.status === "needs_staff") q = q.in("status", ["open", "staffing_in_progress"]);
  else if (f.status !== "all") q = q.eq("status", f.status);
  if (f.country) q = q.eq("country_code", f.country);
  if (f.city) q = q.ilike("city", `%${f.city}%`);
  if (f.postal) q = q.ilike("postal_code", `%${f.postal}%`);
  if (f.from) q = q.gte("scheduled_start_at", `${f.from}T00:00:00Z`);
  if (f.to) q = q.lte("scheduled_start_at", `${f.to}T23:59:59Z`);
  if (f.staffing === "missing") q = q.gt("missing_count", 0);
  if (f.staffing === "complete") q = q.eq("missing_count", "0");
  if (f.q) q = q.or(`title.ilike.%${f.q}%,mission_reference.ilike.%${f.q}%`);
  return q;
}

export function missionFiltersToParams(f: MissionFilters, overrides: Record<string, string | number> = {}) {
  return {
    q: f.q, postal: f.postal, city: f.city, country: f.country,
    status: f.status === "all" ? "" : f.status, from: f.from, to: f.to, staffing: f.staffing === "all" ? "" : f.staffing,
    page: f.page === 1 ? "" : f.page, pageSize: f.pageSize === APP_CONFIG.pagination.defaultPageSize ? "" : f.pageSize,
    ...overrides,
  };
}
