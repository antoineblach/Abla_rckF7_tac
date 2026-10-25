## 4. Modèle de données (schemaVersion 3)

### 4.1 Types

```ts
type Team = 'A' | 'B'
type Vec2 = { x: number; y: number }      // mètres, repère terrain (4.2)
type Id = string                          // UUID v4

interface Play {
  schemaVersion: 3                       // 1 aux lots 1 et 2, 2 au lot 3 (D-094, D-104)
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

type Action = RunAction | PassAction
  | KickAction                            // lot 3
  | BreakdownAction                       // lot 3
  | GroupRunAction                        // lot 5

type Pace = 'walk' | 'jog' | 'sprint'
type SegmentSpeed = Pace | number         // allure nommée, ou vitesse en m/s (lot 3 bis)

/** Point de passage ; `speed` : vitesse du segment qui arrive à ce point (lot 3 bis, D-114). */
interface Waypoint extends Vec2 { speed?: SegmentSpeed }

interface RunAction {
  id: Id; type: 'run'; entityId: Id
  waypoints: Waypoint[]                   // segment i : du point i-1 (départ pour i = 0) au point i
  pace: Pace                              // allure de la course : segments sans `speed`
  durationOverride?: number               // durée imposée (5.3, D-107)
  delay: number                           // ignoré tant qu'un lien en départ différé s'applique (5.8)
  endsAtSpeed?: true                      // « Finit lancée » (5.2, D-106)
  sync?: RunSync                          // lien de synchronisation (5.8)
}

interface RunSync {
  target: SyncTarget
  at?: number                             // point de passage de cette course au rendez-vous ; absent : sa fin
  adjust: 'delay' | 'speed'               // départ différé ou vitesse ajustée
}

type SyncTarget =
  | { actionId: Id; event: 'runEnd' }
  | { actionId: Id; event: 'runPoint'; index: number }
  | { actionId: Id; event: 'release' | 'arrival' }   // passe ou jeu au pied
  | { actionId: Id; event: 'formation' }             // regroupement

interface PassAction {
  id: Id; type: 'pass'; fromId: Id; toId: Id; delay: number; ballSpeed?: number
  release?: 'onReceipt'                   // absent : instant fixe ; à la réception + délai (5.4, D-110)
}
```

Libellés d'interface des catégories : `scrum` mêlée, `lineout` touche, `restart` coup d'envoi/renvoi, `phasePlay` ruck/jeu courant, `drill` exercice.

Les types marqués lot 4 et 5 sont déclarés dans le code et présents dans les unions, mais le schéma zod les rejette, comme `defenseSettings` : ils arriveront avec une nouvelle version du schéma et sa migration. Le moteur les ignore en le signalant (D-004). La version 2 (lot 3) accepte `KickAction` et `BreakdownAction` (10.3, 10.4) ; un fichier en version 1 est migré en mémoire sans changement de contenu et réécrit en version 2 au prochain enregistrement (D-094). La version 3 (lot 3 bis) ajoute les vitesses de segment, la course lancée, les liens de synchronisation et le lâcher à la réception (D-104) ; un fichier en version 1 ou 2 est migré en mémoire et réécrit en version 3 au prochain enregistrement (4.5).

Précisions :
- `setup.positions` ne contient que les joueuses ; le ballon au départ est donné par `ballCarrierId` ou `ballPosition`. `ballPosition` sans porteuse est le ballon au sol au départ : éditable depuis le lot 3 (« Poser le ballon au sol », déplacé à la souris au temps 1) et ramassé comme après un jeu au pied (D-007, D-083, D-095).
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
- Lot 3 : participantes d'un regroupement inexistantes ou en double, soutien ou relayeur d'une autre équipe que la plaquée, cible d'un jeu au pied inexistante, frappeuse qui se vise elle-même : signalés. Repli du moteur : jeu au pied d'une frappeuse sans ballon, ignoré et signalé ; regroupement dont la plaquée n'a pas le ballon à la formation, ignoré entièrement et signalé ; une passe et un jeu au pied lâchés au même instant suivent la règle des passes simultanées (D-079, D-094).
- Lot 3 bis : lien de synchronisation dont la cible n'existe pas ou n'est pas dans le même temps (« cible supprimée »), de type incompatible avec l'événement, dont l'index de point n'existe pas, qui vise sa propre course, ou qui forme un cycle avec d'autres liens : signalé ; le moteur l'ignore (5.8). Le graphe des dépendances (`model/syncGraph.ts`) relie : un lien à sa cible ; l'arrivée d'une passe à son lâcher et aux courses de la passeuse et de la receveuse ; l'arrivée d'un jeu au pied à son lâcher ; un lâcher à la réception à tout ce qui peut amener le ballon à la joueuse dans le temps. La course d'une receveuse calée sur l'arrivée de la passe qu'elle reçoit ne dépend que du lâcher et de la course de la passeuse : la passe arrive au point de rendez-vous quand elle y arrive (lâcher + distance / vitesse du ballon). Seul un cycle qui passe par un lien de course est une erreur (D-108, D-110).
- Les invalidités n'interrompent jamais le programme : elles sont listées et affichées sur l'élément concerné.

### 4.4 Fichiers

- Combinaison : `combinaisons/<nom-court>--<id>.combi.json`. Le nom court est le nom en minuscules, sans accents, chaque suite de caractères autres que lettres et chiffres remplacée par un tiret, sans tiret au début ni à la fin, 40 caractères au plus ; un nom vide donne `sans-nom` (D-023).
- Lot de combinaisons (import/export manuel) : `.combipack.json`, tableau de `Play`.
- Modèle de placement (lot 3) : `modeles/<nom-court>--<id>.preset.json`, format `PlacementPreset` version 1 (10.1) ; lu, écrit, renommé et mis en corbeille comme une combinaison (D-092).
- Réglages : `reglages.json` à la racine du dossier, synchronisé entre les deux PC (allures, vitesse de passe, thème, préférences d'export, réglages de défense par défaut). Version 1 (lot 1) : allures, vitesse de passe, thème (D-026). Version 2 (lot 2) : plus les préférences d'export (GIF : orientation, options, vitesse, qualité, thème, allègement ; PDF : mise en page, couleur) ; un fichier en version 1 est migré en mémoire à la lecture et réécrit en version 2 au prochain enregistrement des réglages (D-068, D-072). Version 3 (lot 3 bis) : plus le profil de vitesse (`motion` : accélération, freinage, accélération latérale, en m/s²) et les seuils de vitesse (`speedAlert` : orange et rouge, en m/s) ; migration des versions 1 et 2 avec les valeurs par défaut ; un sprint à 7 m/s exactement (ancien défaut) devient 5,5 m/s, avec un message unique à l'ouverture (D-105, D-111). Un `reglages.json` invalide ou d'une version plus récente n'est jamais réécrit.
- Lecture : validation zod, puis migrations successives jusqu'à la version courante. Un fichier invalide est signalé et n'est jamais modifié ni déplacé automatiquement. Un fichier qui contient une clé inconnue est invalide ; un fichier d'une version plus récente que l'application est signalé (« recharger la page ») et jamais modifié (D-024).
- Écriture : JSON indenté de 2 espaces, clés dans un ordre stable, alphabétique (différences lisibles dans l'historique Drive, D-040).

### 4.5 Migrations

- Toute modification du schéma incrémente `schemaVersion`, ajoute une fonction de migration `vN -> vN+1`, une fixture de la version précédente et un test de migration.
- Une fixture « version 0 » fictive est fournie dès le lot 1 pour éprouver le mécanisme.
- Version 2 (lot 3) : migration v1 vers v2 sans changement de contenu ; fixtures figées `play-v1-7v7-options.json` (migration) et `play-v2-lot3.json` (D-094).
- Version 3 (lot 3 bis) : migration v2 vers v3 ; contenu identique, plus `endsAtSpeed: true` sur chaque course que toutes les options du temps suivant prolongent (même joueuse, première course du temps, délai 0), règle structurelle sans moteur ; aucune migration vers le lâcher à la réception. Fixtures figées `play-v2-lot3.json` (migration) et `play-v3-lot3bis.json` (pour les migrations des lots 4 et 5) ; `reglages-v2.json` pour les réglages (D-104).

