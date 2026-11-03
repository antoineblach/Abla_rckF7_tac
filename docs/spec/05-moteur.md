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
- **Profil de vitesse** (lot 3 bis, D-105 ; modèle du lot 3bis-1, D-135) : calculé sur ces échantillons.
  - Plafond à chaque échantillon : la vitesse cible de son segment, et `sqrt(accélération latérale / courbure)` borné en bas par la vitesse minimale en virage (courbure par le cercle de trois échantillons voisins).
  - Départ à l'arrêt, ou à la vitesse de fin de la course lancée qu'elle prolonge ; arrivée à l'arrêt, ou au plafond si elle finit lancée.
  - Passe avant : accélération a(v) = a0 · (1 − v / vmax), nulle au-delà de vmax, soit v = vmax · (1 − e^(−t/τ)) depuis l'arrêt, τ = vmax / a0 (Samozino et al. 2016) ; vmax est la pointe de la joueuse (`motion.topSpeed`), pas la vitesse du segment. Par segment, selon sa vitesse cible c : a0 × min(1, c / sprint) (1,9 m/s² à la marche, 3,8 m/s² au trot) ; au-delà de 0,95 fois la pointe (HYPOTHÈSE), l'asymptote du segment devient c / 0,95, a0 gardé, pour que la cible soit atteinte. Vitesse de fin d'intervalle par la relation fermée entre distance et vitesse, résolue par Newton à 5 itérations.
  - Passe arrière à freinage constant ; la vitesse de départ imposée prime.
  - Chaque intervalle est représenté à accélération constante entre ses deux vitesses ; position, vitesse et instant de passage à un point en formule fermée : une lecture continue et un saut direct à `t` donnent le même état. Écart au modèle exact, pris presque entier sur le premier intervalle : 9 ms sur un segment de 10 m, 48 ms sur 50 m.
  - Valeurs d'une joueuse amatrice, réglables dans `reglages.json` : pointe 24 km/h (6,67 m/s), a0 5,2 m/s² (τ 1,28 s), freinage 4 m/s², accélération latérale 4 m/s² ; vitesse minimale en virage 1 m/s. Calibration sur les temps de la France à 7 féminine à 10, 20 et 50 m, corrigés de +0,5 s (Haugen) : élite 28,6 km/h et 6,2 m/s² ; amatrice à 0,84 fois la pointe, même τ (HYPOTHÈSE). Sources et justifications : `src/config/defaults.ts`. Lot 3 bis : trapèze à 3 m/s².
- **Vitesse d'un segment** (D-114) : celle du point qui le termine (`Waypoint.speed`, allure ou m/s), sinon l'allure de la course (allure nommée ou vitesse saisie, D-133). C'est une vitesse de pointe : la durée découle du profil.
- **Le mouvement sert l'intention du coach** (lot 3bis-1, D-129) : les bornes du profil (vitesse, accélération, freinage, virages) façonnent le mouvement par défaut et ne contraignent jamais une intention du coach : durée imposée, lien de synchronisation dans ses deux réglages (5.8), relayeur au ballon à la sortie (10.3). Chacune est tenue exactement ; au-delà des bornes, la course va plus vite, accélère, freine ou tourne plus fort, et seuls les seuils d'alerte le signalent (5.9). Les seuils ne règlent jamais le mouvement. Hors de ce principe : les validations du ballon (5.4).
- **Solveur à deux leviers** (D-130) : pour qu'un point soit atteint à un instant donné, en agissant sur un ensemble de segments :
  - levier 1 : facteur commun f sur leurs vitesses cibles, bornes inchangées ; seul pour ralentir, et pour accélérer jusqu'à la bascule, où la cible la plus rapide atteint la pointe de la joueuse ;
  - levier 2, au-delà de la bascule : facteur k >= 1 ; vitesses cibles × k, accélération, freinage et accélération latérale × k², vitesse minimale en virage et pointe × k, appliqués par intervalle du profil : la vitesse de départ imposée reste continue (5.2) ;
  - dichotomie à nombre fixe d'itérations sur log f, puis sur log k ; borne numérique de recherche : k <= 1000 ;
  - il sert à la durée imposée, à la vitesse ajustée et au départ différé en retard (5.8), et au relayeur (10.3). Facteurs affichés : « vitesses × f », plus « accélérations × k² » quand k > 1 (6.5).
- **Durée imposée** (`durationOverride`, D-107, D-129) : le solveur agit sur tous les segments de la course pour qu'elle dure exactement cette durée, profil compris ; aucune alerte propre, seulement celles des seuils (5.9). Au-delà de la borne de recherche, tenue par une mise à l'échelle du temps du profil entier (garde numérique, D-136). Exclusive avec un lien en vitesse ajustée ; ignorée sous un départ différé en retard (5.8).
- Allures par défaut : marche 2 m/s, trot 4 m/s, sprint 5,5 m/s (HYPOTHÈSE, réglables dans `reglages.json` ; 7 m/s avant le lot 3 bis, D-111). Ce sont des vitesses cibles ; la pointe de la joueuse est la vitesse que son accélération approche.
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
  - à la réception (`release: 'onReceipt'`) : à l'instant où la joueuse reçoit le ballon dans la phase (arrivée d'une passe ou d'un jeu au pied vers elle, sortie d'un regroupement dont elle est le relayeur), plus le délai (temps de contrôle, >= 0). Les lâchers à la réception d'une même joueuse prennent ses réceptions dans l'ordre chronologique, dans l'ordre du tableau. Sans réception dans la phase : ignoré et signalé (sans ballon). Pas de tolérance. Un ramassage au sol n'est pas une réception (D-119 ; outils, 6.2).

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
  - Réglage « Départ différé » : délai calculé = instant de la cible − début de la phase − temps de la course jusqu'au point ; le délai enregistré est ignoré tant que le lien s'applique. Délai calculé négatif (lot 3bis-1, D-131) : départ à 0 et solveur sur les segments avant le rendez-vous, comme une vitesse ajustée, pour arriver à l'heure. Si la course a aussi une durée imposée, celle-ci ne s'applique pas : le solveur part des vitesses enregistrées, les segments suivants gardent les leurs ; partie à 0, la course prolonge la course lancée qui la précède, s'il y en a une (5.2, D-136).
  - Réglage « Vitesse ajustée » : solveur à deux leviers (5.3) sur les segments situés avant le point de rendez-vous ; les suivants gardent leurs vitesses ; un seul profil sur toute la course, vitesse continue au rendez-vous ; le délai enregistré s'applique.
  - Course de la receveuse calée sur l'arrivée de la passe qu'elle reçoit : l'instant cible est le lâcher plus la distance de la passeuse au point de rendez-vous divisée par la vitesse du ballon ; la passe arrive donc au point de rendez-vous quand elle y arrive (4.3).
- **Résolution** : courses de base avec leurs délais et vitesses enregistrés ; puis courses liées dans l'ordre du graphe des dépendances (4.3) ; pour chacune, simulation de la phase avec les mouvements courants et lecture de l'instant de la cible (arrêt par un regroupement, report et lâcher à la réception compris), puis ajustement ; enfin compilation de la phase. Limite assumée : un lien qui change le ramassage d'un ballon au sol peut décaler une cible déjà résolue ; le résultat reste déterministe.
- **Rendez-vous au-delà des bornes** : tenu exactement, signalé par les seuls seuils (5.9, D-129).
- **Cas particuliers** : alerte sur la course et dans la liste des actions ; l'édition n'est jamais bloquée.

| Cas | Comportement | Alerte |
|---|---|---|
| Délai calculé négatif | départ à 0, course accélérée : arrivée à l'heure (ci-dessus) | « il aurait fallu partir x s plus tôt : départ immédiat, course accélérée » |
| Cible avant le départ : instant voulu <= 0, ou au-delà de la borne de recherche du solveur | seul repli : délai et vitesses enregistrés, arrivée en retard | retard en secondes |
| Cible supprimée, de type incompatible, point inexistant, cible jamais atteinte | lien ignoré : délai et vitesses enregistrés | cible supprimée ou invalide |
| Cycle (fichier modifié à la main) | liens du cycle ignorés | cycle |

- **Édition** (D-108, D-109) :
  - création par « Caler sur… » dans l'inspecteur (6.5) ; un lien qui créerait un cycle ou viserait sa propre course est refusé avec un message ;
  - supprimer l'action cible garde le lien (alerte) ; supprimer un point de passage qui porte un lien (rendez-vous ou cible) retire ce lien, avec un message ; « Dupliquer » une phase recopie ses liens vers les copies ;
  - retirer un lien en départ différé fige le délai calculé ; durée imposée et vitesse ajustée s'excluent.
- **Affichage** : quand la course liée ou sa cible est sélectionnée, trait fin en tirets (couleur de sélection) entre le point de rendez-vous et le point de la cible, dans la surcouche d'édition seulement, jamais exporté.

### 5.9 Vitesses et accélérations irréalistes (lot 3 bis, lot 3bis-1)

- Vitesse : deux seuils sur la vitesse de pointe réelle (profil) de chaque segment de course, réglables dans `reglages.json` : orange au-delà de 20 km/h (avertissement), rouge au-delà de 25 km/h (erreur) (HYPOTHÈSES, choix du coach, D-111).
- Accélération et freinage (lot 3bis-1, D-132, D-135) : seuils orange et rouge en m/s², réglables dans `reglages.json` : accélération 6 et 8, freinage 5 et 7 (HYPOTHÈSES). Pic d'accélération d'un segment : la plus grande accélération instantanée du modèle au début d'un intervalle (a(v) × k², 5.3) ; pic de freinage : le plus grand freinage d'un intervalle. Pas d'alerte d'accélération latérale.
- Mesures sur le profil réel, après le solveur, sur la partie courue de chaque segment (course arrêtée par un regroupement : jusqu'à l'arrêt) ; courses dessinées seulement, pas le déplacement du relayeur ; une course lancée qui freine fort à son départ (virage) reçoit l'alerte de freinage (D-137). Jamais bloquant ; jamais stocké dans les fichiers.
- Les seuils ne règlent jamais le mouvement (D-129) : ils signalent seulement. Lot 3 bis : le seuil rouge plafonnait le facteur de vitesse.
- Affichage (D-112, D-132) : inspecteur et liste des actions (6.5, 6.7) ; pastilles toujours dans l'éditeur, selon le calque « Vitesses » dans le lecteur, dès que la joueuse a atteint leur point ; jamais dans les GIF, les PDF ni les vignettes de la bibliothèque :
  - vitesse : pastille ronde orange ou rouge à « ! » au milieu du segment ;
  - accélération et freinage : losange orange ou rouge (demi-diagonale 0,9 rayon de jeton, contour comme la pastille ronde), « + » pour l'accélération, « − » pour le freinage, tracés en traits ; une pastille par segment et par type.
- Placement d'un losange (D-137) : zone = intervalles du segment au-delà du seuil de son niveau ; la pastille va au point de la zone le plus proche du pic à au moins 2,5 m des extrémités du segment ; si aucune partie de la zone n'y est, au point de cette plage le plus proche du pic. Pic : début de l'intervalle pour une accélération, milieu pour un freinage ; pics égaux : la première accélération, le dernier freinage. Segment de moins de 5 m : milieu du segment, décalé de 2 m vers le pic pour ne pas couvrir la pastille de vitesse (pic au milieu exact : vers le début pour une accélération, vers la fin pour un freinage). Valeurs mesurées à environ 11 px/m, échelle de l'éditeur sur un écran Full HD (HYPOTHÈSES, `defaults.ts`).

