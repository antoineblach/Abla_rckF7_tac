# Spécification : outil de combinaisons de rugby à 7 (Abla_rckF7_tac)

Version 1.1 du 14 octobre 2026 (décisions du lot 1 intégrées, voir `docs/DECISIONS.md`, D-001 à D-045). Ce document est la source de vérité du projet. À placer dans `docs/SPEC.md`.
En cas de contradiction entre un prompt et ce document, ou entre deux sections de ce document : s'arrêter et demander, ne jamais trancher seul.

## 0. Conventions du document

- **Établi** : vérifié sur une source listée en section 15, ou fourni explicitement par l'utilisateur.
- **Hypothèse** : valeur ou comportement provisoire, sans source. Toute hypothèse chiffrée est centralisée dans `src/config/defaults.ts` avec un commentaire `HYPOTHÈSE`. Toute valeur sourcée y porte un commentaire `SOURCE: <url>`.
- Unités : mètres, secondes, mètres par seconde. Angles en radians dans le code.
- Vocabulaire : le glossaire de `CLAUDE.md` fixe la correspondance entre les termes rugby français (interface) et les identifiants anglais (code).

## 1. Contexte et périmètre

- **Utilisateur unique** : coach d'une équipe féminine de rugby à 7.
- **Postes de travail** : deux ordinateurs personnels, navigateur Chrome. Firefox est installé sur les deux mais ne sert qu'en mode dégradé (section 8.6).
- **Besoin** : concevoir des combinaisons, des mises en place et des ateliers ; les animer ; les diffuser aux joueuses.
- **Diffusion** : uniquement des GIF et des PDF exportés, envoyés par WhatsApp ; les PDF sont aussi imprimés.
- **Hors périmètre** : version mobile, lecteur sur téléphone ou tablette, liens partagés, multi-utilisateur, serveur, comptes, vidéo MP4, plusieurs ballons simultanés, rotations animées dans les ateliers.

## 2. Décisions structurantes

| Décision | Raison |
|---|---|
| Application web statique hébergée sur GitHub Pages, dépôt public `Abla_rckF7_tac` | Rien à installer sur deux PC, mises à jour automatiques. Pages est réservé aux offres payantes pour un dépôt privé (établi). Le code est public, les données ne sont jamais dans le dépôt. |
| Stockage dans un dossier synchronisé par Google Drive pour ordinateur, accédé par la File System Access API de Chrome | Synchronisation entre les deux PC sans serveur ni jeton, fichiers visibles, historique de versions Drive. API absente de Firefox (établi). |
| Un seul pipeline de rendu, pur et piloté par le temps | Éditeur, lecteur, GIF et PDF produisent exactement la même image. |
| Repère en mètres, indépendant de l'écran | Orientation et cadrage libres à l'export. |
| Temps organisés en arbre | Options selon la défense dans une même combinaison. |
| Défense simulée déterministe et précalculée | Exports reproductibles, tronc commun identique dans toutes les options. |

## 3. Architecture technique

### 3.1 Pile

- TypeScript en mode strict, Vite, React (interface uniquement), Zustand (état), zod (validation), idb-keyval (IndexedDB).
- Lot 2 : gifenc (encodage GIF), jsPDF (PDF).
- Tests : Vitest (unitaires), Playwright (bout en bout, Chromium et Firefox).
- Toute autre dépendance est justifiée dans le plan du lot concerné.

### 3.2 Arborescence cible de `src/`

```
src/
  config/defaults.ts        valeurs par défaut, sourcées ou HYPOTHÈSE
  model/                    types, schémas zod, migrations, validation métier
  field/                    géométrie et tracé du terrain
  engine/                   evaluate(), trajectoires, ballon, validations
    defense/                (lot 4) simulation défensive
  render/                   render(), mode schéma, viewport, thèmes, calques
  editor/                   outils, sélection, commandes, annuler/rétablir
  player/                   lecture, transport, options
  io/                       LibraryStore, dossier, IndexedDB, fichiers
  export/                   (lot 2) gif/, pdf/
  ui/                       composants React
  state/                    stores Zustand, session (D-027)
  types/                    déclarations d'API du navigateur (D-027)
  test/                     outils de test et fixtures, jamais importés par l'application (D-027)
```

Les tests de bout en bout sont dans `e2e/`, à la racine du dépôt (D-027).

### 3.3 Principes d'architecture

1. **Pureté.** `evaluate(play, branchPath, t, settings, caches) -> SceneState` est une fonction pure (`settings` : allures et vitesse de passe de `reglages.json`, D-003) : aucune lecture d'horloge, aucun aléa, aucun état global. Les caches sont passés en paramètre et indexés par un hachage du contenu.
2. **Rendu unique.** `render(ctx, state, viewport, theme, layers)` dessine une image. `renderSchematic(ctx, play, branchPath, phaseId, viewport, theme, settings, caches)` dessine un temps à l'arrêt (D-003). Les deux fonctionnent sur un canvas affiché, sur un `OffscreenCanvas` et sur tout objet compatible avec le contexte 2D (jsPDF au lot 2).
3. **Aplats uniquement.** Le rendu n'utilise ni dégradé, ni motif, ni flou d'ombre. Raison : le contexte 2D de jsPDF ne gère ni dégradés ni motifs en trait (établi), et les GIF sont limités à une palette.
4. **Viewport.** Seule couche qui connaît les pixels. Il gère la conversion mètres vers pixels, le cadrage (terrain complet, demi-terrain, cadre libre, cadrage automatique) et l'orientation (paysage : terrain fixe, x vers la droite, sens d'attaque montré par des flèches sur la ligne d'avantage ; portrait avec rotation de 90° et attaque vers le haut de l'image ; carré comme le portrait). Une rotation supplémentaire de 180° existe : au lot 2, les GIF paysage attaquent toujours vers la droite (D-006).
5. **Trajectoires précalculées.** `evaluate` sait échantillonner des trajectoires calculées à l'avance (défense simulée, lot 4), mises en cache par (combinaison, branche, réglages).
6. **Déterminisme vérifié.** Mêmes entrées, mêmes pixels, mêmes octets d'export.
7. **Séparation.** Aucune logique métier dans les composants React. React affiche ; Zustand porte l'état ; `model`, `engine`, `io` portent la logique.

### 3.4 Déploiement et intégration continue

- `base` de Vite = `/Abla_rckF7_tac/`, casse exacte.
- Workflow GitHub Actions sur chaque push et chaque PR : `lint`, `typecheck`, `test`, `test:e2e`. Déploiement sur Pages depuis `main` uniquement si tout passe.
- Une branche par lot (`lot-1`, `lot-2`...), fusion par PR.
- `main` est protégée : le statut « checks » de la CI est obligatoire avant fusion, administrateurs compris, sans revue exigée (D-028).

### 3.5 Stockage navigateur

- IndexedDB et localStorage sont partagés par toutes les pages de l'origine `<utilisateur>.github.io`. Toutes les clés sont préfixées par `abla-rck7:`.
- IndexedDB contient uniquement : le handle du dossier choisi, un cache de lecture, le brouillon non enregistré et, en mode dégradé (section 8.6), la bibliothèque complète, sa corbeille et les réglages (D-021).
- Brouillon : écrit à chaque modification, effacé après un enregistrement réussi ; au démarrage, s'il diffère de la version enregistrée, « Restaurer le brouillon » ou « Ignorer » sont proposés (D-025).
- localStorage contient les préférences propres à chaque poste (calques, vitesse, boucle, pause entre les temps, « S'arrêter aux options », orientation, panneau replié), non synchronisées (D-026).

## 4. Modèle de données (schemaVersion 1)

### 4.1 Types

```ts
type Team = 'A' | 'B'
type Vec2 = { x: number; y: number }      // mètres, repère terrain (4.2)
type Id = string                          // UUID v4

interface Play {
  schemaVersion: 1
  id: Id
  createdAt: string                       // ISO 8601
  updatedAt: string
  name: string
  category: 'scrum' | 'lineout' | 'restart' | 'phasePlay' | 'drill'
  notes: string
  attackingTeam: Team
  field: { length: number; width: number; inGoal: number; view: FieldView }
  entities: Entity[]
  setup: { positions: Record<Id, Vec2>; ballCarrierId: Id | null; ballPosition: Vec2 | null }
  phases: Phase[]
  defenseSettings?: DefenseSettings       // lot 4
}

type FieldView =
  | { kind: 'full' }
  | { kind: 'half'; side: 'attack' | 'defense' }
  | { kind: 'frame'; min: Vec2; max: Vec2 }

type Entity =
  | { id: Id; kind: 'player'; team: Team; number: number; color: string; defenseMode: 'manual' | 'auto' }
  | { id: Id; kind: 'ball' }
  | EquipmentEntity                       // lot 5
  | ZoneEntity                            // lot 5
  | AnnotationEntity                      // lot 5

interface Phase {
  id: Id
  parentId: Id | null                     // null pour la racine
  label: string                           // calculé à l'affichage, modifiable
  condition: string                       // texte de l'option, vide pour le tronc
  instruction: string                     // consigne affichée pendant le temps
  isDefault: boolean
  actions: Action[]
}

type Action =
  | { id: Id; type: 'run'; entityId: Id; waypoints: Vec2[]; pace: 'walk' | 'jog' | 'sprint'; durationOverride?: number; delay: number }
  | { id: Id; type: 'pass'; fromId: Id; toId: Id; delay: number; ballSpeed?: number }
  | KickAction                            // lot 3
  | BreakdownAction                       // lot 3
  | GroupRunAction                        // lot 5
```

Libellés d'interface des catégories : `scrum` mêlée, `lineout` touche, `restart` coup d'envoi/renvoi, `phasePlay` ruck/jeu courant, `drill` exercice.

Les types marqués lot 3 à 5 sont déclarés dans le code et présents dans les unions, mais le schéma zod de la version 1 les rejette, comme `defenseSettings` : ils arriveront avec `schemaVersion 2` et sa migration. Le moteur les ignore en le signalant (D-004).

Précisions :
- `setup.positions` ne contient que les joueuses ; le ballon au départ est donné par `ballCarrierId` ou `ballPosition`. Au lot 1, `ballPosition` sans porteuse est accepté à la lecture mais pas éditable (ballon au sol : lot 3) (D-007).
- `Phase.label` vide : libellé calculé ; non vide : libellé saisi (D-012).
- `FieldView` `half` : `attack` est la moitié qui contient la ligne de but attaquée par l'équipe qui attaque, avec son en-but ; `defense` est l'autre (D-018).

### 4.2 Repère

- Origine : intersection de la ligne de but de l'équipe A et de la ligne de touche gauche (vue depuis l'en-but de A).
- `x` : de 0 (ligne de but de A) à `length` (ligne de but de B), sens d'attaque de A. Les en-buts vont de `-inGoal` à 0 et de `length` à `length + inGoal`.
- `y` : de 0 (touche gauche) à `width` (touche droite).
- Le sens d'attaque de la combinaison est donné par `attackingTeam` : +x pour A, -x pour B. Aucun code ne suppose que A attaque.

### 4.3 Règles de validité (validation métier, en plus de zod)

- Identifiants uniques dans toute la combinaison.
- Au plus une entité `ball`. Zéro autorisé (atelier sans ballon).
- Nombre de joueuses libre par équipe, zéro compris. Aucun code ne suppose 7 contre 7.
- Exactement une racine. Tout `parentId` existe. Pas de cycle.
- Parmi des phases sœurs, exactement une `isDefault` quand il y en a au moins deux.
- Une action référence des entités existantes ; une course ne cible qu'une joueuse.
- Numéros en double dans une équipe : avertissement, pas d'erreur (D-016). Dimensions du terrain hors des bornes de la Règle 1 : avertissement (D-017).
- Repli du moteur : deux courses d'une joueuse dans un temps, seule la première s'applique ; passe vers l'autre équipe, exécutée et signalée ; passeuse sans ballon au lâcher, passe ignorée et signalée ; deux passes au même instant de lâcher, seule la première s'applique (D-013).
- Les invalidités n'interrompent jamais le programme : elles sont listées et affichées sur l'élément concerné.

### 4.4 Fichiers

- Combinaison : `combinaisons/<nom-court>--<id>.combi.json`. Le nom court est le nom en minuscules, sans accents, chaque suite de caractères autres que lettres et chiffres remplacée par un tiret, sans tiret au début ni à la fin, 40 caractères au plus ; un nom vide donne `sans-nom` (D-023).
- Lot de combinaisons (import/export manuel) : `.combipack.json`, tableau de `Play`.
- Modèle de placement (lot 3) : `modeles/<nom-court>--<id>.preset.json`.
- Réglages : `reglages.json` à la racine du dossier, synchronisé entre les deux PC (allures, vitesse de passe, thème, préférences d'export, réglages de défense par défaut). Au lot 1 : allures, vitesse de passe, thème (D-026). Un `reglages.json` invalide n'est jamais réécrit.
- Lecture : validation zod, puis migrations successives jusqu'à la version courante. Un fichier invalide est signalé et n'est jamais modifié ni déplacé automatiquement. Un fichier qui contient une clé inconnue est invalide ; un fichier d'une version plus récente que l'application est signalé (« recharger la page ») et jamais modifié (D-024).
- Écriture : JSON indenté de 2 espaces, clés dans un ordre stable, alphabétique (différences lisibles dans l'historique Drive, D-040).

### 4.5 Migrations

- Toute modification du schéma incrémente `schemaVersion`, ajoute une fonction de migration `vN -> vN+1`, une fixture de la version précédente et un test de migration.
- Une fixture « version 0 » fictive est fournie dès le lot 1 pour éprouver le mécanisme.

## 5. Moteur

### 5.1 Lignes et temps

- Une **ligne** est un chemin de la racine à une feuille de l'arbre (`branchPath`).
- Durée d'une phase = `max(delay + durée)` de ses actions, 0 si aucune action. Durée d'une ligne = somme des durées de ses phases.
- Les actions d'une phase démarrent ensemble au début de la phase, décalées de leur `delay`.

### 5.2 Continuité

- La position de départ d'une entité au début d'une phase est sa position finale dans la phase parente (ou `setup.positions` pour la racine).
- Le premier point d'une course n'est pas stocké : c'est cette position de départ. Modifier une phase n'altère jamais les points de passage de ses descendantes ; seul leur point de départ se déplace.
- Toutes les options héritent du même tronc : pour un même `t` dans le tronc, toutes les lignes donnent le même état.

### 5.3 Trajectoires

- Spline de Catmull-Rom centripète (alpha 0,5) passant par le point de départ et les points de passage.
- Reparamétrage par abscisse curviligne (table de longueurs, au moins 64 échantillons par segment) : vitesse constante le long de la courbe.
- Durée = longueur / allure, sauf `durationOverride`.
- Allures par défaut : marche 2 m/s, trot 4 m/s, sprint 7 m/s (HYPOTHÈSE, réglables dans `reglages.json`).
- Une entité sans action dans une phase reste immobile.
- Deux courses de la même entité dans la même phase : invalide, signalé ; seule la première s'applique (D-013).

### 5.4 Ballon

- Jamais positionné à la main pendant l'animation. État dérivé :
  - `carried(entityId)` : dessiné contre le jeton de la porteuse ;
  - `inFlight(fromPos, releaseT, arrivalT, toId | toPos)` ;
  - `loose(pos)` : au sol (lot 3, après un jeu au pied sans receveuse) ;
  - `inBreakdown(pos)` : dans un regroupement (lot 3).
- Passe : départ à la position de la passeuse à l'instant du lâcher ; arrivée à la position de la receveuse évaluée à `arrivalT`. Vol rectiligne à vitesse constante. `arrivalT = releaseT + distance / ballSpeed`, résolu par point fixe (5 itérations, D-037 ; convergence tant que la receveuse est plus lente que le ballon ; le ballon finit toujours exactement sur la receveuse). Vitesse de passe par défaut 12 m/s (HYPOTHÈSE).
- Validations : passe vers l'autre équipe ; passeuse sans ballon au lâcher ; deux passes simultanées du même ballon (même instant de lâcher). Chaque cas est signalé sur l'action ; repli du moteur : voir 4.3 (D-013).

### 5.5 Traces

- Calculées depuis la géométrie : portion de trajectoire parcourue à l'instant `t`. Jamais accumulées image par image : une lecture continue et un saut direct à `t` donnent la même image.
- Passes déjà effectuées tracées en pointillés ; pendant le vol, la portion parcourue aussi (D-019).

### 5.6 Ligne d'avantage

- Ligne parallèle aux lignes de but, à l'abscisse du ballon à `t = 0`.
- Des flèches sur la ligne d'avantage montrent le sens d'attaque ; elles s'inversent quand l'équipe qui attaque change (D-006).
- Fixe pendant la lecture. Au lot 3, recalée à l'abscisse du point de regroupement à chaque formation de ruck ou de maul.

### 5.7 Contrôle d'en-avant (lot 3)

- Principe établi : une passe est jugée en avant si elle part vers l'avant depuis les mains ; la trajectoire du ballon dans le repère du terrain n'entre pas en compte. On raisonne donc dans le repère de la passeuse.
- Calcul : vitesse du ballon (repère terrain) moins vitesse de la passeuse au lâcher (dérivée de sa trajectoire). Si la composante dans le sens d'attaque dépasse 0,5 m/s (HYPOTHÈSE), la passe est marquée « en avant probable ».
- C'est une aide visuelle, jamais un blocage.

## 6. Éditeur (lot 1)

### 6.1 Disposition de l'écran

- Barre d'outils en haut ; bibliothèque repliable à gauche ; terrain au centre ; inspecteur à droite ; arbre des temps et commandes de lecture en bas.
- PC uniquement : souris et clavier. Aucune contrainte tactile.

### 6.2 Outils

| Outil | Raccourci | Comportement |
|---|---|---|
| Sélection | V | Clic, multi-sélection au cadre, Maj+clic pour ajouter. Glisser pour déplacer : placements de départ au temps 1, points de passage dans tout temps ; une position héritée d'un temps précédent ne se déplace pas (D-009). |
| Placer joueuse A | A | Clic sur le terrain ; numéro suivant libre ; le clic fixe son placement de départ, quel que soit le temps affiché (D-009). |
| Placer joueuse B | B | Idem pour B. |
| Course | R | Clic sur une joueuse, puis un clic par point de passage ; Entrée ou double clic pour terminer ; Échap pour annuler. Points déplaçables ensuite ; clic droit sur un point pour le supprimer (supprimer le dernier point supprime la course). Sur une joueuse qui court déjà dans le temps, la course est prolongée (D-015). |
| Passe | P | Clic sur la passeuse, puis sur la receveuse. Délai par défaut : instant où la passeuse obtient le ballon dans le temps (D-015). |
| Supprimer | Suppr | Sur la sélection ; supprimer une joueuse supprime ses courses et les passes qui la concernent, dans tous les temps (D-014). |

Autres raccourcis : Ctrl+D dupliquer les joueuses sélectionnées (numéro suivant libre, décalage de 2 m, sans actions) ; flèches pour décaler de 0,5 m, Maj+flèches de 5 m, sans aimantation (D-015) ; L lecture/pause ; Ctrl+Z / Ctrl+Y ; Ctrl+S enregistrer ; molette pour zoomer ; Espace+glisser ou bouton du milieu pour se déplacer.

### 6.3 Comportements

- Aimantation optionnelle sur une grille de 1 m, activée par un bouton de la barre d'outils (D-015).
- La phase sélectionnée s'affiche avec les positions de début de phase en plein, et les trajectoires de ses phases ancêtres en grisé (mode schéma). Le mode schéma est éditable ; pendant la lecture ou après un déplacement du curseur, la scène à `t` s'affiche et n'est pas éditable ; tout geste d'édition ramène au mode schéma du temps courant (D-010).
- Annuler/rétablir par instantanés de la combinaison, 100 niveaux ; un geste terminé = une étape (pas une étape par mouvement de souris). Un rechargement depuis le dossier remet l'historique à zéro (D-044).
- Numérotation : A et B de 1 à n ; numéros modifiables. Couleurs par défaut distinguables par les daltoniens (bleu pour A, orange pour B).
- Le jeton n'affiche que le numéro.

### 6.4 Arbre des temps

- Tronc horizontal ; les options s'empilent sous leur point d'option.
- Actions : ajouter un temps, insérer un temps après, dupliquer, renommer, supprimer (descendants inclus, après confirmation), « Créer une option à partir d'ici », choisir l'option par défaut, saisir la condition et la consigne (D-012) :
  - « Ajouter un temps » : un enfant du temps sélectionné, qui doit être une feuille ;
  - « Insérer un temps après » : un temps vide entre le temps sélectionné et ses enfants, qui lui sont rattachés ;
  - « Créer une option à partir d'ici » : une sœur vide du temps sélectionné ; s'il était seul, il devient l'option A par défaut ; indisponible sur le premier temps ;
  - « Dupliquer » : une sœur avec une copie des actions, sans les temps suivants ;
  - le premier temps ne se supprime pas.
- Libellés calculés : « Temps n » (n = profondeur depuis la racine, à partir de 1) ; « Temps n, option A », « B », « C » pour les sœurs, dans l'ordre de création. Un libellé saisi remplace le libellé calculé ; les lettres se recalculent après une suppression.
- Consigne : avertissement au-delà de 60 caractères (HYPOTHÈSE, lisibilité des GIF sur téléphone).

### 6.5 Inspecteur

- Joueuse : numéro, couleur, mode défense (manuel ; auto au lot 4), porteuse du ballon au départ (D-007).
- Course : allure, durée imposée, délai.
- Passe : délai, vitesse de passe.
- Combinaison : nom (appliqué à la validation du champ, D-005), catégorie, notes, équipe qui attaque, ajout ou retrait du ballon (D-007), dimensions du terrain (bornées à la Règle 1, D-017), vue (cadre libre réglé par « Enregistrer la vue actuelle comme cadre » et des champs numériques, D-019).
- Réglages de `reglages.json` (thème, allures, vitesse de passe), modifiables depuis l'inspecteur.

### 6.6 Départ d'une nouvelle combinaison

- Deux placements fournis : équipe A seule en ligne ; 7 contre 7 en ligne. A sur x = 40 m, n° 1 à 7 de y = 5 m à y = 65 m tous les 10 m ; en 7 contre 7, B en face sur x = 50 m ; ballon à A n° 4 ; A attaque ; nom « Nouvelle combinaison », catégorie ruck/jeu courant, vue terrain complet (D-008).
- Au lot 3, s'y ajoutent les modèles de placement enregistrés.

## 7. Lecteur (lot 1)

- Intégré à l'éditeur, avec un mode plein écran.
- Commandes : lecture/pause, temps précédent/suivant, curseur temporel, vitesse 0,5x / 1x / 2x, boucle, pause automatique entre les temps.
- Point d'option : bascule « S'arrêter aux options », activée par défaut et indépendante de la pause entre les temps ; activée, pause et un bouton par option, libellé par sa condition ; désactivée, l'option par défaut ; un bouton revient au point d'option pour lire une autre option (D-011).
- Calques activables séparément : traces (temps en cours appuyé, temps précédents estompés) ; consigne en bandeau ; ligne d'avantage en tirets fins. Lots suivants : indicateurs de défense, ligne de hors-jeu.
- Cadrage automatique sur la zone utile (boîte englobante de toutes les positions de la ligne lue, plus 5 m de marge), avec bascule vers la vue enregistrée. Il s'applique pendant la lecture ; en édition, l'affichage part de la vue enregistrée, puis zoom et déplacement libres (D-019).
- Aperçu d'orientation : paysage, portrait, carré (prépare les exports du lot 2), disponible aussi en édition (D-019).
- `requestAnimationFrame` uniquement pendant la lecture ; rendu à la demande sinon.

## 8. Stockage et synchronisation (lot 1)

### 8.1 Interface

```ts
interface LibraryStore {
  list(): Promise<PlaySummary[]>
  get(id: Id): Promise<Play>
  put(play: Play): Promise<void>
  remove(id: Id): Promise<void>            // déplacement en corbeille
  changesSince(stamp: number): Promise<Change[]>
}
```

Deux implémentations : `FolderStore` (principale) et `IdbStore` (mode dégradé). Les modèles de placement (lot 3) et les réglages passent par la même couche.

Extensions du lot 1 (D-020) : `issues()` (fichiers invalides, copies de conflit), `resolveDuplicate(id, choix)`, `getSettings()` et `putSettings()`, `versionOf(id)`, `put(play, { expected, archivePrevious })` pour la concurrence optimiste et le remplacement à l'import. `stamp` est un compteur de relectures, pas une heure (les horloges des deux PC et les dates posées par Drive peuvent diverger) ; chaque `Change` porte son `stamp`.

### 8.2 Dossier

- L'utilisateur choisit une fois un dossier avec `showDirectoryPicker` (Chrome). Le handle est conservé dans IndexedDB.
- Au démarrage, si la permission n'est plus accordée, un bouton « Réautoriser le dossier » la redemande en un clic. Chrome (version 122 et suivantes) propose « Autoriser à chaque visite » (« Allow on every visit »), qui rend l'accès permanent (établi).
- Structure créée au premier usage :

```
<dossier choisi>/
  reglages.json
  combinaisons/
  modeles/          (lot 3)
  exports/          (lot 2)
  _corbeille/
```

### 8.3 Lecture, écriture, détection des changements

- Relecture complète au démarrage, à chaque retour du focus sur la fenêtre, et toutes les 30 s tant que la fenêtre est visible (HYPOTHÈSE de période). La relecture prend tout fichier `*.json` de `combinaisons/`, copies de conflit comprises, et ignore les autres, dont les fichiers temporaires `.crswap` de Chrome (D-023).
- Un changement est détecté par la date de modification et la taille du fichier, puis confirmé par le contenu (`updatedAt`). Avant d'écrire, l'outil vérifie que le fichier n'a pas changé depuis sa lecture ; sinon il propose les choix de 8.4 au lieu d'écraser (D-043).
- Sauvegarde automatique 2 s après la dernière modification, plus Ctrl+S.
- Écriture via `createWritable()` puis `close()`. HYPOTHÈSE à vérifier : l'écriture passe par un fichier temporaire et n'est validée qu'à la fermeture.
- Renommer une combinaison renomme son fichier : écrire le nouveau, puis déplacer l'ancien en corbeille, toujours ; le renommage n'a lieu qu'à la validation du nom (D-005).

### 8.4 Conflits

- **Modification extérieure sans modification locale en cours** : rechargement silencieux, notification discrète.
- **Modification extérieure avec modification locale non enregistrée** : choix « Garder la version du dossier », « Garder la mienne », « Garder les deux ». « Garder les deux » : ma version reçoit un nouvel `id` et le suffixe « (copie) » (D-022).
- **Deux fichiers portant le même `id`** (copie de conflit créée par la synchronisation, établi pour Drive pour ordinateur) : signalement dans la bibliothèque, choix « Garder les deux » (nouvel `id` pour l'une, nom suffixé « (copie) ») ou « Choisir celle-ci », qui déplace l'autre fichier en corbeille. Tant que le doublon n'est pas résolu, la combinaison est en lecture seule (D-022).
- **Import d'un `id` déjà présent** : « Remplacer » ou « Garder les deux », dates affichées. « Remplacer » déplace d'abord l'ancienne version en corbeille (D-022).

### 8.5 Suppression

- Jamais d'effacement définitif : déplacement dans `_corbeille/`, avec un horodatage en tête du nom : `AAAA-MM-JJ_HH-MM-SS--<nom d'origine>` (D-023). Le déplacement copie le fichier, vérifie la copie, puis retire l'original (D-043).

### 8.6 Mode dégradé (Firefox, ou aucun dossier choisi)

- Bibliothèque dans IndexedDB ; import et export manuels `.combi.json` et `.combipack.json`.
- Bandeau permanent : « Synchronisation par dossier disponible dans Chrome » (Firefox) ; dans Chrome sans dossier : « Aucun dossier choisi : la bibliothèque reste dans ce navigateur », avec un bouton « Choisir un dossier ». Au premier choix d'un dossier, l'outil propose d'y copier les combinaisons du navigateur (D-021).

### 8.7 Bibliothèque

- Liste avec vignette (mode schéma du premier temps), nom, catégorie, date de modification.
- Recherche par nom ; filtre par catégorie ; tri par nom ou date.
- Dupliquer ; supprimer (corbeille, après confirmation) ; exporter en fichier ; importer.

### 8.8 Configuration Drive (côté utilisateur, documentée dans le README)

- Installer Google Drive pour ordinateur sur les deux PC.
- Choisir un dossier dans « Mon Drive », par exemple `Mon Drive/Rugby7`.
- Mode **miroir** recommandé : fichiers sur le disque et dans le cloud, disponibles hors connexion (établi). En mode **diffusion**, les fichiers ne sont en local qu'à l'usage (établi) : marquer alors le dossier « disponible hors connexion ». HYPOTHÈSE à vérifier : la File System Access API fonctionne sur le lecteur virtuel du mode diffusion.
- Historique : Drive conserve les versions d'un fichier jusqu'à 30 jours ou 100 versions, sauf « Conserver indéfiniment » (établi).
- Bonne pratique : attendre la fin de la synchronisation avant de passer d'un PC à l'autre.

## 9. Exports (lot 2)

### 9.1 Principes

- Les exports utilisent exclusivement `evaluate`, `render` et `renderSchematic` sur canvas hors écran. Aucun rendu propre aux exports.
- Thème « contraste fort » par défaut ; thème « impression N&B » pour les PDF en noir et blanc.
- Encodage dans un Web Worker, barre de progression, bouton Annuler. L'interface ne gèle jamais.
- Enregistrement dans `exports/` du dossier (donc accessible depuis l'app Google Drive du téléphone si elle y est installée, d'où l'envoi WhatsApp) ; repli : téléchargement.
- Nom : `<nom-court>--<variante>.<ext>`, variante = orientation, option ou mise en page. Un export existant n'est jamais écrasé sans confirmation.

### 9.2 GIF

- **Orientation** au choix : portrait (terrain vertical, attaque vers le haut), paysage (attaque toujours vers la droite : rotation de 180° quand B attaque), carré (attaque vers le haut) (D-006).
- **Options** au choix :
  - un GIF par feuille de l'arbre ;
  - un GIF enchaîné : tronc, option A, carton « Option B : <condition> », reprise au point d'option, option B, et ainsi de suite.
- **Vitesse** : par défaut, deux passages dans le même GIF : ralenti 0,5x (pastille « Ralenti »), carton court, puis vitesse réelle (pastille « Vitesse réelle »). Autres choix : 0,5x seul, 1x seul.
- **Habillage** : carton titre 1,5 s (nom de la combinaison) ; numéro du temps en haut (« Temps 2 », « Temps 3, option B ») ; consigne en bandeau ; image finale figée 2 s avant la boucle. Calques traces, ligne d'avantage et indicateurs selon les réglages du lecteur.
- **Cadrage** : boîte englobante de toutes les lignes exportées dans le fichier, fixe pendant tout le GIF.
- **Lisibilité** : taille de texte minimale garantissant la lecture sur un téléphone de 6 pouces quand le GIF occupe la largeur de l'écran ; jetons et numéros dimensionnés de même.
- **Résolution et cadence** (HYPOTHÈSES) : standard 540 x 960 (portrait), 960 x 540 (paysage), 720 x 720 (carré), 12 images/s ; « haute qualité » 720 x 1280, 1280 x 720, 960 x 960, 15 images/s.
- **Encodage** : gifenc (`quantize`, `applyPalette`, `GIFEncoder`, `writeFrame`) ; palette globale calculée sur un échantillon d'images (pas de scintillement) ; boucle infinie. Optimisation à évaluer : pixels inchangés d'une image à l'autre codés en couleur transparente pour réduire le poids.
- **Poids** : taille affichée après export ; avertissement au-delà de 8 Mo (HYPOTHÈSE) avec proposition d'une version allégée.
- **WhatsApp** : établi, WhatsApp ré-encode les GIF en MP4 pour les animer. Côté plateforme WhatsApp Business, un MP4 de plus de 3,5 Mo s'affiche comme une vidéo avec bouton lecture au lieu d'une boucle automatique (établi pour l'API Business, non vérifié pour l'application grand public). À vérifier en recette.

### 9.3 PDF

- **Deux mises en page** à l'export :
  - « Téléphone » : une page haute par combinaison, largeur fixe, lue en défilant ;
  - « Impression » : A4 paysage.
- **Couleur ou noir et blanc** au choix. En noir et blanc : équipes en jetons pleins (A) et creux (B), courses en trait plein, passes en pointillés, jeu au pied en tirets longs.
- **Contenu d'une combinaison** : titre, catégorie, notes du coach ; une vignette par temps en mode schéma ; sous chaque vignette, son libellé et sa consigne.
- **Options** : toutes sur la même page, en arbre de vignettes : le tronc, puis une rangée par option sous son point d'option, chaque rangée titrée par sa condition. En mise en page téléphone, les rangées d'options s'empilent verticalement.
- **Débordement** : si une combinaison ne tient pas sur un A4, réduire les vignettes jusqu'à un minimum lisible (HYPOTHÈSE : 60 mm de large), puis continuer sur la page suivante avec rappel du titre.
- **Cahier de jeu** : sélection de plusieurs combinaisons ou d'une catégorie, un seul PDF ; page de titre ; sommaire avec numéros de page et liens internes ; chaque combinaison commence sur une nouvelle page.
- **Vectoriel ou image** : rendu vectoriel si `renderSchematic` fonctionne sur le contexte 2D de jsPDF (qui imite le contexte 2D de Canvas, établi) ; sinon images à 300 dpi. Évaluation à présenter en mode plan.
- **Police** embarquée couvrant le français : accents, apostrophe typographique, guillemets.

## 10. Mise en place (lot 3)

### 10.1 Modèles de placement

- **Enregistrer** : depuis le placement de départ d'une combinaison, ou d'une sélection (par exemple la défense seule). L'utilisateur saisit un nom, un type, et clique le point d'ancrage.
- **Types et ancrage** :

| Type | Ancre | Aimantation |
|---|---|---|
| Mêlée | Marque de la mêlée | Grille de 1 m |
| Touche | Marque de touche, sur la ligne de touche | Ligne de touche, pas à moins de 5 m d'une ligne de but (établi) |
| Coup d'envoi/renvoi | Point du coup de pied | Centre de la médiane, ligne des 22 m |
| Ruck | Point du regroupement | Grille de 1 m |
| Libre | Point cliqué | Grille de 1 m |

- **Repère local** : axe « vers l'avant » = sens d'attaque de l'équipe qui attaque ; axe « vers le côté ouvert » = vers le côté le plus large du terrain par défaut, inversable ; pour la touche, « vers l'intérieur du terrain ».
- **Rôles** : les positions sont rangées par rôle (attaque, défense) et numéro, pas par équipe A ou B. Un même modèle sert quelle que soit l'équipe qui attaque, des deux côtés et partout sur le terrain.
- **Appliquer** : choisir le modèle, cliquer le point d'ancrage, choisir le côté ouvert (symétrie). Les joueuses sont associées par rôle et numéro : existantes déplacées, manquantes créées, autres inchangées.
- **Combinables** : un modèle d'attaque plus un modèle de défense.
- **Gestion** : liste avec vignette ; renommer, dupliquer, mettre à jour depuis le placement courant, supprimer (corbeille).
- **Lien avec le lot 4** : le type du modèle fixe le type de lancement de la combinaison (lignes de hors-jeu). Les défenseures en mode auto ignorent les positions du modèle.

```ts
interface PlacementPreset {
  schemaVersion: 1
  id: Id
  name: string
  type: 'scrum' | 'lineout' | 'restart' | 'ruck' | 'free'
  positions: { role: 'attack' | 'defense'; number: number; forward: number; openSide: number }[]
  ball: { forward: number; openSide: number; carrierRole?: 'attack' | 'defense'; carrierNumber?: number } | null
  createdAt: string
  updatedAt: string
}
```

### 10.2 Déplacer ou retourner une combinaison

- La même transformation (ancrage et symétrie) s'applique à une combinaison entière : positions de départ, points de passage, cibles de jeu au pied.

### 10.3 Regroupements (ruck et maul)

Composition fournie par l'utilisateur (établi) :
- **Attaque** : la plaquée (porteuse au moment du plaquage) et le soutien sont engagés dans le regroupement ; le relayeur se place au ballon et le sort.
- **Défense** : le plaqueur est engagé ; une seule joueuse fait gratteur ou garde, au choix par regroupement. En gratteur, elle est engagée ; en garde, elle se place au ras du dernier pied, côté ouvert.
- **Maul** : même composition que le ruck.

```ts
interface BreakdownAction {
  id: Id
  type: 'breakdown'
  kind: 'ruck' | 'maul'
  tackledId: Id          // la porteuse plaquée
  supportId: Id
  relayerId: Id          // le relayeur
  delay: number          // instant de formation dans la phase
  duration: number       // défaut 3 s (établi, valeur fournie par l'utilisateur)
  contest?: 'guard' | 'jackal'   // surcharge du réglage de défense
}
```

Comportement :
- À la formation, le ballon passe à l'état `inBreakdown` au point de la plaquée ; la plaquée et le soutien s'immobilisent au regroupement ; le relayeur rejoint la position de relais (1 m derrière le ballon côté attaque, HYPOTHÈSE).
- À la fin de `duration`, le relayeur devient porteuse. La phase se termine au plus tôt à cet instant (sa durée inclut le regroupement).
- La ligne d'avantage est recalée au point du regroupement.
- Pose dans l'éditeur : le marqueur se pose sur la porteuse ; l'éditeur propose les deux coéquipières les plus proches comme soutien et relayeur, modifiables.

### 10.4 Jeu au pied

Deux types seulement (choix utilisateur) : coup d'envoi/renvoi, et jeu au pied long/recentrage.

```ts
interface KickAction {
  id: Id
  type: 'kick'
  kickerId: Id
  kind: 'restart' | 'long'
  target: { receiverId: Id } | { point: Vec2 }
  delay: number
  flightTime?: number    // défaut : restart 3,0 s ; long 3,5 s (HYPOTHÈSES)
}
```

- Trajectoire vue de dessus en tirets longs ; hauteur figurée par l'ombre au sol et un ballon qui grossit jusqu'au sommet (facteur 1,8 au sommet, HYPOTHÈSE).
- Avec receveuse : arrivée à sa position à `release + flightTime`. Sur un point : ballon `loose` au point d'impact ; il devient porté par la première joueuse qui passe à moins de 1 m après l'impact (HYPOTHÈSE de distance).
- La poursuite reste dessinée à la main ; la défense simulée ne s'applique pas aux coups d'envoi.

### 10.5 Contrôle d'en-avant

- Voir 5.7. Icône sur la passe concernée, liste dans l'inspecteur, calque activable dans le lecteur et les exports.

## 11. Défense simulée (lot 4)

### 11.1 Principes établis par les sources

- « Chacun le sien » : chaque défenseur prend un joueur (défense individuelle).
- À 7, le dispositif classique aligne six défenseurs et un balayeur ; la tendance actuelle est de mettre les sept en ligne.
- Alignement sur l'épaule intérieure de l'attaquant, défense de l'intérieur vers l'extérieur.
- Variante de glissement : individuel jusqu'à ce que le ballon passe le milieu de l'attaque, puis glissement d'un cran vers l'extérieur ; montée en ligne sans trou.
- Sans ruck ni maul, pas de ligne de hors-jeu en jeu courant à 7 : la défense peut dépasser le niveau du ballon et doit se replacer dès qu'un regroupement se forme.

### 11.2 Lignes de hors-jeu (Règles World Rugby, établi)

| Lancement | Ligne de hors-jeu de la défense |
|---|---|
| Ruck | Parallèle à la ligne de but, par le point le plus en arrière de tout participant ; la ligne de but si ce point est sur ou derrière elle. |
| Maul | Par le dernier pied des participants le plus proche de la ligne de but de l'équipe ; la ligne de but si ce pied est sur ou derrière elle. |
| Mêlée | À 7 : trois joueuses par équipe. Non-participantes à 5 m au moins derrière le dernier pied de leur équipe ; la ligne de but si ce pied est à moins de 5 m d'elle. Ces lignes disparaissent à la fin de la mêlée, qui à 7 se termine quand la demi de mêlée joue le ballon. La demi qui n'a pas le ballon reste près de la mêlée ou recule à 5 m. |
| Touche | Non-participantes à 10 m au moins de la marque de touche, de leur côté (ou derrière la ligne de but si plus proche) ; elles peuvent avancer dès que le ballon est lancé. Au moins deux joueuses par équipe dans l'alignement ; l'équipe qui ne lance pas peut en mettre moins, jamais plus. Alignement entre les lignes des 5 m et des 15 m. L'équipe qui ne lance pas place une joueuse entre la touche et la ligne des 5 m, à 2 m de la marque. |
| Jeu courant | Aucune ligne de hors-jeu pour la défense. |
| Coup d'envoi/renvoi | Simulation désactivée (défense dessinée à la main). |

### 11.3 Réglages

```ts
interface DefenseSettings {
  system: '6+1' | '7'                   // choix par combinaison ; défaut global 6+1
  breakdownContest: 'guard' | 'jackal'  // défaut 'guard'
  guardSide: 'open'                     // côté ouvert
  lineSpeed: number                     // 6 m/s (HYPOTHÈSE)
  maxAccel: number                      // 4 m/s² (HYPOTHÈSE)
  lineTolerance: number                 // 1,5 m (HYPOTHÈSE)
  alignDepth: number                    // 1 m derrière la ligne de hors-jeu (HYPOTHÈSE)
  insideShoulder: number                // 0,5 m (HYPOTHÈSE)
  reintegrationDelay: number            // 2 s (HYPOTHÈSE)
  sweeperDepth: number                  // 10 m derrière la ligne (HYPOTHÈSE)
  drift: boolean                        // glissement, défaut false
}
```

### 11.4 Rôles attribués à chaque lancement ou regroupement

- **Engagées** :
  - mêlée : trois défenseures dans la mêlée ;
  - touche : autant que l'alignement adverse, plus la joueuse face à la lanceuse ;
  - ruck et maul : le plaqueur (la défenseure en contact avec la porteuse à la formation), plus la joueuse qui gratte si `jackal`.
  - Les engagées restent au regroupement jusqu'à la sortie de balle, puis rejoignent la ligne par l'intérieur après `reintegrationDelay`.
- **Garde** (ruck et maul, si `guard`) : la plus proche défenseure non engagée. Avant la sortie : au ras du dernier pied, côté ouvert, à 1 m du bord du regroupement (HYPOTHÈSE). Après : prend le relayeur s'il attaque au ras (à moins de 5 m latéralement du regroupement, HYPOTHÈSE), sinon tient 1 s puis rejoint la ligne.
- **Demi défensive** (mêlée) : la défenseure non engagée la plus proche de la mêlée suit la demi adverse.
- **Balayeur** (système 6+1) : la défenseure restante la plus en retrait.
- **Ligne « chacun le sien »** : les autres. À la sortie de balle, appariement de chaque côté du regroupement, de l'intérieur vers l'extérieur : la i-ème défenseure prend la i-ème attaquante. Sont exclues de l'appariement : la plaquée, le soutien et le relayeur. En jeu courant, l'intérieur est défini par rapport à la porteuse au déclenchement.
- L'appariement est figé jusqu'au regroupement suivant. Attaquantes non appariées : **surnombre**.

### 11.5 Mouvement

- Intégration à pas fixe de 1/50 s sur toute la ligne lue ; vitesse et accélération plafonnées.
- **Avant la sortie de balle** : alignées sur la ligne de hors-jeu du lancement, à `alignDepth` derrière, sur l'épaule intérieure de leur vis-à-vis.
- **Déclenchement** : premier mouvement du ballon hors du point d'ancrage (passe ou course du relayeur ; lancer en touche ; balle jouée par la demi en mêlée). En jeu courant : `t = 0`.
- **Après** : chaque défenseure vise l'épaule intérieure de son attaquante. Aucune ne devance la moyenne de ses deux voisines de plus de `lineTolerance` (montée en ligne).
- **Poursuite** : la défenseure dont l'attaquante porte le ballon vise la position anticipée de la porteuse (position + vitesse x 0,3 s, HYPOTHÈSE).
- **Balayeur** : derrière la ligne à `sweeperDepth`, suit latéralement le ballon avec un retard (filtre de constante 0,5 s, HYPOTHÈSE) ; poursuit la porteuse dès qu'elle franchit la ligne.
- **Glissement** (si `drift`) : décalage d'un cran vers l'extérieur quand le ballon dépasse le milieu de la ligne d'attaque.

### 11.6 Indicateurs

- **Surnombre** : halo sur les attaquantes non appariées.
- **Contact probable** : défenseure à moins de 1 m de la porteuse (HYPOTHÈSE).
- **Franchissement** : la porteuse dépasse la ligne défensive sans défenseure à moins de 1,5 m (HYPOTHÈSE).
- Calques optionnels : traits d'appariement ; ligne de hors-jeu pendant le regroupement.

### 11.7 Intégration

- Mode par défenseure : `manual` ou `auto` ; mélange possible. Les défenseures manuelles ne sont jamais réappariées.
- « Figer » : convertit la trajectoire simulée d'une défenseure en courses éditables (points simplifiés par Ramer-Douglas-Peucker, tolérance 0,3 m, HYPOTHÈSE).
- Résultat mis en cache par (combinaison, branche, réglages) ; recalcul à chaque modification ; objectif inférieur à 50 ms par ligne (HYPOTHÈSE).
- Effectifs quelconques (N contre M), y compris ateliers à effectif réduit.

### 11.8 Limites assumées

- Aucune issue de plaquage : l'attaque reste celle qui est dessinée.
- Pas d'échange de vis-à-vis sur une croisée ; un leurre attire sa défenseure (individuel strict).
- Pas de réaction au jeu au pied ; pas de simulation des coups d'envoi.
- Le système « 7 en ligne » ne modélise pas la bascule de la défense dite « pendule ».

## 12. Ateliers (lot 5)

- Matériel : plots, coupelles, boucliers de contact, sacs de plaquage, piquets. Statiques, déplaçables, visibles dans tous les temps.
- Zones : rectangles colorés semi-transparents, avec étiquette et cotes affichées (par exemple « 20 x 15 m »).
- Annotations : texte libre positionné sur le terrain.
- Course groupée : une trajectoire appliquée en translation à une sélection de joueuses (chacune garde son décalage).
- Un seul ballon ; pas de rotation animée (consigne ou notes).

```ts
type EquipmentEntity = { id: Id; kind: 'equipment'; type: 'cone' | 'disc' | 'shield' | 'tackleBag' | 'pole'; color: string; position: Vec2 }
type ZoneEntity = { id: Id; kind: 'zone'; min: Vec2; max: Vec2; color: string; label: string; showDimensions: boolean }
type AnnotationEntity = { id: Id; kind: 'annotation'; position: Vec2; text: string }
type GroupRunAction = { id: Id; type: 'groupRun'; entityIds: Id[]; waypoints: Vec2[]; pace: 'walk' | 'jog' | 'sprint'; durationOverride?: number; delay: number }
```

Note : la position des équipements, zones et annotations est portée par l'entité elle-même (ils ne bougent pas), pas par `setup.positions`.

## 13. Terrain et conventions graphiques

### 13.1 Terrain (établi, Règle 1)

- Aire de jeu : longueur 94 à 100 m, largeur 68 à 70 m ; en-but 6 à 22 m. Défaut de l'outil : 100 x 70 m, en-buts 10 m.
- Lignes pleines : lignes de ballon mort, lignes de touche de but, lignes de but, lignes des 22 m, médiane, lignes de touche.
- Lignes en tirets (tirets de 5 m, établi ; espacés de 5 m, HYPOTHÈSE, D-002) : à 5 m et à 15 m de chaque ligne de touche ; à 10 m de part et d'autre de la médiane ; à 5 m de chaque ligne de but.
- Repère de 0,5 m au centre de la médiane. Poteaux (écartement de 5,6 m, HYPOTHÈSE, D-002).
- Si la longueur est inférieure à 100 m, l'écart entre les lignes de 10 m et de 22 m est réduit d'autant : les lignes de 22 m restent à 22 m de la ligne de but, les lignes de 10 m à 10 m de la médiane. Si la largeur est inférieure à 70 m, l'écart entre les deux lignes de 15 m est réduit d'autant : elles restent à 15 m de la ligne de touche (Règle 1.3, établi).

### 13.2 Thèmes

- « Écran » (défaut) ; « Contraste fort » (aplats saturés, traits d'au moins 3 px à l'échelle 1, aucune texture : base des exports) ; « Impression N&B » (lot 2).
- Couleurs d'équipe par défaut : bleu (A), orange (B).

### 13.3 Conventions de tracé

| Élément | Tracé |
|---|---|
| Course | Trait plein fléché |
| Passe | Pointillés fléchés |
| Jeu au pied | Tirets longs, ombre au sol |
| Course groupée | Trait plein double |
| Ligne d'avantage | Tirets fins |
| Ligne de hors-jeu | Tirets fins d'une autre couleur |

## 14. Valeurs par défaut et hypothèses

| Paramètre | Valeur | Statut |
|---|---|---|
| Terrain | 100 x 70 m, en-buts 10 m | Établi (dans les limites de la Règle 1) |
| Intervalle des tirets du terrain | 5 m | Hypothèse |
| Écartement des poteaux | 5,6 m | Hypothèse |
| Placements de départ | A sur x = 40 m, B sur x = 50 m, tous les 10 m depuis y = 5 m | Choix de l'utilisateur (D-008) |
| Décalage de Ctrl+D | 2 m | Hypothèse |
| Allures | 2 / 4 / 7 m/s | Hypothèse |
| Vitesse de passe | 12 m/s | Hypothèse |
| Seuil d'en-avant | 0,5 m/s | Hypothèse |
| Durée d'un regroupement | 3 s | Établi (fourni par l'utilisateur) |
| Position de relais | 1 m derrière le ballon | Hypothèse |
| Temps de vol au pied | 3,0 s (renvoi), 3,5 s (long) | Hypothèse |
| Ramassage d'un ballon au sol | 1 m | Hypothèse |
| Consigne, longueur conseillée | 60 caractères | Hypothèse |
| Marge du cadrage automatique | 5 m | Hypothèse |
| Sauvegarde automatique | 2 s après la dernière modification | Hypothèse |
| Relecture du dossier | 30 s, fenêtre visible | Hypothèse |
| GIF standard | 540 px de petit côté, 12 images/s | Hypothèse |
| GIF haute qualité | 720 px de petit côté, 15 images/s | Hypothèse |
| Alerte de poids GIF | 8 Mo | Hypothèse |
| Vignette PDF minimale | 60 mm | Hypothèse |
| Défense : montée, accélération | 6 m/s, 4 m/s² | Hypothèse |
| Défense : tolérance de ligne | 1,5 m | Hypothèse |
| Défense : profondeur d'alignement | 1 m | Hypothèse |
| Défense : épaule intérieure | 0,5 m | Hypothèse |
| Défense : réintégration | 2 s | Hypothèse |
| Défense : balayeur | 10 m derrière la ligne | Hypothèse |
| Défense : garde | 1 m du bord, prise au ras à moins de 5 m | Hypothèse |
| Défense : contact, franchissement | 1 m, 1,5 m | Hypothèse |
| Défense : anticipation de poursuite | 0,3 s | Hypothèse |

## 15. Sources

Règles World Rugby :
- Règle 1, terrain : https://passport.world.rugby/laws-of-the-game/laws-by-number/1-the-ground/
- Règle 15, ruck : https://passport.world.rugby/laws-of-the-game/laws-by-number/15-ruck/
- Règle 16, maul : https://passport.world.rugby/laws-of-the-game/laws-by-number/16-maul/
- Règle 18, touche : https://passport.world.rugby/laws-of-the-game/laws-by-number/18-touch-quick-throw-and-lineout/
- Règle 19, mêlée : https://passport.world.rugby/laws-of-the-game/laws-by-number/19-scrum/
- Variantes à 7, mêlée : https://passport.world.rugby/laws-of-the-game/variations-7s-10s-u19-game-on/sevens/19-scrum/
- Variantes à 7, touche : https://passport.world.rugby/laws-of-the-game/variations-7s-10s-u19-game-on/sevens/18-touch-quick-throw-and-lineout/

En-avant :
- Protocole TMO (le ballon jugé depuis les mains, sans tenir compte de sa trajectoire) : https://amp.rugby365.com/laws-referees/law-discussions/law-discussion-forward-passes
- Repères de mouvement et passe : https://condensed-matter.blogs.auckland.ac.nz/?p=344

Défense :
- Défense individuelle, « chacun prend un joueur » : https://madoc.univ-nantes.fr/mod/resource/view.php?id=338047
- Rideau défensif autour des regroupements : https://sport.univ-lille.fr/fileadmin/user_upload/sites_services/sport/docs-pdf/Fiches_p%C3%A9da/Rugby__pdf.21ko_.pdf
- Six en ligne et un balayeur : https://en.wikipedia.org/wiki/Rugby_sevens
- Couloirs, balayeur, absence de hors-jeu en jeu courant : https://www.rugbytoolbox.co.nz/the-game/other-rugby-formats/sevens/defence-principle-two-go-forward
- Épaule intérieure, intérieur vers extérieur : https://rugbytoolbox.co.nz/the-game/other-rugby-formats/sevens/sevens-defence-activities
- Rotation du balayeur, retour sur la ligne de hors-jeu : https://rugbytoolbox.co.nz/resources-education/learn-more/articles/snook-on-coaching/sevens-defence
- Homme à homme puis glissement : https://www.sportplan.net/sketches/Rugby/openSketch/3572872
- Sept en ligne, défense « pendule » : https://www.rugbyworld.com/tournaments/sevens-world-series/modern-sevens-tactics-explained-what-to-look-out-for-at-the-olympic-games-167654
- Gardes autour du ruck : https://www.rugbycoachweekly.net/rugby-drills-and-skills/rucking-mauling/rugby-coaching-tips-on-defending-close-to-the-ruck/
- Rôles des deux premiers défenseurs : https://www.rugbycoachweekly.net/rugby-drills-and-skills/defence/the-8-basics-of-ruck-defence
- Nombre de joueuses au ruck à 7 : https://www.rugbycoachweekly.net/rugby-drills-and-skills/touch-tag-sevens/disrupt-opponents-with-an-attack-dog

Technique :
- showDirectoryPicker, Chrome oui, Firefox non : https://web.dev/articles/files/open-a-directory
- Permissions persistantes « Autoriser à chaque visite » (Chrome 122) : https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api
- Permissions retirées à la fermeture des onglets, Safari et Firefox non pris en charge : https://assets.transloadit.com/devtips/persistent-file-handling-with-the-file-system-access-api/
- gifenc : https://github.com/mattdesl/gifenc
- jsPDF, contexte 2D : https://cdn.jsdelivr.net/gh/MrRio/jsPDF@master/docs/module-context2d.html
- WhatsApp ré-encode les GIF en MP4 : https://git.deuill.org/deuill/slidge-whatsapp/commits/branch/master/docs
- Seuil de 3,5 Mo (WhatsApp Business) : https://www.spurnow.com/fr/tools/gif-to-mp4-converter
- GitHub Pages, URL de projet et dépôts privés : https://github.com/orgs/community/discussions/23525
- Drive pour ordinateur, miroir et diffusion : https://support.google.com/drive/answer/13401938
- Drive, versions de fichiers : https://support.google.com/drive/answer/2409045
- Copies de conflit des clients de synchronisation : https://www.digitalcitizen.life/cloud-sync-conflicts-explained-why-files-duplicate-or-overwrite-themselves/

## 16. Journal des décisions (14 octobre 2026)

1. Rugby à 7 ; jetons numérotés seulement ; attaque et défense.
2. Édition sur PC uniquement ; aucune version mobile ; diffusion par GIF et PDF via WhatsApp.
3. Un seul utilisateur, deux PC ; synchronisation par dossier Google Drive dans Chrome.
4. Hébergement GitHub Pages, dépôt `Abla_rckF7_tac`.
5. Temps en arbre (options selon la défense).
6. Calques de lecture : traces, consigne, ligne d'avantage.
7. GIF : orientation et mode des options au choix ; ralenti puis vitesse réelle ; titre, numéro du temps, consigne, pause finale.
8. PDF : vignettes par temps, consignes et notes, cahier de jeu ; options sur une page ; mises en page téléphone et impression ; couleur ou N&B.
9. Modèles de placement enregistrés par l'utilisateur, à la place de placements fournis.
10. Jeu au pied : coup d'envoi/renvoi et long/recentrage.
11. Regroupement : attaque plaquée, soutien, relayeur ; défense plaqueur et gratteur ou garde ; garde côté ouvert ; maul identique ; durée 3 s.
12. Défense simulée : « chacun le sien », 6+1 ou 7 en ligne au choix.
13. Ateliers : plots, coupelles, boucliers, sacs, piquets, zones cotées ; un ballon ; pas de rotation.
14. Terrain standard.
15. Décisions prises pendant le lot 1 : `docs/DECISIONS.md`, entrées D-001 à D-045.
