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

Commandes sur le tableau plat : `setStart`, `setGlue` (refus : cycle, propre bloc, hors ligne), `removeGlue` (fige la valeur calculée), `setKeep`, `setOffset`. Suppression d'une cible ou d'un point : fige, avec message. Allure choisie : le dernier geste gagne (5.3). Outils 6.2 : course au curseur, collée si le curseur est sur la fin de la précédente ; curseur pendant une course : repli de 4.3 (D-144) ; passe et jeu au pied au curseur ou collés à la prochaine réception, y compris la réception tracée ensuite ; regroupement collé. Branche d'une nouvelle action : celle de la ligne à `t`. Pas de commande de branche ni de séquence (D-142). `presetPreviewPlay` : branche racine seule (D-147).

### Étape C3

Lecture : SPEC 4.4, 3.5, 6.3 ; `io/readPlay.ts`, `draft.ts`, `readCache.ts`, `packFiles.ts`, `IdbStore.ts`, `FolderStore.ts`, `collection.ts` ; `state/editorActions.ts`, `editorStore.ts`, `playerStore.ts`, `selectors.ts`, `overlay.ts`, `session.ts`, `prefs.ts` ; `ui/strings.ts` (`state/` l'importe) ; PIEGES : Application.

- `io` : refus v4 et son message dans `readErrorMessage`. `collection.ts` refuse déjà d'écrire sur un fichier invalide ; `IdbStore.issues()` liste déjà une entrée invalide. `loadDraft` renvoie un statut « obsolète » au lieu de `null`.
- **Message de démarrage du brouillon (D-151)** : il dit que le brouillon d'une version antérieure sera remplacé à la prochaine modification. Pas de restauration, pas d'effacement.
- `state` : `selectedPhaseId` retiré, ligne et curseur dans le transport, édition à `t` (D-141), placements seulement à `t = 0`, pose d'un modèle au curseur ramené à `t = 0` (D-147), `playIssues`, sélecteurs de la liste (D-145). Les stores `src/v5/state` ne servent qu'aux tests jusqu'à C4.

### Étape C4

Lecture : SPEC 6.5 ; `ui/inspector/*`, `ui/phases/*`, `ui/player/TransportBar.tsx`, `ui/field/FieldCanvas.tsx`, `ui/App.tsx`, `ui/dialogs/Dialogs.tsx` ; PIEGES : Application, Playwright et OPFS.

Bascule (section Stratégie), puis interface portée en place.
- Inspecteur : « Départ » (non modifiable si collé), cible et « Décoller », « Écart » ou « Temps de contrôle », « Le bloc glisse / s'étire ». « Durée » existante. Section « Temps » retirée.
- Barre de lecture : liste « Ligne » (D-142), « Bord précédent » et « Bord suivant » (D-146). « Pause entre les temps » retirée, `pauseBetweenPhases` retiré des préférences du poste. Arbre retiré. Liste des actions (D-145). Textes « temps » réécrits. Vignette de bibliothèque : `t = 0`, ligne par défaut.
- e2e : helpers portés ; `bundle`, `external-changes`, `sync-own-writes`, `presets`, `placement` verts ; les autres specs dans `e2e/a-porter/`, avec le `testIgnore` provisoire, listées dans « Écarts connus » d'ETAT.

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
  - [ ] **Étape C1 : rendu, lecteur, exports** (`src/v5/render`, `player`, `export`).
- **Bloc C2**
  - [ ] **Étape C2 : commandes et outils de l'éditeur** (`src/v5/editor`).
- **Bloc C3**
  - [ ] **Étape C3 : io, refus v1 à v4 en unitaire, état** (`src/v5/io`, `state`).
- **Bloc C4**
  - [ ] **Étape C4 : bascule, suppressions, interface, e2e non portés mis de côté** (`testIgnore` provisoire).
- **Bloc C5**
  - [ ] **Étape C5 : e2e réécrits ou reportés, refus v1 à v4 en e2e, `e2e/a-porter/` et `testIgnore` retirés.**
- [ ] **`/fin-lot`**, lancé par l'utilisateur : SPEC, ARCHITECTURE, RECETTE, README, ETAT, PR vers `main`.
