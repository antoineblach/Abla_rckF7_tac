# État du projet

- Mise à jour : 2026-10-15
- Branche : `lot-1`, PR vers `main` ouverte (voir `gh pr list`) ; dernier commit : « Convention : réponses en français » (D-046)
- `main` protégée : statut CI « checks » obligatoire (D-028)

## En cours

- Lot 1 terminé côté code ; en attente de la recette manuelle de l'utilisateur (`docs/RECETTE.md`, section « Lot 1 ») puis de la fusion de la PR par l'utilisateur.
- Action suivante : traiter les retours de recette avec le prompt « Correction après recette » (`docs/PROMPTS.md`) ; après fusion, lot 2 avec son prompt.

## Fait

- Étape 0 : outillage, CI, protection de `main` (`1a2de6f`).
- Étape 1 : modèle, zod v1 et v0, migrations, validation ; SPEC 13.1 corrigée (`4a566e1`, `8ba710d`).
- Étape 2 : moteur, `evaluate`, passes, traces, caches (`a6cdb3c`).
- Mémoire de projet (`eb74c37`).
- Étape 3 : terrain, viewport, thèmes, rendu, images de référence (`1ff408b`).
- Étape 4 : stockage dossier et navigateur, import et export, conflits, synchronisation (`ade4e5b`).
- Étape 5 : édition, historique, outils, transport, stores, session (`434ac77`).
- Étape 6 : interface React, 8 tests e2e (`087856d`).
- Étape 7 : README et ARCHITECTURE (`b5cc10d`), SPEC et RECETTE mises à jour (`e69ebcb`), recette automatisable verte (lint, typecheck, 183 tests unitaires, 8 e2e, build), PR.

## Reste à faire

- Recette manuelle du lot 1 par l'utilisateur, sur ses deux PC (Drive réel).
- Fusion de la PR `lot-1` (par l'utilisateur), vérification du déploiement Pages.

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- Hypothèses à confirmer en recette manuelle : écriture via `.crswap` validée à `close()` (8.3) ; File System Access sur le lecteur virtuel du mode diffusion de Drive (8.8).
- Non automatisés : zoom à la molette, déplacement Espace+glisser, plein écran, « Réautoriser le dossier », synchronisation Drive réelle entre deux PC.
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
- Conteneur flexible du canevas : `flex: 1 1 0`, sinon il grandit avec le canevas et déborde.

## Chantiers en parallèle

- Aucun.
