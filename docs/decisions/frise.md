# Décisions de la frise chronologique

Index, règles du journal et mode de lecture : [README.md](README.md).

## Chantier frise-spec : la SPEC 1.9

Plan : `docs/archive/plans/frise-spec.md`, validé le 3 novembre 2026 : recommandations de Q1 à Q13 acceptées, avec 5 précisions de l'utilisateur (Q4, Q7, Q11, section 1 du plan et outil Course). Les lots frise-1 à frise-4 ajoutent ici leurs décisions.

### D-139 : frise chronologique à la place des temps
- Date : 2026-11-03
- Décision : une combinaison n'est plus un arbre de temps mais une frise continue, avec des embranchements d'option et une aimantation persistante entre bords.
  - **Choix de l'utilisateur** :
    1. Plus de temps, ni temps précédent ou suivant : une seule frise chronologique continue, avec des embranchements d'option.
    2. Frise : une seule piste globale, empilée automatiquement (une rangée tant qu'un seul événement est en cours, des rangées superposées quand plusieurs se chevauchent ; une joueuse sans action n'y figure pas). Lisibilité exigée.
    3. Continuité : une course part de la position de la joueuse à son instant de départ ; deux courses d'une même joueuse ne se chevauchent pas ; une course collée à la précédente de la même joueuse la prolonge lancée.
    4. Bords : déplacer un bord change l'instant ou la durée, donc les vitesses (D-129 : tenu exactement, signalé, jamais bloquant). Allonger un bloc ne décale pas les autres ; une touche de modification décale tout ce qui suit ; sélection multiple de blocs et de bords, déplacés ensemble.
    5. Aimantation persistante : un bord collé à un autre le suit ensuite ; on le décolle en l'éloignant. Elle remplace les liens « Caler sur… » (D-108), le lâcher « à la réception » (D-110) et « Finit lancée » (D-106), et rend inutile un mécanisme à part pour « Partir ensemble » et « Arriver ensemble » (3bis-2).
    6. Allure et durée : le dernier geste gagne. Choisir une allure retire la durée imposée (le bloc reprend sa longueur naturelle) ; tirer le bord droit impose la durée.
    7. Embranchement : à un instant ; avant, commun à toutes les options ; après, actions propres à chaque option ; une action commencée avant continue dans toutes les options ; condition et option par défaut portées par l'embranchement. L'arbre des temps disparaît.
    8. Séquence : libellé et consigne posés sur une durée, un bloc comme un autre. Elle sert à l'en-tête et au bandeau du GIF, aux vignettes du PDF, aux traces appuyées, au précédent et suivant du lecteur et à sa pause automatique.
    9. Aucune migration : combinaisons existantes jetables. Schéma v5 neuf ; migrations v1 à v4, `schemaV0` à `schemaV3` et fixtures `play-v0` à `play-v4` supprimés ; un fichier d'une version antérieure est refusé avec un message clair, jamais modifié ni déplacé (règle 9). **Seule exception à la règle 6 de `CLAUDE.md`.** `reglages.json` n'est pas concerné.
    10. Aspect de la frise (blocs, couleurs, rangées, onglets) : dans le lot qui la code. La SPEC décrit ce que la frise permet, pas son aspect.
  - **Modèle v5** (SPEC 4.1) : `branches` à la place de `phases` ; `actions` en tableau plat, dont l'ordre départage les égalités ; `sequences`. Chaque action et chaque séquence porte sa branche, un instant absolu `start`, et ses collages (`startGlue`, `endGlue`). Retirés : `Phase`, `delay`, `endsAtSpeed`, `RunSync`, `SyncTarget`, `ReleaseMode`. Une ligne reste un chemin de la racine à une feuille. Un bord collé garde sa dernière valeur : c'est le repli quand le collage est ignoré. Décoller un bord ou supprimer sa cible ne fait jamais bouger le bloc : la valeur calculée à cet instant est écrite.
  - **Hypothèses retenues** :
    - créer un embranchement à t : les actions et les séquences de la branche qui démarrent à t ou après passent dans l'option A, l'option B est vide ; un collage du tronc vers une action passée dans l'option devient invalide : le bord se fige, avec un message ;
    - action d'une option qui démarre avant l'embranchement : elle part à l'embranchement, signalée. Action du tronc qui démarre à l'embranchement ou après : elle reste commune, signalée ;
    - collage vers la même ligne seulement (même branche ou ancêtre). À la pose, refus avec message ; dans un fichier, ignoré et signalé ; cible supprimée, le bord se fige, avec un message ;
    - deux courses d'une joueuse qui se chevauchent : la seconde part à la fin de la première, alerte « départ retardé de x s ». Même repli pour une course d'une participante qui démarre pendant un regroupement : retardée à la sortie de balle ;
    - bord droit d'une passe : vitesse du ballon ; d'un jeu au pied : temps de vol (le modèle porte `flightTime`) ; d'un regroupement : sortie de balle ;
    - séquence qui traverse un embranchement : coupée à l'embranchement et signalée ;
    - course non suivie : freine jusqu'à l'arrêt. Lancée si et seulement si la course suivante est collée à sa fin ; le drapeau et sa recompilation disparaissent, au plus une recompilation reste pour le cas de Q1 où la suivante part en réalité à l'embranchement.
  - **Questions** :
    - Q1, course du tronc suivie dans une seule option : elle est lancée dans toutes les lignes dès qu'une option la prolonge ; dans une option qui ne la prolonge pas, arrêt net à sa fin, avertissement nommant l'option (règle de D-106, conservée pour ce seul cas) ;
    - Q2, passe ou jeu au pied en vol à l'embranchement : une course de la receveuse propre à une option pendant le vol est retardée à l'arrivée du ballon, alerte « départ retardé de x s » ; pour un vrai choix de cap, placer l'embranchement avant le lâcher. Un test vérifie, avec Q1, que toutes les lignes donnent le même état pour tout `t` avant l'embranchement ;
    - Q3, bord droit collé, cible déplacée : le geste décide, l'inspecteur le montre et permet de changer (`keep`). Bloc glissé jusqu'à la cible : il garde sa durée, son départ suit (D-131 et D-136 s'appliquent contre la borne : 0, fin de la course précédente ou embranchement). Bord droit tiré jusqu'à la cible : le départ reste, la durée s'adapte, solveur à deux leviers ;
    - Q4, rendez-vous à un point de passage : `at` disparaît, remplacé par « Couper la course ici », qui donne deux courses collées (vitesse et direction continues, solveur sur la première). Résultat proche, pas identique : le raccord lancé modifie la trajectoire près du point de coupe ; frise-1 mesure l'écart de trajectoire et d'instant. Un point de passage reste une cible possible (`{ point }`) ;
    - Q5, temps de contrôle : écart optionnel sur le collage (`offset >= 0`, défaut 0), dans l'inspecteur seulement, nommé « Temps de contrôle » sur une passe et un jeu au pied ;
    - Q6, bord gauche : même règle pour tous les blocs, l'autre bord ne bouge pas. Tirer le bord gauche change l'instant de départ et donc la durée. Glisser le bloc entier garde sa durée ;
    - Q7, éditeur : un seul mode à l'arrêt, le terrain montre et édite l'instant du curseur. Jetons à leur position à `t` ; trajectoires de l'intervalle en cours en plein, antérieures en grisé, ultérieures non dessinées. Sélectionner un bloc ou une action amène le curseur dans l'intervalle de l'action s'il n'y est pas. Nouvelle action : départ au curseur, dans la branche affichée ; à l'instant exact de l'embranchement, dans l'option affichée. Placements de départ déplaçables seulement à `t = 0` ; « Placer » fixe toujours le placement de départ. En lecture, le terrain n'est pas éditable ; un geste d'édition arrête la lecture ;
    - Q8, intervalles : un intervalle est une séquence, ou un trou d'une branche où démarre au moins une action (sans libellé). Il sert aux traces, au PDF et à l'éditeur. Sans séquence ni embranchement : une seule vignette, tout appuyé. Sans séquence mais avec un embranchement : une vignette pour le tronc et une par option, écart à la lettre du point 8 pour garder l'arbre de vignettes de D-063. Deux séquences d'une même ligne qui se chevauchent : la seconde part à la fin de la première, signalée ;
    - Q9, embranchement : c'est un bord. Il se colle à un événement du tronc et sert de cible. Déplacé seul, sans collage, les actions passées du mauvais côté sont signalées. Au moins deux options ; supprimer l'avant-dernière fond la dernière dans son parent ;
    - Q10, liste des actions : retirée. Les blocs reprennent clic, survol, Suppr, pastilles et détails en infobulle ; la frise occupe toute la largeur de la bande du bas ; le numéro 6.7 reste, avec un renvoi ;
    - Q11, touches, pour bloc, bord et embranchement : Maj+clic ajoute ou retire de la sélection, sur le terrain comme dans la frise ; le cadre sélectionne dans les deux ; Ctrl+glisser décale tout ce qui suit dans la branche et ses descendantes, jamais une option sœur ; Alt+glisser désactive l'aimantation. Sous Windows, Alt relâché seul peut donner le focus au menu de Chrome : vérification dans frise-2, autre touche proposée alors si besoin ;
    - Q12, vocabulaire et cartons : « Embranchement » remplace « Point d'option » (code : `branch point`) ; le préfixe « Temps n, » devient « À 4,5 s, », seulement quand la combinaison a plusieurs embranchements ; en-tête du GIF : « Sortie de mêlée, option B » ; sans séquence, « Option B » ; dans le tronc sans séquence, vide ;
    - Q13, `main` entre les lots : accepté ; après frise-1, le site marche sans frise (instants réglés dans l'inspecteur) jusqu'à frise-2.
  - **Outil Course** (précision de l'utilisateur) : départ au curseur ; posée pendant une course de la même joueuse, elle coupe la course en cours au curseur et lui est collée (lancée), comme « Couper la course ici » ; collée si le curseur est sur la fin de sa course précédente. La fin coupée est supprimée, dans la même étape d'annulation (réponse de l'utilisateur du 04/11) ; « Couper la course ici » garde les deux parties. Le collage du bord droit de l'ancienne course est retiré, avec un message ; la partie gardée finit au curseur, collée à la nouvelle course (SPEC 6.2).
  - **Parties de D-120 et D-121 reportées à 3bis-2** : durée imposée et vitesse ajustée qui s'excluent, départ différé gardé : repris par « le dernier geste gagne » et Q3. « Caler sur… » : sans objet, seul le refus avec message reste, à la pose. Point de rendez-vous valant « Fin » : sans objet (Q4). Dernier point d'une course supprimé : le bord collé à ce point se fige, avec un message. « Changer la cible » : sans objet, on recolle en déplaçant le bord. « Délai calculé par le lien » : « Départ » calculé et non modifiable (6.5).
  - **Découpage du code** : frise-1 (modèle et moteur : types, zod, validation, `branches.ts`, refus des versions antérieures, compilation de ligne continue, collages et graphe, portage minimal ; le site fonctionne, sans frise), frise-2 (la frise : empilement, blocs, curseur, bords, collage, sélection multiple, embranchements et séquences éditables, retrait de la liste ; l'aspect se décide ici), frise-3 (lecteur), frise-4 (exports). Ordre : frise-1 à 4, 3bis-2 réduit (menu du clic droit, même course pour plusieurs joueuses ; « Partir ensemble » et « Arriver ensemble » sans objet), 3bis-3 (positions préréglées, à `t = 0`), lot 4, lot 5. Détail : plan, section 7.
  - **Défense du lot 4** (SPEC 11.7, un ajout, aucune règle changée) : une défenseure en mode auto n'a pas de bloc ; les déclenchements sont les événements de la ligne ; la simulation n'utilise que le passé, donc le tronc reste identique ; « Figer » pose des courses à instant absolu dans la branche de la ligne active ; le cache est indexé par ligne.
  - **Conséquences d'écriture de la SPEC**, points 1 à 4 validés par l'utilisateur le 04/11 :
    - l'embranchement sert de cible (Q9) : `targetId` vaut alors l'id de la branche qui se divise, `event` vaut `end` ;
    - deux courses collées avec un écart positif : pas de prolongation, la joueuse attend ; freinage normal, comme le délai effectif positif de D-106 ;
    - bords gauche et droit tous deux collés : le départ suit son collage, la durée s'adapte ; `keep` est sans effet ;
    - une course partie à sa borne sans y être collée ne prolonge pas la précédente : la lancée se lit dans le modèle (précise D-136) ;
    - dans les décisions rédigées en temps, les raisons, les alternatives et les historiques ne sont pas réécrits : ils se lisent en instants et en intervalles. Leurs règles touchées sont citées dans les statuts ci-dessous.
  - **Précisions validées par l'utilisateur le 04/11** : une branche n'est une cible que si elle se divise, est dans la ligne, avec `event` `end` seulement (SPEC 4.3). Bord droit collé d'un autre bloc qu'une course, `keep: 'duration'` : le champ de son bord droit reste et le départ est résolu pour que son événement de fin tombe sur la cible, par soustraction pour un jeu au pied, un regroupement et une séquence, par point fixe sur le lâcher pour une passe ; départ calculé avant sa borne (0 ou embranchement) : départ à la borne, arrivée en retard, alerte de retard, sans solveur (SPEC 5.8).
  - **Précisions prises en écrivant les SPEC 6 à 12**, validées par l'utilisateur le 04/11 :
    - une nouvelle course posée dans une option pendant une course du tronc encore en cours ne la coupe pas, car elle continue dans toutes les options : elle suit le repli des chevauchements ; l'alerte « départ retardé de x s » indique le moyen de choisir le cap dans l'option : couper la course du tronc à l'embranchement (SPEC 6.2) ;
    - proposition d'un regroupement : clic sur une joueuse ; formation collée à la fin de sa course en cours au curseur ou qui y démarre, ou à sa prochaine réception si elle est plus tardive ; sans course ni réception à venir, au curseur ; refus avec message si elle n'a pas le ballon à la formation (SPEC 6.2, 10.3) ;
    - passe en attente : sans réception tracée, elle reste à l'instant du curseur, ignorée et signalée, jusqu'à ce qu'une réception la colle (SPEC 6.2) ;
    - « Couper la course ici », dans l'inspecteur : au point de passage sélectionné, sinon au curseur (SPEC 6.5) ;
    - « Créer une option » sur un embranchement existant : une sœur vide. « Dupliquer » : copie des actions et des séquences, sans les embranchements de l'option. Créer un embranchement avant un embranchement existant fait passer ses options dans l'option A (SPEC 6.4) ;
    - libellés de l'inspecteur pour `keep` : « Le bloc glisse », « Le bloc s'étire » ; écart d'un collage nommé « Écart » hors passe et jeu au pied (SPEC 6.5) ;
    - SPEC 13 : « Lien de synchronisation » devient « Trait de collage », dans les conventions de tracé ; le plan donnait la section 13 comme inchangée, son Grep ne cherchait pas « lien ».
  - **Statuts** : remplace D-012, D-106, D-108 (le solveur reste : D-129, D-130), D-109, D-113. Remplace en partie D-009, D-010, D-013, D-015, D-094, D-104, D-107, D-110 (la tolérance reste), D-120, D-121, D-122 (ligne de la SPEC 2), D-133 (migration ; l'allure saisie reste). Précise D-003, D-011, D-014, D-026, D-038, D-044, D-048, D-058, D-060, D-062, D-063, D-072, D-075, D-079, D-081, D-082, D-083, D-085, D-095, D-101, D-119, D-128, D-129, D-131, D-136.
- Raison : les frontières entre temps obligent à des mécanismes de rattrapage (« Finit lancée » et sa recompilation, liens « Caler sur… », lâcher à la réception) ; une frise continue et un seul collage les remplacent. Les combinaisons existantes sont jetables : une migration coûterait plus qu'elle ne rapporte.
- Alternatives écartées : garder les temps et leurs mécanismes ; migrer les combinaisons existantes (point 9) ; garder `at` sur les courses (un bloc n'a que deux bords) ; une vignette par ligne sans séquence (l'arbre de vignettes de D-063 serait perdu) ; garder la liste des actions à côté de la frise ; Maj pour décaler ce qui suit (pris par la sélection).
- Origine : décision de l'utilisateur du 03/11 (points 1 à 10) ; hypothèses et questions du plan `docs/archive/plans/frise-spec.md`, validé le 03/11. Conséquences d'écriture et précisions de 4.3 et 5.8 validées le 04/11, avec la lecture des décisions précisées ; les précisions prises en écrivant les SPEC 6 à 12 ont été validées le 04/11, à la relecture de la PR #10, avec les retouches reportées ci-dessus.

## Lot frise-1

Plan : `docs/plans/lot-frise-1.md`, validé le 4 novembre 2026 : recommandations de Q1 à Q14 acceptées, avec 5 précisions (Q7, Q10, Q12, Q13, Q14) et 4 corrections de l'utilisateur. La question Qn de ce plan donne D-(139 + n). Origine commune : réponses de l'utilisateur du 04/11.

### D-140 : v5 écrite à côté de la v4, bascule en C4
- Date : 2026-11-04
- Décision : modèle, moteur, rendu, exports, lecteur, éditeur, `io` et état v5 sont écrits dans `src/v5/`, avec leurs tests ; seuls les modules qui dépendent du type `Play` v4 y sont réécrits ou copiés. La v4 reste intacte et l'application tourne dessus jusqu'à la bascule (bloc C4) : suppression des modules v4, `git mv` de `src/v5/*` à leur place, portage de l'interface. Blocs : A, B1, B2, C1 à C5. De C4 à C5 seulement, les e2e pas encore portés sont dans `e2e/a-porter/`, ignorés par un `testIgnore` provisoire de `playwright.config.ts`, retiré en C5, et inscrits dans « Écarts connus » d'ETAT. Aucune exclusion de `tsc`, d'ESLint ni de Vitest : ces specs restent compilées et lintées.
- Raison : `npm run check`, les e2e et la CI restent verts à chaque étape sur tout le code, alors que le type `Play` touche 122 fichiers ; une pause est sans risque ; le moteur v4 reste disponible pour comparer jusqu'en C4. Coût accepté : copies temporaires, `check` plus lent de A à C3.
- Alternatives écartées : v5 à côté en A et B seulement, puis bascule dès C1 avec une liste d'exclusions (`check` partiel, application non lançable et CI rouge de C1 à C3).
- Origine : Q1 et correction 1 du plan ; piste de l'utilisateur, étendue.

### D-141 : SPEC 6.3 appliquée dès frise-1
- Date : 2026-11-04
- Décision : à l'arrêt, le terrain montre et édite l'instant du curseur temporel : jetons à `t`, trajectoires de l'intervalle en plein, antérieures en grisé, ultérieures absentes ; nouvelles actions au curseur ; placements seulement à `t = 0`. Exception assumée à la règle 4 de `CLAUDE.md` : l'index de la SPEC place 6.3 en frise-2, qui garde le reste de 6.1 à 6.5.
- Raison : sans temps, l'édition « au début du temps sélectionné » n'a plus de sens.
- Alternatives écartées : édition à `t = 0` seulement, départ réglé ensuite dans l'inspecteur (pas de pose à un autre instant, course tracée depuis la mauvaise position).
- Origine : Q2.

### D-142 : liste « Ligne », sans création de branche ni de séquence en frise-1
- Date : 2026-11-04
- Décision : une liste « Ligne » dans la barre de lecture, masquée s'il n'y a qu'une ligne, choisit la ligne lue, affichée et éditée. Les exports gardent leurs choix actuels (enchaîné, une par option). Branches et séquences sont lues depuis un fichier importé et créées à partir de frise-2. Conséquence acceptée : le site ne crée pas d'option et ne saisit pas de consigne entre frise-1 et frise-2.
- Raison : les embranchements et séquences éditables appartiennent à frise-2 (règle 4 de `CLAUDE.md`).
- Alternatives écartées : création minimale d'options dans l'inspecteur, avec ou sans les séquences (commandes et e2e en plus, pour un seul lot).
- Origine : Q3.

### D-143 : collages posés par les outils, réglés dans l'inspecteur, en frise-1
- Date : 2026-11-04
- Décision : les outils posent les collages de 6.2 (course sur la fin de la précédente, passe et jeu au pied à la réception, regroupement). L'inspecteur montre la cible, « Décoller », l'écart et `keep`. Pas de pose à la main avant frise-2 ; « Caler sur… » disparaît : pas de rendez-vous réglé entre-temps, sauf par « Départ » et « Durée ».
- Raison : la pose à la main passe par la frise (5.8) ; porter « Caler sur… » vers les collages serait du code à jeter au lot suivant.
- Alternatives écartées : garder « Caler sur… » jusqu'à frise-2 (`syncPick`, `SyncBanner` et un test e2e à porter pour un seul lot).
- Origine : Q4.

### D-144 : « Couper la course ici » et coupe à la pose en frise-2
- Date : 2026-11-04
- Décision : ni commande, ni bouton, ni coupe par l'outil Course en frise-1. Curseur pendant une course de la joueuse : repli de 4.3 (départ retardé, alerte). Le test D-139 Q4 construit ses deux courses à la main.
- Raison : SPEC 6.2 et 6.5 sont codées en frise-2 ; le test d'écart n'a pas besoin de la commande.
- Alternatives écartées : commande et bouton dès frise-1, coupe à la pose en frise-2.
- Origine : Q5.

### D-145 : liste des actions de toute la ligne en frise-1
- Date : 2026-11-04
- Décision : jusqu'à son retrait en frise-2 (6.7), la liste montre toutes les actions de la ligne affichée, triées par départ, en instants absolus, avec des barres sur la durée de la ligne et l'action en cours au curseur marquée. Clic : sélection, et curseur amené au départ de l'action s'il est hors de son intervalle. Survol, Suppr et pastilles inchangés.
- Raison : seule vue d'ensemble tant que la frise n'existe pas.
- Alternatives écartées : les actions de l'intervalle au curseur (presque toujours la même liste, qui saute à l'embranchement) ; retrait dès frise-1 (plus de sélection hors du terrain).
- Origine : Q6.

### D-146 : « Bord précédent » et « Bord suivant », provisoires
- Date : 2026-11-04
- Décision : **décision provisoire, remplacée en frise-3** par les précédent et suivant de SPEC 7, avec une nouvelle entrée qui la citera. D'ici là, « Temps précédent » et « Temps suivant » deviennent « Bord précédent » et « Bord suivant » : saut au bord de bloc voisin sur la ligne. « Pause entre les temps » est retirée jusqu'à frise-3. « S'arrêter aux options » et les boutons d'option restent.
- Raison : il faut amener le curseur exactement à la fin d'une course pour y coller la suivante (6.2), et le curseur natif ne s'aimante pas avant frise-2.
- Alternatives écartées : précédent et suivant de SPEC 7 dès frise-1, plus « Aller à la fin » dans l'inspecteur (anticipe frise-3) ; coller l'outil Course à moins de 0,25 s de la fin (s'écarte de 6.2).
- Origine : Q7 et sa précision.

### D-147 : nouvelle combinaison depuis un modèle, branche racine seule
- Date : 2026-11-04
- Décision : une branche racine, ni action ni séquence, comportement de 6.6 inchangé ; `presetPreviewPlay` suit. Toute pose de modèle ramène le curseur à `t = 0`.
- Raison : c'est l'équivalent du retour au premier temps : le terrain montre les placements que la pose modifie.
- Alternatives écartées : ne pas ramener le curseur (le modèle change les placements de `t = 0` sans que le terrain le montre).
- Origine : Q8.

### D-148 : e2e sans temps, reports limités à frise-2
- Date : 2026-11-04
- Décision : les e2e passant par un « Temps 2 » sont réécrits en C5. Scénario à options par import de `e2e/fixtures/options.combi.json` ; `buildScenario` trace une ligne sans option. Réécrits : `folder`, `degraded`, `export-gif`, `export-pdf`, `export.firefox`, `breakdown-kick`, `actions-list`, `interface`, `field-stability`, `space`, `run-speeds`. Reportés à frise-2, inscrits dans ETAT : « Caler sur… » de `run-speeds`, partie arbre et création d'option de `interface` et `field-stability`. Les specs de refus v4 sont aussi écrites en C5.
- Raison : garder le filet pendant frise-1 ; ne reporter que ce qui n'existe plus avant frise-2.
- Alternatives écartées : réduction à un parcours de base (moins de filet, plus de travail en frise-2).
- Origine : Q9 et correction 3 du plan.

### D-149 : tolérance du test d'écart au point de coupe
- Date : 2026-11-04
- Décision : virage jusqu'à 45° : écart de trajectoire <= 0,5 m, instant au point de coupe et à l'arrivée <= 0,25 s. Ligne droite : <= 0,01 m et 0,02 s. Seuils en constantes du test, commentées `HYPOTHÈSE` : ce sont des estimations, pas encore des mesures. Dépassement : arrêt et mesure donnée à l'utilisateur, jamais de seuil relâché seul.
- Raison : 5.8 dit le résultat proche mais pas identique ; un seuil fixé d'avance dit ce que « proche » veut dire.
- Alternatives écartées : mesurer d'abord sur 3 géométries, puis figer la mesure + 20 %.
- Origine : Q10 et sa précision.

### D-150 : mesure du temps de compilation
- Date : 2026-11-04
- Décision : `npm run bench` (`vitest bench`, hors CI) donne, v4 et v5 côte à côte jusqu'en C4, la compilation d'une ligne, puis le mouvement de glisser (point déplacé, toutes les lignes recompilées, comme `playIssues`). Cible 16 ms par mouvement ; au-delà de 33 ms, arrêt et question. Résultats dans ETAT, avec le nombre d'actions : `realisticRunsPlay()` en compte 18 en v5 contre 16 en v4 (deux `at` coupés). En CI, un test sans horloge : nombre de profils construits par compilation de cette combinaison, plafonné.
- Raison : 16 ms est une image à 60 Hz ; une assertion en millisecondes dépendrait de la machine, alors que le nombre de profils attrape la même dérive sans horloge.
- Alternatives écartées : bench seul, sans garde en CI ; assertion en millisecondes en CI (runner 2 à 3 fois plus lent, faux rouges).
- Origine : Q11 et correction 4 du plan.

### D-151 : combinaison v4 dans le stockage du navigateur
- Date : 2026-11-04
- Décision : signalée et laissée. Bibliothèque du mode dégradé : listée comme refusée, intacte, comme une entrée invalide. Cache de lecture : texte relu, même refus, remplacé quand le fichier change. Brouillon v4 : message une fois au démarrage, pas de restauration, pas d'effacement ; le message dit que le brouillon d'une version antérieure sera remplacé à la prochaine modification, car sa clé unique est alors réécrite. Précise D-139.
- Raison : lettre de 4.4 (« jamais modifiée ni déplacée, dans le stockage du navigateur ») ; seul le brouillon est réécrit, à un geste de l'utilisateur, et le message l'annonce.
- Alternatives écartées : brouillon v4 effacé au démarrage avec un message.
- Origine : Q12 et sa précision. Non intégrée (4.4) : `/fin-lot` l'intègre.

### D-152 : dépendances de l'arrivée d'une passe
- Date : 2026-11-04
- Décision : l'arrivée d'une passe ne dépend que de son lâcher et des courses de la passeuse et de la receveuse qui ne dépendent pas elles-mêmes de cette arrivée, directement ou par une chaîne de collages. Les vraies boucles restent refusées, par exemple une passe collée à la fin d'une course elle-même collée à l'arrivée de cette passe. Précise D-139.
- Raison : la phrase de 4.3 date d'une course par temps. Avec plusieurs courses par joueuse, « elle part à la réception puis enchaîne une 2e course collée » fermerait une boucle sans aucune dépendance réelle ; de même pour une passeuse qui repart à l'arrivée de sa propre passe.
- Alternatives écartées : lettre de la SPEC (cet enchaînement refusé comme cycle, départ réglé sans collage).
- Origine : Q13, ambiguïté relevée dans le plan. Non intégrée (4.3) : `/fin-lot` l'intègre.

### D-153 : embranchement après la dernière action
- Date : 2026-11-04
- Décision : en frise-1, lettre de 5.1 : la durée d'une ligne est la fin de sa dernière action, donc un embranchement situé après n'est jamais atteint en lecture et une option vide ne se lit pas. La reprise du GIF est bornée à la durée. Question inscrite dans « Questions ouvertes » d'ETAT, à reposer au `/nouveau-lot frise-2`.
- Raison : en frise-1, le cas n'arrive que par un fichier importé ; il devient courant en frise-2, avec l'option vide.
- Alternatives écartées : compter les embranchements dans la durée (change 5.1, à trancher par `/changement-spec`).
- Origine : Q14 et sa précision.
