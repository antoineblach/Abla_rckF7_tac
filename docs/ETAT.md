# État du projet

- Mise à jour : 2026-10-24
- Branche : `lot-3bis` (depuis `main` à `e76aa13`), lot 3 bis en cours, poussée sur `origin` depuis l'étape 5
- `main` : lots 1, 2 et 3, la correction du lot 3 et la mise à jour de la mémoire fusionnés (PR #1 à #6 ; PR #6 le 23/10, commit de fusion `e76aa13`), CI verte, déployés sur Pages
- Dépôt public ; Pages en mode « GitHub Actions » ; protection de `main` identique à D-055, vérifiée par `gh api` le 23/10 (D-102)

## En cours

- Lot 3 bis : courses réalistes. Plan validé le 23/10 avec les réponses Q1 à Q13 : `docs/plans/lot-3bis.md` ; décisions D-103 à D-118 ; SPEC 1.6.
- Étape en cours : 8 (exports et clôture). Étapes 0 à 7 faites.
- Consigne : enchaîner les étapes sans attendre ; ne s'arrêter que sur une question bloquante.

## Fait

- Lots 1, 2 et 3, correction du lot 3 : PR #1 à #5 (détail dans les plans, `docs/plans/`).
- Écart de la reprise du 23/10 : ETAT.md disait « PR #6 à fusionner », elle l'était (`e76aa13`) ; `origin/etat-23-10` était une référence locale périmée, retirée par `git fetch --prune`.
- Lot 3 bis, étape 0 : branche, plan, SPEC 1.6, D-103 à D-118.
- Lot 3 bis, étape 1 : combinaison v3 (`Waypoint.speed`, `endsAtSpeed`, `sync`, `release`), schéma v2 figé, migration v2 vers v3 (fin lancée posée), `reglages.json` v3 (`motion`, `speedAlert`, sprint 7 vers 5,5), graphe des liens (`model/syncGraph.ts`), validation, fixtures `play-v3-lot3bis.json` et `reglages-v2.json`. Précision de D-108 : la receveuse calée sur l'arrivée de sa passe n'est pas une boucle.
- Lot 3 bis, étape 2 : profil de vitesse (`engine/profile.ts` : trapèze sur les échantillons, inverse exacte, solveur de facteur), vitesses par segment, durée imposée par facteur (inatteignable : `durationCapped`), course lancée (recompilée tant qu'une course lancée attend la fin du temps ; prolongement avec raccord de tangente, `spline.ts` ; `runNotContinued`), relayeur à profil (arrive à la sortie de balle même au-delà des accélérations bornées, D-079), alertes de vitesse. Tests du moteur recalculés sur le profil (`src/test/profileMath.ts`) ; les tests des regroupements gardent des accélérations quasi instantanées (règles, pas profil) ; 14 images de référence régénérées (positions en cours de course, point du ruck de la fixture v2 dont la durée imposée de 1,5 s est inatteignable).
- Lot 3 bis, étape 3 : file d'événements du ballon (lâcher à la réception programmé par chaque réception, tolérance de 0,5 s pour un lâcher fixe, lâcher à la réception jamais déclenché ignoré et signalé), résolution des liens par simulation dans l'ordre du graphe (`RunMotion.sync` : délai, facteur, statut, points), replis (`syncLate`, `syncSpeedCapped`, `syncTargetInvalid` « unreached »), départ différé qui prolonge une course lancée. Tests : `engine/sync.test.ts`.
- Lot 3 bis, étape 4 : `engine/actionReport.ts` (`phaseReport` : lignes triées, détails par type, segments, lien, fin lancée, lâcher), morceaux rapides des tracés (`RunTrace.parts`, `SchematicRun.parts`, `partsBetween`), pastilles de vitesse (`SceneState.speedBadges`, `PhaseSchematic.speedBadges`), géométrie des liens (`PhaseSchematic.syncLinks`). Tests : `engine/actionReport.test.ts`.
- Lot 3 bis, étape 5 : segments rapides plus épais (`fastRunWidth`, 4 thèmes) ; pastilles de vitesse orange et rouge (calque `speedAlert` du lecteur, toujours dans l'éditeur, jamais dans le GIF, le PDF ni les vignettes) ; lien de synchronisation (tirets fins) et halo de survol (tirets) dans la surcouche, `hoveredActionId` du store d'interaction (alimenté par la liste à l'étape 7). Tests : `render/speeds.test.ts`, `export/speeds.test.ts`. 17 images de référence régénérées, 2 nouvelles.
- Lot 3 bis, étape 6 : commandes (vitesse de segment, fin lancée, liens avec refus des boucles, réglage, retrait qui fige le délai calculé, index des points décalés et liens retirés à la suppression d'un point, copie des liens par « Dupliquer », mode de lâcher), lâcher posé par les outils (D-119 : ramassage au sol en instant fixe), `Selection.segment` et segment sous le pointeur (`SchematicRun.segmentEnds`), raccourcis 1 2 3 0 (aussi par `code`, AZERTY), « Caler sur… » (`editor/syncPick.ts`, `syncPick` du store, refus avec message, Échap), automate d'Espace (`editor/spaceKey.ts`, branché à l'étape 7), fin lancée posée par l'outil Course. Précisions : D-120. Tests : `editor/segments`, `editor/links`, `editor/spaceKey`, `state/links`. Test de bout en bout `breakdown-kick` : `schemaVersion` 3 attendu (oubli de l'étape 1).
- Lot 3 bis, étape 7 : bande du bas partagée (arbre 2/5, `ui/phases/ActionList.tsx` 3/5 : lignes triées, barres, pastilles, clic, survol, Suppr) ; `ui/describe.ts` et `ui/phases/actionRows.ts` (libellés purs) ; `ui/inspector/RunInspector.tsx` (allure en km/h, bloc « Segment n », fin lancée et attente, lien : cible, rendez-vous, réglage, résultat, « Changer la cible », « Retirer le lien ») ; `ReleaseFields` (passe et jeu au pied) ; `field/SyncBanner.tsx` ; calque « Vitesses » ; réglages (profil, seuils en km/h, allures en km/h) ; message du sprint une fois par poste ; Espace (`ui/hooks/useSpaceKey.ts`, automate de l'étape 6) ; halo de survol aussi en lecture. Précisions : D-121. Bout en bout : `actions-list`, `run-speeds`, `space` (Chromium et Firefox), `field-stability` (liste).
- Reprise du 24/10 (limite d'usage pendant l'étape 5) : les 7 fichiers modifiés le 23/10 à 19:35:55, 69 s après l'étape 4, étaient un début cohérent de l'étape 5 (clés de thème, segments rapides, pastilles, calque, exclusion du GIF), et non une écriture interrompue : gardés tels quels, seuls deux tests ne compilaient plus.

## Reste à faire

- Lot 3 bis : étape 8 du plan (exports, ARCHITECTURE, RECETTE, README, PR).
- Vérifications de terrain, non bloquantes, pas encore faites :
  - conflit Drive réel, avec la vraie modification sur l'autre PC de la correction du lot 3 ;
  - modèle enregistré sur un PC, visible et appliqué sur l'autre ;
  - GIF sur WhatsApp, avec et sans allègement ;
  - PDF N&B sur la laser ;
  - cahier de jeu sur le téléphone.
- Puis lot 4 (défense simulée) et lot 5 (ateliers).

## Pistes notées pour plus tard (D-118)

- Accélération exponentielle (forte au départ, plus douce près de la vitesse de pointe).
- Vitesse initiale au temps 1 : une joueuse déjà lancée au départ de la combinaison.
- Ballon porté du côté du sens de course plutôt que toujours vers l'attaque (D-041).

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- Fixtures figées : `play-v1-7v7-options.json` et `play-v2-lot3.json` ; ne plus les modifier.
- Limite de D-098 : une ancienne version remise à l'identique depuis l'autre PC (historique de Drive, import) est défaite tant que la page qui l'avait écrite est ouverte (README : recharger avant de restaurer).
- Les hypothèses 3 et 4 sur Drive (date changée après l'envoi, version antérieure rendue) restent à constater : le journal de synchronisation le dira.
- Le seuil « traits >= 3 px » du thème Contraste fort est testé sur `render`, pas sur la surcouche d'édition (jamais exportée).
- À 1280 px de large, et à 1440 px depuis la case « Vitesses » (D-121), la seconde rangée du transport défile horizontalement ; sous 1500 px, le titre de l'application est masqué (D-077).
- En portrait, une combinaison large laisse du terrain vide au-dessus et au-dessous dans les GIF (D-061).
- Le même GIF diffère entre Chromium et Firefox (rendu du texte) : le déterminisme vaut pour un même navigateur.

## Pièges rencontrés

- `typescript-eslint` refuse TypeScript 7 : rester en 6.0 (D-031). TS 6 : `types` vaut `[]` par défaut.
- Le lint strict vaut aussi pour les tests : ni `!` non nul ni condition inutile ; passer par de petites fonctions qui lèvent une erreur.
- `no-restricted-properties` sur `filter` bloquerait `Array.filter` : viser l'affectation.
- `prettier --write` reformate les fichiers : relire avant un Edit ou un Write.
- L'outil Bash échoue sur les longs heredocs (encore constaté le 23/10 pour DECISIONS.md), et une commande qui lit l'entrée standard (`cat > fichier` sans heredoc) bloque : écrire les gros fichiers avec Write ou Edit, les scripts dans un fichier.
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
- Passer le dépôt en privé désactive GitHub Pages et supprime la protection de `main` (compte sans abonnement payant) : le dépôt reste public (D-102). Pour rétablir, voir D-102.
- La tolérance des images de référence (0,5 % des pixels) masque un trait épaissi ou une petite dérive : après un changement de rendu, régénérer (`UPDATE_SNAPSHOTS=1`) et comparer à `HEAD` pour voir ce qui a bougé.
- Une branche supprimée sur GitHub reste visible en local (`origin/...`) tant qu'on n'a pas lancé `git fetch --prune`.
- Vérifier qu'un test attrape un défaut : arbre de travail temporaire sur `main` avec une jonction vers `node_modules` ; supprimer la jonction (`rmdir`) avant `git worktree remove`.
- **OPFS et tests de bout en bout :**
  - une lecture pendant une écriture de la page échoue (`NotReadableError`, puis `NotFoundError` pendant le remplacement) ; `expect.poll` ne réessaie pas sur une erreur : lire avec `.catch(() => null)` ;
  - après « Choisir un dossier », attendre « Dossier : Rugby7 » avant de créer une combinaison (sinon elle part dans IndexedDB).
  - Ces courses ne se voient en local que sous charge : `--repeat-each=40 --workers=10`.

## Chantiers en parallèle

- Aucun.
