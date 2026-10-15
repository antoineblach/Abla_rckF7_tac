# Plan de correction après recette du lot 1

Plan validé le 15 octobre 2026, avec deux réponses : vue unique pour l'édition et la lecture ; bandeau en surimpression du terrain. Compléments demandés : nouvelle règle de recette (D-054) ; raccourci `F` validé ; vérifications manuelles déjà faites marquées validées ; protection de `main` contrôlée par `gh api` (D-055).
Suivi : une case par étape, cochée dans le commit qui termine l'étape, avec le hash court de ce commit (ou du commit précédent quand le hash du commit lui-même ne peut pas y figurer). L'état courant détaillé est dans `docs/ETAT.md`.

## Contexte

La recette du lot 1 sur le site déployé (Chrome, Windows) a remonté trois problèmes :

1. Le terrain change d'échelle à chaque sélection ou désélection d'une joueuse.
2. La section « Combinaison » de l'inspecteur est mal placée.
3. `ubuntu-latest` passe à Ubuntu 26 le 19 octobre 2026.

S'y ajoute une nouvelle règle de recette : tout ce qui est automatisable est testé, au plus 5 vérifications manuelles, puis une séance d'usage libre.

Travail sur la branche `lot-1-corrections`, créée depuis `main`, avec une PR vers `main`.

**Écart à corriger en premier :** `docs/ETAT.md` dit la PR #1 ouverte, alors qu'elle est fusionnée (`d37f3f6` sur `main`).

Réponses déjà données :
- **Cadrage :** une vue unique pour l'édition et la lecture.
- **Bandeau :** en surimpression du terrain.

## Causes mesurées

Mesures faites avec Playwright sur le site déployé, en mode dossier simulé, dans des fenêtres de 1536×864 et 1280×720 :

1. **Cause principale : l'arbre des temps est une ligne `auto` de la grille `.app`.**
   - En Chrome, sa hauteur dépend de la hauteur du contenu de l'inspecteur.
   - Sélectionner une joueuse masque la section « Combinaison », donc l'inspecteur raccourcit.
   - L'arbre passe alors de 98 à 210 px et le terrain perd 227 px de haut : l'échelle passe de 7,11 à 5,31.
   - La désélection fait l'inverse. Même effet pour une course ou une passe sélectionnée.
2. **Message « position héritée ».**
   - Sélectionner une joueuse au temps 2 ou plus insère `EditorNotice` dans la colonne du terrain (40 à 47 px).
   - Le message reste affiché après la désélection.
3. **Barres qui passent à la ligne.**
   - Barre d'outils : deux lignes sous 1458 px de large en mode dossier.
   - Transport : sa hauteur varie avec la largeur, et elle grandit en lecture (35 px de plus quand « Revenir au point d'option » apparaît).
   - `OptionChooser` s'insère dans la colonne du terrain.
4. **Le viewport réajuste le cadre à chaque changement de taille.**
   - `FieldCanvas` recalcule `createViewport(frame)` dès que la taille du conteneur change.
   - Toute variation de hauteur devient donc un changement d'échelle.
   - Quand l'échelle ne change pas, le canevas centré se décale quand même verticalement, sans que `data-viewport` change.
5. **Cadrage automatique de la lecture.**
   - Il change le cadre quand on lance la lecture, quand on choisit une option (nouvelle ligne) et quand un clic sur le terrain ramène à l'édition.
6. **Constaté en plus : un clic de sélection déplace la joueuse.**
   - Une souris bouge souvent d'1 px entre l'appui et le relâchement. Ce mouvement compte comme un glisser : environ 0,14 m de déplacement, une étape d'annulation, et le statut passe à « Modifications en cours ».

Pistes écartées par la mesure :
- Le texte du statut ne fait pas passer la barre d'outils à la ligne (largeur minimale suffisante).
- Les colonnes latérales sont bien fixes (280 et 320 px).

## Étapes et commits

### [x] Étape 0 : mémoire (`5057bd3`)
- Créer la branche `lot-1-corrections`.
- Créer `docs/plans/lot-1-corrections.md` : copie de ce plan avec des cases.
- Réécrire `docs/ETAT.md` (écart corrigé, PR #1 fusionnée, nouvelle branche).
- Ajouter à `docs/DECISIONS.md` les décisions D-048 à D-054 (liste plus bas).
- Commit « Plan de correction après recette du lot 1 ».

### [x] Étape 1 : CI (`5b2de29`)
- `.github/workflows/ci.yml` : `runs-on: ubuntu-24.04` pour les jobs `checks` et `deploy`.
- Le nom du statut « checks » ne change pas, la protection de `main` reste valable.

### [x] Étape 2 : vue indépendante du conteneur (D-048, D-049) (commit « Vue indépendante de la taille du terrain », hash reporté à l’étape suivante ; seuil de glisser de l’étape 4 inclus)

**`src/render/viewport.ts` (fonctions pures) :**
- Type `ViewTransform { center: Vec2; scale: number }`, avec `scale` en pixels CSS par mètre.
- `fitView(frame, width, height, orientation, attackingTeam, rotate180?)`.
- `viewportFromView({ widthPx, heightPx, pixelRatio, view, orientation, attackingTeam, rotate180 })` : le centre de la vue va au centre du canevas, et l'échelle effective vaut `view.scale × pixelRatio`.
- `zoomView(view, around, factor)` : le point sous le curseur reste fixe.
- `panView(view, delta)`.
- `createViewport(frame)` devient `fitView` suivi de `viewportFromView`, avec un résultat identique : les images de référence et les exports du lot 2 ne changent pas.
- `zoomFrame` et `panFrame` sont retirés (remplacés).

**`src/state/viewStore.ts` :**
- État : `{ view: ViewTransform | null, canvasSize, visible }`.
- `setCanvasSize` ne touche jamais la vue : l'échelle et le centre sont conservés.
- `resetView()` : la vue vaut `null` et sera ajustée sur la vue enregistrée au prochain rendu.
- `adjustView('saved' | 'useful')` :
  - `'saved'` : vue enregistrée de la combinaison ;
  - `'useful'` : `autoFrame` de la ligne lue, plus 5 m de marge.
- `zoomAt` et `panBy`.
- `displayFrame` et `editFrame` sont retirés.

**Ce qui change la vue, et rien d'autre :**

| Action | Effet |
|---|---|
| Molette | Zoom |
| Espace + glisser, bouton du milieu | Déplacement (désormais aussi pendant la lecture) |
| Ouverture ou fermeture d'une combinaison (`openPlay`, `closePlay`) | `resetView()` |
| Choix de la vue enregistrée dans l'inspecteur | `adjustView('saved')` |
| Changement d'orientation | `resetView()` |
| « Ajuster » | `adjustView('saved')` |
| « Zone utile » | `adjustView('useful')` |

- Ne changent pas la vue : un rechargement silencieux depuis l'autre PC, l'annulation, le changement d'équipe qui attaque (seuls les axes tournent, comme avant).
- Le plein écran agrandit le conteneur : l'échelle est conservée, « Ajuster » recadre.

**`src/ui/field/FieldCanvas.tsx` :**
- Il publie la taille CSS du canevas.
- Si la vue vaut `null`, il l'ajuste dans un `useLayoutEffect` (dans le rendu, la même valeur est dérivée, pour éviter une image vide).
- Il construit le viewport par `viewportFromView`.
- Molette et déplacement sont permis dans les deux modes. Un clic gauche pendant la lecture revient toujours à l'édition (D-044), sans toucher la vue.

**`src/state/playerStore.ts` :**
- L'état `framing` et `setFraming` sont retirés (le cadrage des GIF reste défini par la SPEC 9, au lot 2).

**`src/ui/player/TransportBar.tsx` :**
- La liste « Cadrage » est remplacée par deux boutons : « Ajuster (F) » et « Zone utile ».

**Raccourci de « Ajuster » : `F` (validé).**
- La touche est libre ; c'est le raccourci « fit » usuel.
- `editor/shortcuts.ts` reçoit une commande `{ kind: 'fit' }`, branchée dans `handleKey`.

### [ ] Étape 3 : mise en page fixe (D-048, D-050)

Fichiers touchés : `src/ui/global.css`, `App.tsx`, `StatusBanner.tsx`, `TransportBar.tsx`, `PhaseTree.tsx`.

- **`.app` :**
  - `grid-template-rows: var(--toolbar-h) minmax(0, 1fr) var(--tree-h)`, sans aucune ligne `auto`.
  - Le bandeau sort de la grille.
- **Barre d'outils :**
  - Hauteur fixe, sans retour à la ligne.
  - Nom du dossier tronqué avec des points de suspension.
  - Indications de touche (`kbd`) masquées sous 1500 px de large ; elles restent dans les infobulles.
  - En dernier recours, défilement horizontal interne.
- **`.stage` :**
  - Grille `minmax(0, 1fr) var(--transport-h)`.
  - La zone du terrain est en `position: relative`. Elle contient `FieldCanvas` et deux calques de surimpression en `position: absolute` :
    - en haut : bandeau et `EditorNotice` ;
    - en bas : `OptionChooser`.
  - Le conteneur des calques est en `pointer-events: none` ; leurs éléments en `auto`, pour que le terrain reste cliquable autour.
- **Transport :** deux rangées de hauteur fixe, sans retour à la ligne, avec défilement horizontal interne si la largeur manque. Le curseur temporel est flexible.
- **Arbre des temps :** hauteur fixe ; la rangée d'actions est fixe et seul le dessin des temps défile.
- **Panneaux latéraux :** largeurs fixes, défilement interne. La bibliothèque repliée garde une largeur fixe.

Les hauteurs (`--toolbar-h`, `--transport-h`, `--tree-h`) sont des variables CSS en tête de `global.css`. Ce sont des dimensions d'interface, pas des valeurs du domaine.

### [x] Étape 4 : seuil de glisser (D-051) (fait avec l’étape 2)
- `src/config/defaults.ts` : `DRAG_THRESHOLD_PX = 4`, marqué `HYPOTHÈSE`.
- `FieldCanvas` publie les mètres par pixel CSS dans `useInteractionStore`.
- Dans `editorActions`, le glisser d'une joueuse ou d'un point de passage ne commence qu'au-delà du seuil.
- En deçà, rien ne bouge : pas d'étape d'annulation, pas de « Modifications en cours ».

### [ ] Étape 5 : inspecteur (D-052)
- `src/ui/inspector/Inspector.tsx` : « Combinaison » passe en tête, toujours affichée, dans un `<details>` repliable.
- Ordre ensuite : joueuse, course ou passe, temps, alertes, réglages.
- `src/state/prefs.ts` : ajout de `playSectionCollapsed` (faux par défaut), mémorisé par poste comme les autres préférences (D-026).

### [ ] Étape 6 : tests

**Unitaires :**
- `viewport.test.ts` :
  - `fitView` combiné à `viewportFromView` donne exactement le résultat de l'ancien `createViewport` ;
  - redimensionnement du conteneur : même échelle, et le centre reste au centre du canevas ;
  - `zoomView` garde le point sous le curseur ;
  - `panView`.
- `state.test.ts` :
  - `setCanvasSize` conserve l'échelle et le centre ;
  - `openPlay` remet la vue à zéro, `reloadPlay` non ;
  - `adjustView('saved')` et `adjustView('useful')` ;
  - un clic sur une joueuse avec un mouvement de 1 px ne modifie ni la combinaison, ni l'historique, ni `dirty` ; au-delà du seuil, la joueuse se déplace ;
  - `F` déclenche « Ajuster » ;
  - préférence `playSectionCollapsed`.

**Nouveau test de bout en bout `e2e/field-stability.spec.ts` (Chromium, mode dossier simulé) :**
- Sur un scénario à 3 temps et 2 options, `data-viewport` **et** la boîte du canevas doivent rester identiques avant et après chacun de ces gestes :
  - sélection et désélection d'une joueuse ;
  - sélection d'une course, d'une passe, d'un temps ;
  - apparition du message (joueuse sélectionnée au temps 2) ;
  - lecture jusqu'au point d'option, apparition des boutons d'option, puis choix d'une option ;
  - retour à l'édition par un clic sur le terrain.
- **Bandeau.** L'application ne peut pas le faire apparaître pendant qu'une combinaison est ouverte : il n'existe qu'au démarrage ou sans dossier. Le test vérifie donc sa disparition au choix du dossier, ce qui contrôle la même propriété : terrain inchangé.
- Fenêtres testées : 1536×864 et 1280×720, les tailles où le défaut a été mesuré.
- Le même fichier couvre aussi :
  - le zoom à la molette (l'échelle change, le point sous le curseur reste fixe) ;
  - Espace + glisser ;
  - « Ajuster » et `F` ;
  - la conservation de l'échelle quand la fenêtre est redimensionnée ;
  - le plein écran, si Chromium sans interface le permet (sinon, vérification manuelle).

**Inspecteur, en bout en bout :** « Combinaison » reste visible quand une joueuse est sélectionnée, et le repli est conservé après un rechargement.

**Audit de la recette du lot 1, selon la nouvelle règle :**
- Pour chaque point de la section « Lot 1 » de `RECETTE.md`, citer le test qui le couvre.
- Tout point automatisable non couvert reçoit un test dans cette correction. Probables : raccourcis 6.2 et grille dans l'interface, calques, vitesses et boucle, aperçu d'orientation, renommage et corbeille, fichier corrompu, brouillon.

### [ ] Étape 7 : documents et clôture

- **`CLAUDE.md`, règle 12**, réécrite :
  - en fin de lot : mettre à jour `ARCHITECTURE.md` et `DECISIONS.md`, et exécuter la recette automatisable ;
  - tout ce qui est automatisable est couvert par les tests ;
  - me lister au plus 5 vérifications manuelles, seulement celles qui sont indispensables et impossibles à automatiser ;
  - le reste est une séance d'usage libre, suivie de mon retour.
- **`docs/RECETTE.md` :**
  - la nouvelle règle va en tête et remplace « les tests ne remplacent pas cette recette » ;
  - section Lot 1 : un tableau « comportement → test », puis au plus 5 vérifications manuelles (liste plus bas), puis la séance d'usage libre ;
  - sections des lots 2 à 5 : leurs cases deviennent « comportements attendus, à couvrir par les tests », et chaque liste manuelle sera écrite en fin de lot ;
  - le préalable (installation de Drive, favoris) reste tel quel.
- **`docs/SPEC.md` :**
  - 6.1 : hauteurs fixes, surimpressions, vue indépendante des panneaux ;
  - 6.2 : `F` « Ajuster », seuil de glisser ;
  - 6.5 : « Combinaison » en tête, repliable ;
  - 7 : vue unique, « Ajuster », « Zone utile », molette et déplacement pendant la lecture ;
  - 8.2 et 8.6 : bandeau en surimpression, si ces sections le mentionnent ;
  - 16 : journal des décisions.
- **`docs/PROMPTS.md` :** adapter le prompt « Correction après recette » s'il parle de listes de vérifications.
- **`docs/ARCHITECTURE.md` :** viewport et `viewStore`, surimpressions.
- **`docs/ETAT.md` et `docs/plans/lot-1-corrections.md` :** tenus à jour à chaque étape.
- Recette automatisable : lint, typecheck, tests unitaires, e2e, build, Prettier.
- Ouverture de la PR. Sa description liste les sections de SPEC et de RECETTE modifiées.

## Décisions à consigner (`docs/DECISIONS.md`)

| Entrée | Décision | Origine |
|---|---|---|
| D-048 | Stabilité du terrain : aucune ligne de grille `auto` ; messages, bandeau et choix d'option en surimpression ; échelle et centre conservés quand le conteneur change de taille. | Recette |
| D-049 | Vue unique pour l'édition et la lecture ; « Ajuster » (F) et « Zone utile » ; molette et déplacement pendant la lecture. Remplace la partie cadrage de D-019. | Réponse de l'utilisateur |
| D-050 | Bandeau en surimpression du terrain. | Réponse de l'utilisateur |
| D-051 | Seuil de glisser de 4 px (`HYPOTHÈSE`). | Analyse |
| D-052 | « Combinaison » en tête de l'inspecteur, repliable, état mémorisé par poste. | Recette |
| D-053 | CI sur `ubuntu-24.04`. | Demande de l'utilisateur |
| D-054 | Nouvelle règle de recette. | Demande de l'utilisateur |
| D-055 | Blocage d'une fusion par une CI rouge : contrôle de la protection de `main` par `gh api`, sans branche cassée. | Demande de l'utilisateur |

## Vérifications manuelles du lot 1

Faites par l'utilisateur le 15/10/2026 sur le site déployé, validées (à marquer dans `RECETTE.md` et `ETAT.md`, sans les reporter) :
- dossier `G:\Mon Drive\Rugby7` en mode diffusion de Drive pour ordinateur : choix, création de la structure, écriture et sauvegarde automatique, aucun `.crswap` résiduel (hypothèses 8.3 et 8.8 confirmées) ;
- « Autoriser à chaque visite » : accès conservé après fermeture et réouverture complète de Chrome ;
- déploiement sur Pages après fusion de la PR #1.

Vérifié par `gh api` le 15/10/2026 (au lieu d'une branche volontairement cassée) : protection de `main` avec statut « checks » obligatoire (GitHub Actions), branche à jour exigée, administrateurs inclus, aucune revue exigée, poussées forcées et suppression interdites (D-055).

Restent en manuel : synchronisation Drive réelle entre les deux PC ; conflit Drive réel (« Garder les deux »).

## Vérification

- Recette automatisable complète en local, puis CI verte sur `ubuntu-24.04`.
- Je relance les scripts de reproduction (dossier temporaire de la session) sur une prévisualisation locale du build : aucun changement d'échelle ni de position du canevas sur toute la séquence de gestes, à 1536×864 et à 1280×720.
