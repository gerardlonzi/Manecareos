"use client";
import * as React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput, useUrlParams } from "@/components/ui/search-input";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { APP_CONFIG } from "@/config/app";
import { SKILL_CATALOG, skillSearchText } from "@/config/skills";
import { countryPickerOptions } from "@/components/location/country-options";
import type { StaffFilters } from "@/lib/staff-query";
import { usePreferences } from "@/components/providers/preferences-provider";

/** Barre collante : recherche en direct (pas de bouton) + filtres déroulants avec recherche. Tout vit dans l’URL. */
export function StaffToolbar({ filters }: { filters: StaffFilters }) {
  const { t, locale } = usePreferences();
  const { set, params } = useUrlParams();
  const [open, setOpen] = React.useState(false);
  const active = ["availability", "country", "location", "archived", "skill", "city", "region"].filter((k) => params.get(k)).length;
  const countries = React.useMemo(() => countryPickerOptions(locale, { allLabel: t("Tous les pays", "All countries") }).filter((o) => !o.value.includes("-")), [locale, t]);
  const skills = React.useMemo(() => [{ value: "", label: t("Toutes les compétences", "All skills") }, ...SKILL_CATALOG.map((s) => ({ value: s.id, label: s[locale], search: skillSearchText(s) }))], [locale, t]);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <SearchInput className="min-w-0 flex-1" placeholder={t("Nom, code, téléphone, e-mail, code postal, ville, compétence…", "Name, ID, phone, email, postcode, city, skill…")} />
        <Button variant={active ? "soft" : "secondary"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">{t("Filtres", "Filters")}</span>
          {active ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] text-white">{active}</span> : null}
        </Button>
      </div>
      {open ? (
        <div className="anim-fade grid gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-4">
          <SearchablePicker id="f-avail" value={filters.availability === "all" ? "" : filters.availability} onValueChange={(v) => set({ availability: v })}
            options={[{ value: "", label: t("Toutes disponibilités", "Any availability") }, { value: "available", label: t("Disponible", "Available"), dot: "green" as const }, { value: "unavailable", label: t("Indisponible", "Unavailable"), dot: "red" as const }, { value: "unknown", label: t("Inconnue", "Unknown"), dot: "amber" as const }]} />
          <SearchablePicker id="f-country" value={filters.country} onValueChange={(v) => set({ country: v })} options={countries} searchPlaceholder={t("Rechercher un pays…", "Search country…")} />
          <SearchablePicker id="f-skill" value={filters.skill} onValueChange={(v) => set({ skill: v })} options={skills} searchPlaceholder={t("Rechercher une compétence…", "Search skill…")} />
          <SearchablePicker id="f-loc" value={filters.location === "all" ? "" : filters.location} onValueChange={(v) => set({ location: v })}
            options={[{ value: "", label: t("Toutes localisations", "Any location status") }, { value: "resolved", label: t("Vérifiée", "Verified") }, { value: "pending", label: t("À vérifier", "Needs checking") }, { value: "failed", label: t("À revoir", "Needs review") }]} />
          <SearchInput param="city" placeholder={t("Ville", "City")} />
          <SearchInput param="region" placeholder={t("Région / comté", "Region / county")} />
          <SearchablePicker id="f-arch" value={filters.archived === "active" ? "" : filters.archived} onValueChange={(v) => set({ archived: v })}
            options={[{ value: "", label: t("Actifs", "Active") }, { value: "archived", label: t("Archivés", "Archived") }, { value: "all", label: t("Tous", "All") }]} />
          <div className="flex gap-2">
            <SearchablePicker id="f-size" className="flex-1" value={String(filters.pageSize)} onValueChange={(v) => set({ pageSize: v === String(APP_CONFIG.pagination.defaultPageSize) ? "" : v })} options={APP_CONFIG.pagination.pageSizes.map((n) => ({ value: String(n), label: `${n} ${t("par page", "per page")}` }))} />
            <Button variant="ghost" disabled={!active && !params.get("q")} onClick={() => set({ q: "", availability: "", country: "", skill: "", location: "", archived: "", city: "", region: "", pageSize: "" })}><X className="h-4 w-4" aria-hidden />{t("Effacer", "Clear")}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
