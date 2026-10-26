# Décisions du lot 3 bis

Index, règles du journal et mode de lecture : [README.md](README.md).

## Lot 3 bis : courses réalistes

Plan : `docs/archive/plans/lot-3bis.md`, validé le 23 octobre 2026 avec les réponses Q1 à Q13. Origine commune : retour de la séance d'usage du 23/10 (6 notes de l'utilisateur).

### D-103 : portée du lot 3 bis
- Date : 2026-10-23
- Décision : un lot « 3 bis : courses réalistes », avant le lot 4, sur la branche `lot-3bis` : liste des actions du temps, vitesse par segment, liens de synchronisation et rendez-vous, profil de vitesse, alertes de vitesse irréaliste, lecture et pause à la barre d'espace. SPEC passée en 1.6. Rien des lots 4 et 5.
- Raison : notes de la séance d'usage du 23/10 (courses irréalistes, timing difficile à régler, actions d'un temps difficiles à retrouver).
- Alternatives écartées : intégrer ces points au lot 4.
- Origine : demande de l'utilisateur.

### D-104 : combinaison v3 et migration
- Date : 2026-10-23
- Décision : `schemaVersion 3`. Points de passage `Waypoint` (`{ x, y, speed? }`, vitesse du segment qui arrive au point : allure ou m/s) ; course : `endsAtSpeed?: true` (« Finit lancée ») et `sync?: RunSync` (cible, point de rendez-vous `at`, réglage `delay` ou `speed`) ; passe et jeu au pied : `release?: 'onReceipt'`. Schéma v2 figé dans `model/schemaV2.ts`. Migration v2 vers v3 : contenu identique, plus `endsAtSpeed: true` sur chaque course que toutes les options du temps suivant prolongent (même joueuse, première course du temps, délai 0), règle structurelle sans moteur ; aucune migration vers le lâcher à la réception. Fichier v2 réécrit en v3 au prochain enregistrement. Fixtures : `play-v2-lot3.json` (figée) pour la migration, `play-v3-lot3bis.json` figée pour les lots 4 et 5. Le type déclaré `GroupRunAction` (lot 5) prend `Waypoint[]`.
- Raison : règle 6 de `CLAUDE.md` ; garder la fluidité des combinaisons existantes ; une migration ne peut pas lancer le moteur (les positions dépendent des réglages).
- Alternatives écartées : tableau parallèle des vitesses de segment (à resynchroniser à chaque point ajouté ou retiré) ; identifiants de points de passage.
- Origine : plan, validé par l'utilisateur (Q2, Q4, Q8).

### D-105 : profil de vitesse
- Date : 2026-10-23
- Décision : profil trapèze généralisé sur les échantillons de la spline : plafond par échantillon (vitesse cible du segment, et `sqrt(a_lat / courbure)` borné en bas par une vitesse minimale en virage), passe avant (accélération), passe arrière (freinage), temps par intervalle à accélération constante ; position, vitesse et inverse en formule fermée. L'allure d'une course ou la vitesse d'un segment devient une vitesse de pointe ; la durée découle du profil. Valeurs HYPOTHÈSE : accélération 3 m/s², freinage 4 m/s², accélération latérale 4 m/s², réglables dans `reglages.json` v3 et les réglages de l'inspecteur ; vitesse minimale en virage 1 m/s dans `defaults.ts`. Un même solveur (facteur commun sur les vitesses cibles, dichotomie à nombre fixe d'itérations, plafond au seuil rouge) sert à la durée imposée, à la vitesse ajustée des liens et au relayeur en retard.
- Raison : réalisme (note 3), inverse exacte pour la synchronisation, déterminisme ; ajuster le ressenti sans PR.
- Alternatives écartées : modèle exponentiel (intégration numérique, inversion approchée) ; valeurs dans `defaults.ts` seulement (proposition).
- Origine : plan ; réponse Q9 (valeurs retenues, profil réglable).
- Remplacée en partie par D-129 (plus de plafond au seuil rouge), D-130 (solveur à deux leviers) et D-135 (passe avant en a(v), valeurs calibrées).

### D-106 : course qui finit lancée
- Date : 2026-10-23
- Décision : drapeau explicite « Finit lancée » : la course finit au plafond de son dernier segment au lieu de freiner. Elle n'a d'effet que si elle se termine à la fin de son temps ; sinon (la joueuse attend la fin des autres actions) freinage normal, sans alerte, avec la mention « Sans effet : attente de x s avant le temps suivant » (phase recompilée tant qu'une course lancée finit avant la fin du temps ou est arrêtée par un regroupement ; une course qui freine ne redevient jamais lancée). Prolongée dans le temps suivant d'une ligne quand la joueuse y a sa première course avec un délai effectif nul : cette course part à la vitesse de fin et dans la direction d'arrivée de la course parente (premier segment en courbe de Bézier cubique raccordée), sans changer ses points de passage ni le temps parent. Non prolongée : arrêt net à la frontière dans cette option, avertissement `runNotContinued` sur la course lancée, nommant l'option ; aucune alerte dans une feuille. Posé par la migration (D-104) et par l'outil Course, dans la même étape d'annulation, quand la course tracée (délai 0) fait que toutes les options du temps suivant prolongent la course du temps précédent. Pour un même `t` dans le tronc, toutes les options donnent le même état (5.2).
- Raison : sans lui, le profil marquerait un arrêt à chaque frontière de temps ; le drapeau laisse le coach privilégier la fluidité de l'option principale.
- Alternatives écartées : règle automatique sans drapeau (ajouter une option sans suite arrêterait la course dans toutes les options) ; course lancée pendant l'attente ; décélération dans le prolongement dans une option sans suite (déplacement non dessiné).
- Origine : réponses Q4 (avec le cas de l'attente) et Q13 a.

### D-107 : durée imposée
- Date : 2026-10-23
- Décision : `durationOverride` est gardée, sans migration : toutes les vitesses cibles de la course sont multipliées par un même facteur pour qu'elle dure exactement la durée imposée, profil compris ; plafond au seuil rouge, alerte si la durée est inatteignable. Exclusive avec un lien en vitesse ajustée : poser l'une retire l'autre.
- Raison : les combinaisons existantes gardent exactement leurs durées ; un seul solveur (D-105).
- Alternatives écartées : la retirer (la migration ne peut pas la convertir sans le moteur) ; la convertir en lien.
- Origine : réponse Q5.
- Remplacée en partie par D-129 : durée tenue exactement, sans plafond ni alerte de durée inatteignable.

### D-108 : liens de synchronisation
- Date : 2026-10-23
- Décision : un lien permanent cale un point d'une course (sa fin ou un point de passage, rendez-vous) sur un événement d'une autre action du même temps : fin ou point d'une course, lâcher ou arrivée d'une passe ou d'un jeu au pied, formation d'un regroupement. Réglage « Départ différé » (délai calculé, délai enregistré ignoré) ou « Vitesse ajustée » (facteur commun sur les segments avant le rendez-vous, les suivants gardent leurs vitesses). Résolution : courses liées dans l'ordre du graphe des dépendances ; pour chacune, simulation du temps avec les mouvements courants et lecture de l'instant cible (arrêts par un regroupement, reports et lâchers à la réception compris). Replis : délai négatif, départ à 0 (`syncLate`) ; vitesse nécessaire au-delà du seuil rouge, facteur plafonné (`syncSpeedCapped`) ; cible supprimée, invalide ou jamais atteinte, lien ignoré (`syncTargetMissing`, `syncTargetInvalid`) ; cycle, liens ignorés (`syncCycle`). Supprimer l'action cible garde le lien ; supprimer un point qui porte un lien retire ce lien, avec un message ; « Dupliquer » un temps recopie ses liens. Lien dessiné en tirets fins quand l'une des deux actions est sélectionnée, dans la surcouche d'édition seulement. La course d'une receveuse calée sur l'arrivée de la passe qu'elle reçoit n'est pas une boucle : l'arrivée est calculée au point de rendez-vous (lâcher + distance depuis la passeuse / vitesse du ballon), cas d'usage courant constaté en écrivant la fixture v3 (étape 1). Limite : un lien qui change le ramassage d'un ballon au sol peut décaler une cible déjà résolue.
- Raison : note 2 (fins de courses synchronisées, rendez-vous) ; l'édition n'est jamais bloquée.
- Alternatives écartées : vitesse uniforme avant le rendez-vous ; lien ignoré au-delà du seuil rouge (saut quand on déplace la cible) ; résolution avant la boucle d'événements (cibles approchées).
- Origine : réponse Q6.
- Remplacée en partie par D-129 et D-131 (replis du délai négatif et du facteur plafonné).

### D-109 : création d'un lien
- Date : 2026-10-23
- Décision : bouton « Caler sur… » dans la section Course de l'inspecteur ; rendez-vous = point sélectionné, sinon la fin ; bandeau en surimpression (« Cliquez la cible », Échap pour annuler) ; clic sur la cible : poignée d'une autre course (point, ou fin pour son dernier point), trait d'une course (fin), passe ou jeu au pied (extrémité la plus proche : lâcher ou arrivée), anneau ou trajet du relayeur (formation). Réglage « Départ différé » par défaut. Refus avec message si le lien crée une boucle ou vise la course elle-même. Aucun raccourci.
- Raison : geste en deux temps comme les poses (D-096).
- Alternatives écartées : raccourci C.
- Origine : réponse Q7.

### D-110 : lâcher des passes et des jeux au pied
- Date : 2026-10-23
- Décision : deux modes. « À un instant fixe » (absent, comme avant) : début du temps + délai ; si la joueuse n'a pas le ballon mais le reçoit au plus 0,5 s après (HYPOTHÈSE), lâcher à la réception, sans alerte, instant réel affiché ; au-delà, l'erreur de D-013. « À la réception » (`release: 'onReceipt'`) : à la réception du ballon dans le temps (arrivée d'une passe ou d'un jeu au pied vers elle, sortie d'un regroupement dont elle est le relayeur), plus le délai (temps de contrôle, >= 0) ; les lâchers à la réception d'une même joueuse prennent ses réceptions dans l'ordre ; sans réception, l'erreur de D-013 ; pas de tolérance. Les outils Passe et Jeu au pied posent « à la réception », délai 0, quand la joueuse n'a pas le ballon au début du temps, sinon un instant fixe (D-015). Le graphe des dépendances lie un lâcher à la réception à tout ce qui peut amener le ballon à la joueuse ; seuls les cycles qui passent par un lien de course sont refusés. Boucle d'événements en file : chaque réception programme le lâcher suivant de la joueuse. Pas de migration vers ce mode.
- Raison : le profil décale les arrivées de 0,1 à 0,3 s : sans tolérance, les passes enchaînées existantes deviendraient « passeuse sans ballon » ; le mode à la réception rend les enchaînements robustes aux modifications.
- Alternatives écartées : tolérance seule ; bouton « Recaler sur la réception ».
- Origine : réponse Q8.

### D-111 : vitesses irréalistes, réglages v3 et sprint
- Date : 2026-10-23
- Décision : deux seuils sur la vitesse de pointe réelle de chaque segment, réglables en km/h dans les réglages de l'inspecteur et stockés en m/s dans `reglages.json` v3 (`speedAlert`) : au-delà de 20 km/h avertissement `runSpeedHigh`, au-delà de 25 km/h erreur `runSpeedTooHigh` (HYPOTHÈSES, choix du coach) ; jamais bloquant. `reglages.json` v3 : `motion` (D-105) et `speedAlert` ; migration v2 vers v3 (et v1 vers v3) avec les valeurs par défaut ; allure sprint par défaut 5,5 m/s (19,8 km/h, HYPOTHÈSE) ; un sprint à 7 m/s exactement (ancien défaut) devient 5,5 m/s à la migration, avec un message unique, toute autre valeur est gardée.
- Raison : note 4 (une joueuse amatrice au-delà de 20 à 25 km/h est irréaliste).
- Alternatives écartées : garder 7 m/s et seulement le signaler ; seuils par poste.
- Origine : réponse Q10.
- Précisée par D-132 (seuils d'accélération et de freinage) et D-134 (réglages v4).

### D-112 : calque « Vitesses »
- Date : 2026-10-23
- Décision : pastille ronde orange ou rouge à « ! » au milieu de chaque segment au-delà d'un seuil : toujours dans l'éditeur ; dans le lecteur selon le calque « Vitesses » (par poste, activé par défaut), dès que la joueuse entre dans le segment ; jamais dans les GIF, les PDF ni les vignettes de la bibliothèque (comme D-086).
- Raison : aide pour le coach, pas une information pour les joueuses.
- Alternatives écartées : anneau autour du jeton.
- Origine : réponse Q11.
- Précisée par D-132 (pastilles d'accélération et de freinage dans le même calque).

### D-113 : liste des actions du temps
- Date : 2026-10-23
- Décision : la bande du bas (hauteur fixe, 176 px) est partagée : arbre des temps à gauche (2/5), « Actions du temps » à droite (3/5). Une ligne par action du temps affiché (sélectionné en édition, à `t` en lecture), triée par instant de début : type et acteurs, barre de temps sur l'échelle du temps, détails principaux, pastilles d'alerte ; détails complets en infobulle et dans l'inspecteur. Clic : sélection (terrain et inspecteur), retour au mode édition en lecture ; survol : halo sur le terrain ; Suppr : suppression en une étape. Données calculées par `engine/actionReport.ts`.
- Raison : 6.1 et D-048 (aucune taille autour du terrain ne change) ; la bande du bas est la zone du temps et la seule assez large pour les barres.
- Alternatives écartées : onglet dans la bande du bas ; section de l'inspecteur.
- Origine : réponse Q1.

### D-114 : vitesse par segment
- Date : 2026-10-23
- Décision : un point de passage porte la vitesse du segment qui arrive à lui ; un clic sur le trait d'une course sélectionne la course et le segment sous le pointeur. Inspecteur : « Allure de la course », Marche, Trot, Sprint ou « Vitesse saisie » en km/h. Raccourcis 1, 2, 3 (marche, trot, sprint) et 0 (allure de la course) sur le segment sélectionné ; sans segment, 1, 2, 3 règlent l'allure de la course. Les déplacements, la symétrie et le glisser d'un point gardent la vitesse.
- Raison : note 6.
- Alternatives écartées : le point porte la vitesse du segment qui en part.
- Origine : réponse Q2.
- Précisée par D-133 (allure saisie de la course, curseur).

### D-115 : rendu des segments rapides
- Date : 2026-10-23
- Décision : un segment dont la vitesse cible atteint l'allure sprint des réglages est tracé plus épais (clé de thème `fastRunWidth`, aplat, dans les 4 thèmes), dans l'éditeur, le lecteur et les exports.
- Raison : information utile aux joueuses ; discret ; compatible avec le N&B.
- Alternatives écartées : doubles chevrons ; seuil orange ; éditeur seulement.
- Origine : réponse Q3.

### D-116 : lecture et pause à la barre d'espace
- Date : 2026-10-23
- Décision : un appui bref sur Espace (relâchée sans glisser, en moins de 0,5 s, HYPOTHÈSE) lance ou met en pause la lecture, dans l'éditeur et le lecteur ; Espace maintenue + glisser déplace le terrain, sans lecture ni pause ; répétition de touche ignorée. `preventDefault` à l'appui et au relâchement : un bouton, une case à cocher ou un `summary` qui a le focus n'est ni activé ni coché (D-056). Ignorée dans les champs de texte, les listes, le curseur temporel et quand un dialogue est ouvert. L reste.
- Raison : note 5.
- Alternatives écartées : sans limite de durée.
- Origine : réponse Q12.

### D-117 : vitesses en km/h
- Date : 2026-10-23
- Décision : partout dans l'interface, les vitesses sont affichées en km/h et en m/s (« 5,5 m/s (19,8 km/h) ») ; les vitesses de segment et les seuils se saisissent en km/h ; le code et les fichiers restent en m/s (formatage dans `ui/format.ts`).
- Raison : demande de l'utilisateur ; unités du projet en m/s.
- Alternatives écartées : aucune.
- Origine : demande de l'utilisateur.
- Précisée par D-133 (curseur en km/h).

### D-118 : pistes reportées
- Date : 2026-10-23
- Décision : reportées à plus tard et notées dans `docs/ETAT.md` : accélération exponentielle (Q13 b), vitesse initiale au temps 1 (Q13 c), ballon porté du côté du sens de course (Q13 d). Le raccord de tangente (Q13 a) est fait dans ce lot (D-106).
- Raison : choix de l'utilisateur.
- Alternatives écartées : tout faire dans ce lot.
- Origine : réponse Q13.
- Remplacée en partie par D-135 (accélération exponentielle, traitée au lot 3bis-1).

### D-119 : lâcher posé par les outils pour une joueuse qui ramasse le ballon
- Date : 2026-10-24
- Décision : précision de D-110. Les outils Passe et Jeu au pied posent « à la réception », délai 0, quand la joueuse n'a pas le ballon au début du temps, y compris quand elle ne le reçoit pas encore (la passe attend une réception tracée ensuite) ; **sauf** si elle l'obtient en le ramassant au sol : lâcher à instant fixe, à l'instant du ramassage, comme avant (D-015). Une joueuse qui a le ballon au début du temps garde l'instant fixe.
- Raison : un ramassage n'est pas une réception (D-110 : arrivée d'une passe ou d'un jeu au pied, sortie d'un regroupement) ; « à la réception » ne se déclencherait jamais et l'outil créerait une passe en erreur, là où l'instant fixe marchait (combinaisons du lot 3 avec ballon au sol).
- Alternatives écartées : compter le ramassage comme une réception dans le moteur (change la règle de D-110) ; « à la réception » sans exception (passe en erreur).
- Origine : cas non couvert par le plan, constaté à l'étape 6 ; signalé à l'utilisateur.

### D-120 : précisions de l'éditeur des liens et des segments
- Date : 2026-10-24
- Décision :
  - durée imposée posée sur une course dont le lien est en « Vitesse ajustée » : le lien est retiré (D-107, « poser l'une retire l'autre ») ; un lien en « Départ différé » est gardé ;
  - « Caler sur… » : un clic refusé (la course elle-même, boucle, cible inutilisable) affiche le message et laisse le choix de la cible en cours ; un clic dans le vide ou sur une joueuse ne fait rien ; Échap, un changement d'outil, de temps ou une pose l'annulent ; un lien remplacé garde son réglage, un nouveau lien est en « Départ différé » ;
  - point de rendez-vous : le dernier point sélectionné vaut « Fin » (`at` absent), qui suit la fin quand on prolonge la course ;
  - raccourcis 1, 2, 3 et 0 : lus aussi sur la touche physique (`code` : Digit, Numpad), pour un clavier AZERTY sans Maj ; sans segment sélectionné, 1, 2, 3 règlent toutes les courses sélectionnées ;
  - suppression du dernier point d'une course (la course disparaît) : les liens visant ce point sont retirés, ceux visant sa fin sont gardés (« cible supprimée », comme pour une action supprimée).
- Raison : cohérence avec D-107 à D-109 et D-114 ; aucun geste bloqué ; clavier français.
- Alternatives écartées : sortir du choix de la cible au premier refus ; touches lues sur le caractère seulement (Maj nécessaire en AZERTY).
- Origine : écriture de l'étape 6.

### D-121 : précisions de l'interface du lot 3 bis
- Date : 2026-10-24
- Décision :
  - message du sprint ramené à 5,5 m/s (D-111) : affiché une fois par poste (mémorisé dans le navigateur), même tant que `reglages.json` reste en version 2 (réécrit en v3 au prochain enregistrement des réglages, comme prévu) ;
  - liste des actions : titre « Actions du temps : Temps n » ; une pastille par gravité (erreur, avertissement), avec leur nombre et les messages en infobulle ; une action ignorée est barrée en rouge ;
  - survol d'une ligne : halo aussi pendant la lecture, sur la scène à `t` ;
  - inspecteur de la course : « Changer la cible » à côté de « Retirer le lien » ; sous un lien en départ différé appliqué, le champ « Délai » est remplacé par « Délai calculé par le lien » ; pour un lâcher à la réception, le délai s'appelle « Temps de contrôle » ;
  - Espace : un seul fichier de bout en bout, `space.spec.ts`, joué dans Chromium et Firefox (le plan prévoyait deux fichiers) ;
  - avec la case « Vitesses », la seconde rangée de la barre de lecture défile aussi à 1440 px (écart connu à 1280 px, D-077).
- Raison : un message à chaque ouverture serait pénible ; lisibilité de la liste dans 176 px ; mêmes tests dans les deux navigateurs sans duplication.
- Alternatives écartées : réécrire `reglages.json` en v3 à l'ouverture (le plan veut la réécriture au prochain enregistrement) ; message à chaque ouverture.
- Origine : écriture de l'étape 7.

## Lot 3bis-1 : le mouvement

Plan : `docs/plans/lot-3bis-1.md`, validé le 25 octobre 2026 avec les réponses Q1 à Q9 et 6 modifications de l'utilisateur. Origine commune : retour de la séance d'usage du 24/10 (accélérations trop lentes et trop contraignantes ; vitesses à calibrer avec un curseur à repères ; les plafonnements « créent le désordre ») ; règle de l'utilisateur : ne jamais bloquer, seulement signaler.

### D-129 : le mouvement sert l'intention du coach
- Date : 2026-10-25
- Décision : les bornes physiques du profil (vitesse, accélération, freinage, virages) façonnent le mouvement par défaut et ne contraignent jamais une intention du coach : durée imposée, lien de synchronisation dans ses deux réglages, relayeur au ballon à la sortie. Chacune est tenue exactement ; au-delà des bornes, la course va plus vite, accélère, freine ou tourne plus fort, et seuls les seuils d'alerte (vitesse, accélération, freinage) le signalent : `durationCapped` et `syncSpeedCapped` sont retirés sans remplacement. Les seuils d'alerte ne règlent jamais le mouvement : le seuil rouge ne plafonne plus aucun facteur. Jamais bloquant, jamais dans les exports. Vise les courses dessinées et les intentions du coach ; la défense simulée du lot 4 sera tranchée à son lancement. Hors périmètre : les validations du ballon (D-013, D-110, D-119). Remplace en partie D-105, D-107 et D-108.
- Raison : retour de séance du 24/10 ; un plafond décale l'action liée et désorganise le temps, là où une alerte laisse le coach juger.
- Alternatives écartées : alerte « au-delà des bornes » dès que le levier 2 de D-130 sert, même sous les seuils (Q3) ; garder le plafond au seuil rouge.
- Origine : prompt du lot 3bis-1 (A) ; réponse Q3 ; validation du plan (modification 3).

### D-130 : solveur à deux leviers
- Date : 2026-10-25
- Décision : levier 1, un facteur commun f sur les vitesses cibles, accélérations bornées : seul pour ralentir, et pour accélérer jusqu'à la bascule, où la cible la plus rapide atteint la pointe de la joueuse (`motion.topSpeed`, réglage de `reglages.json` v4 dans les deux modèles ; avec le trapèze, elle ne sert qu'à la bascule). Levier 2 au-delà, un facteur k >= 1 : vitesses cibles ×k et bornes ×k² (accélération, freinage, latérale ; vitesse minimale en virage et pointe ×k), appliquées par intervalle dans le profil pour que la vitesse de départ imposée reste continue (D-106). Vitesse ajustée : les deux leviers sur les segments avant le rendez-vous, un seul profil, vitesse continue au rendez-vous. Dichotomie à nombre fixe d'itérations sur log f puis log k ; borne numérique de recherche (1000), au-delà le cas est une cible avant le départ (D-131). Relayeur trop loin : même solveur et même bascule (pointe / sprint), `RELAY_MAX_FACTOR` supprimé. Remplace en partie D-105 (solveur plafonné) ; précise D-079.
- Raison : sans plafond, multiplier les vitesses cibles à accélérations bornées ne descend pas sous la durée du profil triangle ; une bascule physique, indépendante des seuils d'alerte.
- Alternatives écartées : bascule au seuil rouge (le seuil réglerait le mouvement) ; levier 2 seul pour accélérer (une course un peu pressée accélérerait aussi plus fort au départ) ; `scaleTime` global (vitesse de départ d'une course lancée discontinue).
- Origine : prompt (A) ; réponse Q2 ; validation du plan (modification 3).

### D-131 : départ différé en retard et cible avant le départ
- Date : 2026-10-25
- Décision : délai calculé négatif : départ à 0 et leviers de D-130 sur les segments avant le rendez-vous, comme une vitesse ajustée, pour arriver à l'heure ; `syncLate` gardé, reformulé (« il aurait fallu partir x s plus tôt : départ immédiat, course accélérée »). Cible avant le départ (instant voulu <= 0, ou au-delà de la borne de recherche) : seul repli, la course garde ses vitesses et son délai enregistrés et arrive en retard ; alerte `syncTargetBeforeStart`, avec le retard en secondes. Remplace en partie D-108 (replis du délai négatif et du facteur plafonné).
- Raison : D-129 ; un repli lisible pour le seul cas impossible même à vitesse infinie.
- Alternatives écartées : arriver en retard (comportement du lot 3 bis) ; course jouée à la plus grande mise à l'échelle (mouvement absurde, Q4).
- Origine : réponses Q1 et Q4.
- Précisée par D-136 (durée imposée d'une course en départ différé en retard).

### D-132 : alertes d'accélération et de freinage
- Date : 2026-10-25
- Décision : seuils orange (avertissement) et rouge (erreur) pour l'accélération et pour le freinage, en m/s², réglables (`reglages.json` v4, `accelAlert`, `decelAlert`, valeurs au bloc 1) ; mesurés sur le profil réel après mise à l'échelle : pics de chaque segment sur la partie courue ; codes `runAccelHigh`, `runAccelTooHigh`, `runBrakeHigh`, `runBrakeTooHigh`. Affichage comme les vitesses (D-112) : inspecteur, liste des actions, pastilles dans l'éditeur, calque « Vitesses » du lecteur (nom gardé, infobulle « Vitesses et accélérations ») ; jamais dans les GIF, les PDF ni les vignettes. Pastille : losange orange ou rouge, « + » (accélération) ou « − » (freinage), une par segment et par type, au point de la zone au-delà du seuil le plus proche du pic, à au moins le rayon du jeton plus une marge (HYPOTHÈSE, `defaults.ts`) des extrémités du segment ; segment trop court : milieu du segment, décalé pour ne pas couvrir la pastille de vitesse. Pas d'alerte d'accélération latérale. Précise D-111 et D-112.
- Raison : D-129 (seuls les seuils signalent) ; avec a(v), le pic d'accélération est au départ et celui de freinage juste avant un arrêt ou un rendez-vous, sous le jeton ou une poignée.
- Alternatives écartées : carré à « ! », triangle orienté (Q5) ; calque renommé ou deux calques (Q6) ; alerte latérale (Q7) ; pastille au pic exact (cachée par le jeton).
- Origine : prompt (A) ; réponses Q5 à Q7 ; validation du plan (modification 4).
- Précisée par D-135 (valeurs des seuils, mesure du pic d'accélération) et D-137 (placement et dessin des pastilles).

### D-133 : allure saisie, combinaison v4 et curseur de vitesse
- Date : 2026-10-25
- Décision : `RunAction.pace: Pace | number` ; `schemaVersion` 4 ; schéma v3 figé dans `model/schemaV3.ts` ; migration v3 vers v4 sans changement de contenu ; `play-v3-lot3bis.json` reste figée, nouvelle fixture figée `play-v4-lot3bis1.json` pour les lots 4 et 5. Curseur dans l'inspecteur, pour la course et pour le segment (« Allure de la course » reste un choix explicite) : en km/h, valeur affichée en m/s et en km/h ; repères Marche, Trot, Sprint aux allures des réglages, aimantation au glisser à ±0,5 km/h ; relâché sur un repère, l'allure nommée est gardée (elle suit les réglages), ailleurs vitesse saisie ; au clavier, pas de 0,1 km/h, une valeur égale à un repère donne l'allure nommée ; zones orange et rouge en aplats ; bornes de 1 km/h au seuil rouge + 5 km/h (HYPOTHÈSES) ; champ en km/h gardé (1 à 45 km/h) ; une étape d'annulation par geste. Raccourcis 1, 2, 3, 0 inchangés. Précise D-114 et D-117.
- Raison : retour de séance (vitesses à calibrer avec un curseur à repères) ; règle 6 de `CLAUDE.md`.
- Alternatives écartées : bornes de 1 à 45 km/h ; aimantation à ±1 km/h (Q8).
- Origine : prompt (D) ; réponse Q8.

### D-134 : réglages v4
- Date : 2026-10-25
- Décision : `reglages.json` v4 : `motion` plus `topSpeed` (pointe de la joueuse, m/s), `accelAlert` et `decelAlert` (orange, rouge, m/s²) ; `speedAlert` inchangé. Migration v3 vers v4 : une valeur de `motion` égale à l'ancien défaut (accélération 3, freinage 4, latérale 4, `LEGACY_MOTION`) prend le nouveau défaut calibré, avec un message unique par poste (mémorisé dans le navigateur, comme le sprint, D-121) qui liste les valeurs changées ; toute autre valeur est gardée ; v1 et v2 migrés jusqu'à v4 avec les défauts. Fixture figée `reglages-v3.json`. Section Réglages de l'inspecteur : pointe, seuils d'accélération et de freinage (orange <= rouge). Précise D-111.
- Raison : comme le sprint (D-111, D-121) : les valeurs jamais modifiées suivent la calibration, les choix de l'utilisateur sont gardés.
- Alternatives écartées : aucune proposée.
- Origine : prompt (E), proposition retenue.

### D-135 : modèle de mouvement et calibration
- Date : 2026-10-25
- Décision :
  - passe avant du profil en a(v) = a0 · (1 − v / vmax), vmax = `motion.topSpeed` (pointe de la joueuse), nulle au-delà ; intervalles représentés à accélération constante entre leurs deux vitesses (écart au modèle exact : 9 ms sur un segment de 10 m, 48 ms sur 50 m) ; vitesse de fin d'intervalle par Newton à 5 itérations depuis l'estimation à accélération constante ; passe arrière inchangée ;
  - défauts d'une joueuse amatrice : pointe 24 km/h (6,67 m/s), a0 5,2 m/s² (τ 1,28 s) ; freinage 4 m/s², latérale 4 m/s², vitesse minimale en virage 1 m/s et allures 2 / 4 / 5,5 m/s inchangés. Calibration : France à 7 féminine (10, 20 et 50 m), temps corrigés de +0,5 s (Haugen) : élite 28,6 km/h, a0 6,2 m/s², τ 1,28 s ; amatrice : 0,84 fois la pointe, même τ (HYPOTHÈSE). Sources et chiffres : plan, section B.1 ;
  - seuils d'alerte : accélération 6 et 8 m/s², freinage 5 et 7 m/s² ; pic d'accélération mesuré par l'accélération instantanée du modèle au début de chaque intervalle (a(v) × k²), freinage par `accelOf` ;
  - cible au-delà de 0,95 fois la pointe : l'asymptote du segment devient cible / 0,95, a0 gardé (0,95 : HYPOTHÈSE dans `defaults.ts`) ;
  - accélération au départ selon la cible : a0 × min(1, cible / sprint), soit 1,9 m/s² à la marche et 3,8 m/s² au trot ; aucun nouveau réglage ;
  - test du profil calibré, cible à 0,95 fois la pointe : 10 et 20 m en un segment, 50 m en deux segments de 25 m, tolérance 0,05 s.
  Remplace en partie D-105 (loi de la passe avant) et D-118 (accélération exponentielle, traitée) ; précise D-132 (valeurs, mesure du pic d'accélération).
- Raison : retour de séance (accélérations trop lentes) ; modèle de référence (Samozino et al. 2016) ; le trapèze manque les trois temps de 45 à 60 ms, faute de pouvoir être à la fois vif au départ et lent à l'approche de la pointe ; la moyenne d'un intervalle dépend de la longueur du segment ; aucune vitesse saisie plafonnée en silence ; D-111 (amatrice au-delà de 20 à 25 km/h : irréaliste).
- Alternatives écartées : trapèze à 3,5 m/s², mêmes durées à 0,15 s près mais départ moins vif (Q10) ; valeurs d'élite (Q11) ; pic mesuré par `accelOf` (Q12) ; plancher d'accélération, asymptote relevée avec a0 proportionnel (Q13) ; même a0 pour toutes les allures, réglage séparé (Q14) ; interpolation exponentielle exacte dans chaque intervalle.
- Origine : bloc 1 (recherche, script jetable non commité) ; réponses Q10 à Q14, propositions retenues.

### D-136 : départ différé en retard d'une course à durée imposée
- Date : 2026-10-25
- Décision : une course en départ différé qui a aussi une durée imposée, et dont le délai calculé est négatif, est traitée comme une vitesse ajustée (D-131) : la durée imposée ne s'applique pas ; les leviers de D-130 partent des vitesses enregistrées des segments avant le rendez-vous, les segments suivants gardent leurs vitesses enregistrées. Partie à 0, elle prolonge la course lancée qui la précède, s'il y en a une (D-106). Au-delà de la borne de recherche, une durée imposée et un relayeur restent tenus par la mise à l'échelle du temps du profil entier (garde numérique ; la cible avant le départ de D-131 ne concerne que les liens). Précise D-131.
- Raison : D-107 (durée imposée et vitesse ajustée s'excluent) ; rendez-vous à la fin, cas par défaut : même résultat que des leviers partis des vitesses de la durée.
- Alternatives écartées : leviers partis des vitesses déjà multipliées par le facteur de la durée imposée, segments suivants à ce facteur (un facteur de base de plus dans le moteur).
- Origine : question de l'étape 3, réponse de l'utilisateur.

### D-137 : placement et dessin des pastilles d'accélération et de freinage
- Date : 2026-10-26
- Décision :
  - zone d'une pastille : intervalles du segment au-delà du seuil de son niveau (rouge pour une pastille rouge) ; si aucune partie de la zone n'est à au moins `ACCEL_BADGE_CLEARANCE` des extrémités, point de cette plage le plus proche du pic ;
  - pics égaux (freinage à la borne le long d'une rampe, à l'arrondi près) : la première accélération, le dernier freinage, juste avant l'arrêt ; position du pic : début de l'intervalle pour une accélération, milieu pour un freinage (constant) ;
  - segment court : pastille gardée sur le segment ; pic au milieu exact : vers le début pour une accélération, vers la fin pour un freinage ;
  - valeurs (HYPOTHÈSE, `defaults.ts`) : dégagement 2,5 m, décalage 2 m, mesurés à environ 11 px/m (éditeur sur un écran Full HD), Contraste fort compris ; sur un segment de moins de 5 m, la pastille tombe donc près du jeton ou de la poignée ;
  - losange de demi-diagonale 0,9 rayon de jeton, contour comme la pastille ronde ; « + » et « − » tracés en traits (épaisseur 1,5 fois le contour du jeton), indépendants de la police ;
  - alertes des seules courses dessinées (pas du relayeur, comme les vitesses) ; paramètres des codes : `segment` et `value` (m/s²) ; une course lancée qui freine fort à son départ (virage) reçoit l'alerte de freinage (A.2).
  Précise D-132.
- Raison : pastilles hors du jeton et de la poignée dans les deux thèmes d'écran (image de référence) ; emplacement stable d'une modification à l'autre (sans égalité tranchée par l'arrondi) ; « − » (U+2212) peut manquer dans la police.
- Alternatives écartées : zone au-delà du seuil orange quelle que soit la pastille ; dégagement de 2 m (losange contre le jeton en Contraste fort) ; signes en texte.
- Origine : écriture de l'étape 4, prise seul : à relire.
