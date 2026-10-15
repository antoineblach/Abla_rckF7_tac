# État du projet

- Mise à jour : 2026-10-15 01:30
- Branche : `lot-1` (PR non ouverte) ; dernier commit : étape 6 « Interface et tests de bout en bout » (hash dans le plan au commit suivant)
- `main` protégée : statut CI « checks » obligatoire (D-028)

## En cours

- Lot 1, étape 7 : clôture (`docs/plans/lot-1.md`, section 2, étape 7).
- Action suivante : vérifier la CI de l'étape 6 (e2e sous Linux) ; puis `README.md`, `docs/ARCHITECTURE.md`, compléter `docs/DECISIONS.md`, commit dédié « Mise à jour de la spécification selon les décisions du lot 1 » (SPEC.md et RECETTE.md, D-029), recette automatisable, liste de la recette manuelle, PR `lot-1` vers `main` avec les sections de la SPEC modifiées.

## Fait

- Étape 0 : outillage, CI verte, protection de `main` (`1a2de6f`).
- Étape 1 : modèle, zod v1 et v0, migrations, validation, arbre des temps ; SPEC 13.1 corrigée (`4a566e1`, `8ba710d`).
- Étape 2 : moteur, `evaluate`, passes, traces, caches (`a6cdb3c`).
- Mémoire de projet (`eb74c37`).
- Étape 3 : terrain, viewport, thèmes, rendu, 7 images de référence, validées par la CI Linux (`1ff408b`).
- Étape 4 : stockage dossier et navigateur, import et export, conflits, synchronisation, brouillon (`ade4e5b`).
- Étape 5 : édition, historique, outils, transport, stores Zustand, session (`434ac77`).
- Étape 6 : interface React complète (disposition 6.1, terrain, bibliothèque, inspecteur, arbre des temps, lecture, dialogues) ; 183 tests unitaires et 8 e2e verts (Chromium dossier OPFS, Firefox mode dégradé).

## Reste à faire

- Étape 7 du plan (clôture).
- Étape 7 : README, ARCHITECTURE.md, commit de mise à jour SPEC et RECETTE (D-029), PR.

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- `folderAccess.ts`, `session.ts`, `download.ts` et les composants React n'ont pas de test unitaire : couverts par les e2e.
- Non automatisés : zoom à la molette, déplacement Espace+glisser, plein écran, « Réautoriser le dossier » (recette manuelle).
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
- Plages U+0300 à U+036F écrites en échappement dans une regex : elles ont fini en caractères bruts ; utiliser `/\p{Mn}/gu`.
- La règle ESLint des hooks React prend toute fonction `useXxx` pour un hook : ne pas nommer ainsi une fonction ordinaire.
- Playwright refuse `fill` sur un curseur si la valeur n'est pas un multiple du pas : utiliser la touche End.
- Conteneur flexible du canevas : `flex: 1 1 0`, sinon il grandit avec le canevas et déborde.

## Chantiers en parallèle

- Aucun.
