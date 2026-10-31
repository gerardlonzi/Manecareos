import { LegalPage, type LegalSection } from "@/components/legal-page";
import { APP_CONFIG } from "@/config/app";

export const metadata = { title: "Conditions d’utilisation / Terms of use" };
const N = APP_CONFIG.name, C = APP_CONFIG.company;

const SECTIONS: LegalSection[] = [
  { id: "service", fr: "Le service", en: "The service", body: [{ fr: `${N} est une plateforme éditée par ${C} qui aide les agences de placement à gérer leur staff, leurs missions, leurs heures et la conformité documentaire. En créant un compte, vous acceptez ces conditions.`, en: `${N} is a platform published by ${C} that helps staffing agencies manage their staff, assignments, hours and document compliance. By creating an account you accept these terms.` }] },
  { id: "account", fr: "Compte et sécurité", en: "Account and security", body: [{ fr: ["Vous êtes responsable de la confidentialité de votre mot de passe et de l’accès à votre boîte e-mail (le code de connexion y est envoyé).", "Chaque compte est personnel ; ne partagez pas vos identifiants.", "Prévenez-nous sans délai en cas d’accès non autorisé."], en: ["You are responsible for keeping your password confidential and for access to your mailbox (the sign-in code is sent there).", "Each account is personal; do not share your credentials.", "Tell us immediately about any unauthorised access."] }] },
  { id: "use", fr: "Utilisation acceptable", en: "Acceptable use", body: [{ fr: ["N’enregistrez que des données que vous avez le droit de traiter, de façon exacte et à jour.", "N’utilisez pas la plateforme pour des activités illégales, discriminatoires ou abusives.", "N’essayez pas de contourner la sécurité ni d’accéder aux données d’une autre organisation."], en: ["Only record data you are entitled to process, accurate and up to date.", "Do not use the platform for unlawful, discriminatory or abusive activities.", "Do not attempt to bypass security or access another organisation’s data."] }] },
  { id: "compliance", fr: "Conformité et décisions", en: "Compliance and decisions", body: [{ fr: "Les alertes et blocages liés aux documents (expiration, documents manquants) sont des aides : l’agence reste seule responsable de ses vérifications légales (droit de travailler, DBS, formations) et de ses décisions de placement. Les estimations de trajet et d’heures sont indicatives.", en: "Document alerts and blocks (expiry, missing documents) are aids: the agency remains solely responsible for its legal checks (right to work, DBS, training) and placement decisions. Journey and hours estimates are indicative." }] },
  { id: "data", fr: "Données", en: "Data", body: [{ fr: "Vos données restent les vôtres. Nous les traitons selon notre notice de confidentialité. Vous pouvez exporter ou supprimer vos données ; nous pouvons les supprimer à la clôture du compte, sous réserve des obligations légales.", en: "Your data remains yours. We process it according to our privacy notice. You can export or delete your data; we may delete it when the account is closed, subject to legal obligations." }] },
  { id: "liability", fr: "Disponibilité et responsabilité", en: "Availability and liability", body: [{ fr: "Nous faisons le maximum pour assurer un service continu et sécurisé, sans pouvoir garantir une disponibilité ininterrompue. Dans les limites permises par la loi, notre responsabilité est limitée aux dommages directs et ne couvre pas les pertes indirectes (perte de contrat, de revenus).", en: "We do our best to provide a continuous, secure service but cannot guarantee uninterrupted availability. To the extent permitted by law, our liability is limited to direct damages and excludes indirect losses (lost contracts, revenue)." }] },
  { id: "law", fr: "Droit applicable", en: "Governing law", body: [{ fr: "Ces conditions sont régies par le droit anglais, sauf disposition légale impérative contraire. Nous pouvons les modifier ; la date de mise à jour figure en haut de la page.", en: "These terms are governed by English law unless mandatory law provides otherwise. We may amend them; the update date is shown at the top of the page." }] },
];

export default function TermsPage() {
  return (
    <LegalPage
      title={{ fr: "Conditions d’utilisation", en: "Terms of use" }}
      updated="2026-10-29"
      intro={{ fr: `Ces conditions encadrent l’utilisation de ${N}, exploité par ${C}.`, en: `These terms govern the use of ${N}, operated by ${C}.` }}
      sections={SECTIONS}
      contactEmail={process.env.NEXT_PUBLIC_CONTACT_EMAIL || undefined}
    />
  );
}
