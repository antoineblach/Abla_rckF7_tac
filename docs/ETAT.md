# État du projet

- Mise à jour : 2026-10-15
- Branche : `lot-2` (depuis `main` à `9a2c379`) ; pas encore poussée, pas de PR
- Dernier commit : « Étape 4 : export PDF » (après `38e7ba6`)
- `main` : lot 1 et sa correction fusionnés (PR #1 `d37f3f6`, PR #2 `9a2c379`), déployés sur Pages ; protection vérifiée par `gh api` (D-055)
- Écart constaté à la reprise du 15/10 : l'étape 1 avait été interrompue (limite d'usage) avec des modifications non commitées ; examinées, complétées et commitées sans rien jeter.

## En cours

- Lot 2 (exports GIF et PDF), plan validé : `docs/plans/lot-2.md` ; réponses Q1 à Q16 et complément : D-057 à D-070 ; étape 0 : D-071 (PDF vectoriel) ; étape 1 : D-072 ; étape 2 : D-073 ; étape 3 : D-074 ; étape 4 : D-075.
- Consigne de l'utilisateur : enchaîner les étapes 2 à 7 sans attendre, arrêt seulement sur une question bloquante.
- Action suivante : étape 5 (io et Worker : fichiers binaires, `trash.ts`, `exports/`, existence et confirmation, téléchargement, protocole, Worker, moteurs, `exportRun` avec annulation).

## Fait

- Lot 1 : étapes 0 à 7 (`docs/plans/lot-1.md`), PR #1 fusionnée ; correction après recette (`docs/plans/lot-1-corrections.md`), PR #2 fusionnée.
- Lot 2, étape 0 : plan, décisions, dépendances (gifenc 1.0.3, jspdf 4.2.1 ; dev : pdfjs-dist 6.4.299, omggif 1.0.10, @types/omggif) (`1a41e1f`) ; prototypes P1 à P4, résultats en section 1.5 du plan (`50ee9e7`).
- Lot 2, étape 1 : `defaults.ts` (formats et cadences GIF, durées, lisibilité, mise en page PDF, seuils) ; `model/labels.ts` et `model/shortName.ts` (réexportés par `ui/strings.ts` et `io/fileNames.ts`) ; `reglages.json` v2 (préférences d'export), migration, fixture `reglages-v1.json`, version future jamais réécrite ; `export/names.ts`, `legibility.ts`, `text.ts` ; ESLint : pureté et aplats étendus à `src/export/` (hors `worker/`) (`c6fa414`).
- Lot 2, étape 2 : thèmes `printColor` et `printBw` ; jeton, course et passe selon le thème ; `render/captions.ts` (cartons, en-tête, pastille, bandeau de hauteur fixe) ; `insets` du viewport ; ballon en Bézier ; `clip` et `bezierCurveTo` dans `Ctx2D` ; `paintEvents` dans le contexte enregistreur (`0fe6ebc`).
- Lot 2, étape 3 : `export/gif/` (plan des images, image, palette, transparence, `gifExport` pas à pas), `export/types.ts`, `types/gifenc.d.ts` ; outils de test `exportFixtures.ts`, `gifInspect.ts` ; images `gif-frame-{highContrast,printBw}.png` (`38e7ba6`).
- Lot 2, étape 4 : `export/framing.ts` ; `export/pdf/` (rangées, mise en page impression et téléphone, cahier, vignette vectorielle, contexte jsPDF, `pdfExport` pas à pas) ; outil de test `pdfInspect.ts` (pdf.js) ; images `pdf-thumbnail-{highContrast,printColor,printBw}.png`. 263 tests verts.

## Reste à faire (lot 2)

- Étapes 2 à 7 du plan : render, GIF, PDF, io et Worker, interface, clôture.
- Lot 1, toujours en attente de l'utilisateur : synchronisation Drive réelle entre les deux PC, conflit Drive réel (« Garder les deux »), séance d'usage libre.

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- Fixture figée `src/test/fixtures/play-v1-7v7-options.json` : ne plus la modifier (migration v1 vers v2 du lot 3) ; les tests du lot 2 la lisent seulement.
- Le seuil « traits >= 3 px » du thème Contraste fort est testé sur `render`, pas sur la surcouche d'édition (jamais exportée).
- À 1280 px de large, la seconde rangée du transport défile horizontalement.

## Pièges rencontrés

- Le lint strict vaut aussi pour les tests : ni `!` non nul ni condition inutile ; passer par de petites fonctions qui lèvent une erreur.
- `typescript-eslint` refuse TypeScript 7 : rester en 6.0 (D-031). TS 6 : `types` vaut `[]` par défaut.
- `no-restricted-properties` sur `filter` bloquerait `Array.filter` : viser l'affectation.
- Point fixe de passe à 5 itérations : tolérance de quelques pour cent sur la vitesse de vol (D-037).
- `prettier --write` reformate les fichiers : relire avant un Edit ou un Write.
- L'outil Bash échoue sur les longs heredocs : écrire les gros fichiers avec l'outil Write ou Edit, et les scripts dans un fichier.
- Caractères invisibles ou combinants (U+0300 à U+036F, U+202F) : jamais bruts ni en échappement dans le source ; `/\p{Mn}/gu` ou `String.fromCharCode` (ESLint `no-irregular-whitespace`).
- La règle ESLint des hooks React prend toute fonction `useXxx` pour un hook.
- Playwright refuse `fill` sur un curseur hors pas : utiliser la touche End.
- Grille CSS : une piste `auto` voisine d'une piste `1fr` voit sa hauteur suivre le contenu des autres cellules en Chrome ; n'utiliser que des tailles fixes autour du terrain.
- Le canevas centré peut se décaler sans que `data-viewport` change : les tests de stabilité comparent aussi sa boîte.
- Playwright : `selectOption` ne donne pas le focus à la liste ; les coordonnées de souris sont arrondies au pixel ; un clic à moins d'un rayon de jeton d'une joueuse la sélectionne avant la course.
- Vérifier qu'un test attrape un défaut : arbre de travail temporaire sur `main` avec une jonction vers `node_modules` ; supprimer la jonction (`rmdir`) avant `git worktree remove`.
- Contexte 2D de jsPDF (lu dans son code source) : transformations appliquées à l'ajout des points, chemin perdu entre `save` et `restore`, tirets non mis à l'échelle, taille de police arrondie à l'entier inférieur en points.
- La police Atkinson Hyperlegible couvre le français sauf l'espace fine insécable U+202F (remplacée par U+00A0, `export/text.ts`).
- gifenc : avec `transparent`, `dispose` vaut 2 par défaut (annule l'optimisation) : toujours `dispose: 1`. `quantize` et `applyPalette` lisent tout `t.buffer` : leur passer des tableaux autonomes, jamais une vue.
- Prototypes de l'étape 0 (hors dépôt, réutilisables) : `C:\Users\antoi\AppData\Local\Temp\claude\c--Dev-Abla-rckF7-tac\a955686d-a4c3-4ad2-b0c4-f945e4f85b97\scratchpad\proto\` (p1 PDF, p3 GIF, p4 Worker) ; rolldown (`npx rolldown -c <config>` depuis le dépôt).

## Chantiers en parallèle

- Aucun.
