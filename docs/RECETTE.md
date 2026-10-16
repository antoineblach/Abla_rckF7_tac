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

### Comportements couverts par les tests

Tests unitaires dans `src/` (Vitest), tests de bout en bout dans `e2e/` (Playwright, sur le build de production, avec le vrai Web Worker).

| Comportement | Tests |
|---|---|
| Orientation : attaque vers le haut en portrait et en carré, vers la droite en paysage, aussi quand B attaque | `export/gif/gif.test.ts`, `render/viewport.test.ts` |
| Un GIF par option ; GIF enchaîné avec cartons d'option, reprise au point d'option, « Temps n, » quand il y a plusieurs points d'option | `export/gif/timeline.test.ts`, `export/gif/gif.test.ts` ; `export-gif.chromium.spec.ts` |
| Ralenti puis vitesse réelle, pastilles ; 0,5x seul et 1x seul | `export/gif/timeline.test.ts`, `export/gif/gif.test.ts` |
| Carton titre 1,5 s, cartons d'option 2 s et de vitesse 1 s, maintien de 1 s, numéro du temps, consigne en bandeau même sans le calque, pause finale de 2 s, boucle infinie | `export/gif/timeline.test.ts`, `export/gif/gif.test.ts`, `render/captions.test.ts` ; `export-gif.chromium.spec.ts` (images et délais relus par omggif) |
| Nombre d'images conforme au calcul (⌈D·f/s⌉ + 1 par segment, cartons) | `export/gif/timeline.test.ts` ; `export-gif.chromium.spec.ts` |
| Cadrage fixe : toutes les lignes du fichier plus 5 m, sous l'en-tête et le bandeau | `export/gif/gif.test.ts`, `render/viewport.test.ts` |
| Lisibilité : plus petit texte d'au moins 2,5 mm sur un téléphone de 6 pouces, dans chaque format, qualité et thème ; PDF téléphone d'au moins 11,1 pt | `export/gif/gif.test.ts`, `export/names.test.ts`, `export/pdf/pdf.test.ts` |
| Palette globale, pixels inchangés transparents (désactivable) : mêmes images décodées avec et sans | `export/gif/gif.test.ts` |
| Deux exports successifs identiques octet pour octet (GIF et PDF) | `export/gif/gif.test.ts`, `export/pdf/pdf.test.ts`, `export/worker/worker.test.ts` ; `export-gif.chromium.spec.ts` (second export par « Remplacer ») |
| Taille affichée ; au-delà de 8 Mo, alerte et version allégée (standard, 8 images/s, `-allege`) | `state/exportSession.test.ts` (seuil injecté), `export/gif/gif.test.ts` ; `export-gif.chromium.spec.ts` |
| Annuler un export long : aucun fichier écrit, Worker qui ne répond pas arrêté | `io/exports.test.ts`, `state/exportSession.test.ts` ; `export-gif.chromium.spec.ts` |
| L'interface ne gèle pas pendant l'encodage (aucune tâche de la page au-delà de 200 ms) | `export-gif.chromium.spec.ts` |
| `exports/` créé ; export existant : question, « Remplacer » (ancien en corbeille), « Garder les deux » (-2, -3), « Annuler » ; nouvelle question si un fichier apparaît pendant l'encodage ; tout ou rien ; fichier vide retiré après un échec d'écriture | `io/exports.test.ts`, `io/FolderStore.test.ts`, `state/exportSession.test.ts` ; `export-gif.chromium.spec.ts`, `folder.chromium.spec.ts` |
| Noms des variantes (D-066, D-074) | `export/names.test.ts` ; `export-gif.chromium.spec.ts`, `export-pdf.chromium.spec.ts` |
| Préférences d'export relues et écrites dans `reglages.json` v2 ; migration de la v1 ; version future jamais réécrite | `model/settings.test.ts`, `io/FolderStore.test.ts`, `io/io.test.ts` ; `export-gif.chromium.spec.ts` |
| Thème Impression N&B : gris seulement, A plein, B creux, courses pleines, passes en pointillés, temps précédents gris clair ; Impression couleur ; aplats pour tous les thèmes | `render/printThemes.test.ts` |
| Images de référence : une image de GIF en Contraste fort et en N&B, une vignette PDF en Contraste fort, Impression couleur et N&B | `export/gif/gif.test.ts`, `export/pdf/pdf.test.ts` |
| PDF vectoriel (aucune image), police embarquée réduite avec `/ToUnicode` ; accents, apostrophe typographique, guillemets retrouvés | `export/pdf/pdf.test.ts` ; `export-pdf.chromium.spec.ts` |
| Mise en page impression : tronc puis une rangée titrée par option, libellé et consigne sous chaque vignette, réduction de 90 à 60 mm, suite avec rappel du titre, rangée jamais coupée | `export/pdf/pdf.test.ts` |
| Mise en page téléphone : pages de 100 mm, une colonne, hauteur ajustée | `export/pdf/pdf.test.ts` ; `export-pdf.chromium.spec.ts` |
| Cahier de jeu de 5 combinaisons dont une à 3 options : page de titre datée, sommaire avec numéros et liens vers la bonne page, numéros de page, signets | `export/pdf/pdf.test.ts` ; `export-pdf.chromium.spec.ts` (combinaisons importées d'un `.combipack.json`) |
| Choix du cahier : ordre du tri de la bibliothèque, catégorie ou « Sélection » | `state/exportSession.test.ts` |
| Firefox (mode dégradé) : GIF et PDF téléchargés et valides (Worker, OffscreenCanvas et police) | `export.firefox.spec.ts` |
| jsPDF et gifenc seulement dans le morceau du Worker, sans html2canvas, dompurify ni canvg | `bundle.chromium.spec.ts` |

### Vérifications manuelles

Indispensables et impossibles à automatiser (téléphone, WhatsApp, imprimante) :
- [ ] GIF portrait enchaîné de la combinaison à 2 options : récupéré par l'app Google Drive du téléphone dans `Rugby7/exports/` ; envoyé sur WhatsApp une fois avec « Alléger le fichier » et une fois sans : noter s'il arrive en boucle automatique ou en vidéo à lancer, et si le rendu est identique ; lisible en extérieur (numéros, consignes).
- [ ] PDF « Impression » en noir et blanc sur l'imprimante laser : équipes (plein et creux), courses et passes distinguables, texte lisible.
- [ ] Cahier de jeu de 5 combinaisons ouvert sur le téléphone : sommaire cliquable, lecture en défilant.

### Séance d'usage libre

Exporter normalement quelques combinaisons (GIF et PDF, cahier de jeu) sur les deux PC, les envoyer aux joueuses, puis faire un retour avec le prompt « Correction après recette ».

## Lot 3 : mise en place

### Comportements couverts par les tests

Tests unitaires dans `src/` (Vitest), tests de bout en bout dans `e2e/` (Playwright, sur le build de production).

| Comportement | Tests |
|---|---|
| Combinaisons en version 2 : fichiers des lots 1 et 2 lus sans changement, réécrits en v2 au prochain enregistrement ; version future signalée et jamais modifiée | `model/migrations.test.ts`, `model/schema.test.ts`, `io/FolderStore.test.ts` |
| Modèle de placement v1 : aller-retour du fichier dans `modeles/`, fichier invalide ou futur ni modifié ni déplacé, renommage, corbeille, copies de conflit en lecture seule, IndexedDB | `model/preset.test.ts`, `io/presets.test.ts` |
| Enregistrer un modèle (placement entier ou sélection, ballon, côté ouvert, ancre aimantée) ; l'appliquer au même ancrage redonne le placement | `editor/presets.test.ts`, `editor/placementMode.test.ts`, `state/presetSession.test.ts` ; `placement.chromium.spec.ts`, `presets.firefox.spec.ts` |
| Application aux quatre cas : côté ouvert à gauche ou à droite, A ou B qui attaque ; côté le plus large par défaut ; côté choisi dans le bandeau | `editor/presets.test.ts`, `state/placement.test.ts`, `state/presetSession.test.ts` ; `placement.chromium.spec.ts` |
| Ancre de touche sur la ligne de touche, refusée à moins de 5 m d'une ligne de but (fantômes masqués, message, clic sans effet) ; renvoi capté par le centre ou les 22 m ; grille pour mêlée, ruck et libre | `editor/presets.test.ts`, `editor/placementMode.test.ts`, `state/placement.test.ts` ; `placement.chromium.spec.ts` |
| Association par rôle et numéro : existantes déplacées, manquantes créées, autres inchangées ; numéros en double ; modèle d'attaque puis modèle de défense | `editor/presets.test.ts` ; `placement.chromium.spec.ts` |
| Catégorie de la combinaison mise à jour selon le type du modèle | `editor/presets.test.ts`, `state/placement.test.ts` ; `placement.chromium.spec.ts`, `presets.firefox.spec.ts` |
| Renommer, dupliquer, mettre à jour (identifiant, nom et type gardés), supprimer (corbeille) un modèle ; modèle de l'autre PC relu au focus ; action refusée, avec un message, sur un modèle changé ailleurs | `state/presetSession.test.ts`, `io/presets.test.ts` ; `placement.chromium.spec.ts` |
| Nouvelle combinaison depuis un modèle | `editor/placementMode.test.ts`, `state/presetSession.test.ts` ; `placement.chromium.spec.ts` |
| Déplacer (deux clics, grille) et retourner une combinaison : positions, points de passage, points visés, ballon au sol, cadre ; deux symétries ou un aller-retour redonnent la combinaison ; une étape d'annulation, Échap annule | `editor/transform.test.ts`, `editor/placementMode.test.ts`, `state/placement.test.ts` ; `placement.chromium.spec.ts` |
| Ruck posé sur la porteuse (G), soutien et relayeur proposés puis changés, refus avec un message | `editor/setPieces.test.ts`, `state/setPieces.test.ts` ; `breakdown-kick.chromium.spec.ts` |
| Regroupement : ballon dans le regroupement pendant la durée (3 s par défaut, modifiable), relayeur porteuse à la fin, temps suivant à la sortie de balle, ligne d'avantage recalée, courses des participantes arrêtées et signalées, relayeur en retard ; maul identique ; garde ou gratteur enregistré | `engine/breakdown.test.ts`, `editor/setPieces.test.ts` ; `breakdown-kick.chromium.spec.ts` |
| Jeu au pied (J) vers une receveuse : arrivée à lâcher + temps de vol ; vers un point : ballon au sol ramassé par la première joueuse à moins de 1 m, aussi dans les temps suivants, ou jamais ; ballon au sol au départ ; frappeuse sans ballon signalée | `engine/kick.test.ts`, `editor/setPieces.test.ts`, `state/setPieces.test.ts` ; `breakdown-kick.chromium.spec.ts` |
| Tirets longs, ombre et grossissement du ballon, repère du regroupement dans l'éditeur, le lecteur, le GIF et le PDF ; aplats, gris seulement en N&B, traits de 3 px en Contraste fort | `render/setPieces.test.ts` (images de référence), `export/setPieces.test.ts` (image de GIF, tirets relus dans le PDF N&B, vignette de référence) ; `breakdown-kick.chromium.spec.ts` (GIF et PDF exportés) |
| En-avant : passe plate d'une passeuse lancée non signalée ; passe vers l'avant dans le repère de la passeuse signalée (seuil, équipe B, lâcher au début d'un temps, passeuse arrêtée) ; la passe s'exécute | `engine/forwardPass.test.ts` |
| Icône d'en-avant toujours dans l'éditeur, dans le lecteur selon le calque « En-avant » (mémorisé par poste) ; jamais dans le GIF ni le PDF, même calque activé, ni dans les vignettes (D-086) | `render/setPieces.test.ts`, `state/setPieces.test.ts`, `export/setPieces.test.ts` ; `breakdown-kick.chromium.spec.ts` |
| Déterminisme ; saut direct égal à la lecture continue ; tronc identique dans toutes les options, regroupement compris | `engine/evaluate.test.ts` |
| Raccourcis J et G ; barre d'outils entière visible à 1440 px | `editor/setPieces.test.ts`, `state/setPieces.test.ts` ; `breakdown-kick.chromium.spec.ts` |

### Vérifications manuelles

Indispensables et impossibles à automatiser (synchronisation Drive réelle, téléphone, imprimante) :
- [ ] Modèle enregistré sur un PC, présent dans l'onglet « Modèles » de l'autre PC après la synchronisation Drive, puis appliqué (à faire avec la vérification Drive restante du lot 1, après avoir rechargé la page sur les deux PC).
- [ ] GIF portrait d'une combinaison avec un jeu au pied et un ruck, sur le téléphone : ombre et grossissement du ballon lisibles, repère du ruck compris.
- [ ] PDF « Impression » noir et blanc sur la laser : jeu au pied (tirets longs) distinct des passes (pointillés) et des courses (trait plein).

### Séance d'usage libre

Préparer quelques mises en place (modèles de mêlée, de touche, de renvoi et de ruck, appliqués des deux côtés et quand B attaque ; combinaisons avec regroupements, jeux au pied et ballon au sol), les lire, les exporter, puis faire un retour avec le prompt « Correction après recette ».

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
