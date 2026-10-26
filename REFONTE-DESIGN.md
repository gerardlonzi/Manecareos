# Manecareos — refonte visuelle basée sur la référence Stitch

Cette version part du projet Manecareos précédemment fourni et conserve son architecture, ses flux métier, ses intégrations et son mécanisme de préférences français/anglais + thème clair/sombre. Les écrans Stitch `StaffFlow / Precision Logistics` servent de direction visuelle ; ils ne remplacent pas les fonctionnalités métier existantes.

## Modifications de cette passe

- Page d’accueil reconstruite avec huit sections explicatives, un hero animé, une maquette opérationnelle, des fonctionnalités détaillées, un workflow, une section géographique, un exemple d’import CSV, un bloc de transparence, un appel à l’action et un footer complet. Les nouveaux textes sont bilingues via les préférences existantes.
- Palette recentrée sur le bleu marine `#1d3b5c` et le vert `#0b6e62` (vert pour les boutons principaux), avec des tons neutres et des accents complémentaires discrets, avec animations mesurées et prise en compte de `prefers-reduced-motion`.
- Logo vectoriel intégré (repère géographique + croix médicale), utilisé dans la page publique, l’authentification et l’application.
- Sidebar plus compacte et rétractable ; navigation bilingue ; clic sur le compte pour ouvrir le profil ; suppression de l’entrée de réglages séparée dans la sidebar ; déconnexion déplacée vers le profil.
- Mode clair/sombre et langue français/anglais conservés via le fournisseur de préférences existant.
- Dashboard : cinq cartes statistiques en premier bloc « Vue d’ensemble », puis deux colonnes « Missions prioritaires » et « Activité récente », selon la composition de l’écran Stitch opérationnel. Les compteurs affichent zéro lorsque les données sont absentes.
- Recherche de personnel : carte avant la première recherche, carte placée à gauche des résultats, contrôles plan/satellite et agrandissement dans la largeur du contenu sans recouvrir la sidebar.
- Carte du pays étendue à davantage de pays européens ; contrôle d’agrandissement intégré sans utiliser le plein écran du navigateur.
- Formulaire staff : indicatif téléphonique avec drapeau et code pays ; le code staff reste généré automatiquement et non éditable.
- Catalogue de compétences réutilisable avec recherche, sélection multiple et libellés français/anglais ; même sélection disponible dans le formulaire de mission.
- Localisation commune aux fiches staff, missions et recherche : suggestions de lieux priorisant les codes postaux. La sélection d’un code postal remplit la ville et la région lorsque le fournisseur les renvoie. Les villes avec plusieurs codes postaux peuvent proposer plusieurs résultats.
- Liste des pays étendue à la majorité des pays européens. Le Royaume-Uni reste un seul pays sélectionnable ; l’Angleterre, l’Écosse, le pays de Galles et l’Irlande du Nord sont couverts par la recherche géographique britannique.
- Notifications présentées en éléments plus lisibles, avec états non lus visibles et traduction des types de notification connus.
- Le journal d’activité utilise des libellés d’événements français/anglais.
- La confirmation de navigation sur un formulaire modifié utilise une boîte de dialogue applicative, pas `window.confirm`.
- La déconnexion est disponible depuis le profil plutôt que dans la navigation principale.

## Configuration à vérifier

- Les cartes et suggestions de lieux dépendent du jeton Mapbox public configuré dans l’application.
- La couverture des codes postaux dépend du fournisseur. Si un lieu ne possède pas de code postal reconnu, le formulaire conserve la possibilité de vérifier la ville avant l’enregistrement.
- Le build complet et les tests d’intégration n’ont pas pu être exécutés dans l’environnement de préparation, car les dépendances n’étaient pas installées et le registre npm n’était pas accessible. Une vérification syntaxique TypeScript/TSX est effectuée sur les fichiers modifiés.

## Points restant à vérifier

- Les textes des notifications existantes et certaines descriptions d’activité déjà stockées en base peuvent rester dans la langue dans laquelle elles ont été créées. Les libellés d’interface ont été traduits, mais une migration des messages historiques n’est pas incluse.
- Certaines chaînes statiques dans des écrans secondaires hérités nécessitent encore un audit exhaustif français/anglais.
- Le mode sombre est appliqué globalement, mais quelques couleurs codées directement dans des écrans anciens peuvent nécessiter une passe visuelle dédiée.
- Tester en environnement configuré les parcours complets de création/modification du staff et des missions, l’import CSV, les calculs d’itinéraire, les contrôles d’accès et le responsive.
