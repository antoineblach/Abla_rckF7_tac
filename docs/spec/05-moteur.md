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
  - Sans effet si elle finit avant la fin de sa phase (la joueuse attend la fin des autres actions) : freinage normal, sans alerte, avec la mention « Sans effet : attente de x s avant le temps suivant ». Calcul : phase compilée avec les courses lancées, puis recompilée avec un freinage normal pour celles qui finissent avant la fin de la phase ou sont arrêtées par un regroupement, jusqu'à ce qu'il n'y en ait plus ; une course qui freine ne redevient jamais lancée (au plus une recompilation par course lancée).
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
  - Course de la receveuse calée sur l'arrivée de la passe qu'elle reçoit : l'instant cible est le lâcher plus la distance de la passeuse au point de rendez-vous divisée par la vitesse du ballon ; la passe arrive donc au point de rendez-vous quand elle y arrive (4.3).
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

