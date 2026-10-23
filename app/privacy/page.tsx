import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { APP_CONFIG } from "@/config/app";

export const metadata: Metadata = { title: "Confidentialité" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Brand />
      <h1 className="mt-8 text-2xl font-semibold">Notice de confidentialité</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted">
        <p>{APP_CONFIG.name} permet à un manager de gérer des fiches de personnel. Ces fiches contiennent des données personnelles (nom, téléphone, e-mail, code postal, ville) dont le manager est responsable.</p>
        <p><strong className="text-ink">Accès.</strong> Chaque manager accède uniquement à ses propres données. Les personnes dont la fiche est enregistrée n’ont pas de compte ; les clients n’ont aucun accès.</p>
        <p><strong className="text-ink">Localisation.</strong> L’application stocke une localisation <em>enregistrée</em> (code postal et coordonnées approximatives) fournie ou validée par le manager. Elle ne collecte aucune position GPS, ne suit aucun déplacement et ne prouve pas la présence d’une personne en un lieu.</p>
        <p><strong className="text-ink">Services tiers.</strong> Pour résoudre une adresse et estimer un trajet, le code postal, la ville et des coordonnées de départ et d’arrivée sont transmis au fournisseur de cartographie configuré (Mapbox par défaut). Aucun nom ni coordonnée de contact n’est transmis.</p>
        <p><strong className="text-ink">Conservation.</strong> Les estimations d’itinéraires sont mises en cache puis expirent automatiquement. Le manager peut archiver des fiches et vider son cache à tout moment depuis les réglages. La durée de conservation des fiches archivées est à définir par l’organisation utilisatrice, conformément à la réglementation applicable.</p>
        <p><strong className="text-ink">Exactitude.</strong> Les distances et temps de trajet sont des estimations dépendant de la précision du code postal, du fournisseur et des conditions réelles. Ils ne sont pas garantis.</p>
      </div>
    </main>
  );
}
