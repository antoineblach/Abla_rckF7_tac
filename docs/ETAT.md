# État du projet

- Mise à jour : 2026-10-15 16:25
- Branche : `lot-1-corrections` (depuis `main`) ; PR #2 vers `main` ouverte, fusionnable, CI verte sur `ubuntu-24.04` (`bfb590f`) : https://github.com/antoineblach/Abla_rckF7_tac/pull/2
- Dernier commit : « État : PR #2 et CI verte » (ce fichier), après `bfb590f` « Mise à jour de l'état du projet »
- `main` : lot 1 fusionné (PR #1, `d37f3f6`), déployé sur Pages ; protection vérifiée par `gh api` le 15/10 (D-055)

## En cours

- Correction après recette du lot 1 terminée côté code : plan `docs/plans/lot-1-corrections.md`, étapes 0 à 7 cochées.
- Action suivante : fusion de la PR #2 par l'utilisateur ; ensuite les 2 vérifications manuelles restantes et la séance d'usage libre ; puis lot 2.

## Fait

- Lot 1 : étapes 0 à 7 (`docs/plans/lot-1.md`), PR #1 fusionnée. Après le lot : réponses en français (`ff85ea0`, D-046) ; longueur indicative de ce fichier (`1fba2ce`, D-047).
- Correction, étape 0 : causes mesurées (Playwright sur le site déployé), plan, décisions D-048 à D-055 (`5057bd3`).
- Étape 1 : CI sur `ubuntu-24.04` (D-053, `5b2de29`).
- Étapes 2 et 4 : vue unique (centre, échelle) conservée au redimensionnement, « Ajuster » (F), « Zone utile », molette et déplacement en lecture, seuil de glisser de 4 px (D-048, D-049, D-051, `7a16e89`).
- Étape 3 : grille sans piste `auto`, barres de hauteur fixe, bandeau, message et choix d'option en surimpression ; message effacé au changement de temps et en lecture (D-050, `220da7b`). Mesure sur le build local : aucun changement d'échelle ni de position du canevas, à 1536×864 et 1280×720.
- Étape 5 : « Combinaison » en tête de l'inspecteur, repliable ; replis de la section et de la bibliothèque mémorisés par poste (`panelsStore` ; la préférence de la bibliothèque n'était pas branchée) (D-052, `51c3610`).
- Étape 6 : `e2e/field-stability.chromium.spec.ts` et `e2e/interface.chromium.spec.ts`, test du sens des flèches de la ligne d'avantage ; le test de stabilité échoue sur `main`. Défauts révélés et corrigés : raccourcis inactifs après un clic sur une case à cocher (D-056), étiquette du transport en édition (`6eb14b7`).
- Étape 7 : `CLAUDE.md` règle 12, `RECETTE.md` (règle D-054, tableau « comportement → tests » du lot 1, vérifications manuelles), SPEC (en-tête, 6.1, 6.2, 6.5, 7, 8.3, 8.6, 8.8, 16), `PROMPTS.md`, `README.md`, `ARCHITECTURE.md` (`df5ceb9`) ; recette automatisable verte : lint, typecheck, 193 tests unitaires, 17 de bout en bout, build, Prettier.

## Recette manuelle du lot 1

- Validé le 15/10/2026 par l'utilisateur sur le site déployé :
  - dossier `G:\Mon Drive\Rugby7` en mode diffusion de Drive pour ordinateur : choix, structure créée, écriture et sauvegarde automatique, aucun `.crswap` résiduel (hypothèses 8.3 et 8.8 confirmées) ;
  - « Autoriser à chaque visite » : accès conservé après fermeture et réouverture complète de Chrome ;
  - déploiement sur Pages après fusion de la PR #1.
- Vérifié par `gh api` : statut « checks » obligatoire, branche à jour exigée, administrateurs inclus (D-055).
- Restent en manuel : synchronisation Drive réelle entre les deux PC ; conflit Drive réel (« Garder les deux »).
- Règle (D-054) : tout l'automatisable est testé ; au plus 5 vérifications manuelles ; puis séance d'usage libre.

## Reste à faire

- Fusion de la PR `lot-1-corrections` par l'utilisateur (CI verte exigée), vérification du déploiement.
- Les 2 vérifications manuelles restantes et la séance d'usage libre, retour par le prompt « Correction après recette ».
- Puis lot 2 avec son prompt.

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- Fixture figée `src/test/fixtures/play-v1-7v7-options.json` : ne plus la modifier (elle servira à la migration v1 vers v2 du lot 3).
- Le seuil « traits >= 3 px » du thème Contraste fort est testé sur `render`, pas sur la surcouche d'édition (jamais exportée).
- À 1280 px de large, la seconde rangée du transport défile horizontalement (commandes de vue placées en tête pour rester visibles).

## Pièges rencontrés

- `typescript-eslint` refuse TypeScript 7 : rester en 6.0 (D-031). TS 6 : `types` vaut `[]` par défaut.
- `no-restricted-properties` sur `filter` bloquerait `Array.filter` : viser l'affectation.
- Point fixe de passe à 5 itérations : tolérance de quelques pour cent sur la vitesse de vol (D-037).
- `prettier --write` reformate les fichiers : relire avant un Edit ou un Write.
- L'outil Bash échoue sur les longs heredocs : écrire les gros fichiers avec l'outil Write, et les scripts Python dans un fichier.
- Plages U+0300 à U+036F écrites en échappement dans une regex : elles ont fini en caractères bruts ; utiliser `/\p{Mn}/gu`.
- La règle ESLint des hooks React prend toute fonction `useXxx` pour un hook.
- Playwright refuse `fill` sur un curseur hors pas : utiliser la touche End.
- Grille CSS : une piste `auto` voisine d'une piste `1fr` voit sa hauteur suivre le contenu des autres cellules en Chrome ; n'utiliser que des tailles fixes autour du terrain.
- Le canevas centré peut se décaler sans que `data-viewport` change : les tests de stabilité comparent aussi sa boîte.
- Playwright : `selectOption` ne donne pas le focus à la liste ; les coordonnées de souris sont arrondies au pixel ; un clic à moins d'un rayon de jeton d'une joueuse la sélectionne avant la course.
- Vérifier qu'un test attrape un défaut : arbre de travail temporaire sur `main` avec une jonction vers `node_modules` ; supprimer la jonction (`rmdir`) avant `git worktree remove`.
- Scripts de reproduction Playwright de la session (`repro.cjs`, `repro2.cjs`, `toolbar.cjs`, `shots.cjs`) : dossier temporaire, non versionnés.

## Chantiers en parallèle

- Aucun.
