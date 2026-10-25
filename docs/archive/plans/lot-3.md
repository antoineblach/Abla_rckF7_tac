# Plan du lot 3 : mise en place

Plan validé le 16 octobre 2026, avec les réponses aux questions Q1 à Q19 (section 12). Deux réponses modifient le plan proposé : Q11 (aucune alerte d'en-avant dans les exports) et Q19 (raccourcis J et G). Le texte ci-dessous en tient compte. Décisions détaillées dans `docs/decisions/`, entrées D-078 à D-094.
Suivi : une case par étape, cochée dans le commit qui termine l'étape, avec le hash court de ce commit (ou du commit précédent quand le hash du commit lui-même ne peut pas y figurer). L'état courant détaillé est dans `docs/ETAT.md`.
Consigne de l'utilisateur : enchaîner les étapes sans attendre ; ne s'arrêter que sur une question bloquante.

## Contexte

Le lot 3 réalise les sections 10 et 5.7 de la spécification :
- modèles de placement ;
- déplacement et symétrie d'une combinaison entière ;
- regroupements (ruck et maul) ;
- jeu au pied ;
- contrôle d'en-avant.

État vérifié avant de commencer :
- `main` est à `855a804` (fusion de la PR #3 le 16/10), arbre propre, CI verte sur `main`, déploiement fait.
- **Écart** : `docs/ETAT.md` indique la branche `lot-2` en cours et la PR #3 ouverte. Elle est fusionnée. Je le corrige dans le premier commit du lot.
- **À noter** : le lot 2 n'est pas encore validé au sens de `RECETTE.md`. Ses 3 vérifications manuelles et la séance d'usage libre sont en attente, comme les 2 vérifications Drive du lot 1. Je prépare le lot 3 à ta demande. Une correction du lot 2 après recette se fera sur une branche à part (`lot-2-corrections`), inscrite dans « Chantiers en parallèle ».
- Aucune nouvelle dépendance.

## 1. Modèle : schemaVersion, migrations, fixtures

**Combinaison : `schemaVersion` 1 vers 2.**
- Le schéma v2 accepte `KickAction` et `BreakdownAction` (objets stricts, types de SPEC 10.3 et 10.4).
  - `duration` > 0 ; `flightTime` > 0 et facultatif ; `delay` >= 0.
  - `contest` facultatif.
- Il rejette toujours :
  - `GroupRunAction`, le matériel, les zones et les annotations (lot 5) ;
  - `defenseSettings` (lot 4).
- Migration v1 vers v2 : contenu identique, `schemaVersion: 2`. Elle est enregistrée dans la table `STEPS` de `model/migrations.ts`, avec `CURRENT_SCHEMA_VERSION = 2`.
- Le schéma v1 est figé dans `model/schemaV1.ts` ; `model/schema.ts` devient la v2.
- Les types `KickAction` et `BreakdownAction` passent de `declared.ts` à `types.ts`.
- **Lecture** : un fichier v1 est migré en mémoire et n'est réécrit en v2 qu'au prochain enregistrement (comme `reglages.json`, D-072).
  - Un PC qui n'a pas rechargé la page verra un fichier v2 comme « créé par une version plus récente » (D-024), sans le modifier.
  - Il faut donc recharger la page sur les deux PC après le déploiement (README).
- **Ballon au sol au départ** (`setup.ballPosition`, D-007) : déjà dans le schéma v1, il devient éditable (Q8).
- **Fixtures** :
  - `play-v1-7v7-options.json`, figée : test de migration v1 vers v2 ;
  - nouvelle `play-v2-lot3.json`, figée pour les migrations des lots 4 et 5 : ruck, maul, jeu au pied vers une receveuse et vers un point, ballon au sol, passe en avant.

**Modèle de placement : nouveau fichier `PlacementPreset` v1.**
- `modeles/<nom-court>--<id>.preset.json`, type de SPEC 10.1 inchangé.
- Schéma zod strict, lecture versionnée (fichier invalide ou futur signalé, jamais modifié) et nom de fichier, dans `model/preset.ts`.
- Fixture `preset-v1-touche.json`.

**`reglages.json`** reste en v2 (aucun nouveau réglage, Q11).

## 2. Regroupements et jeu au pied dans `evaluate`

### 2.1 Mouvements

Aujourd'hui, `compilePhase` (`engine/timeline.ts`) compile une course au plus par joueuse, puis simule la possession passe par passe.

Deux extensions :
- `RunMotion` reçoit :
  - `until?` : l'instant absolu où un regroupement arrête la course ;
  - `source` : `'run'` ou `'relay'`.
- Le déplacement du relayeur est un mouvement de plus : un segment droit, c'est-à-dire une spline à deux points (D-040).
- `positionInPhase` prend le dernier mouvement commencé à `t` (la course arrêtée, puis le relais) ; il ne change pas pour les joueuses sans regroupement.

**Continuité** : les positions de fin de temps sont échantillonnées sur ces mouvements, comme aujourd'hui, et les temps enfants partent de là. La règle 5.2 ne change pas (premier point d'une course non stocké, options héritant du même tronc).

### 2.2 Boucle d'événements du ballon

Elle remplace la boucle des passes de `compilePhase`.
- **Événements** du temps, triés par instant puis par ordre du tableau : lâchers de passe, frappes au pied, formations de regroupement.
- **Avant chaque événement à `te`, transitions résolues jusqu'à `te`** :
  - arrivée d'un vol : porté par la receveuse, ou au sol au point visé ;
  - fin d'un regroupement : porté par le relayeur ;
  - ramassage d'un ballon au sol.
- **Passe** : règles actuelles (D-013), plus le contrôle d'en-avant (section 3).
- **Jeu au pied** :
  - la frappeuse doit porter le ballon, sinon le jeu au pied est ignoré et signalé (comme une passe) ;
  - le vol dure `flightTime`, ou par défaut 3,0 s (renvoi) et 3,5 s (long) ;
  - vers une receveuse : arrivée sur sa position évaluée à `release + flightTime` ;
  - vers un point : ballon au sol au point, à l'arrivée.
- **Regroupement** :
  - **Validité** : la plaquée doit porter le ballon à la formation `tf` (ni vol en cours, ni ballon au sol, ni autre regroupement en cours). Sinon, il est ignoré entièrement et signalé (Q4).
  - **Courses** : celles de la plaquée, du soutien et du relayeur s'arrêtent à `tf` (`until`), avec une alerte si une partie de course est perdue.
  - **Ballon** : point `P` = position de la plaquée à `tf` ; état `inBreakdown(P)` de `tf` à `tf + duration`.
  - **Relayeur** : segment droit vers `R = P − 1 m × sens d'attaque de son équipe`, à l'allure sprint des réglages (Q3).
  - **Ligne d'avantage** : changement `{ t: tf, x: P.x }`.
- **Ramassage** :
  - recherche du premier instant où une joueuse est à moins de 1 m du ballon au sol, entre son arrivée au sol et l'événement suivant (ou la fin du temps) ;
  - échantillonnage à pas fixe de 1/100 s, puis bissection ;
  - égalité : ordre des entités ;
  - un ballon toujours au sol à la fin du temps passe au temps suivant (`holderAtEnd`) ;
  - même règle pour un ballon au sol au départ, à partir de `t = 0` (Q8).
- **Fin du temps** : maximum de :
  - la fin des courses appliquées (arrêtées comprises) et du relais ;
  - l'arrivée des passes et des jeux au pied ;
  - `tf + duration` de chaque regroupement appliqué.

  Le temps suivant commence donc à la sortie de balle quand le regroupement est la dernière action (SPEC 10.3).

**Pourquoi l'ordre chronologique suffit, sans itération** : un regroupement valide exige que la plaquée tienne le ballon, donc aucun vol n'est en cours. Il ne modifie les mouvements qu'après `tf`. Tout ce qui a été calculé avant (arrivées, ramassages) ne dépend que des positions avant `tf`.

**Pureté** : aucune horloge, aucun aléa. Le pas de recherche est dans `defaults.ts`. Le cache reste indexé par le hachage de (combinaison, ligne, réglages).

### 2.3 Sorties du moteur

| Structure | Ajouts |
|---|---|
| `CompiledPhase` | segments du ballon `ball: BallSegment[]` (porté, en vol de passe ou de pied, au sol, en regroupement) ; jeux au pied et regroupements compilés |
| `CompiledLine` | `gainLine: { t, x }[]` (premier élément à `t = 0`) |
| `SceneState` | `gainLineX` à `t` ; `kickTraces` ; `breakdowns` actifs à `t` ; `PassTrace.forward` ; `BallState.inFlight` avec `kind: 'pass' \| 'kick'` et `lift` (0 à 1, parabole) |
| `PhaseSchematic` | jeux au pied, regroupements, déplacements du relayeur, `SchematicPass.forward`, partie ignorée des courses arrêtées ; `gainLineX` en vigueur au début du temps (Q7) |
| `lineBounds` | points de frappe et d'arrivée, ballon au sol, relais (cadrage des GIF, des PDF et de « Zone utile ») |

Les actions du lot 5 restent ignorées et signalées (`unsupportedAction`).

**Nouvelles alertes**, dans `model/issues.ts` et `ui/strings.ts` :

| Code | Gravité |
|---|---|
| `kickerWithoutBall` | erreur |
| `tackledWithoutBall` | erreur |
| `runCutByBreakdown` | avertissement |
| `relayerLate` | avertissement |
| `forwardPass` | avertissement |

`simultaneousPass` couvre aussi un jeu au pied lâché au même instant qu'une passe. En validation métier :
- participantes inexistantes ou en double, soutien ou relayeur d'une autre équipe que la plaquée ;
- cible d'un jeu au pied inexistante, ou frappeuse qui se vise elle-même.

## 3. Contrôle d'en-avant (5.7)

- **Calcul**, au lâcher, dans la boucle d'événements :
  - vitesse du ballon = (arrivée − départ) / durée de vol ;
  - vitesse de la passeuse = dérivée à gauche de sa trajectoire (la vitesse qu'elle avait en lâchant), lue sur le temps courant ou sur la fin du temps parent pour un lâcher au tout début d'un temps ;
  - la passe est marquée « en avant probable » si la composante de la différence dans le sens d'attaque de l'équipe de la passeuse dépasse 0,5 m/s (`FORWARD_PASS_THRESHOLD`, HYPOTHÈSE, déjà en SPEC 14).
- **Affichage** :
  - icône au milieu de la passe (Q9) ;
  - alerte « En-avant probable » dans la section Passe de l'inspecteur et dans « Alertes » ;
  - calque « En-avant » du lecteur ; l'éditeur la montre toujours (Q10) ;
  - **jamais dans les exports**, ni GIF ni PDF, quel que soit le calque (Q11 : aide pour le coach, pas information pour les joueuses ; exception à D-068).
- Aide visuelle seulement : la passe s'exécute.

## 4. Interfaces de pose

### 4.1 Appliquer un modèle (ancre, aimantation, côté ouvert)

**Lancement** : bibliothèque, onglet « Modèles », bouton « Appliquer ». Possible aussi depuis « Nouvelle combinaison » (Q17).

**Mode de pose** :
- des jetons fantômes suivent le curseur, à leurs positions transformées ;
- l'ancre est aimantée selon le type (Q13), toujours, indépendamment du bouton « Grille 1 m » :
  - mêlée, ruck, libre : grille de 1 m ;
  - touche : projetée sur la ligne de touche la plus proche, x sur la grille ; refusée à moins de 5 m d'une ligne de but (fantômes masqués, message, clic sans effet) ;
  - renvoi : centre de la médiane ou ligne des 22 m quand elles sont proches, sinon grille.
- **Bandeau en surimpression** (D-050) : « Cliquez le point d'ancrage », choix « Côté ouvert : Auto | Gauche | Droite » (absent pour la touche, Q14), « Échap pour annuler ».

**Clic** : application en une seule étape d'annulation. Le temps 1 est sélectionné.
- **Association** : par rôle (attaque = équipe qui attaque) et numéro. Les existantes sont déplacées, les manquantes créées (couleur d'équipe, défense manuelle), les autres inchangées.
- **Ballon** : selon le modèle, porteuse associée ou ballon au sol au point transformé ; un modèle sans ballon n'y touche pas.
- **Catégorie** mise à jour selon le type (Q12).

**Repère local** (`editor/presets.ts`, pur) : `monde = ancre + (avant × d, côtéOuvert × s)`.
- `d = attackDirection(équipe qui attaque)`.
- `s = ±1` vers le côté ouvert :
  - par défaut, le côté le plus large depuis l'ancre ;
  - pour la touche, vers l'intérieur du terrain.
- Combiner un modèle d'attaque puis un modèle de défense revient à deux applications, qui ne touchent chacune que leurs rôles.

### 4.2 Enregistrer et gérer un modèle

- **Onglet « Modèles »**, bouton « Enregistrer un modèle… » (combinaison ouverte). Le dialogue demande :
  - nom ;
  - type : Mêlée, Touche, Coup d'envoi/renvoi, Ruck, Libre ;
  - contenu : « Placement de départ entier » ou « Sélection (n joueuses) » ;
  - « Inclure le ballon » ;
  - côté ouvert.

  Puis clic de l'ancre, avec l'aimantation du type et un repère des axes « avant » et « côté ouvert ».
- **Liste** : vignette (le modèle posé à une ancre type sur un terrain par défaut, dessiné par `renderSchematic`), nom, type.
- **Actions** :
  - Appliquer, Renommer, Dupliquer, Supprimer (corbeille) ;
  - « Mettre à jour » : refait le geste d'enregistrement en gardant l'identifiant, le nom et le type.

### 4.3 Poser un regroupement (proposition du soutien et du relayeur)

- **Outil « Regroupement »** (bouton et raccourci G, Q19) : clic sur une joueuse qui a le ballon dans le temps affiché.
- **Instant de formation par défaut** : fin de sa course dans le temps, ou l'instant où elle reçoit le ballon s'il est plus tard.
- **Proposition** (Q6) :
  - soutien = coéquipière la plus proche de la plaquée à cet instant ;
  - relayeur = la deuxième ;
  - type ruck.
- **Refus avec message** si la joueuse n'a pas le ballon dans ce temps, ou si elle a moins de deux coéquipières.
- **Section « Regroupement » de l'inspecteur** :
  - type (Ruck, Maul) ;
  - plaquée ;
  - soutien et relayeur (listes des coéquipières) ;
  - délai, durée (3 s par défaut) ;
  - défense au regroupement : « Par défaut », « Garde » ou « Gratteur » (Q1) ;
  - alertes.

### 4.4 Jeu au pied, ballon au sol

- **Outil « Jeu au pied »** (bouton et raccourci J, Q19) :
  - clic sur la frappeuse, puis clic sur une joueuse (receveuse) ou sur le terrain (point, aimanté si la grille est active) ;
  - délai par défaut : l'instant où elle a le ballon ;
  - type par défaut : « Coup d'envoi/renvoi » si la catégorie est coup d'envoi/renvoi, sinon « Long/recentrage » ;
  - cliquer à nouveau sur la frappeuse annule.
- **Inspecteur** : type, cible (receveuse ou point x, y), délai, temps de vol (vide = défaut du type). Le point visé se déplace à la souris comme un point de passage.
- **Ballon au sol au départ** : « Poser le ballon au sol » dans la section Combinaison (à la place de la porteuse). Le ballon se déplace à la souris au temps 1, comme un placement de départ ; « Porteuse au départ » le reprend.
- **Suppression d'une joueuse** : elle supprime aussi les jeux au pied et les regroupements qui la citent (extension de D-014).

### 4.5 Déplacer, retourner une combinaison (Q16)

Deux commandes dans la section Combinaison :
- « Déplacer la combinaison » : deux clics (départ, arrivée, grille si active), avec les jetons de départ en fantôme ;
- « Retourner » : symétrie gauche-droite.

Fonctions pures dans `editor/transform.ts`. Elles s'appliquent :
- aux placements de départ ;
- au ballon au sol ;
- aux points de passage ;
- aux points visés au pied ;
- au cadre libre de la vue enregistrée.

## 5. Stockage des modèles

- **`FolderStore`** : l'index des combinaisons devient une collection générique (`io/collection.ts`), utilisée deux fois :
  - `combinaisons/` (`Play`, `upgradePlay`) ;
  - `modeles/` (`PlacementPreset`).

  La collection porte : relecture par date et taille confirmée par le contenu, fichier invalide ou futur signalé et jamais modifié, copies de conflit (même id), concurrence optimiste, renommage (nouveau fichier, ancien en corbeille), corbeille par copie vérifiée (`io/trash.ts`).
- **Structure** : `modeles/` est créé avec les autres dossiers (SPEC 8.2).
- **Cache de lecture** : ses clés portent le dossier ; l'ancien cache est ignoré (c'est un cache).
- **`LibraryStore`** : `listPresets`, `getPreset`, `putPreset(preset, { expected })` et `removePreset`. `Change` et `LibraryIssue` portent `collection: 'plays' | 'presets'`, et `resolveDuplicate` sert aux deux.
- **`IdbStore`** (mode navigateur) : clés `abla-rck7:preset:<id>`. La copie dans le dossier au premier choix d'un dossier (D-021) inclut les modèles.
- **Synchronisation** : la relecture (démarrage, focus, 30 s) couvre `modeles/`, et la liste se met à jour.
  - Une action sur un modèle changé sur l'autre PC depuis sa lecture est refusée, avec un message et une relecture (Q18).
  - Un doublon non résolu met le modèle en lecture seule (comme D-022).

## 6. Rendu et exports

**Nouvelles valeurs de thème**, dans les 4 thèmes de `defaults.ts`. Le type `Theme` les impose.
- Jeu au pied : tirets longs, épaisseur.
- Ombre : gris plein.
- Regroupement : couleur et épaisseur du contour.
- Icône d'en-avant : fond et signe.

Contraintes :
- Contraste fort : traits d'au moins 3 px.
- Impression N&B : gris seulement (tests existants étendus).

**`render` et `drawSchematic`** :
- **Jeu au pied** :
  - tirets longs du point de frappe au point d'arrivée (ou à la position courante pendant le vol), flèche à l'arrivée ;
  - petit cercle sur un point visé ;
  - pendant le vol, ballon grossi (jusqu'à 1,8, `KICK_APEX_SCALE`) et ombre au sol (Q9) ; `drawBall` reçoit un facteur d'échelle, l'ombre est une ellipse en Bézier pleine.
- **Regroupement** : contour et libellé (Q9), ballon dessiné juste derrière la plaquée, déplacement du relayeur dessiné comme une course.
- **Icône d'en-avant** selon le calque (Q10).

**Éditeur** :
- `hitTest` atteint la trace d'un jeu au pied, le repère d'un regroupement, le point visé et le ballon au sol.
- La surcouche dessine les aperçus des outils, les fantômes de pose et le repère de l'ancre.

**Exports** : ils réutilisent `render` et `renderSchematic`, donc aucun changement de structure.
- Le GIF reçoit les calques du lecteur (D-068), sauf « En-avant », toujours éteint (Q11).
- `drawSchematic` reçoit une option d'affichage de l'icône : oui dans l'éditeur, non dans le PDF et les vignettes de la bibliothèque.
- Le cadrage suit `lineBounds`.

**Calque « En-avant »** : dans `Layers` (déjà déclaré), les préférences par poste et la barre de lecture. Activé par défaut. Lecteur seulement.

**Risque** : avec 2 outils de plus, la barre d'outils doit tenir à 1440 px (largeur des tests) ; vérifié par un test de bout en bout.

## 7. Fichiers créés ou modifiés

```
docs/archive/plans/lot-3.md, ETAT.md, DECISIONS.md (D-078 et suivantes), ARCHITECTURE.md, RECETTE.md, SPEC.md (1.4, fin de lot), README.md (modèles, rechargement après déploiement)
src/config/defaults.ts       FORWARD_PASS_THRESHOLD, BREAKDOWN_DURATION_DEFAULT, RELAY_OFFSET, KICK_FLIGHT_TIME,
                             KICK_APEX_SCALE, LOOSE_BALL_PICKUP_DISTANCE, pas de recherche du ramassage,
                             aimantation de l'ancre (Q13), clés de thème ; HYPOTHÈSE ou SOURCE
src/model/
  types.ts, declared.ts      Play v2 ; KickAction et BreakdownAction implémentés
  schema.ts, schemaV1.ts     v2 courante ; v1 figée pour la migration
  migrations.ts              étape v1 -> v2
  preset.ts                  PlacementPreset : schéma, lecture versionnée, nom de fichier
  issues.ts, validate.ts     nouvelles alertes ; validation des jeux au pied et des regroupements
  labels.ts                  libellés des types de modèle, de regroupement et de jeu au pied
src/engine/
  timeline.ts                mouvements arrêtés et relais, boucle d'événements, segments du ballon, ligne d'avantage
  ballEvents.ts              (nouveau) jeu au pied, regroupement, ramassage, en-avant
  evaluate.ts, sceneState.ts traces, regroupements actifs, ballon en vol avec lift, schéma
  bounds.ts                  nouveaux points
src/editor/
  presets.ts                 (nouveau) repère local, enregistrer, appliquer, associer, aimanter l'ancre
  transform.ts               (nouveau) déplacer, retourner
  commands.ts                jeu au pied, regroupement (proposition), ballon au sol, suppression étendue
  tools/types.ts, tools/kickTool.ts, tools/breakdownTool.ts
  hitTest.ts, selection.ts
src/render/                  render.ts, renderSchematic.ts, primitives.ts (échelle du ballon, ombre, icône),
                             overlay.ts, layers.ts, themes.ts
src/io/
  collection.ts              (nouveau) collection générique extraite de FolderStore
  FolderStore.ts, IdbStore.ts, LibraryStore.ts, fileNames.ts, readCache.ts
src/state/                   editorStore (modes de pose), editorActions, playerStore (calque), prefs,
                             session (modèles ; copie navigateur vers dossier, allPresets), libraryState,
                             overlay, selectors
src/ui/                      Toolbar, Inspector (Jeu au pied, Regroupement, ballon, Déplacer, Retourner),
                             LibraryPanel (onglet Modèles), Dialogs (nouvelle combinaison, enregistrer un modèle),
                             TransportBar (calque), bandeau de pose, strings.ts
src/test/
  builders.ts                kick, breakdown, preset
  fixtures/play-v2-lot3.json, fixtures/preset-v1-touche.json
  image-snapshots/           nouvelles images (section 10)
e2e/
  placement.chromium.spec.ts, breakdown-kick.chromium.spec.ts, presets.firefox.spec.ts ; support/ (outils de pose)
```

## 8. Étapes

Chaque étape finit sur lint, typecheck et test verts, un commit, ETAT.md et la case du plan à jour.

- [x] **Étape 0 : branche et plan.** (commit « Étape 0 : plan du lot 3 », après `855a804`)
  - Branche `lot-3` ; `docs/archive/plans/lot-3.md` avec tes réponses.
  - ETAT.md réécrit (écart corrigé) ; décisions D-078 et suivantes.
- [x] **Étape 1 : modèle.** (commit « Étape 1 : modèle v2 et modèles de placement », après `ef574cf`)
  - Schéma v2, schéma v1 figé, migration, fixtures, `PlacementPreset`, validation, libellés, valeurs de `defaults.ts`.
  - Tests : migration, schéma, aller-retour du modèle, validation.
- [x] **Étape 2 : moteur.** (commit « Étape 2 : moteur des regroupements, du jeu au pied et de l'en-avant », après `8b38617`)
  - Mouvements arrêtés et relais, boucle d'événements, jeu au pied, regroupement, ramassage, ligne d'avantage, en-avant, schéma, boîte englobante.
  - Tests obligatoires du moteur, déterminisme et continuité ; tests du lot 1 inchangés.
- [x] **Étape 3 : géométrie de mise en place.** (commit « Étape 3 : géométrie des modèles et de la combinaison entière », après `2d11239`)
  - Repère local, enregistrer et appliquer un modèle, association, aimantation de l'ancre, déplacer, retourner.
  - Tests obligatoires des modèles et des identités.
- [x] **Étape 4 : rendu.** (commit « Étape 4 : rendu des regroupements, du jeu au pied et de l'en-avant », après `fb7298b`)
  - Thèmes, jeu au pied (tirets longs, ombre, grossissement), regroupement, icône d'en-avant, calque, surcouche.
  - Images de référence ; aplats ; 3 px ; gris en N&B.
- [x] **Étape 5 : io.** (commit « Étape 5 : stockage des modèles de placement », après `9a5d846`)
  - Collection générique, `modeles/` dans `FolderStore` et `IdbStore`, cache, copie vers le dossier.
  - Tests contre `memoryFs` : ceux du lot 1 inchangés, plus ceux des modèles.
- [x] **Étape 6 : éditeur et interface, regroupement et jeu au pied.** (commit « Étape 6 : interface du jeu au pied et des regroupements », après `edc52c2` ; D-095)
  - Outils, propositions, ballon au sol, inspecteur, calque dans la barre de lecture, suppression étendue.
  - Tests unitaires et de bout en bout.
- [x] **Étape 7 : éditeur et interface, modèles et combinaison entière.** (commit « Étape 7 : interface des modèles et de la combinaison entière », après `f44ee27` ; D-096)
  - Onglet Modèles, enregistrer, appliquer (bandeau, côté ouvert), gérer, nouvelle combinaison depuis un modèle, déplacer, retourner, catégorie.
  - Tests unitaires et de bout en bout.
- [x] **Étape 8 : exports et clôture.** (commit « Étape 8 : exports et clôture du lot 3 », après `a5fe836`)
  - Aucune icône d'en-avant dans le GIF ni le PDF ; tests GIF et PDF avec les éléments du lot 3.
  - SPEC 1.4, ARCHITECTURE, RECETTE, README.
  - Recette automatisable complète ; push ; PR `lot-3` vers `main`. Tu fusionnes.

## 9. Dépendances

Aucune. Tout repose sur la pile en place : zod, Zustand, React, `@napi-rs/canvas`, pixelmatch, pdf.js et omggif pour les tests.

## 10. Tests prévus

### Obligatoires (prompt du lot 3)

| Exigence | Tests |
|---|---|
| Modèle : aller-retour fichier | `model/preset.test.ts` (sérialisation canonique, relecture, fichier invalide ou futur) ; `io/FolderStore.test.ts` (écrit dans `modeles/`, relu, renommé, mis en corbeille) |
| Application aux quatre cas : côté ouvert gauche ou droite, croisé avec A ou B qui attaque | `editor/presets.test.ts` : positions attendues calculées à la main pour chaque cas ; enregistrer puis appliquer à la même ancre et au même côté redonne le placement |
| Ancre de touche refusée à moins de 5 m d'une ligne de but | `editor/presets.test.ts` (4,9 m refusé, 5 m accepté, des deux côtés, terrain réduit) |
| Association par rôle et numéro : déplacées, créées, inchangées | `editor/presets.test.ts` ; modèle d'attaque puis de défense |
| Symétrie deux fois = identité ; déplacement puis déplacement inverse = identité | `editor/transform.test.ts`, sur la fixture v2 complète (égalité canonique) |
| Regroupement : ballon `inBreakdown` pendant la durée, relayeur porteuse à la fin, temps suivant au bon instant, ligne d'avantage recalée | `engine/breakdown.test.ts` |
| Jeu au pied : arrivée à release + flightTime ; ballon au sol ramassé par la première joueuse à moins de 1 m | `engine/kick.test.ts` : instant de croisement comparé au calcul exact ; deux joueuses, la plus rapide ramasse ; ramassage dans un temps suivant ; ballon jamais ramassé |
| En-avant : passe plate d'une passeuse lancée non signalée ; passe vers l'avant dans le repère de la passeuse signalée | `engine/forwardPass.test.ts`, plus : passeuse arrêtée, lâcher au début d'un temps, équipe B |
| Migration des fichiers du lot 1 | `model/migrations.test.ts` (fixture v1 figée vers v2) ; `io/FolderStore.test.ts` (fichier v1 lu, laissé intact, réécrit en v2 à l'enregistrement) ; version 3 signalée comme future |

### Autres tests unitaires
- **Moteur** :
  - déterminisme de `evaluate` avec jeux au pied et regroupements ;
  - saut direct à `t` égal à la lecture continue ;
  - tronc identique dans toutes les options quand le regroupement est dans le tronc ;
  - courses des participantes arrêtées, avec alerte ;
  - relayeur en retard ;
  - regroupement invalide ignoré ;
  - jeu au pied sans ballon ;
  - boîte englobante.
- **Rendu** :
  - images de référence : scène avec un jeu au pied en vol et un ruck (Contraste fort) ; mode schéma avec ruck, jeu au pied et passe en avant (Impression N&B, Écran) ;
  - tirets longs dans les 4 thèmes (contexte enregistreur) ;
  - calque « En-avant » indépendant.
- **Éditeur** : commandes jeu au pied et regroupement ; proposition du soutien et du relayeur ; refus ; ballon au sol ; suppression étendue ; aimantation du renvoi.
- **Stockage** : modèles invalides intacts ; copies de conflit des modèles ; action refusée sur un modèle changé ailleurs ; `IdbStore` ; copie vers le dossier.
- **Exports** : une image de GIF avec un jeu au pied en vol ; une vignette PDF N&B avec un jeu au pied (tracés relus) ; aucune icône d'en-avant dans le GIF ni le PDF, même calque activé.

### Bout en bout (Playwright)
- **`placement.chromium`** (dossier OPFS) :
  - enregistrer un modèle de touche (fichier dans `modeles/`), l'appliquer à l'autre touche puis quand B attaque ;
  - ancre refusée près de la ligne de but ;
  - modèle de défense ajouté ;
  - renommer, dupliquer, supprimer (corbeille) ;
  - modèle écrit par « l'autre PC » relu au focus ;
  - nouvelle combinaison depuis un modèle ;
  - déplacer et retourner une combinaison.
- **`breakdown-kick.chromium`** :
  - ruck posé, soutien et relayeur proposés et changés, durée modifiée, temps suivant ;
  - jeu au pied vers un point puis ramassage ;
  - calque « En-avant » qui change l'image du lecteur et reste mémorisé ;
  - GIF et PDF exportés avec ces éléments ;
  - raccourcis J et G ;
  - barre d'outils entière visible à 1440 px.
- **`presets.firefox`** (mode navigateur) : enregistrer et appliquer un modèle.

## 11. Vérifications manuelles prévues (D-054, impossibles à automatiser)

1. Modèle enregistré sur un PC, présent et appliqué sur l'autre après synchronisation Drive. Si tu le souhaites, on la regroupe avec la vérification Drive restante du lot 1.
2. GIF portrait d'une combinaison avec un jeu au pied et un ruck, sur le téléphone : ombre et grossissement lisibles, repère du ruck compris.
3. PDF « Impression » N&B sur la laser : jeu au pied (tirets longs) distinct des passes (pointillés) et des courses (trait plein).

## 12. Points ambigus ou contradictoires : questions, propositions et réponses

Réponses de l'utilisateur, le 16 octobre 2026 (détail dans `docs/decisions/`) :

| Question | Réponse | Décision |
|---|---|---|
| Q1 | Proposition retenue : seulement `contest`. | D-078 |
| Q2, Q3, Q4 | Propositions retenues. | D-079 |
| Q5 | Proposition retenue. | D-080 |
| Q6 | Proposition retenue. | D-081 |
| Q7 | Proposition retenue. | D-082 |
| Q8 | Proposition retenue. | D-083 |
| Q9 | Proposition retenue. | D-084 |
| Q10 | Proposition retenue pour l'éditeur et le lecteur. | D-085 |
| Q11 | **Non** : l'alerte d'en-avant n'apparaît jamais dans les exports, ni GIF ni PDF, quel que soit le calque du lecteur ; c'est une aide pour le coach, pas une information pour les joueuses. Exception à D-068. | D-086 |
| Q12 | Proposition retenue. | D-087 |
| Q13, Q14 | Propositions retenues. | D-088 |
| Q15 | Proposition retenue. | D-089 |
| Q16 | Proposition retenue. | D-090 |
| Q17 | Proposition retenue. | D-091 |
| Q18 | Proposition retenue. | D-092 |
| Q19 | **Raccourcis J (jeu au pied) et G (regroupement)**, en plus des boutons. | D-093 |

Les questions telles que posées, avec les propositions :

**Regroupements**

- **Q1. Rôles de défense « enregistrés »** (prompt : « plaqueur, gratteur ou garde seulement enregistrés »). Le type de SPEC 10.3 ne stocke que `contest`.
  - Proposition :
    - seulement `contest` : « Par défaut » (absent, réglage de défense du lot 4), « Garde » ou « Gratteur » ;
    - le plaqueur et la joueuse au ras restent désignés par la simulation du lot 4 (11.4).
  - Autre lecture : ajouter `tacklerId` et la joueuse qui gratte ou garde, choisis à la main.
- **Q2. Soutien.** SPEC 10.3 : la plaquée et le soutien « s'immobilisent au regroupement », mais seul le relayeur est déplacé par le moteur.
  - Proposition : le soutien s'immobilise là où sa course l'a amenée à la formation. Tu dessines sa course jusqu'au ruck ; aucune « position de soutien » inventée.
  - Autre : le moteur l'amène contre la plaquée (position à fixer, HYPOTHÈSE).
- **Q3. Relayeur.** Proposition :
  - ligne droite au sprint (allure de `reglages.json`), depuis sa position à la formation jusqu'à 1 m derrière le ballon (côté de l'équipe de la plaquée), puis attente ;
  - trop loin pour arriver avant la sortie de balle : elle arrive exactement à la sortie (vitesse augmentée), avec une alerte.
- **Q4. Courses dans le temps du regroupement, regroupement invalide.** Proposition :
  - les courses de la plaquée, du soutien et du relayeur s'arrêtent à la formation ; la partie ultérieure est ignorée, dessinée en rouge et signalée ;
  - leur jeu après la sortie de balle se dessine dans le temps suivant ; une passe ou un jeu au pied du relayeur après la sortie reste possible dans le même temps ;
  - plaquée sans ballon à la formation : regroupement entièrement ignoré et signalé, comme une passe (D-013), sans recalage de la ligne d'avantage.
- **Q5. Maul.** Proposition : identique au ruck au lot 3 et immobile (aucune avancée) ; seul `kind` change (lignes de hors-jeu du lot 4).
- **Q6. Proposition à la pose.** Proposition :
  - soutien = la coéquipière la plus proche de la plaquée à l'instant de formation ; relayeur = la deuxième ;
  - instant par défaut : fin de sa course, ou réception si elle est plus tardive ;
  - ruck par défaut.
- **Q7. Ligne d'avantage en mode schéma** (éditeur, vignettes, PDF). Proposition : celle en vigueur au début du temps affiché (recalée par les regroupements formés avant ce début ou à cet instant).

**Jeu au pied, ballon au sol, en-avant**

- **Q8. Ramassage et ballon au sol.** Proposition :
  - « première joueuse » = de l'une ou l'autre équipe ; elle devient porteuse, même adverse ;
  - ballon immobile au point d'impact ; recherche à partir de l'impact, aussi dans les temps suivants ; sinon il reste au sol ;
  - le ballon au sol au départ (D-007, « lot 3 ») devient éditable et suit la même règle à partir de `t = 0` ;
  - vers une adversaire : aucune alerte (normal pour un coup d'envoi).
- **Q9. Conventions graphiques nouvelles.**
  - **Jeu au pied** :
    - vol rectiligne vu de dessus, en tirets longs ;
    - le ballon reste sur la trajectoire et grossit selon une parabole jusqu'à 1,8 au milieu du vol ;
    - l'ombre au sol est une ellipse grise pleine, décalée vers le bas à droite de l'image proportionnellement à la hauteur (confondue avec le ballon au départ et à l'arrivée) ;
    - un petit cercle marque un point visé.
  - **Regroupement** :
    - contour circulaire (2 rayons de jeton) autour du point, libellé « Ruck » ou « Maul », pendant toute sa durée en lecture ;
    - en mode schéma, le même repère au point de formation.
  - **En-avant** : pastille ronde jaune à « ! » noir au milieu de la passe ; noire à « ! » blanc en N&B.
- **Q10. Calque « En-avant ».** Proposition :
  - calque du lecteur, par poste, activé par défaut ;
  - l'éditeur (mode schéma) montre toujours l'icône, comme il montre toujours la ligne d'avantage aujourd'hui ;
  - sens d'attaque = celui de l'équipe de la passeuse ;
  - vitesse de la passeuse = dérivée à gauche au lâcher.
- **Q11. Calque « En-avant » dans le PDF.** Le GIF suit déjà les calques du lecteur (D-068) ; le PDF n'a aucun calque.
  - Proposition : le PDF suit le calque « En-avant » du lecteur, sans nouveau réglage (`reglages.json` reste en v2).
  - Autres : toujours affiché dans le PDF ; case dans le dialogue PDF (`reglages.json` v3).

**Modèles de placement**

- **Q12. Type du modèle et catégorie de la combinaison** (10.1 : « le type du modèle fixe le type de lancement »).
  - Proposition : appliquer un modèle met la catégorie à :
    - mêlée → mêlée ; touche → touche ; renvoi → coup d'envoi/renvoi ;
    - ruck → ruck/jeu courant ;
    - libre → catégorie inchangée.

    Aucun nouveau champ : le lot 4 lira la catégorie et les regroupements.
  - Autre : ne rien changer au lot 3.
- **Q13. Aimantation de l'ancre.** Proposition :
  - toujours active pour l'ancre, indépendamment du bouton « Grille 1 m » ;
  - **renvoi** : centre de la médiane, ou l'une des deux lignes des 22 m (y sur la grille), captés à moins de 3 m (HYPOTHÈSE), sinon grille de 1 m ;
  - **touche** : ligne de touche la plus proche, x sur la grille, refus à moins de 5 m d'une ligne de but.
- **Q14. Côté ouvert.** Proposition :
  - par défaut, le côté le plus large depuis l'ancre ; au centre exact, à droite de l'équipe qui attaque ;
  - choix « Auto, Gauche, Droite » (vus par l'équipe qui attaque, face à la ligne de but adverse), à l'enregistrement comme à la pose ;
  - touche : toujours vers l'intérieur, sans choix (le côté vient de la touche cliquée).
- **Q15. Enregistrer depuis une sélection.** Proposition :
  - rôle selon l'équipe (l'équipe qui attaque = attaque) ;
  - « Inclure le ballon », cochée quand le placement entier est enregistré ou que la porteuse est sélectionnée ;
  - numéros en double (D-016) : la k-ième position d'un numéro va à la k-ième joueuse de ce numéro ;
  - joueuses créées : couleur d'équipe, défense manuelle ;
  - « les défenseures auto ignorent le modèle » relève du lot 4 : non traité.
- **Q16. Déplacer, retourner.** Proposition :
  - « Déplacer » = translation par deux clics ;
  - « Retourner » = symétrie gauche-droite par rapport à l'axe du terrain (y devient largeur − y), sens d'attaque inchangé ;
  - le cadre libre de la vue enregistrée suit.
  - Autres lectures : symétrie autour d'un point d'ancrage ; déplacement avec choix du côté ouvert, comme un modèle.
- **Q17. Nouvelle combinaison depuis un modèle** (6.6). Proposition :
  - le dialogue liste aussi les modèles ;
  - en choisir un crée une combinaison sans joueuses, avec un ballon si le modèle en a un, puis lance la pose (ancre, côté ouvert).
- **Q18. Modèles et synchronisation.** Proposition :
  - même traitement que les combinaisons (section 5) ;
  - action sur un modèle modifié sur l'autre PC : refusée avec un message, liste relue ;
  - mode navigateur : modèles dans IndexedDB, copiés dans le dossier au premier choix ;
  - pas d'import ni d'export de modèles (non demandé).
- **Q19. Raccourcis des nouveaux outils.**
  - Proposition : aucun raccourci, boutons seulement (comme D-015).
  - Autre : J (jeu au pied) et G (regroupement).

## 13. Vérification de fin de lot

- `npm run lint`, `typecheck`, `test`, `test:e2e` (Chromium et Firefox), `build`, `format:check`, en local puis en CI.
- Recette automatisable : tableau « comportement → tests » du lot 3 dans `docs/RECETTE.md`, chaque ligne de la section « Lot 3 » reliée à ses tests.
- Contrôles ponctuels :
  - `bundle.chromium.spec.ts` toujours vert : morceau principal sans jsPDF ni gifenc ;
  - aucun test désactivé ;
  - fixtures v1 et v2 inchangées.
- PR `lot-3` vers `main` avec la liste des sections de la SPEC modifiées ; au plus 5 vérifications manuelles (section 11).
