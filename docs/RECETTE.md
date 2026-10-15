# Recette

Règle de recette (D-054, `CLAUDE.md` règle 12) :
- tout ce qui est automatisable est couvert par les tests (unitaires et de bout en bout) ; il n'y a plus de liste de vérifications manuelles à cocher ;
- en fin de lot, Claude liste au plus 5 vérifications manuelles, seulement celles qui sont à la fois indispensables et impossibles à automatiser ;
- le reste de la recette est une séance d'usage libre : l'utilisateur se sert de l'outil normalement et fait un retour (prompt « Correction après recette » de `docs/PROMPTS.md`) ;
- un lot est validé quand la CI est verte, les vérifications manuelles faites et le retour d'usage traité.

## Préalable (une fois)

- [ ] Dépôt GitHub public `Abla_rckF7_tac` créé ; Pages activé avec la source « GitHub Actions ».
- [ ] Google Drive pour ordinateur installé et connecté au même compte sur les deux PC.
- [ ] Dossier `Mon Drive/Rugby7` créé ; mode miroir choisi (ou mode diffusion avec le dossier « disponible hors connexion »).
- [ ] URL de l'outil en favori dans Chrome sur les deux PC (la casse de l'adresse peut compter).
- [ ] App Google Drive installée sur le téléphone, connectée au même compte (pour récupérer les GIF et PDF exportés).

## Lot 1 : socle

### Comportements couverts par les tests

Tests unitaires dans `src/` (Vitest), tests de bout en bout dans `e2e/` (Playwright, sur le build de production).

| Comportement | Tests |
|---|---|
| Structure `combinaisons/`, `_corbeille/` et `reglages.json` créée au premier choix du dossier | `io/FolderStore.test.ts` ; `folder.chromium.spec.ts` |
| Nouvelle combinaison « 7 contre 7 en ligne », nom et catégorie | `editor/editor.test.ts` ; `interface.chromium.spec.ts` |
| Placer, déplacer, supprimer des joueuses A et B, numéros modifiés ; un clic de sélection ne déplace rien | `editor/editor.test.ts`, `state/state.test.ts` ; `interface.chromium.spec.ts` |
| Position héritée non déplaçable, avec un message ; points de passage déplaçables dans tout temps | `state/state.test.ts` ; `field-stability.chromium.spec.ts` |
| Course de 4 points, point déplacé, point supprimé au clic droit | `editor/editor.test.ts`, `state/state.test.ts` ; `interface.chromium.spec.ts` |
| Allure changée : la durée de la course suit | `editor/editor.test.ts`, `engine/evaluate.test.ts` ; `interface.chromium.spec.ts` |
| Passe vers une receveuse en mouvement : le ballon arrive sur elle | `engine/pass.test.ts`, `engine/evaluate.test.ts` |
| Passe vers l'autre équipe, passe d'une joueuse sans ballon : alerte, rien ne plante | `engine/evaluate.test.ts`, `model/validate.test.ts` ; `interface.chromium.spec.ts` |
| Porteuse du ballon au départ ; ballon retiré puis ajouté | `editor/editor.test.ts` ; `interface.chromium.spec.ts` |
| Temps, options, condition, consigne, option par défaut, « Insérer un temps après » | `editor/editor.test.ts`, `model/phaseTree.test.ts` ; `folder.chromium.spec.ts`, `interface.chromium.spec.ts` |
| Consigne de plus de 60 caractères : avertissement | `model/validate.test.ts` ; `interface.chromium.spec.ts` |
| Retouche d'une course du temps 1 : passes et temps suivants corrects, dans chaque option | `engine/evaluate.test.ts` |
| Annuler et rétablir 10 étapes de suite (100 niveaux) | `editor/editor.test.ts`, `state/state.test.ts` ; `interface.chromium.spec.ts` |
| Raccourcis de la section 6.2 | `editor/editor.test.ts` (table complète), `state/state.test.ts` ; au clavier dans les tests de bout en bout : V, A, B, R, P, L, F, Entrée, Échap, Suppr, Espace, Ctrl+S, Ctrl+Z, Ctrl+Y |
| Grille d'aimantation | `editor/editor.test.ts`, `state/state.test.ts` ; `interface.chromium.spec.ts` |
| Équipe qui attaque B : flèches de la ligne d'avantage inversées en paysage ; attaque vers le haut en portrait et en carré | `render/render.test.ts`, `render/viewport.test.ts`, `engine/evaluate.test.ts` |
| Atelier 4 contre 2 sans ballon | `engine/evaluate.test.ts`, `model/validate.test.ts` |
| Lecture, pause, temps précédent et suivant, curseur, vitesses, boucle, pause entre les temps | `player/player.test.ts` ; `folder.chromium.spec.ts`, `interface.chromium.spec.ts` |
| « S'arrêter aux options » : pause, un bouton par option, retour au point d'option ; désactivé : option par défaut | `player/player.test.ts` ; `folder.chromium.spec.ts` |
| Calques traces, consigne, ligne d'avantage | `render/render.test.ts` ; `interface.chromium.spec.ts` |
| Réglages du lecteur et panneaux repliés mémorisés par poste | `state/panels.test.ts` ; `interface.chromium.spec.ts`, `field-stability.chromium.spec.ts` |
| Terrain stable à chaque geste (sélections, message, bandeau, lecture, choix d'option) ; molette, Espace + glisser, « Ajuster » (F), « Zone utile », fenêtre redimensionnée, plein écran | `render/viewport.test.ts`, `state/state.test.ts` ; `field-stability.chromium.spec.ts` |
| Aperçu portrait, paysage, carré | `render/viewport.test.ts`, `render/render.test.ts` (images de référence) ; `interface.chromium.spec.ts` |
| Saut direct à un instant : image identique à une lecture continue | `engine/evaluate.test.ts` ; `folder.chromium.spec.ts`, `degraded.firefox.spec.ts` |
| Ctrl+S : fichier `<nom-court>--<id>.combi.json` dans `combinaisons/` | `io/io.test.ts` ; `folder.chromium.spec.ts` |
| Sauvegarde automatique 2 s après une modification | `io/io.test.ts` ; `interface.chromium.spec.ts` |
| Renommage : nouveau fichier écrit, ancien en corbeille | `io/FolderStore.test.ts` ; `folder.chromium.spec.ts` |
| Version de l'autre PC : rechargement silencieux ; choix proposé pendant une modification non enregistrée | `io/io.test.ts` ; `external-changes.chromium.spec.ts` |
| Copie de conflit détectée, « Garder les deux » | `io/FolderStore.test.ts` ; `external-changes.chromium.spec.ts` |
| Suppression : fichier déplacé dans `_corbeille/`, rien d'effacé | `io/FolderStore.test.ts` ; `external-changes.chromium.spec.ts` |
| Fichier corrompu : signalé, ni modifié ni déplacé | `io/FolderStore.test.ts` ; `external-changes.chromium.spec.ts` |
| Export et import `.combi.json` et `.combipack.json` ; Firefox en mode dégradé | `io/io.test.ts` ; `degraded.firefox.spec.ts` |
| Chrome sans dossier : bandeau ; au choix du dossier, copie des combinaisons du navigateur proposée | `folder.chromium.spec.ts`, `field-stability.chromium.spec.ts` |
| Onglet fermé moins de 2 s après une modification : « Restaurer le brouillon » | `io/io.test.ts` ; `interface.chromium.spec.ts` |
| PR avec la CI rouge : fusion impossible | protection de `main` lue par `gh api` le 15/10/2026 (D-055) |

### Vérifications manuelles

Validées le 15/10/2026 sur le site déployé :
- [x] Dossier `G:\Mon Drive\Rugby7` en mode diffusion de Drive pour ordinateur : choix, création de la structure, écriture et sauvegarde automatique, aucun `.crswap` résiduel (hypothèses 8.3 et 8.8 confirmées).
- [x] « Autoriser à chaque visite » : accès conservé après fermeture et réouverture complète de Chrome.
- [x] Déploiement sur Pages après fusion de la PR #1.

Restantes (impossibles à automatiser : synchronisation réelle par Drive) :
- [ ] Synchronisation entre les deux PC : une combinaison créée sur un PC se lit à l'identique sur l'autre, options comprises ; après une modification sur le second PC, le retour sur la fenêtre du premier la recharge.
- [ ] Conflit réel : synchronisation Drive en pause, modification sur les deux PC, reprise : copie détectée, « Garder les deux » garde les deux versions.

### Séance d'usage libre

Se servir de l'outil normalement sur les deux PC (préparer, lire, ranger quelques combinaisons), puis faire un retour avec le prompt « Correction après recette ».

## Lot 2 : exports GIF et PDF

Comportements attendus, à couvrir par les tests (D-054). Les vérifications manuelles (au plus 5) et la séance d'usage libre seront précisées en fin de lot.

### GIF
- Export portrait, paysage, carré : orientation correcte, attaque vers le haut en portrait et en carré, vers la droite en paysage (aussi quand B attaque).
- Combinaison à 2 options : un GIF par option ; puis un GIF enchaîné avec cartons.
- Ralenti puis vitesse réelle, pastilles visibles ; variantes 0,5x seul et 1x seul.
- Carton titre, numéro du temps, consigne en bandeau, pause finale de 2 s.
- Cadrage fixe pendant tout le GIF (aucun saut entre options).
- Taille du fichier affichée ; version allégée proposée au-delà du seuil.
- Annuler un export long : l'interface répond, aucun fichier partiel laissé.
- Deux exports successifs identiques (même taille).
- Fichier présent dans `Rugby7/exports/`, accessible depuis l'app Google Drive du téléphone.
- Envoi WhatsApp depuis le téléphone : noter si le GIF arrive en boucle automatique ou en vidéo avec bouton lecture, et sa netteté.
- Lecture sur téléphone en extérieur, en plein soleil : numéros et consignes lisibles.

### PDF
- Mise en page téléphone : page haute, lisible en défilant sur le téléphone.
- Mise en page impression A4 paysage, en couleur.
- Même PDF en noir et blanc sur imprimante laser : équipes distinguables (plein / creux), passes et courses distinguables.
- Combinaison à 3 options : arbre de vignettes sur une page, rangées titrées par condition.
- Combinaison trop longue pour un A4 : suite sur la page suivante avec rappel du titre.
- Cahier de jeu de 5 combinaisons : page de titre, sommaire avec numéros, liens internes cliquables sur téléphone.
- Accents, apostrophes et guillemets corrects.

## Lot 3 : mise en place

Comportements attendus, à couvrir par les tests (D-054). Les vérifications manuelles (au plus 5) et la séance d'usage libre seront précisées en fin de lot.

### Modèles de placement
- Enregistrer un modèle de mêlée (attaque seule), un de touche, un de renvoi, un de ruck, un libre.
- Appliquer chaque modèle à un autre endroit du terrain, côté ouvert à gauche puis à droite.
- Modèle de touche : l'ancre reste sur la ligne de touche et refuse les 5 derniers mètres avant une ligne de but.
- Appliquer un modèle d'attaque puis un modèle de défense sur la même combinaison.
- Appliquer un modèle quand l'équipe B attaque : rôles respectés.
- Joueuses existantes déplacées, manquantes créées, autres inchangées.
- Renommer, dupliquer, mettre à jour, supprimer (corbeille) un modèle.
- Modèles synchronisés entre les deux PC.

### Combinaison entière
- Déplacer une combinaison vers un autre point d'ancrage.
- Retourner une combinaison (symétrie) : courses, passes et jeu au pied suivent.

### Regroupements
- Poser un ruck sur la porteuse ; soutien et relayeur proposés, modifiables.
- Durée de 3 s par défaut, modifiable ; la phase suivante démarre à la sortie de balle.
- Ligne d'avantage recalée au point du ruck.
- Maul : même comportement.
- Bascule gratteur / garde sur un regroupement.

### Jeu au pied
- Coup d'envoi vers une receveuse : arrivée à l'heure, ombre et grossissement visibles.
- Jeu au pied long vers un point : ballon au sol, ramassé par la première joueuse qui passe dessus.
- Tirets longs dans l'éditeur, le lecteur, le GIF et le PDF.

### En-avant
- Passe plate d'une joueuse lancée, mains vers l'arrière : aucune alerte.
- Passe lancée vers l'avant : alerte visible dans l'éditeur, le lecteur et les exports (calque activé).

## Lot 4 : défense simulée

Comportements attendus, à couvrir par les tests (D-054). Les vérifications manuelles (au plus 5) et la séance d'usage libre seront précisées en fin de lot.

- Système 6+1 puis 7 en ligne sur la même combinaison : effectifs en ligne conformes (4 + balayeur, ou 5).
- Ruck avec garde : la garde prend le relayeur qui attaque au ras.
- Ruck avec gratteur : personne au ras, la porte est ouverte.
- Appariement « chacun le sien » : chaque défenseure suit son attaquante après la sortie de balle.
- Surnombre : halo sur l'attaquante non appariée.
- Contact probable et franchissement signalés aux bons instants.
- Mêlée : 3 défenseures engagées, les autres à 5 m derrière le dernier pied ; ligne levée à la sortie de balle.
- Touche : alignement, joueuse face à la lanceuse, non-participantes à 10 m ; montée dès le lancer.
- Jeu courant : aucune ligne de hors-jeu.
- Coup d'envoi : simulation désactivée.
- Glissement activé : décalage d'un cran au passage du milieu.
- Mélange de défenseures manuelles et automatiques.
- « Figer » une défenseure : courses éditables obtenues.
- Deux options : tronc commun identique, défense différente après le point d'option.
- Atelier 4 contre 3 : simulation cohérente.
- Défense simulée présente et identique dans le GIF et le PDF.
- Modifier une course d'attaque : la défense se recalcule sans délai perceptible.

## Lot 5 : ateliers

Comportements attendus, à couvrir par les tests (D-054). Les vérifications manuelles (au plus 5) et la séance d'usage libre seront précisées en fin de lot.

- Placer plots, coupelles, boucliers, sacs de plaquage, piquets ; les déplacer, les supprimer.
- Zone rectangulaire avec étiquette et cotes affichées ; redimensionnement.
- Annotation de texte positionnée.
- Course groupée sur 4 joueuses : chacune garde son décalage.
- Atelier complet exporté en GIF et en PDF, lisible.
