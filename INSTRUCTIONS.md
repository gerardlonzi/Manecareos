# Manecare — instructions d’installation

## 1. Prérequis
Node 20+, un projet Supabase, un compte Mapbox.

## 2. Installation
```bash
npm install
cp .env.example .env.local   # puis renseigner les variables (voir ci-dessous)
```
| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service_role (serveur uniquement) : tâche quotidienne (alertes, e-mails automatiques, purge) |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` (pk.*), `MAPBOX_SERVER_TOKEN` (sk.*) | Cartes et itinéraires |
| `AUTH_2FA_SECRET` | ≥ 32 caractères aléatoires (`openssl rand -base64 48`). Signe le cookie « code vérifié » |
| `AUTH_2FA_DISABLED` | `true` seulement en développement : supprime le code à la connexion |
| `BREVO_SMTP_USER`, `BREVO_SMTP_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | E-mails **automatiques au staff** (rappels d’expiration, bouton « Envoyer un e-mail »). Brevo → SMTP & API → SMTP. `EMAIL_FROM` = adresse expéditrice validée dans Brevo. Alternative : `BREVO_API_KEY` (clé v3 `xkeysib-…`) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Fichiers de documents (privés). Sans Cloudinary : date + lien seulement |
| `CRON_SECRET` | ≥ 16 caractères. Protège `/api/cron/daily` |
| `NEXT_PUBLIC_DEFAULT_COUNTRY=GB`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL` | Divers |

**Vercel** : ajoutez ces variables dans Project Settings → Environment Variables. `vercel.json` déclenche la tâche quotidienne à 06:00 UTC (alertes de documents, e-mails automatiques si activés, purge de l’activité > 21 jours).
**Cloudinary** : Settings → Security → cochez la livraison des PDF si vos PDF ne s’ouvrent pas (offre gratuite).
**Connexion et inscription (e-mails envoyés par Supabase)** :
1. Authentication → Emails → SMTP Settings : votre SMTP (Brevo) — c’est lui qui envoie les codes.
2. Authentication → Sign In / Providers → Email : « Confirm email » activé ; durée du code OTP : 3600 s, longueur 6.
3. Authentication → Emails → Templates : dans **Confirm signup** et **Magic Link**, remplacez le corps par un message qui affiche `{{ .Token }}` (le code à 6 chiffres), par ex. `<h2>Votre code : {{ .Token }}</h2>`. Sans `{{ .Token }}`, l’e-mail ne contient qu’un lien et l’application ne peut pas valider le code.
4. Authentication → Rate Limits : « emails per hour » assez haut (30 par défaut avec SMTP personnalisé). Supabase impose 60 s entre deux envois.

## 3. Base de données (SQL Editor de Supabase, dans cet ordre)
1. `supabase/migrations/20261020000001_schema.sql`
2. `supabase/migrations/20261020000002_rls.sql`
3. `supabase/migrations/20261020000003_functions.sql`
4. `supabase/migrations/20261024000001_photos_search_perf.sql` — heures hebdomadaires, photo, bucket privé `staff-photos`, recherche par rayon.
5. `supabase/migrations/20261027000001_compliance_hours_security.sql` — **nouvelle** : types de documents (5 obligatoires par défaut, modifiables), documents du staff (date d’expiration), alertes, journal d’accès, codes de connexion, heures/paie des missions, fonction des heures par mois, purge automatique.
6. `supabase/migrations/20261028000001_document_link.sql` — **nouvelle** : justificatif par lien https (fichier OU lien).
7. `supabase/migrations/20261030000001_mission_workplace.sql` — **nouvelle** : lieu principal de la mission (type d’établissement + nom) et vue `mission_overview` recréée.

Authentication → URL Configuration : ajoutez `http://localhost:3000/auth/callback` (et l’URL de production).
Déjà en production ? Exécutez seulement les migrations 5 et 6. Toutes les migrations ont été exécutées avec succès sur un PostgreSQL de test.

## 4. Lancer
```bash
npm run dev          # développement
npm run build && npm start
npm run typecheck && npm run lint && npm test
```

## 5. Ce qui est inclus
- **Marque** : « Maneliza » (l’entreprise) au-dessus, « Manecare » (la plateforme) en dessous. FR/EN partout (cookie), mode sombre, animations, responsive.
- **En-tête** : langue, thème, notifications et menu du profil (déconnexion incluse). **Menu latéral** : icônes visibles, s’ouvre au survol avec animation.
- **Connexion sécurisée** : mot de passe + code à 6 chiffres envoyé par Supabase (renvoi toutes les 60 s), cookie signé vérifié par le serveur à chaque page ; en-têtes de sécurité (CSP, HSTS), RLS par organisation.
- **Documents du staff** : 5 obligatoires par défaut (Right to Work, passeport, DBS, formation, permis), modifiables et extensibles dans Réglages → Documents obligatoires. Date d’expiration obligatoire (ou « sans expiration »), justificatif facultatif : fichier (Cloudinary privé, lien signé 2 min, accès journalisé) **ou** lien https. Un staff incomplet/expiré ne peut pas être attribué à une mission.
- **Alertes** : notification + e-mail (FR+EN) automatique ou bouton « Envoyer un e-mail » ; la notification indique qu’un e-mail est parti et pourquoi. Seuils 60/30/14/7/0 jours.
- **Heures** : plafond hebdomadaire modifiable en ligne, heures restantes, notification quand le plafond est atteint, page « Heures de travail » (filtre par mois, export), fiche staff (semaine, mois, missions, paie).
- **Missions** : référence, heures prévues (début/fin calculé automatiquement ou saisie 7h30), paie horaire, heures travaillées par affectation, case « terminée », contrôles (documents, indisponible, chevauchement, plafond).
- **Import Excel/CSV** : colonnes `Code, full_name, Phone, email, country, POSTCODE, city, region, skills, availability, notes, weekly hours`. `SW` = Support Worker, `HCA` = Healthcare Assistant (filtrables), « 20hours » / « Full Time » (= 37,5 h) reconnus. Un staff déjà présent (même Code ou e-mail) est **mis à jour** ; une cellule vide n’efface rien.
- **Find Staff** : indisponibles toujours affichés (badge rouge, marqueur rouge sur la carte), élargissement automatique aux villes voisines, heures restantes, fond rouge léger + infobulle si dossier incomplet, km + durée à pied/vélo/voiture/train avec message d’estimation.
- **Confidentialité et conditions** (`/privacy`, `/terms`) bilingues. Journal d’activité purgé après 21 jours.

## 6. Limites connues
- Aucun test n’a pu être fait contre un vrai Supabase, Mapbox, Brevo ou Cloudinary ici : vérifiez la connexion avec code, l’envoi d’e-mail, l’upload de document et les tracés après configuration.
- La durée en train est une **estimation** (distance × 1,2 à 80 km/h + 12 min), pas un horaire.
- `tsc`, `eslint`, 151 tests unitaires et `next build` passent ; les 7 migrations s’appliquent sur un PostgreSQL de test.
- Documents sensibles (DBS, passeport) : voir la page Confidentialité ; faites valider votre politique de conservation par un conseiller juridique.
