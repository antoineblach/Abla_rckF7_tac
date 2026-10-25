# Plan du lot 3 bis : courses réalistes

Plan validé le 23 octobre 2026, avec les réponses aux questions Q1 à Q13 (section 18). Quatre réponses complètent le plan proposé : Q4 (course lancée qui finit avant la fin de son temps), Q8 (mode de lâcher « à la réception »), Q9 (profil réglable dans `reglages.json`), Q13 a (raccord de tangente, dans ce lot). Le texte ci-dessous en tient compte. Décisions détaillées dans `docs/DECISIONS.md`, entrées D-103 à D-118.
Suivi : une case par étape, cochée dans le commit qui termine l'étape, avec le hash court du commit (ou du précédent quand il ne peut pas y figurer). État courant dans `docs/ETAT.md`.
Consigne de l'utilisateur : enchaîner les étapes sans attendre ; ne s'arrêter que sur une question bloquante.

## Contexte

Retour de la séance d'usage du 23/10 (6 notes). Le lot 3 bis, avant le lot 4, rend les courses réalistes et lisibles :
- A. liste des actions du temps, avec barres de temps et détails ;
- B. vitesse propre à chaque segment d'une course ;
- C. liens de synchronisation et rendez-vous entre actions d'un même temps ;
- D. profil de vitesse (accélération, freinage, virages), course qui finit lancée ;
- E. alertes de vitesse irréaliste (20 et 25 km/h), sprint ramené à 5,5 m/s, km/h affichés ;
- F. lecture et pause à la barre d'espace.

État vérifié avant de commencer :
- `main` à `e76aa13` (fusion de la PR #6), arbre propre.
- **Écart** : `docs/ETAT.md` dit « PR #6 à fusionner » ; elle est fusionnée (`e76aa13`). La référence `origin/etat-23-10` était une référence locale périmée (branche déjà supprimée sur GitHub) : retirée par `git fetch --prune`.
- Vérifications de terrain des lots précédents toujours en attente (liste de ETAT.md), non bloquantes.
- Aucune nouvelle dépendance.

Ce que le code fait aujourd'hui (remplacé) : `compilePhase` (`engine/timeline.ts`) donne à chaque course une durée `longueur / allure` (ou `durationOverride`) et `motionProgress` avance à vitesse constante (`spline.ts`, abscisse curviligne). La vitesse saute de 0 à l'allure au départ et retombe à 0 à l'arrivée.

## 1. Modèle : combinaison v3, réglages v3

**Combinaison `schemaVersion` 2 vers 3** (`model/types.ts`, `schema.ts` ; v2 figée dans `model/schemaV2.ts`).

```ts
type SegmentSpeed = Pace | number            // allure nommée, ou vitesse en m/s (saisie en km/h)
interface Waypoint extends Vec2 { speed?: SegmentSpeed }   // vitesse du segment qui ARRIVE à ce point (Q2)

interface RunAction {
  id: Id; type: 'run'; entityId: Id
  waypoints: Waypoint[]                      // segment i : du point i-1 (départ pour i = 0) au point i
  pace: Pace                                 // allure de la course (segments sans `speed`)
  durationOverride?: number                  // gardée, nouvelle sémantique (Q5)
  delay: number                              // ignoré tant qu'un lien en départ différé s'applique
  endsAtSpeed?: true                         // « Finit lancée » (Q4)
  sync?: RunSync
}
interface RunSync {
  target: SyncTarget
  at?: number                                // point de passage de CETTE course au rendez-vous ; absent : sa fin
  adjust: 'delay' | 'speed'                  // départ différé ou vitesse ajustée
}
type SyncTarget =
  | { actionId: Id; event: 'runEnd' }
  | { actionId: Id; event: 'runPoint'; index: number }
  | { actionId: Id; event: 'release' | 'arrival' }   // passe ou jeu au pied
  | { actionId: Id; event: 'formation' }             // regroupement

// Passe et jeu au pied (Q8) : absent = lâcher à un instant fixe (début du temps + délai) ;
// 'onReceipt' = à la réception du ballon dans le temps, plus `delay` (temps de contrôle, >= 0).
interface PassAction { ...; release?: 'onReceipt' }
interface KickAction { ...; release?: 'onReceipt' }
```

- zod strict : `speed` = allure ou nombre > 0 ; `at` et `index` entiers >= 0 ; union discriminée sur `event` ; `release` littéral.
- Validation métier (`model/validate.ts`, nouveau `model/syncGraph.ts` pur, partagé avec le moteur et les commandes) : cible absente ou dans un autre temps (« cible supprimée »), type incompatible (`runEnd` sur une passe...), index hors bornes, course calée sur elle-même, cycle.
- **Graphe de dépendances** (nœuds : courses, lâchers, arrivées, formations) :
  - lien d'une course vers sa cible ;
  - arrivée d'une passe : son lâcher, la course de la passeuse (position au lâcher), celle de la receveuse (`solvePassArrival`) ;
  - arrivée d'un jeu au pied : son lâcher (temps de vol fixe) ;
  - lâcher à la réception : tout ce qui peut amener le ballon à la joueuse dans le temps (arrivées des passes et jeux au pied vers elle, regroupements dont elle est le relayeur) ;
  - lâcher à instant fixe et formation : aucune dépendance.
  - Un cycle qui passe par au moins un lien de course est refusé. Un cycle formé seulement de lâchers à la réception (A passe à B, B rend à A, chacune à la réception) n'est pas une erreur : la boucle d'événements le résout dans l'ordre chronologique (section 7).
- **Migration v2 vers v3** (`migrations.ts`, chaînée depuis v0 et v1) : contenu identique, plus `endsAtSpeed: true` sur chaque course que **toutes** les options du temps suivant prolongent (même joueuse, première course du temps, `delay` 0). Règle purement structurelle, sans moteur. Aucune migration vers le lâcher à la réception (elle demanderait le moteur).
- Fichier v2 migré en mémoire, réécrit en v3 au prochain enregistrement (comme D-094) ; recharger la page sur les deux PC après le déploiement (README).
- Lot 5 : le type déclaré `GroupRunAction` passe à `waypoints: Waypoint[]` (rien d'implémenté, le schéma le rejette toujours). Lot 4 : `DefenseSettings` inchangé.
- **Fixtures** : `play-v2-lot3.json` (déjà figée) sert au test v2 vers v3 ; nouvelle `play-v3-lot3bis.json`, figée pour les lots 4 et 5 (segments, liens des 5 sortes de cible, course lancée prolongée et non prolongée, durée imposée, lâcher à la réception).

**`reglages.json` version 2 vers 3** (`model/settings.ts`).
- Ajout `motion: { accel, decel, lateralAccel }` en m/s² (Q9 : 3, 4 et 4, HYPOTHÈSE, réglables dans les réglages de l'inspecteur) ; la vitesse minimale en virage reste dans `defaults.ts`.
- Ajout `speedAlert: { warning, danger }` en m/s (défaut 20/3,6 et 25/3,6, HYPOTHÈSE, choix du coach).
- `EngineSettings` = allures, vitesse de passe, profil, seuils (le seuil rouge plafonne la vitesse ajustée ; les alertes sont calculées par le moteur).
- Migration v2 vers v3 (et v1 vers v3) : profil et seuils par défaut ; **sprint à 7 m/s exactement (ancien défaut) remplacé par 5,5 m/s**, avec un message unique à l'ouverture ; toute autre valeur gardée (Q10). Fixture figée `reglages-v2.json`.

## 2. Profil de vitesse (D)

**Modèle retenu : trapèze généralisé** (accélération constante par morceaux), calculé sur les échantillons de la spline existante (64 par segment, abscisse curviligne cumulée). Nouveau module pur `engine/profile.ts`.

1. Plafond à chaque échantillon : `min(vitesse cible du segment, max(V_MIN_VIRAGE, sqrt(a_lat / courbure)))` ; courbure par le cercle passant par trois échantillons voisins.
2. Bornes : départ à 0, ou à la vitesse de fin de la course lancée du temps parent (section 3) ; arrivée à 0, ou au plafond si la course finit lancée.
3. Passe avant `v[i+1] = min(plafond, sqrt(v[i]² + 2·a·Δs))`, passe arrière `v[i] = min(v[i], sqrt(v[i+1]² + 2·d·Δs))` ; la vitesse de départ imposée prime (continuité).
4. Temps : `Δt = 2·Δs / (v[i] + v[i+1])`, exact à accélération constante ; table des temps cumulés.
5. Position à `t` : dichotomie dans la table, puis `s = s_i + v_i·τ + ½·a·τ²`. Position et vitesse continues ; vitesse analytique disponible (`motionVelocity`).
6. Inverse : instant de passage au point k = temps de l'échantillon `64·(k+1)`. La table est monotone : la synchronisation l'inverse sans approximation.

Pourquoi ce modèle :
- formule fermée sur chaque intervalle, donc inverse exacte et tests analytiques (trapèze, triangle) ;
- les transitions entre segments de vitesses différentes et les virages sortent des deux passes, sans cas particulier ;
- déterministe : aucun pas de temps, aucune accumulation.
- Écarté : modèle exponentiel (v = vmax·(1 − e^(−t/τ))), plus fidèle au départ d'un sprint, mais il demande une intégration numérique avec les plafonds de virage et complique l'inversion (piste reportée, Q13 b).

Valeurs (Q9), toutes HYPOTHÈSE : accélération 3 m/s² (0 à 5,5 m/s en 1,8 s sur 5 m), freinage 4 m/s², accélération latérale 4 m/s² (rayon 5 m : 16 km/h ; rayon 2 m : 10 km/h), réglables dans `reglages.json` ; vitesse minimale en virage 1 m/s, dans `defaults.ts`.

**Vitesses de pointe** : l'allure d'une course ou la vitesse d'un segment est une vitesse cible de pointe ; la durée découle du profil.

**Facteur de vitesse** (solveur commun de `engine/profile.ts`) : multiplie les vitesses cibles d'un ensemble de segments pour qu'un point soit atteint à un instant donné. La durée décroît avec le facteur ; dichotomie à nombre fixe d'itérations sur le logarithme du facteur, plafond : vitesse cible maximale = seuil rouge. Il sert à :
- `durationOverride` (Q5) : tous les segments, pour que la course dure exactement la durée imposée ;
- la synchronisation en vitesse ajustée (section 5) ;
- le relayeur en retard (D-079) : il arrive exactement à la sortie de balle, vitesse augmentée, alerte `relayerLate` inchangée.

Mise en œuvre dans `timeline.ts` :
- `RunMotion` porte son profil (vitesses de départ et de fin, pointes par segment) ;
- `motionProgress` et `motionPosition` lisent le profil ;
- `until` (regroupement) reste un arrêt net : une plaquée s'arrête au plaquage ;
- le déplacement du relayeur reçoit aussi un profil (départ à 0, sprint des réglages) ;
- cache des profils dans `EvalCaches`, indexé par le hachage des entrées.

Contrôle d'en-avant (5.7) : vitesse de la passeuse lue sur le profil (analytique), même règle (dérivée à gauche, fin du temps parent au tout début d'un temps, D-085).

## 3. Course qui finit lancée (5.2)

- **Drapeau explicite** « Finit lancée » sur une course. Il ne dépend que du temps où elle est : pour un même `t` dans le tronc, toutes les options donnent le même état (5.2 respectée).
- Profil : la course finit au plafond de son dernier segment au lieu de freiner jusqu'à 0.
- **Sans effet si la course finit avant la fin de son temps** (Q4) : la joueuse attend la fin des autres actions ; elle ne peut pas rester lancée pendant l'attente. Freinage normal, sans alerte ; l'inspecteur et la liste le disent (« Sans effet : attente de x s avant le temps suivant », x mesuré avec la course lancée). Calcul : temps compilé avec les courses lancées, puis recompilé avec un freinage normal pour celles qui finissent avant la fin du temps ou sont arrêtées par un regroupement, jusqu'à ce qu'il n'y en ait plus (une course qui freine ne redevient jamais lancée).
- **Prolongée** dans le temps suivant d'une ligne quand la joueuse y a sa première course avec un délai effectif nul (lien compris) : cette course part à la vitesse de fin, sans arrêt, et **dans la direction d'arrivée de la course parente** (Q13 a) : son premier segment devient une courbe de Bézier cubique dont la tangente de départ est celle d'arrivée de la course parente et la tangente au premier point celle de la spline d'origine. Ni ses points de passage ni le temps parent ne changent (5.2).
- **Non prolongée** (aucune course, ou délai effectif > 0) : arrêt net à la frontière des temps dans cette option, et avertissement `runNotContinued` sur la course lancée, qui nomme l'option. Un temps sans suite (feuille) : aucune alerte.
- **Posé automatiquement** :
  - à la migration (section 1) ;
  - par l'outil Course, dans la même étape d'annulation, quand la course tracée (délai 0) fait que toutes les options du temps suivant prolongent la course du temps précédent.
  - Modifiable dans l'inspecteur.
- Départ différé d'une course qui prolonge une course lancée : délai calculé d'abord avec le départ lancé ; s'il est positif, recalculé avec un départ arrêté (la course parente est alors non prolongée).

## 4. Vitesse par segment (B)

- **Moteur** : vitesse cible d'un segment = allure de la course, allure propre (réglages), ou vitesse en m/s ; multipliée par le facteur éventuel (durée imposée, vitesse ajustée).
- **Édition** (Q2) :
  - un clic sur le trait d'une course la sélectionne avec le segment sous le pointeur (`Selection.segment`) ; un point sélectionné désigne le segment qui arrive à ce point ;
  - inspecteur, bloc « Segment n » : « Allure de la course », Marche, Trot, Sprint, « Vitesse saisie » (champ en km/h) ;
  - raccourcis 1, 2, 3 (marche, trot, sprint) et 0 (allure de la course) sur le segment sélectionné ; sans segment, 1, 2, 3 changent l'allure de la course.
- **Commandes** (`editor/commands.ts`) : `setSegmentSpeed` ; `moveWaypoint`, `addRun` et `transform.ts` (déplacer, retourner) gardent `speed`.
- **Rendu** (Q3) : un segment dont la vitesse cible atteint l'allure sprint des réglages est tracé plus épais (clé de thème `fastRunWidth`, dans les 4 thèmes, aplat) ; dans l'éditeur, le lecteur et les exports. `SchematicRun` et `RunTrace` portent des morceaux `{ points, fast }`.

## 5. Synchronisation et rendez-vous (C)

**Instant de la cible**, lu sur une simulation du temps (positions et boucle d'événements du ballon) :
- fin ou point d'une course : son mouvement (arrêt par un regroupement compris) ;
- lâcher d'une passe ou d'un jeu au pied : instant réel (fixe, reporté par la tolérance, ou à la réception) ;
- arrivée d'une passe ou d'un jeu au pied ;
- formation : début du temps + délai.

**Point de la course liée** : sa fin, ou son point `at` (rendez-vous).

**Résolution** (nouveau `engine/sync.ts`, appelé par `compilePhase`) :
1. courses de base avec leur délai et leurs vitesses enregistrés ;
2. courses liées dans l'ordre du graphe (section 1) ; pour chacune : simulation du temps avec les mouvements courants, lecture de l'instant cible, puis ajustement de la course ;
3. compilation finale avec tous les mouvements.
- **Départ différé** : délai = instant cible − début du temps − temps de la course jusqu'au point ; le délai enregistré est ignoré tant que le lien s'applique.
- **Vitesse ajustée** : facteur commun sur les segments situés avant le point de rendez-vous ; les suivants gardent leurs vitesses ; le délai enregistré s'applique.
- Limite assumée : un lien qui change qui ramasse un ballon au sol (dépendance que le graphe ne voit pas) peut décaler une cible déjà résolue ; le résultat reste déterministe.

**Cas impossibles** (Q6) : alerte sur la course et dans la liste ; l'édition n'est jamais bloquée.

| Cas | Repli | Alerte |
|---|---|---|
| Délai calculé négatif | départ à 0, arrivée en retard | `syncLate` (retard en s) |
| Vitesse nécessaire au-delà du seuil rouge, ou instant cible avant le départ | facteur plafonné au seuil rouge | `syncSpeedCapped` (vitesse nécessaire) |
| Cible supprimée, de type incompatible, point inexistant, cible jamais atteinte (passe ignorée) | lien ignoré : délai et vitesses enregistrés | `syncTargetMissing` ou `syncTargetInvalid` |
| Cycle (fichier modifié à la main) | liens du cycle ignorés | `syncCycle` |

- **Suppression** : supprimer l'action cible garde le lien (alerte « cible supprimée ») ; supprimer un point qui porte un lien (rendez-vous ou cible) retire ce lien dans la même étape, avec un message, et décale les index des autres liens de la course ; « Dupliquer » un temps recopie ses liens vers les copies.
- **Création** (Q7, sans raccourci) :
  - bouton « Caler sur… » de l'inspecteur ; point de rendez-vous = le point sélectionné, sinon la fin ;
  - bandeau en surimpression (comme D-096) : « Cliquez la cible », Échap pour annuler ;
  - clic sur la cible : poignée d'une autre course (point, ou fin si c'est son dernier point), trait d'une course (fin), passe ou jeu au pied (extrémité la plus proche : lâcher ou arrivée), anneau ou trajet du relayeur (formation) ;
  - réglage « Départ différé » par défaut ; refus avec message si le lien crée une boucle ou vise la course elle-même.
- **Inspecteur** : « Calée sur : arrivée de la passe A4 → A5 » ; « Point de rendez-vous » (Fin, Point 1...) et « Réglage » (Départ différé, Vitesse ajustée) ; résultat (« délai calculé 0,8 s » ou « vitesses × 1,12 ») ; « Retirer le lien » (qui fige le délai calculé d'un départ différé). Durée imposée et vitesse ajustée s'excluent : poser l'une retire l'autre.
- **Terrain** : quand la course liée ou sa cible est sélectionnée, trait fin en tirets (couleur de sélection) entre le point de rendez-vous et le point de la cible ; surcouche d'édition seulement, jamais exporté.

## 6. Vitesses irréalistes (E)

- **Seuils** sur la vitesse de pointe réelle (profil) de chaque segment : au-delà du seuil orange, avertissement `runSpeedHigh` ; au-delà du rouge, erreur `runSpeedTooHigh` (« Segment 2 : 23,4 km/h ») ; jamais bloquant.
- **Où** : inspecteur et liste ; éditeur : pastille ronde orange ou rouge au milieu du segment, toujours ; lecteur : calque « Vitesses », par poste, activé par défaut (Q11) ; jamais dans les GIF, les PDF ni les vignettes de la bibliothèque (comme D-086).
- **Réglages de l'inspecteur** : seuils orange et rouge en km/h ; profil (accélération, freinage, accélération latérale) ; allures affichées en m/s et km/h (« Sprint : 5,5 m/s (19,8 km/h) »).
- **Partout dans l'interface**, vitesses en km/h et en m/s ; le code reste en m/s (formatage dans `ui/format.ts`).

## 7. Lâcher des passes et des jeux au pied (Q8)

Deux modes, enregistrés dans l'action :
- **À un instant fixe** (absent, comme aujourd'hui) : début du temps + délai. **Tolérance** : si la joueuse n'a pas le ballon à cet instant mais le reçoit au plus 0,5 s après (HYPOTHÈSE), le lâcher a lieu à la réception, sans alerte ; l'instant réel est affiché. Au-delà, l'erreur actuelle (D-013). Elle garde les passes enchaînées existantes, dont les arrivées se décalent de 0,1 à 0,3 s avec le profil.
- **À la réception** (`release: 'onReceipt'`) : le lâcher a lieu quand la joueuse reçoit le ballon dans le temps (arrivée d'une passe ou d'un jeu au pied vers elle, sortie d'un regroupement dont elle est le relayeur), plus le délai (temps de contrôle, >= 0). Plusieurs lâchers à la réception d'une même joueuse prennent ses réceptions dans l'ordre chronologique, dans l'ordre du tableau. Sans réception dans le temps : l'erreur actuelle (sans ballon). Pas de tolérance pour ce mode.
- **Outils Passe et Jeu au pied** : mode « à la réception », délai 0, quand la joueuse n'a pas le ballon au début du temps ; sinon instant fixe comme aujourd'hui (D-015).
- **Inspecteur** : « Lâcher : à la réception (+ délai) » ou « à un instant fixe » ; la liste et l'inspecteur affichent l'instant réel.
- **Boucle d'événements** (`compilePhase`) : file d'événements ; chaque réception programme le lâcher à la réception suivant de la joueuse ; une transition (arrivée, sortie, ramassage) est résolue avant tout événement de même instant ou plus tardif.

## 8. Liste des actions du temps (A)

**Emplacement** (Q1) : la bande du bas, de hauteur fixe (176 px), est partagée : arbre des temps à gauche (2/5 de la largeur), « Actions du temps » à droite (3/5).
- Le terrain ne change ni de taille ni de cadrage : aucune hauteur ne change (6.1, D-048 ; test de bout en bout).
- La bande du bas est la zone du temps, juste sous le curseur temporel, et c'est la seule zone large : les barres de temps ont besoin de largeur, l'inspecteur n'a que 320 px.
- Écarté : onglet dans la bande du bas (arbre et liste jamais visibles ensemble) ; section de l'inspecteur (trop étroite, déplacée par la sélection).

**Données** (nouveau `engine/actionReport.ts`, pur, depuis le temps compilé sur le chemin jusqu'au temps affiché) : une ligne par action, triée par instant de début, puis ordre du tableau ; début et fin relatifs au temps ; alertes de l'action.

| Type | Détails |
|---|---|
| Course | joueuse, longueur, départ, arrivée, durée, vitesse moyenne et de pointe, vitesse de chaque segment (allure ou saisie), lien, fin lancée (ou sans effet) |
| Passe | passeuse, receveuse, mode et instant réel du lâcher, arrivée, distance, temps de vol, en-avant probable |
| Jeu au pied | frappeuse, cible (receveuse ou point), mode et instant réel du lâcher, distance, temps de vol |
| Regroupement | type, plaquée, formation, sortie de balle |

Actions ignorées (deuxième course, passe sans ballon) : ligne marquée en erreur.

**Interface** (`ui/phases/ActionList.tsx`) :
- en-tête gradué en secondes sur la durée du temps ;
- chaque ligne, sur une hauteur, est un bouton : type et acteurs, barre (début, fin), détails principaux, pastilles d'alerte ; tous les détails en infobulle et dans l'inspecteur ;
- défilement interne ;
- clic : sélection, sur le terrain et dans l'inspecteur ; en lecture, retour au mode édition du temps affiché, comme un clic sur le terrain ;
- survol : `hoveredActionId` dans le store d'interaction, halo en tirets sur le terrain ;
- Suppr : raccourci existant, une étape d'annulation ;
- la ligne de l'action sélectionnée est mise en évidence ;
- temps affiché : le temps sélectionné en édition, le temps à `t` en lecture.

## 9. Espace : lecture et pause (F)

- La gestion d'Espace sort de `FieldCanvas` : hook `ui/hooks/useSpaceKey.ts` et automate pur `editor/spaceKey.ts` (appui, glisser commencé, relâchement), testé seul.
- Appui bref (relâchée sans aucun glisser, en moins de 0,5 s, HYPOTHÈSE, Q12) : lecture ou pause (même fonction que L), dans l'éditeur et le lecteur, plein écran compris.
- Espace maintenue + glisser : déplacement inchangé, sans lecture ni pause. Répétition de touche ignorée.
- `preventDefault` à l'appui **et** au relâchement : un bouton, une case à cocher ou un `summary` qui a le focus n'est ni activé ni coché (Chrome et Firefox, D-056).
- Ignorée dans les champs de texte, les listes, le curseur temporel (`isTypingTarget`) et quand un dialogue est ouvert. L reste.

## 10. Ce qui change pour une combinaison existante

- **Durées** plus longues : rampes d'accélération et de freinage, virages, sprint à 5,5 m/s si `reglages.json` avait l'ancien défaut.
  - 20 m tout droit au trot : 5,0 s avant, 6,2 s après.
  - 30 m au sprint : 4,3 s avant (7 m/s), 7,1 s après (5,5 m/s).
  - Une course prolongée au temps suivant (lancée par la migration) ne perd pas de temps au freinage et part dans la direction d'arrivée.
  - Conséquences : GIF plus longs donc plus lourds (version allégée proposée plus souvent au-delà de 8 Mo), lecture plus longue.
- **Durée imposée** : durée identique, vitesse de pointe plus élevée qu'avant (rampes) ; alerte si elle dépasse un seuil.
- **Positions intermédiaires** : à un même instant, une joueuse est moins loin au début d'une course. Positions finales et points de passage inchangés, sauf :
  - une course arrêtée par un regroupement s'arrête ailleurs (le point dépend de l'instant de formation) ;
  - les positions de départ des temps suivants changent alors aussi.
- **Tracé** : le premier segment d'une course qui prolonge une course lancée change de forme (raccord de tangente).
- **Instants de passe par défaut** : délais enregistrés inchangés, mode « instant fixe ». Arrivées décalées de quelques dixièmes ; passes enchaînées gardées par la tolérance de 0,5 s. Au-delà : alerte « passeuse sans ballon », à recaler (ou passer en « à la réception »).
- **En-avant** : la vitesse de la passeuse au lâcher change (souvent plus faible en fin de course freinée, plus élevée en milieu de course) ; des passes peuvent gagner ou perdre l'alerte.
- **Regroupements** : instant de formation enregistré inchangé ; relayeur avec profil ; `relayerLate` peut apparaître ou disparaître.
- **Ramassage** du ballon au sol : instants décalés, même règle.
- **Ligne d'avantage** : recalée au point du regroupement, qui peut bouger légèrement (course coupée).
- **Rendu** : segments au sprint tracés plus épais ; pastilles de vitesse dans l'éditeur.
- **Fichiers** : réécrits en v3 au premier enregistrement ; `reglages.json` en v3 au premier enregistrement des réglages.

## 11. Ce que le lot change pour le lot 4 (SPEC 11.5), sans rien en implémenter

- Les attaquantes ont désormais une vitesse continue et une accélération bornée. La poursuite (« position + vitesse × 0,3 s ») et le déclenchement lisent une vitesse fiable : `motionVelocity` analytique, au lieu d'une dérivée numérique.
- Cohérence des bornes : `DefenseSettings.maxAccel` (4 m/s²) et le profil des courses (`reglages.json` : 3 m/s², freinage 4, latérale 4). Le plan du lot 4 devra dire si les défenseures reprennent ces valeurs.
- `lineSpeed` par défaut 6 m/s (21,6 km/h) dépasse le seuil orange. Le lot 4 devra soit baisser `lineSpeed`, soit dire si les alertes de vitesse s'appliquent aux trajectoires simulées (au lot 3 bis : courses dessinées seulement).
- « Figer » (11.7) : une trajectoire simulée convertie en course devra recevoir des vitesses par segment (vitesse moyenne simulée de chaque segment après Ramer-Douglas-Peucker) pour garder son timing, sans quoi le profil la ralentit.
- Liens : une course ne peut pas être calée sur une défenseure simulée (cibles = actions). Ajout éventuel au lot 4.
- Intégration à pas fixe de 1/50 s : les courses dessinées s'échantillonnent par le profil, en formule fermée, sans contrainte de pas.
- Cache par (combinaison, branche, réglages) : les réglages contiennent désormais le profil et les seuils (une modification relance la simulation).

## 12. SPEC 1.6 et DECISIONS (étape 0)

**`docs/SPEC.md` 1.6**, sections touchées : en-tête ; 3.3.1 ; 4 (modèle v3), 4.3, 4.4 (`reglages.json` v3), 4.5 ; 5.1 ; 5.2 ; 5.3 ; 5.4 ; 5.7 ; nouvelles 5.8 (synchronisation) et 5.9 (vitesses irréalistes) ; 6.1 ; 6.2 ; 6.5 ; nouvelle 6.7 (liste des actions) ; 7 ; 10.5 ; 12 ; 13.3 ; 14 ; 16.

**`docs/decisions/lot-3bis.md`** : section « Lot 3 bis : courses réalistes », entrées D-103 à D-118.

## 13. Fichiers créés ou modifiés

```
docs/plans/lot-3bis.md, ETAT.md, DECISIONS.md, SPEC.md (1.6), ARCHITECTURE.md, RECETTE.md (section Lot 3 bis), README.md
src/config/defaults.ts     PACE_DEFAULTS.sprint 5,5 ; MOTION_DEFAULTS (accélération, freinage, latérale) ;
                           MIN_CORNER_SPEED ; SPEED_ALERT_DEFAULTS ; LEGACY_SPRINT 7 ; PASS_RECEIPT_TOLERANCE ;
                           SPEED_FACTOR_SEARCH ; SPACE_TAP_MAX_MS ; clés de thème ; HYPOTHÈSE
src/model/                 types.ts, schema.ts (v3), schemaV2.ts (figée), migrations.ts, settings.ts (v3),
                           syncGraph.ts (nouveau), validate.ts, issues.ts, declared.ts (GroupRunAction)
src/engine/                profile.ts (nouveau), sync.ts (nouveau), actionReport.ts (nouveau), spline.ts (raccord),
                           timeline.ts, ballEvents.ts, evaluate.ts, sceneState.ts, caches.ts
src/editor/                commands.ts, transform.ts, selection.ts, hitTest.ts, shortcuts.ts, syncPick.ts (nouveau),
                           spaceKey.ts (nouveau), tools/runTool.ts
src/render/                render.ts, renderSchematic.ts, overlay.ts, layers.ts, themes.ts
src/state/                 editorStore, editorActions, overlay, playerStore et prefs, selectors, session, settingsStore
src/ui/                    App.tsx, phases/ActionList.tsx (nouveau), phases/PhaseTree.tsx, inspector/RunInspector.tsx
                           (nouveau), inspector/Inspector.tsx, inspector/SetPieceInspectors.tsx, field/FieldCanvas.tsx,
                           field/SyncBanner.tsx (nouveau), hooks/useSpaceKey.ts (nouveau), player/TransportBar.tsx,
                           format.ts (nouveau), strings.ts, global.css
src/test/                  builders.ts, fixtures/play-v3-lot3bis.json, fixtures/reglages-v2.json, image-snapshots/
e2e/                       actions-list.chromium, run-speeds.chromium, space.chromium et space.firefox,
                           field-stability (liste), support/
```

## 14. Étapes

Chaque étape finit sur lint, typecheck, test et format verts, un commit (message en français), ETAT.md et la case du plan à jour.

- [x] **Étape 0 : branche, plan, SPEC et décisions.** (commit « Étape 0 : plan du lot 3 bis, SPEC 1.6, D-103 à D-118 », après `e76aa13`) Branche `lot-3bis` depuis `main` (`e76aa13`) ; ce plan avec tes réponses ; SPEC 1.6 ; D-103 à D-118 ; ETAT.md réécrit (écart de la PR #6 corrigé, pistes b, c, d notées).
- [x] **Étape 1 : modèle et réglages v3.** (commit « Étape 1 : modèle v3, réglages v3 et graphe des liens », après `7d34445`) Types, schéma v3, v2 figée, migrations (fin lancée posée), graphe des dépendances et cycles, validation, alertes, réglages v3 (profil, seuils, sprint), `defaults.ts`, fixtures. Tests de migration et de validation.
- [x] **Étape 2 : profil de vitesse.** (commit « Étape 2 : profil de vitesse, course lancée et raccord de tangente », après `8dcf9d9`) `engine/profile.ts`, facteur de vitesse, raccord de tangente, `RunMotion` avec profil, segments, fin lancée (prolongement, attente sans effet), durée imposée, relayeur, en-avant sur le profil, pointes et seuils. Tests existants du moteur recalculés.
- [x] **Étape 3 : synchronisation et lâchers.** (commit « Étape 3 : liens de synchronisation, lâcher à la réception et tolérance », après `6f2223b`) File d'événements, lâcher à la réception, tolérance, `engine/sync.ts` (ordre, simulation, deux réglages, replis). Tests.
- [x] **Étape 4 : sorties du moteur.** (commit « Étape 4 : rapport des actions, morceaux rapides, pastilles et liens », après `c63eba3`) `actionReport.ts`, morceaux rapides des traces et du schéma, pastilles, géométrie des liens. Tests.
- [x] **Étape 5 : rendu.** (commit « Étape 5 : segments rapides, pastilles de vitesse, lien et survol », après `2fb983e`) Segments rapides (4 thèmes), pastilles (calque et éditeur, jamais exportées), lien et survol dans la surcouche. Images de référence.
- [x] **Étape 6 : éditeur.** (commit « Étape 6 : commandes des segments et des liens, choix de la cible, raccourcis », après `3504a59`) Commandes (segments, fin lancée, liens avec refus des cycles, index des points, copie des liens, mode de lâcher), outils Passe et Jeu au pied (mode par défaut), sélection du segment, atteinte des cibles, raccourcis 1 2 3 0, choix de la cible, automate d'Espace, fin lancée posée par l'outil Course. Tests unitaires.
- [x] **Étape 7 : interface.** (commit « Étape 7 : liste des actions, inspecteur de la course, liens, Espace », après `4949252`) Bande du bas et liste, inspecteur de la course, de la passe et du jeu au pied, bandeau « Caler sur… », calque « Vitesses », réglages (profil, seuils, km/h), message du sprint, Espace. Tests de bout en bout.
- [x] **Étape 8 : exports et clôture.** (commit « Étape 8 : exports vérifiés, architecture, recette et README », après `d0d4b24`) GIF et PDF (segments rapides présents, pastilles et liens absents) ; ARCHITECTURE, RECETTE, README ; recette automatisable complète ; push ; PR `lot-3bis` vers `main`. Tu fusionnes.

## 15. Dépendances

Aucune.

## 16. Tests

### Nouveaux, obligatoires (moteur)

| Exigence | Tests |
|---|---|
| Profil : durée | `engine/profile.test.ts` : ligne droite comparée au trapèze analytique et au triangle (course courte) |
| Profil : continuité | grille fine : écart de position borné par vitesse × pas ; sauts de vitesse bornés par accélération × pas ; vitesse analytique égale à la dérivée numérique |
| Profil : virages | vitesse au sommet d'un virage <= sqrt(a_lat × rayon) ; virage plus serré, course plus longue ; demi-tour à la vitesse minimale |
| Profil : réglages | accélération, freinage, latérale de `reglages.json` pris en compte |
| Segments | marche puis sprint : pointe de chaque segment <= sa cible ; transitions à accélération bornée ; vitesse saisie ; facteur de durée imposée exact |
| Fin lancée | fin à la vitesse cible ; temps suivant qui part à cette vitesse et dans la direction d'arrivée (tangentes égales, points de passage et temps parent inchangés) ; option non prolongée : arrêt net et `runNotContinued` ; course finie avant la fin du temps : freinage normal, sans alerte, attente mesurée ; tronc identique dans toutes les options (5.2) |
| Liens | `engine/sync.test.ts` : départ différé, point de rendez-vous et cible au millième de seconde ; vitesse ajustée : idem, segments suivants inchangés ; les 5 sortes de cible ; la course liée suit quand la cible change ; chaîne de liens ; cible lâchée à la réception |
| Liens : cycles et cas impossibles | cycles refusés (validation, commande, moteur), dont ceux qui passent par un lâcher à la réception ; boucle de lâchers à la réception sans lien acceptée ; délai négatif ; plafond au seuil rouge ; cible supprimée ; index hors bornes |
| Lâchers | à la réception (+ délai) : passe, jeu au pied, sortie de regroupement ; deux lâchers à la réception de la même joueuse ; sans réception : erreur ; tolérance de 0,5 s en instant fixe seulement |
| Seuils | 19,9 / 20,1 / 25,1 km/h ; seuils des réglages ; pointe réelle et non cible |
| Saut direct à t | `evaluate` à t et lecture continue par `tick` : même état et même suite d'appels de dessin (contexte enregistreur), sur une combinaison avec profil, liens, lâchers à la réception et fin lancée |
| Déterminisme | deux compilations, mêmes octets |

### Nouveaux (autres)
- Modèle : migration v2 vers v3 (fixture figée), v1 vers v3, v4 refusée comme future ; fin lancée posée par la migration, seulement si toutes les options prolongent ; réglages v2 vers v3 (7 devient 5,5, 6,5 reste 6,5, profil et seuils par défaut) ; zod strict des liens et du mode de lâcher.
- Éditeur : commandes des segments, des liens, de la fin lancée, du mode de lâcher ; index des points et liens retirés à la suppression d'un point ; copie des liens par « Dupliquer » ; vitesse gardée par déplacer, retourner et le glisser d'un point ; mode de lâcher posé par les outils ; cible depuis un clic ; raccourcis ; automate d'Espace.
- Rendu : segments rapides dans les 4 thèmes ; pastilles selon le calque, absentes des exports et des vignettes ; lien et survol dans la surcouche.

### Modifiés (et pourquoi)
- `engine/evaluate.test.ts`, `breakdown.test.ts`, `kick.test.ts`, `forwardPass.test.ts`, `pass.test.ts` : durées attendues `longueur / allure` remplacées par la durée du profil (calculée analytiquement dans le test) ; les tests à durée imposée gardent leurs valeurs.
- `model/schema.test.ts`, `migrations.test.ts`, `settings.test.ts` : versions courantes 3.
- `spline.test.ts` : la spline reste paramétrée par l'abscisse ; ajout du raccord de tangente.
- Exports : nombres d'images recalculés par les mêmes fonctions.
- Images de référence régénérées par `UPDATE_SNAPSHOTS=1`, listées dans le commit, chacune regardée.
- Bout en bout : `interface.chromium` (durée qui change avec l'allure) ; `field-stability.chromium` (terrain inchangé avec la liste).
- Aucun test désactivé.

### Bout en bout (Playwright)
- **`actions-list.chromium`** : liste triée avec barres ; clic qui sélectionne ; survol ; Suppr puis Ctrl+Z ; terrain inchangé.
- **`run-speeds.chromium`** : segment au sprint par la touche 3, puis vitesse saisie en km/h ; « Caler sur… » une passe, la course suit quand la passe change ; cycle refusé ; seuil rouge (liste, pastille, calque « Vitesses » mémorisé) ; réglages (seuils, profil) écrits dans `reglages.json` v3 ; `reglages.json` v2 à 7 m/s migré avec le message ; passe à la réception posée par l'outil.
- **`space.chromium`, `space.firefox`** : appui bref (lecture puis pause) ; Espace + glisser (déplacement sans lecture) ; focus sur un bouton puis sur une case : ni activé ni coché ; champ de texte : l'espace est saisi ; curseur temporel : ignorée.

## 17. Vérifications manuelles prévues (D-054, impossibles à automatiser)

1. Ressenti du mouvement (accélérations, virages, courses lancées) sur deux ou trois combinaisons réelles, profil ajusté dans les réglages si besoin : séance d'usage libre.
2. Après le déploiement, les deux PC rechargés : combinaison v3 et `reglages.json` v3 vus et modifiables sur l'autre PC.
3. GIF d'une combinaison existante, plus long qu'avant, sur WhatsApp : poids et lecture en boucle.

## 18. Questions et réponses

Réponses de l'utilisateur, le 23 octobre 2026 :

| Question | Réponse | Décision |
|---|---|---|
| Q1 | Proposition retenue (bande du bas partagée). | D-113 |
| Q2 | Proposition retenue. | D-114 |
| Q3 | Proposition retenue. | D-115 |
| Q4 | Proposition retenue. **En plus** : une course « Finit lancée » qui se termine avant la fin de son temps freine normalement, sans alerte, avec une mention dans l'inspecteur. | D-106 |
| Q5 | Proposition retenue. | D-107 |
| Q6 | Proposition retenue. | D-108 |
| Q7 | Proposition retenue, sans raccourci. | D-109 |
| Q8 | Tolérance de 0,5 s retenue pour l'instant fixe. **En plus** : mode de lâcher « à la réception » (+ délai) enregistré dans la passe et le jeu au pied, posé par défaut par les outils quand la joueuse n'a pas le ballon au début du temps ; dépendance dans le graphe des liens ; pas de migration vers ce mode. | D-110 |
| Q9 | Valeurs retenues, HYPOTHÈSE. **Accélération, freinage et accélération latérale réglables dans `reglages.json` v3** et dans les réglages de l'inspecteur ; vitesse minimale en virage dans `defaults.ts`. | D-105 |
| Q10 | Proposition retenue. | D-111 |
| Q11 | Proposition retenue. | D-112 |
| Q12 | Proposition retenue. | D-116 |
| Q13 | **a dans ce lot** (raccord de tangente, avec un test) ; b, c et d plus tard, notées dans ETAT.md. | D-106, D-118 |

Les questions telles que posées, avec les propositions :

**Liste et édition**
- **Q1. Emplacement de la liste.** Proposition : bande du bas partagée, arbre à gauche (2/5), liste à droite (3/5), hauteur inchangée. En lecture, la liste montre le temps à `t`. Autres : onglet dans la bande du bas ; section de l'inspecteur.
- **Q2. Point sélectionné et segment.** Proposition : un point désigne le segment qui arrive à ce point ; un clic sur le trait désigne le segment sous le pointeur ; raccourcis 1, 2, 3 et 0 ; sans segment sélectionné, 1, 2, 3 règlent l'allure de la course. Autre : le point désigne le segment qui en part.
- **Q3. Segments rapides.** Proposition : trait plus épais pour tout segment dont la vitesse cible atteint l'allure sprint des réglages, dans l'éditeur, le lecteur et les exports. Autres : doubles chevrons ; seuil orange ; éditeur seulement.

**Mouvement**
- **Q4. Course qui finit lancée.** Proposition : drapeau explicite, posé automatiquement par la migration et par l'outil Course quand toutes les options du temps suivant la prolongent ; dans une option qui ne la prolonge pas, arrêt net et avertissement. Autre : règle automatique sans drapeau.
- **Q5. Durée imposée.** Proposition : la garder, sans migration ; facteur commun sur toutes les vitesses, plafond au seuil rouge ; exclusive avec la vitesse ajustée. Autres : la retirer ; la convertir en lien.
- **Q6. Replis des liens.** Proposition : tableau de la section 5 ; facteur commun avant le rendez-vous ; action cible supprimée : lien gardé, alerte ; point lié supprimé : lien retiré, message. Autres : vitesse uniforme ; lien ignoré au-delà du seuil rouge.
- **Q7. Création d'un lien.** Proposition : « Caler sur… », bandeau, clic sur la cible, départ différé par défaut, aucun raccourci. Autre : raccourci C.
- **Q8. Passes enchaînées existantes.** Proposition : tolérance de 0,5 s, sans alerte. Autres : bouton « Recaler sur la réception » ; mode de lâcher « dès réception ».
- **Q9. Valeurs du profil.** 3 / 4 / 4 m/s², 1 m/s ; dans `defaults.ts` seulement.

**Vitesses et clavier**
- **Q10. Seuils et sprint.** Proposition : seuils dans `reglages.json` v3 en km/h ; sprint à 7 m/s exactement ramené à 5,5 m/s, avec un message. Autres : garder 7 ; seuils par poste.
- **Q11. Alerte de vitesse dans le lecteur.** Proposition : pastille orange ou rouge au milieu du segment, calque « Vitesses » activé par défaut, toujours dans l'éditeur, jamais exportée. Autre : anneau autour du jeton.
- **Q12. Appui bref sur Espace.** Proposition : relâchée sans glisser en moins de 0,5 s. Autre : sans limite de durée.
- **Q13. Autres pistes.** a. Continuité de direction à la frontière des temps. b. Accélération exponentielle. c. Vitesse initiale au temps 1. d. Ballon porté du côté du sens de course.

## 19. Vérification de fin de lot

- `npm run lint`, `typecheck`, `test`, `test:e2e` (Chromium et Firefox), `build`, `format:check`, en local puis en CI.
- Recette automatisable : section « Lot 3 bis » de `docs/RECETTE.md`, chaque comportement relié à ses tests.
- Contrôles ponctuels : `bundle.chromium.spec.ts` vert ; aucun test désactivé ; fixtures v1 et v2 inchangées ; images de référence régénérées listées et regardées.
- PR `lot-3bis` vers `main`, avec les sections de la SPEC modifiées ; au plus 5 vérifications manuelles (section 17).
