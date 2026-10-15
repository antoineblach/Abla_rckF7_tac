# État du projet

- Mise à jour : 2026-10-15 00:30
- Branche : `lot-1` (PR non ouverte) ; dernier commit : étape 5 « Éditeur, lecteur et état » (hash dans le plan au commit suivant)
- `main` protégée : statut CI « checks » obligatoire (D-028)

## En cours

- Lot 1, étape 6 : interface React et e2e (`docs/plans/lot-1.md`, section 2, étape 6).
- Action suivante : `src/ui/App.tsx` et `layout/AppLayout.tsx` (disposition 6.1), `field/FieldCanvas.tsx` (rendu à la demande, rAF en lecture, `data-viewport`, conversion souris vers mètres, hit test, zoom molette, Espace+glisser), puis barre d'outils, bibliothèque, inspecteur, arbre des temps, transport, bandeaux et dialogues ; branchement `startSession()` dans `main.tsx` ; puis les e2e `e2e/folder.chromium.spec.ts`, `external-changes.chromium.spec.ts`, `degraded.firefox.spec.ts`.

## Fait

- Étape 0 : outillage, CI verte, protection de `main` (`1a2de6f`).
- Étape 1 : modèle, zod v1 et v0, migrations, validation, arbre des temps ; SPEC 13.1 corrigée (`4a566e1`, `8ba710d`).
- Étape 2 : moteur, `evaluate`, passes, traces, caches (`a6cdb3c`).
- Mémoire de projet (`eb74c37`).
- Étape 3 : terrain, viewport, thèmes, rendu, 7 images de référence, validées par la CI Linux (`1ff408b`).
- Étape 4 : stockage dossier et navigateur, import et export, conflits, synchronisation, brouillon (`ade4e5b`).
- Étape 5 : commandes d'édition, historique, sélection, outils, raccourcis, placements, transport, cadrage, stores Zustand, session ; 181 tests verts.

## Reste à faire

- Étapes 6 et 7 du plan (interface et e2e, clôture).
- Étape 7 : README, ARCHITECTURE.md, commit de mise à jour SPEC et RECETTE (D-029), PR.

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- `folderAccess.ts`, `session.ts` et `download.ts` (API du navigateur) n'ont pas de test unitaire : couverts par les e2e de l'étape 6.
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
- Plages `̀-ͯ` dans une regex : elles ont fini en caractères bruts ; utiliser `/\p{Mn}/gu`.
- La règle ESLint des hooks React prend toute fonction `useXxx` pour un hook : ne pas nommer ainsi une fonction ordinaire.

## Chantiers en parallèle

- Aucun.
