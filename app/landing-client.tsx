"use client";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Bell, Bike, Building2, Car, CheckCircle2, Clock3, FileSpreadsheet, Footprints, Globe2, HeartPulse, MapPinned, Menu, Moon, Navigation, ShieldCheck, Sun, TrainFront, Users, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { LinkButton } from "@/components/ui/button";
import { Flag } from "@/components/ui/flag";
import { usePreferences } from "@/components/providers/preferences-provider";
import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/config/app";

/** Révèle son contenu quand il entre à l’écran. */
function Reveal({ children, delay = 0, className, as: Tag = "div" }: { children: React.ReactNode; delay?: number; className?: string; as?: "div" | "li" | "article" }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [seen, setSeen] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Any = Tag as React.ElementType;
  return <Any ref={ref} className={cn("reveal", seen && "in", className)} style={{ "--d": `${delay}s` } as React.CSSProperties}>{children}</Any>;
}

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => { const p = Math.min(1, (t - t0) / 1200); setN(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref} className="tabular-nums">{n}{suffix}</span>;
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <Reveal className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</p>
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {text ? <p className="mt-4 text-base leading-7 text-muted">{text}</p> : null}
    </Reveal>
  );
}

export default function LandingClient({ signedIn }: { signedIn: boolean }) {
  const { t, locale, setLocale, theme, setTheme } = usePreferences();
  const [menu, setMenu] = React.useState(false);
  const nav = [
    { href: "#features", label: t("Fonctionnalités", "Features") },
    { href: "#how", label: t("Comment ça marche", "How it works") },
    { href: "#map", label: t("Recherche par carte", "Map search") },
    { href: "#care", label: t("Pour les maisons de soins", "For care homes") },
    { href: "#faq", label: "FAQ" },
  ];
  const features = [
    { icon: Users, title: t("Un annuaire vivant", "A living directory"), text: t("Coordonnées, photo, compétences, heures hebdomadaires et disponibilité : tout le staff au même endroit, filtrable en direct.", "Contact details, photo, skills, weekly hours and availability: all your staff in one place, filtered live.") },
    { icon: MapPinned, title: t("Recherche par ville ou code postal", "Search by city or postcode"), text: t("Angleterre, Écosse, Pays de Galles, Irlande du Nord, Irlande et pays voisins, avec drapeaux et code postal rempli automatiquement.", "England, Scotland, Wales, Northern Ireland, Ireland and neighbouring countries, with flags and postcode filled automatically.") },
    { icon: Navigation, title: t("Villes voisines", "Neighbouring towns"), text: t("Voyez qui habite dans les villes autour de la mission, avec le nom de la ville et la distance en km.", "See who lives in the towns around an assignment, with town name and distance in km.") },
    { icon: Footprints, title: t("Trajet à pied, vélo, voiture, train", "Walk, bike, car, train"), text: t("Cliquez sur un membre du staff : l’itinéraire se trace sur la carte avec distance et durée par mode.", "Click a staff member: the route is drawn on the map with distance and time for each mode.") },
    { icon: BadgeCheck, title: t("Compétences adaptées aux soins", "Care-specific skills"), text: t("Carer, support worker, RGN, nurse, chef, kitchen assistant, housekeeper… affichés dans la langue de l’utilisateur.", "Carer, support worker, RGN, nurse, chef, kitchen assistant, housekeeper… shown in the user’s language.") },
    { icon: FileSpreadsheet, title: t("Import et export CSV", "CSV import and export"), text: t("Importez votre fichier existant avec aperçu des erreurs, exportez à tout moment les listes filtrées.", "Import your existing file with an error preview, export filtered lists at any time.") },
  ];
  const steps = [
    { icon: Users, title: t("Constituez l’annuaire", "Build the directory"), text: t("Ajoutez des fiches ou importez un CSV. La ville remplit le code postal pour vous.", "Add profiles or import a CSV. Picking a city fills in the postcode for you.") },
    { icon: Building2, title: t("Créez la mission", "Create the assignment"), text: t("Indiquez la maison de soins, l’horaire, l’effectif et les compétences requises.", "Set the care home, schedule, headcount and required skills.") },
    { icon: MapPinned, title: t("Trouvez qui est proche", "Find who is close"), text: t("Rayon, villes voisines, disponibilité et compétences : les meilleurs profils remontent en premier.", "Radius, neighbouring towns, availability and skills: the best matches come first.") },
    { icon: CheckCircle2, title: t("Confirmez", "Confirm"), text: t("Contactez, suivez les statuts et gardez l’historique de chaque affectation.", "Contact, track statuses and keep a history of every assignment.") },
  ];
  const faqs = [
    { q: t("Faut-il installer quelque chose ?", "Do I need to install anything?"), a: t("Non. Manecare fonctionne dans le navigateur, sur ordinateur, tablette et téléphone.", "No. Manecare runs in the browser on desktop, tablet and phone.") },
    { q: t("Le temps de trajet en train est-il un horaire officiel ?", "Is train time an official timetable?"), a: t("Non : c’est une estimation à vitesse moyenne supposée, indiquée comme telle. À la marche, à vélo et en voiture, l’itinéraire vient du service de cartographie.", "No: it is an estimate based on an assumed average speed and is labelled as such. Walking, cycling and driving come from the routing service.") },
    { q: t("Mes données sont-elles privées ?", "Is my data private?"), a: t("Chaque compte ne voit que ses propres données (sécurité au niveau des lignes). Les photos sont stockées dans un espace privé.", "Each account only sees its own data (row-level security). Photos are kept in a private bucket.") },
    { q: t("Quelles langues sont disponibles ?", "Which languages are available?"), a: t("Français et anglais sur toute l’application, y compris les compétences.", "French and English across the whole app, including skills.") },
  ];
  const marquee = [t("Maisons de retraite", "Residential homes"), t("Soins infirmiers", "Nursing homes"), t("Soins à domicile", "Domiciliary care"), t("Démence", "Dementia care"), t("Soins palliatifs", "Palliative care"), t("Handicap", "Learning disability"), t("Vie accompagnée", "Supported living"), t("Remplacements urgents", "Urgent cover")];

  const authButtons = signedIn ? (
    <LinkButton href="/dashboard" size="sm">{t("Tableau de bord", "Dashboard")}</LinkButton>
  ) : (
    <>
      <LinkButton href="/login" variant="ghost" size="sm">{t("Connexion", "Log in")}</LinkButton>
      <LinkButton href="/signup" size="sm">{t("Commencer", "Get started")}</LinkButton>
    </>
  );

  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="glass sticky top-0 z-40 border-b border-line/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand href="/" />
          <nav className="hidden items-center gap-1 lg:flex" aria-label={t("Sections", "Sections")}>
            {nav.map((n) => <a key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-primary-soft hover:text-ink">{n.label}</a>)}
          </nav>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setLocale(locale === "fr" ? "en" : "fr")} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-muted hover:bg-primary-soft" aria-label={t("Changer de langue", "Change language")}><Globe2 className="h-4 w-4" aria-hidden />{locale.toUpperCase()}</button>
            <button type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-primary-soft" aria-label={t("Changer de thème", "Toggle theme")}>{theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</button>
            <div className="hidden items-center gap-1.5 sm:flex">{authButtons}</div>
            <button type="button" onClick={() => setMenu((v) => !v)} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-primary-soft lg:hidden" aria-label="Menu" aria-expanded={menu}>{menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>
        {menu ? (
          <div className="anim-fade border-t border-line px-4 pb-4 pt-2 lg:hidden">
            {nav.map((n) => <a key={n.href} href={n.href} onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-primary-soft">{n.label}</a>)}
            <div className="mt-2 flex gap-2 sm:hidden">{authButtons}</div>
          </div>
        ) : null}
      </header>

      <main>
        {/* 1 — Hero */}
        <section className="relative isolate">
          <div aria-hidden className="absolute inset-0 -z-10 opacity-60 [background:radial-gradient(60rem_30rem_at_80%_-10%,color-mix(in_srgb,var(--color-primary)_22%,transparent),transparent),radial-gradient(40rem_24rem_at_0%_20%,color-mix(in_srgb,var(--color-accent)_10%,transparent),transparent)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
            <div className="stagger">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-3.5 py-1.5 text-xs font-semibold text-primary"><HeartPulse className="h-4 w-4 anim-beat" aria-hidden />{t("Conçu pour les agences de soins", "Built for care agencies")}</p>
              <h1 className="text-4xl font-semibold leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl">{t("Le bon soignant,", "The right carer,")}<br /><span className="text-primary">{t("près de la bonne maison.", "near the right home.")}</span></h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">{t(`${APP_CONFIG.name} aide les agences à retrouver en quelques secondes le personnel disponible autour d’un établissement : par ville, code postal, distance et compétences.`, `${APP_CONFIG.name} helps agencies find available staff around a care home in seconds: by city, postcode, distance and skills.`)}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {signedIn ? <LinkButton href="/dashboard" size="lg">{t("Ouvrir le tableau de bord", "Open the dashboard")} <ArrowRight className="h-4 w-4" aria-hidden /></LinkButton> : (<><LinkButton href="/signup" size="lg">{t("Créer mon espace", "Create my workspace")} <ArrowRight className="h-4 w-4" aria-hidden /></LinkButton><LinkButton href="/login" variant="secondary" size="lg">{t("J’ai déjà un compte", "I already have an account")}</LinkButton></>)}
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                {[t("Français et anglais", "French and English"), t("Mode sombre", "Dark mode"), t("Royaume-Uni et voisins", "UK and neighbours")].map((x) => <li key={x} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" aria-hidden />{x}</li>)}
              </ul>
            </div>
            <Reveal delay={0.1} className="relative">
              <div className="card-surface anim-float relative overflow-hidden p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><MapPinned className="h-4 w-4 text-primary" aria-hidden />Birmingham <Flag flag="gb-eng" /> · B1 1AA</div><span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">12 {t("disponibles", "available")}</span></div>
                <svg viewBox="0 0 400 220" className="w-full rounded-xl bg-primary-soft" role="img" aria-label={t("Aperçu de carte avec itinéraire", "Map preview with route")}>
                  <defs><pattern id="g" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="currentColor" strokeOpacity=".08" /></pattern></defs>
                  <rect width="400" height="220" fill="url(#g)" className="text-ink" />
                  <circle cx="200" cy="110" r="78" fill="none" stroke="var(--color-primary)" strokeOpacity=".35" strokeDasharray="4 6" />
                  <path d="M70 170 C 120 150, 150 120, 200 110" fill="none" stroke="var(--color-primary)" strokeWidth="4" strokeLinecap="round" className="route-draw" pathLength={1000} />
                  <circle cx="200" cy="110" r="9" fill="var(--color-accent)" /><circle cx="200" cy="110" r="9" fill="var(--color-accent)" style={{ animation: "pulse-ring 2s infinite", transformOrigin: "200px 110px" }} />
                  {[[70, 170], [300, 70], [320, 150], [130, 60]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="8" fill="var(--color-primary)" /><circle cx={x} cy={y} r="3" fill="#fff" /></g>)}
                </svg>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                  {[[Footprints, "42 min"], [Bike, "14 min"], [Car, "8 min"], [TrainFront, "~16 min"]].map(([Icon, v], i) => { const I = Icon as typeof Car; return <div key={i} className="rounded-lg border border-line bg-surface-2 py-2"><I className="mx-auto mb-1 h-4 w-4 text-primary" aria-hidden /><span className="font-semibold tabular-nums">{v as string}</span></div>; })}
                </div>
              </div>
              <div className="card-surface absolute -bottom-5 -left-3 hidden items-center gap-3 px-4 py-3 sm:flex" style={{ animation: "float 7s ease-in-out infinite .8s" }}><Bell className="h-4 w-4 text-accent" aria-hidden /><div className="text-xs"><p className="font-semibold">{t("Mission pourvue", "Assignment staffed")}</p><p className="text-muted">3 / 3 carers</p></div></div>
            </Reveal>
          </div>
        </section>

        {/* 2 — Bandeau */}
        <section aria-label={t("Types d’établissements", "Types of services")} className="border-y border-line bg-surface-2 py-5">
          <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
            <div className="flex w-max gap-10 whitespace-nowrap text-sm font-semibold text-muted" style={{ animation: "marquee 32s linear infinite" }}>
              {[...marquee, ...marquee].map((m, i) => <span key={i} className="inline-flex items-center gap-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />{m}</span>)}
            </div>
          </div>
        </section>

        {/* 3 — Chiffres */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[{ n: 60, s: "+", l: t("compétences de soins", "care skills") }, { n: 4, s: "", l: t("modes de trajet comparés", "travel modes compared") }, { n: 50, s: "+", l: t("pays avec drapeaux", "countries with flags") }, { n: 2, s: "", l: t("langues, partout", "languages, everywhere") }].map((s, i) => (
              <Reveal key={i} delay={i * 0.08} className="card-surface p-6 text-center"><p className="text-4xl font-semibold text-primary"><Counter to={s.n} suffix={s.s} /></p><p className="mt-2 text-sm text-muted">{s.l}</p></Reveal>
            ))}
          </div>
        </section>

        {/* 4 — Fonctionnalités */}
        <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-20 sm:px-6">
          <SectionTitle eyebrow={t("Fonctionnalités", "Features")} title={t("Tout ce qu’il faut pour placer du personnel vite", "Everything you need to place staff fast")} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => { const I = f.icon; return (
              <Reveal key={f.title} delay={(i % 3) * 0.08} className="card-surface lift p-6"><span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary"><I className="h-5 w-5" aria-hidden /></span><h3 className="text-base font-semibold">{f.title}</h3><p className="mt-2 text-sm leading-6 text-muted">{f.text}</p></Reveal>
            ); })}
          </div>
        </section>

        {/* 5 — Étapes */}
        <section id="how" className="scroll-mt-20 bg-surface-2 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionTitle eyebrow={t("Comment ça marche", "How it works")} title={t("De la mission au personnel confirmé", "From assignment to confirmed staff")} />
            <ol className="relative grid gap-6 md:grid-cols-4">
              <div aria-hidden className="absolute left-[12%] right-[12%] top-6 hidden border-t-2 border-dashed border-primary/30 md:block" />
              {steps.map((s, i) => { const I = s.icon; return (
                <Reveal as="li" key={s.title} delay={i * 0.12} className="relative text-center"><span className="relative mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary text-white shadow-md"><I className="h-5 w-5" aria-hidden /></span><h3 className="font-semibold">{i + 1}. {s.title}</h3><p className="mx-auto mt-2 max-w-[16rem] text-sm leading-6 text-muted">{s.text}</p></Reveal>
              ); })}
            </ol>
          </div>
        </section>

        {/* 6 — Carte */}
        <section id="map" className="mx-auto grid max-w-7xl scroll-mt-20 items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-primary">{t("Recherche par carte", "Map search")}</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("Cliquez sur une personne, voyez le trajet.", "Click a person, see the journey.")}</h2>
            <p className="mt-4 leading-7 text-muted">{t("Les candidats sont classés par distance. Une section dédiée liste ceux qui vivent dans les villes voisines, avec le nom de la ville et les kilomètres.", "Candidates are ranked by distance. A dedicated section lists those living in neighbouring towns, with the town name and kilometres.")}</p>
            <ul className="mt-6 space-y-3 text-sm">
              {[t("Filtre par code postal ou par ville", "Filter by postcode or city"), t("Option « villes voisines » activable en un clic", "“Neighbouring towns” option in one click"), t("Distance et durée à pied, à vélo, en voiture et en train (estimation)", "Distance and time on foot, by bike, car and train (estimate)")].map((x) => <li key={x} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />{x}</li>)}
            </ul>
          </Reveal>
          <Reveal delay={0.12} className="card-surface overflow-hidden">
            <ul className="divide-y divide-line">
              {[["Sarah K.", "Birmingham", "2.4 km", "Carer · RGN"], ["James O.", "Solihull", "9.8 km", "Support worker"], ["Aisha M.", "Walsall", "14.1 km", "Chef"], ["Peter L.", "Dudley", "17.6 km", "Housekeeper"]].map(([n, c, d, s], i) => (
                <li key={n} className={cn("flex items-center gap-3 px-5 py-3.5", i === 0 && "bg-primary-soft/60")}>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-semibold text-white">{n?.slice(0, 1)}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{n}</span><span className="block truncate text-xs text-muted">{c} · {s}</span></span>
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold tabular-nums">{d}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* 7 — Maisons de soins */}
        <section id="care" className="scroll-mt-20 bg-surface-2 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionTitle eyebrow={t("Pour les maisons de soins", "For care homes")} title={t("Pensé pour le secteur du soin", "Designed for the care sector")} text={t("Les besoins des agences qui envoient du personnel en établissement, au même endroit.", "What agencies sending staff into care homes need, in one place.")} />
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: Clock3, t1: t("Heures hebdomadaires", "Weekly hours"), d: t("Notez les heures que chaque personne souhaite ou peut travailler par semaine.", "Record the hours each person wants or can work per week.") },
                { icon: ShieldCheck, t1: t("Conformité", "Compliance"), d: t("DBS, Care Certificate, manutention, premiers secours : filtrez par certificat.", "DBS, Care Certificate, moving and handling, first aid: filter by certificate.") },
                { icon: Bell, t1: t("Notifications et activité", "Notifications and activity"), d: t("Chaque action est tracée ; marquez, filtrez et exportez l’historique.", "Every action is logged; mark, filter and export the history.") },
              ].map((c, i) => { const I = c.icon; return (
                <Reveal key={c.t1} delay={i * 0.1} className="card-surface lift p-6"><I className="mb-4 h-6 w-6 text-accent" aria-hidden /><h3 className="font-semibold">{c.t1}</h3><p className="mt-2 text-sm leading-6 text-muted">{c.d}</p></Reveal>
              ); })}
            </div>
            <Reveal delay={0.1} className="mt-8 flex flex-wrap justify-center gap-2">
              {["Carer", "Support worker", "RGN", "Nurse", "Chef", "Kitchen assistant", "Housekeeper", "Care assistant"].map((s) => <span key={s} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium">{s}</span>)}
            </Reveal>
          </div>
        </section>

        {/* 8 — FAQ + appel final */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
          <SectionTitle eyebrow="FAQ" title={t("Questions fréquentes", "Frequently asked questions")} />
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <Reveal key={f.q} delay={i * 0.06}><details className="card-surface group p-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">{f.q}<span aria-hidden className="text-primary transition-transform group-open:rotate-45">+</span></summary><p className="mt-3 text-sm leading-6 text-muted">{f.a}</p></details></Reveal>
            ))}
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6">
          <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-white sm:px-12">
            <div aria-hidden className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
            <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">{t("Prêt à placer votre prochain remplacement ?", "Ready to staff your next shift?")}</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/80">{t("Créez votre espace en quelques minutes.", "Set up your workspace in minutes.")}</p>
            <div className="relative mt-8 flex justify-center">
              <Link href={signedIn ? "/dashboard" : "/signup"} className="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-[15px] font-semibold text-[#0b4f7e] shadow-lg hover:scale-[1.02]">{signedIn ? t("Tableau de bord", "Dashboard") : t("Commencer gratuitement", "Get started free")} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line bg-surface-2">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
          <div className="flex items-center gap-3"><Image src="/brand/maneliza-care-logo.png" alt="Maneliza Care" width={120} height={65} className="h-9 w-auto rounded bg-white p-1" /><span>© {new Date().getFullYear()} {APP_CONFIG.company}</span></div>
          <Link href="/privacy" className="hover:text-ink">{t("Confidentialité", "Privacy")}</Link>
        </div>
      </footer>
    </div>
  );
}
