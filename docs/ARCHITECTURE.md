# Architecture effective

État à la fin du lot 2 (15 octobre 2026). Mis à jour à la fin de chaque lot. Les choix sont justifiés dans `DECISIONS.md` (références D-xxx).

## Vue d'ensemble

Application web statique (Vite, React 19, TypeScript 6 strict), sans serveur. Les données vivent dans un dossier synchronisé par Google Drive pour ordinateur, accédé par la File System Access API de Chrome, ou dans IndexedDB en mode dégradé. Les exports GIF et PDF sont encodés dans un Web Worker et écrits dans `exports/` du dossier, ou téléchargés.

Flux principal : React affiche, Zustand porte l'état, les couches pures calculent.

```
ui (React)  ──actions──▶  state (Zustand, session, session d'export)  ──▶  editor / player (logique pure)
   ▲                            │                │                                │
   │ rendu à la demande         ├──▶ io (dossier, IndexedDB, exports/)            ▼
   │                            │                │                      model (types, zod, validation)
   │                            │                └──▶ Web Worker d'export : export (gif, pdf)
   └── render (canvas) ◀── engine.evaluate(play, ligne, t, réglages, caches) ◀──┘
```

Règles contrôlées par ESLint (D-034) : `model/`, `engine/`, `field/`, `render/`, `export/` (hors `worker/`) et `config/` n'utilisent ni horloge, ni aléa, ni minuterie, ni DOM, ni React, ni Zustand, ni les couches applicatives ; `render/`, `field/` et `export/` n'utilisent ni dégradé, ni motif, ni ombre, ni filtre ; `ui/` n'utilise pas de tiret cadratin.

## Arborescence de `src/`

| Dossier | Rôle |
|---|---|
| `config/defaults.ts` | Toutes les valeurs par défaut, marquées `HYPOTHÈSE` ou `SOURCE:` (terrain, allures, passe, délais, couleurs, thèmes dont ceux d'impression, placements, formats et durées des GIF, lisibilité, mise en page et textes des PDF, seuils des exports). |
| `model/` | Types `schemaVersion 1` (`types.ts`) et types déclarés des lots 3 à 5 (`declared.ts`, D-004) ; schémas zod stricts v1 et v0 fictive ; migrations (`upgradePlay`) ; validation métier 4.3 ; arbre des temps (lignes, option par défaut, points d'option) ; libellés partagés par l'interface et les exports (`labels.ts`) ; nom court (`shortName.ts`) ; sérialisation canonique et hachage cyrb53 ; réglages `reglages.json` v2 avec préférences d'export et migration v1 vers v2 (`settings.ts`, D-068, D-072). |
| `field/` | Géométrie du terrain en mètres (Règle 1, D-001, D-002) et son tracé. |
| `engine/` | Spline de Catmull-Rom centripète à vitesse constante ; `compileLine` ; `evaluate` et `sampleLine` ; données du mode schéma (`phaseSchematic`) ; boîte englobante ; caches LRU indexés par hachage (D-039). |
| `render/` | Interface `Ctx2D` minimale (canvas, OffscreenCanvas, `@napi-rs/canvas`, contexte de jsPDF ; `clip` et `bezierCurveTo`, D-071) ; viewport (cadrages, orientations, rotation 180°, marges intérieures, D-073) ; thèmes « Écran », « Contraste fort », « Impression couleur », « Impression N&B » (jeton, course et passe selon le thème, D-062) ; calques ; primitives en aplats (ballon en courbes de Bézier, bandeau décalable de hauteur fixe) ; `render`, `renderSchematic` ; habillage des exports (`captions.ts` : cartons, en-tête, pastille) ; surcouche d'édition. |
| `export/` | Exports (lot 2). Purs : noms des fichiers (`names.ts`, D-066, D-074), lisibilité sur téléphone (`legibility.ts`, D-061), textes (`text.ts`), cadrage commun (`framing.ts`), description des travaux et noms attendus (`jobs.ts`, léger : importé par la page). `gif/` : plan des images (`timeline.ts`), image (`frame.ts`), palette, transparence et encodage pas à pas (`encode.ts`). `pdf/` : rangées et mise en page impression et téléphone (`layout.ts`), cahier de jeu (`book.ts`), vignette vectorielle (`thumbnail.ts`), document jsPDF et police (`pdfCtx.ts`), écriture pas à pas (`write.ts`). `jobSteps.ts` : exécution d'un travail (importe gifenc et jsPDF : jamais par la page). `worker/` : protocole typé, gestionnaire de messages (`handler.ts`, testable sous Node), client de page (`engine.ts`), Worker (`exportWorker.ts`), module vide des dépendances optionnelles de jsPDF. |
| `editor/` | Commandes pures sur la combinaison ; historique par instantanés ; sélection ; test d'atteinte ; aimantation ; outils course et passe ; raccourcis ; placements de départ ; mise en page de l'arbre des temps. |
| `player/` | Machine d'état du transport ; boîte de la zone utile. |
| `io/` | Abstraction du système de fichiers (`fs/`, texte et octets) et adaptateur des handles natifs ; `LibraryStore` avec `FolderStore` et `IdbStore` ; lecture et écriture des fichiers ; noms de fichiers ; corbeille par copie vérifiée en octets (`trash.ts`, D-043) ; `exports/` : existence, « Remplacer », « Garder les deux », tout ou rien, fichier vide retiré après un échec (`exportsFolder.ts`, D-065) ; orchestration d'un export : existence avant l'encodage, moteur, écriture ou téléchargement (`exportRun.ts`, D-076) ; accès au dossier ; import et export ; conflits ; synchronisation ; brouillon ; cache de lecture ; téléchargement (texte et octets). |
| `state/` | Stores Zustand (`editorStore`, `playerStore`, `libraryState`, `settingsStore`, `viewStore`, `panelsStore`, `exportStore`) ; interactions du terrain et raccourcis ; surcouche ; sélecteurs ; session (démarrage, stockage, synchronisation, conflits, import et export, cible des exports, préférences d'export) ; session d'export (`exportSession.ts` : travaux, progression, annulation, question « déjà présent », résultat, alerte de poids, version allégée, cahier) ; préférences par poste. |
| `ui/` | Composants React : barre d'outils (dont « Exporter GIF » et « Exporter PDF »), bandeaux et notifications, bibliothèque (dont « Cahier de jeu »), terrain, inspecteur, arbre des temps, commandes de lecture, dialogues ; `export/` : dialogues GIF, PDF et cahier, progression, question, résultat ; fenêtre modale commune ; textes d'interface ; feuille de style globale. |
| `types/` | Déclarations de la File System Access API absentes de lib.dom, et de gifenc. |
| `test/` | Outils de test (constructeurs, faux système de fichiers binaire, faux stockage clé-valeur, contexte 2D enregistreur avec relecture des tracés, images de référence, surfaces `@napi-rs/canvas`, moteur d'export « en ligne », lecture des GIF par omggif et des PDF par pdf.js) et fixtures. Jamais importés par l'application. |

## Modèle et fichiers

- Fichier de combinaison : `combinaisons/<nom-court>--<id>.combi.json`, JSON indenté de 2 espaces, clés triées, LF final ; lecture validée et migrée ; un fichier invalide, à clé inconnue ou d'une version future est signalé et jamais modifié (D-024).
- Version courante des combinaisons : `schemaVersion 1` (inchangée au lot 2). Fixtures v0 fictive et v1 figée.
- `reglages.json` : version 2 (préférences d'export) ; fixture `reglages-v1.json` ; un fichier v1 est migré à la lecture et réécrit en v2 au prochain enregistrement ; un fichier invalide ou futur n'est jamais réécrit (D-072).
- `exports/` : `<nom-court>--<variante>.<ext>` (D-066) ; un fichier remplacé part dans `_corbeille/`.

## Moteur et rendu

- `compileLine`, `sampleLine`, `phaseSchematic` ; caches passés en paramètre (inchangés au lot 2).
- `render(ctx, scène, viewport, thème, calques)` et `renderSchematic(...)` ; tailles en pixels CSS à l'échelle 1 multipliées par `viewport.pixelRatio` ; pour un PDF, ce rapport est en millimètres par pixel CSS (numéros des jetons juste au-dessus d'un nombre entier de points, D-071).

## Exports (lot 2)

- **Page** : la session d'export construit un travail (`ExportJob` : combinaison ou combinaisons, réglages du moteur, options), vérifie les noms attendus dans `exports/`, lance le moteur, puis écrit les fichiers (ou les télécharge) et affiche leur taille. Les préférences des dialogues sont lues et écrites dans `reglages.json`.
- **Worker** : un Worker module, créé au premier export et réutilisé ; il charge la police une fois (`FontFace` pour l'`OffscreenCanvas`, mêmes octets pour jsPDF) ; un travail s'exécute pas à pas (une image ou une page), en rendant la main entre deux pas (`MessageChannel`) et en vérifiant une annulation ; les octets sont transférés à la fin. Sans réponse à l'annulation dans la seconde, la page arrête le Worker (D-076).
- **GIF** : plan des images (cartons, passages ralenti et vitesse réelle, reprise au point d'option, maintiens, délais cumulés) ; une mise en page fixe (format, rapport de taille lisible sur téléphone, cadrage sous l'en-tête et le bandeau) ; palette globale sur échantillon, indice transparent pour les pixels inchangés, `dispose: 1`.
- **PDF** : mise en page pure mesurée avec la police embarquée (rangées, réduction de 90 à 60 mm, suites, téléphone en une colonne), cahier en deux passes (sommaire, liens, numéros, signets), écriture par jsPDF (textes par son API, vignettes vectorielles par `renderSchematic` sur son contexte 2D), date et identifiant tirés des données.
- **Build** : jsPDF et gifenc ne sont que dans le morceau du Worker ; html2canvas, dompurify et canvg sont remplacés par un module vide (D-071, contrôlé par `e2e/bundle.chromium.spec.ts`).

## Stockage et synchronisation

- `FolderStore` : index des fichiers ; relecture par date et taille confirmée par le contenu ; écriture par `createWritable` puis `close` ; concurrence optimiste ; corbeille par copie vérifiée (`io/trash.ts`) ; renommage ; copies de conflit en lecture seule ; structure `combinaisons/`, `exports/`, `_corbeille/`, `reglages.json`.
- `IdbStore` : même interface dans IndexedDB ; sans dossier, les exports sont téléchargés.
- `SyncController` : sauvegarde 2 s après la dernière modification, Ctrl+S, relecture au focus et toutes les 30 s si la fenêtre est visible.
- IndexedDB (base `abla-rck7`) et localStorage (`abla-rck7:prefs`) comme au lot 1.

## Interface

- Disposition 6.1, tailles fixes autour du terrain, calques en surimpression (D-048, D-050) ; sous 1500 px de large, les raccourcis et le titre de l'application sont masqués dans la barre d'outils (D-077).
- Fenêtres d'export, une à la fois : dialogue (GIF, PDF ou cahier, avec le nom des fichiers), progression (« Annuler », puis « Enregistrement… »), « Export déjà présent », « Export terminé » (fichiers, tailles, version allégée au-delà de 8 Mo).

## Tests et intégration continue

- Unitaires (Vitest, Node) : modèle et réglages v2, moteur, terrain, viewport, rendu (images de référence, aplats pour les quatre thèmes, conventions N&B relues sur les tracés enregistrés, habillage), exports (plan des images, délais, déterminisme octet pour octet, GIF relus par omggif, PDF relus par pdf.js : pages, texte, liens, signets ; images de référence d'une image de GIF et des vignettes de PDF), io des exports contre un faux système de fichiers binaire, protocole et moteur « en ligne » (le gestionnaire du Worker sous Node), session d'export, édition, transport, stores.
- Bout en bout (Playwright, sur le build) : lot 1 (mode dossier, modifications extérieures, mode dégradé, stabilité du terrain, interface) ; lot 2 avec le vrai Worker : GIF (fichier, nombre d'images et délais, interface sans tâche longue, « Remplacer » et octets identiques, un GIF par option, préférences, annulation), PDF (impression N&B, téléphone, cahier de 5 combinaisons importées), Firefox en téléchargement, composition du build. La section de chaque lot de `docs/RECETTE.md` relie chaque comportement à ses tests (D-054).
- CI GitHub Actions sur `ubuntu-24.04` (D-053) : job « checks » (lint, typecheck, test, test:e2e, build), puis déploiement Pages depuis `main` seulement. `main` protégée (D-028, D-055).
