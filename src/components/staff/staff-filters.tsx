"use client";
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { APP_CONFIG } from "@/config/app";
import { COUNTRY_LIST } from "@/config/countries";
import type { StaffFilters } from "@/lib/staff-query";
import { staffFiltersToParams } from "@/lib/staff-query";
import { toQuery } from "@/lib/utils";

type TextKey = "q" | "city" | "region" | "skill";

/** Recherche serveur avec anti-rebond : les champs texte attendent 350 ms, les listes s’appliquent tout de suite. Les filtres vivent dans l’URL. */
export function StaffFiltersBar({ filters }: { filters: StaffFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = React.useState<Record<TextKey, string>>({ q: filters.q, city: filters.city, region: filters.region, skill: filters.skill });
  const first = React.useRef(true);

  const push = React.useCallback((overrides: Record<string, string | number>) => {
    const params = staffFiltersToParams({ ...filters, ...text }, { page: 1, ...overrides });
    router.replace(`${pathname}${toQuery(params)}`);
  }, [filters, text, router, pathname]);

  React.useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => push({}), 350);
    return () => clearTimeout(t);
    // Déclenché uniquement par la saisie de texte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text.q, text.city, text.region, text.skill]);

  const set = (k: TextKey) => (e: React.ChangeEvent<HTMLInputElement>) => setText((t) => ({ ...t, [k]: e.target.value }));
  const hasFilters = Boolean(filters.q || filters.city || filters.region || filters.skill || filters.country || filters.availability !== "all" || filters.location !== "all" || filters.archived !== "active");

  return (
    <form role="search" aria-label="Filtres du staff" className="space-y-3 rounded-xl border border-line bg-surface p-4 shadow-card" onSubmit={(e) => { e.preventDefault(); push({}); }}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input aria-label="Rechercher un staff" placeholder="Nom, code, téléphone, e-mail, code postal, ville, compétence…" className="pl-9" value={text.q} onChange={set("q")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select aria-label="Disponibilité" value={filters.availability} onChange={(e) => push({ availability: e.target.value === "all" ? "" : e.target.value })}>
          <option value="all">Toutes disponibilités</option><option value="available">Disponible</option><option value="unavailable">Indisponible</option><option value="unknown">Inconnue</option>
        </Select>
        <Select aria-label="Pays" value={filters.country} onChange={(e) => push({ country: e.target.value })}>
          <option value="">Tous les pays</option>
          {COUNTRY_LIST.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </Select>
        <Select aria-label="Statut de localisation" value={filters.location} onChange={(e) => push({ location: e.target.value === "all" ? "" : e.target.value })}>
          <option value="all">Toutes localisations</option><option value="resolved">Localisation vérifiée</option><option value="pending">À vérifier</option><option value="failed">À revoir</option>
        </Select>
        <Select aria-label="Archivage" value={filters.archived} onChange={(e) => push({ archived: e.target.value === "active" ? "" : e.target.value })}>
          <option value="active">Actifs</option><option value="archived">Archivés</option><option value="all">Tous</option>
        </Select>
        <Input aria-label="Ville" placeholder="Ville" value={text.city} onChange={set("city")} />
        <Input aria-label="Région" placeholder="Région / comté" value={text.region} onChange={set("region")} />
        <Input aria-label="Compétence" placeholder="Compétence exacte" value={text.skill} onChange={set("skill")} />
        <Select aria-label="Lignes par page" value={filters.pageSize} onChange={(e) => push({ pageSize: e.target.value })}>
          {APP_CONFIG.pagination.pageSizes.map((n) => <option key={n} value={n}>{n} par page</option>)}
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" variant="secondary" size="sm"><Search className="h-4 w-4" aria-hidden /> Appliquer</Button>
        <Button
          variant="ghost" size="sm" disabled={!hasFilters}
          onClick={() => { setText({ q: "", city: "", region: "", skill: "" }); first.current = true; router.replace(pathname); }}
        >
          <X className="h-4 w-4" aria-hidden /> Effacer les filtres
        </Button>
      </div>
    </form>
  );
}
