# Pièges rencontrés

Rangés par domaine. Lire la section d'un domaine avant d'y toucher. Un nouveau piège va dans la section de son domaine.

## TypeScript et ESLint

- `typescript-eslint` refuse TypeScript 7 : rester en 6.0 (D-031). TS 6 : `types` vaut `[]` par défaut.
- Le lint strict vaut aussi pour les tests : ni `!` non nul ni condition inutile ; passer par de petites fonctions qui lèvent une erreur.
- `no-restricted-properties` sur `filter` bloquerait `Array.filter` : viser l'affectation.
- Caractères invisibles ou combinants (U+0300 à U+036F, U+202F) : jamais bruts ni en échappement dans le source ; `/\p{Mn}/gu` ou `String.fromCharCode` (ESLint `no-irregular-whitespace`).
- La règle ESLint des hooks React prend toute fonction `useXxx` pour un hook.

## Playwright et OPFS

- Playwright : `fill` refusé sur un curseur hors pas (touche End) ; `selectOption` ne donne pas le focus ; coordonnées de souris arrondies au pixel ; un clic à moins d'un rayon de jeton sélectionne la joueuse (viser plutôt la poignée de fin d'une course courte).
- Une liste de `combinaisons/` pendant une écriture contient le `.crswap` de Chrome : filtrer sur `.combi.json`.
- **OPFS et tests de bout en bout :**
  - une lecture pendant une écriture de la page échoue (`NotReadableError`, puis `NotFoundError` pendant le remplacement) ; `expect.poll` ne réessaie pas sur une erreur : lire avec `.catch(() => null)` ;
  - après « Choisir un dossier », attendre « Dossier : Rugby7 » avant de créer une combinaison (sinon elle part dans IndexedDB) ;
  - `writeFolderFile` suppose le dossier `Rugby7` créé : le créer d'abord pour écrire avant le choix du dossier ;
  - ces courses ne se voient en local que sous charge : `--repeat-each=40 --workers=10`.

## jsPDF et pdf.js

- Contexte 2D de jsPDF : transformations appliquées à l'ajout des points, chemin perdu entre `save` et `restore`, tirets non mis à l'échelle, taille de police arrondie à l'entier inférieur en points, `measureText` renvoie un objet malgré ses types.
- pdf.js renvoie `null` (et non `[]`) pour un PDF sans signets.

## gifenc

- gifenc : avec `transparent`, `dispose` vaut 2 par défaut : toujours `dispose: 1` ; `quantize` et `applyPalette` lisent tout `t.buffer` : tableaux autonomes.

## Git et GitHub

- Passer le dépôt en privé désactive GitHub Pages et supprime la protection de `main` (compte sans abonnement payant) : le dépôt reste public (D-102). Pour rétablir, voir D-102.
- Une branche supprimée sur GitHub reste visible en local (`origin/...`) tant qu'on n'a pas lancé `git fetch --prune`.
- Arbre de travail temporaire sur `main` (vérifier qu'un test attrape un défaut, comparer un build) : jonction vers `node_modules` créée par PowerShell (`New-Item -ItemType Junction`, `mklink` échoue depuis Git Bash), supprimée (`rmdir`) avant `git worktree remove`.

## Outils de Claude Code

- `prettier --write` reformate les fichiers : relire avant un Edit ou un Write.
- L'outil Bash échoue sur les longs heredocs, et une commande qui lit l'entrée standard (`cat > fichier` sans heredoc) bloque : écrire les gros fichiers avec Write ou Edit, les scripts dans un fichier.
- Les cases d'un plan sont indentées sous leur bloc (`  - [ ]`) : le motif `^- \[[ x]\]` de `/reprise` n'en trouve aucune ; chercher `^\s*- \[[ x]\]` (corrigé dans le skill).

## Vitest et images de référence

- Vitest coupe un test à 5 s par défaut ; le runner de la CI encode 2 à 3 fois moins vite que ce poste : les groupes de tests qui encodent réellement ont un délai explicite (`ENCODING_TIMEOUT_MS`).
- Une compilation coûte plusieurs millisecondes depuis les leviers (D-130 : environ 50 profils par résolution ; combinaison réaliste 3 puis 14 ms) : un test qui évalue à chaque instant garde un cache par ligne, sinon il dépasse 5 s en parallèle.
- La tolérance des images de référence (0,5 % des pixels) masque un trait épaissi ou une petite dérive : après un changement de rendu, régénérer (`UPDATE_SNAPSHOTS=1`) et comparer à `HEAD` pour voir ce qui a bougé.

## Application

- Grille CSS : une piste `auto` voisine d'une piste `1fr` suit le contenu des autres cellules en Chrome ; tailles fixes autour du terrain.
- La police Atkinson Hyperlegible couvre le français sauf U+202F (remplacée par U+00A0, `export/text.ts`) ; son zéro est barré.
- Le morceau principal ne doit importer ni `export/jobSteps.ts` ni les encodeurs : `export/jobs.ts` reste léger (contrôlé par `bundle.chromium.spec.ts`).
- Une commande sans effet doit rendre la même combinaison (même référence) : sinon `applyEdit` enregistre une étape d'annulation vide.
