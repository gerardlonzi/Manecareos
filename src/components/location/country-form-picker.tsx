"use client";
import * as React from "react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { countryPickerOptions } from "./country-options";

/** Liste de pays avec drapeaux pour les formulaires HTML classiques (champ caché `name`). La valeur est le code à 2 lettres. */
export function CountryFormPicker({ name, defaultValue = "", id, allLabel }: { name: string; defaultValue?: string; id: string; allLabel?: [string, string] }) {
  const { t, locale } = usePreferences();
  const [value, setValue] = React.useState(defaultValue);
  const options = React.useMemo(() => countryPickerOptions(locale, { allLabel: allLabel ? t(allLabel[0], allLabel[1]) : undefined, dial: true }).filter((o) => !o.value.includes("-")), [allLabel, locale, t]);
  return <SearchablePicker id={id} name={name} value={value} options={options} onValueChange={setValue} searchPlaceholder={t("Rechercher un pays…", "Search country…")} />;
}
