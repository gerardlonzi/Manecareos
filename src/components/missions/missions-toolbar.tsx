"use client";
import * as React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { SearchInput, useUrlParams } from "@/components/ui/search-input";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { APP_CONFIG } from "@/config/app";
import { countryPickerOptions } from "@/components/location/country-options";
import { usePreferences } from "@/components/providers/preferences-provider";
import type { MissionFilters } from "@/lib/missions-query";

/** Recherche en direct + bouton « Filtres avancés » (bouton normal, pas un champ). */
export function MissionsToolbar({ filters }: { filters: MissionFilters }) {
  const { t, locale } = usePreferences();
  const { set, params } = useUrlParams();
  const [open, setOpen] = React.useState(false);
  const active = ["postal", "city", "country", "status", "staffing", "from", "to"].filter((k) => params.get(k)).length;
  const countries = React.useMemo(() => countryPickerOptions(locale, { allLabel: t("Tous les pays", "All countries") }).filter((o) => !o.value.includes("-")), [locale, t]);
  const statuses = [["", "Tous les statuts", "All statuses"], ["active", "Actives", "Active"], ["needs_staff", "À pourvoir", "Needs staff"], ["draft", "Brouillon", "Draft"], ["open", "Ouverte", "Open"], ["staffing_in_progress", "Recrutement en cours", "Staffing in progress"], ["staffed", "Pourvue", "Staffed"], ["completed", "Terminée", "Completed"], ["cancelled", "Annulée", "Cancelled"]] as const;
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <SearchInput className="min-w-0 flex-1" placeholder={t("Titre ou référence…", "Title or reference…")} />
        <Button variant={active ? "soft" : "secondary"} aria-expanded={open} onClick={() => setOpen((v) => !v)} className="shrink-0">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />{t("Filtres avancés", "Advanced filters")}
          {active ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] text-white">{active}</span> : null}
        </Button>
      </div>
      {open ? (
        <div className="anim-fade grid gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput param="postal" placeholder={t("Code postal", "Postcode")} />
          <SearchInput param="city" placeholder={t("Ville", "City")} />
          <SearchablePicker id="m-country" value={filters.country} onValueChange={(v) => set({ country: v })} options={countries} searchPlaceholder={t("Rechercher un pays…", "Search country…")} />
          <SearchablePicker id="m-status" value={filters.status === "all" ? "" : filters.status} onValueChange={(v) => set({ status: v })} options={statuses.map(([v, fr, en]) => ({ value: v, label: t(fr, en) }))} />
          <SearchablePicker id="m-staffing" value={filters.staffing === "all" ? "" : filters.staffing} onValueChange={(v) => set({ staffing: v })} options={[{ value: "", label: t("Tout avancement", "Any progress") }, { value: "missing", label: t("Effectif incomplet", "Incomplete staffing") }, { value: "complete", label: t("Effectif atteint", "Staffing target met") }]} />
          <Input type="date" aria-label={t("Début à partir du", "Start from")} value={filters.from} onChange={(e) => set({ from: e.target.value })} />
          <Input type="date" aria-label={t("Début jusqu’au", "Start until")} value={filters.to} onChange={(e) => set({ to: e.target.value })} />
          <div className="flex gap-2">
            <SearchablePicker id="m-size" className="flex-1" value={String(filters.pageSize)} onValueChange={(v) => set({ pageSize: v === String(APP_CONFIG.pagination.defaultPageSize) ? "" : v })} options={APP_CONFIG.pagination.pageSizes.map((n) => ({ value: String(n), label: `${n} ${t("par page", "per page")}` }))} />
            <Button variant="ghost" disabled={!active && !params.get("q")} onClick={() => set({ q: "", postal: "", city: "", country: "", status: "", staffing: "", from: "", to: "", pageSize: "" })}><X className="h-4 w-4" aria-hidden />{t("Effacer", "Clear")}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
