## 6. Éditeur (lot 1)

### 6.1 Disposition de l'écran

- Barre d'outils en haut ; bibliothèque repliable à gauche ; terrain au centre ; inspecteur à droite ; commandes de lecture sous le terrain ; en bas, une bande de hauteur fixe entièrement occupée par la frise (6.4, D-139).
- La zone du terrain ne dépend pas du contenu des autres panneaux : barre d'outils, commandes de lecture et frise ont une hauteur fixe (défilement interne si la place manque ; la seconde rangée des commandes de lecture défile à 1280 px de large, et à 1440 px avec la case « Vitesses », D-077, D-121) ; bibliothèque et inspecteur ont une largeur fixe avec défilement interne ; bandeau, messages et boutons d'option s'affichent en surimpression du terrain (D-048, D-050).
- L'échelle et le cadrage du terrain ne changent que par une action volontaire : molette, Espace + glisser ou bouton du milieu, choix de la vue enregistrée, orientation, ouverture d'une combinaison, « Ajuster », « Zone utile ». Quand la zone du terrain change de taille (fenêtre redimensionnée, bibliothèque repliée, plein écran), l'échelle et le point central sont conservés (D-048).
- PC uniquement : souris et clavier. Aucune contrainte tactile.

### 6.2 Outils

| Outil | Raccourci | Comportement |
|---|---|---|
| Sélection | V | Clic, multi-sélection au cadre, Maj+clic pour ajouter ou retirer, sur le terrain comme dans la frise (6.4). Glisser pour déplacer : placements de départ et ballon au sol à `t = 0` seulement ; points de passage des trajectoires de l'intervalle en cours ; une position atteinte par une action ne se déplace pas (6.3, D-009, D-139). Un mouvement de moins de 4 px entre l'appui et le relâchement n'est pas un glisser : le clic sélectionne sans rien déplacer (D-051). |
| Placer joueuse A | A | Clic sur le terrain ; numéro suivant libre ; le clic fixe son placement de départ, quel que soit l'instant du curseur (D-009). |
| Placer joueuse B | B | Idem pour B. |
| Course | R | Clic sur une joueuse, puis un clic par point de passage ; Entrée ou double clic pour terminer ; Échap pour annuler. Points déplaçables ensuite ; clic droit sur un point pour le supprimer (supprimer le dernier point supprime la course). Départ au curseur (6.3). Curseur sur la fin de la course précédente de la joueuse : la course lui est collée (lancée, 5.2). Curseur pendant une course de la même joueuse : la nouvelle course coupe la course en cours au curseur et lui est collée (lancée), comme « Couper la course ici » (6.5) ; la fin coupée est supprimée, dans la même étape d'annulation, et les bords collés à cette fin se figent, avec un message (5.8). Le collage du bord droit de l'ancienne course est retiré, avec un message ; la partie gardée finit au curseur, collée à la nouvelle course. Une course du tronc encore en cours après l'embranchement n'est pas coupée, car elle continue dans toutes les options (5.2) : la nouvelle course suit le repli de 4.3, et l'alerte « départ retardé de x s » indique le moyen de choisir le cap dans l'option : couper la course du tronc à l'embranchement (D-015, D-139). |
| Passe | P | Clic sur la passeuse, puis sur la receveuse. Passeuse qui a le ballon au curseur : lâcher au curseur, sauf curseur sur une de ses réceptions (ci-dessous). Sinon, lâcher collé à sa prochaine réception, écart 0. Sans réception tracée, la passe reste à l'instant du curseur, ignorée et signalée (5.4), et attend : une réception tracée ensuite la colle. Passeuse qui obtient le ballon en le ramassant au sol : instant fixe, à l'instant du ramassage (un ramassage n'est pas une réception, 5.4) (D-015, D-110, D-119, D-139). |
| Jeu au pied | J | Clic sur la frappeuse, puis sur une joueuse (receveuse) ou sur le terrain (point visé, aimanté si la grille est active) ; cliquer à nouveau sur la frappeuse annule. Lâcher comme une passe ; type « Coup d'envoi/renvoi » si la catégorie l'est, sinon « Long/recentrage » (D-093, D-095, D-110). |
| Regroupement | G | Clic sur une joueuse : ruck dont la formation est collée à la fin de sa course en cours au curseur ou qui y démarre, ou à sa prochaine réception si elle est plus tardive ; sans course ni réception à venir, formation au curseur. Soutien et relayeur proposés (10.3, D-081) ; refus avec message si elle n'a pas le ballon à la formation (D-095, D-139). |
| Supprimer | Suppr | Sur la sélection ; supprimer une joueuse supprime ses courses et les passes, jeux au pied et regroupements qui la concernent, dans toutes les branches (D-014, D-139). |

Autres raccourcis : Ctrl+D dupliquer les joueuses sélectionnées (numéro suivant libre, décalage de 2 m, sans actions) ; flèches pour décaler de 0,5 m, Maj+flèches de 5 m, sans aimantation (D-015) ; L lecture/pause ; appui bref sur Espace (relâchée sans glisser, en moins de 0,5 s, HYPOTHÈSE) lecture/pause (D-116) ; 1, 2, 3 marche, trot, sprint du segment sélectionné, 0 allure de la course pour ce segment ; sans segment sélectionné, 1, 2, 3 règlent l'allure de toutes les courses sélectionnées ; ces chiffres sont lus aussi sur la touche physique (rangée du haut sans Maj sur un clavier AZERTY, pavé numérique) (D-114, D-120) ; F ajuster sur la vue enregistrée (D-049) ; Ctrl+Z / Ctrl+Y ; Ctrl+S enregistrer ; molette pour zoomer ; Espace+glisser ou bouton du milieu pour se déplacer, sans lecture ni pause. Les raccourcis restent actifs quand le focus est sur une case à cocher ou un bouton ; ils sont ignorés dans les champs de texte, les listes et le curseur temporel (D-056). Espace n'active ni ne coche jamais le bouton, la case ou le `summary` qui a le focus (`preventDefault` à l'appui et au relâchement), et elle est ignorée quand un dialogue est ouvert.

Lot 3 bis : un clic sur le trait d'une course sélectionne la course et le segment sous le pointeur ; un point de passage sélectionné désigne le segment qui arrive à ce point (D-114).

Poignées (points de passage, point visé d'un jeu au pied) : elles ne répondent au clic qu'avec l'outil Sélection, le seul qui les dessine ; un autre outil clique la joueuse dessous (D-175).

Pose au curseur, précisions (D-171) :
- Curseur « sur la fin » d'une course ou sur une réception : à moins de 0,005 s, la moitié du pas du curseur (HYPOTHÈSE).
- Passe et jeu au pied : la sortie d'un regroupement que la passeuse relaie compte comme une réception (5.4). Curseur sur une réception de la passeuse : lâcher collé à cette réception, écart 0, alors qu'elle a déjà le ballon ; la passe suit si la réception bouge ensuite. Sur un ramassage : lâcher au curseur, non collé.
- Une réception hors de la branche de la nouvelle action et de ses ancêtres n'est pas une cible (4.3) : la passe reste au curseur. Une réception encore ignorée est une cible : une chaîne de passes se trace aussi en commençant par la fin.
- Une réception tracée ensuite colle la première passe de sa receveuse ignorée faute de ballon, non collée et dont l'instant n'est pas après l'arrivée ; une seule par réception.
- Regroupement : la course « en cours » comprend l'instant de sa fin ; un ramassage n'est pas une réception : sans course ni réception, formation au curseur, refusée si la joueuse n'a pas le ballon. Curseur sur une réception de la joueuse : formation collée à cette réception, écart 0, quand aucune de ses courses ne finit à cet instant ; une course qui finit à cet instant, encore en cours sur la réception ou qui y démarre garde la priorité, formation collée à sa fin.
- Sélection : les actions en grisé se sélectionnent, après celles de l'intervalle, sans leurs poignées (6.3).

### 6.3 Comportements

- Aimantation optionnelle sur une grille de 1 m, activée par un bouton de la barre d'outils (D-015).
- **Un seul mode à l'arrêt** (D-139) : le terrain montre et édite l'instant du curseur.
  - Jetons à leur position à `t` ; trajectoires de l'intervalle en cours (5.1) en plein, antérieures en grisé, ultérieures non dessinées.
  - Sélectionner un bloc dans la frise, ou une action sur le terrain, amène le curseur dans l'intervalle de l'action s'il n'y est pas ; sinon sa trajectoire n'est pas dessinée et ne peut pas être modifiée. Cela vaut aussi pour le jeu au pied et le regroupement que l'outil vient de poser et de sélectionner ; une action retirée de la sélection par Maj+clic ne déplace pas le curseur (D-172).
  - Nouvelle action : départ au curseur, dans la branche affichée ; à l'instant exact d'un embranchement, dans l'option affichée.
  - Placements de départ et ballon au sol déplaçables seulement à `t = 0` ; « Placer » fixe toujours le placement de départ (D-095).
  - En lecture, le terrain n'est pas éditable. À l'arrêt, quelle qu'en soit la cause (pause, fin de ligne, attente à un embranchement, curseur déplacé), il édite l'instant du curseur. Le premier clic sur le terrain pendant la lecture met en pause, sans rien modifier ; une modification (une étape d'annulation) arrête la lecture ; un enregistrement ou un rechargement ne l'arrête pas (D-044, D-172).
  - Déplacer le curseur ou lancer la lecture abandonne le tracé en cours d'un outil et le message affiché, qui portaient sur l'instant précédent ; un saut au même instant les garde (D-172).
  - Ouvrir une combinaison, même celle déjà ouverte, remet la ligne par défaut et `t = 0`. Après un changement de la combinaison, la ligne reste si elle est encore valide, complétée par les options par défaut ; sinon, ligne par défaut. Le curseur est ramené dans la durée à la fin d'un geste seulement : un glisser qui raccourcit la ligne ne le perd pas (D-172).
- Annuler/rétablir par instantanés de la combinaison, 100 niveaux ; un geste terminé = une étape (pas une étape par mouvement de souris). Un rechargement depuis le dossier remet l'historique à zéro (D-044).
- Numérotation : A et B de 1 à n ; numéros modifiables. Couleurs par défaut distinguables par les daltoniens (bleu pour A, orange pour B).
- Le jeton n'affiche que le numéro.

### 6.4 Frise (D-139)

Ce que la frise permet ; son aspect (blocs, couleurs, rangées, onglets) se décide dans le lot qui la code.

- **Piste** : une seule piste globale, empilée automatiquement : une rangée tant qu'un seul événement est en cours, des rangées superposées quand plusieurs se chevauchent. Une joueuse sans action n'y figure pas. Lisibilité exigée. Hauteur fixe et défilement interne : le terrain ne change ni de taille ni de cadrage (6.1, D-048).
- **Curseur** : l'instant que montre le terrain (6.3). Il s'aimante aux bords.
- **Blocs** : une action ou une séquence est un bloc : une course jusqu'à la fin de son profil, une passe ou un jeu au pied du lâcher à l'arrivée, un regroupement de la formation à la sortie de balle, une séquence de son début à sa fin. La sélection est liée au terrain.
  - Clic : sélectionne l'action sur le terrain et dans l'inspecteur (6.3) ; survol : halo sur le terrain ; pendant la lecture, sur la scène à `t` seulement : une action pas encore dessinée n'en a pas, une action en cours l'a jusqu'où elle est dessinée, une action antérieure en grisé l'a ; à l'arrêt, sur toute la ligne, une action qui n'est pas dessinée à l'instant du curseur comprise (D-121, D-173) ; Suppr : suppression, une étape d'annulation ; le bloc sélectionné est mis en évidence.
  - Une pastille par gravité (erreur, avertissement), avec leur nombre et les messages en infobulle (en-avant, vitesse, accélération et freinage, collage, validations existantes, D-121, D-132) ; tous les détails en infobulle et dans l'inspecteur. Une action ignorée est barrée en rouge.
  - Détails, vitesses en km/h et en m/s :
    - course : joueuse, longueur, départ, arrivée, durée, vitesse moyenne et de pointe, vitesse de chaque segment (allure ou saisie), facteurs d'une durée imposée (6.5, D-138), collages, fin lancée ou freinée (5.2) ;
    - passe : passeuse, receveuse, instant réel du lâcher, arrivée, distance, temps de vol, en-avant probable ;
    - jeu au pied : frappeuse, cible (receveuse ou point), instant réel du lâcher, distance, temps de vol ;
    - regroupement : type, plaquée, formation, sortie de balle ;
    - séquence : libellé, début, fin, consigne.
- **Bords** : déplacer un bord change l'instant ou la durée, donc les vitesses (tenu exactement, signalé, jamais bloquant, D-129). L'autre bord ne bouge pas.
  - Bord gauche tiré : l'instant de départ change, donc la durée (durée imposée, vitesse du ballon, temps de vol, durée du regroupement, durée de la séquence). Bord droit tiré : le champ de ce bord change (4.1). Bloc entier glissé : il garde sa durée.
  - Allonger un bloc ne décale que ce qui lui est collé.
- **Collage** (5.8) : amener un bord sur un autre, à moins d'un seuil en pixels (HYPOTHÈSE, dans `defaults.ts`), le colle ; il le suit ensuite ; on le décolle en l'éloignant. Le geste décide de `keep` : bloc glissé jusqu'à la cible, `duration` ; bord droit tiré jusqu'à la cible, `start` ; l'inspecteur le montre et permet de changer (6.5).
- **Touches**, pour bloc, bord et embranchement. Un geste, une étape d'annulation.
  - Maj+clic ajoute ou retire de la sélection, sur le terrain comme dans la frise ; le cadre sélectionne dans les deux ; blocs et bords sélectionnés se déplacent ensemble.
  - Ctrl+glisser décale tout ce qui suit dans la branche et ses descendantes, jamais une option sœur. C'est le moyen de faire de la place au milieu d'une branche.
  - Alt+glisser désactive l'aimantation, pour poser un bord à côté d'un autre sans le coller. Sous Windows, Alt relâché seul peut donner le focus au menu de Chrome : vérification dans frise-2, autre touche proposée alors si besoin.
- **Embranchements et options** (reprend D-012) :
  - « Créer un embranchement » à l'instant du curseur, dans la branche affichée : les actions, les séquences et les options de la branche qui démarrent à cet instant ou après passent dans l'option A, par défaut ; l'option B est vide. Un collage du tronc vers une action passée dans l'option se fige, avec un message (5.8).
  - Un embranchement est un bord : il se déplace, se colle à un événement du tronc et sert de cible (5.8). Déplacé seul, sans collage, les actions passées du mauvais côté sont signalées (4.3).
  - Option : condition, choix de l'option par défaut, libellé. Libellé calculé : « Option A », « B », « C », dans l'ordre de création ; un libellé saisi remplace le libellé calculé ; les lettres se recalculent après une suppression.
  - « Créer une option » sur un embranchement : une sœur vide. « Dupliquer » : une sœur avec une copie de ses actions et de ses séquences, collages recopiés vers les copies (5.8), sans ses embranchements.
  - Supprimer une option : ses descendantes incluses, après confirmation. Supprimer l'avant-dernière fond la dernière dans son parent. La racine ne se supprime pas.
- **Séquences** : libellé et consigne posés sur une durée, un bloc comme un autre ; elles se créent dans la frise. Consigne : avertissement au-delà de 60 caractères (HYPOTHÈSE, lisibilité des GIF sur téléphone).

### 6.5 Inspecteur

- Combinaison, en tête, toujours affichée et repliable (état replié mémorisé par poste, D-052) : nom (appliqué à la validation du champ, D-005), catégorie, notes, équipe qui attaque, ajout ou retrait du ballon (D-007), porteuse au départ ou ballon au sol (« Poser le ballon au sol », D-083), « Déplacer la combinaison » et « Retourner » (D-090), dimensions du terrain (bornées à la Règle 1, D-017), vue (cadre libre réglé par « Enregistrer la vue actuelle comme cadre » et des champs numériques, D-019). Choisir la vue enregistrée recadre le terrain sur elle.
- Joueuse : numéro, couleur, mode défense (manuel ; auto au lot 4), porteuse du ballon au départ (D-007).
- Tout bloc (D-139) : « Départ » (« Début » pour une séquence), instant absolu, modifiable ; calculé et non modifiable quand un collage le fixe. Bord collé : sa cible et « Décoller » ; écart (`offset`, réglé ici seulement) : sur le bord gauche, « Temps de contrôle » pour une passe et un jeu au pied, « Écart » ailleurs ; sur le bord droit, « Écart de la fin », passe et jeu au pied compris (D-175). Bord droit collé : le résultat (départ calculé, ou facteurs du solveur) et le choix « Quand la cible se déplace », « Le bloc glisse » (`keep: 'duration'`) ou « Le bloc s'étire » (`keep: 'start'`), inactif quand le bord gauche est aussi collé (5.8, D-175).
- Course : allure (Marche, Trot, Sprint ou « Vitesse saisie » en km/h, avec m/s et km/h) et, sous elle, le « Curseur de l'allure » (lot 3bis-1) ; durée imposée, suivie de ses facteurs quand ils ne valent pas 1 (« Durée imposée : vitesses × 0,80. », accélérations ajoutées quand k > 1, 5.3), sauf quand le collage les donne déjà (bord droit qui s'étire, départ en retard) ; bloc « Segment n » pour le segment sélectionné : « Allure de la course », Marche, Trot, Sprint ou « Vitesse saisie » en km/h, et le « Curseur du segment » dès que « Allure de la course » n'est pas choisie ; « Couper la course ici », au point de passage sélectionné, sinon au curseur : deux courses collées (5.8) ; longueur, durée, vitesses moyenne et de pointe ; une ligne par segment (allure, vitesse cible, pointe), suivie de « , accélération 6,4 m/s², freinage 7,2 m/s² » quand un seuil est dépassé, et de la couleur de l'alerte la plus grave du segment (vitesse, accélération, freinage) ; alertes (lot 3 bis, D-114 ; lot 3bis-1, D-138 ; D-139).
- Curseur de vitesse (lot 3bis-1, D-133, D-138) : en km/h, valeur affichée en m/s et en km/h, suivie du nom de l'allure sur un repère (« 5,5 m/s (19,8 km/h), Sprint ») ; repères Marche, Trot, Sprint aux allures des réglages, en traits verticaux nommés sous la piste ; zones orange et rouge en aplats, aux seuils de vitesse ; bornes de 1 km/h au seuil rouge + 5 km/h (30 km/h par défaut ; HYPOTHÈSES) ; au glisser, aimantation à ±0,5 km/h d'un repère ; relâché sur un repère, l'allure nommée est gardée (elle suit les réglages), ailleurs la vitesse est saisie ; au clavier, pas de 0,1 km/h, et une valeur égale à un repère donne l'allure nommée. Validation au relâchement ou à chaque flèche : une étape d'annulation par geste. La liste et le champ en km/h (1 à 45 km/h) restent ; une valeur hors des bornes du curseur le met en butée.
- Passe : « Départ » (le lâcher, à son instant, collé ou non, 5.4), instant réel du lâcher, vitesse de passe ; alerte « En-avant probable » (5.7).
- Jeu au pied (lot 3) : type, cible (receveuse ou point x, y), « Départ » comme une passe, temps de vol (vide : défaut du type) (D-095, D-110).
- Regroupement (lot 3) : type (ruck, maul), soutien et relayeur parmi les coéquipières de la plaquée, instant de formation (son « Départ »), durée, défense au regroupement (« Par défaut », « Garde », « Gratteur ») (D-078, D-095).
- Séquence (D-139) : libellé (vide : « Séquence n »), consigne (6.4), début et fin.
- Embranchement (D-139) : instant, calculé si collé, avec la cible et « Décoller » ; pour chaque option : libellé, condition, option par défaut ; créer, dupliquer ou supprimer une option (6.4).
- Réglages de `reglages.json` (thème, allures, vitesse de passe ; lot 3 bis : profil de vitesse en m/s², seuils orange et rouge en km/h ; lot 3bis-1 : « Pointe de la joueuse », de 1 à 12 m/s, km/h affichés, après le profil de vitesse, puis « Seuils d'accélération » et « Seuils de freinage » en m/s², l'orange de 0,5 m/s² au rouge, le rouge de l'orange à 30 m/s², D-134, D-138), modifiables depuis l'inspecteur.
- Lot 3 bis : toute vitesse est affichée en m/s et en km/h ; vitesses de segment et seuils se saisissent en km/h ; le code et les fichiers restent en m/s (D-117).

### 6.6 Départ d'une nouvelle combinaison

- Deux placements fournis : équipe A seule en ligne ; 7 contre 7 en ligne. A sur x = 40 m, n° 1 à 7 de y = 5 m à y = 65 m tous les 10 m ; en 7 contre 7, B en face sur x = 50 m ; ballon à A n° 4 ; A attaque ; nom « Nouvelle combinaison », catégorie ruck/jeu courant, vue terrain complet (D-008).
- S'y ajoutent les modèles de placement enregistrés : en choisir un crée une combinaison sans joueuses (avec un ballon si le modèle en a un), puis lance la pose du modèle (ancre, côté ouvert) (D-091). Elle n'est enregistrée qu'une fois l'ancre validée ; jusque-là, rien n'est écrit (Ctrl+S compris) et aucun brouillon n'est gardé. Échap, « Annuler », un changement d'outil ou une autre pose l'abandonnent : la combinaison ouverte avant est relue dans le dossier (ou IndexedDB) et rouverte, ou l'éditeur reste vide si elle n'existe plus (D-101).

### 6.7 Liste des actions

Retirée (D-139) : les blocs de la frise reprennent clic, survol, Suppr, pastilles et détails en infobulle (6.4). Le numéro reste pour ne pas casser les références.

