# Plan du lot frise-1 : modèle et moteur de la frise (D-139, SPEC 1.9)

Validé le 4 novembre 2026, avec les réponses Q1 à Q14 (recommandations acceptées, 5 précisions) et 4 corrections de l'utilisateur, intégrées ci-dessous. Décisions : D-140 à D-153 (étape 0) ; la question Qn de ce plan donne D-(139 + n).

Ce plan doit se suffire : chaque bloc est lancé dans une nouvelle conversation par `/reprise`. Lecture : dans ce plan, seulement le « Détail par étape » de l'étape, les sections qu'il cite et les lignes de « Tests » qui la concernent (Grep du titre, Read ciblé, comme `/reprise`) ; jamais le plan entier. Aucun sous-agent. Dans un bloc : étape, `/fin-etape`, étape suivante (D-125).

Q1 à Q14 sont les questions de ce plan ; celles de D-139 sont écrites « D-139 Q1 ».

## Contexte

La SPEC 1.9 remplace l'arbre de temps par une frise continue : instants absolus, branches, séquences, collages entre bords. `src/` est encore en v4. Ce lot porte le modèle, le moteur et le minimum d'application pour que le site fonctionne sans frise : instants réglés dans l'inspecteur (D-139 Q13). La frise elle-même, le lecteur complet et les exports complets viennent en frise-2 à frise-4 (section 7 de `docs/archive/plans/frise-spec.md`).

Ampleur : 122 fichiers mentionnent les temps (`git grep -c -i phase -- src e2e` ; `phasePlay` n'est pas un temps, ne pas le renommer). Volume des fichiers concernés, tests compris : modèle 89 Ko, moteur 192 Ko, rendu 82 Ko, exports 87 Ko, lecteur 10 Ko, éditeur 152 Ko, état 115 Ko, io 47 Ko, interface 155 Ko, e2e 77 Ko.

## Réponse aux contraintes du prompt

1. **Check vert à chaque étape** : la v5 est écrite dans `src/v5/`, à côté de la v4, couche par couche, avec ses tests (D-140). La v4 reste intacte et l'application tourne dessus jusqu'à la bascule (C4). Aucune exclusion de `tsc`, d'ESLint ni de Vitest. Seul écart, de C4 à C5 : les e2e pas encore portés sont déplacés dans `e2e/a-porter/`, ignorés par un `testIgnore` provisoire de `playwright.config.ts`, et inscrits dans « Écarts connus » d'ETAT.
2. **Découpage de C** : C1 à C5, un bloc chacun, ci-dessous. B est aussi coupé en deux : `timeline.ts` fait 57 Ko.
3. **builders.ts d'abord** : première chose écrite du bloc A après les types, `realisticRunsPlay()` compris.
4. **Temps de compilation** : mesuré dès B2, v4 et v5 comparées sur le même poste, rapporté dans ETAT (D-150).
5. **Fixtures** : `play-v5-frise.json` créée en A ; `cahier.combipack.json` réécrite en v5 en C5 ; `reglages-v*` et `preset-v1-touche.json` gardées.
6. **Refus de v1 à v4** : tableau à la section Tests.

## Stratégie : `src/v5/`

- **Contenu** : seuls les modules qui dépendent du type `Play` v4 sont réécrits ou copiés sous `src/v5/`, à la même place relative (`src/v5/engine/timeline.ts`).
- **Réutilisés depuis leur emplacement actuel**, car indépendants de `Play` et structurellement compatibles : `engine/spline`, `profile`, `pass`, `vec` ; `config/defaults` ; `model/settings`, `speed`, `canonical`, `ids`, `preset`, `shortName` ; `field/` ; `render/viewport`, `themes`, `primitives`, `captions`, `layers` ; outils de `test/` sans `Play` (`memoryFs`, `memoryKv`, `recordingCtx`, `imageSnapshot`, `gifInspect`, `pdfInspect`, `driveSim`, `profileMath`).
- **Configuration** : globs ESLint de pureté étendus à `src/v5/...` ; de A à C3, `tsc`, Vitest et Playwright n'ont rien à changer. Les images de référence v5 sont préfixées `v5-` jusqu'à la bascule.
- **Bascule (C4)** : suppression des modules v4, `git mv` de `src/v5/*` à leur place, script jetable (scratchpad, non commité) qui raccourcit d'un niveau les imports sortant de `v5` et les chemins de fixtures des tests (`new URL('../../test/fixtures/...')`, qui ne sont pas des imports), globs ESLint rétablis. Le diff final de la PR montre des modifications en place, `src/v5` n'y apparaît plus.
- **`e2e/a-porter/` (C4 à C5)** : `testDir: 'e2e'` parcourt les sous-dossiers, d'où un `testIgnore` provisoire dans `playwright.config.ts`, posé en C4, retiré en C5, inscrit dans « Écarts connus » d'ETAT, qui dit aujourd'hui « Aucun test désactivé ». `tsconfig.json` inclut `e2e` et ESLint tout le dépôt : ces specs restent compilées et lintées, sans exclusion. Leurs imports relatifs sont ajustés au déplacement (`export-gif` importe `../src/...`) et les helpers qu'elles utilisent restent jusqu'à C5 ; une spec qui ne compile plus à la bascule est portée dès C4.
- **Coût** : copies temporaires et `check` plus lent de A à C3. **Gain** : site, `check`, e2e et CI verts à chaque étape, pause sans risque à tout moment, moteur v4 disponible pour comparer jusqu'en C4.
- **`/fin-etape`** : de A à C3, seul `src/v5/` change ; la v4 ne bouge pas, donc pas d'e2e à relancer. Dès C4, la règle e2e s'applique sur les specs portées.

## Moteur v5 (blocs B1 et B2)

- **`CompiledLine`** à plat : `motions` (plusieurs par joueuse), `passes`, `kicks`, `breakdowns`, `ball`, plus `branches` (instants résolus), `sequences` (après replis de 4.3), `intervals` (5.1), `blocks` (début et fin réels par id).
- **Simulation chronologique unique sur la ligne** : file des départs de course, lâchers et formations, transitions résolues entre deux événements (5.4). Une course est construite à son départ, depuis la position de la joueuse à cet instant, ce qui règle le gel par un regroupement, le report et le relais. La logique du ballon de `compilePhase` (`engine/timeline.ts`, lignes 429 à 1306) est reprise.
- **Résolution des collages par branche, du tronc vers la feuille** : un bloc d'une branche n'est résolu qu'avec les actions de sa branche et de ses ancêtres, dans l'ordre du graphe (5.8). Le tronc commun est donc identique par construction, et testé.
- **Lancée (5.2)** : pré-passe qui lit le modèle sur toutes les lignes passant par la course ; recompilation unique pour une course du tronc dont la suivante part en réalité à l'embranchement.
- **Coût** : mouvements mémoïsés par compilation (course, position de départ, facteurs, lancée). Le budget se mesure sur toutes les lignes, car `playIssues` (`state/selectors.ts`, appelé par `Inspector` et `ActionList`) les recompile à chaque rendu.
- **Découpage** : `timeline.ts` (API publique), `simulate.ts`, `motion.ts`, `glue.ts`, `launch.ts`, `runAlerts.ts` (alertes de vitesse et d'accélération, reprises).

## Le site à la fin de frise-1

Fonctionne : placements, tous les outils (6.2 sauf la coupe), instants et durées dans l'inspecteur, lecture, curseur, GIF, PDF, dossier, mode dégradé, modèles, refus v4.

Manque jusqu'au lot indiqué :
- frise-2 : créer un embranchement, une option ou une séquence (donc pas de consigne saisie), poser un collage à la main (rendez-vous), « Couper la course ici » ;
- frise-3 : précédent et suivant de la SPEC 7, pause par séquence, traces appuyées par intervalle ;
- frise-4 : PDF en arbre (une vignette par ligne d'ici là), préfixe « À 4,5 s, » des cartons.

Une combinaison existante est refusée (4.4), comme le veut D-139.

## Fichiers créés ou modifiés

| Bloc | Fichiers |
|---|---|
| 0 | `docs/plans/lot-frise-1.md`, `docs/decisions/frise.md`, `docs/decisions/README.md`, `docs/ETAT.md` ; `docs/plans/frise-spec.md` vers `docs/archive/plans/` |
| A | `src/v5/test/builders.ts` ; `src/v5/model/` : `types`, `declared`, `schema`, `migrations` (refus, pas de pas de migration), `branches` (remplace `phaseTree`), `syncGraph` (`glueProblem` seul, le graphe vient en B2), `validate`, `issues`, `labels` et leurs tests ; `src/test/fixtures/play-v5-frise.json` ; `eslint.config.js` |
| B1 | `src/v5/engine/` : `timeline`, `simulate`, `motion`, `runAlerts`, `evaluate`, `sceneState`, `bounds`, `validate`, `ballEvents`, `caches`, `actionReport` et tests portés (`runs`, `evaluate`, `breakdown`, `kick`, `forwardPass`, `actionReport`), plus `trunk.test`, `overlap.test` |
| B2 | `src/v5/model/syncGraph.ts` ; `src/v5/engine/glue.ts`, `launch.ts` ; tests `glue`, `launch`, `cut`, `profileCount` ; `src/v5/engine/compile.bench.ts` ; script `bench` dans `package.json` et ligne dans `CLAUDE.md` ; `docs/ETAT.md` (mesures) |
| C1 | `src/v5/render/` : `render`, `renderSchematic`, `overlay` ; `src/v5/export/` (tout le dossier, worker compris) ; `src/v5/player/transport.ts` ; `src/v5/test/exportFixtures.ts`, `inlineEngine.ts` ; tests et images `v5-*` |
| C2 | `src/v5/editor/` : `commands`, `hitTest`, `transform`, `presets`, `placements`, `placementMode`, `tools/` et tests. Non repris : `phaseLayout`, `syncPick` |
| C3 | `src/v5/io/` : modules typés `Play`, `refusal.test.ts` ; `src/v5/state/` ; `src/v5/ui/strings.ts`, `describe.ts` ; tests |
| C4 | Bascule. Supprimés : `model/migrations` v1 à v4, `schemaV0` à `schemaV3`, fixtures `play-v0` à `play-v4`, `phaseTree`, `phaseLayout`, `syncPick`, `ui/phases/PhaseTree.tsx`, `ui/field/SyncBanner.tsx`, `ui/inspector/ReleaseFields.tsx`. Portés : `ui/inspector/*`, `ui/phases/ActionList.tsx` et `actionRows.ts`, `ui/player/TransportBar.tsx`, `ui/field/FieldCanvas.tsx`, `ui/App.tsx`, `ui/dialogs/Dialogs.tsx`, `ui/library/*`, `ui/global.css`. e2e : `support/editorActions.ts`, `a-porter/`, `playwright.config.ts` (`testIgnore` provisoire). Docs : `ETAT.md` |
| C5 | `e2e/*.spec.ts` réécrits, `e2e/refusal-v4.chromium.spec.ts`, `e2e/refusal-v4.firefox.spec.ts`, `e2e/fixtures/options.combi.json`, `e2e/fixtures/cahier.combipack.json` en v5, `e2e/a-porter/` supprimé, `testIgnore` retiré de `playwright.config.ts`, `docs/ETAT.md` (reports) |

`docs/ARCHITECTURE.md` n'est dans aucun bloc : `/fin-lot` le met à jour.

## Dépendances

Aucune. `vitest bench` est déjà dans Vitest.

## Détail par étape

### Étape 0

Branche `lot-frise-1` depuis `main` à jour. `git mv docs/plans/frise-spec.md docs/archive/plans/`. Plan validé dans ce fichier. Décisions dans `docs/decisions/frise.md`, section « ## Lot frise-1 », D-140 à D-153, une ligne d'index chacune. ETAT : PR #10 fusionnée (`00bd163`), section 7 de `frise-spec.md` (frise-2 à frise-4) lue dans `docs/archive/plans/`, piste D-118 « Vitesse initiale à t = 0 », Q14 dans « Questions ouvertes ».

### Étape A

Lecture : SPEC 04 en entier, 10.3, 10.4 ; `model/types.ts`, `schema.ts`, `phaseTree.ts`, `validate.ts`, `issues.ts`, `labels.ts`, `migrations.ts` ; `test/builders.ts` ; PIEGES : TypeScript et ESLint.

Dans cet ordre : types (4.1, 10.3, 10.4), puis `builders.ts`.
- `realisticRunsPlay()` : même nombre d'actions que la v4, plus une course par `at` coupé, soit 18 actions contre 16 (`at` des courses `uuid(502)` et `uuid(512)`). Les liens deviennent des collages : `adjust: 'delay'` donne `keep: 'duration'`, `adjust: 'speed'` donne `keep: 'start'`, `endsAtSpeed` donne une suivante collée sans écart, `at` donne deux courses collées. Écarts : D-157.
- `friseFixturePlay()`, source de la fixture figée : branches, séquences, tous les événements de collage, jeu au pied, regroupement, vitesses de segment, allure saisie.
- Schéma zod strict v5 ; `upgradePlay` renvoie le nouveau code `obsoleteVersion` pour toute version inférieure à 5, sans toucher à `readSchemaVersion` partagé avec les modèles et les réglages.
- Validation 4.3, sauf les cycles (B2).

### Étape B1

Lecture : SPEC 5.1, 5.2, 5.4, 4.3 (replis), 5.3 et 5.9 par Grep, 10.3 ; `engine/timeline.ts` (`compilePhase`), `engine/evaluate.ts`, `engine/sceneState.ts` ; PIEGES : Vitest et images de référence.

Compilation de ligne continue, sans collage : `start` seuls, chevauchements (« départ retardé de x s »), participantes d'un regroupement retardées à la sortie, replis de 4.3 (option avant l'embranchement, tronc après, séquences), passe en vol à l'embranchement (D-139 Q2), intervalles 5.1, durée 5.1 à la lettre (D-153), `sampleLine`, `evaluate`, schéma d'une fenêtre (positions à `t`, actions de la fenêtre en plein, antérieures en grisé).

Reçu de l'étape A : `validatePlay` lit les instants enregistrés et laisse de côté les bords et les embranchements collés ; le moteur signale les mêmes cas sur les instants résolus, avec les mêmes codes (`startsBeforeBranch`, `startsAfterBranch`, `sequenceCrossesBranch`, `sequenceOverlap`, `branchAtNotIncreasing` ; D-156). Il ignore une séquence dont `end <= start` (D-155). `issues.ts` v5 n'a plus `twoRunsSamePhase`, ni les `sync*` : ajouter les codes du moteur au fur et à mesure (« départ retardé de x s », cycle, retard de collage). Les builders v5 ont `branch()`, `sequence()`, `ROOT_BRANCH`, `P.root`, `P.optA`, `P.optB` ; le premier argument après les joueuses de `pass`, `kick` et `breakdown` est `start`.

### Étape B2

Lecture : SPEC 5.2, 5.8, 4.3 (collage), 5.3 (solveur), D-152 ; `model/syncGraph.ts` ; `engine/timeline.ts` (`resolveLink`, `meetOnTime`, `targetOf`).

- Graphe tous bords (`syncGraph.ts`, qui contient déjà `glueProblem` depuis l'étape A). L'arrivée d'une passe ne dépend que des courses de la passeuse et de la receveuse qui ne dépendent pas elles-mêmes de cette arrivée, directement ou par une chaîne de collages (D-152).
- Collages gauche et droit dans leurs deux réglages `keep`, bornes, solveur à deux leviers sur course entière, embranchement collé, cas particuliers du tableau de 5.8, receveuse collée à l'arrivée, lancée (D-139 Q1), cycles dans `validate`.
- Test de coupe (D-139 Q4, D-149) : seuils en constantes du test, commentées `HYPOTHÈSE`. **Dépassement : je m'arrête et je donne la mesure à l'utilisateur, sans relâcher les seuils.**
- Bench (D-150). ETAT reçoit les temps v4 et v5 ; le bench le précise à côté des mesures : `realisticRunsPlay()` compte 18 actions en v5 contre 16 en v4, à cause des deux `at` coupés. **Au-delà de 33 ms par mouvement, je m'arrête et je demande.**

Reçu de l'étape B1 :
- `src/v5/engine` ignore tous les collages : `resolveBranches`, `plannedInBranch` et `resolveSequences` (`timeline.ts`) lisent les instants enregistrés, à remplacer par les instants résolus. `simulateLine` reçoit `LineAction.planned`. `realisticRunsPlay` y déclenche donc des `runStartDelayed` parasites jusqu'à B2.
- `motion.ts` : `getSpline` sans direction de départ, `startSpeed: 0`, `endsAtSpeed: false`, clé de `runShape` à étendre (facteurs, lancée) ; `RunMotion` n'a ni `prolongs`, ni `endsAtSpeed`, ni résultat de collage, et `actionReport` ni `atSpeed`, ni collage ; `windowSchematic` n'a pas les traits de collage.
- Une course est construite à la demande, lecture en avant comprise : `aimed` écarte les courses d'option de la receveuse pendant la visée, `unbuildAfter` défait ce qui a été lu trop tôt, `waitForArrival` applique D-139 Q2, `freezeAt` remet en attente ce qui part à la formation ou après. `advanceOne` est l'endroit où une réception programmera un lâcher collé.
- `issues.ts` a `runStartDelayed` (`params.delay`) et garde `runNotContinued` ; à ajouter : cycle, retard de collage, cible jamais atteinte.
- Tests v4 non portés en B1, à porter ici : `runs.test` « runs ending at speed » (vers `launch.test`) ; `forwardPass.test` « reads the passer speed… » (lâcher à l'instant où une course démarre, D-085) ; `actionReport.test` « reports the links » et « gives the points of a link » ; `sync.test` (vers `glue`). Déterminisme des deux compilations : `runs.test` et `evaluate.test` le couvrent déjà sans collage, à refaire avec.
- `engine/pass.ts` est réutilisé : à ne pas supprimer en C4.

### Étape C1

Lecture : SPEC 3.3, 7, 9.2 et 9.3 par Grep ; `render/render.ts`, `renderSchematic.ts`, `overlay.ts` ; `player/transport.ts` ; `export/gif/timeline.ts`, `frame.ts`, `pdf/layout.ts`, `thumbnail.ts`, `write.ts` ; PIEGES : jsPDF et pdf.js, gifenc, Vitest et images de référence.

Reçu de l'étape B2 :
- `src/v5/engine` résout les collages (`glue.ts`, `launch.ts`). `compileLine` donne `glues` (`CompiledGlue` : bord, cible, statut, instant, points). `RunMotion` a `endsAtSpeed` et `launch` (prolonge si non nul) à la place de `prolongs`. `WindowSchematic.glueLinks` donne les traits de collage de la fenêtre, pour la surcouche d'édition, jamais exportés (5.8). `lineReport` donne `endsAtSpeed`, `atSpeed`, `prolongs`, `startGlue`, `endGlue` ; il n'y a plus de `launchWait`.
- Pour C2 : `model/syncGraph.ts` exporte `glueEdges`, `edgeKey`, `analyseGlues`, `createsCycle(play, edge)` (refus à la pose) et `meetsOwnPass`.
- Pour C3 : codes à traduire dans `ui/strings.ts` : `glueCycle`, `glueTargetUnreached`, `glueStartedLate` (`params.late`), `glueArrivesLate` (`params.late`), `ballSlowerThanReceiver` ; `runNotContinued` a `params.option`, le libellé de l'option.
- Pour C4 : `src/v5/engine/compile.bench.ts` importe la v4 : retirer ce côté à la bascule, avec les imports `model/phaseTree`, `model/types` et `test/builders`. `glue.test`, `launch.test`, `cut.test`, `profileCount.test` et `syncGraph.test` n'importent que ce qui reste.

`render` et `renderSchematic` sur la fenêtre de B1. Lecteur : `transport.ts` porté sur les instants de la ligne, sauts au bord de bloc voisin (D-146), arrêt à l'embranchement gardé. GIF : plan des images, reprise à l'instant de l'embranchement, bornée à la durée (D-153), cartons d'option sans préfixe. PDF : une vignette par ligne, positions à `t = 0`, toutes les actions de la ligne en plein, légende : options de la ligne. Images régénérées et comparées à la référence v4 (PIEGES).

### Étape C2

Lecture : SPEC 6.2, 6.3, 5.8 (Édition), 5.3 (dernier geste) ; `editor/commands.ts`, `tools/runTool.ts`, `hitTest.ts`, `transform.ts`, `presets.ts`, `placementMode.ts`.

Reçu de l'étape C1 :
- `render/renderSchematic.ts` : `drawSchematic` prend un `WindowSchematic` ; `renderSchematic(ctx, play, line, t, viewport, theme, settings, caches, options)`. Pour les tests de sélection, `windowSchematic` : `runs`, `relays`, `passes`, `kicks`, `breakdowns`, `earlier*`.
- `render/overlay.ts` : `syncLinks` devient `glueLinks` (`{ from, to }`, sans cible nulle), à remplir depuis `WindowSchematic.glueLinks` en écartant `to === null`.

Commandes sur le tableau plat : `setStart`, `setGlue` (refus : cycle, propre bloc, hors ligne), `removeGlue` (fige la valeur calculée), `setKeep`, `setOffset`. Suppression d'une cible ou d'un point : fige, avec message. Allure choisie : le dernier geste gagne (5.3). Outils 6.2 : course au curseur, collée si le curseur est sur la fin de la précédente ; curseur pendant une course : repli de 4.3 (D-144) ; passe et jeu au pied au curseur ou collés à la prochaine réception, y compris la réception tracée ensuite ; regroupement collé. Branche d'une nouvelle action : celle de la ligne à `t`. Pas de commande de branche ni de séquence (D-142). `presetPreviewPlay` : branche racine seule (D-147).

### Étape C3

Lecture : SPEC 4.4, 3.5, 6.3 ; `io/readPlay.ts`, `draft.ts`, `readCache.ts`, `packFiles.ts`, `IdbStore.ts`, `FolderStore.ts`, `collection.ts` ; `state/editorActions.ts`, `editorStore.ts`, `playerStore.ts`, `selectors.ts`, `overlay.ts`, `session.ts`, `prefs.ts` ; `ui/strings.ts` (`state/` l'importe) ; PIEGES : Application.

Reçu de l'étape C2 :
- `src/v5/editor/commands.ts` : les commandes de pose prennent un `Cursor` (`{ line, t }`) au lieu d'un temps. `addRun`, `addPass`, `addKick`, `addBreakdown`, `proposeBreakdown`, `branchAtCursor`. `runAnchor(play, cursor, entityId, ctx)` donne l'`anchorOf` de l'outil Course. Rien à faire après une pose : plus de `markProlongedRun`.
- Gel, à annoncer par un message : `deleteActions`, `deletePlayers`, `deleteWaypoint` prennent `ctx` et renvoient `{ play, frozen }` ; `frozen > 0` : « bord figé » (5.8). `setGlue` renvoie `refused` : `self`, `line`, `cycle`, `invalid`. `removeGlue(play, ownerId, kind, ctx)`, `setKeep`, `setOffset`, `setStart` (sans effet si un collage calcule le départ).
- `updateRun` ne prend plus que `pace` et `durationOverride` ; `updatePass`, `updateKick`, `updateBreakdown` n'ont plus de `delay` ni de `release`. Commandes de temps retirées (D-142).
- `hitTest(schematic, ...)` prend un `WindowSchematic` et atteint les actions en grisé : la sélection d'une action hors de l'intervalle y amène le curseur (6.3) ; le `ball` est celui de l'instant `t`, déplaçable seulement à `t = 0`.
- `history.ts` copié dans `src/v5/editor` pour le type `Play` ; `selection`, `shortcuts`, `snap`, `spaceKey`, `tools/types` restent dans `src/editor` (pas de `Play`).
- `state/overlay.ts` : remplir `glueLinks` depuis `WindowSchematic.glueLinks`, en écartant `to === null` (reçu de C1).

Pour C4 : `src/editor/links.test.ts` disparaît, remplacé par `glues.test.ts` ; `src/editor/tools/*` et les tests de même nom sont remplacés à la bascule.

Reçu de l'étape C1 :
- `player/transport.ts` : `lineTiming(compiled)` donne `branchPoints`, `edges`, `duration` ; `tick(state, dt, timing)` et `backToBranchPoint(state, timing)` n'ont plus de `Play` ; `nextEdge`, `previousEdge` (D-146, D-167), `showLine` (D-142) ; `pauseBetweenPhases`, `phaseIndexAtTime`, `showPhase` retirés. `waitingAt` est la branche qui se divise. `player/framing.ts` copié aussi (`autoFrame`), absent du tableau des fichiers.
- Tests de `render/speeds.test.ts` à porter avec `state/overlay.ts`, car ils passent par `buildOverlay` : « draws a link when the linked run or its target is selected » et « halos the hovered action ». L'image `v5-editor-speeds-screen-landscape` construit sa surcouche à la main : y brancher `buildOverlay`.
- `engine/evaluate.ts` : `lineSchematic(play, line, settings, caches)`, une ligne entière à `t = 0`. `model/labels.ts` : `lineOptionsText`, `sceneHeaderLabel`.

- `io` : refus v4 et son message dans `readErrorMessage`. `collection.ts` refuse déjà d'écrire sur un fichier invalide ; `IdbStore.issues()` liste déjà une entrée invalide. `loadDraft` renvoie un statut « obsolète » au lieu de `null`.
- **Message de démarrage du brouillon (D-151)** : il dit que le brouillon d'une version antérieure sera remplacé à la prochaine modification. Pas de restauration, pas d'effacement.
- `state` : `selectedPhaseId` retiré, ligne et curseur dans le transport, édition à `t` (D-141), placements seulement à `t = 0`, pose d'un modèle au curseur ramené à `t = 0` (D-147), `playIssues`, sélecteurs de la liste (D-145). Les stores `src/v5/state` ne servent qu'aux tests jusqu'à C4.

### Étape C4

Lecture : SPEC 6.5 ; `ui/inspector/*`, `ui/phases/*`, `ui/player/TransportBar.tsx`, `ui/field/FieldCanvas.tsx`, `ui/App.tsx`, `ui/dialogs/Dialogs.tsx` ; PIEGES : Application, Playwright et OPFS.

Reçu de l'étape C1 : les images `v5-*` remplacent les images v4 de même nom, et le préfixe `v5-` disparaît des tests ; `vite.config.ts` pointe déjà vers `src/export/worker/emptyModule.ts`, qui reste à ce chemin après le `git mv`.

Reçu de l'étape C3 :
- Restent en place, non copiés : `io/` `conflicts`, `download`, `exportsFolder`, `fileNames`, `folderAccess`, `fs/`, `kv`, `ownWrites`, `readCache`, `readPreset`, `serialize`, `syncLog`, `trash` ; `state/` `exportStore`, `panelsStore`, `prefs` (y retirer `pauseBetweenPhases`), avec leurs tests ; `ui/format`. `src/state/links.test.ts` disparaît, remplacé par `glues.test.ts` et `cursor.test.ts`.
- `src/v5/ui/describe.test.ts` n'a plus les tests « rows of the list » : à reprendre avec `actionRows`. Les tests de surcouche de `render/speeds.test.ts` sont dans `state/cursor.test.ts`.
- Plus de `mode` (D-172) : `s.mode === 'play'` devient `s.transport.playing` dans `FieldCanvas`, `ActionList`, `TransportBar` ; le bouton de retour à l'embranchement ne dépend plus du mode (à l'arrêt après une option). `data-mode` du canevas : à calculer depuis `playing`, des e2e le lisent.
- Plus de `selectedPhaseId`, `selectPhase`, `showPhaseInPlayer`, `syncLineWithPlay`, `enterEditMode` (`pausePlayer`), `nextPhaseInPlayer` (`nextEdgeInPlayer`), `previousPhaseInPlayer` (`previousEdgeInPlayer`), `startSyncPick`, `cancelSyncPick`, dialogue `confirmDeletePhase`. Nouveaux : `showLineInPlayer`, `showActionInPlayer`, `currentCursor` ; le transport suit le store d'édition par abonnement, rien à brancher dans la session.
- `buildOverlay` prend `hoverSchematic` et `hoverOverlay` son schéma : `currentHoverSchematic()`, seulement si une action est survolée ; la scène à `t` en lecture, toute la ligne à l'arrêt (D-173), le choix n'est pas à refaire dans `FieldCanvas`. `schematic` : `currentSchematic()` ou `windowSchematic` à `t`.
- `selectors` : `lineReportOf` (ex `phaseReportOf`), `actionReportOf(play, line, id, settings)`, `actionsInProgress` (D-145), `lineChoices` (D-142), `runDuration` et `kickLanding` prennent la ligne ; `displayedPhaseId`, `labelParts`, `siblingsOf`, `phaseDurationAt`, `syncPickPrompt` retirés.
- `describe` : `glueTargetText`, `glueText`, `glueStatusText`, `glueFactorsText` à la place de `syncTargetText`, `rendezVousText`, `syncResultText` ; `actionDetails(play, row)` sans `link` ni `delay` ; `releaseModeText(play, report)`. `strings` : plus de `phaseLabel` ni `TEXT.syncPick` ; `NOTICES` : `placementAtStart`, `edgeFrozen`.
- Inspecteur : supprimer passe par `deleteSelection` (message de gel) ; `removeGlue` et les suppressions prennent `commandContext()`. `setGlue` n'a aucun appelant avant frise-2, donc pas de message de refus.

Bascule (section Stratégie), puis interface portée en place.
- Inspecteur : « Départ » (non modifiable si collé), cible et « Décoller », « Écart » ou « Temps de contrôle », « Le bloc glisse / s'étire ». « Durée » existante. Section « Temps » retirée.
- Barre de lecture : liste « Ligne » (D-142), « Bord précédent » et « Bord suivant » (D-146). « Pause entre les temps » retirée, `pauseBetweenPhases` retiré des préférences du poste. Arbre retiré. Liste des actions (D-145). Textes « temps » réécrits. Vignette de bibliothèque : `t = 0`, ligne par défaut.
- e2e : helpers portés ; `bundle`, `external-changes`, `sync-own-writes`, `presets`, `placement` verts ; les autres specs dans `e2e/a-porter/`, avec le `testIgnore` provisoire, listées dans « Écarts connus » d'ETAT.

Reçu de l'étape C4 :
- Helpers de `e2e/support/editorActions.ts` pas encore portés : `phaseButton`, `selectPhase`, `buildScenario`, `imageAtEndOf` (ils restent tant que `e2e/a-porter/` les importe).
- Noms à viser : `current-interval` (ex `current-phase`), région « Actions de la ligne » (ex « Actions du temps »), `src/ui/actions/` (ex `ui/phases`) ; inspecteur : champ « Départ » (ex « Délai », « Formation »), `block-start-computed`, `start-glue`, `end-glue`, `glue-factors`, `run-launch` (ex `launch-wait`), boutons « Décoller le départ » et « Décoller la fin ». « Finit lancée » n'est plus une case à cocher.
- À couvrir de bout en bout en C5 : le câblage du halo dans `FieldCanvas`, à l'arrêt et en lecture (D-173), dans `actions-list` ; `drawRun` depuis la fin de la course précédente (D-175), couvert en unitaire seulement. Vérifiés à l'écran en C4 par une spec jetable : collage, halo à l'arrêt, « Décoller », lecture et pause.

### Étape C4b

Raccord de deux courses collées, D-176, ajoutée après C4 par `/changement-spec` (SPEC 1.10, déjà écrite). Une course lancée arrive au plus à la vitesse admise de sa suite ; sa passe arrière anticipe ce freinage ; aucune géométrie ne change.

Lecture : SPEC 5.2, 5.3 (profil et solveur), 5.9 (troisième puce) ; D-176 ; `src/engine/` `profile`, `motion`, `launch`, `simulate` (`depart`), `glue` (`applyRunEnd`, `resolvePlay`), `timeline` ; PIEGES : Vitest et images de référence.

`npm run bench` **avant toute modification**, puis :

| Fichier | Changement |
|---|---|
| `profile.ts` | Extraire le calcul des plafonds de `buildProfile`. `ProfileInput.endSpeedCap` : si la course finit lancée, `v[last]` au plus cette borne, en m/s, non multipliée par k. Nouvelle `admissibleStartSpeed(input)` : passe arrière seule depuis la fin (0, ou la borne d'une course qui finit lancée), `k` jusqu'à 0, plafond du premier échantillon compris ; spline dégénérée : `Infinity`. Suite ralentie : avant la passe avant, si `startSpeed > 0`, relever les plafonds sur le préfixe : `r` part du départ, baisse à chaque intervalle par `sqrt(r² − 2·decel·ds)`, arrêt dès que `r <= plafond` ; sinon plafond = `min(r, plafond de virage)`, la cible étant ignorée. Commentaire de « The imposed start speed wins » à reprendre. |
| `motion.ts` | `RunSpec.arrivalCap` et `RunMotion.arrivalCap` (`null` hors lancée, relayeur compris), dans `specKey` ; `arrivalCapOf(run, from, direction, followers, context)`, récursive : pour chaque suite, `runCurve` depuis le dernier point et `endDirection` de la spline, `admissibleStartSpeed` avec ses vitesses enregistrées, `endsAtSpeed` et sa propre borne si elle a des suites ; le plus petit. `shapeWithLevers` transmet la borne. Sans cache de plus tant que le bench ne bouge pas de plus de 1 ms. |
| `launch.ts` | `followersOf(play, pairs)` : par course, les `RunAction` à lire, depuis `prolongedRuns`. En-tête à reprendre. |
| `simulate.ts` | `SimulationInput.followers` ; `depart` calcule `arrivalCap` après `launch`, si `spec.endsAtSpeed`. |
| `glue.ts` | `followers` dans `walkBranches` et `PlayResolution` ; `applyRunEnd` reprend `motion.arrivalCap` dans son `spec`. `resolvePlay` : seconde passe dès qu'une suite candidate de `prolongs` n'est pas dans `walk.prolongedBy`, avec `followers` réduit aux suites réelles ; toujours une seule. |
| `timeline.ts` | Transmet `resolution.followers`. |

Aucune migration : rien de cela n'est stocké, `schemaVersion` reste à 5. `spline.ts` et `runAlerts.ts` ne changent pas.

Tests nouveaux :
- `cut.test` : même tracé en une et deux courses, les 9 géométries, 38°, 45° et 90°, marche, trot et sprint : aucune alerte de freinage, freinage <= `motion.decel`, instants selon D-161 jusqu'à 45° ; à 90° selon les constantes de D-176, commentées `HYPOTHÈSE` (trot et sprint : coupe <= 0,3 s, arrivée <= 0,6 s ; marche : coupe <= 0,3 s, arrivée <= 1,2 s). Ligne droite : profil inchangé, durée au seuil de D-161. Trajectoire inchangée.
- `profile.test` : `admissibleStartSpeed` en ligne droite, sur suite courte (`sqrt(2·d·L)`), en virage, indépendante du départ ; `endSpeedCap` anticipé au freinage, sans effet au-dessus du plafond, non multiplié par k ; suite ralentie : freinage constant, plafond de virage tenu, course naturelle et départ à l'arrêt inchangés.
- `launch.test` : chaîne de trois ; plus petite vitesse sur deux options, tronc identique sur une grille d'instants, option tout droit qui réaccélère ; suite non réelle qui ne compte pas ; suite coupée par un regroupement ; changement d'allure (durée d'une seule course) ; profil de la précédente identique avec ou sans durée imposée sur la suite ; suite à durée imposée lente et rapide, durée tenue.
- `glue.test` : réception collée puis course en virage (D-152) : collages « ok », arrivée exacte, vitesse bornée ; rendez-vous sur la précédente au solveur, tenu.

À réécrire :
- `launch.test` : les attentes `runBrakeTooHigh` et 5,5 m/s (lignes 72 à 77, 91, 165, 174, 208, 260) ; « does not depend on the next run » devient : indépendante tant que la suite ne la limite pas.
- Attendus chiffrés selon `npm run check` (`editor/glues.test`, `render.test`). Images de référence : si elles bougent, `UPDATE_SNAPSHOTS=1` et comparaison à `HEAD` (PIEGES).
- `profileCount.test` : plafonds inchangés, `admissibleStartSpeed` n'est pas un profil construit.

Fin : suite complète ; `npm run bench` après, les deux chiffres dans ETAT ; au-delà de 33 ms (D-150), arrêt et question ; `/fin-etape`. Pas d'essai dans le navigateur : `cut.test` couvre le cas.

Repères mesurés au prototype, à retrouver : freinage partout à 4 m/s² ; à 90°, coupe 0,27 s, arrivée 0,54 s au trot et au sprint, 1,17 s à la marche ; scènes de référence : restent 5,5, 6,2, 13,3, 42,7 et 44,8 m/s², tous au levier 2, durées inchangées à 0,01 s près, seconde passe non déclenchée ; option à 90° et option tout droit (20 m, puis 15 m ou 20 m) : 3,58 m/s dans les deux lignes.

### Étape C4c

Correction ajoutée après C4b par `/correction-recette` du 07/11. Constat de la sonde de C4b, présent avant et après C4b : dans une chaîne de trois courses collées d'une joueuse (R1, R2 collée à la fin de R1, R3 collée à la fin de R2), si R1 s'allonge au-delà du `start` enregistré de R3, R3 part à 23,9 s au lieu de 14,3 s, sans lancée, collages « ok », aucune alerte. Contraire à 5.8 (instant du bord = instant de l'événement + `offset`) et à 5.2. Règle : D-177.

Cause, par lecture du code, à confirmer par la sonde. `unresolved` (`walkBranches`) retire des simulations les regroupements, passes et jeux au pied dont l'instant reste à résoudre, pas les courses. Pendant la résolution du bord de R3, R3 est encore à son `start` enregistré (s3), R2 déjà à la fin de R1 (e1 > s3) : `byReadiness` range R3 avant R2, `depart` bâtit R3 à la fin de R1, R2 attend la fin de R3 (repli de 4.3), et cette fin tardive est appliquée au bord de R3. À la compilation finale, plus de chevauchement : ni `runStartDelayed`, ni lancée (la seconde passe retire même celle de R2), statut « ok ».

Portée, une seule cause : un départ calculé par un collage lu à son `start` enregistré, jamais rafraîchi (D-169).
1. File de la joueuse (le constat) : une course en attente passe devant une course de la même joueuse et la décale, y compris celle qui porte sa propre cible ; dès deux courses (R1 collée à une réception déplacée plus tard, R2 collée à sa fin), ou pour une course qui glisse.
2. Course qui glisse : `applyRunEnd` lit sa durée, son point de départ et sa borne sur la course bâtie à son `start` périmé.
3. Passe qui glisse : le point fixe part du `start` enregistré.
4. Hors correction : l'ordre des bords où le graphe laisse le choix (D-162, `softOrder` et ordre des nœuds de `syncGraph.ts`) trie par `start` enregistré ; avec D-177, le ramassage d'un ballon au sol en dépend aussi. Mesuré ici, inscrit dans la question ouverte d'ETAT.

Lecture : SPEC 5.8, 4.3 (puce « Repli du moteur ») ; D-152, D-162, D-169, D-177 ; `src/engine/` `glue` (`unresolved`, `simulate`, `applyEdge`, `applyRunEnd`, `applyPassEnd`, `readTarget`), `simulate` (`byReadiness`, `waiting`, `depart`, `advanceOne`) ; `src/model/syncGraph.ts` (`softOrder`, pour la trace d'ordre) ; PIEGES : Vitest et images de référence.

`npm run bench` **avant toute modification**, puis la sonde, avant la correction :
- tests (c), (d) et cas 1 ci-dessous : rouges, aux valeurs du constat ; trace temporaire de l'ordre de `depart` dans la simulation du bord de R3 (scratchpad, non commitée). Mécanisme différent : arrêt et question ;
- cas de Q3, mesuré avant et après : R1 libre, R2 collée à la fin de R1 au `start` périmé au-delà de 10, R3 libre à 10 ; course d'une autre joueuse collée à la fin de R3 ;
- cas du ramassage, mesuré avant et après : course de poursuite collée à l'arrivée d'un jeu au pied, qui ramasse ; passe libre de la ramasseuse ; course d'une autre joueuse collée à l'arrivée de cette passe ; `start` de la poursuite à sa valeur de pose, puis à 0, puis au-delà de la ligne. S'il passe avant et casse après avec le `start` de pose : arrêt et question ; sinon, mesures dans la question ouverte d'ETAT ;
- résidu du bord droit d'une passe (qui glisse ou s'étire) sur `play-v5-frise.json` et le cas 5 : au-delà de 0,01 s, arrêt et question (le nombre d'itérations relève de D-037).

| Fichier | Changement |
|---|---|
| `glue.ts` | `unresolved` : toute action dont un collage calcule le départ (bord gauche, ou bord droit qui la fait glisser), `groupRun` excepté, donc les courses ; commentaire D-162, D-169, D-177. `applyEdge` inchangé (`comesBack`). `applyRunEnd`, branche qui glisse (ni `keep: 'start'` ni bord gauche collé), selon D-177 : course précédente, borne et point de départ lus sur `read`, où la course est absente ; course bâtie par `runMotion`, spec `{ levers: null, ignoreImposed: false, endsAtSpeed: launched.has(id), launch: null, arrivalCap }` (`arrivalCapOf` de `motion.ts`) ; puis `ok`, `late` (solveur, `ignoreImposed: true`) et `beforeStart` (course bâtie à son `start` enregistré) comme avant. Branche qui s'étire inchangée. `applyPassEnd`, branche qui glisse : `release` part de `wanted`. En-tête à reprendre. |

`simulate.ts` et `syncGraph.ts` ne changent pas. Aucune migration : `schemaVersion` reste à 5.

Tests nouveaux :
- `src/test/glueChecks.ts` : `expectGluesOnTarget(compiled)` (a), tout collage « ok » à son `targetT` à 1e-6 s près, instant du bord lu sur `blocks` (bord gauche ou droit) ou `branches` (embranchement), sauf bloc portant une alerte de repli (`runStartDelayed`, `startsBeforeBranch`, `sequenceOverlap`, `sequenceCrossesBranch`) ; bord droit d'une passe, qui glisse ou s'étire : 0,01 s, constante commentée `HYPOTHÈSE` (points fixes à 5 itérations de 5.4, D-037). `withComputedStarts(play, t)` (b) : `start` à `t` pour tout bloc dont un collage appliqué calcule le départ ; une séquence qui glisse décale aussi sa fin ; `branchAt` d'un embranchement collé à `t`.
- `glue.test`, describe « un départ calculé ne lit jamais son start enregistré (D-177) » : (a) sur toutes les lignes de `realisticRunsPlay()` et de `play-v5-frise.json` (lue comme dans `schema.test`) ; (b) exact, sur les mêmes lignes, `t = 0` puis durée de la plus longue ligne + 10 s, `toEqual` sur `motions`, `issues`, `passes`, `kicks`, `breakdowns` et statuts des collages. Cas nouveaux, chacun sous (a) et (b) : 1. chaîne de trois du constat, R3 à `start: 0` ; 2. deux courses, R1 collée à une réception déplacée plus tard, R2 collée à sa fin ; 3. course qui glisse jusqu'au départ d'une course de la même joueuse, elle-même collée ; 4. course qui glisse, pas la première de sa joueuse ; 5. passe qui glisse, passeuse en course. Attendus : départ à la fin de la précédente, `launch` non nul collée sans écart, aucune alerte.
- `launch.test` (d) : « goes through a chain of three » avec `start: 0` sur la troisième, attentes inchangées.
- `editor/glues.test` (c), dans « a glued edge follows its target » : trois courses d'une joueuse collées par `setGlue` (`start` enregistrés à la pose), puis `moveWaypoint` sur R1 au-delà du `start` enregistré de R3 ; R3 à la fin de R2, R2 et R3 lancées, aucune alerte, (a).

À réécrire : l'entrée de C4b de PIEGES (Vitest), selon D-177 : le `start` enregistré d'un départ calculé n'entre plus dans la résolution ; un test de chaîne exige quand même `launch` non nul et (a), une chaîne rompue passant sans alerte.

À surveiller : `profileCount.test`, plafonds tenus, sinon arrêt et question ; attendus chiffrés et images de référence : si elles bougent, `UPDATE_SNAPSHOTS=1`, comparaison à `HEAD`, chaque écart expliqué par D-177. Si (a) ou (b) échoue sur une fixture pour une autre cause (ordre des bords, autre défaut) : arrêt et question, avec la trace de l'ordre des bords.

Fin : suite complète ; `npm run bench` après, les deux chiffres dans ETAT ; au-delà de 16 ms, arrêt et question ; `/fin-etape` : question de la chaîne retirée d'ETAT, question de l'ordre des bords gardée avec ses mesures, « Bloc suivant : C5 ». Pas d'essai dans le navigateur : (c) reproduit le chemin de l'éditeur.

### Étape C5

Lecture : `e2e/a-porter/*`, `e2e/support/*` ; PIEGES : Playwright et OPFS.

- e2e selon D-148. Scénario à options : import de `options.combi.json` ; `buildScenario` trace une ligne sans option.
- Réécrits : `folder`, `degraded`, `export-gif`, `export-pdf`, `export.firefox`, `breakdown-kick` (« Bord suivant » à la place de « Ajouter un temps »), `actions-list`, `interface` et `field-stability` (liste « Ligne » à la place de l'arbre), `space` (`.phase-node` remplacé), `run-speeds`.
- Reportés à frise-2, inscrits dans ETAT : « Caler sur… » de `run-speeds`, partie arbre et création d'option de `interface` et `field-stability`.
- Refus v4 en e2e, Chromium et Firefox (tableau de la section Tests).
- `e2e/a-porter/` vidé et supprimé, `testIgnore` retiré, ligne d'« Écarts connus » retirée. Suite complète sur Chromium et Firefox. Le lot s'arrête là ; `/fin-lot` est lancé par l'utilisateur.

## Tests

**Annoncés par la section 7 de `frise-spec.md` :**

| Test | Bloc | Fichier |
|---|---|---|
| Tronc identique pour tout `t` avant l'embranchement, sur une grille d'instants, toutes lignes | B1, puis B2 | `trunk.test` |
| D-139 Q1 (course du tronc prolongée par une partie des options) et D-139 Q2 (passe en vol) | B2, B1 | `trunk.test`, `launch.test` |
| Chevauchements : courses, séquences, participante d'un regroupement, avec l'alerte | B1 | `overlap.test` |
| Cycles : collages, graphe, ignorés dans un fichier, refusés à la pose ; pas de faux cycle après une réception collée (D-152) | B2, C2 | `syncGraph.test`, `glue.test`, `commands` |
| Lancée : collée sans écart, écart positif, partie à sa borne, arrêtée par un regroupement | B2 | `launch.test` |
| Déterminisme : deux compilations, même JSON canonique | B2 | `evaluate.test` |
| Temps de compilation : bench hors CI, nombre de profils plafonné en CI, sans horloge (D-150) | B2 | `compile.bench`, `profileCount.test` |
| Écart au point de coupe, D-139 Q4 (D-161, qui remplace D-149) : virage jusqu'à 45°, trajectoire <= 5 % de la longueur, instant au point de coupe <= 0,25 s, à l'arrivée <= 0,4 s ; ligne droite, <= 0,01 m et 0,03 s | B2 | `cut.test` |
| Raccord (D-176) : aucune alerte de freinage à 38°, 45° et 90° ; à 90°, trot et sprint, coupe <= 0,3 s et arrivée <= 0,6 s ; marche, coupe <= 0,3 s et arrivée <= 1,2 s ; ligne droite inchangée ; vitesse admise, chaîne, options, solveur, regroupement, seconde passe | C4b | `cut.test`, `profile.test`, `launch.test`, `glue.test` |

**Refus de v1 à v4, sans écriture (contrainte 6) :**

| Cas | Unitaire (C3, Vitest) | e2e (C5) |
|---|---|---|
| `readPlayData` v0 à v4 | code `obsoleteVersion`, objets écrits dans le test | |
| Dossier | `FolderStore` sur `memoryFs` : signalé, octets identiques, ni écriture ni déplacement, écriture refusée sur le même nom | **Chromium** (OPFS) : message affiché, fichier identique après Ctrl+S d'une autre combinaison, rien dans `_corbeille/` |
| Bibliothèque du mode dégradé | `IdbStore` sur `memoryKv` : listée refusée, texte identique | **Firefox** : IndexedDB préparé avant le chargement, message, entrée identique |
| Brouillon | `loadDraft` : statut obsolète, pas de restauration, texte identique | **Firefox** : message au démarrage, qui annonce le remplacement à la prochaine modification, aucun dialogue de restauration |
| Cache de lecture | même refus depuis le texte en cache, entrée non convertie | |
| Import `.combipack.json` | mélange v4 et v5 : v5 importée, v4 en échec, aucune écriture pour elle | **Chromium et Firefox** : message, seules les v5 apparaissent |

**Portés de la v4** : `branches` (depuis `phaseTree`), `labels`, `schema`, `validate`, `syncGraph`, moteur (`runs`, `evaluate`, `breakdown`, `kick`, `forwardPass`, `actionReport`, `sync` vers `glue`), rendu et images, exports, éditeur, état, `io`. Fixture : `play-v5-frise.json` égale à `friseFixturePlay()`. Supprimés avec leur objet : `migrations.test` sur v1 à v4, `phaseTree.test`, `phaseLayout.test`.

## Vérification de bout en bout

À chaque étape : `/fin-etape` (`npm run check`, plus e2e dès C4). Après B2 : `npm run bench`, chiffres dans ETAT. Après C5 : `npm run check`, `npm run test:e2e` sur les deux navigateurs, CI verte sur la branche ; dans le navigateur, créer une combinaison, tracer deux courses collées et une passe à la réception, lire, recharger, exporter un GIF et un PDF, ouvrir un dossier contenant un fichier v4.

## Questions et réponses

Posées dans le plan, réponses du 04/11 : recommandation retenue partout. Alternatives écartées : dans les décisions.
- Q1 (D-140). Garder le check vert : **v5 dans `src/v5/`, bascule en C4**.
- Q2 (D-141). Terrain à l'arrêt : **SPEC 6.3 dès frise-1**, exception assumée à la règle 4 de `CLAUDE.md`.
- Q3 (D-142). Ligne, embranchement, option, séquence : **liste « Ligne » dans la barre de lecture, masquée s'il n'y a qu'une ligne ; branches et séquences lues depuis un fichier importé, créées en frise-2**.
- Q4 (D-143). Collage : **posé par les outils, réglé dans l'inspecteur** ; pas de pose à la main avant frise-2, « Caler sur… » disparaît.
- Q5 (D-144). « Couper la course ici » et coupe à la pose : **frise-2** ; le test D-139 Q4 construit ses deux courses à la main.
- Q6 (D-145). Liste des actions : **toute la ligne affichée**, triée par départ, instants absolus, barres sur la durée de la ligne, action en cours au curseur marquée.
- Q7 (D-146). Boutons du lecteur : **« Bord précédent » et « Bord suivant », « Pause entre les temps » retirée**. Précision : décision provisoire, remplacée en frise-3, et son entrée le dit.
- Q8 (D-147). Nouvelle combinaison depuis un modèle : **branche racine seule, 6.6 inchangée, curseur ramené à `t = 0` à la pose**.
- Q9 (D-148). e2e passant par un « Temps 2 » : **réécrits, reports limités à ce qui dépend de frise-2** (Étape C5).
- Q10 (D-149). Tolérance du test de coupe : **seuils a priori** (section Tests). Précision : constantes du test, commentées `HYPOTHÈSE` ; dépassement : arrêt et mesure donnée à l'utilisateur.
- Q11 (D-150). Temps de compilation : **`npm run bench` hors CI, cible 16 ms par mouvement, arrêt au-delà de 33 ms ; en CI, nombre de profils plafonné, sans horloge**.
- Q12 (D-151). Combinaison v4 dans IndexedDB : **signalée et laissée**. Précision : le message de démarrage dit que le brouillon d'une version antérieure sera remplacé à la prochaine modification.
- Q13 (D-152). Faux cycles de SPEC 4.3 : **écarter les courses qui dépendent elles-mêmes de l'arrivée**. Précision : décision « non intégrée (4.3) ».
- Q14 (D-153). Embranchement après la dernière action : **lettre de 5.1 en frise-1, reprise du GIF bornée à la durée**. Précision : inscrite dans « Questions ouvertes » d'ETAT, à reposer au `/nouveau-lot frise-2`.

Corrections de l'utilisateur à la validation, intégrées ci-dessus :
1. `e2e/a-porter/` : `testDir: 'e2e'` parcourt les sous-dossiers, ces specs tourneraient encore. `testIgnore` provisoire dans `playwright.config.ts` en C4, retiré en C5, inscrit dans « Écarts connus » d'ETAT.
2. `docs/ARCHITECTURE.md` retiré de C4 : `/fin-lot` le met à jour.
3. Specs e2e de refus v4 (Chromium, Firefox) déplacées de C4 à C5.
4. `realisticRunsPlay()` : même nombre d'actions que la v4, plus une course par `at` coupé (deux dans la fixture actuelle). Le bench le précise à côté des mesures dans ETAT.

Ajouté à l'étape 0, pour rester cohérent avec la correction 1 et « aucune exclusion » : les specs de `e2e/a-porter/` restent compilées et lintées, imports ajustés au déplacement (section Stratégie).

Étape C4b, `/changement-spec` du 06/11, questions propres à ce changement, toutes dans D-176 : Q1 seuils à 90° ; Q2 suite ralentie par le solveur ; Q3 changement d'allure ; Q4 options ; Q5 solveur et facteur k ; Q6 regroupement et écart positif ; Q7 seconde passe.

Étape C4c, `/correction-recette` du 07/11, réponses d'Antoine du 07/11, recommandation retenue partout, toutes dans D-177 :
- Q1. Course dont le départ reste à résoudre : **D-169 étendue aux courses**. Précision : le ramassage ajouté aux conséquences et mesuré par la sonde.
- Q2. Course qui glisse : **précédente = dernière course de la joueuse présente dans la simulation qui finit au plus tard à `wanted` (instant de la cible du bord droit) ; borne = plus grand de 0, de l'embranchement et de sa fin ; départ depuis la position à la borne**. Point fixe d'une passe qui glisse : part de `wanted`. Précision : (a) tolère 0,01 s (`HYPOTHÈSE`) pour le bord droit d'une passe seulement, (b) reste exact ; au-delà, arrêt et question (D-037).
- Q3. Ordre des bords où le graphe laisse le choix (D-162) : **inchangé en C4c** ; cas de Q3 et du ramassage mesurés, inscrits dans la question ouverte d'ETAT, à trancher par `/changement-spec` (5.8, Résolution).

## Étapes

- **Bloc 0**
  - [x] **Étape 0 : branche, plan archivé, plan du lot, décisions, ETAT.** (commit « Étape 0 : plan du lot frise-1, D-140 à D-153, ETAT », après `00bd163`)
- **Bloc A**
  - [x] **Étape A : types, builders, schéma, refus, branches, validation, fixture v5** (`src/v5/model`, `src/v5/test`). (commit « Étape A : modèle v5, builders, refus des versions antérieures, fixture », après `319b010`)
- **Bloc B1**
  - [x] **Étape B1 : compilation de ligne continue, sans collage** (`src/v5/engine`). (commit « Étape B1 : compilation de ligne continue, sans collage », après `191e2ba`)
- **Bloc B2**
  - [x] **Étape B2 : collages, graphe, lancée, D-139 Q1 et Q4, mesures dans ETAT.** (commit « Étape B2 : collages, graphe, lancée, D-139 Q1 et Q4, mesures », après `88af1c7`)
- **Bloc C1**
  - [x] **Étape C1 : rendu, lecteur, exports** (`src/v5/render`, `player`, `export`). (commit « Étape C1 : rendu, lecteur et exports sur la frise », après `4aad4e6`)
- **Bloc C2**
  - [x] **Étape C2 : commandes et outils de l'éditeur** (`src/v5/editor`). (commit « Étape C2 : commandes et outils de l'éditeur sur la frise », après `97c3d60` ; retouches « Étape C2 : lâcher collé à la réception sous le curseur (D-171) », après `e33e1c5`, et « Étape C2 : formation collée à la réception sous le curseur (D-171) », après `ed1d372`)
- **Bloc C3**
  - [x] **Étape C3 : io, refus v1 à v4 en unitaire, état** (`src/v5/io`, `state`). (commit « Étape C3 : stockage, refus des versions antérieures et état sur la frise », après `3395d65` ; retouche « Étape C3 : halo de survol sur la scène pendant la lecture (D-173) », après `d50bc46`)
- **Bloc C4**
  - [x] **Étape C4 : bascule, suppressions, interface, e2e non portés mis de côté** (`testIgnore` provisoire). (commit « Étape C4 : bascule sur la frise, interface portée, e2e non portés mis de côté », après `8ce5af4`)
- **Bloc C4b**
  - [x] **Étape C4b : raccord de deux courses collées, vitesse admise de la suite (D-176, SPEC 1.10 déjà écrite).** (commit « Étape C4b : raccord de deux courses collées, vitesse admise de la suite (D-176) », après `0691291`)
- **Bloc C4c**
  - [ ] **Étape C4c : départ calculé par un collage absent des simulations tant qu'il n'est pas résolu (D-177), invariant et indépendance des `start` enregistrés.**
- **Bloc C5**
  - [ ] **Étape C5 : e2e réécrits ou reportés, refus v1 à v4 en e2e, `e2e/a-porter/` et `testIgnore` retirés.**
- [ ] **`/fin-lot`**, lancé par l'utilisateur : SPEC, ARCHITECTURE, RECETTE, README, ETAT, PR vers `main`.
