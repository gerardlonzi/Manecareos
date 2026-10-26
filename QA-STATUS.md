# Contrôle qualité — refonte Manecareos

Date : 23 octobre 2026.

## Changements effectués dans cette passe

- Le tableau de bord suit désormais une structure inspirée de l’écran Stitch « Operational Dashboard » : bloc « Vue d’ensemble » en premier, exactement cinq cartes statistiques en ligne lorsque l’espace le permet, puis une section en deux colonnes « Missions prioritaires » / « Activité récente ».
- Les cinq cartes sont cliquables et affichent `0` lorsqu’un compteur renvoie une valeur absente.
- Les boutons d’action principaux utilisent le vert `#0b6e62`. Le bleu `#1d3b5c` est conservé comme couleur secondaire de marque, pour les repères et certains éléments visuels.
- Ajout d’une barre supérieure globale avec recherche, action d’ajout et accès aux notifications/profil.
- Ajout d’un raccourci « Nouvelle mission » dans la barre latérale, avec version compacte lorsque la barre est réduite.
- La route `/` redirige vers `/dashboard` lorsqu’une session authentifiée existe. Les pages de connexion et d’inscription redirigent également les utilisateurs déjà connectés vers le tableau de bord.
- Les pages de création/modification du personnel, des missions et d’import CSV ainsi que les réglages occupent la largeur disponible, au lieu de laisser une grande zone vide à droite.
- Les sélecteurs de pays du formulaire staff, des réglages, de l’inscription, des filtres staff et de la liste des missions utilisent une recherche intégrée, et non une liste native pour les pays.
- Le champ de code postal recherche désormais en parallèle les résultats de villes/localités et les résultats de codes postaux, puis les fusionne. Cela permet d’exposer plusieurs secteurs postaux lorsque le fournisseur en retourne plusieurs.
- Le sélecteur de compétences dans le formulaire staff ferme la liste après une sélection ; il reste possible de rouvrir la liste et de choisir plusieurs compétences, lesquelles restent visibles sous forme de pastilles.
- Les actions de ligne dans l’annuaire sont plus compactes et utilisent des icônes accessibles avec des titres/labels. L’action d’archivage groupée a été rapprochée du contrôle de disponibilité.
- Le bouton de rafraîchissement est désormais iconographique avec `aria-label` et `title`.
- Les onglets de réglages, les en-têtes de création et plusieurs libellés des réglages/annuaire sont bilingues.
- Correction du type de propriétés de `CountryMapPreview` : les propriétés `expanded` et `onToggleExpand` utilisées par la page de recherche sont maintenant déclarées.
- La palette du panneau d’authentification et du CTA public a été harmonisée autour du bleu marine et du vert demandés.

## Vérifications réellement effectuées

| Vérification | Résultat |
|---|---|
| Analyse syntaxique TS/TSX avec TypeScript global | Réussie : 140 fichiers analysés, 0 erreur de syntaxe |
| Imports locaux `@/` et relatifs | Réussie : aucun import local manquant détecté (hors références générées `.next` dans `next-env.d.ts`) |
| `tsc --noEmit` | Bloqué avant analyse du projet : les types `geojson` et `node` ne sont pas installés |
| ESLint, tests Vitest, build Next.js et Playwright | Non exécutés : les dépendances du projet ne sont pas installées |
| Tests réels avec Supabase et Mapbox | Non exécutés : aucun environnement de test/jeton valide fourni ici |

## Éléments qui ne doivent pas être présentés comme terminés

- La couverture bilingue complète de toutes les chaînes de toutes les pages n’a pas encore été auditée exhaustivement.
- Le formulaire ne persiste pas de photo de profil : le schéma `staff` existant ne comporte pas de champ de photo. Une photo persistante nécessite une décision de stockage et une migration autorisée ; aucune modification de schéma n’a été faite.
- Les correspondances de ville et de code postal restent dépendantes des résultats réels du fournisseur Mapbox. Le code n’invente pas de code postal lorsque le fournisseur ne le renvoie pas.
- Le fonctionnement de bout en bout de tous les parcours doit être testé avec des identifiants Supabase/Mapbox valides avant une mise en production.
