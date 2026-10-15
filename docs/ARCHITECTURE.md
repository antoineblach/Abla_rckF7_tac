# Architecture effective

État à la fin du lot 1 (14 octobre 2026). Mis à jour à la fin de chaque lot. Les choix sont justifiés dans `DECISIONS.md` (références D-xxx).

## Vue d'ensemble

Application web statique (Vite, React 19, TypeScript 6 strict), sans serveur. Les données vivent dans un dossier synchronisé par Google Drive pour ordinateur, accédé par la File System Access API de Chrome, ou dans IndexedDB en mode dégradé.

Flux principal : React affiche, Zustand porte l'état, les couches pures calculent.

```
ui (React)  ──actions──▶  state (Zustand, session)  ──▶  editor / player (logique pure)
   ▲                            │                                │
   │ rendu à la demande         ├──▶ io (dossier, IndexedDB)     ▼
   │                            │                        model (types, zod, validation)
   └── render (canvas) ◀── engine.evaluate(play, ligne, t, réglages, caches)
```

Règles contrôlées par ESLint (D-034) : `model/`, `engine/`, `field/`, `render/` et `config/` n'utilisent ni horloge, ni aléa, ni minuterie, ni DOM, ni React, ni Zustand, ni les couches applicatives ; `render/` et `field/` n'utilisent ni dégradé, ni motif, ni ombre, ni filtre ; `ui/` n'utilise pas de tiret cadratin.

## Arborescence de `src/`

| Dossier | Rôle |
|---|---|
| `config/defaults.ts` | Toutes les valeurs par défaut, marquées `HYPOTHÈSE` ou `SOURCE:` (terrain, allures, passe, délais, couleurs, thèmes, placements). |
| `model/` | Types `schemaVersion 1` (`types.ts`) et types déclarés des lots 3 à 5 (`declared.ts`, D-004) ; schémas zod stricts v1 et v0 fictive ; migrations (`upgradePlay`) ; validation métier 4.3 (`validatePlay`, `Issue` avec code et paramètres) ; arbre des temps (lignes, option par défaut, libellés) ; sérialisation canonique et hachage cyrb53 ; réglages (`reglages.json`). |
| `field/` | Géométrie du terrain en mètres (Règle 1, D-001, D-002) et son tracé. |
| `engine/` | Spline de Catmull-Rom centripète à vitesse constante ; `compileLine` (débuts et durées des temps, courses, possession, passes par point fixe, validations et replis D-013) ; `evaluate` et `sampleLine` (état d'une scène, traces calculées, ligne d'avantage) ; données du mode schéma (`phaseSchematic`) ; boîte englobante ; caches LRU indexés par hachage (D-039). |
| `render/` | Interface `Ctx2D` minimale (canvas, OffscreenCanvas, `@napi-rs/canvas`, jsPDF au lot 2) ; viewport (seule couche qui connaît les pixels : cadrages, orientations, rotation 180°, D-006 ; à l'écran, une vue `ViewTransform` (centre, échelle) indépendante de la taille du canevas, D-048) ; thèmes « Écran » et « Contraste fort » ; calques ; primitives en aplats ; `render`, `renderSchematic` / `drawSchematic` ; surcouche d'édition (`overlay.ts`). |
| `editor/` | Commandes pures sur la combinaison (joueuses, ballon, courses, passes, temps, options) ; historique par instantanés ; sélection ; test d'atteinte ; aimantation ; outils course et passe ; raccourcis ; placements de départ ; mise en page de l'arbre des temps. |
| `player/` | Machine d'état du transport (lecture, vitesses, boucle, pause entre les temps, « S'arrêter aux options », point d'option) ; boîte de la zone utile (« Zone utile »). |
| `io/` | Abstraction du système de fichiers (`fs/`) et adaptateur des handles natifs ; `LibraryStore` (8.1 étendue, D-020) avec `FolderStore` et `IdbStore` ; lecture et écriture des fichiers (validation, migration, JSON canonique) ; noms de fichiers ; accès au dossier et permission ; import et export ; conflits ; contrôleur de synchronisation ; brouillon ; cache de lecture ; téléchargement. |
| `state/` | Stores Zustand (`editorStore`, `playerStore`, `libraryState`, `settingsStore`, `viewStore` : vue unique de l'édition et de la lecture, taille du canevas, « Ajuster » et « Zone utile » ; `panelsStore` : panneaux repliés) ; interactions du terrain et raccourcis (`editorActions.ts`) ; surcouche (`overlay.ts`) ; sélecteurs d'affichage ; session (`session.ts` : démarrage, choix du stockage, synchronisation, conflits, import et export) ; préférences par poste (`prefs.ts`, localStorage). |
| `ui/` | Composants React : barre d'outils, bandeaux et notifications, bibliothèque, terrain (`FieldCanvas`), inspecteur, arbre des temps, commandes de lecture et point d'option, dialogues ; textes d'interface (`strings.ts`) ; feuille de style globale. |
| `types/` | Déclarations de la File System Access API absentes de lib.dom. |
| `test/` | Outils de test (constructeurs de combinaisons, faux système de fichiers, faux stockage clé-valeur, contexte 2D enregistreur, images de référence) et fixtures. Jamais importés par l'application. |

## Modèle et fichiers

- Fichier de combinaison : `combinaisons/<nom-court>--<id>.combi.json`, JSON indenté de 2 espaces, clés triées, LF final. Lecture : JSON, schéma zod de la version du fichier, migrations successives, schéma courant, validation métier. Un fichier invalide, à clé inconnue ou d'une version future est signalé et jamais modifié (D-024).
- Version courante : `schemaVersion 1`. Fixture v0 fictive (`src/test/fixtures/play-v0.json`) pour éprouver les migrations ; fixture v1 figée (`play-v1-7v7-options.json`) pour le lot 3.
- `updatedAt` est posé par `io` à l'enregistrement.

## Moteur

1. `compileLine(play, ligne, réglages, caches)` parcourt les temps de la ligne : positions de départ (fin du temps parent, ou `setup.positions`), courses (une par joueuse et par temps, D-013), passes triées par instant de lâcher, possession simulée passe par passe, arrivée par 5 itérations de point fixe (D-037), durée du temps = max(délai + durée) des actions appliquées.
2. `sampleLine(compilé, t)` donne la scène : positions, ballon (porté, en vol, au sol de départ), traces (portion parcourue, temps courant appuyé), passes tracées, ligne d'avantage, consigne.
3. `phaseSchematic` donne un temps à l'arrêt : positions de début, actions du temps, trajectoires des temps ancêtres.
4. Les caches (`EvalCaches`) sont passés en paramètre ; clé = hachage du contenu ; un cache ne change jamais un résultat (testé).

## Rendu

- `render(ctx, scène, viewport, thème, calques)` et `renderSchematic(ctx, play, ligne, temps, viewport, thème, réglages, caches)` (D-003).
- Tailles en pixels CSS à l'échelle 1, multipliées par `viewport.pixelRatio` ; estompage par couleurs pleines précalculées (D-040, D-041).
- Paysage : terrain fixe et flèches de sens d'attaque sur la ligne d'avantage ; portrait et carré : attaque vers le haut ; rotation 180° prévue pour les GIF paysage du lot 2.

## Stockage et synchronisation

- `FolderStore` : index des fichiers (date, taille, texte, résultat de lecture) ; relecture complète avec détection par date et taille, confirmée par le contenu ; écriture par `createWritable` puis `close` ; concurrence optimiste avant d'écrire ; corbeille par copie vérifiée puis retrait (D-043) ; renommage = nouveau fichier puis ancien en corbeille (D-005) ; copies de conflit en lecture seule jusqu'à résolution (D-022).
- `IdbStore` : même interface dans IndexedDB (clés `abla-rck7:play:<id>`, corbeille, réglages).
- `SyncController` : sauvegarde 2 s après la dernière modification, Ctrl+S, relecture au focus et toutes les 30 s si la fenêtre est visible, rechargement silencieux ou dialogue de conflit.
- IndexedDB (base `abla-rck7`, clés préfixées `abla-rck7:`) : handle du dossier, cache de lecture, brouillon, bibliothèque et réglages du mode dégradé. localStorage (`abla-rck7:prefs`) : préférences par poste.

## Interface

- Disposition 6.1 : barre d'outils en haut, bibliothèque repliable à gauche, terrain au centre avec les commandes de lecture, inspecteur à droite, arbre des temps en bas.
- Tailles fixes autour du terrain (variables CSS `--toolbar-h`, `--tree-h`, `--transport-h`, `--library-w`, `--inspector-w` de `ui/global.css`), aucune piste `auto` dans les grilles qui l'entourent ; bandeau, messages et boutons d'option dans des calques en surimpression (`.stage__overlay`) (D-048, D-050).
- Vue : `FieldCanvas` publie la taille du canevas dans `viewStore`, ajuste la vue enregistrée quand la vue vaut `null` (ouverture, orientation) et construit le viewport par `viewportFromView` ; un changement de taille garde l'échelle et le centre. Seuil de glisser de 4 px (D-051) ; raccourcis actifs sauf dans les champs de texte, listes et curseur (`ui/hooks/typing.ts`, D-056).
- Mode édition (schéma du temps sélectionné, éditable) et mode lecture (scène à t) (D-010) ; rendu à la demande, `requestAnimationFrame` seulement pendant la lecture.

## Tests et intégration continue

- Unitaires (Vitest, Node) : modèle, moteur (tous les tests obligatoires du lot), terrain, viewport, rendu (images de référence avec `@napi-rs/canvas` et la police embarquée, D-036, D-042 ; contrôle des aplats et des épaisseurs par un contexte enregistreur), stockage contre un faux système de fichiers, édition, transport, stores.
- Bout en bout (Playwright, sur le build) : mode dossier sous Chromium avec un dossier OPFS injecté (D-035), modifications extérieures et copies de conflit, mode dégradé sous Firefox avec export et import ; stabilité du terrain à chaque geste à 1536×864 et 1280×720 (`data-viewport` et boîte du canevas), changements volontaires de la vue, plein écran ; branchements de l'interface relus dans le fichier écrit, préférences du lecteur, brouillon. La section « Lot 1 » de `docs/RECETTE.md` relie chaque comportement à ses tests (D-054).
- CI GitHub Actions sur `ubuntu-24.04` (D-053) : un job « checks » (lint, typecheck, test, test:e2e, build), puis déploiement Pages depuis `main` seulement. `main` protégée (D-028, vérifiée par `gh api`, D-055).
