"use client";
import { usePreferences } from "./preferences-provider";
export function T({ fr, en, as: Tag = "span" }: { fr: string; en: string; as?: "span" | "p" | "h2" | "h3" | "strong" }) {
  const { t } = usePreferences();
  return <Tag>{t(fr, en)}</Tag>;
}
