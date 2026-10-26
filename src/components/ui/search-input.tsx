"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/providers/preferences-provider";

/** Met à jour des paramètres d’URL sans recharger la page ; remet la pagination à 1. */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = React.useTransition();
  const set = React.useCallback((patch: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === "") next.delete(k); else next.set(k, v); }
    if (!("page" in patch)) next.delete("page");
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }, [params, pathname, router]);
  return { params, set, pending };
}

/** Recherche en direct : filtre pendant la frappe (aucun bouton « Rechercher »). */
export function SearchInput({ param = "q", placeholder, className, delay = 220, onLive }: { param?: string; placeholder?: string; className?: string; delay?: number; onLive?: (value: string) => void }) {
  const { t } = usePreferences();
  const { params, set, pending } = useUrlParams();
  const urlValue = params.get(param) ?? "";
  const [value, setValue] = React.useState(urlValue);
  const last = React.useRef(urlValue);
  React.useEffect(() => { if (urlValue !== last.current) { last.current = urlValue; setValue(urlValue); } }, [urlValue]);
  React.useEffect(() => {
    if (value === last.current) return;
    const id = window.setTimeout(() => { last.current = value; onLive?.(value); set({ [param]: value.trim() || null }); }, delay);
    return () => window.clearTimeout(id);
  }, [value, delay, param, set, onLive]);
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input type="search" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder ?? t("Rechercher…", "Search…")} aria-label={placeholder ?? t("Rechercher", "Search")} autoComplete="off"
        className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:ring-4 focus:ring-primary/10 [&::-webkit-search-cancel-button]:hidden" />
      {pending ? <span className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden /> :
        value ? <button type="button" onClick={() => setValue("")} aria-label={t("Effacer", "Clear")} className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-primary-soft hover:text-ink"><X className="h-3.5 w-3.5" /></button> : null}
    </div>
  );
}
