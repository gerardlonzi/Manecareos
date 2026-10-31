"use client";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { usePreferences } from "@/components/providers/preferences-provider";

type Text = string | string[];
export type LegalSection = { id: string; fr: string; en: string; body: { fr: Text; en: Text }[] };

function Rich({ text }: { text: Text }) {
  if (Array.isArray(text)) return <ul className="list-disc space-y-1.5 pl-5">{text.map((x) => <li key={x}>{x}</li>)}</ul>;
  return <p>{text}</p>;
}

/** Gabarit des pages légales : bilingue FR/EN, sommaire cliquable, bascule de langue. */
export function LegalPage({ title, updated, intro, sections, contactEmail }: { title: { fr: string; en: string }; updated: string; intro: { fr: string; en: string }; sections: LegalSection[]; contactEmail?: string }) {
  const { t, locale, setLocale } = usePreferences();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <div className="flex items-center justify-between gap-4">
        <Brand href="/" />
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label={t("Langue", "Language")}>
            {(["fr", "en"] as const).map((l) => <button key={l} type="button" onClick={() => setLocale(l)} aria-pressed={locale === l} className={`h-7 rounded-md px-2 text-[11px] font-bold uppercase ${locale === l ? "bg-primary text-white" : "text-muted hover:text-ink"}`}>{l}</button>)}
          </div>
          <Link href="/" className="text-sm text-muted hover:text-ink">{t("← Retour", "← Back")}</Link>
        </div>
      </div>
      <h1 className="mt-10 text-3xl font-semibold tracking-tight">{title[locale]}</h1>
      <p className="mt-1 text-xs text-muted">{t(`Dernière mise à jour : ${updated}`, `Last updated: ${updated}`)}</p>
      <p className="mt-5 text-sm leading-7 text-muted">{intro[locale]}</p>

      <nav aria-label={t("Sommaire", "Contents")} className="mt-6 rounded-xl border border-line bg-surface p-4">
        <ol className="grid gap-1 text-sm sm:grid-cols-2">{sections.map((s, i) => <li key={s.id}><a href={`#${s.id}`} className="text-primary hover:underline">{i + 1}. {s[locale]}</a></li>)}</ol>
      </nav>

      <div className="mt-8 space-y-9">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-ink">{i + 1}. {s[locale]}</h2>
            <div className="mt-3 space-y-3 text-sm leading-7 text-muted">{s.body.map((b, k) => <Rich key={k} text={b[locale]} />)}</div>
          </section>
        ))}
      </div>
      {contactEmail ? <p className="mt-10 border-t border-line pt-4 text-sm text-muted">{t("Contact :", "Contact:")} <a className="text-primary hover:underline" href={`mailto:${contactEmail}`}>{contactEmail}</a></p> : null}
    </main>
  );
}
