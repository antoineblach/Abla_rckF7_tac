## 6. Éditeur (lot 1)

### 6.1 Disposition de l'écran

- Barre d'outils en haut ; bibliothèque repliable à gauche ; terrain au centre ; inspecteur à droite ; commandes de lecture sous le terrain ; en bas, une bande de hauteur fixe partagée entre l'arbre des temps (à gauche, 2/5 de la largeur) et la liste des actions du temps (à droite, 3/5, 6.7, lot 3 bis, D-113).
- La zone du terrain ne dépend pas du contenu des autres panneaux : barre d'outils, commandes de lecture et arbre des temps ont une hauteur fixe (défilement interne si la place manque ; la seconde rangée des commandes de lecture défile à 1280 px de large, et à 1440 px avec la case « Vitesses », D-077, D-121) ; bibliothèque et inspecteur ont une largeur fixe avec défilement interne ; bandeau, messages et boutons d'option s'affichent en surimpression du terrain (D-048, D-050).
- L'échelle et le cadrage du terrain ne changent que par une action volontaire : molette, Espace + glisser ou bouton du milieu, choix de la vue enregistrée, orientation, ouverture d'une combinaison, « Ajuster », « Zone utile ». Quand la zone du terrain change de taille (fenêtre redimensionnée, bibliothèque repliée, plein écran), l'échelle et le point central sont conservés (D-048).
- PC uniquement : souris et clavier. Aucune contrainte tactile.

### 6.2 Outils

| Outil | Raccourci | Comportement |
|---|---|---|
| Sélection | V | Clic, multi-sélection au cadre, Maj+clic pour ajouter. Glisser pour déplacer : placements de départ au temps 1, points de passage dans tout temps ; une position héritée d'un temps précédent ne se déplace pas (D-009). Un mouvement de moins de 4 px entre l'appui et le relâchement n'est pas un glisser : le clic sélectionne sans rien déplacer (D-051). |
| Placer joueuse A | A | Clic sur le terrain ; numéro suivant libre ; le clic fixe son placement de départ, quel que soit le temps affiché (D-009). |
| Placer joueuse B | B | Idem pour B. |
| Course | R | Clic sur une joueuse, puis un clic par point de passage ; Entrée ou double clic pour terminer ; Échap pour annuler. Points déplaçables ensuite ; clic droit sur un point pour le supprimer (supprimer le dernier point supprime la course). Sur une joueuse qui court déjà dans le temps, la course est prolongée (D-015). Lot 3 bis : quand la course tracée (délai 0) fait que toutes les options du temps suivant prolongent la course de la joueuse au temps précédent, celle-ci reçoit « Finit lancée », dans la même étape d'annulation (D-106). |
| Passe | P | Clic sur la passeuse, puis sur la receveuse. Lâcher « à la réception », délai 0, quand la passeuse n'a pas le ballon au début du temps, même si elle ne le reçoit pas encore (la passe attend une réception tracée ensuite) ; sauf si elle l'obtient en le ramassant au sol : instant fixe, à l'instant du ramassage (un ramassage n'est pas une réception, 5.4). Passeuse qui a le ballon au début du temps : instant fixe, délai par défaut : instant où elle obtient le ballon dans le temps (D-015, D-110, D-119). |
| Jeu au pied | J | Clic sur la frappeuse, puis sur une joueuse (receveuse) ou sur le terrain (point visé, aimanté si la grille est active) ; cliquer à nouveau sur la frappeuse annule. Lâcher comme une passe ; type « Coup d'envoi/renvoi » si la catégorie l'est, sinon « Long/recentrage » (D-093, D-095, D-110). |
| Regroupement | G | Clic sur une joueuse qui a le ballon dans le temps affiché : ruck formé à la fin de sa course (ou à la réception si elle est plus tardive), soutien et relayeur proposés (D-081) ; refus avec message sinon. |
| Supprimer | Suppr | Sur la sélection ; supprimer une joueuse supprime ses courses et les passes, jeux au pied et regroupements qui la concernent, dans tous les temps (D-014). |

Autres raccourcis : Ctrl+D dupliquer les joueuses sélectionnées (numéro suivant libre, décalage de 2 m, sans actions) ; flèches pour décaler de 0,5 m, Maj+flèches de 5 m, sans aimantation (D-015) ; L lecture/pause ; appui bref sur Espace (relâchée sans glisser, en moins de 0,5 s, HYPOTHÈSE) lecture/pause (D-116) ; 1, 2, 3 marche, trot, sprint du segment sélectionné, 0 allure de la course pour ce segment ; sans segment sélectionné, 1, 2, 3 règlent l'allure de toutes les courses sélectionnées ; ces chiffres sont lus aussi sur la touche physique (rangée du haut sans Maj sur un clavier AZERTY, pavé numérique) (D-114, D-120) ; F ajuster sur la vue enregistrée (D-049) ; Ctrl+Z / Ctrl+Y ; Ctrl+S enregistrer ; molette pour zoomer ; Espace+glisser ou bouton du milieu pour se déplacer, sans lecture ni pause. Les raccourcis restent actifs quand le focus est sur une case à cocher ou un bouton ; ils sont ignorés dans les champs de texte, les listes et le curseur temporel (D-056). Espace n'active ni ne coche jamais le bouton, la case ou le `summary` qui a le focus (`preventDefault` à l'appui et au relâchement), et elle est ignorée quand un dialogue est ouvert.

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
- Course : allure (Marche, Trot, Sprint ou « Vitesse saisie » en km/h, avec m/s et km/h) et, sous elle, le « Curseur de l'allure » (lot 3bis-1) ; délai (calculé et non modifiable sous un lien en départ différé) ; durée imposée, suivie de ses facteurs quand ils ne valent pas 1 (« Durée imposée : vitesses × 0,80. », accélérations ajoutées quand k > 1, 5.3), sauf quand le lien les donne déjà (vitesse ajustée, départ différé en retard) ; « Finit lancée » (avec « Sans effet : attente de x s avant le temps suivant » quand elle finit avant la fin du temps) ; bloc « Segment n » pour le segment sélectionné : « Allure de la course », Marche, Trot, Sprint ou « Vitesse saisie » en km/h, et le « Curseur du segment » dès que « Allure de la course » n'est pas choisie ; synchronisation : « Caler sur… » (bandeau en surimpression, puis clic sur la cible, Échap pour annuler, 5.8), ou la cible, le point de rendez-vous, le réglage, le résultat (délai calculé, ou facteurs du solveur) et « Retirer le lien » ; longueur, durée, vitesses moyenne et de pointe ; une ligne par segment (allure, vitesse cible, pointe), suivie de « , accélération 6,4 m/s², freinage 7,2 m/s² » quand un seuil est dépassé, et de la couleur de l'alerte la plus grave du segment (vitesse, accélération, freinage) ; alertes (lot 3 bis, D-106 à D-109, D-114 ; lot 3bis-1, D-138).
- Curseur de vitesse (lot 3bis-1, D-133, D-138) : en km/h, valeur affichée en m/s et en km/h, suivie du nom de l'allure sur un repère (« 5,5 m/s (19,8 km/h), Sprint ») ; repères Marche, Trot, Sprint aux allures des réglages, en traits verticaux nommés sous la piste ; zones orange et rouge en aplats, aux seuils de vitesse ; bornes de 1 km/h au seuil rouge + 5 km/h (30 km/h par défaut ; HYPOTHÈSES) ; au glisser, aimantation à ±0,5 km/h d'un repère ; relâché sur un repère, l'allure nommée est gardée (elle suit les réglages), ailleurs la vitesse est saisie ; au clavier, pas de 0,1 km/h, et une valeur égale à un repère donne l'allure nommée. Validation au relâchement ou à chaque flèche : une étape d'annulation par geste. La liste et le champ en km/h (1 à 45 km/h) restent ; une valeur hors des bornes du curseur le met en butée.
- Passe : lâcher « à un instant fixe » (« Délai ») ou « à la réception » (+ « Temps de contrôle », D-121), instant réel du lâcher, vitesse de passe ; alerte « En-avant probable » (5.7).
- Jeu au pied (lot 3) : type, cible (receveuse ou point x, y), lâcher comme une passe (lot 3 bis), temps de vol (vide : défaut du type) (D-095, D-110).
- Regroupement (lot 3) : type (ruck, maul), soutien et relayeur parmi les coéquipières de la plaquée, instant de formation, durée, défense au regroupement (« Par défaut », « Garde », « Gratteur ») (D-078, D-095).
- Réglages de `reglages.json` (thème, allures, vitesse de passe ; lot 3 bis : profil de vitesse en m/s², seuils orange et rouge en km/h ; lot 3bis-1 : « Pointe de la joueuse », de 1 à 12 m/s, km/h affichés, après le profil de vitesse, puis « Seuils d'accélération » et « Seuils de freinage » en m/s², l'orange de 0,5 m/s² au rouge, le rouge de l'orange à 30 m/s², D-134, D-138), modifiables depuis l'inspecteur.
- Lot 3 bis : toute vitesse est affichée en m/s et en km/h ; vitesses de segment et seuils se saisissent en km/h ; le code et les fichiers restent en m/s (D-117).

### 6.6 Départ d'une nouvelle combinaison

- Deux placements fournis : équipe A seule en ligne ; 7 contre 7 en ligne. A sur x = 40 m, n° 1 à 7 de y = 5 m à y = 65 m tous les 10 m ; en 7 contre 7, B en face sur x = 50 m ; ballon à A n° 4 ; A attaque ; nom « Nouvelle combinaison », catégorie ruck/jeu courant, vue terrain complet (D-008).
- S'y ajoutent les modèles de placement enregistrés : en choisir un crée une combinaison sans joueuses (avec un ballon si le modèle en a un), puis lance la pose du modèle (ancre, côté ouvert) (D-091). Elle n'est enregistrée qu'une fois l'ancre validée ; jusque-là, rien n'est écrit (Ctrl+S compris) et aucun brouillon n'est gardé. Échap, « Annuler », un changement d'outil ou une autre pose l'abandonnent : la combinaison ouverte avant est relue dans le dossier (ou IndexedDB) et rouverte, ou l'éditeur reste vide si elle n'existe plus (D-101).

### 6.7 Liste des actions du temps (lot 3 bis)

- Dans la bande du bas, à droite de l'arbre des temps (6.1, D-113) ; défilement interne ; le terrain ne change ni de taille ni de cadrage.
- Temps affiché : le temps sélectionné en édition, le temps à `t` en lecture. Une ligne par action (courses, passes, jeux au pied, regroupements), triée par instant de début, puis ordre du tableau ; en-tête gradué en secondes sur la durée du temps.
- Titre : « Actions du temps : Temps n » (libellé du temps affiché, D-121).
- Chaque ligne : type et acteurs ; barre de temps (début et fin sur l'échelle du temps) ; détails principaux ; une pastille par gravité (erreur, avertissement), avec leur nombre et les messages en infobulle (en-avant, vitesse, accélération et freinage, synchronisation, validations existantes, D-121, D-132) ; tous les détails en infobulle et dans l'inspecteur. Une action ignorée est barrée en rouge.
- Détails, vitesses en km/h et en m/s :
  - course : joueuse, longueur, départ, arrivée, durée, vitesse moyenne et de pointe, vitesse de chaque segment (allure ou saisie), facteurs d'une durée imposée (6.5, D-138), lien, fin lancée (ou sans effet) ;
  - passe : passeuse, receveuse, mode et instant réel du lâcher, arrivée, distance, temps de vol, en-avant probable ;
  - jeu au pied : frappeuse, cible (receveuse ou point), mode et instant réel du lâcher, distance, temps de vol ;
  - regroupement : type, plaquée, formation, sortie de balle.
- Clic : sélectionne l'action sur le terrain et dans l'inspecteur (en lecture, retour au mode édition du temps affiché) ; survol : halo sur le terrain, aussi pendant la lecture, sur la scène à `t` (D-121) ; Suppr : suppression, une étape d'annulation ; la ligne de l'action sélectionnée est mise en évidence.

