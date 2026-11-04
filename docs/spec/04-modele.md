## 4. Modèle de données (schemaVersion 5)

### 4.1 Types

```ts
type Team = 'A' | 'B'
type Vec2 = { x: number; y: number }      // mètres, repère terrain (4.2)
type Id = string                          // UUID v4

interface Play {
  schemaVersion: 5                        // frise chronologique (D-139) ; versions antérieures refusées (4.4)
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
  branches: Branch[]                      // au moins la racine
  actions: Action[]                       // tableau plat ; son ordre départage les égalités
  sequences: Sequence[]
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

/** Tronçon de la frise, entre deux embranchements. */
interface Branch {
  id: Id
  parentId: Id | null                     // null pour la racine
  branchAt?: number                       // présent si elle se divise : instant absolu de l'embranchement (s)
  branchAtGlue?: GlueRef                  // embranchement collé à un événement du tronc (5.8)
  label: string                           // vide : « Option A », lettre calculée (D-012)
  condition: string                       // texte de l'option, vide pour la racine
  isDefault: boolean
}

/** Collage d'un bord à un événement de la même ligne (5.8). */
interface GlueRef {
  targetId: Id                            // action, séquence ou branche qui se divise (4.3)
  event: 'start' | 'end' | { point: number }
    // start : départ d'une course, lâcher, formation, début de séquence
    // end : fin d'une course, arrivée d'une passe ou d'un jeu au pied, sortie de balle, fin de séquence, embranchement
    // point : index d'un point de passage d'une course
  offset?: number                         // écart >= 0 après l'événement, défaut 0 (« Temps de contrôle » sur une passe et un jeu au pied)
}

interface EndGlue extends GlueRef {
  keep: 'start' | 'duration'              // cible déplacée : le départ reste et la durée s'adapte, ou la durée reste et le départ suit (5.8)
}

/** Commun à toutes les actions et aux séquences. */
interface Timed {
  id: Id
  branchId: Id
  start: number                           // instant absolu (s), >= 0 : départ, lâcher ou formation
  startGlue?: GlueRef                     // bord gauche collé
  endGlue?: EndGlue                       // bord droit collé
}

interface Sequence extends Timed {
  end: number                             // instant absolu de fin (s)
  label: string                           // vide : « Séquence n »
  instruction: string                     // consigne affichée pendant la séquence
}

type Action = RunAction | PassAction
  | KickAction                            // lot 3
  | BreakdownAction                       // lot 3
  | GroupRunAction                        // lot 5

type Pace = 'walk' | 'jog' | 'sprint'
type SpeedValue = Pace | number           // allure nommée, ou vitesse saisie en m/s (D-133)
type SegmentSpeed = SpeedValue            // vitesse d'un segment (lot 3 bis)

/** Point de passage ; `speed` : vitesse du segment qui arrive à ce point (lot 3 bis, D-114). */
interface Waypoint extends Vec2 { speed?: SegmentSpeed }

interface RunAction extends Timed {
  type: 'run'; entityId: Id
  waypoints: Waypoint[]                   // segment i : du point i-1 (départ pour i = 0) au point i
  pace: SpeedValue                        // allure de la course : segments sans `speed`
  durationOverride?: number               // durée imposée (5.3, D-107)
}

interface PassAction extends Timed {
  type: 'pass'; fromId: Id; toId: Id; ballSpeed?: number
}
```

Libellés d'interface des catégories : `scrum` mêlée, `lineout` touche, `restart` coup d'envoi/renvoi, `phasePlay` ruck/jeu courant, `drill` exercice.

Les types marqués lot 4 et 5 sont déclarés dans le code et présents dans les unions, mais le schéma zod les rejette, comme `defenseSettings` : ils arriveront avec une nouvelle version du schéma et sa migration. Le moteur les ignore en le signalant (D-004). La version 5 (frise, D-139) accepte `KickAction` et `BreakdownAction` (10.3, 10.4), les vitesses de segment et les vitesses saisies en m/s (D-114, D-133) ; un fichier d'une version antérieure est refusé, jamais migré (4.4, 4.5).

Précisions :
- `setup.positions` ne contient que les joueuses ; le ballon au départ est donné par `ballCarrierId` ou `ballPosition`. `ballPosition` sans porteuse est le ballon au sol au départ : éditable depuis le lot 3 (« Poser le ballon au sol », déplacé à la souris, curseur à 0) et ramassé comme après un jeu au pied (D-007, D-083, D-095).
- `Branch.label` vide : libellé calculé ; non vide : libellé saisi (D-012). Le libellé et la condition d'une option sont portés par sa branche.
- Une branche couvre `[branchAt du parent, son propre branchAt[` : la racine part de 0, une feuille va jusqu'à la fin de la ligne.
- Champ que règle le bord droit : durée imposée (`durationOverride`) d'une course, vitesse du ballon (`ballSpeed`) d'une passe, temps de vol (`flightTime`) d'un jeu au pied, sortie de balle (`duration`) d'un regroupement, `end` d'une séquence.
- Un bord collé garde sa dernière valeur dans `start` ou dans le champ de son bord droit : c'est le repli quand le collage est ignoré. Décoller un bord ou supprimer sa cible ne fait jamais bouger le bloc : la valeur calculée à cet instant y est écrite (5.8).
- Un embranchement peut être une cible : `targetId` est alors l'id de la branche qui se divise, et `event` vaut `end`.
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
- Exactement une branche racine. Tout `parentId` existe. Pas de cycle.
- `branchAt` présent si et seulement si la branche a des enfants ; strictement croissant le long d'une ligne. Au moins deux options par embranchement, exactement une `isDefault`.
- Une action référence des entités existantes ; une course ne cible qu'une joueuse. Une action ou une séquence référence une branche existante.
- Numéros en double dans une équipe : avertissement, pas d'erreur (D-016). Dimensions du terrain hors des bornes de la Règle 1 : avertissement (D-017).
- Une action ou une séquence reste dans sa branche ; sinon, signalée, avec ce repli du moteur (D-139) :
  - action d'une option qui démarre avant l'embranchement : elle part à l'embranchement, sinon le tronc changerait ;
  - action du tronc qui démarre à l'embranchement ou après : elle reste commune ;
  - séquence qui traverse un embranchement : coupée à l'embranchement ;
  - deux séquences d'une même ligne qui se chevauchent : la seconde part à la fin de la première.
- Repli du moteur : deux courses d'une joueuse qui se chevauchent dans une ligne, la seconde part à la fin de la première, alerte « départ retardé de x s » ; course d'une participante qui démarre pendant un regroupement, retardée à la sortie de balle, même alerte (5.3) ; passe vers l'autre équipe, exécutée et signalée ; passeuse sans ballon au lâcher, passe ignorée et signalée ; deux passes au même instant de lâcher, seule la première s'applique (D-013, D-139).
- Lot 3 : participantes d'un regroupement inexistantes ou en double, soutien ou relayeur d'une autre équipe que la plaquée, cible d'un jeu au pied inexistante, frappeuse qui se vise elle-même : signalés. Repli du moteur : jeu au pied d'une frappeuse sans ballon, ignoré et signalé ; regroupement dont la plaquée n'a pas le ballon à la formation, ignoré entièrement et signalé ; une passe et un jeu au pied lâchés au même instant suivent la règle des passes simultanées (D-079, D-094).
- Collage (D-139) : la cible doit être dans la même ligne, c'est-à-dire dans la branche du bord ou l'une de ses ancêtres ; un bord du tronc ne se colle jamais à un événement d'une option. Collage dont la cible n'existe pas ou n'est pas dans la ligne, de type incompatible avec l'événement, dont l'index de point n'existe pas, qui vise son propre bloc, ou qui forme un cycle : refusé avec message à la pose ; dans un fichier, signalé et ignoré par le moteur (5.8). Le graphe des dépendances (`model/syncGraph.ts`) couvre tous les bords, séquences et embranchements compris. Il relie : un bord collé à sa cible ; l'arrivée d'une passe à son lâcher et aux courses de la passeuse et de la receveuse ; l'arrivée d'un jeu au pied à son lâcher. La course d'une receveuse collée à l'arrivée de la passe qu'elle reçoit ne dépend que du lâcher et de la course de la passeuse : la passe arrive au point de rendez-vous quand elle y arrive (lâcher + distance / vitesse du ballon). Seul un cycle qui passe par un collage est une erreur (D-108, D-110).
- Les invalidités n'interrompent jamais le programme : elles sont listées et affichées sur l'élément concerné.

### 4.4 Fichiers

- Combinaison : `combinaisons/<nom-court>--<id>.combi.json`. Le nom court est le nom en minuscules, sans accents, chaque suite de caractères autres que lettres et chiffres remplacée par un tiret, sans tiret au début ni à la fin, 40 caractères au plus ; un nom vide donne `sans-nom` (D-023).
- Lot de combinaisons (import/export manuel) : `.combipack.json`, tableau de `Play`.
- Modèle de placement (lot 3) : `modeles/<nom-court>--<id>.preset.json`, format `PlacementPreset` version 1 (10.1) ; lu, écrit, renommé et mis en corbeille comme une combinaison (D-092).
- Réglages : `reglages.json` à la racine du dossier, synchronisé entre les deux PC (allures, vitesse de passe, thème, préférences d'export, réglages de défense par défaut). Version 1 (lot 1) : allures, vitesse de passe, thème (D-026). Version 2 (lot 2) : plus les préférences d'export (GIF : orientation, options, vitesse, qualité, thème, allègement ; PDF : mise en page, couleur) ; un fichier en version 1 est migré en mémoire à la lecture et réécrit en version 2 au prochain enregistrement des réglages (D-068, D-072). Version 3 (lot 3 bis) : plus le profil de vitesse (`motion` : accélération, freinage, accélération latérale, en m/s²) et les seuils de vitesse (`speedAlert` : orange et rouge, en m/s) ; migration des versions 1 et 2 avec les valeurs par défaut ; un sprint à 7 m/s exactement (ancien défaut) devient 5,5 m/s, avec un message affiché une fois par poste (mémorisé dans le navigateur), même tant que le fichier reste dans sa version d'origine (D-105, D-111, D-121). Version 4 (lot 3bis-1) : plus la pointe de la joueuse (`motion.topSpeed`, m/s) et les seuils d'accélération et de freinage (`accelAlert`, `decelAlert` : orange et rouge, en m/s²) ; migration de la version 3 : une valeur de `motion` égale à l'ancien défaut (accélération 3, freinage 4, latérale 4 m/s², `LEGACY_MOTION`) prend le défaut calibré (5.3), avec un message unique par poste qui liste les valeurs changées ; toute autre valeur est gardée ; versions 1 et 2 migrées jusqu'à la version 4 avec les valeurs par défaut (D-134, D-135). Un `reglages.json` invalide ou d'une version plus récente n'est jamais réécrit.
- Combinaison d'une version antérieure à 5 : refusée avec un message clair, jamais modifiée ni déplacée (règle 9 de `CLAUDE.md`), dans le dossier comme dans le stockage du navigateur, import d'un lot compris (D-139). `reglages.json` n'est pas concerné.
- Lecture : validation zod, puis migrations successives jusqu'à la version courante, à partir de la v5 (4.5). Un fichier invalide est signalé et n'est jamais modifié ni déplacé automatiquement. Un fichier qui contient une clé inconnue est invalide ; un fichier d'une version plus récente que l'application est signalé (« recharger la page ») et jamais modifié (D-024).
- Écriture : JSON indenté de 2 espaces, clés dans un ordre stable, alphabétique (différences lisibles dans l'historique Drive, D-040).

### 4.5 Migrations

- À partir de la v5, toute modification du schéma incrémente `schemaVersion`, ajoute une fonction de migration `vN -> vN+1`, une fixture de la version précédente et un test de migration.
- Version 5 (frise, D-139) : **aucune migration**, seule exception à cette règle : les combinaisons existantes sont jetables, un fichier antérieur est refusé (4.4). Migrations v1 à v4, `schemaV0` à `schemaV3` et fixtures `play-v0` à `play-v4` supprimés. Fixture figée `play-v5-frise.json`, pour les migrations des lots 4 et 5.
- `reglages.json` garde ses versions, ses migrations et ses fixtures `reglages-v*` (4.4).

