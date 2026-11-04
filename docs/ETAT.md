# État du projet

- Mise à jour : 2026-11-04
- Branche : `lot-frise-1` (depuis `main` à `00bd163`), poussée ; PR à la fin du lot, par `/fin-lot`
- `main` : lots 1, 2, 3, 3 bis, 3bis-1, chantiers `docs-outils` et `frise-spec` fusionnés (PR #1 à #10, `00bd163`), CI verte, déployés sur Pages
- Dépôt public ; Pages en mode « GitHub Actions » ; protection de `main` selon D-055, vérifiée le 23/10 (D-102)

## En cours

- Lot frise-1, modèle et moteur de la frise : plan `docs/plans/lot-frise-1.md`, validé le 04/11 ; décisions D-140 à D-157 (`docs/decisions/frise.md`). Étapes 0 et A faites : `src/v5/model` (types, schéma, refus des versions antérieures, branches, validation sauf cycles), `src/v5/test/builders.ts`, fixture `play-v5-frise.json`. L'application tourne encore sur la v4.
- Bloc suivant : B1 (compilation de ligne continue, sans collage, `src/v5/engine`). v5 écrite dans `src/v5/`, à côté de la v4, jusqu'à la bascule en C4 (D-140).

## Reste à faire

- Blocs B1, B2, C1 à C5, puis `/fin-lot`.
- Puis frise-2 à frise-4 par `/nouveau-lot` : section 7 de `docs/archive/plans/frise-spec.md`.
- Puis 3bis-2 réduit (menu du clic droit, même course pour plusieurs joueuses) et 3bis-3 (positions préréglées), par `/nouveau-lot` (D-128).
- Puis lot 4 (défense simulée ; plan archivé de 3bis-1, section G) et lot 5 (ateliers).
- Lot 3bis-1 : séance d'usage libre (`docs/RECETTE.md`), non signalée comme faite ; retour par `/correction-recette`.
- Lot 3 bis : les 3 vérifications manuelles de `docs/RECETTE.md` (Ctrl+F5 d'abord).
- Terrain, non bloquant : conflit Drive réel ; modèle enregistré sur un PC, appliqué sur l'autre ; GIF sur WhatsApp ; PDF N&B sur la laser ; cahier de jeu sur le téléphone.

## Pistes notées pour plus tard (D-118)

- Vitesse initiale à t = 0 ; ballon porté du côté du sens de course (D-041).

## Questions ouvertes

- Embranchement après la dernière action (D-153) : lettre de 5.1 en frise-1 ; à reposer au `/nouveau-lot frise-2`, où l'option vide devient courante.

## Écarts connus

- Aucun test désactivé.
- SPEC 1.9 en frise ; `src/` reste en v4 jusqu'à la bascule (C4).
- Fixtures figées : `play-v1-7v7-options.json`, `play-v2-lot3.json`, `play-v3-lot3bis.json`, `play-v4-lot3bis1.json`, `play-v5-frise.json`, `reglages-v3.json`.
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
