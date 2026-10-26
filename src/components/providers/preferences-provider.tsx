"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { localizeMessage } from "@/lib/messages";

type Locale = "fr" | "en";
type Theme = "light" | "dark";
type Preferences = {
  locale: Locale; theme: Theme;
  setLocale: (v: Locale) => void; setTheme: (v: Theme) => void;
  /** Texte bilingue : t("français", "english"). */
  t: (fr: string, en: string) => string;
  /** Traduit un message renvoyé par le serveur (erreurs, confirmations). */
  tm: (message: string | null | undefined) => string;
};
const Context = React.createContext<Preferences | null>(null);

const setCookie = (name: string, value: string) => { document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`; };

export function PreferencesProvider({ children, initialLocale, initialTheme }: { children: React.ReactNode; initialLocale: Locale; initialTheme: Theme }) {
  const router = useRouter();
  const [locale, setLocaleState] = React.useState<Locale>(initialLocale);
  const [theme, setThemeState] = React.useState<Theme>(initialTheme);
  const [pendingNavigation, setPendingNavigation] = React.useState<{ href: string; message: string } | null>(null);

  const setLocale = React.useCallback((v: Locale) => {
    setLocaleState(v);
    setCookie("mc_locale", v);
    document.documentElement.lang = v;
    router.refresh(); // les composants serveur se ré-affichent dans la nouvelle langue
  }, [router]);
  const setTheme = React.useCallback((v: Theme) => {
    setThemeState(v);
    setCookie("mc_theme", v);
    document.documentElement.classList.toggle("dark", v === "dark");
    document.documentElement.style.colorScheme = v;
  }, []);

  React.useEffect(() => {
    const onUnsavedNavigation = (event: Event) => {
      const detail = (event as CustomEvent<{ href: string; message: string }>).detail;
      setPendingNavigation((current) => current ?? detail);
    };
    window.addEventListener("app:unsaved-navigation", onUnsavedNavigation);
    return () => window.removeEventListener("app:unsaved-navigation", onUnsavedNavigation);
  }, []);

  const value = React.useMemo<Preferences>(() => ({
    locale, theme, setLocale, setTheme,
    t: (fr, en) => (locale === "fr" ? fr : en),
    tm: (m) => localizeMessage(m, locale),
  }), [locale, theme, setLocale, setTheme]);

  return (
    <Context.Provider value={value}>
      {children}
      <ConfirmDialog
        open={!!pendingNavigation}
        title={value.t("Quitter sans enregistrer ?", "Leave without saving?")}
        description={pendingNavigation?.message}
        confirmLabel={value.t("Quitter la page", "Leave page")}
        cancelLabel={value.t("Continuer l’édition", "Keep editing")}
        destructive
        onCancel={() => setPendingNavigation(null)}
        onConfirm={() => {
          const href = pendingNavigation?.href;
          setPendingNavigation(null);
          if (href) { const u = new URL(href); router.push(u.pathname + u.search + u.hash); }
        }}
      />
    </Context.Provider>
  );
}
export function usePreferences() {
  const value = React.useContext(Context);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider");
  return value;
}
