# État du projet

- Mise à jour : 2026-10-15 15:40
- Branche : `lot-1-corrections` (depuis `main`), PR vers `main` à ouvrir en fin de correction
- Dernier commit : « Mise en page fixe autour du terrain » (ce fichier), après `7a16e89` « Vue indépendante de la taille du terrain »
- `main` : lot 1 fusionné (PR #1, `d37f3f6`), déployé sur Pages ; protection vérifiée par `gh api` le 15/10 (D-055)

## En cours

- Correction après recette du lot 1 : plan `docs/plans/lot-1-corrections.md` (étapes 0 à 7).
- Étape en cours : 5 (inspecteur).
- Action suivante : étape 5 (« Combinaison » en tête, repliable), puis étape 6 (tests de bout en bout, audit de la recette).

## Fait

- Lot 1 : étapes 0 à 7 (voir `docs/plans/lot-1.md`), PR #1 fusionnée.
- Après le lot : convention « Réponds-moi toujours en français » (`ff85ea0`, D-046) ; longueur indicative de ce fichier (`1fba2ce`, D-047).
- Correction, étape 0 : causes mesurées (Playwright sur le site déployé), plan, décisions D-048 à D-055 (`5057bd3`).
- Correction, étape 1 : CI sur `ubuntu-24.04` (D-053, `5b2de29`).
- Correction, étapes 2 et 4 : vue (centre, échelle) conservée au redimensionnement, « Ajuster » (F), « Zone utile », molette et déplacement en lecture, seuil de glisser ; 191 tests unitaires verts (`7a16e89`).
- Correction, étape 3 : grille sans ligne `auto`, barres de hauteur fixe, bandeau, message et choix d'option en surimpression ; message effacé au changement de temps et en lecture. Mesure sur le build local (scripts de reproduction) : aucun changement d'échelle ni de position du canevas, à 1536×864 et 1280×720.

## Recette manuelle du lot 1

- Validé le 15/10/2026 par l'utilisateur sur le site déployé :
  - dossier `G:\Mon Drive\Rugby7` en mode diffusion de Drive pour ordinateur : choix, structure créée, écriture et sauvegarde automatique, aucun `.crswap` résiduel (hypothèses 8.3 et 8.8 confirmées) ;
  - « Autoriser à chaque visite » : accès conservé après fermeture et réouverture complète de Chrome ;
  - déploiement sur Pages après fusion de la PR #1.
- Vérifié par `gh api` : statut « checks » obligatoire, branche à jour exigée, administrateurs inclus (D-055).
- Restent en manuel : synchronisation Drive réelle entre les deux PC ; conflit Drive réel (« Garder les deux »).
- Nouvelle règle (D-054) : tout l'automatisable est testé ; au plus 5 vérifications manuelles ; puis séance d'usage libre.

## Causes du changement d'échelle (mesurées)

- Arbre des temps en ligne `auto` : en Chrome, sa hauteur suit celle de l'inspecteur (sélection d'une joueuse : 98 à 210 px, échelle 7,11 à 5,31).
- Message « position héritée », choix d'option, barres d'outils et de transport qui passent à la ligne : insérés dans la colonne du terrain.
- Viewport réajusté au cadre à chaque changement de taille ; cadrage automatique pendant la lecture.
- Un clic de sélection avec 1 px de tremblement déplaçait la joueuse (seuil de glisser, D-051).

## Reste à faire

- Étapes 5, 6 et 7 du plan de correction ; audit de la section « Lot 1 » de `RECETTE.md` (chaque point relié à un test, tests ajoutés pour l'automatisable non couvert).
- Après fusion de la correction : synchronisation Drive entre les deux PC, conflit Drive réel, séance d'usage libre ; puis lot 2.

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- Fixture figée `src/test/fixtures/play-v1-7v7-options.json` : ne plus la modifier (elle servira à la migration v1 vers v2 du lot 3).
- Le seuil « traits >= 3 px » du thème Contraste fort est testé sur `render`, pas sur la surcouche d'édition (jamais exportée).

## Pièges rencontrés

- `typescript-eslint` refuse TypeScript 7 : rester en 6.0 (D-031). TS 6 : `types` vaut `[]` par défaut.
- `no-restricted-properties` sur `filter` bloquerait `Array.filter` : viser l'affectation.
- Point fixe de passe à 5 itérations : tolérance de quelques pour cent sur la vitesse de vol (D-037).
- `prettier --write` reformate les fichiers : relire avant un Edit.
- L'outil Bash échoue sur les longs heredocs : écrire les gros fichiers avec l'outil Write, et les scripts Python dans un fichier.
- Plages U+0300 à U+036F écrites en échappement dans une regex : elles ont fini en caractères bruts ; utiliser `/\p{Mn}/gu`.
- La règle ESLint des hooks React prend toute fonction `useXxx` pour un hook.
- Playwright refuse `fill` sur un curseur hors pas : utiliser la touche End.
- Grille CSS : une ligne `auto` voisine d'une ligne `1fr` voit sa hauteur varier avec le contenu des autres cellules en Chrome ; n'utiliser que des hauteurs fixes autour du terrain.
- Le canevas centré peut se décaler sans que `data-viewport` change : les tests de stabilité comparent aussi sa boîte.
- Scripts de reproduction Playwright de la session : `repro.cjs`, `repro2.cjs`, `toolbar.cjs` (dossier temporaire, non versionnés).

## Chantiers en parallèle

- Aucun.
