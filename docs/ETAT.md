# État du projet

- Mise à jour : 2026-10-15
- Branche : `lot-2` (depuis `main` à `9a2c379`) ; pas encore poussée, pas de PR
- Dernier commit : « Plan du lot 2 » (plan, décisions, dépendances, ce fichier)
- `main` : lot 1 et sa correction fusionnés (PR #1 `d37f3f6`, PR #2 `9a2c379`), déployés sur Pages ; protection vérifiée par `gh api` (D-055)
- Écart corrigé au début du lot 2 : ce fichier disait la PR #2 ouverte, elle était fusionnée.

## En cours

- Lot 2 (exports GIF et PDF), plan validé : `docs/plans/lot-2.md` ; réponses Q1 à Q16 et complément : D-057 à D-070.
- Étape 0 : prototypes P1 à P4 (PDF vectoriel, PDF en images, poids du GIF, Worker sous Chromium et Firefox), hors dépôt, dans le dossier temporaire de la session.
- Règle de l'étape 0 (D-057) : vectoriel retenu sans attente si les quatre points de la section 1.3 du plan sont confirmés ; arrêt et question seulement sur une limite bloquante.
- Action suivante : prototypes, puis résultats dans le plan (section 1.4), puis étape 1.

## Fait

- Lot 1 : étapes 0 à 7 (`docs/plans/lot-1.md`), PR #1 fusionnée ; correction après recette (`docs/plans/lot-1-corrections.md`), PR #2 fusionnée.
- Lot 2, étape 0 (en cours) : branche `lot-2`, plan versionné, décisions D-057 à D-070, dépendances installées : gifenc 1.0.3, jspdf 4.2.1 ; dev : pdfjs-dist 6.4.299, omggif 1.0.10, @types/omggif.

## Reste à faire (lot 2)

- Étapes 1 à 7 du plan : config et model (réglages v2), render (thèmes d'impression, habillage), GIF, PDF, io et Worker, interface, clôture.
- Lot 1, toujours en attente de l'utilisateur : synchronisation Drive réelle entre les deux PC, conflit Drive réel (« Garder les deux »), séance d'usage libre.

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- Fixture figée `src/test/fixtures/play-v1-7v7-options.json` : ne plus la modifier (migration v1 vers v2 du lot 3) ; les prototypes et les tests du lot 2 la lisent seulement.
- Le seuil « traits >= 3 px » du thème Contraste fort est testé sur `render`, pas sur la surcouche d'édition (jamais exportée).
- À 1280 px de large, la seconde rangée du transport défile horizontalement.

## Pièges rencontrés

- `typescript-eslint` refuse TypeScript 7 : rester en 6.0 (D-031). TS 6 : `types` vaut `[]` par défaut.
- `no-restricted-properties` sur `filter` bloquerait `Array.filter` : viser l'affectation.
- Point fixe de passe à 5 itérations : tolérance de quelques pour cent sur la vitesse de vol (D-037).
- `prettier --write` reformate les fichiers : relire avant un Edit ou un Write.
- L'outil Bash échoue sur les longs heredocs (encore constaté au lot 2) : écrire les gros fichiers avec l'outil Write ou Edit, et les scripts dans un fichier.
- Plages U+0300 à U+036F écrites en échappement dans une regex : elles ont fini en caractères bruts ; utiliser `/\p{Mn}/gu`.
- La règle ESLint des hooks React prend toute fonction `useXxx` pour un hook.
- Playwright refuse `fill` sur un curseur hors pas : utiliser la touche End.
- Grille CSS : une piste `auto` voisine d'une piste `1fr` voit sa hauteur suivre le contenu des autres cellules en Chrome ; n'utiliser que des tailles fixes autour du terrain.
- Le canevas centré peut se décaler sans que `data-viewport` change : les tests de stabilité comparent aussi sa boîte.
- Playwright : `selectOption` ne donne pas le focus à la liste ; les coordonnées de souris sont arrondies au pixel ; un clic à moins d'un rayon de jeton d'une joueuse la sélectionne avant la course.
- Vérifier qu'un test attrape un défaut : arbre de travail temporaire sur `main` avec une jonction vers `node_modules` ; supprimer la jonction (`rmdir`) avant `git worktree remove`.
- Contexte 2D de jsPDF (lu dans son code source) : transformations appliquées à l'ajout des points, chemin perdu entre `save` et `restore`, tirets non mis à l'échelle, taille de police arrondie à l'entier inférieur en points.
- La police Atkinson Hyperlegible couvre le français sauf l'espace fine insécable U+202F (à remplacer par U+00A0).

## Chantiers en parallèle

- Aucun.
