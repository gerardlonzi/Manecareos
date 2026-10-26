import "server-only";
import { cookies } from "next/headers";

export type Locale = "fr" | "en";
export type Theme = "light" | "dark";

export async function getLocale(): Promise<Locale> {
  return (await cookies()).get("mc_locale")?.value === "en" ? "en" : "fr";
}
export async function getTheme(): Promise<Theme> {
  return (await cookies()).get("mc_theme")?.value === "dark" ? "dark" : "light";
}
/** Traduction côté serveur : `const { t, locale } = await getT(); t("Bonjour", "Hello")`. */
export async function getT() {
  const locale = await getLocale();
  return { locale, t: (fr: string, en: string) => (locale === "fr" ? fr : en) };
}
