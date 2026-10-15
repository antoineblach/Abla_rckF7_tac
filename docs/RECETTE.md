# Recette manuelle

À placer dans `docs/RECETTE.md`. Chaque lot n'est validé que lorsque toutes ses cases sont cochées. Les tests automatisés ne remplacent pas cette recette, ils la complètent.

## Préalable (une fois)

- [ ] Dépôt GitHub public `Abla_rckF7_tac` créé ; Pages activé avec la source « GitHub Actions ».
- [ ] Google Drive pour ordinateur installé et connecté au même compte sur les deux PC.
- [ ] Dossier `Mon Drive/Rugby7` créé ; mode miroir choisi (ou mode diffusion avec le dossier « disponible hors connexion »).
- [ ] URL de l'outil en favori dans Chrome sur les deux PC (la casse de l'adresse peut compter).
- [ ] App Google Drive installée sur le téléphone, connectée au même compte (pour récupérer les GIF et PDF exportés).

## Lot 1 : socle

### Accès et dossier
- [ ] PC 1, Chrome : l'outil s'ouvre depuis le favori.
- [ ] Choix du dossier `Rugby7` ; Chrome propose « Autoriser à chaque visite » ; choisi.
- [ ] Sous-dossiers `combinaisons/`, `_corbeille/` et fichier `reglages.json` créés.
- [ ] Fermer Chrome, le rouvrir : le dossier est accessible sans nouvelle demande (ou en un clic).

### Édition
- [ ] Nouvelle combinaison depuis « 7 contre 7 en ligne » ; nom et catégorie saisis.
- [ ] Placer, déplacer, supprimer des joueuses A et B ; numéros modifiés.
- [ ] Au temps 2 ou 3, glisser une joueuse : refusé avec un message (position héritée) ; ses points de passage, eux, se déplacent.
- [ ] Tracer une course de 4 points ; déplacer un point ; supprimer un point au clic droit.
- [ ] Changer l'allure : la durée de la course change en conséquence.
- [ ] Passe entre deux joueuses en mouvement : le ballon arrive bien sur la receveuse.
- [ ] Passe vers l'équipe adverse : erreur affichée, rien ne plante.
- [ ] Passe d'une joueuse sans ballon : erreur affichée.
- [ ] Porteuse du ballon au départ changée dans l'inspecteur ; ballon retiré puis ajouté.
- [ ] Créer 3 temps ; au temps 3, deux options avec condition et consigne ; choisir l'option par défaut ; « Insérer un temps après » entre le temps 1 et le temps 2.
- [ ] Consigne de plus de 60 caractères : avertissement affiché.
- [ ] Retoucher une course du temps 1 : passes et temps suivants restent corrects, dans les deux options.
- [ ] Annuler et rétablir 10 étapes de suite.
- [ ] Raccourcis du tableau de la spécification (6.2) tous fonctionnels.
- [ ] Grille d'aimantation activée et désactivée.
- [ ] Équipe qui attaque passée à B : les flèches de sens d'attaque de la ligne d'avantage s'inversent (paysage) ; en portrait et en carré, l'attaque reste vers le haut.
- [ ] Atelier 4 contre 2 sans ballon : accepté, lisible.

### Lecture
- [ ] Lecture, pause, temps précédent et suivant, curseur, vitesses 0,5x / 1x / 2x, boucle.
- [ ] Pause automatique entre les temps.
- [ ] « S'arrêter aux options » activé : pause au point d'option, un bouton par option, retour au point d'option, lecture de l'autre option ; désactivé : l'option par défaut est lue sans pause.
- [ ] Calques traces, consigne, ligne d'avantage activés et désactivés séparément.
- [ ] Cadrage automatique et retour à la vue enregistrée.
- [ ] Aperçu portrait, paysage, carré.
- [ ] Plein écran.
- [ ] Saut direct à un instant puis lecture : image identique à une lecture continue.

### Stockage et synchronisation
- [ ] Ctrl+S : fichier `<nom-court>--<id>.combi.json` présent dans l'explorateur, dans `Rugby7/combinaisons/`.
- [ ] Sauvegarde automatique après une modification (environ 2 s).
- [ ] Renommer la combinaison (validation du nom par Entrée ou en quittant le champ) : le nouveau fichier est écrit, l'ancien est en corbeille.
- [ ] PC 2 après synchronisation Drive : la combinaison apparaît et se lit à l'identique, options comprises.
- [ ] Modifier sur PC 2 ; revenir sur la fenêtre du PC 1 : rechargement automatique.
- [ ] Modifier sur PC 1 sans enregistrer, pendant qu'une version plus récente arrive : choix proposé (dossier, la mienne, les deux).
- [ ] Conflit provoqué (synchronisation Drive en pause, modifier sur les deux PC, reprendre) : copie détectée, « Garder les deux » fonctionne.
- [ ] Supprimer une combinaison : fichier déplacé dans `_corbeille/`, rien d'effacé.
- [ ] Fichier `.combi.json` corrompu à la main : signalé, ni modifié ni déplacé.
- [ ] Export et import d'un `.combi.json` et d'un `.combipack.json`.
- [ ] Firefox : mode dégradé, bandeau affiché, import et export fonctionnels.
- [ ] Chrome sans dossier : bandeau « Aucun dossier choisi » ; en choisissant un dossier, copie des combinaisons du navigateur proposée.
- [ ] Fermer l'onglet moins de 2 s après une modification, rouvrir : « Restaurer le brouillon » proposé.

### Déploiement
- [ ] Une branche avec un test volontairement cassé : la CI échoue et rien n'est déployé.
- [ ] PR avec la CI rouge : fusion impossible (protection de `main`).
- [ ] Après fusion sur `main` : nouvelle version en ligne.

## Lot 2 : exports GIF et PDF

### GIF
- [ ] Export portrait, paysage, carré : orientation correcte, attaque vers le haut en portrait et en carré, vers la droite en paysage (aussi quand B attaque).
- [ ] Combinaison à 2 options : un GIF par option ; puis un GIF enchaîné avec cartons.
- [ ] Ralenti puis vitesse réelle, pastilles visibles ; variantes 0,5x seul et 1x seul.
- [ ] Carton titre, numéro du temps, consigne en bandeau, pause finale de 2 s.
- [ ] Cadrage fixe pendant tout le GIF (aucun saut entre options).
- [ ] Taille du fichier affichée ; version allégée proposée au-delà du seuil.
- [ ] Annuler un export long : l'interface répond, aucun fichier partiel laissé.
- [ ] Deux exports successifs identiques (même taille).
- [ ] Fichier présent dans `Rugby7/exports/`, accessible depuis l'app Google Drive du téléphone.
- [ ] Envoi WhatsApp depuis le téléphone : noter si le GIF arrive en boucle automatique ou en vidéo avec bouton lecture, et sa netteté.
- [ ] Lecture sur téléphone en extérieur, en plein soleil : numéros et consignes lisibles.

### PDF
- [ ] Mise en page téléphone : page haute, lisible en défilant sur le téléphone.
- [ ] Mise en page impression A4 paysage, en couleur.
- [ ] Même PDF en noir et blanc sur imprimante laser : équipes distinguables (plein / creux), passes et courses distinguables.
- [ ] Combinaison à 3 options : arbre de vignettes sur une page, rangées titrées par condition.
- [ ] Combinaison trop longue pour un A4 : suite sur la page suivante avec rappel du titre.
- [ ] Cahier de jeu de 5 combinaisons : page de titre, sommaire avec numéros, liens internes cliquables sur téléphone.
- [ ] Accents, apostrophes et guillemets corrects.

## Lot 3 : mise en place

### Modèles de placement
- [ ] Enregistrer un modèle de mêlée (attaque seule), un de touche, un de renvoi, un de ruck, un libre.
- [ ] Appliquer chaque modèle à un autre endroit du terrain, côté ouvert à gauche puis à droite.
- [ ] Modèle de touche : l'ancre reste sur la ligne de touche et refuse les 5 derniers mètres avant une ligne de but.
- [ ] Appliquer un modèle d'attaque puis un modèle de défense sur la même combinaison.
- [ ] Appliquer un modèle quand l'équipe B attaque : rôles respectés.
- [ ] Joueuses existantes déplacées, manquantes créées, autres inchangées.
- [ ] Renommer, dupliquer, mettre à jour, supprimer (corbeille) un modèle.
- [ ] Modèles synchronisés entre les deux PC.

### Combinaison entière
- [ ] Déplacer une combinaison vers un autre point d'ancrage.
- [ ] Retourner une combinaison (symétrie) : courses, passes et jeu au pied suivent.

### Regroupements
- [ ] Poser un ruck sur la porteuse ; soutien et relayeur proposés, modifiables.
- [ ] Durée de 3 s par défaut, modifiable ; la phase suivante démarre à la sortie de balle.
- [ ] Ligne d'avantage recalée au point du ruck.
- [ ] Maul : même comportement.
- [ ] Bascule gratteur / garde sur un regroupement.

### Jeu au pied
- [ ] Coup d'envoi vers une receveuse : arrivée à l'heure, ombre et grossissement visibles.
- [ ] Jeu au pied long vers un point : ballon au sol, ramassé par la première joueuse qui passe dessus.
- [ ] Tirets longs dans l'éditeur, le lecteur, le GIF et le PDF.

### En-avant
- [ ] Passe plate d'une joueuse lancée, mains vers l'arrière : aucune alerte.
- [ ] Passe lancée vers l'avant : alerte visible dans l'éditeur, le lecteur et les exports (calque activé).

## Lot 4 : défense simulée

- [ ] Système 6+1 puis 7 en ligne sur la même combinaison : effectifs en ligne conformes (4 + balayeur, ou 5).
- [ ] Ruck avec garde : la garde prend le relayeur qui attaque au ras.
- [ ] Ruck avec gratteur : personne au ras, la porte est ouverte.
- [ ] Appariement « chacun le sien » : chaque défenseure suit son attaquante après la sortie de balle.
- [ ] Surnombre : halo sur l'attaquante non appariée.
- [ ] Contact probable et franchissement signalés aux bons instants.
- [ ] Mêlée : 3 défenseures engagées, les autres à 5 m derrière le dernier pied ; ligne levée à la sortie de balle.
- [ ] Touche : alignement, joueuse face à la lanceuse, non-participantes à 10 m ; montée dès le lancer.
- [ ] Jeu courant : aucune ligne de hors-jeu.
- [ ] Coup d'envoi : simulation désactivée.
- [ ] Glissement activé : décalage d'un cran au passage du milieu.
- [ ] Mélange de défenseures manuelles et automatiques.
- [ ] « Figer » une défenseure : courses éditables obtenues.
- [ ] Deux options : tronc commun identique, défense différente après le point d'option.
- [ ] Atelier 4 contre 3 : simulation cohérente.
- [ ] Défense simulée présente et identique dans le GIF et le PDF.
- [ ] Modifier une course d'attaque : la défense se recalcule sans délai perceptible.

## Lot 5 : ateliers

- [ ] Placer plots, coupelles, boucliers, sacs de plaquage, piquets ; les déplacer, les supprimer.
- [ ] Zone rectangulaire avec étiquette et cotes affichées ; redimensionnement.
- [ ] Annotation de texte positionnée.
- [ ] Course groupée sur 4 joueuses : chacune garde son décalage.
- [ ] Atelier complet exporté en GIF et en PDF, lisible.
