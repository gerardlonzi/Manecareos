"use client";
import { Brand } from "@/components/brand";
import { APP_CONFIG } from "@/config/app";
import { usePreferences } from "@/components/providers/preferences-provider";

export default function PrivacyPage() {
  const { t } = usePreferences();
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Brand />
      <h1 className="mt-8 text-2xl font-semibold">{t("Notice de confidentialité", "Privacy notice")}</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted">
        <p>{t(`${APP_CONFIG.name} permet à un manager de gérer des fiches de personnel. Ces fiches contiennent des données personnelles (nom, téléphone, e-mail, code postal, ville) dont le manager est responsable.`, `${APP_CONFIG.name} allows a manager to manage staff profiles. These profiles contain personal data (name, phone number, email, postal code and city) for which the manager is responsible.`)}</p>
        <p><strong className="text-ink">{t("Accès.", "Access.")}</strong> {t("Chaque manager accède uniquement à ses propres données. Les personnes dont la fiche est enregistrée n’ont pas de compte ; les clients n’ont aucun accès.", "Each manager can access only their own data. People whose profiles are stored do not have accounts, and clients have no access.")}</p>
        <p><strong className="text-ink">{t("Localisation.", "Location.")}</strong> {t("L’application stocke une localisation enregistrée (code postal et coordonnées approximatives) fournie ou validée par le manager. Elle ne collecte aucune position GPS, ne suit aucun déplacement et ne prouve pas la présence d’une personne en un lieu.", "The app stores a saved location (postal code and approximate coordinates) supplied or verified by the manager. It does not collect live GPS positions, track movement or prove that a person is present at a location.")}</p>
        <p><strong className="text-ink">{t("Services tiers.", "Third-party services.")}</strong> {t("Pour résoudre une adresse et estimer un trajet, le code postal, la ville et des coordonnées de départ et d’arrivée sont transmis au fournisseur de cartographie configuré (Mapbox par défaut). Aucun nom ni coordonnée de contact n’est transmis.", "To resolve a location and estimate a journey, the postal code, city and start/end coordinates are sent to the configured mapping provider (Mapbox by default). Names and contact details are not sent.")}</p>
        <p><strong className="text-ink">{t("Conservation.", "Retention.")}</strong> {t("Les estimations d’itinéraires sont mises en cache puis expirent automatiquement. Le manager peut archiver des fiches et vider son cache à tout moment depuis les réglages. La durée de conservation des fiches archivées est à définir par l’organisation utilisatrice, conformément à la réglementation applicable.", "Route estimates are cached and expire automatically. Managers can archive profiles and clear the cache in settings. The organisation using the app must define how long archived profiles are retained, in accordance with applicable law.")}</p>
        <p><strong className="text-ink">{t("Exactitude.", "Accuracy.")}</strong> {t("Les distances et temps de trajet sont des estimations dépendant de la précision du code postal, du fournisseur et des conditions réelles. Ils ne sont pas garantis.", "Distances and journey times are estimates that depend on postal-code accuracy, the provider and real-world conditions. They are not guaranteed.")}</p>
      </div>
    </main>
  );
}
