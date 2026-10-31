import { LegalPage, type LegalSection } from "@/components/legal-page";
import { APP_CONFIG } from "@/config/app";

export const metadata = { title: "Confidentialité / Privacy" };

const N = APP_CONFIG.name, C = APP_CONFIG.company;

const SECTIONS: LegalSection[] = [
  { id: "who", fr: "Qui est responsable de quoi", en: "Who is responsible for what", body: [
    { fr: `${C} édite la plateforme ${N}. Pour les données de son équipe (candidats, personnel, missions), c’est l’agence qui utilise ${N} qui décide pourquoi et comment ces données sont utilisées : elle est « responsable de traitement ». ${C} agit comme « sous-traitant » et ne traite ces données que pour fournir le service.`, en: `${C} publishes the ${N} platform. For the data of its team (candidates, staff, assignments), the agency using ${N} decides why and how that data is used: it is the “controller”. ${C} acts as “processor” and only processes this data to provide the service.` },
    { fr: `Pour les comptes des utilisateurs de la plateforme (nom, e-mail, journal de connexion), ${C} est responsable de traitement.`, en: `For platform user accounts (name, email, sign-in records), ${C} is the controller.` },
  ] },
  { id: "data", fr: "Données traitées", en: "Data we process", body: [
    { fr: ["Compte : nom, e-mail, société, préférences, journal de connexion.", "Fiche staff : nom, code staff, téléphone, e-mail, adresse (code postal, ville, région), compétences, disponibilité, heures hebdomadaires, notes, photo (facultative).", "Missions : titre, référence, lieu, horaires, heures, taux horaire, affectations et heures travaillées.", "Documents de conformité : type (droit de travailler, passeport, certificat DBS, formation, permis de conduire…), date d’expiration, et, de façon facultative, un fichier ou un lien.", "Journal d’activité et notifications (conservés 21 jours, voir « Conservation »)."], en: ["Account: name, email, company, preferences, sign-in records.", "Staff record: name, staff code, phone, email, address (postcode, city, region), skills, availability, weekly hours, notes, photo (optional).", "Assignments: title, reference, location, schedule, hours, hourly rate, allocations and hours worked.", "Compliance documents: type (right to work, passport, DBS certificate, training, driving licence…), expiry date and, optionally, a file or a link.", "Activity log and notifications (kept 21 days, see “Retention”)."] },
    { fr: "Nous ne collectons aucune position GPS en direct. La localisation est celle de l’adresse enregistrée (code postal), jamais la position actuelle d’une personne.", en: "We do not collect live GPS positions. Location is that of the saved address (postcode), never a person’s current position." },
  ] },
  { id: "sensitive", fr: "Documents sensibles (passeport, DBS, droit de travailler)", en: "Sensitive documents (passport, DBS, right to work)", body: [
    { fr: "Ces documents sont juridiquement sensibles au Royaume-Uni : un certificat DBS peut révéler des données relatives aux condamnations (article 10 du UK GDPR) et un passeport est une pièce d’identité. Nous appliquons donc le principe de minimisation :", en: "These documents are legally sensitive in the UK: a DBS certificate can reveal criminal-conviction data (Article 10 UK GDPR) and a passport is an identity document. We therefore apply data minimisation:" },
    { fr: ["Seule la date d’expiration est obligatoire. Le fichier est facultatif : vous pouvez ne saisir que la date et conserver l’original ailleurs.", "Au lieu d’un fichier, vous pouvez enregistrer un lien https vers un espace sécurisé de votre organisation.", "Ne saisissez jamais le numéro du document dans les notes ni dans le contenu d’un contrôle DBS (résultat, antécédents) : seule la validité compte.", "Les fichiers sont stockés en privé (accès authentifié), chiffrés pendant le transfert, et ne sont consultables que par un lien signé de très courte durée (2 minutes) après vérification de votre session.", "Chaque consultation, ajout, remplacement ou suppression est inscrit dans un journal d’accès conservé 12 mois."], en: ["Only the expiry date is mandatory. The file is optional: you can enter the date only and keep the original elsewhere.", "Instead of a file, you can save an https link to a secure space of your organisation.", "Never enter the document number in notes, nor the content of a DBS check (result, history): only validity matters.", "Files are stored privately (authenticated access), encrypted in transit, and only viewable through a very short-lived signed link (2 minutes) after your session is verified.", "Every view, upload, replacement or deletion is recorded in an access log kept 12 months."] },
    { fr: "Les employeurs doivent s’assurer d’avoir une base légale et une politique de conservation pour ces documents. En cas de doute, consultez votre conseil juridique ou la documentation de l’ICO.", en: "Employers must ensure they have a lawful basis and a retention policy for these documents. If in doubt, consult your legal adviser or the ICO guidance." },
  ] },
  { id: "basis", fr: "Pourquoi nous traitons ces données", en: "Why we process this data", body: [
    { fr: ["Fournir le service demandé (exécution du contrat) : gestion du staff, des missions, des heures et de la conformité.", "Obligations légales de l’agence : contrôle du droit de travailler et des vérifications préalables à l’embauche.", "Intérêt légitime : sécurité de la plateforme, prévention des abus, amélioration du service."], en: ["Providing the requested service (contract): managing staff, assignments, hours and compliance.", "The agency’s legal obligations: right-to-work checks and pre-employment screening.", "Legitimate interests: platform security, abuse prevention, service improvement."] },
    { fr: "Nous ne vendons aucune donnée et ne l’utilisons pas pour la publicité.", en: "We never sell data and do not use it for advertising." },
  ] },
  { id: "security", fr: "Sécurité", en: "Security", body: [
    { fr: ["Connexion à double facteur : mot de passe + code à 6 chiffres envoyé par e-mail (expire en 10 minutes, 5 essais maximum).", "Cloisonnement strict : chaque organisation ne voit que ses propres données (règles de sécurité au niveau de la base de données).", "Chiffrement des échanges (HTTPS/HSTS) et en-têtes de sécurité (CSP) ; clés secrètes uniquement côté serveur.", "Les accès aux documents sont journalisés ; les liens de téléchargement expirent en 2 minutes.", "Le journal d’activité est purgé automatiquement après 21 jours."], en: ["Two-factor sign-in: password + 6-digit code sent by email (expires in 10 minutes, 5 attempts maximum).", "Strict separation: each organisation only sees its own data (database-level security rules).", "Encrypted traffic (HTTPS/HSTS) and security headers (CSP); secret keys are kept server-side only.", "Document access is logged; download links expire in 2 minutes.", "The activity log is automatically purged after 21 days."] },
  ] },
  { id: "providers", fr: "Prestataires et transferts", en: "Service providers and transfers", body: [
    { fr: ["Supabase : base de données et authentification.", "Cloudinary : stockage privé des fichiers de documents (facultatif).", "Brevo : envoi des e-mails (code de connexion, rappels d’expiration). Seuls l’adresse du destinataire et le contenu du message lui sont transmis.", "Mapbox : localisation et estimation des trajets. Seuls le code postal, la ville et des coordonnées approximatives lui sont transmis, jamais les noms ni les contacts.", "Vercel : hébergement de l’application."], en: ["Supabase: database and authentication.", "Cloudinary: private storage of document files (optional).", "Brevo: email delivery (sign-in code, expiry reminders). Only the recipient address and message content are shared.", "Mapbox: geocoding and journey estimates. Only postcode, city and approximate coordinates are shared, never names or contact details.", "Vercel: application hosting."] },
    { fr: "Certains prestataires peuvent traiter des données hors du Royaume-Uni ; des garanties contractuelles appropriées (clauses types / accord de transfert) encadrent ces transferts.", en: "Some providers may process data outside the UK; appropriate contractual safeguards (standard clauses / transfer agreement) govern these transfers." },
  ] },
  { id: "retention", fr: "Conservation", en: "Retention", body: [
    { fr: ["Journal d’activité : 21 jours, puis suppression automatique.", "Journal d’accès aux documents : 12 mois.", "Codes de connexion : supprimés après usage ou expiration.", "Estimations de trajets en cache : expirent automatiquement (7 jours).", "Fiches et documents : tant que l’agence les conserve ; l’agence peut archiver ou supprimer une fiche ou un document à tout moment. La suppression d’un document supprime aussi son fichier stocké."], en: ["Activity log: 21 days, then automatically deleted.", "Document access log: 12 months.", "Sign-in codes: deleted after use or expiry.", "Cached journey estimates: expire automatically (7 days).", "Records and documents: as long as the agency keeps them; the agency can archive or delete a record or document at any time. Deleting a document also deletes its stored file."] },
  ] },
  { id: "rights", fr: "Vos droits", en: "Your rights", body: [
    { fr: "Toute personne dont les données sont enregistrées peut demander l’accès, la rectification, l’effacement, la limitation, la portabilité de ses données ou s’opposer à un traitement. Adressez-vous d’abord à l’agence qui gère votre dossier ; nous l’aidons à répondre dans les délais légaux (un mois).", en: "Anyone whose data is recorded can request access, rectification, erasure, restriction, portability or object to processing. Contact the agency managing your record first; we help it respond within the legal time limit (one month)." },
    { fr: "Vous pouvez aussi déposer une réclamation auprès de l’autorité de contrôle : l’Information Commissioner’s Office (ICO), ico.org.uk.", en: "You can also lodge a complaint with the supervisory authority: the Information Commissioner’s Office (ICO), ico.org.uk." },
  ] },
  { id: "cookies", fr: "Cookies", en: "Cookies", body: [
    { fr: "Nous n’utilisons que des cookies strictement nécessaires : session de connexion, vérification à deux facteurs, langue et thème. Aucun cookie publicitaire ni de suivi.", en: "We only use strictly necessary cookies: sign-in session, two-factor verification, language and theme. No advertising or tracking cookies." },
  ] },
  { id: "accuracy", fr: "Exactitude des estimations", en: "Accuracy of estimates", body: [
    { fr: "Distances et temps de trajet sont des estimations (code postal, fournisseur, conditions réelles) et ne sont pas garantis. Les durées en train sont des estimations sans horaire réel.", en: "Distances and journey times are estimates (postcode, provider, real conditions) and are not guaranteed. Train times are estimates without a real timetable." },
  ] },
  { id: "changes", fr: "Modifications", en: "Changes", body: [
    { fr: "Nous pouvons mettre à jour cette notice ; la date de dernière mise à jour figure en haut de la page. En cas de changement important, les utilisateurs en sont informés.", en: "We may update this notice; the last-updated date is shown at the top. Users are informed of significant changes." },
  ] },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title={{ fr: "Confidentialité et protection des données", en: "Privacy and data protection" }}
      updated="2026-10-29"
      intro={{ fr: `Cette page explique quelles données ${N} traite, pourquoi, comment elles sont protégées et quels sont vos droits. Elle s’applique à la plateforme exploitée par ${C}.`, en: `This page explains what data ${N} processes, why, how it is protected and what your rights are. It applies to the platform operated by ${C}.` }}
      sections={SECTIONS}
      contactEmail={process.env.NEXT_PUBLIC_CONTACT_EMAIL || undefined}
    />
  );
}
