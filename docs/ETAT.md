# État du projet

- Mise à jour : 2026-10-14 22:40
- Branche : `lot-1` (PR non ouverte) ; dernier commit : celui de l'étape 3 « Rendu, terrain et viewport » (hash dans le plan au commit suivant)
- `main` protégée : statut CI « checks » obligatoire (D-028)

## En cours

- Lot 1, étape 4 : io (`docs/plans/lot-1.md`, section 2, étape 4).
- Action suivante : vérifier que la CI Linux accepte les images de référence (D-036, D-042) ; puis écrire `src/io/fs/types.ts` (sous-ensemble de la File System Access API), `src/test/memoryFs.ts`, `src/io/serialize.ts`, `src/io/fileNames.ts` et leurs tests, puis `src/io/readPlay.ts`, `src/io/LibraryStore.ts`, `src/io/FolderStore.ts` (tests contre `memoryFs` : aller-retour, invalide intact, v0 migré en mémoire, doublon, modification extérieure, corbeille, renommage, concurrence optimiste).

## Fait

- Étape 0 : outillage, CI verte, protection de `main` (`1a2de6f`).
- Étape 1 : modèle, zod v1 et v0, migrations, validation, arbre des temps ; SPEC 13.1 corrigée (`4a566e1`, `8ba710d`).
- Étape 2 : moteur, `evaluate`, passes, traces, caches (`a6cdb3c`).
- Mémoire de projet (`eb74c37`).
- Étape 3 : terrain, viewport (3 orientations + rotation 180°), thèmes, `render`, `renderSchematic`, surcouche d'édition, 7 images de référence ; 91 tests verts.

## Reste à faire

- Étapes 4 à 7 du plan (io, editor/player/stores, interface et e2e, clôture).
- Étape 7 : README, ARCHITECTURE.md, commit de mise à jour SPEC et RECETTE (D-029), PR.

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- Images de référence générées sous Windows ; validation sous Linux à confirmer par la CI de l'étape 3.
- Fixture figée `src/test/fixtures/play-v1-7v7-options.json` : le test l'exige identique à `sevenVsSevenWithOptions()` ; si le scénario évolue, régénérer la fixture seulement si le schéma v1 n'a pas changé.
- Le seuil « traits >= 3 px » du thème Contraste fort est testé sur `render`, pas sur la surcouche d'édition (poignées à 1,5 px), qui n'est jamais exportée.

## Pièges rencontrés

- `typescript-eslint` refuse TypeScript 7 : rester en 6.0 (D-031).
- TS 6 : `types` vaut `[]` par défaut, d'où `types: ["vite/client", "node"]` dans `tsconfig.json`.
- `no-restricted-properties` sur `filter` bloquerait `Array.filter` : les interdictions d'ombres et de filtres visent l'affectation (`no-restricted-syntax`).
- Point fixe de passe à 5 itérations : tolérance de quelques pour cent sur la vitesse de vol (D-037).
- `prettier --write` reformate les fichiers : relire avant un Edit.
- Heredoc bash très long avec apostrophes : préférer l'outil Write pour les gros fichiers.

## Chantiers en parallèle

- Aucun.
