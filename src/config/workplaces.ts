/** Lieux de travail d'une mission (type d'établissement). */
export const WORKPLACE_TYPES = [
  { value: "care_home", fr: "Maison de retraite", en: "Care home" },
  { value: "nursing_home", fr: "Maison de soins médicalisée", en: "Nursing home" },
  { value: "hospital", fr: "Hôpital", en: "Hospital" },
  { value: "clinic", fr: "Clinique / cabinet médical", en: "Clinic / surgery" },
  { value: "private_home", fr: "Domicile du patient", en: "Private home" },
  { value: "supported_living", fr: "Logement accompagné", en: "Supported living" },
  { value: "hospice", fr: "Hospice / soins palliatifs", en: "Hospice / palliative care" },
  { value: "other", fr: "Autre", en: "Other" },
] as const;
export type WorkplaceType = (typeof WORKPLACE_TYPES)[number]["value"];
export const WORKPLACE_VALUES = WORKPLACE_TYPES.map((w) => w.value) as [WorkplaceType, ...WorkplaceType[]];

export function workplaceLabel(type: string | null | undefined, name: string | null | undefined, locale: "fr" | "en"): string | null {
  const w = WORKPLACE_TYPES.find((x) => x.value === type);
  const label = w ? (locale === "fr" ? w.fr : w.en) : null;
  return [label, name].filter(Boolean).join(" — ") || null;
}
