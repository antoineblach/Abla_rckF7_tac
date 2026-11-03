# Décisions du lot 3

Index, règles du journal et mode de lecture : [README.md](README.md).

## Lot 3 : mise en place

Les entrées D-078 à D-093 reprennent les réponses aux questions Q1 à Q19 du plan du lot 3 (`docs/archive/plans/lot-3.md`, section 12), données le 16 octobre 2026.

### D-078 : rôles de défense d'un regroupement
- Date : 2026-10-16
- Décision : un regroupement n'enregistre que `contest` (absent = « Par défaut », réglage de défense du lot 4 ; « Garde » ; « Gratteur »). Le plaqueur et la joueuse au ras restent désignés par la simulation du lot 4 (SPEC 11.4).
- Raison : le type `BreakdownAction` de SPEC 10.3 ne stocke que `contest` ; le prompt demande seulement d'enregistrer ces rôles, sans simulation.
- Alternatives écartées : `tacklerId` et joueuse au ras choisis à la main.
- Origine : réponse de l'utilisateur (Q1).

### D-079 : participantes d'un regroupement
- Date : 2026-10-16
- Décision : la plaquée et le soutien s'immobilisent là où leurs courses les ont amenées à la formation (aucune position de soutien inventée). Le relayeur rejoint en ligne droite, au sprint des réglages, le point situé 1 m derrière le ballon du côté de l'équipe de la plaquée, puis attend ; trop loin pour arriver avant la sortie de balle, il arrive exactement à la sortie (vitesse augmentée), avec une alerte. Les courses des trois participantes s'arrêtent à la formation ; la partie ultérieure est ignorée, dessinée en rouge et signalée ; leur jeu après la sortie se dessine dans le temps suivant, une passe ou un jeu au pied du relayeur après la sortie restant possible dans le même temps. Un regroupement dont la plaquée n'a pas le ballon à la formation est entièrement ignoré et signalé, comme une passe (D-013), sans recalage de la ligne d'avantage.
- Raison : SPEC 10.3 ne déplace que le relayeur et ne dit rien des courses en conflit ni du regroupement sans ballon.
- Alternatives écartées : soutien amené par le moteur contre la plaquée ; relayeur à vitesse constante sur toute la durée.
- Origine : réponse de l'utilisateur (Q2, Q3, Q4).
- Précisée par D-130 (relayeur trop loin : même solveur et même bascule que les courses).

### D-080 : maul
- Date : 2026-10-16
- Décision : au lot 3, un maul se comporte comme un ruck et reste immobile ; seul `kind` change (lignes de hors-jeu du lot 4).
- Raison : SPEC 10.3 (« même composition ») et la recette (« même comportement ») ne prévoient aucune avancée.
- Alternatives écartées : maul qui avance.
- Origine : réponse de l'utilisateur (Q5).

### D-081 : pose d'un regroupement
- Date : 2026-10-16
- Décision : outil « Regroupement » ; clic sur une joueuse qui a le ballon dans le temps affiché ; instant de formation par défaut : fin de sa course dans le temps, ou l'instant où elle reçoit le ballon s'il est plus tard ; soutien = la coéquipière la plus proche à cet instant, relayeur = la deuxième ; ruck par défaut ; refus avec message si elle n'a pas le ballon dans ce temps ou a moins de deux coéquipières.
- Raison : SPEC 10.3 dit « les deux coéquipières les plus proches » sans dire laquelle est le soutien ni à quel instant.
- Alternatives écartées : aucune proposée.
- Origine : réponse de l'utilisateur (Q6).

### D-082 : ligne d'avantage en mode schéma
- Date : 2026-10-16
- Décision : le mode schéma (éditeur, vignettes, PDF) montre la ligne d'avantage en vigueur au début du temps affiché, recalée par les regroupements formés avant ce début ou à cet instant. En lecture, elle est recalée à chaque formation (SPEC 5.6).
- Raison : la ligne d'avantage devient variable dans le temps ; le mode schéma montre un temps à l'arrêt.
- Alternatives écartées : aucune proposée.
- Origine : réponse de l'utilisateur (Q7).

### D-083 : ballon au sol et ramassage
- Date : 2026-10-16
- Décision : le ballon au sol est ramassé par la première joueuse de l'une ou l'autre équipe qui passe à moins de 1 m, qui devient porteuse (même adverse) ; il reste immobile au point d'impact ; la recherche part de l'impact et continue dans les temps suivants ; sinon il reste au sol. Le ballon au sol au départ (D-007) devient éditable et suit la même règle à partir de t = 0. Un jeu au pied vers une adversaire ne donne aucune alerte.
- Raison : SPEC 10.4 ne précise ni l'équipe de la joueuse qui ramasse ni la durée de la recherche ; D-007 renvoyait le ballon au sol au lot 3.
- Alternatives écartées : ramassage limité à l'équipe qui attaque.
- Origine : réponse de l'utilisateur (Q8).

### D-084 : conventions graphiques du lot 3
- Date : 2026-10-16
- Décision : jeu au pied : vol rectiligne vu de dessus en tirets longs ; le ballon reste sur la trajectoire et grossit selon une parabole jusqu'à 1,8 au milieu du vol ; ombre au sol en ellipse grise pleine, décalée vers le bas à droite de l'image proportionnellement à la hauteur (confondue avec le ballon au départ et à l'arrivée) ; petit cercle sur un point visé. Regroupement : contour circulaire de 2 rayons de jeton autour du point, libellé « Ruck » ou « Maul », pendant toute sa durée en lecture, et au point de formation en mode schéma. En-avant : pastille ronde jaune à « ! » noir au milieu de la passe, noire à « ! » blanc en N&B.
- Raison : SPEC 10.4 et 10.5 décrivent ces éléments sans en fixer le dessin ; aplats seulement (3.3).
- Alternatives écartées : ombre sous le ballon (invisible) ; ballon décalé de la trajectoire.
- Origine : réponse de l'utilisateur (Q9).

### D-085 : calque « En-avant »
- Date : 2026-10-16
- Décision : calque du lecteur, par poste, activé par défaut ; l'éditeur (mode schéma) montre toujours l'icône. Le sens d'attaque retenu est celui de l'équipe de la passeuse ; la vitesse de la passeuse est sa dérivée à gauche au lâcher (la vitesse qu'elle avait en lâchant), lue sur le temps parent pour un lâcher au tout début d'un temps.
- Raison : SPEC 5.7 et 10.5 ne précisent ni le sens d'attaque d'une défenseure qui passe ni la vitesse à retenir à un changement de course.
- Alternatives écartées : dérivée centrée (moitié de la vitesse au dernier pas d'une course).
- Origine : réponse de l'utilisateur (Q10, pour l'éditeur et le lecteur).

### D-086 : aucune alerte d'en-avant dans les exports
- Date : 2026-10-16
- Décision : l'icône d'en-avant n'apparaît jamais dans les exports, ni GIF ni PDF, quel que soit le calque du lecteur. Exception à D-068 (le GIF reprend les calques du lecteur, sauf celui-ci). Les vignettes de la bibliothèque ne la montrent pas non plus. SPEC 10.5 et `RECETTE.md` (« visible dans les exports ») seront corrigées en fin de lot.
- Raison : c'est une aide pour le coach, pas une information pour les joueuses.
- Alternatives écartées : PDF qui suit le calque du lecteur (proposition) ; icône toujours présente dans le PDF ; case dans le dialogue PDF.
- Origine : réponse de l'utilisateur (Q11).

### D-087 : type du modèle et catégorie
- Date : 2026-10-16
- Décision : appliquer un modèle met la catégorie de la combinaison à : mêlée → mêlée, touche → touche, renvoi → coup d'envoi/renvoi, ruck → ruck/jeu courant ; un modèle libre la laisse inchangée. Aucun nouveau champ : le lot 4 lira la catégorie et les regroupements comme type de lancement.
- Raison : SPEC 10.1 (« le type du modèle fixe le type de lancement de la combinaison ») sans champ prévu dans `Play`.
- Alternatives écartées : catégorie inchangée au lot 3 ; champ dédié.
- Origine : réponse de l'utilisateur (Q12).

### D-088 : ancre et côté ouvert
- Date : 2026-10-16
- Décision : l'aimantation de l'ancre est toujours active, indépendamment du bouton « Grille 1 m » : grille de 1 m pour mêlée, ruck et libre ; renvoi : centre de la médiane ou l'une des deux lignes des 22 m (y sur la grille) captés à moins de 3 m (HYPOTHÈSE), sinon grille ; touche : ligne de touche la plus proche, x sur la grille, refus à moins de 5 m d'une ligne de but. Côté ouvert : par défaut le côté le plus large depuis l'ancre, au centre exact à droite de l'équipe qui attaque ; choix « Auto, Gauche, Droite » (vus par l'équipe qui attaque, face à la ligne de but adverse) à l'enregistrement comme à la pose ; touche : toujours vers l'intérieur, sans choix.
- Raison : SPEC 10.1 ne fixe ni la distance de capture du renvoi ni le cas du centre exact.
- Alternatives écartées : aimantation liée au bouton de grille.
- Origine : réponse de l'utilisateur (Q13, Q14).

### D-089 : enregistrer un modèle
- Date : 2026-10-16
- Décision : rôle selon l'équipe (l'équipe qui attaque = attaque) ; case « Inclure le ballon », cochée quand le placement entier est enregistré ou que la porteuse est sélectionnée ; numéros en double (D-016) : la k-ième position d'un numéro va à la k-ième joueuse de ce numéro ; joueuses créées : couleur d'équipe, défense manuelle ; l'exclusion des défenseures auto (SPEC 10.1) relève du lot 4.
- Raison : SPEC 10.1 ne précise ni le ballon d'une sélection ni les numéros en double.
- Alternatives écartées : aucune proposée.
- Origine : réponse de l'utilisateur (Q15).

### D-090 : déplacer, retourner une combinaison
- Date : 2026-10-16
- Décision : « Déplacer » = translation par deux clics (départ, arrivée) ; « Retourner » = symétrie gauche-droite par rapport à l'axe du terrain (y devient largeur − y), sens d'attaque inchangé. Les deux s'appliquent aux placements de départ, au ballon au sol, aux points de passage, aux points visés au pied et au cadre libre de la vue enregistrée.
- Raison : SPEC 10.2 ne précise ni l'axe de symétrie ni le geste.
- Alternatives écartées : symétrie autour d'un point d'ancrage ; déplacement avec choix du côté ouvert.
- Origine : réponse de l'utilisateur (Q16).

### D-091 : nouvelle combinaison depuis un modèle
- Date : 2026-10-16
- Décision : le dialogue « Nouvelle combinaison » liste aussi les modèles ; en choisir un crée une combinaison sans joueuses, avec un ballon si le modèle en a un, puis lance la pose (ancre, côté ouvert).
- Raison : SPEC 6.6 (« s'y ajoutent les modèles de placement enregistrés ») sans geste précisé.
- Alternatives écartées : pose à une ancre par défaut.
- Origine : réponse de l'utilisateur (Q17).

### D-092 : modèles et synchronisation
- Date : 2026-10-16
- Décision : les modèles suivent le traitement des combinaisons (relecture, fichier invalide ou futur jamais modifié, copies de conflit, corbeille, renommage) ; une action sur un modèle modifié sur l'autre PC depuis sa lecture est refusée avec un message et la liste est relue ; en mode navigateur, modèles dans IndexedDB, copiés dans le dossier au premier choix ; pas d'import ni d'export de modèles.
- Raison : SPEC 8.1 (« les modèles de placement passent par la même couche ») ; un modèle ne s'édite pas en continu.
- Alternatives écartées : aucune proposée.
- Origine : réponse de l'utilisateur (Q18).

### D-093 : raccourcis des nouveaux outils
- Date : 2026-10-16
- Décision : J pour l'outil « Jeu au pied », G pour l'outil « Regroupement », en plus des boutons.
- Raison : choix de l'utilisateur.
- Alternatives écartées : boutons seulement (proposition).
- Origine : réponse de l'utilisateur (Q19).

### D-094 : schéma v2, modèle v1 et moteur du lot 3
- Date : 2026-10-16
- Décision : combinaisons en `schemaVersion 2` (jeu au pied et regroupement acceptés ; lot 5 et `defenseSettings` toujours rejetés), migration v1 vers v2 sans changement de contenu, fichier v1 réécrit en v2 seulement au prochain enregistrement ; schéma v1 figé dans `model/schemaV1.ts` ; fixtures `play-v1-7v7-options.json` (migration) et `play-v2-lot3.json` (figée pour les lots 4 et 5) ; modèle de placement en v1 (`modeles/<nom-court>--<id>.preset.json`) ; `reglages.json` reste en v2. Moteur : courses arrêtées (`until`) et déplacement du relayeur en segment droit ; boucle d'événements du ballon dans l'ordre chronologique (passes, jeux au pied, formations ; arrivées, sorties de balle et ramassages résolus entre deux événements) ; ramassage cherché à pas fixe de 1/100 s puis par bissection ; segments du ballon par temps ; ligne d'avantage en liste de changements.
- Raison : règle 6 de `CLAUDE.md` ; D-004 ; un regroupement valide exige que la plaquée tienne le ballon, donc aucun vol en cours : l'ordre chronologique suffit, sans itération, et le moteur reste pur.
- Alternatives écartées : réécrire les fichiers v1 dès la lecture ; résolution itérative.
- Origine : plan du lot 3 (sections 1 et 2), validé par l'utilisateur.

### D-095 : interface du jeu au pied et des regroupements (étape 6)
- Date : 2026-10-16
- Décision : l'outil « Jeu au pied » (J) choisit la frappeuse puis une joueuse (receveuse) ou un point du terrain, et sélectionne le jeu au pied créé ; l'outil « Regroupement » (G) pose un ruck sur la joueuse cliquée avec la proposition de D-081, ou affiche un message (« cliquez une joueuse qui a le ballon dans ce temps », « il faut deux coéquipières »). Inspecteur : section « Jeu au pied » (type, cible « Point du terrain » ou une joueuse, x et y visés, délai, temps de vol propre ou défaut du type) ; section « Regroupement » (type, soutien et relayeur parmi les coéquipières de la plaquée, instant de formation, durée, défense au regroupement) ; dans « Combinaison », la porteuse au départ ou le ballon au sol, avec « Poser le ballon au sol » qui le pose à la place de la porteuse. Le point visé d'un jeu au pied et le ballon au sol au départ se déplacent à la souris (le ballon au temps 1 seulement, D-009) ; cliquer le trajet du relayeur sélectionne son regroupement. Calque « En-avant » dans la barre de lecture. Sous 1500 px de large, les boutons de la barre d'outils sont resserrés (marge de 5 px, écart de 8 px) : toute la barre reste visible à 1440 px avec les deux outils de plus.
- Raison : SPEC 10.3, 10.4, D-078 à D-085, D-093 ; mesure à 1440 px : la barre débordait de 92 px.
- Alternatives écartées : libellés abrégés des outils ; dossier masqué dans la barre.
- Origine : choix technique (étape 6).

### D-096 : interface des modèles et de la combinaison entière (étape 7)
- Date : 2026-10-16
- Décision : la bibliothèque a deux onglets, « Combinaisons » et « Modèles ». Onglet « Modèles » : « Enregistrer un modèle… » (combinaison ouverte) ; liste triée par nom avec vignette (le modèle seul, A attaquant, sur un terrain par défaut, cadré sur ses jetons plus 5 m), nom, type et nombre de joueuses ; actions Appliquer, Renommer, Dupliquer (« (copie) »), Mettre à jour, Supprimer (corbeille, après confirmation) ; fichiers invalides et copies de conflit signalés comme pour les combinaisons. Dialogue d'enregistrement : nom obligatoire, type proposé d'après la catégorie (mêlée, touche, coup d'envoi/renvoi, sinon libre), contenu « Placement de départ entier » ou « Sélection (n joueuses) » (la sélection par défaut quand des joueuses sont sélectionnées), « Inclure le ballon » (D-089), côté ouvert (absent pour la touche), puis « Cliquer le point d'ancrage » ; « Mettre à jour » garde le nom et le type, non modifiables. Toute pose (appliquer, enregistrer, déplacer) affiche le temps 1 avec l'outil Sélection et un bandeau en surimpression : consigne, côté ouvert modifiable (sauf touche), refus de l'ancre affiché à la place de la consigne, « Échap pour annuler » et un bouton « Annuler » ; Échap ou un changement d'outil annule. Avant chaque action sur un modèle, le dossier est relu : un modèle changé ou retiré depuis sa lecture est refusé avec un message (D-092) ; « Mettre à jour » écrit avec la version lue à l'ouverture du dialogue. « Appliquer » reste possible sur un modèle en lecture seule (copie de conflit non résolue), les écritures non. « Déplacer la combinaison » et « Retourner » sont dans la section Combinaison de l'inspecteur ; le déplacement suit la grille quand elle est active et montre les jetons de départ en fantôme, avec un trait du point de départ au pointeur. Une nouvelle combinaison depuis un modèle est enregistrée aussitôt, sans joueuses, puis la pose commence ; Échap la laisse vide.
- Raison : plan du lot 3 (section 4) ; SPEC 6.6, 10.1, 10.2 ; D-050 (bandeaux en surimpression) ; D-087 à D-092.
- Alternatives écartées : pose sur le temps affiché ; message de refus ajouté à la consigne (bandeau sur deux lignes au-dessus du terrain) ; modèles dans la même liste que les combinaisons.
- Origine : choix technique (étape 7).
- Enregistrement immédiat d'une nouvelle combinaison depuis un modèle remplacé par D-101.

## Lot 3 : correction après recette

Plan : `docs/archive/plans/lot-3-corrections.md`, validé le 23 octobre 2026 avec les réponses Q1 à Q3 et trois compléments.

### D-097 : base de concurrence par l'empreinte du contenu
- Date : 2026-10-23
- Décision : le jeton de version (`VersionToken`) porte, en plus de la date et de la taille, l'empreinte du contenu (`contentHash`) de la version du fichier dont part l'éditeur. Il est gardé hors de l'objet `Play` (`EditorState.version`) ; il est mis à jour à l'ouverture, après chaque écriture réussie, à chaque rechargement et à chaque résolution de conflit ou de fichier retiré ; annuler, rétablir et les glissers n'y touchent pas. Avant d'écrire, une date et une taille égales au jeton suffisent ; sinon le fichier est relu et l'écriture est acceptée si son empreinte est celle du jeton ou celle d'une version écrite par la page (D-098), refusée sinon. Une date ou une taille différente ne prouve jamais un conflit. L'empreinte est calculée d'une seule façon partout : `contentHash` de l'élément obtenu en relisant le texte écrit ou lu (lecture et migration), jamais de l'objet en mémoire avant sérialisation. Même règle en mode navigateur, où l'entrée est relue dans IndexedDB juste avant d'écrire. `updatedAt` reste écrit à chaque sauvegarde, sans rôle dans la concurrence. Remplace la confirmation par `updatedAt` de D-043.
- Raison : annuler, rétablir et un glisser commencé avant une sauvegarde rendent un `updatedAt` antérieur ; dès que Drive change la date du fichier, la version écrite par la page passait pour un conflit (dialogue « Version plus récente dans le dossier » en travaillant seul). En mode navigateur, annuler au-delà d'une sauvegarde suffisait.
- Alternatives écartées : remettre à jour `updatedAt` dans l'historique d'annulation (les instantanés restent des copies fidèles) ; confirmation par la date seule.
- Origine : retour de recette de l'utilisateur ; correction demandée par l'utilisateur, complément « empreinte calculée d'une seule façon ».

### D-098 : écritures de la page et retour en arrière de Drive
- Date : 2026-10-23
- Décision : chaque collection (combinaisons, modèles) garde, par identifiant, les empreintes des 50 dernières versions écrites par la page (`OWN_WRITES_KEPT`, HYPOTHÈSE) et une référence : le texte de la dernière version tenue pour courante, écrite par la page ou lue depuis l'extérieur. Un fichier relu dont le contenu est une version écrite par la page n'est jamais une modification extérieure : ni dialogue, ni rechargement, ni refus d'action sur un modèle. Si ce n'est pas la référence (retour en arrière de Drive), la référence est réécrite à l'identique dans le même fichier, sans toucher aux modifications en cours, et l'événement est consigné au journal (D-100) ; seulement si le nom du fichier est celui de la référence, si l'identifiant n'a pas de copie de conflit et si le fichier, relu juste avant, n'a pas encore changé. Le rechargement silencieux et le dialogue restent réservés aux contenus jamais écrits par la page, avec leur comportement de SPEC 8.4. Limite : toute remise volontaire à l'identique d'une ancienne version depuis l'autre PC (historique de Drive, ou import qui rendrait à l'identique une version écrite par cette page) est défaite tant que la page qui l'avait écrite est ouverte ; recharger la page avant.
- Raison : Drive en mode diffusion peut restituer brièvement une version antérieure (hypothèse) ; sans modification en cours, l'outil la rechargeait en silence. Réécrire la référence plutôt que la dernière écriture de la page évite d'écraser une version de l'autre PC lue entre-temps.
- Alternatives écartées : réécrire toujours la dernière version écrite par la page (écraserait une version extérieure lue depuis) ; oublier les écritures de la page à chaque rechargement (un retour en arrière vers l'une d'elles serait rechargé).
- Origine : demande de l'utilisateur ; réponse Q1 (référence) ; complément sur la limite.

### D-099 : aucune sauvegarde automatique pendant un glisser
- Date : 2026-10-23
- Décision : si le délai de la sauvegarde automatique expire pendant un geste (glisser), rien n'est écrit ; la sauvegarde part à la fin du geste, ou à son annulation s'il restait des modifications non enregistrées. Ctrl+S reste immédiat.
- Raison : le minuteur armé par la modification précédente écrivait l'état intermédiaire du geste.
- Alternatives écartées : différer aussi Ctrl+S ; relancer le délai de 2 s à la fin du geste.
- Origine : demande de l'utilisateur.

### D-100 : journal de synchronisation
- Date : 2026-10-23
- Décision : un journal en mémoire garde les 200 derniers événements de synchronisation (`SYNC_LOG_SIZE`) : relecture, écriture, vérification avant écriture, changement détecté, décision, retour en arrière corrigé, sauvegarde différée, refus sur un modèle ; une seule ligne à l'ouverture du dossier. Champs : heure de l'événement et date de modification du fichier en heure locale du PC avec les millisecondes, collection, fichier, taille, `updatedAt` tel qu'il est dans le fichier, empreinte courte (8 caractères), origine retenue (« cette page » ou « extérieure »), détail. Bouton discret « Copier le journal de synchronisation » en bas de la section « Réglages » de l'inspecteur. Rien n'est écrit dans le dossier.
- Raison : diagnostiquer un dialogue qui réapparaîtrait avec Drive réel.
- Alternatives écartées : journal écrit dans le dossier.
- Origine : demande de l'utilisateur ; complément sur les heures.

### D-101 : nouvelle combinaison depuis un modèle enregistrée à la validation de la pose
- Date : 2026-10-23
- Décision : choisir un modèle dans « Nouvelle combinaison » enregistre la combinaison ouverte, puis ouvre la nouvelle sans l'écrire ; tant que la pose n'est pas validée, rien n'est écrit (Ctrl+S compris) et aucun brouillon n'est gardé. L'ancre validée fait une étape d'annulation, puis la combinaison est enregistrée aussitôt (D-044 : la création est la validation). Échap, « Annuler », un changement d'outil ou une autre pose abandonnent la nouvelle combinaison ; la combinaison précédente est relue dans le dossier (ou dans IndexedDB) et rouverte comme depuis la bibliothèque ; si elle n'existe plus, l'éditeur reste vide. Remplace l'enregistrement immédiat de D-096 ; les deux autres choix de D-096 sont inchangés (toute pose affiche le temps 1 ; un modèle en lecture seule peut être appliqué, pas modifié).
- Raison : Échap laissait une combinaison vide dans la bibliothèque. La précédente est relue, car elle a pu changer sur l'autre PC pendant la pose.
- Alternatives écartées : rouvrir la précédente depuis un instantané de l'éditeur ; laisser l'éditeur vide.
- Origine : demande de l'utilisateur (passation du 16/10) ; réponse Q2.
