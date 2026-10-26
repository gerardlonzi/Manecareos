# Manecare — instructions d’installation

## 1. Prérequis
Node 20+, un projet Supabase, un compte Mapbox.

## 2. Installation
```bash
npm install
cp .env.example .env.local   # puis renseigner les 6 variables
```
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` : Supabase → Project Settings → API.
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` (pk.*, restreint à votre domaine) et `MAPBOX_SERVER_TOKEN` (sk.*, jamais exposé au navigateur).
- `NEXT_PUBLIC_DEFAULT_COUNTRY=GB`.

## 3. Base de données (SQL Editor de Supabase, dans cet ordre)
1. `supabase/migrations/20261020000001_schema.sql`
2. `supabase/migrations/20261020000002_rls.sql`
3. `supabase/migrations/20261020000003_functions.sql`
4. `supabase/migrations/20261024000001_photos_search_perf.sql` — **nouvelle** : heures hebdomadaires (`weekly_hours`), photo (`photo_path`), bucket privé `staff-photos` (2 Mo, jpeg/png/webp), index de recherche, fonction `staff_within_radius` mise à jour.

Authentication → URL Configuration : ajoutez `http://localhost:3000/auth/callback` (et l’URL de production).

## 4. Lancer
```bash
npm run dev          # développement
npm run build && npm start
npm run typecheck && npm run lint && npm test
```

## 5. Ce qui est inclus
- Marque : logo Maneliza Care, plateforme « Manecare ». Mode sombre noir, FR/EN (cookie), animations, responsive.
- Page d’accueil à 8 sections ; connecté → seul le bouton « Tableau de bord » apparaît.
- Annuaire : recherche en direct, filtres, listes déroulantes à recherche (aucun `<select>` natif), en-têtes fixes, compétences compactes sur une ligne, code postal, heures/semaine, photos, export désactivé si vide.
- Code postal : choisir une ville le remplit (géocodage inverse) ; les codes partiels (B1, B1 1) sont acceptés.
- Pays : Angleterre, Écosse, Pays de Galles, Irlande du Nord, Irlande, Île de Man, Jersey, Guernesey + Europe, avec drapeaux SVG.
- Compétences de soins bilingues : carer, care, support worker, kitchen assistant, RGN, nurse, chef, housekeeper, etc. Le libellé suit la langue de l’interface ; on peut chercher dans les deux langues.
- Trouver du staff : filtre code/ville, section « villes voisines » (ville + km), clic sur une personne = tracé sur la carte + distance/durée à pied, vélo, voiture, train.
- Missions (filtres avancés = bouton normal), Activité (groupée par jour), Notifications (recherche, non lues, supprimer les lues), Paramètres.

## 6. Limites connues
- Aucun test n’a pu être fait contre un vrai Supabase ni un vrai Mapbox ici : vérifiez l’auth, l’upload de photo et le tracé après configuration.
- La durée en train est une **estimation** (distance × 1,2 à 80 km/h + 12 min), pas un horaire.
- Les 126 tests unitaires, `tsc`, `eslint` et `next build` passent.
