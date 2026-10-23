# Spécification : outil de combinaisons de rugby à 7 (Abla_rckF7_tac)

Version 1.6 du 23 octobre 2026 (décisions du lot 1, de sa correction après recette, des lots 2 et 3, de la correction après recette du lot 3 et du plan du lot 3 bis intégrées, voir `docs/DECISIONS.md`, D-001 à D-118). Ce document est la source de vérité du projet. À placer dans `docs/SPEC.md`.
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
- Lot 2 : gifenc (encodage GIF), jsPDF (PDF), chargés seulement dans le Web Worker d'export (D-076, D-077).
- Tests : Vitest (unitaires), Playwright (bout en bout, Chromium et Firefox) ; pdf.js (`pdfjs-dist`) et omggif relisent les PDF et GIF produits (D-070).
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
  export/                   (lot 2) noms, lisibilité, cadrage ; gif/, pdf/, worker/ (protocole, Worker)
  ui/                       composants React
  state/                    stores Zustand, session (D-027)
  types/                    déclarations d'API du navigateur et de gifenc (D-027)
  test/                     outils de test et fixtures, jamais importés par l'application (D-027)
```

Les tests de bout en bout sont dans `e2e/`, à la racine du dépôt (D-027).

### 3.3 Principes d'architecture

1. **Pureté.** `evaluate(play, branchPath, t, settings, caches) -> SceneState` est une fonction pure (`settings` : allures, vitesse de passe, profil de vitesse et seuils de vitesse de `reglages.json`, D-003, D-105, D-111) : aucune lecture d'horloge, aucun aléa, aucun état global. Les caches sont passés en paramètre et indexés par un hachage du contenu.
2. **Rendu unique.** `render(ctx, state, viewport, theme, layers)` dessine une image. `renderSchematic(ctx, play, branchPath, phaseId, viewport, theme, settings, caches)` dessine un temps à l'arrêt (D-003). Les deux fonctionnent sur un canvas affiché, sur un `OffscreenCanvas` et sur tout objet compatible avec le contexte 2D, dont celui de jsPDF : aucun chemin n'y est construit sous une transformation (ballon en courbes de Bézier) et les vignettes y sont découpées explicitement (D-071).
3. **Aplats uniquement.** Le rendu n'utilise ni dégradé, ni motif, ni flou d'ombre. Raison : le contexte 2D de jsPDF ne gère ni dégradés ni motifs en trait (établi), et les GIF sont limités à une palette.
4. **Viewport.** Seule couche qui connaît les pixels. Il gère la conversion mètres vers pixels, le cadrage (terrain complet, demi-terrain, cadre libre, cadrage automatique) et l'orientation (paysage : terrain fixe, x vers la droite, sens d'attaque montré par des flèches sur la ligne d'avantage ; portrait avec rotation de 90° et attaque vers le haut de l'image ; carré comme le portrait). Une rotation supplémentaire de 180° existe : les GIF paysage attaquent toujours vers la droite (D-006). Des marges intérieures cadrent le terrain d'un GIF sous son en-tête et son bandeau (D-073).
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
- Lot 3 bis : lien de synchronisation dont la cible n'existe pas ou n'est pas dans le même temps (« cible supprimée »), de type incompatible avec l'événement, dont l'index de point n'existe pas, qui vise sa propre course, ou qui forme un cycle avec d'autres liens : signalé ; le moteur l'ignore (5.8). Le graphe des dépendances (`model/syncGraph.ts`) relie : un lien à sa cible ; l'arrivée d'une passe à son lâcher et aux courses de la passeuse et de la receveuse ; l'arrivée d'un jeu au pied à son lâcher ; un lâcher à la réception à tout ce qui peut amener le ballon à la joueuse dans le temps. Seul un cycle qui passe par un lien de course est une erreur (D-108, D-110).
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

## 5. Moteur

### 5.1 Lignes et temps

- Une **ligne** est un chemin de la racine à une feuille de l'arbre (`branchPath`).
- Durée d'une phase = `max(delay + durée)` de ses actions, 0 si aucune action : une course compte jusqu'à la fin de son profil de vitesse (5.3), une passe ou un jeu au pied jusqu'à son arrivée, un regroupement jusqu'à la sortie de balle, une course arrêtée par un regroupement jusqu'à son arrêt (D-094). Durée d'une ligne = somme des durées de ses phases.
- Les actions d'une phase démarrent ensemble au début de la phase, décalées de leur `delay` ; une course liée en départ différé démarre au délai calculé (5.8) ; un lâcher à la réception a lieu à la réception du ballon, plus son délai (5.4).

### 5.2 Continuité

- La position de départ d'une entité au début d'une phase est sa position finale dans la phase parente (ou `setup.positions` pour la racine).
- Le premier point d'une course n'est pas stocké : c'est cette position de départ. Modifier une phase n'altère jamais les points de passage de ses descendantes ; seul leur point de départ se déplace.
- Toutes les options héritent du même tronc : pour un même `t` dans le tronc, toutes les lignes donnent le même état.
- **Course qui finit lancée** (lot 3 bis, D-106) : drapeau explicite « Finit lancée » (`endsAtSpeed`), qui ne dépend que de la phase où est la course.
  - La course finit à la vitesse de son dernier segment au lieu de freiner jusqu'à l'arrêt.
  - Sans effet si elle finit avant la fin de sa phase (la joueuse attend la fin des autres actions) : freinage normal, sans alerte, avec la mention « Sans effet : attente de x s avant le temps suivant ». Calcul en deux passes : phase compilée avec les courses lancées, puis recompilée avec un freinage normal pour celles qui finissaient avant la fin de la phase ; pas de nouvelle bascule.
  - Prolongée dans la phase suivante d'une ligne quand la joueuse y a sa première course avec un délai effectif nul (lien compris) : cette course part à la vitesse de fin, et dans la direction d'arrivée de la course parente : son premier segment devient une courbe de Bézier cubique dont la tangente de départ est celle d'arrivée de la course parente et la tangente au premier point celle de la spline d'origine. Ses points de passage et la phase parente ne changent pas.
  - Non prolongée (aucune course, ou délai effectif positif) : arrêt net à la frontière des phases dans cette option, avertissement sur la course lancée nommant l'option ; aucune alerte dans une feuille.
  - Un départ différé qui prolonge une course lancée est calculé d'abord avec le départ lancé ; si le délai est positif, il est recalculé avec un départ arrêté.
  - Posé automatiquement par la migration v2 vers v3 (4.5) et par l'outil Course (6.2), modifiable dans l'inspecteur.

### 5.3 Trajectoires

- Spline de Catmull-Rom centripète (alpha 0,5) passant par le point de départ et les points de passage ; table de longueurs d'au moins 64 échantillons par segment (abscisse curviligne). Premier segment raccordé quand la course prolonge une course lancée (5.2).
- **Profil de vitesse** (lot 3 bis, D-105) : trapèze généralisé calculé sur ces échantillons.
  - Plafond à chaque échantillon : la vitesse cible de son segment, et `sqrt(accélération latérale / courbure)` borné en bas par la vitesse minimale en virage (courbure par le cercle de trois échantillons voisins).
  - Départ à l'arrêt, ou à la vitesse de fin de la course lancée qu'elle prolonge ; arrivée à l'arrêt, ou au plafond si elle finit lancée.
  - Passe avant (accélération bornée), puis passe arrière (freinage borné) ; la vitesse de départ imposée prime.
  - Temps de chaque intervalle à accélération constante ; position, vitesse et instant de passage à un point en formule fermée : une lecture continue et un saut direct à `t` donnent le même état.
  - Valeurs (HYPOTHÈSES) : accélération 3 m/s², freinage 4 m/s², accélération latérale 4 m/s², réglables dans `reglages.json` ; vitesse minimale en virage 1 m/s.
- **Vitesse d'un segment** (D-114) : celle du point qui le termine (`Waypoint.speed`, allure ou m/s), sinon l'allure de la course. C'est une vitesse de pointe : la durée découle du profil.
- **Facteur de vitesse** : un même solveur multiplie les vitesses cibles d'un ensemble de segments pour qu'un point soit atteint à un instant donné (dichotomie à nombre fixe d'itérations ; plafond : vitesse cible maximale égale au seuil rouge, 5.9). Il sert à la durée imposée, à la vitesse ajustée (5.8) et au relayeur en retard (10.3).
- **Durée imposée** (`durationOverride`, D-107) : toutes les vitesses de la course sont multipliées par un même facteur pour qu'elle dure exactement cette durée, profil compris ; alerte si elle est inatteignable sous le seuil rouge. Exclusive avec un lien en vitesse ajustée.
- Allures par défaut : marche 2 m/s, trot 4 m/s, sprint 5,5 m/s (HYPOTHÈSE, réglables dans `reglages.json` ; 7 m/s avant le lot 3 bis, D-111).
- Une entité sans action dans une phase reste immobile.
- Deux courses de la même entité dans la même phase : invalide, signalé ; seule la première s'applique (D-013).

### 5.4 Ballon

- Jamais positionné à la main pendant l'animation. État dérivé :
  - `carried(entityId)` : dessiné contre le jeton de la porteuse ;
  - `inFlight(fromPos, releaseT, arrivalT, toId | toPos)` ;
  - `loose(pos)` : au sol, après un jeu au pied vers un point ou au départ ; ramassé par la première joueuse de l'une ou l'autre équipe à moins de 1 m, qui devient porteuse ; la recherche continue dans les temps suivants (D-083) ;
  - `inBreakdown(pos)` : dans un regroupement, de la formation à la sortie de balle (10.3).
- Passe : départ à la position de la passeuse à l'instant du lâcher ; arrivée à la position de la receveuse évaluée à `arrivalT`. Vol rectiligne à vitesse constante. `arrivalT = releaseT + distance / ballSpeed`, résolu par point fixe (5 itérations, D-037 ; convergence tant que la receveuse est plus lente que le ballon ; le ballon finit toujours exactement sur la receveuse). Vitesse de passe par défaut 12 m/s (HYPOTHÈSE).
- Validations : passe vers l'autre équipe ; passeuse sans ballon au lâcher ; deux passes simultanées du même ballon (même instant de lâcher) ; frappeuse sans ballon ; plaquée sans ballon à la formation. Chaque cas est signalé sur l'action ; repli du moteur : voir 4.3 (D-013, D-094).
- Ordre des événements (lot 3) : lâchers de passe, frappes au pied et formations de regroupement sont traités dans l'ordre chronologique ; arrivées, sorties de balle et ramassages sont résolus entre deux événements ; le ramassage est cherché à pas fixe de 1/100 s puis par bissection (D-094). Lot 3 bis : file d'événements ; une transition (arrivée, sortie, ramassage) est résolue avant tout événement de même instant ou plus tardif ; une réception peut programmer un lâcher (ci-dessous).
- **Lâcher d'une passe ou d'un jeu au pied** (lot 3 bis, D-110), deux modes enregistrés dans l'action :
  - à un instant fixe (`release` absent) : début de la phase + délai. Tolérance : si la joueuse n'a pas le ballon à cet instant mais le reçoit au plus 0,5 s après (HYPOTHÈSE), le lâcher a lieu à la réception, sans alerte, l'instant réel étant affiché ; au-delà, passe ignorée et signalée (D-013) ;
  - à la réception (`release: 'onReceipt'`) : à l'instant où la joueuse reçoit le ballon dans la phase (arrivée d'une passe ou d'un jeu au pied vers elle, sortie d'un regroupement dont elle est le relayeur), plus le délai (temps de contrôle, >= 0). Les lâchers à la réception d'une même joueuse prennent ses réceptions dans l'ordre chronologique, dans l'ordre du tableau. Sans réception dans la phase : ignoré et signalé (sans ballon). Pas de tolérance.

### 5.5 Traces

- Calculées depuis la géométrie : portion de trajectoire parcourue à l'instant `t`. Jamais accumulées image par image : une lecture continue et un saut direct à `t` donnent la même image.
- Passes déjà effectuées tracées en pointillés ; pendant le vol, la portion parcourue aussi (D-019).

### 5.6 Ligne d'avantage

- Ligne parallèle aux lignes de but, à l'abscisse du ballon à `t = 0`.
- Des flèches sur la ligne d'avantage montrent le sens d'attaque ; elles s'inversent quand l'équipe qui attaque change (D-006).
- Recalée à l'abscisse du point de regroupement à chaque formation de ruck ou de maul (lot 3), fixe sinon. En mode schéma (éditeur, vignettes, PDF) : celle en vigueur au début du temps affiché (D-082).

### 5.7 Contrôle d'en-avant (lot 3)

- Principe établi : une passe est jugée en avant si elle part vers l'avant depuis les mains ; la trajectoire du ballon dans le repère du terrain n'entre pas en compte. On raisonne donc dans le repère de la passeuse.
- Calcul : vitesse du ballon (repère terrain) moins vitesse de la passeuse au lâcher (dérivée de sa trajectoire). Si la composante dans le sens d'attaque dépasse 0,5 m/s (HYPOTHÈSE), la passe est marquée « en avant probable ».
- Sens d'attaque : celui de l'équipe de la passeuse. Vitesse de la passeuse : dérivée à gauche de sa trajectoire au lâcher, lue sur la fin du temps parent pour un lâcher au tout début d'un temps (D-085) ; depuis le lot 3 bis, lue sur le profil de vitesse (5.3).
- C'est une aide visuelle, jamais un blocage.

### 5.8 Synchronisation et rendez-vous (lot 3 bis)

- **Lien** (`RunSync`, D-108) : permanent, entre une course et une autre action de la même phase ; la course liée suit quand l'autre action change.
  - Cible : fin d'une course, point de passage d'une course, lâcher ou arrivée d'une passe ou d'un jeu au pied, formation d'un regroupement.
  - Point de la course liée qui doit coïncider : sa fin, ou l'un de ses points de passage (rendez-vous, `at`).
  - Réglage « Départ différé » : délai calculé = instant de la cible − début de la phase − temps de la course jusqu'au point ; le délai enregistré est ignoré tant que le lien s'applique.
  - Réglage « Vitesse ajustée » : facteur commun (5.3) sur les segments situés avant le point de rendez-vous ; les suivants gardent leurs vitesses ; le délai enregistré s'applique.
- **Résolution** : courses de base avec leurs délais et vitesses enregistrés ; puis courses liées dans l'ordre du graphe des dépendances (4.3) ; pour chacune, simulation de la phase avec les mouvements courants et lecture de l'instant de la cible (arrêt par un regroupement, report et lâcher à la réception compris), puis ajustement ; enfin compilation de la phase. Limite assumée : un lien qui change le ramassage d'un ballon au sol peut décaler une cible déjà résolue ; le résultat reste déterministe.
- **Cas impossibles** : alerte sur la course et dans la liste des actions ; l'édition n'est jamais bloquée.

| Cas | Repli | Alerte |
|---|---|---|
| Délai calculé négatif | départ à 0, arrivée en retard | retard en secondes |
| Vitesse nécessaire au-delà du seuil rouge, ou cible avant le départ | facteur plafonné au seuil rouge | vitesse nécessaire |
| Cible supprimée, de type incompatible, point inexistant, cible jamais atteinte | lien ignoré : délai et vitesses enregistrés | cible supprimée ou invalide |
| Cycle (fichier modifié à la main) | liens du cycle ignorés | cycle |

- **Édition** (D-108, D-109) :
  - création par « Caler sur… » dans l'inspecteur (6.5) ; un lien qui créerait un cycle ou viserait sa propre course est refusé avec un message ;
  - supprimer l'action cible garde le lien (alerte) ; supprimer un point de passage qui porte un lien (rendez-vous ou cible) retire ce lien, avec un message ; « Dupliquer » une phase recopie ses liens vers les copies ;
  - retirer un lien en départ différé fige le délai calculé ; durée imposée et vitesse ajustée s'excluent.
- **Affichage** : quand la course liée ou sa cible est sélectionnée, trait fin en tirets (couleur de sélection) entre le point de rendez-vous et le point de la cible, dans la surcouche d'édition seulement, jamais exporté.

### 5.9 Vitesses irréalistes (lot 3 bis)

- Deux seuils sur la vitesse de pointe réelle (profil) de chaque segment de course, réglables dans `reglages.json` : orange au-delà de 20 km/h (avertissement), rouge au-delà de 25 km/h (erreur) (HYPOTHÈSES, choix du coach, D-111). Jamais bloquant.
- Affichage (D-112) : inspecteur et liste des actions ; pastille ronde orange ou rouge à « ! » au milieu du segment, toujours dans l'éditeur, selon le calque « Vitesses » dans le lecteur ; jamais dans les GIF, les PDF ni les vignettes de la bibliothèque.
- Le seuil rouge plafonne aussi le facteur de vitesse (5.3).

## 6. Éditeur (lot 1)

### 6.1 Disposition de l'écran

- Barre d'outils en haut ; bibliothèque repliable à gauche ; terrain au centre ; inspecteur à droite ; commandes de lecture sous le terrain ; en bas, une bande de hauteur fixe partagée entre l'arbre des temps (à gauche, 2/5 de la largeur) et la liste des actions du temps (à droite, 3/5, 6.7, lot 3 bis, D-113).
- La zone du terrain ne dépend pas du contenu des autres panneaux : barre d'outils, commandes de lecture et arbre des temps ont une hauteur fixe (défilement interne si la place manque) ; bibliothèque et inspecteur ont une largeur fixe avec défilement interne ; bandeau, messages et boutons d'option s'affichent en surimpression du terrain (D-048, D-050).
- L'échelle et le cadrage du terrain ne changent que par une action volontaire : molette, Espace + glisser ou bouton du milieu, choix de la vue enregistrée, orientation, ouverture d'une combinaison, « Ajuster », « Zone utile ». Quand la zone du terrain change de taille (fenêtre redimensionnée, bibliothèque repliée, plein écran), l'échelle et le point central sont conservés (D-048).
- PC uniquement : souris et clavier. Aucune contrainte tactile.

### 6.2 Outils

| Outil | Raccourci | Comportement |
|---|---|---|
| Sélection | V | Clic, multi-sélection au cadre, Maj+clic pour ajouter. Glisser pour déplacer : placements de départ au temps 1, points de passage dans tout temps ; une position héritée d'un temps précédent ne se déplace pas (D-009). Un mouvement de moins de 4 px entre l'appui et le relâchement n'est pas un glisser : le clic sélectionne sans rien déplacer (D-051). |
| Placer joueuse A | A | Clic sur le terrain ; numéro suivant libre ; le clic fixe son placement de départ, quel que soit le temps affiché (D-009). |
| Placer joueuse B | B | Idem pour B. |
| Course | R | Clic sur une joueuse, puis un clic par point de passage ; Entrée ou double clic pour terminer ; Échap pour annuler. Points déplaçables ensuite ; clic droit sur un point pour le supprimer (supprimer le dernier point supprime la course). Sur une joueuse qui court déjà dans le temps, la course est prolongée (D-015). Lot 3 bis : quand la course tracée (délai 0) fait que toutes les options du temps suivant prolongent la course de la joueuse au temps précédent, celle-ci reçoit « Finit lancée », dans la même étape d'annulation (D-106). |
| Passe | P | Clic sur la passeuse, puis sur la receveuse. Lâcher « à la réception », délai 0, quand la passeuse n'a pas le ballon au début du temps ; sinon instant fixe, délai par défaut : instant où elle obtient le ballon dans le temps (D-015, D-110). |
| Jeu au pied | J | Clic sur la frappeuse, puis sur une joueuse (receveuse) ou sur le terrain (point visé, aimanté si la grille est active) ; cliquer à nouveau sur la frappeuse annule. Lâcher comme une passe ; type « Coup d'envoi/renvoi » si la catégorie l'est, sinon « Long/recentrage » (D-093, D-095, D-110). |
| Regroupement | G | Clic sur une joueuse qui a le ballon dans le temps affiché : ruck formé à la fin de sa course (ou à la réception si elle est plus tardive), soutien et relayeur proposés (D-081) ; refus avec message sinon. |
| Supprimer | Suppr | Sur la sélection ; supprimer une joueuse supprime ses courses et les passes, jeux au pied et regroupements qui la concernent, dans tous les temps (D-014). |

Autres raccourcis : Ctrl+D dupliquer les joueuses sélectionnées (numéro suivant libre, décalage de 2 m, sans actions) ; flèches pour décaler de 0,5 m, Maj+flèches de 5 m, sans aimantation (D-015) ; L lecture/pause ; appui bref sur Espace (relâchée sans glisser, en moins de 0,5 s, HYPOTHÈSE) lecture/pause (D-116) ; 1, 2, 3 marche, trot, sprint du segment sélectionné, 0 allure de la course pour ce segment ; sans segment sélectionné, 1, 2, 3 règlent l'allure de la course sélectionnée (D-114) ; F ajuster sur la vue enregistrée (D-049) ; Ctrl+Z / Ctrl+Y ; Ctrl+S enregistrer ; molette pour zoomer ; Espace+glisser ou bouton du milieu pour se déplacer, sans lecture ni pause. Les raccourcis restent actifs quand le focus est sur une case à cocher ou un bouton ; ils sont ignorés dans les champs de texte, les listes et le curseur temporel (D-056). Espace n'active ni ne coche jamais le bouton, la case ou le `summary` qui a le focus (`preventDefault` à l'appui et au relâchement), et elle est ignorée quand un dialogue est ouvert.

Lot 3 bis : un clic sur le trait d'une course sélectionne la course et le segment sous le pointeur ; un point de passage sélectionné désigne le segment qui arrive à ce point (D-114).

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

- Combinaison, en tête, toujours affichée et repliable (état replié mémorisé par poste, D-052) : nom (appliqué à la validation du champ, D-005), catégorie, notes, équipe qui attaque, ajout ou retrait du ballon (D-007), porteuse au départ ou ballon au sol (« Poser le ballon au sol », D-083), « Déplacer la combinaison » et « Retourner » (D-090), dimensions du terrain (bornées à la Règle 1, D-017), vue (cadre libre réglé par « Enregistrer la vue actuelle comme cadre » et des champs numériques, D-019). Choisir la vue enregistrée recadre le terrain sur elle.
- Joueuse : numéro, couleur, mode défense (manuel ; auto au lot 4), porteuse du ballon au départ (D-007).
- Course : allure (avec m/s et km/h), délai (calculé et non modifiable sous un lien en départ différé), durée imposée, « Finit lancée » (avec « Sans effet : attente de x s avant le temps suivant » quand elle finit avant la fin du temps) ; bloc « Segment n » pour le segment sélectionné : « Allure de la course », Marche, Trot, Sprint ou « Vitesse saisie » en km/h ; synchronisation : « Caler sur… » (bandeau en surimpression, puis clic sur la cible, Échap pour annuler, 5.8), ou la cible, le point de rendez-vous, le réglage, le résultat (délai calculé ou facteur) et « Retirer le lien » ; longueur, durée, vitesses moyenne et de pointe, vitesse de chaque segment ; alertes (lot 3 bis, D-106 à D-109, D-114).
- Passe : lâcher « à un instant fixe » (délai) ou « à la réception » (+ délai), instant réel du lâcher, vitesse de passe ; alerte « En-avant probable » (5.7).
- Jeu au pied (lot 3) : type, cible (receveuse ou point x, y), lâcher comme une passe (lot 3 bis), temps de vol (vide : défaut du type) (D-095, D-110).
- Regroupement (lot 3) : type (ruck, maul), soutien et relayeur parmi les coéquipières de la plaquée, instant de formation, durée, défense au regroupement (« Par défaut », « Garde », « Gratteur ») (D-078, D-095).
- Réglages de `reglages.json` (thème, allures, vitesse de passe ; lot 3 bis : profil de vitesse en m/s², seuils orange et rouge en km/h), modifiables depuis l'inspecteur.
- Lot 3 bis : toute vitesse est affichée en m/s et en km/h ; vitesses de segment et seuils se saisissent en km/h ; le code et les fichiers restent en m/s (D-117).

### 6.6 Départ d'une nouvelle combinaison

- Deux placements fournis : équipe A seule en ligne ; 7 contre 7 en ligne. A sur x = 40 m, n° 1 à 7 de y = 5 m à y = 65 m tous les 10 m ; en 7 contre 7, B en face sur x = 50 m ; ballon à A n° 4 ; A attaque ; nom « Nouvelle combinaison », catégorie ruck/jeu courant, vue terrain complet (D-008).
- S'y ajoutent les modèles de placement enregistrés : en choisir un crée une combinaison sans joueuses (avec un ballon si le modèle en a un), puis lance la pose du modèle (ancre, côté ouvert) (D-091). Elle n'est enregistrée qu'une fois l'ancre validée ; jusque-là, rien n'est écrit (Ctrl+S compris) et aucun brouillon n'est gardé. Échap, « Annuler », un changement d'outil ou une autre pose l'abandonnent : la combinaison ouverte avant est relue dans le dossier (ou IndexedDB) et rouverte, ou l'éditeur reste vide si elle n'existe plus (D-101).

### 6.7 Liste des actions du temps (lot 3 bis)

- Dans la bande du bas, à droite de l'arbre des temps (6.1, D-113) ; défilement interne ; le terrain ne change ni de taille ni de cadrage.
- Temps affiché : le temps sélectionné en édition, le temps à `t` en lecture. Une ligne par action (courses, passes, jeux au pied, regroupements), triée par instant de début, puis ordre du tableau ; en-tête gradué en secondes sur la durée du temps.
- Chaque ligne : type et acteurs ; barre de temps (début et fin sur l'échelle du temps) ; détails principaux ; pastilles d'alerte (en-avant, vitesse, synchronisation impossible, validations existantes) ; tous les détails en infobulle et dans l'inspecteur. Une action ignorée est marquée en erreur.
- Détails, vitesses en km/h et en m/s :
  - course : joueuse, longueur, départ, arrivée, durée, vitesse moyenne et de pointe, vitesse de chaque segment (allure ou saisie), lien, fin lancée (ou sans effet) ;
  - passe : passeuse, receveuse, mode et instant réel du lâcher, arrivée, distance, temps de vol, en-avant probable ;
  - jeu au pied : frappeuse, cible (receveuse ou point), mode et instant réel du lâcher, distance, temps de vol ;
  - regroupement : type, plaquée, formation, sortie de balle.
- Clic : sélectionne l'action sur le terrain et dans l'inspecteur (en lecture, retour au mode édition du temps affiché) ; survol : halo sur le terrain ; Suppr : suppression, une étape d'annulation ; la ligne de l'action sélectionnée est mise en évidence.

## 7. Lecteur (lot 1)

- Intégré à l'éditeur, avec un mode plein écran.
- Commandes : lecture/pause, temps précédent/suivant, curseur temporel, vitesse 0,5x / 1x / 2x, boucle, pause automatique entre les temps.
- Point d'option : bascule « S'arrêter aux options », activée par défaut et indépendante de la pause entre les temps ; activée, pause et un bouton par option, libellé par sa condition ; désactivée, l'option par défaut ; un bouton revient au point d'option pour lire une autre option (D-011).
- Calques activables séparément : traces (temps en cours appuyé, temps précédents estompés) ; consigne en bandeau ; ligne d'avantage en tirets fins ; « En-avant » (icône des passes en avant probables, activé par défaut, D-085) ; « Vitesses » (pastilles des segments au-delà d'un seuil, activé par défaut, lot 3 bis, D-112). Lots suivants : indicateurs de défense, ligne de hors-jeu.
- Lecture et pause : bouton, L, appui bref sur Espace (6.2, D-116).
- Une seule vue (centre et échelle) pour l'édition et la lecture : lancer la lecture, choisir une option ou revenir à l'édition ne la change pas. À l'ouverture d'une combinaison, la vue enregistrée ; puis zoom et déplacement libres, en édition comme en lecture. « Ajuster » (F) recadre sur la vue enregistrée ; « Zone utile » recadre sur la boîte englobante de toutes les positions de la ligne lue, plus 5 m de marge (D-049, remplace la partie cadrage de D-019).
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

Extensions du lot 1 (D-020) : `issues()` (fichiers invalides, copies de conflit), `resolveDuplicate(id, choix)`, `getSettings()` et `putSettings()`, `versionOf(id)`, `put(play, { expected, archivePrevious })` pour la concurrence optimiste et le remplacement à l'import. `stamp` est un compteur de relectures, pas une heure (les horloges des deux PC et les dates posées par Drive peuvent diverger) ; chaque `Change` porte son `stamp`. Correction du lot 3 : le jeton de version porte l'empreinte du contenu (`{ lastModified, size, contentHash }`, D-097) et `isOwnWrite(collection, id, empreinte)` dit si un contenu est une version écrite par la page (D-098).

### 8.2 Dossier

- L'utilisateur choisit une fois un dossier avec `showDirectoryPicker` (Chrome). Le handle est conservé dans IndexedDB.
- Au démarrage, si la permission n'est plus accordée, un bouton « Réautoriser le dossier » la redemande en un clic. Chrome (version 122 et suivantes) propose « Autoriser à chaque visite » (« Allow on every visit »), qui rend l'accès permanent (établi).
- Structure créée au premier usage (`exports/` depuis le lot 2, D-076) :

```
<dossier choisi>/
  reglages.json
  combinaisons/
  modeles/          (lot 3)
  exports/          (lot 2)
  _corbeille/
```

### 8.3 Lecture, écriture, détection des changements

- Relecture complète au démarrage, à chaque retour du focus sur la fenêtre, et toutes les 30 s tant que la fenêtre est visible (HYPOTHÈSE de période). La relecture prend tout fichier `*.json` de `combinaisons/` et de `modeles/` (lot 3, D-092), copies de conflit comprises, et ignore les autres, dont les fichiers temporaires `.crswap` de Chrome (D-023).
- Un changement est détecté par la date de modification et la taille du fichier, puis confirmé par l'empreinte du contenu. L'empreinte se calcule d'une seule façon : `contentHash` de l'élément obtenu en relisant le texte écrit ou lu (lecture et migration), jamais de l'objet en mémoire (D-097).
- Avant d'écrire, l'outil vérifie que le fichier n'a pas changé depuis la version dont part l'éditeur : date et taille égales à celles de cette version, ou contenu relu dont l'empreinte est celle de cette version ou d'une version écrite par cette page. Une date ou une taille différente ne prouve jamais un conflit. Sinon, il propose les choix de 8.4 au lieu d'écraser (D-043, D-097). L'empreinte de départ est gardée par l'éditeur hors de la combinaison : elle change à l'ouverture, après chaque écriture réussie, à chaque rechargement et à chaque résolution de conflit ou de fichier retiré ; annuler, rétablir et glisser n'y touchent pas.
- Versions écrites par la page (D-098) : pour chaque combinaison et chaque modèle, la page garde les empreintes des 50 dernières versions qu'elle a écrites (HYPOTHÈSE) et une référence, la dernière version tenue pour courante (écrite par la page, ou lue depuis l'extérieur après). Un fichier relu dont le contenu est l'une de ces versions n'est jamais une modification extérieure : ni dialogue, ni rechargement, ni refus d'action sur un modèle. Si ce n'est pas la référence, la synchronisation est revenue en arrière : la référence est réécrite à l'identique dans le même fichier, sans toucher aux modifications en cours (pas si une copie de conflit porte le même identifiant, ni si le fichier a encore changé). Limite : une ancienne version remise volontairement à l'identique depuis l'autre PC (historique de Drive, import) est défaite tant que la page qui l'avait écrite est ouverte ; recharger la page avant.
- Sauvegarde automatique 2 s après la dernière modification, plus Ctrl+S. Jamais pendant un glisser : elle part à la fin du geste, ou à son annulation s'il restait des modifications non enregistrées ; Ctrl+S reste immédiat (D-099).
- Journal de synchronisation (D-100) : les 200 derniers événements, en mémoire seulement (relecture, écriture, vérification avant écriture, changement détecté, décision, retour en arrière corrigé, sauvegarde différée, refus sur un modèle), avec l'heure et la date du fichier en heure locale du PC (millisecondes comprises), le fichier, la taille, `updatedAt` tel qu'il est dans le fichier, une empreinte courte et l'origine retenue (« cette page » ou « extérieure »). Bouton discret « Copier le journal de synchronisation » dans les réglages de l'inspecteur ; rien n'est écrit dans le dossier.
- Écriture via `createWritable()` puis `close()` : l'écriture passe par un fichier temporaire (`.crswap`) et n'est validée qu'à la fermeture (vérifié en recette le 15/10/2026 sur le lecteur Drive : aucun `.crswap` résiduel).
- Renommer une combinaison renomme son fichier : écrire le nouveau, puis déplacer l'ancien en corbeille, toujours ; le renommage n'a lieu qu'à la validation du nom (D-005).

### 8.4 Conflits

- **Modification extérieure** : un contenu jamais écrit par cette page, différent de la version dont part l'éditeur (D-097, D-098). Une version écrite par la page n'en est jamais une, quoi que la synchronisation fasse ensuite de la date ou du contenu du fichier (8.3).
- **Modification extérieure sans modification locale en cours** : rechargement silencieux, notification discrète.
- **Modification extérieure avec modification locale non enregistrée** : choix « Garder la version du dossier », « Garder la mienne », « Garder les deux ». « Garder les deux » : ma version reçoit un nouvel `id` et le suffixe « (copie) » (D-022).
- **Deux fichiers portant le même `id`** (copie de conflit créée par la synchronisation, établi pour Drive pour ordinateur) : signalement dans la bibliothèque, choix « Garder les deux » (nouvel `id` pour l'une, nom suffixé « (copie) ») ou « Choisir celle-ci », qui déplace l'autre fichier en corbeille. Tant que le doublon n'est pas résolu, la combinaison est en lecture seule (D-022).
- **Import d'un `id` déjà présent** : « Remplacer » ou « Garder les deux », dates affichées. « Remplacer » déplace d'abord l'ancienne version en corbeille (D-022).

### 8.5 Suppression

- Jamais d'effacement définitif : déplacement dans `_corbeille/`, avec un horodatage en tête du nom : `AAAA-MM-JJ_HH-MM-SS--<nom d'origine>` (D-023). Le déplacement copie le fichier octet par octet, vérifie la copie, puis retire l'original (D-043) ; il sert aussi aux exports remplacés (D-065).

### 8.6 Mode dégradé (Firefox, ou aucun dossier choisi)

- Bibliothèque dans IndexedDB ; import et export manuels `.combi.json` et `.combipack.json`.
- Bandeau permanent, en surimpression du haut du terrain (D-050) : « Synchronisation par dossier disponible dans Chrome » (Firefox) ; dans Chrome sans dossier : « Aucun dossier choisi : la bibliothèque reste dans ce navigateur », avec un bouton « Choisir un dossier ». Au premier choix d'un dossier, l'outil propose d'y copier les combinaisons du navigateur (D-021).

### 8.7 Bibliothèque

- Deux onglets : « Combinaisons » et « Modèles » (modèles de placement, 10.1, D-096).
- Liste avec vignette (mode schéma du premier temps), nom, catégorie, date de modification.
- Recherche par nom ; filtre par catégorie ; tri par nom ou date.
- Dupliquer ; supprimer (corbeille, après confirmation) ; exporter en fichier ; importer.

### 8.8 Configuration Drive (côté utilisateur, documentée dans le README)

- Installer Google Drive pour ordinateur sur les deux PC.
- Choisir un dossier dans « Mon Drive », par exemple `Mon Drive/Rugby7`.
- Mode **miroir** recommandé : fichiers sur le disque et dans le cloud, disponibles hors connexion (établi). En mode **diffusion**, les fichiers ne sont en local qu'à l'usage (établi) : marquer alors le dossier « disponible hors connexion ». La File System Access API fonctionne sur le lecteur virtuel du mode diffusion (vérifié en recette le 15/10/2026, dossier `G:\Mon Drive\Rugby7` : choix, structure, écriture, sauvegarde automatique).
- Historique : Drive conserve les versions d'un fichier jusqu'à 30 jours ou 100 versions, sauf « Conserver indéfiniment » (établi).
- Bonne pratique : attendre la fin de la synchronisation avant de passer d'un PC à l'autre.

## 9. Exports (lot 2)

### 9.1 Principes

- Les exports utilisent exclusivement `evaluate`, `render` et `renderSchematic` : sur un `OffscreenCanvas` pour les GIF, sur le contexte 2D de jsPDF pour les vignettes des PDF. Cartons, en-tête et pastille sont dessinés par des fonctions pures de `render/captions.ts` avec les mêmes primitives ; les textes des pages PDF (titres, notes, consignes, sommaire) passent par l'API texte de jsPDF (D-060).
- Thèmes : GIF en « Contraste fort » par défaut, au choix « Écran » ou « Impression N&B » ; PDF « Couleur » en « Impression couleur », « Noir et blanc » en « Impression N&B » (D-062, 13.2).
- Encodage dans un Web Worker (module) réutilisé d'un export à l'autre, une image ou une page par pas : barre de progression (un message toutes les 50 ms au plus) et bouton Annuler ; sans réponse à l'annulation dans la seconde, le Worker est arrêté et recréé. L'interface ne gèle jamais : aucune tâche de la page au-delà de 200 ms pendant un export (mesuré en test) (D-076, D-077).
- Enregistrement dans `exports/` du dossier (donc accessible depuis l'app Google Drive du téléphone si elle y est installée, d'où l'envoi WhatsApp) ; repli : téléchargement (mode navigateur, Firefox). Seule la page écrit, après la fin de l'encodage : une annulation ne laisse jamais de fichier ; l'écriture finale (moins d'une seconde) n'est pas annulable (« Enregistrement… ») ; les fichiers d'un même export (un GIF par option) sont écrits ensemble, tout ou rien (D-065, D-076).
- Nom : `<nom-court>--<variante>.<ext>` (variantes en 9.2 et 9.3, D-066 ; deux variantes différentes ne portent jamais le même nom). Un export existant n'est jamais écrasé sans décision : existence vérifiée avant l'encodage, puis de nouveau à l'écriture ; « Remplacer » déplace d'abord l'ancien fichier dans `_corbeille/` (copie vérifiée) ; « Garder les deux » ajoute « -2 », « -3 »... ; « Annuler » arrête l'export. Si l'écriture échoue, le fichier vide créé par la tentative est retiré (il n'a jamais contenu de données) (D-065).
- Taille de chaque fichier affichée après l'export, en Ko ou en Mo de 1 024 × 1 024 octets (D-072).
- Préférences d'export lues dans `reglages.json` et écrites au lancement d'un export quand elles ont changé (D-068, 4.4).

### 9.2 GIF

- **Orientation** au choix : portrait (terrain vertical, attaque vers le haut), paysage (attaque toujours vers la droite : rotation de 180° quand B attaque), carré (attaque vers le haut) (D-006).
- **Options** au choix :
  - un GIF par feuille de l'arbre (le carton titre porte en sous-titre les options de la ligne) ;
  - un GIF enchaîné : tronc, option A, carton « Option B : <condition> », reprise au point d'option où l'option quitte la précédente, option B, et ainsi de suite, dans l'ordre de l'arbre ; le carton est préfixé de « Temps n, » quand la combinaison a plusieurs points d'option ; une condition vide donne « Option B » (D-058).
- **Vitesse** : par défaut, deux passages complets dans le même GIF : ralenti 0,5x, carton « Vitesse réelle » (1 s), puis vitesse réelle. Autres choix : 0,5x seul, 1x seul. Pastille « Ralenti » ou « Vitesse réelle » dans l'en-tête, dans tous les modes (D-058, D-060).
- **Habillage** : carton titre 1,5 s (nom de la combinaison) ; carton d'option 2 s ; en haut de chaque image, un en-tête (« Temps 2 », « Temps 3, option B » à gauche, pastille à droite) et, juste dessous, la consigne en bandeau, toujours présente et de hauteur fixe pendant tout le GIF ; la dernière image de chaque ligne tenue 1 s avant le carton suivant ; image finale figée 2 s avant la boucle ; un carton ou une image tenue est une seule image du GIF. Calques traces, ligne d'avantage et indicateurs selon les réglages du lecteur (D-059, D-060, D-073, D-074), sauf l'icône d'en-avant, jamais exportée (D-086).
- **Cadrage** : boîte englobante de toutes les lignes exportées dans le fichier, plus 5 m, fixe pendant tout le GIF, sous l'en-tête et le bandeau.
- **Lisibilité** : téléphone de 6 pouces au format 19,5:9, soit 64 mm de large (138 mm, son long côté, pour un GIF paysage : téléphone tourné) ; quand le GIF occupe la largeur de l'écran, le plus petit texte (numéros des jetons) mesure au moins 2,5 mm, soit largeur × 2,5 / 64 (21 px à 540 px) ; jetons et toutes les tailles du thème suivent (D-061).
- **Résolution et cadence** (HYPOTHÈSES) : standard 540 x 960 (portrait), 960 x 540 (paysage), 720 x 720 (carré), 12 images/s ; « haute qualité » 720 x 1280, 1280 x 720, 960 x 960, 15 images/s. Délais en centièmes de seconde arrondis en cumulé (12 images/s : 8, 9, 8...) ; un segment de durée D joué à la vitesse s compte ⌈D·f/s⌉ + 1 images (D-074).
- **Encodage** : gifenc (`quantize`, `applyPalette`, `GIFEncoder`, `writeFrame`) ; palette globale de 255 couleurs calculée sur le premier carton de chaque sorte et 12 images de scène réparties (pas de scintillement), plus un indice transparent ; pixels inchangés d'une image à l'autre codés en transparent, avec `dispose: 1` (3 à 7 fois plus léger, mesuré : environ 0,5 à 1,5 Mo pour 20 s en standard), désactivable dans le dialogue (D-069, D-071) ; boucle infinie.
- **Poids** : taille affichée après export ; au-delà de 8 Mo (HYPOTHÈSE), alerte et « Exporter une version allégée » : même contenu, résolution standard, 8 images/s (HYPOTHÈSE) (D-067).
- **Noms** : `<nom-court>--<orientation>[-hd][-enchaine | -option-b | -option-a-b][-ralenti | -reel][-allege].gif`, orientation `portrait`, `paysage` ou `carre` ; rien pour les lignes quand la combinaison n'en a qu'une ; rien pour les deux vitesses (D-066, D-074).
- **WhatsApp** : établi, WhatsApp ré-encode les GIF en MP4 pour les animer. Côté plateforme WhatsApp Business, un MP4 de plus de 3,5 Mo s'affiche comme une vidéo avec bouton lecture au lieu d'une boucle automatique (établi pour l'API Business, non vérifié pour l'application grand public). À vérifier en recette, avec et sans l'allègement.

### 9.3 PDF

- **Deux mises en page** à l'export :
  - « Téléphone » : pages de 100 mm de large (HYPOTHÈSE), aussi hautes que leur contenu (suite sur une nouvelle page au-delà de 5 m), lues en défilant ; une vignette pleine largeur par ligne, sections d'options empilées ; textes d'au moins 11,1 pt, numéros des jetons à 12 pt (règle de lisibilité de 9.2 appliquée à la page) (D-063, D-075) ;
  - « Impression » : A4 paysage.
- **Couleur ou noir et blanc** au choix (D-062) :
  - « Couleur » : thème « Impression couleur » (fond blanc, lignes du terrain grises, couleurs d'équipe conservées, passes noires) ;
  - « Noir et blanc » : thème « Impression N&B », gris seulement : équipes en jetons pleins noirs à numéro blanc (A) et creux à contour et numéro noirs (B), quelle que soit la couleur de la joueuse ; courses noires en trait plein ; passes en pointillés ; temps précédents en gris clair ; terrain blanc à lignes gris moyen, en-buts gris très clair, ligne d'avantage en tirets noirs fins ; jeu au pied en tirets longs (lot 3).
- **Contenu d'une combinaison** : titre, catégorie, notes du coach ; une vignette par temps en mode schéma, sans icône d'en-avant (D-086) ; sous chaque vignette, son libellé et sa consigne (3 lignes au plus, HYPOTHÈSE).
- **Vignettes** : un même cadrage pour toutes les vignettes d'une combinaison : boîte englobante de toutes ses lignes plus 5 m (pas la vue enregistrée), attaque vers le haut, rapport hauteur sur largeur borné entre 0,45 et 1 (HYPOTHÈSE) ; cadre gris fin (D-063, D-075).
- **Options** : toutes sur la même page, en arbre de vignettes : une rangée pour le tronc jusqu'au premier point d'option compris, puis une rangée par option, dans l'ordre de l'arbre, en pleine largeur et sans retrait, titrée « Option A : <condition> » (préfixée de « Temps n, » quand la combinaison a plusieurs points d'option) ; une option contient ses temps jusqu'au point d'option suivant compris ; une rangée trop longue passe à la ligne. En mise en page téléphone, les rangées d'options s'empilent verticalement (D-063, D-075).
- **Débordement** : si une combinaison ne tient pas sur un A4, réduire les vignettes de 90 mm jusqu'à un minimum lisible (HYPOTHÈSES : 90 mm au plus, 60 mm au moins), par pas de 1 mm, puis continuer sur la page suivante avec rappel du titre ; une rangée n'est jamais coupée entre deux pages, sauf si elle dépasse à elle seule une page entière (coupure entre deux lignes de vignettes) (D-075).
- **Cahier de jeu** (D-064, D-077) :
  - dialogue : titre (« Cahier de jeu » par défaut, ou le nom de la catégorie choisie), cases à cocher par combinaison dans l'ordre du tri courant de la bibliothèque (toutes cochées au départ), choix rapide d'une catégorie ;
  - un seul PDF ; page de titre : titre, catégorie (quand la sélection est exactement une catégorie) ou « Sélection », nombre de combinaisons, date la plus récente de modification des combinaisons incluses ;
  - sommaire : nom, catégorie, numéro de page et lien interne ; chaque combinaison commence sur une nouvelle page ; numéro de page en pied de chaque page sauf la page de titre ; un signet par combinaison ;
  - un PDF d'une seule combinaison n'a ni page de titre, ni sommaire, ni numéros de page.
- **Noms** : `<nom-court>--impression[-nb].pdf` ou `--telephone[-nb].pdf` ; cahier : `<nom-court du titre>--cahier-impression[-nb].pdf` ou `--cahier-telephone[-nb].pdf` (D-066).
- **Vectoriel** : `renderSchematic` dessine les vignettes sur le contexte 2D de jsPDF ; chaque vignette est découpée par `clip()` et placée par translation, sans mise à l'échelle (le viewport travaille en millimètres). Mesuré : 63 Ko pour la page A4 d'une combinaison à 2 options, contre 160 à 210 Ko en images à 300 dpi (D-057, D-071).
- **Police** embarquée couvrant le français : Atkinson Hyperlegible, réduite aux glyphes utilisés, avec table `/ToUnicode` (texte sélectionnable et retrouvé par la recherche) : accents, apostrophe typographique, guillemets ; l'espace fine insécable, absente de la police, devient une espace insécable (D-071).
- **Déterminisme** : date de création = date de modification la plus récente des combinaisons incluses ; identifiant du fichier tiré de son contenu : deux exports identiques donnent le même PDF octet pour octet (D-064, D-075).

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

Précisions (lot 3) :
- **Aimantation de l'ancre** : toujours active, indépendamment du bouton « Grille 1 m » ; renvoi : centre de la médiane ou ligne des 22 m captés à moins de 3 m (HYPOTHÈSE), sinon grille ; touche : ligne de touche la plus proche, x sur la grille, refus à moins de 5 m d'une ligne de but (D-088).
- **Côté ouvert** : « Auto » (le côté le plus large depuis l'ancre ; au centre exact, à droite de l'équipe qui attaque), « Gauche » ou « Droite », vus par l'équipe qui attaque face à la ligne de but adverse ; touche : toujours vers l'intérieur, sans choix (D-088).
- **Enregistrer** : dialogue (nom, type, « Placement de départ entier » ou « Sélection », « Inclure le ballon » cochée pour le placement entier ou quand la porteuse est sélectionnée, côté ouvert), puis clic de l'ancre ; rôle selon l'équipe (l'équipe qui attaque = attaque) ; « Mettre à jour » garde l'identifiant, le nom et le type (D-089, D-096).
- **Appliquer** : bandeau en surimpression, jetons fantômes au pointeur, une seule étape d'annulation, temps 1 sélectionné ; numéros en double : la k-ième position d'un numéro va à la k-ième joueuse de ce numéro ; joueuses créées en couleur d'équipe et défense manuelle ; un modèle sans ballon laisse le ballon de la combinaison (D-089, D-096).
- **Catégorie** : appliquer un modèle met la catégorie à mêlée, touche, coup d'envoi/renvoi ou ruck/jeu courant selon son type ; un modèle libre la laisse inchangée (D-087).
- **Synchronisation** : comme les combinaisons (8.3 à 8.5) ; une action sur un modèle changé sur l'autre PC depuis sa lecture est refusée avec un message, et la liste est relue ; une version écrite par la page n'est jamais un modèle changé ailleurs : l'action continue avec la version enregistrée (D-098) ; pas d'import ni d'export de modèles (D-092).
- **Nouvelle combinaison depuis un modèle** : enregistrée seulement à la validation de l'ancre (6.6, D-101).

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
- « Déplacer la combinaison » : translation par deux clics (départ, arrivée, grille si active). « Retourner » : symétrie gauche-droite par rapport à l'axe du terrain (y devient largeur − y), sens d'attaque inchangé. Les deux s'appliquent aussi au ballon au sol et au cadre libre de la vue enregistrée (D-090).

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

Précisions (lot 3, D-078 à D-081) :
- Seule la défense au regroupement (`contest`) est enregistrée ; le plaqueur et la joueuse au ras sont désignés par la simulation du lot 4.
- La plaquée et le soutien s'immobilisent là où leurs courses les ont amenées ; le relayeur rejoint en ligne droite, au sprint des réglages, le point situé 1 m derrière le ballon du côté de l'équipe de la plaquée ; trop loin, il arrive exactement à la sortie de balle (vitesse augmentée), avec une alerte. Lot 3 bis : ce déplacement suit le profil de vitesse (départ arrêté), la vitesse augmentée par le facteur de vitesse (5.3).
- Les courses des trois participantes s'arrêtent à la formation : la partie ultérieure est ignorée, dessinée en rouge et signalée ; une passe ou un jeu au pied du relayeur après la sortie reste possible dans le même temps.
- Plaquée sans ballon à la formation : regroupement entièrement ignoré et signalé, sans recalage de la ligne d'avantage.
- Maul : identique au ruck et immobile au lot 3 ; seul `kind` change.
- Proposition à la pose : instant de formation à la fin de la course de la porteuse dans le temps, ou à la réception si elle est plus tardive ; soutien = la coéquipière la plus proche à cet instant, relayeur = la deuxième ; ruck par défaut. Repère : contour circulaire et libellé « Ruck » ou « Maul » (D-084).

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
  release?: 'onReceipt'  // lot 3 bis : lâcher à la réception + délai, comme une passe (5.4, D-110)
}
```

- Trajectoire vue de dessus en tirets longs ; hauteur figurée par l'ombre au sol et un ballon qui grossit jusqu'au sommet (facteur 1,8 au sommet, HYPOTHÈSE). Le ballon reste sur la trajectoire ; l'ombre, ellipse grise pleine, est décalée vers le bas à droite de l'image proportionnellement à la hauteur ; un petit cercle marque un point visé (D-084).
- Avec receveuse : arrivée à sa position à `release + flightTime`. Sur un point : ballon `loose` au point d'impact ; il devient porté par la première joueuse qui passe à moins de 1 m après l'impact (HYPOTHÈSE de distance), de l'une ou l'autre équipe, la recherche continuant dans les temps suivants (D-083). La frappeuse doit porter le ballon, sinon le jeu au pied est ignoré et signalé.
- La poursuite reste dessinée à la main ; la défense simulée ne s'applique pas aux coups d'envoi.

### 10.5 Contrôle d'en-avant

- Voir 5.7. Pastille ronde au milieu de la passe concernée (jaune à « ! » noir ; noire à « ! » blanc en N&B) et alerte « En-avant probable » dans l'inspecteur ; toujours affichée dans l'éditeur, selon le calque « En-avant » dans le lecteur (D-084, D-085).
- Jamais dans les exports, ni GIF ni PDF, quel que soit le calque, ni dans les vignettes de la bibliothèque : c'est une aide pour le coach, pas une information pour les joueuses (D-086). Même règle pour les pastilles de vitesse (5.9, D-112) et les liens de synchronisation (5.8).

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
type GroupRunAction = { id: Id; type: 'groupRun'; entityIds: Id[]; waypoints: Waypoint[]; pace: 'walk' | 'jog' | 'sprint'; durationOverride?: number; delay: number }  // Waypoint depuis le lot 3 bis (D-104)
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

- Thèmes de l'éditeur : « Écran » (défaut) ; « Contraste fort » (aplats saturés, traits d'au moins 3 px à l'échelle 1, aucune texture : thème par défaut des GIF).
- Thèmes des exports seulement (D-062) : « Impression couleur » (PDF en couleur) ; « Impression N&B » (PDF en noir et blanc, et GIF au choix) : gris seulement, conventions de 9.3.
- Couleurs d'équipe par défaut : bleu (A), orange (B).

### 13.3 Conventions de tracé

| Élément | Tracé |
|---|---|
| Course | Trait plein fléché ; segment à l'allure sprint des réglages ou plus vite : trait plus épais (lot 3 bis, D-115) |
| Lien de synchronisation | Tirets fins, couleur de sélection, surcouche d'édition seulement (lot 3 bis) |
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
| Allures | 2 / 4 / 5,5 m/s (sprint à 7 m/s avant le lot 3 bis) | Hypothèse |
| Profil de vitesse : accélération, freinage, accélération latérale | 3 / 4 / 4 m/s², réglables | Hypothèse (D-105) |
| Vitesse minimale en virage | 1 m/s | Hypothèse |
| Seuils de vitesse irréaliste | 20 km/h (orange), 25 km/h (rouge), réglables | Hypothèse, choix du coach (D-111) |
| Tolérance de réception d'un lâcher à instant fixe | 0,5 s | Hypothèse (D-110) |
| Appui bref sur Espace | moins de 0,5 s, sans glisser | Hypothèse (D-116) |
| Vitesse de passe | 12 m/s | Hypothèse |
| Seuil d'en-avant | 0,5 m/s | Hypothèse |
| Durée d'un regroupement | 3 s | Établi (fourni par l'utilisateur) |
| Position de relais | 1 m derrière le ballon | Hypothèse |
| Temps de vol au pied | 3,0 s (renvoi), 3,5 s (long) | Hypothèse |
| Ramassage d'un ballon au sol | 1 m | Hypothèse |
| Recherche du ramassage | pas de 1/100 s, puis bissection | Hypothèse |
| Grossissement du ballon au sommet d'un jeu au pied | 1,8 | Hypothèse |
| Marque de touche | 5 m au moins de chaque ligne de but | Établi |
| Capture de l'ancre d'un renvoi (centre, 22 m) | 3 m | Hypothèse |
| Consigne, longueur conseillée | 60 caractères | Hypothèse |
| Marge du cadrage automatique | 5 m | Hypothèse |
| Sauvegarde automatique | 2 s après la dernière modification | Hypothèse |
| Relecture du dossier | 30 s, fenêtre visible | Hypothèse |
| Versions écrites par la page, gardées par combinaison et par modèle | 50 | Hypothèse (D-098) |
| Journal de synchronisation | 200 événements | Choix de l'utilisateur (D-100) |
| GIF standard | 540 px de petit côté, 12 images/s | Hypothèse |
| GIF haute qualité | 720 px de petit côté, 15 images/s | Hypothèse |
| Alerte de poids GIF | 8 Mo | Hypothèse |
| Carton d'option, carton de vitesse | 2 s, 1 s | Hypothèse |
| Maintien de la dernière image d'une option | 1 s | Choix de l'utilisateur (D-059) |
| Palette des GIF | 255 couleurs, échantillon de 12 images | Hypothèse |
| Version allégée d'un GIF | 8 images/s | Hypothèse |
| Téléphone de lecture | 6 pouces 19,5:9 : 64 mm de large, 138 mm tourné ; texte de 2,5 mm au moins | Hypothèse |
| Page PDF téléphone | 100 mm de large | Hypothèse |
| Vignette PDF | 90 mm au plus, rapport hauteur sur largeur de 0,45 à 1 | Hypothèse |
| Vignette PDF minimale | 60 mm | Hypothèse |
| Consigne sous une vignette PDF | 3 lignes | Hypothèse |
| Arrêt du Worker sans réponse à l'annulation | 1 s | Hypothèse |
| Messages de progression d'un export | un toutes les 50 ms au plus | Hypothèse |
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
16. Décisions prises après le lot 1 et pendant sa correction après recette (15 octobre 2026) : entrées D-046 à D-056 (terrain stable, vue unique, bandeau en surimpression, seuil de glisser, inspecteur, CI, règle de recette, raccourcis).
17. Décisions prises pendant le lot 2 (15 octobre 2026) : entrées D-057 à D-077 (PDF vectoriel, GIF enchaîné, cartons et maintiens, habillage, lisibilité sur téléphone, thèmes d'impression, mise en page et cahier de jeu, exports déjà présents, noms, version allégée, préférences d'export dans `reglages.json`, Worker).
18. Décisions prises pendant le lot 3 (16 octobre 2026) : entrées D-078 à D-096 (regroupements, maul, ligne d'avantage en mode schéma, ballon au sol et ramassage, conventions graphiques, calque « En-avant » jamais exporté, modèles de placement : type et catégorie, ancre et côté ouvert, enregistrement, synchronisation ; déplacer et retourner ; nouvelle combinaison depuis un modèle ; raccourcis J et G ; schéma v2 ; interfaces de pose).
19. Décisions prises pendant la correction après recette du lot 3 (23 octobre 2026) : entrées D-097 à D-101 (concurrence par l'empreinte du contenu, versions écrites par la page et retours en arrière de Drive, aucune sauvegarde automatique pendant un glisser, journal de synchronisation, nouvelle combinaison depuis un modèle enregistrée à la validation de la pose).
20. Exploitation du dépôt (23 octobre 2026) : entrée D-102 (le dépôt reste public).
21. Décisions du plan du lot 3 bis, courses réalistes (23 octobre 2026) : entrées D-103 à D-118 (portée, combinaison v3, profil de vitesse, course qui finit lancée et raccord de tangente, durée imposée, liens de synchronisation et leur création, lâcher à la réception et tolérance, vitesses irréalistes et réglages v3, calque « Vitesses », liste des actions du temps, vitesse par segment, segments rapides, barre d'espace, km/h, pistes reportées).
