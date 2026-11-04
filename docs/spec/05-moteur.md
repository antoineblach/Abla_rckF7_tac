## 5. Moteur

### 5.1 Lignes, durée et intervalles

- Une **ligne** est un chemin de la racine à une feuille de l'arbre des branches (`branchPath`).
- Durée d'une ligne = le plus tard des instants de fin de ses actions, 0 si aucune action : une course compte jusqu'à la fin de son profil de vitesse (5.3), une passe ou un jeu au pied jusqu'à son arrivée, un regroupement jusqu'à la sortie de balle, une course arrêtée par un regroupement jusqu'à son arrêt (D-094). Une action ignorée ne compte pas (D-038).
- Chaque action démarre à son instant absolu (`start`), ou à l'instant calculé par son collage (5.8).
- Un **intervalle** (D-139) est une séquence, ou un trou d'une branche où démarre au moins une action (sans libellé). Cette seule règle découpe l'éditeur (6.3), les traces appuyées du lecteur (7) et les vignettes du PDF (9.3) :
  - sans séquence ni embranchement : un seul intervalle ;
  - sans séquence mais avec un embranchement : un intervalle pour le tronc et un par option.

### 5.2 Continuité

- Une course part de la position de la joueuse à son instant de départ : `setup.positions` pour sa première course, sinon sa position à cet instant dans la ligne.
- Le premier point d'une course n'est pas stocké : c'est cette position de départ. Modifier une action n'altère jamais les points de passage des actions suivantes ; seul leur point de départ se déplace.
- **Tronc commun** : pour tout `t` avant un embranchement, toutes les lignes qui passent par cet embranchement donnent le même état. Une action commencée avant l'embranchement continue d'elle-même dans toutes ses options. Ce qui le garantit :
  - une action d'une option ne démarre jamais avant l'embranchement (4.3) ;
  - course du tronc prolongée par une partie des options : voir ci-dessous ;
  - passe ou jeu au pied en vol à l'embranchement : le ballon vise la position de la receveuse à l'arrivée ; une course de la receveuse propre à une option pendant le vol est donc retardée à l'arrivée du ballon, alerte « départ retardé de x s ». Le vol ne dépend alors que du tronc. Pour un vrai choix de cap, placer l'embranchement avant le lâcher.
- **Course qui finit lancée** (D-139) : la règle se lit dans le modèle, sans drapeau.
  - Une course finit lancée si et seulement si la course suivante de la joueuse dans la ligne est collée à sa fin, sans écart. Elle finit alors à la vitesse de son dernier segment. Sinon, elle freine jusqu'à l'arrêt ; un écart positif est une attente, donc un freinage.
  - Prolongation : la course suivante part à la vitesse de fin, et dans la direction d'arrivée de la course précédente : son premier segment devient une courbe de Bézier cubique dont la tangente de départ est celle d'arrivée de la course précédente et la tangente au premier point celle de la spline d'origine. Ses points de passage et la course précédente ne changent pas.
  - Course du tronc prolongée par une partie des options (D-106, conservée pour ce seul cas) : elle est lancée dans toutes les lignes, sinon son profil d'avant l'embranchement différerait selon l'option. Dans une option qui ne la prolonge pas : arrêt net à sa fin, avertissement sur la course nommant l'option.
  - Course du tronc dont la suivante, collée, part en réalité à l'embranchement, après sa fin (4.3) : elle n'est pas prolongée. Elle est recompilée une fois avec un freinage normal et ne redevient jamais lancée. C'est la seule recompilation de ce calcul.
  - Une course arrêtée par un regroupement n'est jamais lancée.

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
- **Le mouvement sert l'intention du coach** (lot 3bis-1, D-129) : les bornes du profil (vitesse, accélération, freinage, virages) façonnent le mouvement par défaut et ne contraignent jamais une intention du coach : durée imposée, bord droit collé dans ses deux réglages (5.8), relayeur au ballon à la sortie (10.3). Chacune est tenue exactement ; au-delà des bornes, la course va plus vite, accélère, freine ou tourne plus fort, et seuls les seuils d'alerte le signalent (5.9). Les seuils ne règlent jamais le mouvement. Hors de ce principe : les validations du ballon (5.4).
- **Solveur à deux leviers** (D-130) : pour qu'un point soit atteint à un instant donné, en agissant sur un ensemble de segments :
  - levier 1 : facteur commun f sur leurs vitesses cibles, bornes inchangées ; seul pour ralentir, et pour accélérer jusqu'à la bascule, où la cible la plus rapide atteint la pointe de la joueuse ;
  - levier 2, au-delà de la bascule : facteur k >= 1 ; vitesses cibles × k, accélération, freinage et accélération latérale × k², vitesse minimale en virage et pointe × k, appliqués par intervalle du profil : la vitesse de départ imposée reste continue (5.2) ;
  - dichotomie à nombre fixe d'itérations sur log f, puis sur log k ; borne numérique de recherche : k <= 1000 ;
  - il sert à la durée imposée, au bord droit collé dont la durée s'adapte et au départ en retard sur sa borne (5.8), et au relayeur (10.3). Facteurs affichés : « vitesses × f », plus « accélérations × k² » quand k > 1 (6.5).
- **Durée imposée** (`durationOverride`, D-107, D-129) : le solveur agit sur tous les segments de la course pour qu'elle dure exactement cette durée, profil compris ; aucune alerte propre, seulement celles des seuils (5.9). Au-delà de la borne de recherche, tenue par une mise à l'échelle du temps du profil entier (garde numérique, D-136). Exclusive avec un bord droit collé dont la durée s'adapte ; ignorée sous un départ en retard sur sa borne (5.8).
- **Le dernier geste gagne** (D-139) : choisir une allure retire la durée imposée (le bloc reprend sa longueur naturelle) et décolle un bord droit dont la durée s'adapte ; tirer le bord droit impose la durée ; régler la vitesse d'un segment ne retire ni l'une ni l'autre.
- Allures par défaut : marche 2 m/s, trot 4 m/s, sprint 5,5 m/s (HYPOTHÈSE, réglables dans `reglages.json` ; 7 m/s avant le lot 3 bis, D-111). Ce sont des vitesses cibles ; la pointe de la joueuse est la vitesse que son accélération approche.
- Une entité sans action en cours reste immobile.
- Deux courses d'une même joueuse ne se chevauchent pas. Sinon, dans une ligne : la seconde part à la fin de la première, alerte « départ retardé de x s » (D-013, D-139). Même repli pour une course d'une participante qui démarre pendant un regroupement : retardée à la sortie de balle.

### 5.4 Ballon

- Jamais positionné à la main pendant l'animation. État dérivé :
  - `carried(entityId)` : dessiné contre le jeton de la porteuse ;
  - `inFlight(fromPos, releaseT, arrivalT, toId | toPos)` ;
  - `loose(pos)` : au sol, après un jeu au pied vers un point ou au départ ; ramassé par la première joueuse de l'une ou l'autre équipe à moins de 1 m, qui devient porteuse ; la recherche se fait sur toute la ligne (D-083) ;
  - `inBreakdown(pos)` : dans un regroupement, de la formation à la sortie de balle (10.3).
- Passe : départ à la position de la passeuse à l'instant du lâcher ; arrivée à la position de la receveuse évaluée à `arrivalT`. Vol rectiligne à vitesse constante. `arrivalT = releaseT + distance / ballSpeed`, résolu par point fixe (5 itérations, D-037 ; convergence tant que la receveuse est plus lente que le ballon ; le ballon finit toujours exactement sur la receveuse). Vitesse de passe par défaut 12 m/s (HYPOTHÈSE).
- Validations : passe vers l'autre équipe ; passeuse sans ballon au lâcher ; deux passes simultanées du même ballon (même instant de lâcher) ; frappeuse sans ballon ; plaquée sans ballon à la formation. Chaque cas est signalé sur l'action ; repli du moteur : voir 4.3 (D-013, D-094).
- Ordre des événements (lot 3) : lâchers de passe, frappes au pied et formations de regroupement sont traités dans l'ordre chronologique ; arrivées, sorties de balle et ramassages sont résolus entre deux événements ; le ramassage est cherché à pas fixe de 1/100 s puis par bissection (D-094). Lot 3 bis : file d'événements ; une transition (arrivée, sortie, ramassage) est résolue avant tout événement de même instant ou plus tardif ; une réception à laquelle un lâcher est collé programme ce lâcher (ci-dessous).
- **Lâcher d'une passe ou d'un jeu au pied** (D-110, D-139) : un seul mode, à son instant, collé ou non.
  - Non collé : à `start`. Tolérance : si la joueuse n'a pas le ballon à cet instant mais le reçoit au plus 0,5 s après (HYPOTHÈSE), le lâcher a lieu à la réception, sans alerte, l'instant réel étant affiché ; au-delà, passe ignorée et signalée (D-013).
  - Collé (`startGlue`) : à l'instant de la cible, par exemple l'arrivée d'une passe ou d'un jeu au pied vers elle, ou la sortie d'un regroupement dont elle est le relayeur, plus l'écart (`offset`, temps de contrôle, >= 0). Pas de tolérance. Cible jamais atteinte : passe ignorée et signalée (sans ballon).
  - Un ramassage au sol n'est pas une réception (D-119 ; outils, 6.2).
- **Bord droit d'une passe** : il règle la vitesse du ballon (`ballSpeed`) ; celui d'un jeu au pied, son temps de vol (10.4). Tiré au point que le ballon va moins vite que la receveuse : signalé, la convergence n'étant plus garantie (D-139).

### 5.5 Traces

- Calculées depuis la géométrie : portion de trajectoire parcourue à l'instant `t`. Jamais accumulées image par image : une lecture continue et un saut direct à `t` donnent la même image.
- Passes déjà effectuées tracées en pointillés ; pendant le vol, la portion parcourue aussi (D-019).

### 5.6 Ligne d'avantage

- Ligne parallèle aux lignes de but, à l'abscisse du ballon à `t = 0`.
- Des flèches sur la ligne d'avantage montrent le sens d'attaque ; elles s'inversent quand l'équipe qui attaque change (D-006).
- Recalée à l'abscisse du point de regroupement à chaque formation de ruck ou de maul (lot 3), fixe sinon. En mode schéma (éditeur, vignettes, PDF) : celle en vigueur au début de l'intervalle affiché (D-082).

### 5.7 Contrôle d'en-avant (lot 3)

- Principe établi : une passe est jugée en avant si elle part vers l'avant depuis les mains ; la trajectoire du ballon dans le repère du terrain n'entre pas en compte. On raisonne donc dans le repère de la passeuse.
- Calcul : vitesse du ballon (repère terrain) moins vitesse de la passeuse au lâcher (dérivée de sa trajectoire). Si la composante dans le sens d'attaque dépasse 0,5 m/s (HYPOTHÈSE), la passe est marquée « en avant probable ».
- Sens d'attaque : celui de l'équipe de la passeuse. Vitesse de la passeuse : dérivée à gauche de sa trajectoire au lâcher, lue sur sa course précédente de la ligne pour un lâcher à l'instant où une course démarre (D-085) ; depuis le lot 3 bis, lue sur le profil de vitesse (5.3).
- C'est une aide visuelle, jamais un blocage.

### 5.8 Collage et synchronisation (D-139)

- **Collage** (`GlueRef`, `EndGlue`) : permanent, d'un bord sur un événement de la même ligne (4.3) ; le bord suit quand la cible change. Il remplace les liens « Caler sur… », le lâcher à la réception et le drapeau « Finit lancée ».
  - Bords : gauche (`startGlue` : départ, lâcher, formation, début de séquence), droit (`endGlue`), embranchement (`branchAtGlue`).
  - Événements : départ, fin ou point de passage d'une course ; lâcher ou arrivée d'une passe ou d'un jeu au pied ; formation ou sortie de balle d'un regroupement ; début ou fin d'une séquence ; embranchement.
  - Instant du bord = instant de l'événement + `offset` (>= 0, 0 par défaut), réglé dans l'inspecteur seulement.
  - Un embranchement collé suit le tronc, et entraîne les actions d'option qui lui sont collées.
- **Bord droit collé** : quand la cible se déplace, le bloc glisse ou s'étire selon le geste qui l'a posé, modifiable dans l'inspecteur (`keep`, 6.5).
  - Bloc glissé jusqu'à la cible (`keep: 'duration'`) : il garde sa durée, son départ suit. Pour une course : départ = instant de la cible − durée de la course. Départ calculé avant sa **borne** (0, fin de la course précédente de la joueuse, ou embranchement pour une action d'option, D-131) : départ à la borne et solveur à deux leviers (5.3) sur tous les segments, pour arriver à l'heure. Si la course a aussi une durée imposée, celle-ci ne s'applique pas : le solveur part des vitesses enregistrées (D-136). Partie à sa borne sans y être collée, elle ne prolonge pas la course précédente (5.2).
  - Pour un autre bloc (`keep: 'duration'`) : le champ de son bord droit reste (vitesse du ballon, temps de vol, sortie de balle, durée d'une séquence) et le départ est résolu pour que son événement de fin tombe sur la cible : par soustraction pour un jeu au pied, un regroupement et une séquence, par point fixe sur le lâcher pour une passe (5.4). Départ calculé avant sa borne (0 ou embranchement) : départ à la borne, arrivée en retard, alerte de retard, sans solveur.
  - Bord droit tiré jusqu'à la cible (`keep: 'start'`) : le départ reste, la durée s'adapte. Pour une course : solveur à deux leviers sur tous les segments, un seul profil, vitesse continue. Pour un autre bloc : le champ de son bord droit s'adapte (4.1).
  - Bords gauche et droit tous deux collés : le départ suit son collage, la durée s'adapte, quel que soit `keep`.
- **Rendez-vous à un point de passage** : « Couper la course ici » donne deux courses collées (vitesse et direction continues, solveur sur la première). Résultat proche d'un rendez-vous sur une seule course, pas identique : le raccord lancé (5.2) modifie la trajectoire près du point de coupe. Un point de passage reste une cible (`{ point }`), par exemple pour lâcher quand elle passe à ce point.
- **Course de la receveuse collée à l'arrivée de la passe qu'elle reçoit** : l'instant cible est le lâcher plus la distance de la passeuse au point de rendez-vous divisée par la vitesse du ballon ; la passe arrive donc au point de rendez-vous quand elle y arrive (4.3).
- **Résolution** : blocs de base avec leurs `start` et vitesses enregistrés ; puis bords collés dans l'ordre du graphe des dépendances (4.3) ; pour chacun, simulation de la ligne avec les mouvements courants et lecture de l'instant de la cible (arrêt par un regroupement et report compris), puis ajustement ; enfin compilation de la ligne. Limite assumée : un collage qui change le ramassage d'un ballon au sol peut décaler une cible déjà résolue ; le résultat reste déterministe.
- **Rendez-vous au-delà des bornes** : tenu exactement, signalé par les seuls seuils (5.9, D-129).
- **Cas particuliers** : alerte sur le bloc ; l'édition n'est jamais bloquée.

| Cas | Comportement | Alerte |
|---|---|---|
| Course : départ calculé avant la borne | départ à la borne, course accélérée : arrivée à l'heure (ci-dessus) | « il aurait fallu partir x s plus tôt : départ immédiat, course accélérée » |
| Autre bloc : départ calculé avant la borne | départ à la borne, arrivée en retard, sans solveur (ci-dessus) | retard en secondes |
| Cible avant le départ : instant voulu <= borne, ou au-delà de la borne de recherche du solveur | seul repli : `start` et vitesses enregistrés, arrivée en retard | retard en secondes |
| Dans un fichier : cible inexistante ou hors de la ligne, de type incompatible, point inexistant | collage ignoré : `start` et vitesses enregistrés | cible invalide |
| Cible jamais atteinte | collage ignoré : `start` et vitesses enregistrés ; lâcher collé : passe ignorée (5.4) | cible jamais atteinte |
| Cycle (fichier modifié à la main) | collages du cycle ignorés | cycle |

- **Édition** :
  - un collage se pose en amenant un bord sur un autre, dans la frise (6.4) ; un collage qui créerait un cycle, viserait son propre bloc ou sortirait de la ligne est refusé avec un message ;
  - décoller un bord le fige à sa valeur calculée : le bloc ne bouge pas ;
  - supprimer la cible, ou le point de passage cible, fige le bord de la même façon, avec un message ;
  - créer un embranchement qui fait passer la cible d'un bord du tronc dans une option fige ce bord, avec un message ;
  - « Dupliquer » une option recopie ses collages vers les copies.
- **Affichage** : quand un bloc collé ou sa cible est sélectionné, trait fin en tirets (couleur de sélection) entre le point du bord et le point de la cible, dans la surcouche d'édition seulement, jamais exporté.

### 5.9 Vitesses et accélérations irréalistes (lot 3 bis, lot 3bis-1)

- Vitesse : deux seuils sur la vitesse de pointe réelle (profil) de chaque segment de course, réglables dans `reglages.json` : orange au-delà de 20 km/h (avertissement), rouge au-delà de 25 km/h (erreur) (HYPOTHÈSES, choix du coach, D-111).
- Accélération et freinage (lot 3bis-1, D-132, D-135) : seuils orange et rouge en m/s², réglables dans `reglages.json` : accélération 6 et 8, freinage 5 et 7 (HYPOTHÈSES). Pic d'accélération d'un segment : la plus grande accélération instantanée du modèle au début d'un intervalle (a(v) × k², 5.3) ; pic de freinage : le plus grand freinage d'un intervalle. Pas d'alerte d'accélération latérale.
- Mesures sur le profil réel, après le solveur, sur la partie courue de chaque segment (course arrêtée par un regroupement : jusqu'à l'arrêt) ; courses dessinées seulement, pas le déplacement du relayeur ; une course lancée qui freine fort à son départ (virage) reçoit l'alerte de freinage (D-137). Jamais bloquant ; jamais stocké dans les fichiers.
- Les seuils ne règlent jamais le mouvement (D-129) : ils signalent seulement. Lot 3 bis : le seuil rouge plafonnait le facteur de vitesse.
- Affichage (D-112, D-132) : inspecteur et blocs de la frise (6.5, 6.4) ; pastilles toujours dans l'éditeur, selon le calque « Vitesses » dans le lecteur, dès que la joueuse a atteint leur point ; jamais dans les GIF, les PDF ni les vignettes de la bibliothèque :
  - vitesse : pastille ronde orange ou rouge à « ! » au milieu du segment ;
  - accélération et freinage : losange orange ou rouge (demi-diagonale 0,9 rayon de jeton, contour comme la pastille ronde), « + » pour l'accélération, « − » pour le freinage, tracés en traits ; une pastille par segment et par type.
- Placement d'un losange (D-137) : zone = intervalles du segment au-delà du seuil de son niveau ; la pastille va au point de la zone le plus proche du pic à au moins 2,5 m des extrémités du segment ; si aucune partie de la zone n'y est, au point de cette plage le plus proche du pic. Pic : début de l'intervalle pour une accélération, milieu pour un freinage ; pics égaux : la première accélération, le dernier freinage. Segment de moins de 5 m : milieu du segment, décalé de 2 m vers le pic pour ne pas couvrir la pastille de vitesse (pic au milieu exact : vers le début pour une accélération, vers la fin pour un freinage). Valeurs mesurées à environ 11 px/m, échelle de l'éditeur sur un écran Full HD (HYPOTHÈSES, `defaults.ts`).

