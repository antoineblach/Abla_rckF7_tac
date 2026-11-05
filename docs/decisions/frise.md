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
- Remplacée par D-161 : les seuils en valeur absolue ne tiennent pas au-delà de 8 m de part et d'autre du point de coupe.
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

### D-154 : numéro de « Séquence n »
- Date : 2026-11-04
- Décision : le `n` du libellé calculé d'une séquence (4.1) est son rang dans le tableau `sequences`, à partir de 1, comme les lettres d'option suivent l'ordre de création (6.5). Il se recalcule après une suppression.
- Raison : la SPEC ne dit pas ce que compte `n`. Le rang dans le tableau ne dépend ni de la ligne affichée ni d'un collage résolu.
- Alternatives écartées : rang chronologique dans la ligne (le même bloc changerait de nom d'une ligne à l'autre, ou en déplaçant un bord).
- Origine : étape A, précision à contredire au besoin. Non intégrée (4.1) : `/fin-lot` l'intègre.

### D-155 : séquence dont la fin n'est pas après le début
- Date : 2026-11-04
- Décision : une séquence dont `end <= start`, sans bord collé, est signalée comme erreur (`sequenceEndBeforeStart`), et le moteur l'ignore (B1). Le fichier reste lisible. Un bord collé n'est pas contrôlé ici : sa valeur enregistrée n'est qu'un repli.
- Raison : la v4 portait une durée `> 0` par le schéma ; la v5 porte deux instants, et un intervalle de durée négative n'a pas de sens pour 5.1. Ni le schéma (fichier entier refusé) ni le silence ne conviennent.
- Alternatives écartées : refus par zod (fichier inutilisable pour une séquence) ; aucun contrôle (intervalles négatifs dans le moteur).
- Origine : étape A, précision à contredire au besoin. Non intégrée (4.3) : `/fin-lot` l'intègre.

### D-156 : validation sur les instants enregistrés, le moteur sur les instants résolus
- Date : 2026-11-04
- Décision : `validatePlay` compare les instants enregistrés et laisse de côté les bords collés et les embranchements collés, dont la valeur enregistrée n'est qu'un repli. Le moteur signale les mêmes cas sur les instants résolus, avec les mêmes codes (`startsBeforeBranch`, `startsAfterBranch`, `sequenceCrossesBranch`, `sequenceOverlap`, `branchAtNotIncreasing`), dédoublonnés par `issueKey`. Ces replis sont des avertissements : le moteur a une conduite définie (4.3). Les collages invalides restent des erreurs, comme les liens de la v4.
- Raison : la validation métier ne compile pas ; contrôler une valeur de repli donnerait de fausses alertes.
- Alternatives écartées : tout laisser au moteur (rien à la lecture d'un fichier, ni dans les tests du modèle).
- Origine : étape A.

### D-157 : `realisticRunsPlay` en v5
- Date : 2026-11-04
- Décision : le scénario suit la conversion du plan, avec deux écarts imposés par le modèle : la course de A7 est collée à l'arrivée de la passe qu'elle reçoit (au lieu du lâcher) et l'embranchement est collé à la fin de cette course. Le lâcher reste ainsi dans le tronc, avant l'embranchement ; la passe n'est pas en vol à l'embranchement ; la course qui prolonge A7 dans l'option A part sur l'embranchement, lancée. Les instants absolus reprennent ceux du moteur v4 quand ils restent valides ; le regroupement de l'option A passe à 8,5 s pour couper encore la course de A7. L'événement « lâcher d'une passe » reste couvert par `friseFixturePlay`.
- Raison : A7 finissant au lâcher, le lâcher tomberait sur l'embranchement (action du tronc signalée) ou la suite de A7 serait retardée par D-139 Q2 ; deux alertes parasites à chaque compilation du scénario de référence.
- Alternatives écartées : garder le lâcher avec un écart de 0,1 s (alerte « départ retardé » permanente) ; laisser la v4 telle quelle (T3 à 7,528 s : A7 s'arrête 1,4 s puis repart, sans lancée, comme en v4 où « Finit lancée » restait sans effet).
- Origine : étape A.

### D-158 : embranchement qui n'est pas après le précédent
- Date : 2026-11-04
- Décision : le moteur signale `branchAtNotIncreasing` sur les instants résolus (D-156) et garde cet embranchement à l'instant du précédent : une option ne démarre jamais avant un embranchement dont elle descend. Sans `branchAt` sur une branche qui se divise (`branchAtMissing`), ses options partent à l'embranchement précédent.
- Raison : 4.3 interdit le cas sans donner de repli, et le tronc commun (5.2) doit tenir dans un fichier modifié à la main.
- Alternatives écartées : prendre l'instant enregistré (une action d'option pourrait démarrer avant l'embranchement de son parent et changer le tronc).
- Origine : étape B1, précision à contredire au besoin. Non intégrée (4.3) : `/fin-lot` l'intègre.

### D-159 : lecture des intervalles dans le moteur
- Date : 2026-11-04
- Décision : 5.1 se lit sur les instants réels d'une ligne. Un trou compte toutes les actions de la ligne qui y démarrent, ignorées comprises (elles restent à sélectionner) et action du tronc partie après l'embranchement comprise, et une action retardée compte à son départ réel. Une séquence sans action reste un intervalle. Un instant dans un trou sans action n'a pas d'intervalle : au repos, tout ce qui précède est en grisé. Une action appartient à l'intervalle où elle démarre ; une action commencée avant reste antérieure, sa part restante dans une vignette (9.3) vient en frise-4. Le champ `current` des traces suit cette règle dès frise-1 ; le plan place « traces appuyées par intervalle » en frise-3, qui garde les calques et leur rendu : le champ existait déjà pour les temps, et un `current` constant serait à retirer au lot suivant.
- Raison : l'éditeur (6.3, D-141) a besoin de cette appartenance dès frise-1 ; une seule fonction évite deux lectures de 5.1.
- Alternatives écartées : `current` toujours vrai jusqu'à frise-3 (l'option d'un fichier importé ne se distinguerait plus du tronc, recul sur la v4).
- Origine : étape B1, précision à contredire au besoin. Non intégrée (5.1) : `/fin-lot` l'intègre.

### D-160 : course d'une participante à l'instant de la formation ou de la sortie
- Date : 2026-11-04
- Décision : une course d'une participante qui démarre à l'instant exact de la formation est « pendant le regroupement » : retardée à la sortie de balle, avec l'alerte. Une course qui démarre à l'instant exact de la sortie, ou après, n'est pas retardée. Les courses ignorées de la v4 (`ignoredRuns`) disparaissent.
- Raison : 5.3 dit « pendant ». La v4 ignorait déjà une course partant à la formation ; la participante est retenue jusqu'à la sortie, et le relayeur devient porteuse à cet instant.
- Alternatives écartées : laisser partir la course à la formation (arrêtée aussitôt, de durée nulle).
- Origine : étape B1, précision à contredire au besoin. Non intégrée (5.3) : `/fin-lot` l'intègre.

### D-161 : seuils de l'écart au point de coupe, relatifs à la longueur
- Date : 2026-11-04
- Décision : remplace D-149. Virage jusqu'à 45° : écart de trajectoire <= 5 % de la longueur de la course, instant au point de coupe <= 0,25 s, instant à l'arrivée <= 0,4 s. Ligne droite : <= 0,01 m et 0,03 s. Constantes de `cut.test`, commentées `HYPOTHÈSE`. Géométries : 5/5 à 20/20 m, 20/10, 10/20, 30/10, 10/30 m, à la marche, au trot et au sprint.
- Raison : mesures à 45° contre une course entière. Trajectoire : 5/5 m 0,26 ; 8/8 m 0,42 ; 10/10 m 0,53 ; 20/20 m 1,05 ; 10/30 m 1,99 m. Elle est proportionnelle aux longueurs (2,6 à 5 %), car la première course coupée est droite et la seconde suit le raccord de 5.2 : un seuil en mètres ne dit rien. Instant au point de coupe : <= 0,09 s. Instant à l'arrivée : jusqu'à 0,39 s (10/30 m, sprint). Ligne droite : trajectoire nulle, instants <= 0,001 s. Comparé une fois au rendez-vous de la v4 sur une seule course (hors test, la v4 disparaît en C4) : instant de coupe nul, arrivée <= 0,23 s en virage, <= 0,024 s en ligne droite. Le comportement ne change pas et reste conforme à 5.2 et 5.8 (« proche, pas identique »).
- Alternatives écartées : garder les seuils en bornant le test à 8 m de part et d'autre du point de coupe (l'écart au-delà n'est plus couvert) ; garder sa courbe d'origine à la première course coupée, par `/changement-spec` (contredit « la course précédente ne change pas » de 5.2 et demande une donnée de plus dans le modèle).
- Origine : dépassement constaté en B2, mesures données à l'utilisateur, réponse du 04/11.

### D-162 : résolution des collages sur tout l'arbre, une fois par combinaison
- Date : 2026-11-04
- Décision : `resolvePlay` parcourt les branches de la racine aux feuilles et résout chaque bord une seule fois, dans sa branche, avec les actions de cette branche et de ses ancêtres ; le résultat est partagé par toutes les lignes et mis en cache. Une simulation n'est refaite que si le bord précédent a changé ce qu'elle lit. Dans le graphe, un point de passage se lit comme la fin de la course. Ordre : celui des dépendances (4.3) ; là où il laisse le choix, la course précédente de la joueuse, l'événement de ballon précédent et le regroupement qui peut arrêter une course passent d'abord, sans jamais faire un cycle. Un regroupement dont la formation reste à résoudre est absent des simulations.
- Raison : le tronc est identique par construction et le budget se mesure sur toutes les lignes (D-150). À son instant enregistré, une formation arrêterait les courses de ses participantes : un regroupement collé à la fin d'une course de la plaquée ne suivrait plus cette course quand elle s'allonge. Les autres blocs restent à leur valeur enregistrée, comme le dit 5.8.
- Alternatives écartées : résoudre ligne par ligne (tronc recalculé pour chaque ligne) ; un point fixe sur tous les bords (5.8 fixe un seul passage).
- Origine : étape B2, précision à contredire au besoin. Non intégrée (5.8) : `/fin-lot` l'intègre.

### D-163 : passe reçue par une course collée à son arrivée
- Date : 2026-11-04
- Décision : le bord droit de la course de la receveuse lit le lâcher et les courses de la passeuse, l'arrivée de la passe lit la course de la receveuse (4.3). Quand elle atteint son point à l'heure, sans écart, la passe arrive à cet instant et à ce point, sans point fixe. Si elle ne peut pas y être, la passe suit le point fixe de 5.4.
- Raison : 5.8 dit que la passe arrive au point de rendez-vous quand elle y arrive. Avec une receveuse lancée à ce point, les 5 itérations de 5.4 laissent 4 ms et 4 cm d'écart, et ce qui est collé à l'arrivée se décale d'autant.
- Alternatives écartées : garder le seul point fixe (rendez-vous inexact) ; augmenter ses itérations pour toutes les passes (D-037).
- Origine : étape B2, précision à contredire au besoin. Non intégrée (5.4) : `/fin-lot` l'intègre.

### D-164 : seconde passe de la lancée
- Date : 2026-11-04
- Décision : une course dont aucune suivante collée ne part réellement à sa fin, dans aucune ligne, freine normalement et ne redevient jamais lancée : la suivante part à l'embranchement après sa fin (5.2), mais aussi retardée par un chevauchement, par un regroupement, ou par D-139 Q2. Tout cela se règle dans la même et unique seconde passe. Une course du tronc arrêtée par le regroupement d'une seule option reste lancée si une autre option la prolonge. Le premier embranchement nommé par `runNotContinued` est le premier de la ligne qui s'écarte des courses qui la prolongent.
- Raison : 5.2 ne cite que l'embranchement et le regroupement ; les autres cas ont la même lecture (« elle n'est pas prolongée »), et une lancée sans suite serait un arrêt net sans raison. Le tronc reste identique entre les options.
- Alternatives écartées : une seconde passe par cause ; garder lancée une course dont la suivante part plus tard (arrêt net, sans aucune option en cause).
- Origine : étape B2, précision à contredire au besoin. Non intégrée (5.2) : `/fin-lot` l'intègre.

### D-165 : bord gauche seul d'une séquence
- Date : 2026-11-04
- Décision : la fin d'une séquence étant un instant, son bord gauche collé déplace son début et sa fin reste (D-139 Q6, l'autre bord ne bouge pas). Si le début résolu atteint la fin, la séquence est ignorée et signalée (`sequenceEndBeforeStart`). Précise D-155, qui laissait ce cas de côté.
- Raison : 4.1 porte deux instants ; aucun champ de durée à garder.
- Alternatives écartées : faire glisser la séquence entière (autre règle que le bord gauche de D-139 Q6).
- Origine : étape B2, précision à contredire au besoin. Non intégrée (5.8) : `/fin-lot` l'intègre.

### D-166 : alerte d'un ballon plus lent que sa receveuse
- Date : 2026-11-04
- Décision : pour toute passe appliquée, la vitesse de la receveuse est lue à 9 instants régulièrement répartis sur le vol ; au-dessus de la vitesse du ballon : `ballSlowerThanReceiver`, un avertissement. Codes des collages : `glueCycle`, `glueTargetUnreached` (erreurs), `glueStartedLate` (« il aurait fallu partir x s plus tôt »), `glueArrivesLate` (retard en secondes), avertissements.
- Raison : 5.4 demande le signalement sans dire comment le mesurer ; la vitesse de la receveuse varie pendant le vol.
- Alternatives écartées : ne comparer qu'à l'arrivée (une receveuse qui freine à son point échapperait à l'alerte).
- Origine : étape B2, précision à contredire au besoin. Non intégrée (5.4) : `/fin-lot` l'intègre.

### D-167 : bords de bloc et embranchements dans le lecteur de frise-1
- Date : 2026-11-05
- Décision : « Bord précédent » et « Bord suivant » (D-146) parcourent les débuts et fins réels des blocs de la ligne, plus 0 et la durée ; un instant au-delà de la durée n'est pas un bord ; un embranchement n'en est pas un en lui-même. En lecture, « S'arrêter aux options » s'arrête à un embranchement situé exactement à la fin de la ligne, jamais à un embranchement situé après (D-153), ni à celui d'où la lecture repart.
- Raison : D-146 parle de bord de bloc ; D-153 ne traite que de l'embranchement situé après la dernière action, et celui situé exactement à la fin est atteint.
- Alternatives écartées : ajouter les embranchements aux bords (c'est le précédent et suivant de frise-3) ; ne pas s'arrêter à la fin de la ligne (une option vide ne proposerait jamais ses boutons).
- Origine : étape C1, précision à contredire au besoin. Provisoire comme D-146 pour les bords ; l'arrêt à la fin de la ligne est à revoir avec la question ouverte de D-153, au `/nouveau-lot frise-2`.

### D-168 : vignette du PDF et en-tête du GIF en frise-1
- Date : 2026-11-05
- Décision : sous la vignette d'une ligne, ses options en gras, repliées sur 3 lignes au plus, rien pour une combinaison à une seule ligne ; pas de consigne avant frise-4. La vignette garde les conventions de l'écran : ligne d'avantage à `t = 0`, partie d'une course ignorée après une formation en couleur d'erreur. En-tête du GIF : une option au libellé saisi le donne tel quel, « Sortie de mêlée, Par-dessus » ; sans libellé, « Sortie de mêlée, option B » (9.2). Une image placée après la fin de la dernière séquence n'a ni libellé de séquence ni consigne.
- Raison : le plan dit « légende : options de la ligne » sans régler sa longueur, et une option imbriquée ne tient pas toujours sur une ligne à 60 mm ; 9.2 ne traite pas du libellé saisi.
- Alternatives écartées : couper la légende par des points de suspension (perd la dernière condition) ; ajouter les consignes de la ligne sous la vignette (il en faudrait plusieurs, c'est le PDF en arbre de frise-4).
- Origine : étape C1, précision à contredire au besoin. Partie GIF (libellé saisi, image après la dernière séquence) intégrée à 9.2 par `/fin-lot` ; partie PDF provisoire jusqu'à frise-4.

### D-169 : lâcher collé absent des simulations tant qu'il n'est pas résolu
- Date : 2026-11-05
- Décision : pendant la résolution des collages, une passe ou un jeu au pied dont l'instant reste à résoudre (bord gauche collé, ou bord droit qui le fait glisser) est absent des simulations, comme un regroupement (D-162). Précise D-162.
- Raison : à son instant enregistré, un lâcher pouvait être simultané avec sa propre cible, ou prendre le ballon avant elle : la cible n'était plus jamais atteinte et la passe était ignorée. Vu en C2 sur « une réception tracée ensuite la colle », où le lâcher en attente et la réception sont au même instant ; le même défaut apparaissait dès qu'un lâcher collé gardait une valeur enregistrée périmée, par exemple après avoir déplacé la passe précédente.
- Alternatives écartées : mettre à jour le `start` enregistré à la pose (ne règle ni les chaînes posées à l'envers, ni une valeur devenue périmée) ; ne plus compter un lâcher sans ballon parmi les passes simultanées (change la règle de 4.3, et ne règle pas le lâcher qui prend le ballon).
- Origine : étape C2, correction du moteur de B2, précision à contredire au besoin.

### D-170 : gel d'un bord collé
- Date : 2026-11-05
- Décision : « Décoller » et la suppression d'une cible ou d'un point cible donnent au bord les valeurs résolues : `start`, le champ adapté (`ballSpeed`, `flightTime`, `duration`), `durationOverride` pour une course dont le solveur a réglé la durée, début et fin d'une séquence, instant d'un embranchement. Un bord qui ne s'applique pas (cible jamais atteinte, avant le départ, cycle) garde ses valeurs enregistrées. Un bloc aux deux bords collés dont on retire le gauche passe en `keep: 'start'`. La commande dit combien de bords sont gelés, pour le message (C3). « Départ » est sans effet sur une action dont un collage calcule le départ (6.5). Limite : décoller le bord gauche d'une course lancée laisse la précédente freiner (5.2) ; elle finit plus tard, et la course décollée attend sa fin, avec l'alerte « départ retardé ». Le bloc bouge alors de la durée du freinage.
- Raison : 5.8 demande que le bloc ne bouge pas. Sans `keep: 'start'`, le bloc se mettrait à glisser ; pour la lancée, 5.2 est sans exception et l'alerte dit ce qui se passe.
- Alternatives écartées : garder la précédente lancée (drapeau retiré par D-139) ; avancer le départ de la course décollée (elle chevaucherait la précédente).
- Origine : étape C2, précision à contredire au besoin.

### D-171 : pose au curseur par les outils
- Date : 2026-11-05
- Décision : précisions de 6.2.
  - Curseur « sur la fin » d'une course ou sur une réception : à moins de 0,005 s, la moitié du pas du curseur (HYPOTHÈSE).
  - Passe et jeu au pied : la sortie d'un regroupement que la passeuse relaie compte comme une réception (5.4). Curseur sur une réception de la passeuse : lâcher collé à cette réception, écart 0, alors qu'elle a déjà le ballon ; la passe suit si la réception bouge ensuite. Écart à la lettre de 6.2 (« lâcher au curseur »), qui reste valable hors d'une réception ; sur un ramassage, lâcher au curseur, non collé.
  - Une réception hors de la branche de la nouvelle action et de ses ancêtres n'est pas une cible (4.3) : elle ne compte pas, et la passe reste au curseur.
  - Une réception encore ignorée est une cible : on peut tracer une chaîne de passes en commençant par la fin.
  - Une réception tracée ensuite colle la première passe de sa receveuse ignorée faute de ballon, non collée et dont l'instant n'est pas après l'arrivée ; une seule par réception.
  - Regroupement : la course « en cours » comprend l'instant de sa fin ; un ramassage n'est pas une réception : sans course ni réception, formation au curseur, refusée si elle n'a pas le ballon.
  - Sélection : les actions en grisé se sélectionnent, après celles de l'intervalle, sans leurs poignées (6.3).
- Raison : 6.2 laisse ces cas ouverts. Le curseur avance par pas de 0,01 s : sans tolérance, il ne tomberait presque jamais sur la fin d'une course. « Bord suivant » (D-167) amène le curseur exactement sur une arrivée de passe : c'est le geste courant pour enchaîner, et une passe non collée ne suivrait pas la réception.
- Alternatives écartées : lâcher au curseur, non collé, sur une réception (lettre de 6.2 ; la passe ne suit plus) ; placer la nouvelle action dans la branche de la réception (contredit 6.3).
- Origine : étape C2, précision à contredire au besoin. Curseur sur une réception : choix d'Antoine du 05/11.
