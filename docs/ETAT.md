# État du projet

- Mise à jour : 2026-10-16
- Branche : `lot-3` (depuis `main` à `855a804`), pas encore poussée
- Dernier commit : « Étape 0 : plan du lot 3 »
- `main` : lots 1 et 2 fusionnés (PR #1, #2, #3 `855a804`), déployés sur Pages, CI verte ; protection vérifiée (D-055)
- Écart constaté au démarrage du lot 3 : `ETAT.md` indiquait la PR #3 ouverte ; elle est fusionnée (16/10). Corrigé ici.

## En cours

- Lot 3 (mise en place) : plan validé (`docs/plans/lot-3.md`), réponses Q1 à Q19, décisions D-078 à D-094.
- Consigne de l'utilisateur : enchaîner les étapes sans attendre ; ne s'arrêter que sur une question bloquante.
- Prochaine action : étape 1 (modèle : schéma v2, migration, fixtures, `PlacementPreset`, validation).

## Fait

- Lot 1 : PR #1 et correction après recette PR #2, fusionnées.
- Lot 2 : PR #3 fusionnée (exports GIF et PDF ; D-057 à D-077).
- Lot 3 : étape 0 (branche, plan, décisions).

## Reste à faire

- Lot 3 : étapes 1 à 8 du plan.
- Lot 2, en attente de l'utilisateur : vérifications manuelles (GIF sur le téléphone et WhatsApp avec et sans allègement, PDF N&B sur la laser, cahier sur le téléphone) ; retour de la séance d'usage libre. Une correction irait sur une branche `lot-2-corrections` (section « Chantiers en parallèle »).
- Lot 1, en attente de l'utilisateur : synchronisation Drive réelle entre les deux PC, conflit Drive réel, séance d'usage libre.

## Questions ouvertes

- Aucune.

## Points à reporter en fin de lot 3

- SPEC 10.5 et `RECETTE.md` (section Lot 3, « alerte visible dans les exports ») à corriger selon D-086 : jamais d'icône d'en-avant dans les exports.
- README : recharger la page sur les deux PC après le déploiement (fichiers v2 vus comme « version plus récente » par une page ancienne).

## Écarts connus

- Aucun test désactivé.
- Fixture figée `src/test/fixtures/play-v1-7v7-options.json` : ne plus la modifier (migration v1 vers v2 du lot 3).
- Le seuil « traits >= 3 px » du thème Contraste fort est testé sur `render`, pas sur la surcouche d'édition (jamais exportée).
- À 1280 px de large, la seconde rangée du transport défile horizontalement ; sous 1500 px, le titre de l'application est masqué (D-077).
- En portrait, une combinaison large laisse du terrain vide au-dessus et au-dessous dans les GIF (D-061).
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
