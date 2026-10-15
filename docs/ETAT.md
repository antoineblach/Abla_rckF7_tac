# État du projet

- Mise à jour : 2026-10-14 22:10
- Branche : `lot-1` (PR non ouverte) ; dernier commit : `a6cdb3c` (moteur, étape 2), puis le commit « Mémoire de projet » qui contient ce fichier
- `main` protégée : statut CI « checks » obligatoire (D-028)

## En cours

- Lot 1, étape 3 : field, render et viewport (`docs/plans/lot-1.md`).
- Écrits, non commités : `src/field/geometry.ts`, `src/render/ctx2d.ts`, `viewport.ts`, `themes.ts`, `layers.ts`, thèmes dans `src/config/defaults.ts`.
- Action suivante : `src/render/primitives.ts`, puis `src/field/drawField.ts`, `src/render/render.ts`, `src/render/renderSchematic.ts`, `src/render/overlay.ts` (sélection, poignées), puis `src/test/recordingCtx.ts`, `src/test/imageSnapshot.ts` et les tests `field/geometry.test.ts`, `render/viewport.test.ts`, `render/render.test.ts`, `render/render.image.test.ts` (6 PNG + 1 schéma).

## Fait

- Étape 0 : outillage, CI verte, protection de `main` (`1a2de6f`).
- Étape 1 : modèle, zod v1 et v0, migrations, validation, arbre des temps ; SPEC 13.1 corrigée (`4a566e1`, `8ba710d`).
- Étape 2 : moteur, `evaluate`, passes, traces, caches ; 68 tests verts (`a6cdb3c`).
- Mémoire de projet : plan, ETAT, DECISIONS numérotées, CLAUDE.md, prompt Reprise.

## Reste à faire

- Étapes 3 à 7 du plan (render, io, editor/player/stores, interface et e2e, clôture).
- Étape 7 : README, ARCHITECTURE.md, commit de mise à jour SPEC et RECETTE (D-029), PR.

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- Rendu sous Linux (CI) avec `@napi-rs/canvas` pas encore éprouvé : vérifié sous Windows seulement (D-036).
- Fixture figée `src/test/fixtures/play-v1-7v7-options.json` : le test l'exige identique au constructeur `sevenVsSevenWithOptions()` ; si le scénario évolue, régénérer la fixture seulement si le schéma v1 n'a pas changé.

## Pièges rencontrés

- `typescript-eslint` refuse TypeScript 7 : rester en 6.0 (D-031).
- TS 6 : `types` vaut `[]` par défaut, d'où `types: ["vite/client", "node"]` dans `tsconfig.json`.
- `no-restricted-properties` sur `filter` bloquerait `Array.filter` : les interdictions d'ombres et de filtres visent l'affectation (`no-restricted-syntax`).
- Point fixe de passe à 5 itérations : tolérance de quelques pour cent sur la vitesse de vol, pas 1e-3 s (D-037).
- `prettier --write` reformate les fichiers : relire avant un Edit.

## Chantiers en parallèle

- Aucun.
