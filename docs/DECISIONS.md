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
