# Journal des décisions

Une entrée numérotée par décision, ajoutée au moment où la décision est prise. Aucune entrée n'est effacée : une décision remplacée reçoit une nouvelle entrée qui cite l'ancienne (« Remplace D-0xx »), et l'ancienne reçoit la mention « Remplacée par D-0yy ».

Champs : date, décision, raison, alternatives écartées, origine (réponse de l'utilisateur, SPEC, essai, choix technique).
Les décisions structurantes initiales sont dans `SPEC.md`, section 16. Les entrées D-001 à D-027 reprennent les réponses Q1 à Q27 au plan du lot 1 (`docs/plans/lot-1.md`).

## Lot 1 : socle

### D-001 : terrain réduit selon la Règle 1
- Date : 2026-10-14
- Décision : sur un terrain plus court que 100 m ou plus étroit que 70 m, les lignes de 22 m restent à 22 m de la ligne de but, celles de 10 m à 10 m de la médiane, celles de 15 m à 15 m de la touche ; seuls les écarts entre ces lignes diminuent. SPEC 13.1 corrigée (commit `4a566e1`).
- Raison : texte de la Règle 1.3 : « the distance between the 10-metre lines and 22-metre lines is reduced accordingly », de même pour les lignes de 15 m.
- Alternatives écartées : réduction proportionnelle des distances (ancien texte de la SPEC).
- Origine : réponse de l'utilisateur (Q1 : a).

### D-002 : tirets et poteaux
- Date : 2026-10-14
- Décision : lignes en tirets de 5 m espacés de 5 m ; poteaux espacés de 5,6 m. Les deux en HYPOTHÈSE dans `defaults.ts`.
- Raison : la Règle 1 donne la longueur des tirets mais pas leur intervalle ; l'écartement des poteaux n'est lisible que sur le schéma.
- Alternatives écartées : aucune proposée.
- Origine : réponse de l'utilisateur (Q2).

### D-003 : réglages passés au moteur
- Date : 2026-10-14
- Décision : `evaluate(play, branchPath, t, settings, caches)` et `renderSchematic(ctx, play, branchPath, phaseId, viewport, theme, settings, caches)`.
- Raison : allures et vitesse de passe viennent de `reglages.json` ; la pureté exige de les passer en paramètre.
- Alternatives écartées : réglages dans l'objet `caches` ; recopie des allures dans chaque combinaison (change le modèle).
- Origine : réponse de l'utilisateur (Q3 : a).

### D-004 : types des lots 3 à 5
- Date : 2026-10-14
- Décision : types déclarés en TypeScript et présents dans les unions ; le moteur les ignore en le signalant ; le schéma zod v1 les rejette ; ils arriveront avec schemaVersion 2.
- Raison : les prompts des lots 3 et 5 imposent un incrément de version et des migrations.
- Alternatives écartées : zod v1 qui les accepte et moteur qui les ignore.
- Origine : réponse de l'utilisateur (Q4 : a).

### D-005 : renommage d'une combinaison
- Date : 2026-10-14
- Décision : écrire le nouveau fichier, puis déplacer l'ancien en corbeille, toujours ; renommage seulement à la validation du nom (perte du focus ou Entrée).
- Raison : cohérent avec la recette ; `move()` natif sur fichiers locaux non garanti dans Chrome (intention d'activation pour la version 111 derrière un drapeau) ; évite de remplir la corbeille pendant la frappe.
- Alternatives écartées : `move()` natif quand il existe ; renommage à chaque sauvegarde automatique.
- Origine : réponse de l'utilisateur (Q5 : a).

### D-006 : orientation quand B attaque
- Date : 2026-10-14
- Décision : paysage : terrain fixe (x vers la droite) et flèche de sens d'attaque sur la ligne d'avantage ; portrait et carré : attaque vers le haut ; le viewport sait faire une rotation de 180°, inutilisée au lot 1 (au lot 2, les GIF paysage attaqueront toujours vers la droite).
- Raison : la ligne d'avantage n'est définie que par l'abscisse du ballon à t = 0 (5.6) ; la flèche rend visible l'inversion attendue par la recette.
- Alternatives écartées : rotation de 180° en paysage dans l'éditeur.
- Origine : réponse de l'utilisateur (Q6 : a, carré comme portrait, rotation 180° ajoutée).

### D-007 : ballon dans l'éditeur
- Date : 2026-10-14
- Décision : case « Porteuse au départ » dans l'inspecteur de joueuse ; « Ajouter / retirer le ballon » dans l'inspecteur de combinaison ; le ballon n'est jamais dans `setup.positions` ; `ballPosition` sans porteuse acceptée à la lecture mais non éditable au lot 1.
- Raison : la spécification ne prévoyait aucun moyen d'éditer le ballon ; le ballon au sol relève du lot 3.
- Alternatives écartées : outil « Ballon » dédié.
- Origine : réponse de l'utilisateur (Q7).

### D-008 : placements de départ
- Date : 2026-10-14
- Décision : A sur x = 40 m, n° 1 à 7 de y = 5 m à y = 65 m tous les 10 m ; en 7 contre 7, B en face sur x = 50 m ; ballon à A n° 4 ; A attaque. Nouvelle combinaison : nom « Nouvelle combinaison », catégorie ruck/jeu courant, vue terrain complet.
- Raison : positions non précisées par la spécification.
- Alternatives écartées : aucune proposée.
- Origine : réponse de l'utilisateur (Q8).

### D-009 : positions héritées
- Date : 2026-10-14
- Décision : une position héritée d'un temps précédent ne se déplace pas ; seuls les points de passage du temps sélectionné bougent ; « Placer joueuse » fixe le placement initial, quel que soit le temps affiché.
- Raison : préserve la continuité (5.2) et le tronc commun.
- Alternatives écartées : déplacer le dernier point de la dernière course dans un temps ancêtre ; déplacer le placement initial.
- Origine : réponse de l'utilisateur (Q9 : a).

### D-010 : éditeur et lecteur
- Date : 2026-10-14
- Décision : mode schéma éditable quand un temps est sélectionné ou que la lecture est arrêtée à son début ; image `render` non éditable pendant la lecture ou après un déplacement du curseur ; tout geste d'édition ramène au mode schéma du temps courant.
- Raison : relation éditeur et lecteur non précisée.
- Alternatives écartées : aucune proposée.
- Origine : réponse de l'utilisateur (Q10).

### D-011 : bascule « S'arrêter aux options »
- Date : 2026-10-14
- Décision : bascule activée par défaut, indépendante de la pause entre les temps ; activée : arrêt au point d'option et un bouton par option ; désactivée : option par défaut.
- Raison : « lecture manuelle » et « automatique » n'étaient pas définies.
- Alternatives écartées : manuelle = pause entre les temps activée ; automatique = boucle.
- Origine : réponse de l'utilisateur (Q11 : b).

### D-012 : actions de l'arbre des temps
- Date : 2026-10-14
- Décision : « Ajouter un temps » sur une feuille seulement ; « Insérer un temps après » : temps vide inséré entre le temps sélectionné et ses enfants, qui lui sont rattachés ; « Créer une option à partir d'ici » : sœur vide, le temps seul devient l'option A par défaut, indisponible sur la racine ; « Dupliquer » : sœur avec copie des actions, sans descendants ; libellé stocké vide = calculé, non vide = saisi ; lettres recalculées.
- Raison : sémantique des actions de l'arbre non précisée.
- Alternatives écartées : option créée comme copie du temps.
- Origine : réponse de l'utilisateur (Q12, avec ajout d'« Insérer un temps après »).

### D-013 : moteur et invalidités
- Date : 2026-10-14
- Décision : deux courses d'une joueuse dans un temps : seule la première s'applique ; passe vers l'autre équipe : exécutée et signalée ; passeuse sans ballon : passe ignorée et signalée ; passes simultanées (même instant de lâcher) : seule la première s'applique.
- Raison : les invalidités n'interrompent jamais le programme (4.3).
- Alternatives écartées : bloquer l'action ; ignorer la passe vers l'adversaire.
- Origine : réponse de l'utilisateur (Q13).

### D-014 : suppression d'une joueuse
- Date : 2026-10-14
- Décision : supprime ses courses et les passes qui la concernent dans tous les temps (annulable) ; `ballCarrierId` repasse à null si besoin.
- Raison : évite des actions orphelines.
- Alternatives écartées : garder les actions et les signaler invalides.
- Origine : réponse de l'utilisateur (Q14).

### D-015 : raccourcis et outils
- Date : 2026-10-14
- Décision : Ctrl+D duplique les joueuses sélectionnées (numéro suivant libre, décalage de 2 m, sans actions) ; l'outil Course sur une joueuse qui a déjà une course dans le temps prolonge cette course ; supprimer le dernier point d'une course supprime la course ; délai par défaut d'une passe = instant où la passeuse obtient le ballon dans ce temps ; les flèches ignorent la grille ; grille activée par un bouton (aucun raccourci inventé).
- Raison : petits trous de 6.2 et 6.3.
- Alternatives écartées : aucune proposée.
- Origine : réponse de l'utilisateur (Q15).

### D-016 : numéros en double
- Date : 2026-10-14
- Décision : avertissement, pas de blocage.
- Raison : 4.3 n'impose rien ; le lot 3 associera par numéro.
- Alternatives écartées : blocage.
- Origine : réponse de l'utilisateur (Q16).

### D-017 : dimensions du terrain
- Date : 2026-10-14
- Décision : inspecteur borné à la Règle 1 (longueur 94 à 100 m, largeur 68 à 70 m, en-but 6 à 22 m) ; hors bornes dans un fichier : avertissement.
- Raison : 13.1.
- Alternatives écartées : dimensions libres.
- Origine : réponse de l'utilisateur (Q17).

### D-018 : vue demi-terrain
- Date : 2026-10-14
- Décision : `half` / `attack` = la moitié qui contient la ligne de but attaquée, avec son en-but.
- Raison : 4.1 ne précisait pas.
- Alternatives écartées : la moitié de l'équipe qui attaque.
- Origine : réponse de l'utilisateur (Q18).

### D-019 : cadrage, orientation, cadre libre, passe en vol
- Date : 2026-10-14
- Décision : cadrage automatique en lecture seulement ; l'éditeur part de la vue enregistrée, puis zoom et déplacement libres ; aperçu d'orientation disponible aussi en édition ; cadre libre réglé par « Enregistrer la vue actuelle comme cadre » et des champs numériques ; pendant le vol d'une passe, la portion parcourue est tracée en pointillés.
- Raison : section 7 incomplète sur ces points.
- Alternatives écartées : aucune proposée.
- Origine : réponse de l'utilisateur (Q19).
- Partie cadrage (cadrage automatique pendant la lecture) remplacée par D-049 (vue unique).

### D-020 : interface LibraryStore
- Date : 2026-10-14
- Décision : garder les 5 méthodes de 8.1 et ajouter `issues()`, `resolveDuplicate()`, `getSettings()`, `putSettings()`, `put(play, { expected })` ; `stamp` = compteur de relectures, pas une heure ; chaque `Change` porte son `stamp`.
- Raison : les horloges des deux PC et les dates posées par Drive peuvent diverger.
- Alternatives écartées : `stamp` horodaté.
- Origine : réponse de l'utilisateur (Q20).

### D-021 : mode dégradé
- Date : 2026-10-14
- Décision : dans Chrome sans dossier, bandeau « Aucun dossier choisi : la bibliothèque reste dans ce navigateur » avec « Choisir un dossier » ; au premier choix d'un dossier, proposer d'y copier les combinaisons du navigateur ; réglages et corbeille du mode dégradé dans IndexedDB.
- Raison : le texte de 8.6 ne convient pas à Chrome sans dossier.
- Alternatives écartées : aucune proposée.
- Origine : réponse de l'utilisateur (Q21).

### D-022 : conflits
- Date : 2026-10-14
- Décision : « Garder les deux » (modification extérieure) : ma version reçoit un nouvel id et le suffixe « (copie) » ; « Choisir celle-ci » : l'autre fichier part en corbeille ; « Remplacer » à l'import : l'ancienne version part d'abord en corbeille ; un doublon non résolu est en lecture seule.
- Raison : règle 9 de CLAUDE.md.
- Alternatives écartées : aucune proposée.
- Origine : réponse de l'utilisateur (Q22).

### D-023 : noms de fichiers et relecture
- Date : 2026-10-14
- Décision : nom court : on garde `[a-z0-9]`, tout le reste devient « - », tirets multiples réduits, tirets de bord retirés, 40 caractères, nom vide = `sans-nom` ; la relecture prend tout `*.json` de `combinaisons/` et ignore le reste (dont `.crswap`) ; en corbeille : `AAAA-MM-JJ_HH-MM-SS--<nom d'origine>`.
- Raison : copies de conflit Drive quel que soit leur nom ; caractères interdits par Windows.
- Alternatives écartées : relecture limitée à `*.combi.json`.
- Origine : réponse de l'utilisateur (Q23).

### D-024 : fichiers inattendus
- Date : 2026-10-14
- Décision : clé inconnue = fichier invalide, laissé intact ; `schemaVersion` supérieur à celui de l'application = fichier intact, message « créé par une version plus récente, recharger la page ».
- Raison : supprimer une clé effacerait des données à la sauvegarde suivante.
- Alternatives écartées : clés inconnues supprimées ou conservées telles quelles.
- Origine : réponse de l'utilisateur (Q24).

### D-025 : brouillon
- Date : 2026-10-14
- Décision : brouillon écrit dans IndexedDB à chaque modification, effacé après une sauvegarde réussie ; au démarrage, s'il diffère du fichier, proposer « Restaurer le brouillon » ou « Ignorer ».
- Raison : 3.5 prévoyait le brouillon sans comportement.
- Alternatives écartées : aucune proposée.
- Origine : réponse de l'utilisateur (Q25).

### D-026 : préférences par poste
- Date : 2026-10-14
- Décision : calques, vitesse, panneau replié, « S'arrêter aux options » et pause entre les temps en `localStorage` préfixé `abla-rck7:`, non synchronisés ; `reglages.json` contient au lot 1 les allures, la vitesse de passe et le thème.
- Raison : préférences d'affichage propres à chaque poste.
- Alternatives écartées : tout dans `reglages.json`.
- Origine : réponse de l'utilisateur (Q26).

### D-027 : dossiers hors arborescence 3.2
- Date : 2026-10-14
- Décision : ajout de `src/state/` (stores Zustand), `src/test/` (outils de test), `src/types/` (déclarations) et `e2e/`.
- Raison : 3.2 ne prévoyait ni stores ni outils de test.
- Alternatives écartées : stores rangés dans `editor/`, `player/` et `io/`.
- Origine : réponse de l'utilisateur (Q27).

### D-028 : protection de main
- Date : 2026-10-14
- Décision : statut CI « checks » obligatoire avant fusion, administrateurs compris, sans revue exigée ; plus aucun push direct sur `main`.
- Raison : pas de fusion si la CI est rouge (règle 10) ; travail en solo, pas d'auto-approbation possible.
- Alternatives écartées : revue obligatoire.
- Origine : réponse de l'utilisateur (validation du plan).

### D-029 : mise à jour de la SPEC et de la RECETTE en fin de lot
- Date : 2026-10-14
- Décision : à l'étape 7, commit dédié « Mise à jour de la spécification selon les décisions du lot 1 » couvrant tous les passages de SPEC.md et RECETTE.md que Q1 à Q27 modifient ou complètent ; sections listées dans la PR.
- Raison : la SPEC reste la source de vérité.
- Alternatives écartées : se limiter à 3.2, 3.3, 8.1, 8.3 et 8.6.
- Origine : demande de l'utilisateur en cours de lot.

### D-030 : mémoire du projet dans le dépôt
- Date : 2026-10-14
- Décision : `docs/plans/lot-N.md` (plan validé avec cases par étape et hash), `docs/ETAT.md` (état courant, 60 lignes au plus, réécrit), ce journal en entrées numérotées, section « Mémoire du projet » de `CLAUDE.md` avec `@docs/ETAT.md`, prompt « Reprise » qui s'appuie sur ces fichiers.
- Raison : contexte compacté, sessions interrompues et sessions sur deux PC ; la mémoire automatique est locale à une machine.
- Alternatives écartées : mémoire dans la conversation ou dans la mémoire automatique seulement.
- Origine : demande de l'utilisateur en cours de lot.
- Précisée par D-047 (longueur de `docs/ETAT.md`).

### D-031 : TypeScript 6.0
- Date : 2026-10-14
- Décision : TypeScript 6.0 (et non 7.0).
- Raison : `typescript-eslint` ne prend en charge que TypeScript < 6.1.
- Alternatives écartées : TypeScript 7 sans typescript-eslint.
- Origine : essai (dépendances de pairs vérifiées).

### D-032 : versions de la pile
- Date : 2026-10-14
- Décision : Vite 8, Vitest 5, ESLint 10 (config « flat »), React 19, Zod 4, Zustand 5, Playwright 1.64, actions GitHub aux dernières versions majeures (checkout v7, setup-node v7, upload-artifact v7, upload-pages-artifact v5, deploy-pages v5) ; versions figées par `package-lock.json`.
- Raison : versions stables courantes.
- Alternatives écartées : versions antérieures.
- Origine : choix technique.

### D-033 : un seul tsconfig
- Date : 2026-10-14
- Décision : un seul `tsconfig.json` (DOM et Node), `typecheck` = `tsc --noEmit`.
- Raison : commande imposée par CLAUDE.md ; les règles ESLint interdisent les API Node dans le code de l'application.
- Alternatives écartées : références de projets (`tsc -b`).
- Origine : choix technique.

### D-034 : règles ESLint de pureté et d'aplats
- Date : 2026-10-14
- Décision : dans `model/`, `engine/`, `field/`, `render/`, `config/` : interdiction de l'horloge, de l'aléa, des minuteries, de `window`/`document` et des imports React, Zustand ou des couches applicatives ; dans `render/` et `field/` : interdiction des dégradés, motifs, ombres et filtres ; dans `ui/` : interdiction du tiret cadratin dans les chaînes et le JSX. Le type `Ctx2D` n'expose ni dégradé ni motif.
- Raison : contrôle statique des règles 7 et 8 de CLAUDE.md et des conventions.
- Alternatives écartées : contrôle par revue seulement.
- Origine : choix technique.

### D-035 : e2e du mode dossier sur OPFS
- Date : 2026-10-14
- Décision : `window.showDirectoryPicker` remplacé par un sous-dossier OPFS via `page.addInitScript` ; aucun code propre aux tests dans l'application.
- Raison : vérifié sous Playwright Chromium (contexte par défaut) : OPFS écrit, le handle se stocke dans IndexedDB, survit au rechargement, `queryPermission` renvoie `granted`.
- Alternatives écartées : `launchPersistentContext` (inutile) ; faux système de fichiers injecté dans la page (handle non sérialisable).
- Origine : essai.

### D-036 : images de référence du rendu
- Date : 2026-10-14
- Décision : `@napi-rs/canvas` et police Atkinson Hyperlegible embarquée (OFL, `public/fonts/`), comparaison avec `pixelmatch` et une tolérance.
- Raison : rendu de texte identique entre Windows et la CI Linux ; police lisible, réutilisable au lot 2. Rendu vérifié sous Windows.
- Alternatives écartées : captures Playwright (images différentes selon le système) ; journal d'appels seul (pas une image).
- Origine : essai et choix technique.

### D-037 : point fixe de la passe
- Date : 2026-10-14
- Décision : 5 itérations (borne haute de 5.4) ; le ballon finit toujours exactement sur la receveuse à `arrivalT`.
- Raison : pire cas (receveuse à 7 m/s qui s'éloigne droit de la passeuse) : vitesse de vol réelle à environ 3 % de la vitesse de passe ; moins de 1 % pour une course en travers.
- Alternatives écartées : plus d'itérations ou méthode de Newton (hors 5.4).
- Origine : essai (test unitaire).

### D-038 : durée d'un temps
- Date : 2026-10-14
- Décision : une course de la même joueuse au-delà de la première dans un temps, une passe ignorée et les actions des lots 3 à 5 ne comptent pas dans la durée du temps.
- Raison : seules les actions appliquées ont une durée.
- Alternatives écartées : compter le délai des actions ignorées.
- Origine : choix technique.

### D-039 : caches
- Date : 2026-10-14
- Décision : clé = hachage cyrb53 de la sérialisation canonique de (combinaison, ligne, réglages), recalculée à chaque appel ; caches LRU bornés.
- Raison : le cache reste correct même si un objet était modifié en place.
- Alternatives écartées : mémoïsation par identité d'objet.
- Origine : choix technique.

### D-040 : sérialisation et géométrie
- Date : 2026-10-14
- Décision : clés JSON triées par ordre alphabétique, récursivement, ordre des tableaux conservé ; Catmull-Rom avec points fantômes réfléchis aux extrémités, points consécutifs confondus retirés, course d'un seul point = segment droit, 64 échantillons par segment avec interpolation ; tailles graphiques en pixels CSS à l'échelle 1 ; « estompé » = couleur pleine précalculée ; couleurs d'équipe Okabe-Ito (`#0072B2`, `#E69F00`).
- Raison : ordre stable exigé par 4.4 ; continuité et vitesse constante (5.3) ; aplats pour les GIF et jsPDF.
- Alternatives écartées : ordre des clés du schéma ; transparence pour l'estompage.
- Origine : choix technique (plan, section 6).

### D-041 : conventions de rendu du lot 1
- Date : 2026-10-14
- Décision : jetons et tailles en pixels CSS constants quel que soit le zoom ; ballon en ellipse plate dessinée contre le jeton de la porteuse, du côté de l'attaque ; passes en pointillés blancs (couleur du ballon), courses dans la couleur de la joueuse ; en lecture, la flèche d'une course terminée s'arrête au bord du jeton ; en mode schéma, les flèches finissent exactement aux points d'arrivée (aucun jeton n'y est dessiné) ; flèches de sens d'attaque de la ligne d'avantage à 12 % et 88 % de la largeur ; bandeau de consigne en haut, 2 lignes au plus avec points de suspension ; module `render/overlay.ts` ajouté pour la sélection, les poignées, le cadre de sélection et les aperçus d'outils ; `RunTrace.completed` ajouté à `SceneState`.
- Raison : lisibilité à toutes les échelles ; 13.3 (course en trait plein fléché, passe en pointillés fléchés) ; D-006.
- Alternatives écartées : jetons en mètres (illisibles en vue complète) ; flèches toujours reculées d'un rayon de jeton.
- Origine : choix technique, vérifié sur les images de référence.

### D-042 : comparaison des images de référence
- Date : 2026-10-14
- Décision : `pixelmatch` avec un seuil de 0,1 par pixel et au plus 0,5 % de pixels différents ; une image absente est écrite en local mais fait échouer la CI ; `UPDATE_SNAPSHOTS=1` régénère ; en cas d'échec, l'image obtenue et la différence sont écrites dans `src/test/image-snapshots/__diff__/` (artefact de CI).
- Raison : tolérer les écarts d'anticrénelage entre Windows et Linux sans laisser passer un vrai changement.
- Alternatives écartées : égalité stricte des octets (instable entre systèmes).
- Origine : choix technique.

### D-043 : détection et écriture dans le dossier
- Date : 2026-10-14
- Décision : une modification extérieure est détectée par la date et la taille, puis confirmée par le contenu complet (empreinte de la combinaison, `updatedAt` compris) ; à l'enregistrement, la concurrence optimiste compare la date et la taille connues, puis, si elles diffèrent, accepte d'écrire seulement si le fichier porte le même `updatedAt` que la version de départ ; un déplacement en corbeille écrit la copie, la relit et la compare avant de retirer l'original ; deux mises en corbeille du même fichier dans la même seconde reçoivent un préfixe `2-`, `3-`... ; en mode navigateur, la version d'une entrée est (`updatedAt`, longueur du texte).
- Raison : 8.3 (date, taille, puis contenu) ; règle 9 (jamais de perte) ; un fichier seulement « touché » par Drive ne doit pas bloquer l'enregistrement.
- Alternatives écartées : confirmation par `updatedAt` seul (manquerait une retouche à la main) ; suppression avant vérification de la copie.
- Origine : choix technique, couvert par les tests de `FolderStore`.
- Confirmation par `updatedAt` à l'enregistrement, et version d'une entrée en mode navigateur, remplacées par D-097 (empreinte du contenu).

### D-044 : couche d'état et interactions
- Date : 2026-10-14
- Décision : stores Zustand dans `src/state/` (`editorStore`, `playerStore`, `libraryState`, `settingsStore`) ; interactions du terrain et raccourcis dans `state/editorActions.ts` (positions déjà en mètres, logique déléguée à `editor/`) ; orchestration du stockage dans `state/session.ts` (démarrage, dossier ou navigateur, synchronisation, conflits, import et export) ; textes d'interface dans `ui/strings.ts`, aussi utilisés par la session pour les notifications ; un rechargement silencieux remet l'historique d'annulation à zéro ; pendant la lecture, un premier clic sur le terrain revient au mode édition du temps affiché sans rien modifier ; une nouvelle combinaison est enregistrée dès sa création ; le champ du nom n'est appliqué qu'à la validation (perte du focus ou Entrée, D-005) ; un geste (glisser) est appliqué en aperçu depuis l'état de départ et compte pour une étape.
- Raison : séparation 3.3.7 (React affiche, Zustand porte l'état, `model`, `engine`, `io` et `editor` portent la logique) ; un retour arrière après un rechargement réécrirait la version de l'autre PC ; éviter un renommage de fichier à chaque frappe.
- Alternatives écartées : historique conservé après rechargement ; logique dans les composants React.
- Origine : choix technique.

### D-045 : interface du lot 1
- Date : 2026-10-14
- Décision : une feuille de style globale (`ui/global.css`, jetons de couleur en variables) plutôt qu'un fichier CSS par composant ; inspecteur en sections (joueuse, course, passe, temps, combinaison, alertes, réglages de `reglages.json` repliés) ; suppression d'un temps confirmée par un dialogue (Ctrl+Z annule) ; notifications effacées après 6 s ; au démarrage, aucune combinaison n'est ouverte ; vignettes de la bibliothèque dessinées par `renderSchematic` du premier temps, en vue enregistrée ; le canevas expose sa transformation (`data-viewport`) et son mode (`data-mode`) pour les tests de bout en bout ; mise en page par une fonction pure `editor/phaseLayout.ts` pour l'arbre des temps ; plein écran sur la zone terrain et lecture.
- Raison : 6.1, 6.4, 6.5, 7, 8.7 ; tests de bout en bout sans code propre aux tests.
- Alternatives écartées : bibliothèque de composants ; CSS modules (peu de composants, une seule page).
- Origine : choix technique.

### D-046 : réponses en français
- Date : 2026-10-15
- Décision : Claude répond toujours en français ; consigne ajoutée à `CLAUDE.md`, section « Conventions ».
- Raison : langue de travail de l'utilisateur.
- Alternatives écartées : aucune.
- Origine : demande de l'utilisateur.

### D-047 : longueur de ETAT.md
- Date : 2026-10-15
- Décision : les 60 lignes de `docs/ETAT.md` sont un objectif indicatif, pas une limite stricte ; s'il faut plus de place, dépasser plutôt que supprimer une information nécessaire. Précise D-030 ; règle reportée dans `CLAUDE.md`, section « Mémoire du projet ».
- Raison : ne jamais perdre une information utile à la reprise pour tenir un plafond de longueur.
- Alternatives écartées : plafond strict de 60 lignes.
- Origine : demande de l'utilisateur.

### D-048 : stabilité du terrain
- Date : 2026-10-15
- Décision : la zone du terrain ne dépend pas du contenu des autres panneaux. Barre d'outils, transport et arbre des temps ont une hauteur fixe (aucune ligne `auto` dans la grille de la page) ; messages, bandeau et choix d'option s'affichent en surimpression du terrain ; panneaux latéraux de largeur fixe avec défilement interne. Quand le conteneur change de taille (fenêtre, bibliothèque repliée, plein écran), l'échelle et le point central sont conservés. Seules changent la vue : molette, Espace + glisser ou bouton du milieu, choix de la vue enregistrée, orientation, ouverture d'une combinaison, « Ajuster » et « Zone utile ».
- Raison : recette du lot 1 ; en Chrome, la hauteur de l'arbre des temps (ligne `auto`) suivait la hauteur de l'inspecteur, et le viewport réajustait le cadre à chaque changement de taille : l'échelle changeait à chaque sélection.
- Alternatives écartées : réajuster le cadre à chaque redimensionnement ; garder des barres qui passent à la ligne.
- Origine : retour de recette de l'utilisateur, causes mesurées avec Playwright.

### D-049 : vue unique pour l'édition et la lecture
- Date : 2026-10-15
- Décision : une seule vue (centre et échelle) sert à l'édition et à la lecture ; lancer la lecture, choisir une option ou revenir à l'édition ne la change pas. La liste « Cadrage » devient deux commandes ponctuelles : « Ajuster » (raccourci F, recadre sur la vue enregistrée) et « Zone utile » (recadre sur la boîte englobante de la ligne lue, plus 5 m). Molette et déplacement sont permis aussi pendant la lecture. Remplace la partie cadrage de D-019 (cadrage automatique appliqué pendant la lecture).
- Raison : le cadrage automatique changeait l'échelle au lancement de la lecture, au choix d'une option et au retour à l'édition, contraire à D-048.
- Alternatives écartées : cadrage automatique calculé sur toutes les lignes (le passage édition et lecture changeait encore l'échelle) ; SPEC 7 inchangée, exigence limitée à l'édition.
- Origine : réponse de l'utilisateur ; raccourci F proposé puis validé par l'utilisateur.

### D-050 : bandeau en surimpression
- Date : 2026-10-15
- Décision : le bandeau (mode dégradé, dossier à réautoriser) s'affiche par-dessus le haut du terrain, comme les messages, sans place réservée.
- Raison : son apparition ou sa disparition ne doit jamais déplacer le terrain (D-048).
- Alternatives écartées : barre d'état permanente ; emplacement réservé toujours présent.
- Origine : réponse de l'utilisateur.

### D-051 : seuil de glisser
- Date : 2026-10-15
- Décision : le glisser d'une joueuse ou d'un point de passage ne commence qu'au-delà de 4 pixels de mouvement depuis l'appui (`DRAG_THRESHOLD_PX`, HYPOTHÈSE) ; en deçà, un clic ne modifie rien.
- Raison : un clic de sélection avec un tremblement d'un pixel déplaçait la joueuse d'environ 0,14 m, créait une étape d'annulation et marquait la combinaison modifiée.
- Alternatives écartées : aucun seuil (comportement du lot 1).
- Origine : constaté pendant l'analyse de la recette.

### D-052 : section « Combinaison » de l'inspecteur
- Date : 2026-10-15
- Décision : la section « Combinaison » est en tête de l'inspecteur, toujours affichée, repliable ; l'état replié est mémorisé par poste avec les autres préférences (D-026). Ordre ensuite : joueuse, course ou passe, temps, alertes, réglages. Complète D-045.
- Raison : la section était sous celle du temps et disparaissait quand une joueuse était sélectionnée.
- Alternatives écartées : aucune.
- Origine : retour de recette de l'utilisateur.

### D-053 : version d'Ubuntu de la CI
- Date : 2026-10-15
- Décision : les jobs `checks` et `deploy` tournent sur `ubuntu-24.04` au lieu de `ubuntu-latest`.
- Raison : GitHub fait passer `ubuntu-latest` à Ubuntu 26 à partir du 19 octobre 2026 ; éviter une casse imprévue (navigateurs Playwright, images de référence).
- Alternatives écartées : rester sur `ubuntu-latest`.
- Origine : demande de l'utilisateur.

### D-054 : règle de recette
- Date : 2026-10-15
- Décision : tout ce qui est automatisable est couvert par les tests ; plus de listes de vérifications manuelles. En fin de lot, Claude liste au plus 5 vérifications manuelles, seulement celles qui sont à la fois indispensables et impossibles à automatiser. Le reste de la recette est une séance d'usage libre, suivie d'un retour de l'utilisateur. Inscrite dans `CLAUDE.md` (règle 12) et `docs/RECETTE.md`.
- Raison : réduire la recette manuelle à l'indispensable.
- Alternatives écartées : listes de cases à cocher par lot (lot 1).
- Origine : demande de l'utilisateur.

### D-055 : contrôle du blocage des fusions
- Date : 2026-10-15
- Décision : le blocage d'une fusion par une CI rouge se vérifie par lecture de la protection de `main` (`gh api repos/antoineblach/Abla_rckF7_tac/branches/main/protection`), sans branche volontairement cassée. Résultat du 15/10/2026 : statut « checks » obligatoire (application GitHub Actions), branche à jour exigée (`strict`), administrateurs inclus, aucune revue exigée, poussées forcées et suppression interdites. Conforme à D-028.
- Raison : vérification exacte et sans bruit dans l'historique.
- Alternatives écartées : branche avec un test cassé (point de la recette du lot 1).
- Origine : demande de l'utilisateur.
- Protection supprimée par le passage du dépôt en privé, puis recréée à l'identique le 23/10/2026 (D-102).

### D-056 : raccourcis et focus des contrôles
- Date : 2026-10-15
- Décision : les raccourcis clavier (et Espace pour se déplacer) restent actifs quand le focus est sur une case à cocher, un bouton ou un sélecteur de couleur ; seuls les champs de texte, les listes (recherche par lettre) et le curseur temporel (flèches) gardent les touches pour eux. Module `ui/hooks/typing.ts`.
- Raison : après un clic sur « Porteuse du ballon au départ », la touche R ne choisissait plus l'outil Course ; défaut révélé par les tests de bout en bout ajoutés selon D-054.
- Alternatives écartées : tout élément `input` bloque les raccourcis (lot 1).
- Origine : constaté pendant la correction (tests de bout en bout).

## Lot 2 : exports GIF et PDF

Les entrées D-057 à D-070 reprennent les réponses aux questions Q1 à Q16 du plan du lot 2 (`docs/plans/lot-2.md`, section 9) et son complément (section 11).

### D-057 : PDF vectoriel
- Date : 2026-10-15
- Décision : les vignettes du PDF sont dessinées par `renderSchematic` sur le contexte 2D de jsPDF (vectoriel). Le choix est acquis si l'étape 0 confirme quatre points : ballon en courbes de Bézier, découpe et pointillés corrects ; police, accents, apostrophe typographique et guillemets ; jsPDF dans un Worker ; poids mesurés. Arrêt et nouvelle question seulement si une limite bloquante apparaît.
- Raison : 5 à 8 fois plus léger que des images à 300 dpi (estimation), net à tout zoom et à l'impression ; les limites du contexte de jsPDF relevées dans son code source sont contournables.
- Alternatives écartées : images PNG à 300 dpi (repli si limite bloquante).
- Origine : réponse de l'utilisateur (Q1), sur évaluation documentaire du plan.
- Confirmée par l'étape 0 (D-071).

### D-058 : GIF enchaîné
- Date : 2026-10-15
- Décision : carton titre ; passage ralenti complet (tronc, option A, carton « Option B : <condition> », reprise au point d'option, option B, et ainsi de suite) ; carton « Vitesse réelle » ; passage complet à vitesse réelle ; pause finale. Les feuilles se suivent dans l'ordre de l'arbre ; chaque option reprend au point d'option où elle diverge de la précédente ; le carton est préfixé de « Temps n, » quand la combinaison a plusieurs points d'option ; une condition vide donne « Option B ».
- Raison : 9.2 ne fixait ni l'ordre des vitesses dans un GIF enchaîné ni le cas de plusieurs points d'option.
- Alternatives écartées : chaque option jouée au ralenti puis à vitesse réelle ; reprise toujours au premier point d'option.
- Origine : réponse de l'utilisateur (Q2, Q3).

### D-059 : durées des cartons et maintiens
- Date : 2026-10-15
- Décision : carton titre 1,5 s (SPEC) ; carton d'option 2 s et carton de vitesse 1 s (HYPOTHÈSES) ; la dernière image de chaque option est tenue 1 s avant le carton suivant ; pause finale de 2 s (SPEC) ; un carton ou une image tenue est une seule image GIF de longue durée.
- Raison : voir le placement final de chaque option ; poids (une image au lieu de 12 à 30).
- Alternatives écartées : aucun maintien avant les cartons (proposition initiale).
- Origine : réponse de l'utilisateur (Q4, avec l'ajout du maintien de 1 s).

### D-060 : habillage des exports
- Date : 2026-10-15
- Décision : la scène est toujours dessinée par `render` ou `renderSchematic` ; cartons, en-tête et pastille sont dessinés par des fonctions pures de `render/captions.ts` avec les mêmes primitives ; les textes des pages PDF (titres, notes, consignes, sommaire) passent par l'API texte de jsPDF. Image du GIF : en-tête en haut (numéro du temps à gauche, pastille à droite), consigne en bandeau juste dessous, toujours présente même si le calque « consigne » du lecteur est éteint, terrain cadré dans la zone restante. Pastille « Ralenti » à 0,5x et « Vitesse réelle » à 1x, dans tous les modes de vitesse ; carton titre : nom de la combinaison, et l'option en sous-titre pour un GIF par option.
- Raison : 9.1 interdit un rendu propre aux exports ; l'habillage n'est pas une scène.
- Alternatives écartées : consigne en bas de l'image ; pastille seulement en mode deux vitesses.
- Origine : réponse de l'utilisateur (Q5, Q6).

### D-061 : lisibilité sur téléphone
- Date : 2026-10-15
- Décision : téléphone de 6 pouces au format 19,5:9, soit 64 mm de large ; texte d'au moins 2,5 mm de corps ; le plus petit texte (numéros des jetons) mesure au moins largeur de l'image × 2,5 / 64 (21 px à 540 px), et toutes les tailles du thème suivent. En paysage, le téléphone est tourné : la largeur d'écran retenue est son long côté (environ 139 mm). Valeurs en HYPOTHÈSE dans `defaults.ts`.
- Raison : 9.2 demande une taille minimale garantissant la lecture quand le GIF occupe la largeur de l'écran ; sans téléphone tourné, les jetons d'un GIF paysage auraient un rayon d'environ 4,5 m.
- Alternatives écartées : largeur de 64 mm aussi en paysage.
- Origine : réponse de l'utilisateur (Q7).

### D-062 : thèmes des exports
- Date : 2026-10-15
- Décision : GIF : Contraste fort par défaut, au choix parmi Écran, Contraste fort et Impression N&B. PDF « Couleur » : nouveau thème « Impression couleur » (fond blanc ou très clair, lignes du terrain grises, couleurs d'équipe conservées). PDF « Noir et blanc » : thème « Impression N&B » : jetons A pleins noirs à numéro blanc, jetons B creux (fond blanc, contour et numéro noirs) quelle que soit la couleur de la joueuse, courses noires en trait plein, passes en pointillés, temps précédents en gris clair, terrain blanc à lignes gris moyen, en-buts gris très clair, ligne d'avantage en tirets noirs fins. Les deux thèmes d'impression ne sont pas proposés comme thème de l'éditeur.
- Raison : le fond vert foncé du Contraste fort consomme trop d'encre à l'impression couleur ; 9.3 fixe les conventions du noir et blanc.
- Alternatives écartées : PDF couleur en Contraste fort (proposition initiale).
- Origine : réponse de l'utilisateur (Q8, Q9).

### D-063 : vignettes et mise en page du PDF
- Date : 2026-10-15
- Décision : un même cadrage pour toutes les vignettes d'une combinaison : boîte englobante de toutes ses lignes plus 5 m (pas la vue enregistrée), attaque vers le haut, rapport hauteur sur largeur de la boîte borné entre 0,45 et 1 (HYPOTHÈSE). Impression (A4 paysage) : en-tête (titre, catégorie, notes) ; rangée du tronc jusqu'au premier point d'option compris ; puis une rangée par option, titrée « Option A : <condition> », dans l'ordre de l'arbre, en pleine largeur et sans retrait ; libellé et consigne sous chaque vignette ; une rangée trop longue passe à la ligne ; vignettes de 90 mm au plus réduites jusqu'à 60 mm (HYPOTHÈSES) ; une rangée n'est jamais coupée entre deux pages ; suite avec rappel du titre. Téléphone : page de 100 mm de large (HYPOTHÈSE), hauteur ajustée au contenu, une vignette pleine largeur par ligne, sections d'options empilées, textes dimensionnés selon D-061.
- Raison : 9.3 ne précisait ni le cadrage ni l'orientation des vignettes ni la disposition exacte des rangées.
- Alternatives écartées : vue enregistrée de la combinaison ; rangées d'options en retrait sous leur point d'option.
- Origine : réponse de l'utilisateur (Q10, Q11).

### D-064 : cahier de jeu
- Date : 2026-10-15
- Décision : dialogue avec un titre saisi (par défaut « Cahier de jeu », ou le nom de la catégorie choisie), des cases à cocher par combinaison et le choix rapide d'une catégorie ; ordre = tri courant de la bibliothèque ; page de titre : titre, catégorie ou « Sélection », nombre de combinaisons et date, la plus récente des dates de modification des combinaisons incluses ; sommaire : nom, catégorie, numéro de page et lien ; numéro de page en pied de chaque page sauf la page de titre ; signets PDF en plus. Un PDF d'une seule combinaison n'a ni page de titre ni sommaire. La date de création inscrite dans le PDF est la plus récente des dates de modification des combinaisons incluses (déterminisme).
- Raison : 9.3 ne précisait ni la sélection ni le contenu de la page de titre.
- Alternatives écartées : page de titre sans date ; date de l'export (non déterministe).
- Origine : réponse de l'utilisateur (Q12, avec l'ajout de la date).

### D-065 : export déjà présent, échec d'écriture
- Date : 2026-10-15
- Décision : existence vérifiée avant l'encodage, puis de nouveau à l'écriture. « Remplacer » déplace d'abord l'ancien fichier dans `_corbeille/` (copie vérifiée, D-043) ; « Garder les deux » ajoute « -2 », « -3 » au nom ; « Annuler » arrête l'export. « Un GIF par option » : tout ou rien, tous les fichiers écrits à la fin. Si l'écriture échoue, le fichier vide que l'export vient de créer est retiré, seulement s'il n'existait pas avant et qu'il est toujours vide.
- Raison : 9.1 (jamais écrasé sans confirmation) et règle 9 (jamais d'effacement définitif), comme D-022 pour l'import ; le fichier vide n'a jamais contenu de données.
- Alternatives écartées : écrasement après confirmation ; laisser le fichier vide après un échec.
- Origine : réponse de l'utilisateur (Q13).

### D-066 : noms des exports
- Date : 2026-10-15
- Décision : GIF : `<nom-court>--<orientation>[-hd][-enchaine | -option-b | -option-a-b][-ralenti | -reel].gif`, orientation `portrait`, `paysage` ou `carre` ; lignes : `-enchaine`, ou les lettres des options choisies depuis la racine, rien quand la combinaison n'a qu'une ligne ; vitesse : rien pour les deux vitesses. PDF : `<nom-court>--impression[-nb].pdf` ou `--telephone[-nb].pdf` ; cahier : `<nom-court du titre>--cahier-impression[-nb].pdf` (ou `-telephone`).
- Raison : 9.1 (`<nom-court>--<variante>.<ext>`) sans liste des variantes ; deux variantes différentes ne doivent jamais porter le même nom.
- Alternatives écartées : aucune proposée.
- Origine : réponse de l'utilisateur (Q14).

### D-067 : version allégée d'un GIF
- Date : 2026-10-15
- Décision : au-delà de 8 Mo, l'outil propose une version allégée : même contenu, résolution standard si l'export était en haute qualité, cadence ramenée à 8 images/s (HYPOTHÈSE) ; un clic relance l'export.
- Raison : 9.2 ne définissait pas la version allégée.
- Alternatives écartées : une seule vitesse ; palette réduite.
- Origine : réponse de l'utilisateur (Q15).

### D-068 : préférences d'export
- Date : 2026-10-15
- Décision : les préférences d'export sont dans `reglages.json` (SPEC 4.4), qui passe en version 2 avec migration, fixture et test (règle 6). Défauts : GIF portrait, enchaîné, deux vitesses, standard, Contraste fort, optimisation activée ; PDF impression, couleur. Les calques restent ceux du lecteur, par poste (D-026), repris tels quels dans le GIF. Le modèle `Play` ne change pas.
- Raison : 4.4 range les préférences d'export dans `reglages.json`, synchronisé entre les deux PC.
- Alternatives écartées : préférences d'export par poste dans localStorage.
- Origine : réponse de l'utilisateur (Q16).
- Exception (lot 3) : le calque « En-avant » du lecteur n'est jamais repris dans les exports, ni GIF ni PDF (D-086).

### D-069 : optimisation des GIF désactivable
- Date : 2026-10-15
- Décision : un réglage d'export désactive la transparence des pixels inchangés des GIF ; activée par défaut. Contrôlé à la vérification manuelle WhatsApp (un envoi avec, un sans).
- Raison : la conversion GIF vers MP4 de WhatsApp pourrait mal rendre la transparence.
- Alternatives écartées : optimisation toujours active.
- Origine : demande de l'utilisateur à la validation du plan.

### D-070 : prototypes et dépendances de test
- Date : 2026-10-15
- Décision : les prototypes demandés par le prompt du lot 2 (PDF vectoriel ou images, poids d'un GIF, Worker) forment l'étape 0, après validation du plan ; le plan n'en contenait qu'une évaluation documentaire. Dépendances de développement ajoutées : `pdfjs-dist` (lecture des PDF produits dans les tests : pages, liens, signets, texte, trame d'une vignette) et `omggif` avec `@types/omggif` (décodage des GIF produits dans les tests).
- Raison : le mode plan interdit d'installer ou d'exécuter ; vérifier les fichiers réellement produits plutôt que des appels.
- Alternatives écartées : prototypes pendant le mode plan, hors dépôt ; évaluation documentaire seule ; analyseurs écrits à la main.
- Origine : réponse de l'utilisateur (méthode des prototypes) ; dépendances validées avec le plan.

### D-071 : résultats de l'étape 0, vectoriel confirmé
- Date : 2026-10-15
- Décision : les quatre conditions de D-057 sont remplies ; le PDF est vectoriel. Conséquences techniques retenues pour les étapes suivantes : ballon dessiné par 4 courbes de Bézier en pixels, sans transformation (`bezierCurveTo` ajouté à `Ctx2D`) ; vignette découpée par `clip()` (ajouté à `Ctx2D`) et placée par `translate()` ; aucun `scale()` dans le rendu ; tailles de police visées un peu au-dessus d'un entier de points (7,05 pt) ; GIF avec palette globale de 255 couleurs plus un indice transparent, `dispose: 1` explicite, tableaux autonomes passés à `quantize` et `applyPalette` ; dépendances optionnelles de jsPDF (html2canvas, dompurify, canvg) remplacées par des modules vides dans le build.
- Raison : mesures de l'étape 0 (plan, section 1.5) : PDF vectoriel de 63 Ko la page contre 160 à 210 Ko en images, texte et police corrects, jsPDF, gifenc et police fonctionnels dans un Worker sous Chromium et Firefox ; le `drawBall` actuel n'est pas dessiné par jsPDF et repeint le dernier jeton ; gifenc passe en mode 2 avec la transparence sans `dispose` explicite ; GIF de 20 s : 0,54 à 1,5 Mo avec l'optimisation, 3,9 à 4,5 Mo sans, images composées identiques au pixel près.
- Alternatives écartées : images à 300 dpi ; ballon dessiné par transformation d'un `arc`.
- Origine : essai (prototypes P1 à P4 de l'étape 0).

### D-072 : réglages v2 et valeurs de l'étape 1
- Date : 2026-10-15
- Décision : un `reglages.json` v1 est migré en mémoire à la lecture et n'est réécrit en v2 qu'au prochain enregistrement des réglages ; une version plus récente est signalée (« recharger la page ») et n'est jamais réécrite, dans le dossier comme dans le navigateur (garde ajoutée à `IdbStore.putSettings`). Libellés des catégories, des temps et des options dans `model/labels.ts`, nom court dans `model/shortName.ts`, partagés par l'interface et les exports. Seuil d'alerte de 8 Mo compté en Mio (8 × 1024 × 1024 octets, comme l'affiche Windows, HYPOTHÈSE). Long côté du téléphone : 138 mm (6 pouces au format 19,5:9 : 63,9 × 138,4 mm).
- Raison : une lecture ne modifie jamais un fichier de l'utilisateur (règle 9) ; 4.4 et D-024 ; l'interface et les exports affichent les mêmes libellés.
- Alternatives écartées : réécrire `reglages.json` en v2 dès la lecture ; 8 Mo décimaux.
- Origine : choix technique (étape 1).

### D-073 : rendu des exports (étape 2)
- Date : 2026-10-15
- Décision : thèmes `printColor` et `printBw` dans `defaults.ts` (tailles du Contraste fort, traits du terrain et des jetons à 2 px, ligne d'avantage à 1,5 px), absents de la liste des thèmes de l'éditeur ; nouvelles valeurs de thème : couleur des passes (blanche à l'écran, noire à l'impression), couleur des courses et remplissage des jetons par équipe (`null` = couleur de la joueuse ; N&B : A noir, B blanc, course noire), pastille ; passe invalide grise en N&B. Habillage dans `render/captions.ts` : en-tête de 30 px à l'échelle 1 (libellé à gauche, pastille à droite), cartons pleine image (titre sur 4 lignes au plus, sous-titre), tailles en HYPOTHÈSE (`CAPTION_SIZES`). Le bandeau d'un export garde une hauteur fixe (`minLines`) pour que le cadrage ne bouge jamais ; le viewport accepte des marges intérieures (`insets`) et cadre le terrain sous l'en-tête et le bandeau. Ballon en 4 courbes de Bézier (D-071) : images de référence du lot 1 inchangées dans la tolérance de D-042.
- Raison : D-060, D-062 ; 9.2 (cadrage fixe) ; jsPDF.
- Alternatives écartées : thèmes d'impression ajoutés à l'éditeur ; bandeau de hauteur variable (le terrain sauterait d'un temps à l'autre).
- Origine : choix technique (étape 2).

### D-074 : plan et encodage des GIF (étape 3)
- Date : 2026-10-15
- Décision : la dernière image d'une ligne a pour délai le maintien seul (1 s avant un carton, 2 s à la fin), ses images précédentes la cadence exacte en centièmes arrondis en cumulé ; un segment de durée D joué à la vitesse s compte ⌈D·f/s⌉ + 1 images. Le sous-titre du carton titre d'un GIF par option liste les options de la ligne, séparées par « ; ». La palette est calculée sur le premier carton de chaque sorte et 12 images de scène réparties (HYPOTHÈSE) ; 255 couleurs plus l'indice transparent, magenta jamais affiché. Le bandeau garde le nombre de lignes de la plus longue consigne du fichier (0 à 2). La « version allégée » porte le suffixe `-allege` (sans `-hd`) : `croisee-au-centre--portrait-enchaine-allege.gif`.
- Raison : D-059 (maintiens), 9.2 (cadrage fixe, palette sans scintillement) ; D-066 exige que deux variantes différentes ne portent jamais le même nom, or la version allégée d'un GIF standard aurait le nom du GIF complet.
- Alternatives écartées : maintien ajouté au délai normal de la dernière image ; même nom pour la version allégée (remplacement du GIF complet).
- Origine : choix technique (étape 3), le suffixe découle de D-066.

### D-075 : mise en page et écriture des PDF (étape 4)
- Date : 2026-10-15
- Décision : une rangée d'option contient l'option et ses temps suivants jusqu'au point d'option suivant compris ; les sous-options suivent dans l'ordre de l'arbre ; leur titre est préfixé de « Temps n, » quand la combinaison a plusieurs points d'option (comme les cartons, D-058). Largeur des vignettes cherchée par pas de 1 mm de 90 à 60 mm ; une rangée plus haute qu'une page entière est la seule coupée, entre deux lignes de vignettes. Sous une vignette : libellé, puis consigne sur 3 lignes au plus (HYPOTHÈSE). Téléphone : corps 11,5 pt, numéros des jetons 12 pt (minimum 11,1 pt par D-061, jsPDF arrondit à l'entier inférieur). Cahier : sommaire nom, catégorie et page sur une ligne (impression) ou deux (téléphone) ; numéros de page seulement dans un cahier ; date de la page de titre au format « 15 octobre 2026 » (date UTC). Date de création de tout PDF : la plus récente des dates de modification de ses combinaisons ; identifiant de fichier : empreinte de son contenu. Cadre gris fin autour des vignettes.
- Raison : D-063, D-064 et D-061 précisés là où ils ne fixaient pas le détail ; déterminisme (même PDF octet pour octet).
- Alternatives écartées : rangées d'options en retrait ; numéros de page aussi dans le PDF d'une combinaison.
- Origine : choix technique (étape 4).

### D-076 : io des exports et Worker (étape 5)
- Date : 2026-10-15
- Décision : le gestionnaire de messages du Worker (`export/worker/handler.ts`) ne dépend pas de la portée du Worker ; les tests l'exécutent sous Node derrière le même client que le navigateur (moteur « en ligne », messages clonés et octets transférés). Une décision « Remplacer » ou « Garder les deux » vaut pour chaque nom présenté ; un export apparu pendant l'encodage déclenche une nouvelle question avant toute écriture. « Tout ou rien » : si un fichier d'un même export échoue, ceux déjà écrits par cet export partent en corbeille. Un résultat arrivé après « Annuler » est ignoré. La mise en corbeille par copie vérifiée travaille en octets (`io/trash.ts`) pour les combinaisons comme pour les exports ; `exports/` est créé avec la structure du dossier. Sans dossier (mode navigateur ou Firefox), les exports sont téléchargés. La police est chargée par le Worker sous `BASE_URL` (une fois, `FontFace`), les mêmes octets servent à jsPDF.
- Raison : D-065 (jamais d'écrasement sans décision, rien de partiel), règle 9, plan section 3.
- Alternatives écartées : décision globale appliquée aussi aux fichiers apparus ensuite ; logique du Worker testée seulement de bout en bout.
- Origine : choix technique (étape 5).

### D-077 : interface des exports (étape 6)
- Date : 2026-10-15
- Décision : « Exporter GIF » et « Exporter PDF » dans la barre d'outils (combinaison ouverte, modifications non enregistrées comprises) ; « Cahier de jeu » dans la bibliothèque. Les dialogues reprennent les préférences de `reglages.json` et les y écrivent au lancement, seulement si elles ont changé ; ils affichent le nom du ou des fichiers. Une seule fenêtre d'export à la fois : dialogue, progression (barre, étape, « Annuler », puis « Enregistrement… » non annulable), question « Export déjà présent » (Remplacer, Garder les deux, Annuler), résultat (fichiers, tailles en Ko ou Mo, lieu, alerte au-delà de 8 Mo avec « Exporter une version allégée »). Une annulation affiche « Export annulé : aucun fichier écrit. ». Cahier : toutes les combinaisons cochées par défaut, dans l'ordre du tri courant de la bibliothèque, copies en lecture seule exclues ; le choix rapide d'une catégorie coche ses combinaisons et donne son nom au titre ; sous-titre « Sélection » sauf si la sélection est exactement une catégorie ; les combinaisons sont enregistrées avant l'export. Le morceau principal du build ne contient ni jsPDF ni gifenc (contrôlé par un test sur `dist/`). Sous 1500 px de large, le titre de l'application est masqué dans la barre d'outils (il reste dans l'onglet), pour garder « Changer de dossier » visible avec les deux boutons d'export.
- Raison : 9.1 à 9.3, D-064, D-065, D-067, D-068 ; l'interface ne gèle jamais (tâches longues de la page mesurées sous 200 ms pendant un export).
- Alternatives écartées : export de la version enregistrée seulement ; notification éphémère pour le résultat (la taille doit rester lisible).
- Origine : choix technique (étape 6).

## Lot 3 : mise en place

Les entrées D-078 à D-093 reprennent les réponses aux questions Q1 à Q19 du plan du lot 3 (`docs/plans/lot-3.md`, section 12), données le 16 octobre 2026.

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

Plan : `docs/plans/lot-3-corrections.md`, validé le 23 octobre 2026 avec les réponses Q1 à Q3 et trois compléments.

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

## Exploitation du dépôt

### D-102 : le dépôt reste public
- Date : 2026-10-23
- Décision : le dépôt `antoineblach/Abla_rckF7_tac` reste public. Sans abonnement payant, GitHub Pages et la protection de branche en dépendent : passer le dépôt en privé désactive Pages et supprime la protection de `main`.
- Raison : incident du 23/10. Le dépôt était passé en privé entre le 16 et le 23/10. Le premier déploiement après la fusion de la PR #5 (`fb70316`) a échoué (404, « Ensure GitHub Pages has been enabled »), et la protection de `main` avait disparu. Rétabli le même jour :
  - dépôt repassé en public ;
  - Pages réactivé (`gh api -X POST repos/antoineblach/Abla_rckF7_tac/pages -f build_type=workflow`) ;
  - déploiement relancé (`gh run rerun 40000159609 --failed`), vert ;
  - protection de `main` recréée à l'identique de D-055 : statut « checks » de l'application GitHub Actions (15368), branche à jour exigée, administrateurs inclus, aucune revue, poussées forcées et suppression interdites. Vérifiée par la réponse de l'API, puis relue par `gh api` le même jour.
- Alternatives écartées : dépôt privé avec un abonnement payant.
- Origine : incident constaté par l'utilisateur au déploiement de la PR #5.

## Lot 3 bis : courses réalistes

Plan : `docs/plans/lot-3bis.md`, validé le 23 octobre 2026 avec les réponses Q1 à Q13. Origine commune : retour de la séance d'usage du 23/10 (6 notes de l'utilisateur).

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

### D-106 : course qui finit lancée
- Date : 2026-10-23
- Décision : drapeau explicite « Finit lancée » : la course finit au plafond de son dernier segment au lieu de freiner. Elle n'a d'effet que si elle se termine à la fin de son temps ; sinon (la joueuse attend la fin des autres actions) freinage normal, sans alerte, avec la mention « Sans effet : attente de x s avant le temps suivant » (calcul en deux passes, sans nouvelle bascule). Prolongée dans le temps suivant d'une ligne quand la joueuse y a sa première course avec un délai effectif nul : cette course part à la vitesse de fin et dans la direction d'arrivée de la course parente (premier segment en courbe de Bézier cubique raccordée), sans changer ses points de passage ni le temps parent. Non prolongée : arrêt net à la frontière dans cette option, avertissement `runNotContinued` sur la course lancée, nommant l'option ; aucune alerte dans une feuille. Posé par la migration (D-104) et par l'outil Course, dans la même étape d'annulation, quand la course tracée (délai 0) fait que toutes les options du temps suivant prolongent la course du temps précédent. Pour un même `t` dans le tronc, toutes les options donnent le même état (5.2).
- Raison : sans lui, le profil marquerait un arrêt à chaque frontière de temps ; le drapeau laisse le coach privilégier la fluidité de l'option principale.
- Alternatives écartées : règle automatique sans drapeau (ajouter une option sans suite arrêterait la course dans toutes les options) ; course lancée pendant l'attente ; décélération dans le prolongement dans une option sans suite (déplacement non dessiné).
- Origine : réponses Q4 (avec le cas de l'attente) et Q13 a.

### D-107 : durée imposée
- Date : 2026-10-23
- Décision : `durationOverride` est gardée, sans migration : toutes les vitesses cibles de la course sont multipliées par un même facteur pour qu'elle dure exactement la durée imposée, profil compris ; plafond au seuil rouge, alerte si la durée est inatteignable. Exclusive avec un lien en vitesse ajustée : poser l'une retire l'autre.
- Raison : les combinaisons existantes gardent exactement leurs durées ; un seul solveur (D-105).
- Alternatives écartées : la retirer (la migration ne peut pas la convertir sans le moteur) ; la convertir en lien.
- Origine : réponse Q5.

### D-108 : liens de synchronisation
- Date : 2026-10-23
- Décision : un lien permanent cale un point d'une course (sa fin ou un point de passage, rendez-vous) sur un événement d'une autre action du même temps : fin ou point d'une course, lâcher ou arrivée d'une passe ou d'un jeu au pied, formation d'un regroupement. Réglage « Départ différé » (délai calculé, délai enregistré ignoré) ou « Vitesse ajustée » (facteur commun sur les segments avant le rendez-vous, les suivants gardent leurs vitesses). Résolution : courses liées dans l'ordre du graphe des dépendances ; pour chacune, simulation du temps avec les mouvements courants et lecture de l'instant cible (arrêts par un regroupement, reports et lâchers à la réception compris). Replis : délai négatif, départ à 0 (`syncLate`) ; vitesse nécessaire au-delà du seuil rouge, facteur plafonné (`syncSpeedCapped`) ; cible supprimée, invalide ou jamais atteinte, lien ignoré (`syncTargetMissing`, `syncTargetInvalid`) ; cycle, liens ignorés (`syncCycle`). Supprimer l'action cible garde le lien ; supprimer un point qui porte un lien retire ce lien, avec un message ; « Dupliquer » un temps recopie ses liens. Lien dessiné en tirets fins quand l'une des deux actions est sélectionnée, dans la surcouche d'édition seulement. Limite : un lien qui change le ramassage d'un ballon au sol peut décaler une cible déjà résolue.
- Raison : note 2 (fins de courses synchronisées, rendez-vous) ; l'édition n'est jamais bloquée.
- Alternatives écartées : vitesse uniforme avant le rendez-vous ; lien ignoré au-delà du seuil rouge (saut quand on déplace la cible) ; résolution avant la boucle d'événements (cibles approchées).
- Origine : réponse Q6.

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

### D-112 : calque « Vitesses »
- Date : 2026-10-23
- Décision : pastille ronde orange ou rouge à « ! » au milieu de chaque segment au-delà d'un seuil : toujours dans l'éditeur ; dans le lecteur selon le calque « Vitesses » (par poste, activé par défaut), dès que la joueuse entre dans le segment ; jamais dans les GIF, les PDF ni les vignettes de la bibliothèque (comme D-086).
- Raison : aide pour le coach, pas une information pour les joueuses.
- Alternatives écartées : anneau autour du jeton.
- Origine : réponse Q11.

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

### D-118 : pistes reportées
- Date : 2026-10-23
- Décision : reportées à plus tard et notées dans `docs/ETAT.md` : accélération exponentielle (Q13 b), vitesse initiale au temps 1 (Q13 c), ballon porté du côté du sens de course (Q13 d). Le raccord de tangente (Q13 a) est fait dans ce lot (D-106).
- Raison : choix de l'utilisateur.
- Alternatives écartées : tout faire dans ce lot.
- Origine : réponse Q13.
