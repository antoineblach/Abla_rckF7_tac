# État du projet

- Mise à jour : 2026-10-15
- Branche : `lot-2` (depuis `main` à `9a2c379`), poussée ; PR `lot-2` vers `main` ouverte (voir `gh pr list`), CI à vérifier
- Dernier commit : « Délais des tests d'encodage pour la CI » (après `abe4424`, clôture du lot 2)
- `main` : lot 1 et sa correction fusionnés (PR #1 `d37f3f6`, PR #2 `9a2c379`), déployés sur Pages ; protection vérifiée par `gh api` (D-055)
- Écart constaté à la reprise du 15/10 : l'étape 1 avait été interrompue (limite d'usage) avec des modifications non commitées ; examinées, complétées et commitées sans rien jeter (`c6fa414`).

## En cours

- Lot 2 (exports GIF et PDF) terminé : étapes 0 à 7 cochées dans `docs/plans/lot-2.md` ; décisions D-057 à D-077.
- En attente de l'utilisateur : CI verte de la PR puis fusion ; les 3 vérifications manuelles du lot 2 (`docs/RECETTE.md`, section « Lot 2 ») et la séance d'usage libre.

## Fait

- Lot 1 : étapes 0 à 7 (`docs/plans/lot-1.md`), PR #1 fusionnée ; correction après recette (`docs/plans/lot-1-corrections.md`), PR #2 fusionnée.
- Lot 2 : plan et prototypes (`1a41e1f`, `50ee9e7`) ; réglages v2, noms, lisibilité (`c6fa414`) ; thèmes d'impression, habillage, ballon en Bézier (`0fe6ebc`) ; GIF (`38e7ba6`) ; PDF vectoriel et cahier (`d74dd14`) ; io des exports et Worker (`56abc6f`) ; interface des exports et bout en bout (`262f378`) ; clôture : SPEC 1.3 (3.1, 3.2, 3.3, 4.4, 8.2, 8.5, 9, 13.2, 14, 16), ARCHITECTURE, RECETTE, README.
- Recette automatisable complète en local : lint, typecheck, 289 tests unitaires, 23 tests de bout en bout (Chromium et Firefox, vrai Worker), build, format.

## Reste à faire

- Lot 2 : fusion par l'utilisateur ; vérifications manuelles (GIF sur le téléphone et WhatsApp avec et sans allègement, PDF N&B sur la laser, cahier sur le téléphone) ; retour de la séance d'usage libre.
- Lot 1, toujours en attente de l'utilisateur : synchronisation Drive réelle entre les deux PC, conflit Drive réel (« Garder les deux »), séance d'usage libre.
- Lot 3 (mise en place) : pas commencé ; commencer en mode plan.

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- Fixture figée `src/test/fixtures/play-v1-7v7-options.json` : ne plus la modifier (migration v1 vers v2 du lot 3).
- Le seuil « traits >= 3 px » du thème Contraste fort est testé sur `render`, pas sur la surcouche d'édition (jamais exportée).
- À 1280 px de large, la seconde rangée du transport défile horizontalement ; sous 1500 px, le titre de l'application est masqué (D-077).
- En portrait, une combinaison large laisse du terrain vide au-dessus et au-dessous dans les GIF (échelle fixée par la largeur, attaque vers le haut, D-061).
- Le même GIF diffère entre Chromium et Firefox (rendu du texte) : le déterminisme vaut pour un même navigateur.

## Pièges rencontrés

- `typescript-eslint` refuse TypeScript 7 : rester en 6.0 (D-031). TS 6 : `types` vaut `[]` par défaut.
- Le lint strict vaut aussi pour les tests : ni `!` non nul ni condition inutile ; passer par de petites fonctions qui lèvent une erreur.
- `no-restricted-properties` sur `filter` bloquerait `Array.filter` : viser l'affectation.
- `prettier --write` reformate les fichiers : relire avant un Edit ou un Write.
- L'outil Bash échoue sur les longs heredocs, et une commande qui lit l'entrée standard (`cat > fichier` sans heredoc) bloque : écrire les gros fichiers avec Write ou Edit, les scripts dans un fichier.
- Caractères invisibles ou combinants (U+0300 à U+036F, U+202F) : jamais bruts ni en échappement dans le source ; `/\p{Mn}/gu` ou `String.fromCharCode` (ESLint `no-irregular-whitespace`).
- La règle ESLint des hooks React prend toute fonction `useXxx` pour un hook.
- Playwright : `fill` refusé sur un curseur hors pas (touche End) ; `selectOption` ne donne pas le focus ; coordonnées de souris arrondies au pixel ; un clic à moins d'un rayon de jeton sélectionne la joueuse.
- Grille CSS : une piste `auto` voisine d'une piste `1fr` suit le contenu des autres cellules en Chrome ; tailles fixes autour du terrain.
- Contexte 2D de jsPDF : transformations appliquées à l'ajout des points, chemin perdu entre `save` et `restore`, tirets non mis à l'échelle, taille de police arrondie à l'entier inférieur en points, `measureText` renvoie un objet malgré ses types.
- La police Atkinson Hyperlegible couvre le français sauf U+202F (remplacée par U+00A0, `export/text.ts`) ; son zéro est barré.
- gifenc : avec `transparent`, `dispose` vaut 2 par défaut : toujours `dispose: 1` ; `quantize` et `applyPalette` lisent tout `t.buffer` : tableaux autonomes.
- pdf.js renvoie `null` (et non `[]`) pour un PDF sans signets. Une liste de `combinaisons/` pendant une écriture contient le `.crswap` de Chrome : filtrer sur `.combi.json`.
- Le morceau principal ne doit importer ni `export/jobSteps.ts` ni les encodeurs : `export/jobs.ts` reste léger (contrôlé par `bundle.chromium.spec.ts`).
- Vitest coupe un test à 5 s par défaut ; le runner de la CI encode 2 à 3 fois moins vite que ce poste : les groupes de tests qui encodent réellement ont un délai explicite (`ENCODING_TIMEOUT_MS`).
- Vérifier qu'un test attrape un défaut : arbre de travail temporaire sur `main` avec une jonction vers `node_modules` ; supprimer la jonction (`rmdir`) avant `git worktree remove`.

## Chantiers en parallèle

- Aucun.
