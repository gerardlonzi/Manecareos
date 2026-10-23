import Link from "next/link";
import { ArrowRight, CalendarClock, Clock, FileSpreadsheet, MapPinned, Route, ShieldCheck, UserCheck, Users } from "lucide-react";
import { Brand } from "@/components/brand";
import { LinkButton } from "@/components/ui/button";
import { APP_CONFIG } from "@/config/app";

const FEATURES = [
  { icon: Users, title: "Gestion du personnel", text: "Fiches staff, compétences, coordonnées et archivage, dans un annuaire filtrable et paginé." },
  { icon: MapPinned, title: "Recherche géographique", text: "Trouvez les personnes les plus proches d’un lieu de mission, dans un rayon de 5 à 50 km." },
  { icon: CalendarClock, title: "Planification de missions", text: "Créez des missions, fixez l’effectif requis, suivez sélection, contact et confirmation." },
  { icon: Route, title: "Distance et temps de trajet", text: "Distance à vol d’oiseau et trajet réel (voiture, marche, vélo) selon le fournisseur configuré." },
  { icon: UserCheck, title: "Disponibilités", text: "Disponible, indisponible ou inconnue : une disponibilité inconnue n’est jamais comptée comme disponible." },
  { icon: FileSpreadsheet, title: "Import et export CSV", text: "Importez des milliers de fiches avec contrôle des erreurs, exportez vos listes en toute sécurité." },
];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Brand />
          <nav className="flex items-center gap-2" aria-label="Accès">
            <LinkButton href="/login" variant="ghost">Se connecter</LinkButton>
            <LinkButton href="/signup">Commencer</LinkButton>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Outil réservé aux managers
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">{APP_CONFIG.tagline}</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            {APP_CONFIG.name} aide les responsables de planning à identifier, en quelques secondes, les membres du personnel disponibles, compétents et proches d’une mission, puis à comparer distance et temps de trajet estimé.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/signup" size="md">Commencer <ArrowRight className="h-4 w-4" aria-hidden /></LinkButton>
            <LinkButton href="/login" variant="secondary">Se connecter</LinkButton>
          </div>
        </section>

        <section className="border-y border-line bg-surface" aria-labelledby="features">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 id="features" className="text-2xl font-semibold tracking-tight">Tout ce qu’il faut pour pourvoir une mission</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-xl border border-line bg-bg p-5">
                  <span className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-primary-soft text-primary" aria-hidden><Icon className="h-5 w-5" /></span>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-5">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="font-semibold">Localisation enregistrée, pas de suivi GPS</h2>
              <p className="mt-1 text-sm text-muted">
                {APP_CONFIG.name} s’appuie sur la localisation <em>enregistrée</em> dans chaque fiche (code postal et coordonnées approximatives). Il ne suit pas les déplacements des personnes et n’indique jamais où elles se trouvent en ce moment. Les distances et temps de trajet sont des estimations, pas des garanties.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted sm:px-6">
          <span>© {new Date().getFullYear()} {APP_CONFIG.name}</span>
          <Link href="/privacy" className="hover:text-ink hover:underline">Confidentialité</Link>
        </div>
      </footer>
    </div>
  );
}
