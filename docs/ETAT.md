# État du projet

- Mise à jour : 2026-11-06
- Branche : `lot-frise-1` (depuis `main` à `00bd163`), poussée ; PR à la fin du lot, par `/fin-lot`
- `main` : lots 1, 2, 3, 3 bis, 3bis-1, chantiers `docs-outils` et `frise-spec` fusionnés (PR #1 à #10, `00bd163`), CI verte, déployés sur Pages
- Dépôt public ; Pages en mode « GitHub Actions » ; protection de `main` selon D-055, vérifiée le 23/10 (D-102)

## En cours

- Lot frise-1, modèle et moteur de la frise : plan `docs/plans/lot-frise-1.md`, validé le 04/11 ; décisions D-140 à D-175 (`docs/decisions/frise.md`). Étapes 0, A, B1, B2, C1 à C4 faites : l'application tourne sur la v5, `src/v5/` a disparu, la v4 est supprimée ; liste « Ligne », « Bord précédent » et « Bord suivant », liste des actions de la ligne, inspecteur des collages.
- Bloc suivant : C5 (e2e réécrits ou reportés, refus v1 à v4 en e2e, `cahier.combipack.json` en v5 ; relais dans la section C4 du plan).
- Compilation (`npm run bench`, D-150), dernière comparaison, 06/11 avant la bascule, v5 contre v4 : une ligne 10,8 contre 17,3 ms ; glisser, toutes lignes, 10,7 contre 31,8 ms, sous la cible de 16 ms. Le bench ne mesure plus que la v5 : 10,2 ms sur les deux scénarios. Scénario de référence : 18 actions contre 16 (D-157).

## Reste à faire

- Bloc C5, puis `/fin-lot`.
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
- D-172, D-174 et D-175 : précisions des étapes C3 et C4, à contredire au besoin ; D-172 retire le mode de lecture du store (à l'arrêt, le terrain édite).
- D-173, retouchée le 06/11 : en lecture, halo d'une action en cours limité à ce qui est dessiné et halo des actions en grisé, à contredire au besoin.
- Freinage au raccord de deux courses collées, vu en C4 : une course lancée qui tourne au raccord part à pleine vitesse sur une spline qui tourne aussitôt. Alerte rouge « irréaliste » : 30 m/s² à 38°, 45 m/s² à 90° ; aucune dans le prolongement, ni sur le même tracé en une seule course. Défaut du moteur, ou alerte à accepter ? À trancher avant frise-2, où la coupe de course rendra ce cas courant.

## Écarts connus

- E2e mis de côté jusqu'à C5, dans `e2e/a-porter/` (`testIgnore` provisoire de `playwright.config.ts`), compilés et lintés : `actions-list`, `breakdown-kick`, `degraded`, `export-gif`, `export-pdf`, `export.firefox`, `field-stability`, `folder`, `interface`, `run-speeds`, `space`.
- SPEC 1.9 en frise, `src/` aussi ; le site ne crée ni option ni consigne avant frise-2 (D-142).
- Fixtures figées : `play-v1-7v7-options.json`, `play-v2-lot3.json`, `play-v3-lot3bis.json`, `play-v4-lot3bis1.json`, `play-v5-frise.json`, `reglages-v3.json`.
- D-098 : une version remise à l'identique depuis l'autre PC est défaite tant que la page qui l'avait écrite est ouverte (README).
- Hypothèses 3 et 4 sur Drive : à constater par le journal de synchronisation.
- « Traits >= 3 px » du thème Contraste fort testé sur `render`, pas sur la surcouche d'édition.
- Seconde rangée du transport défilante à 1280 px, et à 1440 px avec « Vitesses » (D-121) ; titre masqué sous 1500 px (D-077).
- GIF en portrait d'une combinaison large : terrain vide au-dessus et au-dessous (D-061). Même GIF différent entre Chromium et Firefox (texte).
- Morceau principal de 568 Ko signalé par Vite.
- Losanges placés en mètres (D-137) : contre le jeton sous 11 px/m environ, ou sur un segment de moins de 5 m.
- Lecture de démarrage au-dessus de la cible de 8 000 o.

## Pièges rencontrés

- Dans `docs/PIEGES.md`, par domaine : lire la section avant d'y toucher.

## Chantiers en parallèle

- Aucun.
