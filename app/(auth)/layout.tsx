"use client";
import { Globe2, MapPinned, Moon, ShieldCheck, Sun, Users, Clock3 } from "lucide-react";
import { Brand } from "@/components/brand";
import { usePreferences } from "@/components/providers/preferences-provider";
import { APP_CONFIG } from "@/config/app";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { locale, setLocale, theme, setTheme, t } = usePreferences();
  const pts = [
    { i: MapPinned, x: t("Trouvez le staff près de chaque maison de soins", "Find staff near every care home") },
    { i: Users, x: t("Compétences de soins, photos et heures hebdomadaires", "Care skills, photos and weekly hours") },
    { i: Clock3, x: t("Trajets à pied, à vélo, en voiture et en train", "Walking, cycling, driving and train journeys") },
  ];
  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[minmax(380px,.9fr)_1.1fr]">
      <aside className="relative hidden min-h-dvh flex-col overflow-hidden bg-[#06324f] p-12 text-white lg:flex">
        <div aria-hidden className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#039df5]/25 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#9f1013]/25 blur-3xl" />
        <div className="relative z-10"><Brand href="/" inverse size={40} /></div>
        <div className="relative z-10 my-auto max-w-lg stagger">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">{t("Le bon soignant, près de la bonne maison.", "The right carer, near the right home.")}</h1>
          <ul className="mt-8 space-y-4">{pts.map(({ i: I, x }) => <li key={x} className="flex items-center gap-3 text-white/85"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10"><I className="h-4 w-4" aria-hidden /></span>{x}</li>)}</ul>
        </div>
        <p className="relative z-10 text-xs text-white/50">© {new Date().getFullYear()} {APP_CONFIG.company}</p>
      </aside>
      <section className="flex min-h-dvh flex-col px-5 py-5 sm:px-8">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="lg:hidden"><Brand /></div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setLocale(locale === "fr" ? "en" : "fr")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-muted hover:bg-primary-soft"><Globe2 className="h-4 w-4" aria-hidden />{locale.toUpperCase()}</button>
            <button type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-muted hover:bg-primary-soft" aria-label={t("Changer de thème", "Toggle theme")}>{theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</button>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-10">
          <div className="anim-rise p-6 sm:p-8">{children}</div>
          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />{t("Vos données restent privées à votre compte.", "Your data stays private to your account.")}</p>
        </div>
      </section>
    </main>
  );
}
