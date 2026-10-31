"use client";
import * as React from "react";
import { MultiCombobox, type ComboOption } from "@/components/ui/combobox";
import { usePreferences } from "@/components/providers/preferences-provider";
import { SKILL_CATALOG, SKILL_GROUPS, skillLabel, skillSearchText } from "@/config/skills";

/** Options de compétences, libellées dans la langue de l’interface (« carer » en EN, « aide-soignant(e) » en FR) mais cherchables dans les deux. */
export function useSkillOptions(): ComboOption[] {
  const { locale } = usePreferences();
  return React.useMemo(() => SKILL_CATALOG.map((s) => ({ value: s.id, label: s[locale], group: SKILL_GROUPS[s.group][locale], keywords: skillSearchText(s) })), [locale]);
}

export function SkillPicker({ value, onChange, id = "skills-search", placeholder }: { value: string; onChange: (value: string) => void; id?: string; placeholder?: string }) {
  const { t, locale } = usePreferences();
  const options = useSkillOptions();
  const values = React.useMemo(() => value.split(/[;,]/).map((s) => s.trim().toLowerCase()).filter(Boolean), [value]);
  return <MultiCombobox id={id} values={values} onChange={(v) => onChange(v.join(", "))} options={options} renderLabel={(v) => skillLabel(v, locale)}
    placeholder={placeholder ?? t("Ajouter des compétences…", "Add skills…")} searchPlaceholder={t("Rechercher : carer, infirmier, cuisine…", "Search: carer, nurse, kitchen…")} />;
}

/** Compétences compactes sur UNE ligne : les premières, puis « +N ». Aucune bordure superflue. */
export function SkillChips({ skills, max = 2 }: { skills: string[]; max?: number }) {
  const { locale, t } = usePreferences();
  if (!skills?.length) return <span className="text-muted">—</span>;
  const shown = skills.slice(0, max), rest = skills.length - shown.length;
  const all = skills.map((s) => skillLabel(s, locale)).join(", ");
  return (
    <span className="flex max-w-[12rem] flex-wrap items-center gap-1" title={all}>
      {shown.map((s) => <span key={s} className="truncate rounded bg-primary-soft px-1.5 py-0.5 text-[11px] font-medium text-primary">{skillLabel(s, locale)}</span>)}
      {rest > 0 ? <span className="shrink-0 rounded bg-muted/10 px-1.5 py-0.5 text-[11px] font-medium text-muted" aria-label={t(`${rest} autres compétences`, `${rest} more skills`)}>+{rest}</span> : null}
    </span>
  );
}
