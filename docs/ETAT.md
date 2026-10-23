# État du projet

- Mise à jour : 2026-10-23
- Branche : `lot-3-corrections` (depuis `main` à `f1f4fcc`), poussée ; PR #5 vers `main` ouverte, CI verte sur `8543dec` (runs « push » et « pull_request », 23/10)
- Dernier commit : « État : CI verte de la PR #5 » (après `8543dec`, « Test de bout en bout : lecture pendant une écriture », qui corrige une course du test `sync-own-writes` apparue au run « push » de `0bae584`)
- `main` : lots 1, 2 et 3 fusionnés (PR #1 à #4, `f1f4fcc` le 16/10), déployés sur Pages, CI verte ; protection vérifiée (D-055)
- Écarts constatés à la reprise du 23/10, corrigés : ce fichier indiquait la PR #4 ouverte ; références locales `origin/lot-*` périmées (`git fetch --prune`) ; `docs/PASSATION.md` non suivi (commité tel quel).

## En cours

- Correction après recette du lot 3 (`docs/plans/lot-3-corrections.md`, D-097 à D-101), étapes 0 à 6 faites. Elle traite le dialogue « Version plus récente dans le dossier » qui apparaissait en travaillant seul, et la nouvelle combinaison depuis un modèle.
- En attente de l'utilisateur : fusion de la PR #5 (CI verte), puis Ctrl+F5 sur les deux PC, 2 vérifications manuelles (`docs/RECETTE.md`, section « Lot 3 : correction après recette ») et suite de la séance d'usage.
- Prochaine action : retour de recette (journal de synchronisation copié si un dialogue réapparaît), ou le lot 4 sur demande.

## Fait

- Lots 1, 2 et 3 : PR #1 à #4 fusionnées (détail des lots dans leurs plans, `docs/plans/`).
- Correction du lot 3 :
  - concurrence par l'empreinte du contenu relu (`VersionToken.contentHash`, D-097) ;
  - versions écrites par la page et retour en arrière de Drive réécrit (`io/ownWrites.ts`, `FileCollection.scan`, D-098) ;
  - aucune sauvegarde automatique pendant un glisser (`SyncController.gestureEnded`, `state/syncBridge.ts`, D-099) ;
  - journal de synchronisation (`io/syncLog.ts`, bouton dans les réglages, D-100) ;
  - nouvelle combinaison depuis un modèle écrite à la validation de la pose, précédente relue à l'abandon (`pendingCreation`, D-101) ;
  - SPEC 1.5 (6.6, 8.1, 8.3, 8.4, 10.1, 14, 16), ARCHITECTURE, RECETTE, README.
- Chaque test « échoue avant » a été exécuté sur `main` (arbre de travail temporaire) et y échouait comme prévu (détail par étape dans le plan).
- Recette automatisable : lint, typecheck, format, 481 tests unitaires, 33 tests de bout en bout (Chromium et Firefox), build ; aucun test désactivé ; fixtures v1 et v2 inchangées ; `bundle.chromium.spec.ts` vert.

## Reste à faire

- Correction du lot 3, en attente de l'utilisateur : fusion de la PR #5 ; 2 vérifications manuelles (15 minutes d'édition sur Drive réel en mode diffusion sans dialogue ; vraie modification sur l'autre PC) ; suite de la séance d'usage libre.
- Lot 3, en attente de l'utilisateur : 3 vérifications manuelles (modèle synchronisé entre les deux PC, GIF sur le téléphone, PDF N&B sur la laser).
- Lot 2, en attente de l'utilisateur : vérifications manuelles (GIF sur le téléphone et WhatsApp avec et sans allègement, PDF N&B sur la laser, cahier sur le téléphone) ; retour de la séance d'usage libre. Une correction irait sur une branche `lot-2-corrections` (section « Chantiers en parallèle »).
- Lot 1, en attente de l'utilisateur : synchronisation Drive réelle entre les deux PC, conflit Drive réel, séance d'usage libre.

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- Fixture figée `src/test/fixtures/play-v1-7v7-options.json` : ne plus la modifier (migration v1 vers v2 du lot 3).
- Limite de D-098 : une ancienne version remise à l'identique depuis l'autre PC (historique de Drive, import) est défaite tant que la page qui l'avait écrite est ouverte (README : recharger avant de restaurer).
- Les hypothèses 3 et 4 sur Drive (date changée après l'envoi, version antérieure rendue) restent à constater : le journal de synchronisation le dira.
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
- **OPFS et tests de bout en bout :**
  - une lecture pendant une écriture de la page échoue (`NotReadableError`, puis `NotFoundError` pendant le remplacement) ; `expect.poll` ne réessaie pas sur une erreur : lire avec `.catch(() => null)` ;
  - après « Choisir un dossier », attendre « Dossier : Rugby7 » avant de créer une combinaison (sinon elle part dans IndexedDB).
  - Ces courses ne se voient en local que sous charge : `--repeat-each=40 --workers=10`.

## Chantiers en parallèle

- Aucun.
