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
