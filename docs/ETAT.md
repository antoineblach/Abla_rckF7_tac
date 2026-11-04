# État du projet

- Mise à jour : 2026-11-04
- Branche : `frise-spec` (depuis `main` à `d33313f`), poussée ; PR #10 vers `main`, ouverte, sans fusion
- `main` : lots 1, 2, 3, 3 bis, 3bis-1 et chantier `docs-outils` fusionnés (PR #1 à #9), CI verte, déployés sur Pages
- Dépôt public ; Pages en mode « GitHub Actions » ; protection de `main` selon D-055, vérifiée le 23/10 (D-102)

## En cours

- Chantier `frise-spec`, SPEC 1.9 : frise chronologique à la place des temps (`docs/plans/frise-spec.md`, D-139), sans code. Toutes les étapes sont faites.
- À faire par l'utilisateur : relire la PR #10, surtout les « Précisions prises en écrivant les SPEC 6 à 12 » de D-139, puis fusionner.

## Reste à faire

- Après la fusion : `/nouveau-lot` pour frise-1 à frise-4 (plan, section 7).
- Puis 3bis-2 réduit (menu du clic droit, même course pour plusieurs joueuses) et 3bis-3 (positions préréglées), par `/nouveau-lot` (D-128).
- Puis lot 4 (défense simulée ; plan archivé de 3bis-1, section G) et lot 5 (ateliers).
- Lot 3bis-1 : séance d'usage libre (`docs/RECETTE.md`), non signalée comme faite ; retour par `/correction-recette`.
- Lot 3 bis : les 3 vérifications manuelles de `docs/RECETTE.md` (Ctrl+F5 d'abord).
- Terrain, non bloquant : conflit Drive réel ; modèle enregistré sur un PC, appliqué sur l'autre ; GIF sur WhatsApp ; PDF N&B sur la laser ; cahier de jeu sur le téléphone.

## Pistes notées pour plus tard (D-118)

- Vitesse initiale au temps 1 ; ballon porté du côté du sens de course (D-041).

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- SPEC 1.9 en frise ; `src/` reste en v4 jusqu'à frise-1.
- Fixtures figées : `play-v1-7v7-options.json`, `play-v2-lot3.json`, `play-v3-lot3bis.json`, `play-v4-lot3bis1.json`, `reglages-v3.json`.
- D-098 : une version remise à l'identique depuis l'autre PC est défaite tant que la page qui l'avait écrite est ouverte (README).
- Hypothèses 3 et 4 sur Drive : à constater par le journal de synchronisation.
- « Traits >= 3 px » du thème Contraste fort testé sur `render`, pas sur la surcouche d'édition.
- Seconde rangée du transport défilante à 1280 px, et à 1440 px avec « Vitesses » (D-121) ; titre masqué sous 1500 px (D-077).
- GIF en portrait d'une combinaison large : terrain vide au-dessus et au-dessous (D-061). Même GIF différent entre Chromium et Firefox (texte).
- Morceau principal de 568 Ko signalé par Vite. Compilation de la combinaison réaliste : 3 puis 14 ms (D-130).
- Losanges placés en mètres (D-137) : contre le jeton sous 11 px/m environ, ou sur un segment de moins de 5 m.
- Lecture de démarrage au-dessus de la cible de 8 000 o.

## Pièges rencontrés

- Dans `docs/PIEGES.md`, par domaine : lire la section avant d'y toucher.

## Chantiers en parallèle

- Aucun.
