# État du projet

- Mise à jour : 2026-10-14 23:20
- Branche : `lot-1` (PR non ouverte) ; dernier commit : étape 4 « Stockage et synchronisation » (hash dans le plan au commit suivant)
- `main` protégée : statut CI « checks » obligatoire (D-028)

## En cours

- Lot 1, étape 5 : editor, player et stores (`docs/plans/lot-1.md`, section 2, étape 5).
- Action suivante : `src/editor/commands.ts` (commandes pures : placer, déplacer, supprimer en cascade, course, points, passe avec délai par défaut via `ballObtainedAt`, temps, « Insérer un temps après », option, défaut, ballon, équipe) et `src/editor/commands.test.ts` ; puis `history.ts`, `selection.ts`, `hitTest.ts`, `snap.ts`, `placements.ts`, `shortcuts.ts`, `tools/*`, `src/player/transport.ts`, `framing.ts`, puis `src/state/*.ts`.

## Fait

- Étape 0 : outillage, CI verte, protection de `main` (`1a2de6f`).
- Étape 1 : modèle, zod v1 et v0, migrations, validation, arbre des temps ; SPEC 13.1 corrigée (`4a566e1`, `8ba710d`).
- Étape 2 : moteur, `evaluate`, passes, traces, caches (`a6cdb3c`).
- Mémoire de projet (`eb74c37`).
- Étape 3 : terrain, viewport, thèmes, rendu, 7 images de référence, validées par la CI Linux (`1ff408b`).
- Étape 4 : `FolderStore`, `IdbStore`, accès au dossier, import et export, conflits, synchronisation, brouillon, cache de lecture ; 131 tests verts.

## Reste à faire

- Étapes 5 à 7 du plan (editor/player/stores, interface et e2e, clôture).
- Étape 7 : README, ARCHITECTURE.md, commit de mise à jour SPEC et RECETTE (D-029), PR.

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- `folderAccess.ts` (handle natif, permission) n'a pas de test unitaire : couvert par les e2e Chromium de l'étape 6 (OPFS).
- Fixture figée `src/test/fixtures/play-v1-7v7-options.json` : le test l'exige identique à `sevenVsSevenWithOptions()` ; si le scénario évolue, régénérer la fixture seulement si le schéma v1 n'a pas changé.
- Seuil « traits >= 3 px » du thème Contraste fort testé sur `render`, pas sur la surcouche d'édition (jamais exportée).

## Pièges rencontrés

- `typescript-eslint` refuse TypeScript 7 : rester en 6.0 (D-031).
- TS 6 : `types` vaut `[]` par défaut, d'où `types: ["vite/client", "node"]` dans `tsconfig.json`.
- `no-restricted-properties` sur `filter` bloquerait `Array.filter` : viser l'affectation (`no-restricted-syntax`).
- Point fixe de passe à 5 itérations : tolérance de quelques pour cent sur la vitesse de vol (D-037).
- `prettier --write` reformate les fichiers : relire avant un Edit.
- L'outil Bash échoue sur les longs heredocs contenant certaines apostrophes : écrire les gros fichiers avec l'outil Write.
- `Omit<Union, 'k'>` ne distribue pas sur une union : déclarer le type sans le champ explicitement.

## Chantiers en parallèle

- Aucun.
