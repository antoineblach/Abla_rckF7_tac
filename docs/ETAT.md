# État du projet

- Mise à jour : 2026-10-23
- Branche : `lot-3-corrections` (depuis `main` à `f1f4fcc`), non poussée
- Dernier commit : « Étape 3 : modèles et versions écrites par la page » (après `57e843d`, étape 2)
- `main` : lots 1, 2 et 3 fusionnés (PR #1 à #4, `f1f4fcc` le 16/10), déployés sur Pages, CI verte ; seule branche sur GitHub ; protection vérifiée (D-055)
- Écarts constatés à la reprise du 23/10, corrigés : ce fichier indiquait la PR #4 ouverte ; références locales `origin/lot-*` périmées (`git fetch --prune`) ; `docs/PASSATION.md` non suivi (commité tel quel).

## En cours

- Correction après recette du lot 3 (`docs/plans/lot-3-corrections.md`, D-097 à D-101) : dialogue « Version plus récente dans le dossier » qui apparaît en travaillant seul (concurrence confirmée par `updatedAt`, que l'annulation et les glissers remettent en arrière ; sauvegarde automatique pendant un glisser ; retours en arrière de Drive), et nouvelle combinaison depuis un modèle enregistrée seulement à la validation de la pose.
- Étapes 0 et 1 faites :
  - jeton `{ lastModified, size, contentHash }`, l'empreinte étant celle de l'élément relu du texte ;
  - `io/ownWrites.ts` (écritures de la page, référence), `io/syncLog.ts` (journal, branché dans `session.ts`) ;
  - retour en arrière réécrit dans `FileCollection.scan` ;
  - `IdbStore` relit l'entrée avant d'écrire ;
  - tests `state/syncSession.test.ts` : 7 sur 11 échouaient sur `main`.
- Étape 2 faite :
  - `decideExternalChange` par empreinte et origine ;
  - sauvegarde automatique différée pendant un geste (`SyncController.gestureEnded`, `state/syncBridge.ts`) ;
  - décisions consignées au journal.
- Étape 3 faite : `fresh()` (`state/presetSession.ts`) ne refuse plus une version écrite par la page ; refus consignés (`currentSyncLog`).
- Prochaine action : étape 4 (D-101 : nouvelle combinaison depuis un modèle enregistrée à la validation de la pose, la précédente relue à l'abandon).

## Fait

- Lots 1, 2 et 3 : PR #1 à #4 fusionnées.
- Lot 3, étapes 0 à 2 : plan ; `Play` v2 (schéma v1 figé, migration), `model/preset.ts`, fixtures figées `play-v2-lot3.json` et `preset-v1-touche.json` ; moteur (`engine/timeline.ts`, `engine/ballEvents.ts` : courses arrêtées, relais, boucle d'événements, ramassage, en-avant, ligne d'avantage).
- Constat : le scénario de référence du lot 1 contient une passe en avant au sens de 5.7 (option B, `uuid(231)`) ; les tests l'attendent désormais.
- Lot 3, étapes 3 à 6 : géométrie des modèles et de la combinaison entière ; rendu (tirets longs, ombre, regroupement, pastille d'en-avant) ; `io/collection.ts` et `modeles/` ; outils J et G, inspecteur, ballon au sol, calque « En-avant » (D-095).
- Lot 3, étape 7 (D-096) : `editor/placementMode.ts`, `state/presetSession.ts`, onglets de la bibliothèque, dialogues des modèles, bandeau de pose, « Déplacer la combinaison » et « Retourner » ; e2e `placement.chromium` et `presets.firefox`.
- Lot 3, étape 8 : `export/setPieces.test.ts` (image de GIF avec un jeu au pied en vol, tirets longs relus dans le PDF N&B, aucune icône d'en-avant dans le GIF ni le PDF, calque activé ; 2 images de référence vérifiées à l'œil), `pageDashes` dans `test/pdfInspect.ts`, export GIF et PDF dans `breakdown-kick.chromium` ; SPEC 1.4 (dont 10.5 corrigée selon D-086), ARCHITECTURE, RECETTE (section Lot 3), README (modèles, rechargement après déploiement).
- Recette automatisable : lint, typecheck, format, 438 tests unitaires, 32 tests de bout en bout (Chromium et Firefox), build ; aucun test désactivé ; fixtures v1 et v2 inchangées ; `bundle.chromium.spec.ts` vert.

## Reste à faire

- Correction du lot 3 : étapes 1 à 6 du plan, puis PR.
- Lot 3, en attente de l'utilisateur : 3 vérifications manuelles (modèle synchronisé entre les deux PC, GIF sur le téléphone, PDF N&B sur la laser) ; suite de la séance d'usage libre.
- Lot 2, en attente de l'utilisateur : vérifications manuelles (GIF sur le téléphone et WhatsApp avec et sans allègement, PDF N&B sur la laser, cahier sur le téléphone) ; retour de la séance d'usage libre. Une correction irait sur une branche `lot-2-corrections` (section « Chantiers en parallèle »).
- Lot 1, en attente de l'utilisateur : synchronisation Drive réelle entre les deux PC, conflit Drive réel, séance d'usage libre.

## Questions ouvertes

- Aucune.

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
