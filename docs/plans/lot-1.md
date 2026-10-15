# Plan du lot 1 : socle

Plan validé le 14 octobre 2026, avec les réponses Q1 à Q27 (section 5, détaillées dans `docs/DECISIONS.md`, entrées D-001 à D-027) et les compléments demandés en cours de lot (section 8).
Suivi : une case par étape, cochée dans le commit qui termine l'étape, avec le hash court de ce commit (ou du commit précédent quand le hash du commit lui-même ne peut pas y figurer). L'état courant détaillé est dans `docs/ETAT.md`.

## Contexte

Le dépôt ne contient que `CLAUDE.md` et `docs/`. Le lot 1 couvre les sections 3, 4 (types des lots 3 à 5 seulement déclarés), 5.1 à 5.6, 6, 7, 8 et 13 de la spécification, ainsi que les valeurs de la section 14 qui s'y rapportent. Tu as demandé un ajout : `.gitattributes` avec `* text=auto eol=lf`.

Constats préalables (vérifiés) :
- le dépôt `antoineblach/Abla_rckF7_tac` est public ; Pages est activé avec la source « GitHub Actions » ; URL : https://antoineblach.github.io/Abla_rckF7_tac/ ;
- les 4 fichiers suivis sont déjà en LF dans l'index et sur le disque, donc aucune renormalisation n'est nécessaire. `core.autocrlf=true` sur ce poste : `.gitattributes` le neutralise ;
- Node 24.15 et npm 11.12 sont installés, `gh` est connecté.

Déroulement : branche `lot-1`, un commit en français par étape, PR vers `main` à la fin. Je ne fusionne pas : tu fusionnes après la recette.

## 1. Arborescence des fichiers créés

```
.gitattributes            * text=auto eol=lf ; en plus : *.png *.ttf binary (protège les images de référence et la police)
.editorconfig             UTF-8, LF, 2 espaces
.gitignore                node_modules, dist, test-results, playwright-report, coverage
.nvmrc                    24
.prettierrc.json, .prettierignore
eslint.config.js          config « flat », TS strict, règles de pureté et d'aplats (voir étape 0)
index.html
package.json, package-lock.json
tsconfig.json, tsconfig.app.json, tsconfig.node.json
vite.config.ts            base "/Abla_rckF7_tac/" + config Vitest
playwright.config.ts      projets chromium et firefox ; webServer = build puis preview
README.md
.github/workflows/ci.yml
docs/ARCHITECTURE.md, docs/DECISIONS.md   créés
docs/SPEC.md              modifié : 13.1 corrigé selon la Règle 1 (Q1)
public/fonts/AtkinsonHyperlegible-Regular.ttf, AtkinsonHyperlegible-Bold.ttf, OFL.txt
e2e/
  support/folderStub.ts         remplace showDirectoryPicker par un sous-dossier OPFS « Rugby7 »
  support/opfs.ts               lecture/écriture OPFS depuis le test (simule le PC 2)
  support/editorActions.ts      gestes réutilisables (temps, options, course, passe, lecture)
  folder.chromium.spec.ts
  external-changes.chromium.spec.ts
  degraded.firefox.spec.ts
src/
  main.tsx, vite-env.d.ts
  types/file-system-access.d.ts showDirectoryPicker, queryPermission, requestPermission, move (absents de lib.dom)
  config/defaults.ts            valeurs de la section 14 du lot 1 + choix graphiques, HYPOTHÈSE / SOURCE
  model/
    types.ts                    Play v1, Entity, Phase, Action, FieldView, Vec2, Team, Id
    declared.ts                 KickAction, BreakdownAction, GroupRunAction, EquipmentEntity, ZoneEntity,
                                AnnotationEntity, DefenseSettings, PlacementPreset (déclarés seulement)
    ids.ts                      fabrique d'identifiants injectable (crypto.randomUUID en production)
    canonical.ts                sérialisation canonique (clés triées) + hachage de contenu
    schema.ts                   schémas zod v1 (rejettent les types des lots 3 à 5, Q4)
    schemaV0.ts                 schéma zod de la version 0 fictive
    migrations.ts               registre vN -> vN+1, migrateToCurrent
    issues.ts                   type Issue (code, gravité, cible, message en français)
    validate.ts                 règles 4.3 (+ avertissements : numéros en double, dimensions hors Règle 1)
    phaseTree.ts                enfants, lignes racine-feuille, ligne par défaut, profondeur, libellés
    settings.ts                 type et schéma de reglages.json (allures, vitesse de passe, thème)
  field/
    geometry.ts                 lignes du terrain en mètres (pleines, tirets), poteaux, repère central
    drawField.ts                tracé via Ctx2D + viewport + thème
  engine/
    vec.ts
    spline.ts                   Catmull-Rom centripète, table d'abscisse curviligne (>= 64 échantillons par segment)
    trajectory.ts               course -> trajectoire temporisée ; portion parcourue à t
    pass.ts                     point fixe d'arrivée, vol rectiligne
    timeline.ts                 compileLine : débuts et durées des temps, segments par entité, possession du ballon
    sceneState.ts               SceneState, BallState (loose et inBreakdown déclarés)
    caches.ts                   EvalCaches : Map indexées par hachage, taille bornée
    evaluate.ts                 evaluate(play, branchPath, t, settings, caches) et données du mode schéma
    validate.ts                 validations 5.3 et 5.4
    bounds.ts                   boîte englobante d'une ligne
  render/
    ctx2d.ts                    interface Ctx2D minimale (canvas, OffscreenCanvas, plus tard jsPDF)
    viewport.ts                 mètres <-> pixels, cadrages, orientations, rotation 180° (lot 2), zoom et déplacement
    themes.ts                   « Écran », « Contraste fort »
    layers.ts                   calques (traces, consigne, ligne d'avantage ; suivants déclarés)
    primitives.ts               flèches, pointillés, tirets, jetons, ballon, bandeau (aplats)
    render.ts
    renderSchematic.ts          renderSchematic(ctx, play, branchPath, phaseId, viewport, theme, settings, caches)
  editor/
    commands.ts                 transformations pures de Play
    history.ts                  annuler/rétablir par instantanés, 100 niveaux, regroupement par geste
    selection.ts, hitTest.ts, snap.ts
    placements.ts               « Équipe A seule en ligne », « 7 contre 7 en ligne »
    shortcuts.ts                table des raccourcis 6.2
    tools/types.ts, selectTool.ts, placePlayerTool.ts, runTool.ts, passTool.ts
  player/
    transport.ts                machine d'état pure de lecture
    framing.ts                  cadrage automatique / vue enregistrée
  io/
    fs/types.ts                 sous-ensemble utilisé de la File System Access API
    fs/nativeFs.ts              adaptateur des handles natifs
    kv.ts                       interface clé-valeur + adaptateur idb-keyval (préfixe abla-rck7:)
    serialize.ts                JSON indenté de 2 espaces, clés triées, LF final
    fileNames.ts                nom court, nom de fichier, nom horodaté en corbeille
    readPlay.ts                 texte -> zod -> migrations -> validation métier
    LibraryStore.ts             interface 8.1 étendue (Q20) + PlaySummary, Change, LibraryIssue
    FolderStore.ts, IdbStore.ts
    folderAccess.ts             choix du dossier, handle persistant, permission, structure
    settingsFile.ts             reglages.json
    packFiles.ts                export/import .combi.json et .combipack.json
    conflicts.ts                décisions pures (rechargement silencieux, choix, garder les deux)
    sync.ts                     relectures (démarrage, focus, 30 s), sauvegarde auto 2 s, concurrence optimiste
    draft.ts, readCache.ts      brouillon et cache de lecture (IndexedDB)
  state/                        stores Zustand (Q27)
    editorStore.ts, playerStore.ts, libraryState.ts, settingsStore.ts
  ui/
    App.tsx, global.css, strings.ts (tous les textes d'interface)
    layout/AppLayout.tsx
    toolbar/Toolbar.tsx
    library/LibraryPanel.tsx, LibraryItem.tsx, Thumbnail.tsx
    field/FieldCanvas.tsx
    inspector/Inspector.tsx, PlayInspector.tsx, PlayerInspector.tsx, RunInspector.tsx,
              PassInspector.tsx, PhaseInspector.tsx, IssueList.tsx
    phases/PhaseTree.tsx
    player/TransportBar.tsx, OptionChooser.tsx
    feedback/StatusBanner.tsx, Toasts.tsx
    dialogs/ConfirmDialog.tsx, NewPlayDialog.tsx, ConflictDialog.tsx, DuplicateDialog.tsx,
            ImportDialog.tsx, DraftDialog.tsx
    hooks/useAnimationLoop.ts, useKeyboardShortcuts.ts, useCanvasSize.ts, useSyncLifecycle.ts, useFieldFont.ts
    (+ un .module.css par composant qui en a besoin)
  test/                         outils de test, jamais importés par l'application
    memoryFs.ts                 faux système de fichiers (horloge injectable, modifs extérieures simulées)
    memoryKv.ts, recordingCtx.ts, builders.ts, imageSnapshot.ts
    fixtures/play-v0.json, play-v1-simple.json, play-7v7-options.json, play-4v2-no-ball.json, invalid-*.json
    image-snapshots/*.png
```
Les tests unitaires sont placés à côté des sources (`*.test.ts`). `src/export/` et `src/engine/defense/` ne sont pas créés.

## 2. Ordre d'implémentation (chaque étape finit sur `lint`, `typecheck` et `test` verts, puis un commit)

- [x] **Étape 0 : outillage.** (commit `1a2de6f` ; protection de `main` activée par `gh api` ensuite)
- Branche `lot-1`, `.gitattributes`, Vite + React + TS strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`), Prettier, Vitest, Playwright, scripts npm du tableau de CLAUDE.md, workflow CI (un job unique « checks » : lint, typecheck, test, test:e2e, build ; puis un job deploy sur push vers `main` seulement), application vide, un test de fumée unitaire et un e2e.
- `docs/DECISIONS.md` créé tout de suite avec les réponses Q1 à Q27 (datées du 14 octobre 2026).
- Règles ESLint :
  - `no-explicit-any` ;
  - `ban-ts-comment` en mode « avec description » ;
  - dans `model/`, `engine/`, `field/` et `render/` : interdiction de `Date.now`, `new Date`, `Math.random`, `performance.now`, des minuteries, de `window`/`document` et des imports React, Zustand ou `io/` ;
  - dans `render/` et `field/` : interdiction de `createLinearGradient`, `createRadialGradient`, `createConicGradient`, `createPattern`, `shadowBlur` et `filter` ;
  - dans `ui/` : interdiction du tiret cadratin dans les chaînes et le JSX.
- Deux essais jetables avant de continuer :
  - (a) OPFS sous Playwright Chromium : création, écriture, handle stocké en IndexedDB, survie au rechargement ; si le contexte par défaut le refuse, repli sur `launchPersistentContext` avec un profil temporaire ;
  - (b) `@napi-rs/canvas` avec la police embarquée, sous Windows et sur la CI Linux.
- Push de `lot-1` : la CI doit être verte ; le déploiement est ignoré hors `main`.
- Protection de `main` par `gh api` : le statut « checks » est obligatoire avant fusion, aussi pour les administrateurs, sans revue exigée. Conséquence : plus aucun push direct sur `main`, tout passe par une PR.

- [x] **Étape 1 : config, model et correction de la SPEC.** (commits `4a566e1` et `8ba710d`) `defaults.ts`, types, types déclarés, zod v1 et v0 fictive, migrations, validation 4.3, arbre des temps et libellés, sérialisation canonique, hachage, réglages. Commit séparé : « Correction de la spécification 13.1 selon la Règle 1 ». Tests.

- [x] **Étape 2 : engine.** (commit `a6cdb3c`) Spline et abscisse curviligne, trajectoires, passes (point fixe), timeline et durées, possession du ballon, traces calculées, ligne d'avantage, validations et repli (Q13), caches, `evaluate` avec `settings` (Q3), données du mode schéma, boîte englobante. Tous les tests moteur obligatoires.

- [x] **Étape 3 : field, render et viewport.** (commit `1ff408b`)
- Géométrie et tracé du terrain : Règle 1, tirets de 5 m espacés de 5 m, poteaux à 5,6 m (HYPOTHÈSE).
- Viewport :
  - cadrages : terrain complet, demi-terrain, cadre libre, cadrage automatique ;
  - orientations : en paysage, le terrain reste fixe ; en portrait et en carré, l'attaque va vers le haut ;
  - rotation de 180° optionnelle, non utilisée au lot 1 ;
  - conversion inverse pour la souris, zoom autour du curseur.
- Thèmes, calques, primitives (dont la flèche de sens d'attaque sur la ligne d'avantage), `render`, `renderSchematic`.
- Images de référence et contrôle des aplats.

- [x] **Étape 4 : io.** (commit `ade4e5b`)
- Abstraction du système de fichiers et `memoryFs` ; `FolderStore` et `IdbStore` (interface étendue, Q20).
- Accès au dossier et permission ; structure créée au premier usage (`reglages.json`, `combinaisons/`, `_corbeille/` seulement).
- Réglages, lots de combinaisons, conflits (Q22), noms (Q23), fichiers inattendus (Q24).
- Synchronisation.
- Renommage (Q5) : on écrit toujours le nouveau fichier, puis l'ancien part en corbeille.
- Brouillon (Q25), cache de lecture.
- Tests contre `memoryFs` et `memoryKv`.

- [x] **Étape 5 : editor, player et stores.** (commit « Éditeur, lecteur et état », hash reporté au commit suivant)
- Commandes pures, y compris « Insérer un temps après » et la suppression en cascade (Q14).
- Historique, sélection, hit test, aimantation.
- Outils : machines d'état sur des événements déjà convertis en mètres.
- Placements (Q8), raccourcis (Q15).
- Transport de lecture, avec la bascule « S'arrêter aux options » indépendante de la pause entre les temps (Q11).
- Cadrage.
- Stores Zustand qui relient l'éditeur, le lecteur et io.
- Tests.

- [ ] **Étape 6 : interface.**
- Disposition 6.1, canevas : rendu à la demande, `requestAnimationFrame` seulement pendant la lecture.
- Barre d'outils, bibliothèque (vignettes, recherche, filtre, tri, dupliquer, supprimer, exporter, importer), inspecteur, arbre des temps, transport, choix d'option.
- Plein écran, aperçu d'orientation, bandeaux (mode dégradé, « Réautoriser le dossier »), notifications, dialogues de conflit.
- Tests e2e.

- [ ] **Étape 7 : clôture.**
- README : installation, lancement, build, déploiement Pages, Google Drive pour ordinateur et dossier, conseil « Autoriser à chaque visite », mode dégradé.
- `docs/ARCHITECTURE.md` et `docs/DECISIONS.md`.
- Commit dédié « Mise à jour de la spécification selon les décisions du lot 1 » : docs/SPEC.md et docs/RECETTE.md mis à jour partout où Q1 à Q27 modifient ou complètent le texte (pas seulement 3.2, 3.3, 8.1, 8.3, 8.6). Sections modifiées listées dans la description de la PR.
- Recette automatisable : lint, typecheck, test, test:e2e, build.
- Liste de la recette manuelle restante.
- Push et PR `lot-1` -> `main`.

## 3. Dépendances

Les versions stables du moment de l'installation sont figées par `package-lock.json`.

| Paquet | Type | Justification |
|---|---|---|
| react, react-dom | exécution | imposé (3.1) |
| zustand | exécution | imposé (3.1) |
| zod | exécution | imposé (3.1) |
| idb-keyval | exécution | imposé (3.1) |
| typescript, vite, @vitejs/plugin-react | dev | pile imposée |
| vitest | dev | imposé |
| @playwright/test | dev | imposé |
| eslint, @eslint/js, typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals | dev | ESLint imposé ; jeu standard TS + React (règles des hooks) |
| prettier, eslint-config-prettier | dev | Prettier imposé ; évite les conflits de règles |
| @types/react, @types/react-dom, @types/node | dev | typage |
| **@napi-rs/canvas** | dev | contexte 2D réel sous Node pour les images de référence de `render` ; binaires précompilés Windows et Linux, sans dépendance système |
| **pixelmatch** | dev | comparaison d'images avec tolérance (petits écarts d'anticrénelage entre Windows et la CI Linux) |
| **Police Atkinson Hyperlegible** (OFL, fichiers TTF, pas un paquet npm) | ressource | (1) texte identique entre les deux PC, Node et la CI : sans elle, les images de référence diffèrent selon les polices du système ; (2) conçue pour la lisibilité ; (3) servira au PDF du lot 2 (police embarquée) |

Écartés : `uuid` (`crypto.randomUUID` suffit), immer, bibliothèque de composants, routeur, Testing Library et jsdom (l'interface est couverte par Playwright, la logique hors React par Vitest), fake-indexeddb (une interface clé-valeur testée en mémoire suffit).

## 4. Tests prévus

### Unitaires (Vitest, environnement Node)

**model**
- schéma v1 :
  - accepte les fixtures valides ;
  - rejette les invalides avec le chemin de l'erreur ;
  - rejette les clés inconnues et les types des lots 3 à 5.
- validation 4.3, une règle par test :
  - identifiants uniques ;
  - 0 ou 1 ballon ;
  - une seule racine ;
  - parent existant ;
  - pas de cycle ;
  - une seule option par défaut ;
  - références existantes ;
  - une course cible une joueuse ;
  - effectif quelconque, zéro compris.
- avertissements : numéros en double, dimensions hors Règle 1 ;
- migration de la fixture v0 fictive vers v1 ;
- refus d'une version future ;
- lignes et libellés : « Temps n », « Temps n, option A/B/C », libellé saisi ou calculé ;
- ordre canonique stable.

**engine (obligatoires)**
- continuité entre les temps et au point d'option : chaque enfant part de l'état final de son parent ;
- évaluation de chaque feuille : toutes les lignes, à de nombreux instants ;
- vitesse constante le long d'une spline : écart < 2 %, virages serrés compris ;
- passe vers une receveuse en mouvement : le ballon arrive sur elle à arrivalT ;
- état du ballon juste avant le lâcher, au lâcher, juste avant et à la réception ;
- durées :
  - durée d'un temps = max(delay + durée), 0 sans action, vol de la passe inclus ;
  - durée d'une ligne = somme des temps.
- traces identiques en lecture continue (caches partagés, pas successifs) et après un saut direct à t (caches neufs) ;
- attackingTeam = B ;
- effectif 4 contre 2 sans ballon ;
- déterminisme d'evaluate : deux appels et caches chauds ou froids donnent des résultats égaux à l'octet près.

**engine (tests ajoutés)**
- tronc identique dans toutes les lignes pour un même t ;
- critère d'acceptation 3 : modifier un point d'une course du temps 1 ne change aucun point de passage des descendantes, les passes arrivent toujours sur leur receveuse dans toutes les options et aucune nouvelle invalidité n'apparaît ;
- validations et repli (Q13) : passe vers l'autre équipe, passeuse sans ballon, passes simultanées, deux courses d'une même joueuse dans un temps ; aucun plantage ;
- les réglages changent les durées (Q3) ;
- `durationOverride`, `delay`, `ballSpeed` ;
- boîte englobante.

**field**
- positions des lignes pour 100 x 70 ;
- terrain réduit (94 x 68) selon la Règle 1 : lignes de 22 m à 22 m de la ligne de but, lignes de 10 m à 10 m de la médiane, lignes de 15 m à 15 m de la touche ;
- poteaux.

**render**
- images de référence d'une scène simple : thèmes Écran et Contraste fort, en paysage, portrait et carré, soit 6 PNG ; une image de plus pour le mode schéma ;
- contexte enregistreur :
  - aucun appel à un dégradé, un motif, `shadowBlur` ou `filter`, quels que soient le thème et les calques ;
  - en Contraste fort, traits >= 3 px ;
  - calques réellement indépendants ;
- viewport :
  - aller-retour mètres -> pixels -> mètres dans chaque orientation, avec et sans rotation de 180° ;
  - attaque vers le haut en portrait et en carré, pour A et pour B ;
  - en paysage, terrain fixe quand B attaque ;
  - ajustement avec marge.

**io (contre `memoryFs`)**
- aller-retour fichier ;
- fichier invalide signalé, octets et date inchangés, jamais déplacé ;
- lecture d'un fichier v0 : migré en mémoire, fichier intact ;
- doublon d'id détecté ;
- résolution « Garder les deux » et « Choisir celle-ci » ;
- modification extérieure :
  - date ou taille changée et `updatedAt` différent : détectée ;
  - date seule changée : ignorée.
- suppression = déplacement en `_corbeille/` horodaté, contenu identique ;
- renommage : nouveau fichier écrit, ancien en corbeille ;
- noms de fichiers : accents, ponctuation, caractères interdits par Windows, 40 caractères, nom vide ;
- fichiers `.crswap` ou non JSON ignorés ;
- structure créée au premier usage ;
- réglages : aller-retour ;
- concurrence optimiste : fichier modifié depuis la lecture, alors pas d'écrasement et conflit remonté ;
- fichier d'une version future intact ;
- `IdbStore` contre `memoryKv`, corbeille comprise ;
- lots `.combipack.json` : import d'un id existant avec « Remplacer » (ancienne version en corbeille) ou « Garder les deux », entrée invalide dans un lot ;
- synchronisation avec horloge simulée : sauvegarde 2 s après la dernière modification, relecture au focus, relecture toutes les 30 s seulement si la fenêtre est visible, rechargement silencieux ou choix proposé ;
- brouillon : écrit, effacé après la sauvegarde, proposé s'il diffère.

**editor et player**
- commandes :
  - placer, déplacer, supprimer en cascade ; numéro suivant libre ;
  - porteuse au départ, ajout et retrait du ballon ;
  - course, déplacer ou supprimer un point (le dernier point supprime la course), passe avec délai par défaut ;
  - ajouter un temps (sur une feuille seulement), « Insérer un temps après » (enfants rattachés au nouveau temps, options par défaut conservées) ;
  - dupliquer ou supprimer un temps, créer une option (le temps seul devient l'option A par défaut), option par défaut ;
  - équipe qui attaque ;
  - interdiction de déplacer une position héritée (Q9).
- historique : 100 niveaux, un geste = une étape, 10 annulations puis 10 rétablissements ;
- outils : course (clics, Entrée, double clic, Échap, prolongement d'une course existante), passe, sélection au cadre et Maj+clic, aimantation ;
- placements valides, positions de Q8 ;
- transport :
  - lecture, pause, vitesses, boucle, pause entre les temps ;
  - « S'arrêter aux options » activé : arrêt et choix ; désactivé : option par défaut ; indépendant de la pause entre les temps ;
  - retour au point d'option, temps précédent et suivant, saut ;
- cadrage automatique : boîte englobante + 5 m.

### Bout en bout (Playwright, sur le build de production)

En mode test, `page.addInitScript` remplace `window.showDirectoryPicker` par un sous-dossier OPFS (`navigator.storage.getDirectory()`). L'application n'a donc aucun code propre aux tests. OPFS fournit `createWritable`, `getFile` (date et taille) et `removeEntry`, ce qui couvre nos besoins ; la vérification se fait à l'étape 0.

- **folder.chromium** :
  - choisir le dossier ;
  - vérifier `reglages.json`, `combinaisons/` et `_corbeille/` ;
  - créer une combinaison « 7 contre 7 en ligne » avec 2 temps, puis 2 options au temps 3 (condition et consigne), des courses et une passe ;
  - Ctrl+S, puis vérifier le fichier `<nom-court>--<id>.combi.json` ;
  - renommer : nouveau fichier écrit, ancien en corbeille ;
  - recharger ;
  - lire chaque option : arrêt au point d'option, un bouton par option, retour au point d'option. L'image du canevas à des instants fixés doit être identique avant et après le rechargement.
- **external-changes.chromium** :
  - écrire une version modifiée du fichier dans OPFS (simulation du PC 2), puis déclencher le focus : rechargement silencieux et notification ;
  - avec une modification locale non enregistrée : les trois choix sont proposés ;
  - copie au même id : signalée, « Garder les deux » fonctionne ;
  - fichier corrompu : signalé, octets intacts.
- **degraded.firefox** :
  - bandeau du mode dégradé ;
  - même scénario d'édition, enregistrement en IndexedDB, rechargement, lecture de chaque option ;
  - export `.combi.json` et `.combipack.json` (téléchargement) ;
  - suppression, puis import qui fait revenir la combinaison ;
  - nouvel import du même id : « Remplacer » ou « Garder les deux ».

Pour que les tests e2e convertissent les mètres en pixels sans dupliquer de calcul, le canevas expose sa transformation courante dans un attribut `data-viewport`.

## 5. Décisions validées (14 octobre 2026, reportées dans DECISIONS.md)

- **Q1.** Règle 1 suivie. Les lignes de 22 m restent à 22 m de la ligne de but, celles de 10 m à 10 m de la médiane, celles de 15 m à 15 m de la touche ; seuls les écarts entre ces lignes diminuent. SPEC 13.1 corrigée.
- **Q2.** Tirets de 5 m espacés de 5 m ; poteaux à 5,6 m (HYPOTHÈSE).
- **Q3.** `evaluate(play, branchPath, t, settings, caches)` ; `renderSchematic` reçoit aussi `settings` et `caches`.
- **Q4.** Types des lots 3 à 5 déclarés en TS, présents dans les unions, ignorés par le moteur avec un signalement. Le zod v1 les rejette ; ils arrivent en v2.
- **Q5.** Renommer = écrire le nouveau fichier puis mettre l'ancien en corbeille, toujours. Le renommage n'a lieu qu'à la validation du nom (perte du focus ou Entrée).
- **Q6.** En paysage, le terrain reste fixe et une flèche de sens d'attaque est dessinée sur la ligne d'avantage. Le carré se comporte comme le portrait : attaque vers le haut. Le viewport sait faire une rotation de 180°, inutilisée au lot 1 ; au lot 2, les GIF paysage attaqueront toujours vers la droite.
- **Q7.**
  - Case « Porteuse au départ » dans l'inspecteur de joueuse.
  - « Ajouter / retirer le ballon » dans l'inspecteur de combinaison.
  - Le ballon n'est jamais dans `setup.positions`.
  - Une `ballPosition` sans porteuse est acceptée à la lecture mais n'est pas éditable.
- **Q8.**
  - A sur x = 40 m, n° 1 à 7 de y = 5 à 65 m, tous les 10 m.
  - En 7 contre 7, B en face à x = 50 m.
  - Ballon à A n° 4 ; A attaque.
  - Nom « Nouvelle combinaison », catégorie ruck/jeu courant, vue terrain complet.
- **Q9.** Les positions héritées ne se déplacent pas ; seuls les points de passage du temps sélectionné bougent. « Placer joueuse » fixe le placement initial.
- **Q10.** Mode schéma éditable quand un temps est sélectionné ou que la lecture est arrêtée à son début. Image `render` non éditable pendant la lecture ou après un déplacement du curseur. Tout geste d'édition ramène au mode schéma.
- **Q11.** Bascule « S'arrêter aux options », activée par défaut, indépendante de la pause entre les temps. Activée : arrêt et un bouton par option ; désactivée : option par défaut.
- **Q12.** Trois actions dans l'arbre des temps :
  - « Ajouter un temps » : sur une feuille seulement ;
  - « Insérer un temps après » : temps vide inséré entre le temps sélectionné et ses enfants, qui lui sont rattachés ;
  - « Créer une option à partir d'ici » : sœur vide ; si le temps était seul, il devient l'option A par défaut. Indisponible sur la racine.
  - « Dupliquer » crée une sœur avec copie des actions, sans les descendants.
  - Un libellé stocké vide est calculé ; un libellé non vide a été saisi. Les lettres se recalculent.
- **Q13 à Q27.** Suggestions retenues :
  - repli du moteur sur les invalidités ;
  - suppression en cascade ;
  - Ctrl+D sur les joueuses ;
  - prolongement d'une course existante ;
  - le dernier point supprimé supprime la course ;
  - délai par défaut d'une passe ;
  - les flèches ignorent la grille ;
  - grille activée par un bouton ;
  - numéros en double et dimensions hors Règle 1 : avertissements ;
  - demi-terrain « attack » = moitié de la ligne de but attaquée ;
  - cadrage automatique en lecture seulement, orientation disponible en édition, cadre libre par la vue actuelle, portion de passe en vol tracée ;
  - interface `LibraryStore` étendue, `stamp` = compteur de relectures ;
  - mode dégradé : bandeau propre à Chrome sans dossier, copie proposée au premier dossier, réglages et corbeille en IndexedDB ;
  - conflits : « (copie) », l'autre fichier en corbeille, « Remplacer » met l'ancienne version en corbeille d'abord, doublon en lecture seule ;
  - noms de fichiers et relecture de tout `*.json` ;
  - clé inconnue ou version future : fichier intact ;
  - brouillon ;
  - préférences par poste en `localStorage` ;
  - dossiers `state/`, `test/`, `types/` et `e2e/`.
- **Protection de `main`.** Statut CI obligatoire avant fusion, sans revue exigée.

Je ne modifie pas d'autres passages de la SPEC sans ton accord. En fin de lot, je te listerai ceux que ces décisions rendent inexacts : 3.3.1 et 3.3.2 (signatures), 3.2 (dossiers), 8.1 (interface), 8.3 (renommage), 8.6 (bandeau).

## 6. Choix techniques, sans portée métier, consignés dans DECISIONS.md

- Clés JSON triées par ordre alphabétique, de façon récursive ; l'ordre des tableaux est conservé.
- Hachage de contenu : cyrb53 sur la sérialisation canonique.
- Caches LRU bornés, sans effet sur les résultats.
- Catmull-Rom : extrémités par points fantômes réfléchis ; points consécutifs confondus retirés ; une course d'un seul point = segment droit ; table de 64 échantillons par segment avec interpolation linéaire.
- Passe : 5 itérations fixes du point fixe, pour le déterminisme.
- Dimensions graphiques (rayon des jetons, épaisseurs, police) en pixels CSS à l'échelle 1, définies dans les thèmes (valeurs HYPOTHÈSE dans `defaults.ts`).
- « Estompé » = couleur pleine précalculée, sans transparence (palette des GIF, jsPDF).
- Couleurs d'équipe : bleu `#0072B2` et orange `#E69F00` de la palette Okabe-Ito, avec `SOURCE: https://jfly.uni-koeln.de/color/`.
- `updatedAt` fixé par io à l'enregistrement, avec une horloge injectée.
- Concurrence optimiste : avant d'écrire, la date et la taille du fichier sont comparées à celles de la dernière lecture.
- Identifiants via `crypto.randomUUID`, injectés dans les commandes pour des tests déterministes.
- L'hypothèse 8.3 (écriture via un fichier `.crswap` validée à `close()`) est documentée avec sa source et confirmée en recette manuelle.

## 7. Vérification et clôture

- Automatisé : `npm run lint`, `typecheck`, `test`, `test:e2e` (Chromium et Firefox), `build`, puis la CI verte sur `lot-1`. Le déploiement n'a lieu que sur `main`, après fusion.
- Manuel : la section « Lot 1 » de RECETTE.md, que je te listerai en fin de lot, en séparant ce que l'e2e couvre déjà par simulation de ce qui reste propre à tes deux PC.
  - Restent propres à tes deux PC : Drive réel entre les deux machines, « Autoriser à chaque visite », mode diffusion de Drive (HYPOTHÈSE 8.8), fichiers `.crswap`, branche cassée et déploiement.

## 8. Compléments demandés en cours de lot

- [ ] **Mise à jour de la SPEC et de la RECETTE (étape 7).** À l'étape 7, commit dédié « Mise à jour de la spécification selon les décisions du lot 1 » : docs/SPEC.md et docs/RECETTE.md mis à jour partout où Q1 à Q27 modifient ou complètent le texte, sans se limiter à 3.2, 3.3, 8.1, 8.3 et 8.6. Sections modifiées listées dans la description de la PR.
- [x] **Mémoire de projet.** Commit dédié « Mémoire de projet » : ce fichier, `docs/ETAT.md` (60 lignes au plus, réécrit à chaque mise à jour), `docs/DECISIONS.md` en entrées numérotées D-001..., section « Mémoire du projet » de `CLAUDE.md` (avec `@docs/ETAT.md`), prompt « Reprise » de `docs/PROMPTS.md`. Tenus à jour jusqu'à la fin du lot. (commit `eb74c37`)
