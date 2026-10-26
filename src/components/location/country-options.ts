import { COUNTRY_OPTIONS } from "@/config/countries";
import type { PickerOption } from "@/components/ui/searchable-picker";

/** Options de pays pour les listes déroulantes : drapeau, nom dans la langue choisie, recherche FR + EN + indicatif. Nations du Royaume-Uni et voisins en tête. */
export function countryPickerOptions(locale: "fr" | "en", opts?: { allLabel?: string; dial?: boolean }): PickerOption[] {
  const list = COUNTRY_OPTIONS.map((o) => ({
    value: o.id,
    label: o[locale],
    flag: o.flag,
    description: opts?.dial ? `+${o.dialCode}` : undefined,
    search: `${o.fr} ${o.en} ${o.code} +${o.dialCode}`,
  }));
  return opts?.allLabel ? [{ value: "", label: opts.allLabel }, ...list] : list;
}
/** Un identifiant d'option (« GB-SCT ») → code pays à deux lettres et région éventuelle. */
export function splitOptionId(id: string): { code: string; nation: string | null } {
  const [code, nation] = id.split("-");
  return { code: (code ?? "").toUpperCase(), nation: nation ? ({ ENG: "England", SCT: "Scotland", WLS: "Wales", NIR: "Northern Ireland" } as Record<string, string>)[nation] ?? null : null };
}
