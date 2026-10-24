# État du projet

- Mise à jour : 2026-10-24
- Branche : `lot-3bis` (depuis `main` à `e76aa13`), poussée sur `origin` ; lot 3 bis terminé, PR vers `main` à fusionner par l'utilisateur après la CI
- `main` : lots 1, 2 et 3, la correction du lot 3 et la mise à jour de la mémoire fusionnés (PR #1 à #6 ; PR #6 le 23/10, commit de fusion `e76aa13`), CI verte, déployés sur Pages
- Dépôt public ; Pages en mode « GitHub Actions » ; protection de `main` identique à D-055, vérifiée par `gh api` le 23/10 (D-102)

## En cours

- Lot 3 bis : courses réalistes, étapes 0 à 8 faites (`docs/plans/lot-3bis.md`, cases cochées avec leurs commits ; décisions D-103 à D-121 ; SPEC 1.6).
- À faire par l'utilisateur : fusionner la PR quand la CI est verte, recharger la page sur les deux PC (Ctrl+F5), puis les 3 vérifications manuelles et la séance d'usage libre de `docs/RECETTE.md` (section « Lot 3 bis »).

## Fait

- Lots 1, 2 et 3, correction du lot 3 : PR #1 à #5 (détail dans les plans, `docs/plans/`).
- Lot 3 bis (détail par étape dans le plan et les messages de commit) :
  - modèle v3 et `reglages.json` v3 (profil, seuils, sprint 5,5 m/s), graphe des liens ;
  - moteur : profil de vitesse, vitesses par segment, durée imposée par facteur, fin lancée avec raccord de tangente, liens résolus dans l'ordre du graphe, lâcher à la réception et tolérance de 0,5 s, alertes de vitesse, rapport des actions ;
  - rendu : segments rapides plus épais (4 thèmes, exports compris), pastilles de vitesse (jamais exportées), lien et halo dans la surcouche ;
  - éditeur : commandes des segments, des liens et du lâcher, choix de la cible, raccourcis 1 2 3 0 (AZERTY compris), fin lancée posée par l'outil Course, automate d'Espace ;
  - interface : liste des actions dans la bande du bas, inspecteur de la course, bandeau « Caler sur… », calque « Vitesses », réglages en km/h, Espace ;
  - clôture : exports vérifiés sur fichiers complets, ARCHITECTURE, RECETTE (section « Lot 3 bis »), README.
- Reprise du 24/10 (limite d'usage pendant l'étape 5) : les 7 fichiers modifiés le 23/10 à 19:35:55, 69 s après l'étape 4, étaient un début cohérent de l'étape 5, et non une écriture interrompue : gardés et complétés (commit `3504a59`).
- Décisions prises seul pendant le lot, à relire : D-119 (ramassage au sol : lâcher à instant fixe), D-120 (précisions des liens et des segments), D-121 (précisions de l'interface).

## Reste à faire

- Vérifications de terrain, non bloquantes, pas encore faites :
  - lot 3 bis : les 3 vérifications de `docs/RECETTE.md` ;
  - conflit Drive réel, avec la vraie modification sur l'autre PC de la correction du lot 3 ;
  - modèle enregistré sur un PC, visible et appliqué sur l'autre ;
  - GIF sur WhatsApp, avec et sans allègement ; PDF N&B sur la laser ; cahier de jeu sur le téléphone.
- Puis lot 4 (défense simulée ; le plan du lot 3 bis, section 11, liste ce qui le touche) et lot 5 (ateliers).

## Pistes notées pour plus tard (D-118)

- Accélération exponentielle (forte au départ, plus douce près de la vitesse de pointe).
- Vitesse initiale au temps 1 : une joueuse déjà lancée au départ de la combinaison.
- Ballon porté du côté du sens de course plutôt que toujours vers l'attaque (D-041).

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- Fixtures figées : `play-v1-7v7-options.json`, `play-v2-lot3.json` et `play-v3-lot3bis.json` ; ne plus les modifier.
- Limite de D-098 : une ancienne version remise à l'identique depuis l'autre PC (historique de Drive, import) est défaite tant que la page qui l'avait écrite est ouverte (README : recharger avant de restaurer).
- Les hypothèses 3 et 4 sur Drive (date changée après l'envoi, version antérieure rendue) restent à constater : le journal de synchronisation le dira.
- Le seuil « traits >= 3 px » du thème Contraste fort est testé sur `render`, pas sur la surcouche d'édition (jamais exportée).
- À 1280 px de large, et à 1440 px depuis la case « Vitesses » (D-121), la seconde rangée du transport défile horizontalement ; sous 1500 px, le titre de l'application est masqué (D-077).
- En portrait, une combinaison large laisse du terrain vide au-dessus et au-dessous dans les GIF (D-061).
- Le même GIF diffère entre Chromium et Firefox (rendu du texte) : le déterminisme vaut pour un même navigateur.
- Vite signale un morceau principal de plus de 500 Ko : déjà le cas sur `main` (508 Ko), 557 Ko après le lot 3 bis.

## Pièges rencontrés

- `typescript-eslint` refuse TypeScript 7 : rester en 6.0 (D-031). TS 6 : `types` vaut `[]` par défaut.
- Le lint strict vaut aussi pour les tests : ni `!` non nul ni condition inutile ; passer par de petites fonctions qui lèvent une erreur.
- `no-restricted-properties` sur `filter` bloquerait `Array.filter` : viser l'affectation.
- `prettier --write` reformate les fichiers : relire avant un Edit ou un Write.
- L'outil Bash échoue sur les longs heredocs, et une commande qui lit l'entrée standard (`cat > fichier` sans heredoc) bloque : écrire les gros fichiers avec Write ou Edit, les scripts dans un fichier.
- Caractères invisibles ou combinants (U+0300 à U+036F, U+202F) : jamais bruts ni en échappement dans le source ; `/\p{Mn}/gu` ou `String.fromCharCode` (ESLint `no-irregular-whitespace`).
- La règle ESLint des hooks React prend toute fonction `useXxx` pour un hook.
- Playwright : `fill` refusé sur un curseur hors pas (touche End) ; `selectOption` ne donne pas le focus ; coordonnées de souris arrondies au pixel ; un clic à moins d'un rayon de jeton sélectionne la joueuse (viser plutôt la poignée de fin d'une course courte).
- Grille CSS : une piste `auto` voisine d'une piste `1fr` suit le contenu des autres cellules en Chrome ; tailles fixes autour du terrain.
- Contexte 2D de jsPDF : transformations appliquées à l'ajout des points, chemin perdu entre `save` et `restore`, tirets non mis à l'échelle, taille de police arrondie à l'entier inférieur en points, `measureText` renvoie un objet malgré ses types.
- La police Atkinson Hyperlegible couvre le français sauf U+202F (remplacée par U+00A0, `export/text.ts`) ; son zéro est barré.
- gifenc : avec `transparent`, `dispose` vaut 2 par défaut : toujours `dispose: 1` ; `quantize` et `applyPalette` lisent tout `t.buffer` : tableaux autonomes.
- pdf.js renvoie `null` (et non `[]`) pour un PDF sans signets. Une liste de `combinaisons/` pendant une écriture contient le `.crswap` de Chrome : filtrer sur `.combi.json`.
- Le morceau principal ne doit importer ni `export/jobSteps.ts` ni les encodeurs : `export/jobs.ts` reste léger (contrôlé par `bundle.chromium.spec.ts`).
- Vitest coupe un test à 5 s par défaut ; le runner de la CI encode 2 à 3 fois moins vite que ce poste : les groupes de tests qui encodent réellement ont un délai explicite (`ENCODING_TIMEOUT_MS`).
- Passer le dépôt en privé désactive GitHub Pages et supprime la protection de `main` (compte sans abonnement payant) : le dépôt reste public (D-102). Pour rétablir, voir D-102.
- La tolérance des images de référence (0,5 % des pixels) masque un trait épaissi ou une petite dérive : après un changement de rendu, régénérer (`UPDATE_SNAPSHOTS=1`) et comparer à `HEAD` pour voir ce qui a bougé.
- Une commande sans effet doit rendre la même combinaison (même référence) : sinon `applyEdit` enregistre une étape d'annulation vide.
- Une branche supprimée sur GitHub reste visible en local (`origin/...`) tant qu'on n'a pas lancé `git fetch --prune`.
- Arbre de travail temporaire sur `main` (vérifier qu'un test attrape un défaut, comparer un build) : jonction vers `node_modules` créée par PowerShell (`New-Item -ItemType Junction`, `mklink` échoue depuis Git Bash), supprimée (`rmdir`) avant `git worktree remove`.
- **OPFS et tests de bout en bout :**
  - une lecture pendant une écriture de la page échoue (`NotReadableError`, puis `NotFoundError` pendant le remplacement) ; `expect.poll` ne réessaie pas sur une erreur : lire avec `.catch(() => null)` ;
  - après « Choisir un dossier », attendre « Dossier : Rugby7 » avant de créer une combinaison (sinon elle part dans IndexedDB) ;
  - `writeFolderFile` suppose le dossier `Rugby7` créé : le créer d'abord pour écrire avant le choix du dossier ;
  - ces courses ne se voient en local que sous charge : `--repeat-each=40 --workers=10`.

## Chantiers en parallèle

- Aucun.
