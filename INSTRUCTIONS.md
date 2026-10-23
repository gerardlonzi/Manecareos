# StaffFlow — Instructions à suivre

Application SaaS pour managers de personnel : annuaire du staff, missions, recherche géographique du staff disponible le plus proche, distances et temps de trajet par mode de transport, import/export CSV.

> **Périmètre :** StaffFlow gère des **localisations enregistrées** (code postal / ville de la fiche). Il n'y a **aucun suivi GPS en direct**. Les coordonnées sont approximatives (centre du code postal ou de la ville) ; distances et durées sont des estimations, pas des garanties.

---

## 1. Ce dont vous avez besoin

| Élément | Détail |
|---|---|
| Node.js | 20 ou plus (testé avec 22) |
| npm | 10 ou plus |
| Compte Supabase | gratuit suffit — https://supabase.com |
| Compte Mapbox | gratuit suffit — https://account.mapbox.com |

---

## 2. Installation

```bash
cd staffflow
npm install
cp .env.example .env.local
```

---

## 3. Créer le projet Supabase

1. Sur supabase.com : **New project** (retenez le mot de passe de la base).
2. **Project Settings → API** : copiez
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - la clé **anon / publishable** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. ⚠️ N'utilisez **jamais** la clé `service_role` dans cette application : elle n'en a pas besoin et ne doit pas être exposée.

## 4. Appliquer les migrations SQL

Les migrations sont dans `supabase/migrations/` et **doivent être exécutées dans cet ordre** :

1. `20261020000001_schema.sql` — tables, types, contraintes, index, triggers
2. `20261020000002_rls.sql` — Row Level Security (chaque manager ne voit que ses données)
3. `20261020000003_functions.sql` — recherche par rayon (Haversine), statistiques du tableau de bord, vue `mission_overview`

**Option A — éditeur SQL (la plus simple)** : Supabase → **SQL Editor** → collez et exécutez chaque fichier, dans l'ordre.

**Option B — CLI Supabase** :
```bash
npx supabase login
npx supabase link --project-ref VOTRE_REF_PROJET
npx supabase db push
```

> Ces commandes modifient la base **distante** de votre projet. Vérifiez que c'est bien le bon projet avant de lancer.

## 5. Configurer l'authentification

Supabase → **Authentication** :

- **Providers → Email** : activé (inscription par e-mail + mot de passe).
- **URL Configuration** :
  - *Site URL* : `http://localhost:3000` (en production : votre domaine)
  - *Redirect URLs* : ajoutez `http://localhost:3000/auth/callback` (et celle de production)
- **Confirmation d'e-mail** : l'application gère le lien de confirmation **et** le code à saisir. Pour que le code apparaisse dans l'e-mail, ajoutez `{{ .Token }}` au modèle « Confirm signup » (Authentication → Email Templates).
- Le profil du manager est créé automatiquement par un trigger SQL à l'inscription (jamais depuis le navigateur).

## 6. Configurer Mapbox

1. https://account.mapbox.com/access-tokens/ → créez **deux jetons** :
   - un jeton **public** (`pk.…`), restreint à votre domaine → `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` (affichage de la carte dans le navigateur)
   - un jeton **serveur** (`sk.…` ou `pk.…` non restreint par URL) → `MAPBOX_SERVER_TOKEN` (géocodage + itinéraires, **uniquement côté serveur**, jamais préfixé `NEXT_PUBLIC_`)
2. Sans jeton public : la carte affiche un message de configuration, le reste fonctionne.
3. Sans jeton serveur : la validation des lieux et les itinéraires sont indisponibles (message explicite, aucune valeur inventée).

## 7. Variables d'environnement (`.env.local`)

| Variable | Obligatoire | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | oui | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | oui | clé publique anon/publishable |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | pour la carte | jeton public Mapbox |
| `MAPBOX_SERVER_TOKEN` | pour géocodage + trajets | jeton Mapbox côté serveur |
| `NEXT_PUBLIC_DEFAULT_COUNTRY` | non (défaut `GB`) | pays de lancement (ex. `CM`, `FR`, `GB`) |
| `NEXT_PUBLIC_SITE_URL` | oui en production | URL publique (liens de confirmation e-mail) |

Le fichier `.env.local` est ignoré par git. Redémarrez le serveur après toute modification.

## 8. Lancer l'application

```bash
npm run dev
```
Ouvrez http://localhost:3000 → **Get Started** → créez un compte manager → confirmez l'e-mail → vous arrivez sur le tableau de bord.

---

## 9. Premier parcours conseillé (5 minutes)

1. **Importer du staff** (menu *Importer du staff*) : téléchargez le modèle CSV, remplissez-le, téléversez, vérifiez l'aperçu, confirmez. Les codes postaux distincts sont géocodés une seule fois.
   *Ou* ajoutez une fiche à la main : **Annuaire → Ajouter un staff** → « Valider la localisation ».
2. **Créer une mission** : *Missions → Nouvelle mission* → renseignez le lieu → « Valider la localisation » → **Créer la mission**.
3. **Trouver du staff** : sur la mission, **Trouver du staff** → réglez rayon (10 km par défaut), disponibilité, compétences, mode de transport.
4. Comparez **distance à vol d'oiseau**, **distance routière** et **temps de trajet estimé**, puis **Sélectionner pour la mission**.
5. Sur la mission : marquez chaque personne **contactée → confirmée** (ou **a refusé**). La mission ne passe à « Pourvue » que lorsque l'effectif requis est **confirmé** (une sélection n'est pas une acceptation).

*Recherche sans mission :* menu **Trouver du staff** → saisissez un code postal ou une ville (point de référence).

---

## 10. Comment sont calculées les distances et durées

- **À vol d'oiseau** : formule de Haversine entre les coordonnées enregistrées (filtre par rayon fait en base). Jamais présentée comme une distance routière.
- **Distance routière + temps de trajet** : fournis par l'API Mapbox (Directions Matrix) pour les modes **voiture, marche, vélo**. Étape 2 de la recherche : uniquement pour les **24 candidats les plus proches**, par lots de 8, avec résultats partiels affichés au fur et à mesure.
  - Le temps de voiture est **sans trafic en direct** (et l'application ne prétend pas le contraire).
  - Aucun mode ne réutilise l'estimation d'un autre (la marche n'est jamais déduite de la voiture).
- **Transports en commun : non pris en charge** (aucun fournisseur d'horaires configuré). L'option est désactivée et expliquée ; rien n'est simulé.
- **Cache** : les estimations réussies sont gardées 7 jours, par manager (table `route_estimates`, protégée par RLS). *Actualiser les itinéraires* force un nouveau calcul ; *Réglages → Recherche et trajets* permet de vider le cache.
- **Repli approximatif (désactivé par défaut)** : *Réglages → Recherche et trajets → Autoriser les estimations approximatives*. Si activé et que Mapbox échoue, un temps à vitesse moyenne est affiché, étiqueté « approximation — pas un itinéraire réel ».
- Si un itinéraire est indisponible, l'interface affiche « Temps de trajet indisponible » — jamais une valeur inventée.
- Un tracé n'est dessiné sur la carte que s'il a réellement été renvoyé par Mapbox.

---

## 11. Vérifications (qualité)

```bash
npm run typecheck   # TypeScript strict
npm run lint        # ESLint
npm test            # tests unitaires Vitest
npm run build       # build de production
npm run build && PLAYWRIGHT_CHROMIUM_PATH=/chemin/vers/chromium npx playwright test   # tests e2e de fumée (sans service externe)
```

**Test d'isolation entre managers (à faire sur un projet Supabase de TEST)** : exécutez `supabase/tests/rls_isolation.sql` dans l'éditeur SQL. Il crée deux utilisateurs jetables, vérifie qu'un manager ne lit/n'insère/ne modifie rien chez l'autre, puis annule tout (`rollback`). Toutes les lignes doivent afficher `PASS`.

Résultats constatés lors de la livraison de ce code :

| Commande | Résultat |
|---|---|
| `npm run typecheck` | ✅ aucune erreur |
| `npm run lint` | ✅ aucune erreur |
| `npm test` | ✅ 9 fichiers, 106 tests passés |
| `npm run build` | ✅ réussi (toutes les routes générées) |
| `npx playwright test` | ✅ 10 tests de fumée (pages publiques, routes privées → `/login`) |
| Démarrage prod + `curl` | ✅ pages publiques 200 ; routes privées → redirection `/login` |

Les tests unitaires couvrent : normalisation des codes postaux, validation des coordonnées, Haversine, formatage des distances, filtre par rayon, tri, validation des réponses de routage, choix du mode, clés et expiration du cache, CSV (parsing, échappement, injection de formules), normalisation des téléphones, classement des candidats, fuseaux horaires, schémas de validation.

---

## 12. Mettre en production

1. Poussez le code sur GitHub, puis importez le dépôt sur **Vercel** (ou tout hébergeur Node compatible Next.js 16).
2. Renseignez les 6 variables du §7 dans les paramètres du projet (`NEXT_PUBLIC_SITE_URL` = votre domaine).
3. Dans Supabase → Authentication → URL Configuration : mettez votre domaine en *Site URL* et ajoutez `https://VOTRE-DOMAINE/auth/callback`.
4. Restreignez le jeton Mapbox public à votre domaine.
5. Déployez, créez un compte, vérifiez le parcours du §9.

Commande de lancement locale en mode production : `npm run build && npm start`.

---

## 13. Structure du projet

```
supabase/migrations/     schéma SQL, RLS, fonctions
src/app/                 pages (App Router) — (auth) publiques, (app) privées
src/actions/             actions serveur (auth, staff, missions, recherche, import, export…)
src/lib/geo/             Haversine, formatage, cercle de rayon
src/lib/location/        géocodage (fournisseur isolé derrière une interface)
src/lib/routing/         itinéraires (fournisseur isolé), cache, repli
src/lib/csv/             import / export CSV sécurisés
src/components/          interface (search/, missions/, staff/, import/, map/…)
src/config/              nom du produit, préférences, pays (centralisés)
```

Les fournisseurs de géocodage et d'itinéraires sont derrière des interfaces (`Geocoder`, `RoutingProvider`) : on peut en changer sans toucher à l'interface.

## 14. Sécurité

- RLS activée sur toutes les tables privées ; chaque requête passe par le client Supabase du manager connecté.
- `owner_id` n'est jamais lu depuis le navigateur ni depuis un CSV.
- Une affectation vérifie que la mission **et** le staff appartiennent au manager (RLS + trigger SQL).
- Le calcul d'itinéraire relit les origines en base sous RLS (impossible pour un staff qui n'est pas à vous).
- Exports CSV : valeurs échappées, protection contre l'injection de formules, jamais tronqués silencieusement (refus au-delà de la limite).
- Journal d'activité en ajout seul.
- Aucune clé secrète dans le code client ; `service_role` n'est pas utilisée.

---

## 15. Limites connues — à lire

- **Non testé contre de vrais services** : l'environnement de livraison n'avait ni projet Supabase ni jeton Mapbox. Authentification, RLS, géocodage, itinéraires et import réels n'ont donc **pas été exécutés de bout en bout** ; ils sont implémentés et leur logique pure est testée, mais à valider chez vous avec vos clés (parcours §9).
- **Tests limités** : unitaires (106) + e2e de fumée sans service externe (10) exécutés ici. Le script SQL d'isolation RLS (`supabase/tests/rls_isolation.sql`) est fourni mais **n'a pas été exécuté** (pas de base Supabase disponible). Les parcours complets (connexion, création de mission, recherche, import) ne sont pas automatisés : à valider à la main (§9) ou à ajouter avec un projet Supabase de test.
- Coordonnées **approximatives** (centre de code postal/ville) ; au Cameroun, au Nigéria, au Sénégal et en Côte d'Ivoire les codes postaux sont peu fiables : renseignez aussi la ville.
- **Transports en commun** : non pris en charge.
- Temps de voiture **sans trafic en direct**.
- Itinéraires calculés pour les 24 candidats les plus proches seulement (limite de coût/quotas ; modifiable dans `src/config/app.ts`).
- Import : 5 000 lignes et 5 Mo maximum par fichier (découpez au-delà).
- Pas de comptes staff ni client, pas de suivi en direct : volontairement hors périmètre du MVP.
- Respectez les conditions d'utilisation et les quotas de Mapbox (géocodage / itinéraires).
