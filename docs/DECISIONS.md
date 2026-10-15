# Journal des décisions

Décisions prises en cours de route (date, décision, raison). Les décisions structurantes initiales sont dans `SPEC.md`, section 16.

## Lot 1 : socle

### Réponses aux points ambigus du plan (14 octobre 2026)

| N° | Décision | Raison |
|---|---|---|
| Q1 | Terrain réduit : les lignes de 22 m restent à 22 m de la ligne de but, celles de 10 m à 10 m de la médiane, celles de 15 m à 15 m de la touche ; seuls les écarts entre ces lignes diminuent. SPEC 13.1 corrigée. | Texte de la Règle 1.3 : « the distance between the 10-metre lines and 22-metre lines is reduced accordingly », de même pour les lignes de 15 m. |
| Q2 | Lignes en tirets : tirets de 5 m espacés de 5 m. Poteaux espacés de 5,6 m. Les deux en HYPOTHÈSE. | La Règle 1 donne la longueur des tirets, pas leur intervalle ; l'écartement des poteaux n'est lisible que sur le schéma. |
| Q3 | `evaluate(play, branchPath, t, settings, caches)` ; `renderSchematic(ctx, play, branchPath, phaseId, viewport, theme, settings, caches)`. | Allures et vitesse de passe viennent de `reglages.json` ; la pureté exige de les passer en paramètre. |
| Q4 | Les types des lots 3 à 5 sont déclarés en TypeScript et présents dans les unions ; le moteur les ignore en le signalant. Le schéma zod v1 les rejette : ils arriveront avec schemaVersion 2. | Les prompts des lots 3 et 5 imposent un incrément de version et des migrations. |
| Q5 | Renommer une combinaison : écrire le nouveau fichier, puis déplacer l'ancien en corbeille, toujours. Le renommage n'a lieu qu'à la validation du nom (perte du focus ou Entrée). | Cohérent avec la recette ; `move()` natif sur fichiers locaux non garanti dans Chrome ; évite de remplir la corbeille pendant la frappe. |
| Q6 | Paysage : terrain fixe (x vers la droite), une flèche de sens d'attaque est dessinée sur la ligne d'avantage. Portrait et carré : attaque vers le haut. Le viewport sait faire une rotation de 180°, inutilisée au lot 1 (au lot 2, les GIF paysage attaqueront toujours vers la droite). | Choix de l'utilisateur. |
| Q7 | Ballon : case « Porteuse au départ » dans l'inspecteur de joueuse ; « Ajouter / retirer le ballon » dans l'inspecteur de combinaison. Le ballon n'est jamais dans `setup.positions`. `ballPosition` sans porteuse : accepté à la lecture, non éditable au lot 1. | La spécification ne prévoyait aucun moyen d'éditer le ballon ; le ballon au sol relève du lot 3. |
| Q8 | Placements de départ : A sur x = 40 m, n° 1 à 7 de y = 5 m à y = 65 m tous les 10 m ; en 7 contre 7, B en face sur x = 50 m ; ballon à A n° 4 ; A attaque. Nouvelle combinaison : nom « Nouvelle combinaison », catégorie ruck/jeu courant, vue terrain complet. | Positions non précisées par la spécification. |
| Q9 | Une position héritée d'un temps précédent ne se déplace pas ; seuls les points de passage du temps sélectionné bougent. « Placer joueuse » fixe le placement initial, quel que soit le temps affiché. | Préserve la continuité (5.2) et le tronc commun. |
| Q10 | Mode schéma éditable quand un temps est sélectionné ou que la lecture est arrêtée à son début ; image `render` non éditable pendant la lecture ou après un déplacement du curseur ; tout geste d'édition ramène au mode schéma du temps courant. | Relation éditeur et lecteur non précisée. |
| Q11 | Bascule « S'arrêter aux options », activée par défaut, indépendante de la pause entre les temps. Activée : arrêt au point d'option, un bouton par option. Désactivée : option par défaut. | « Lecture manuelle » et « automatique » n'étaient pas définies. |
| Q12 | « Ajouter un temps » : sur une feuille seulement. « Insérer un temps après » : temps vide inséré entre le temps sélectionné et ses enfants, qui lui sont rattachés. « Créer une option à partir d'ici » : sœur vide du temps ; s'il était seul, il devient l'option A par défaut ; indisponible sur la racine. « Dupliquer » : sœur avec copie des actions, sans descendants. Libellé stocké vide : calculé ; non vide : saisi. Les lettres se recalculent. | Sémantique des actions de l'arbre non précisée. |
| Q13 | Moteur et invalidités : deux courses d'une joueuse dans un temps, seule la première s'applique ; passe vers l'autre équipe, exécutée et signalée ; passeuse sans ballon, passe ignorée et signalée ; passes simultanées (même instant de lâcher), seule la première s'applique. | Les invalidités n'interrompent jamais le programme (4.3). |
| Q14 | Supprimer une joueuse supprime ses courses et les passes qui la concernent dans tous les temps (annulable) ; `ballCarrierId` repasse à null si besoin. | Évite des actions orphelines. |
| Q15 | Ctrl+D duplique les joueuses sélectionnées (numéro suivant libre, décalage de 2 m, sans actions). L'outil Course sur une joueuse qui a déjà une course dans le temps prolonge cette course. Supprimer le dernier point d'une course supprime la course. Délai par défaut d'une passe : instant où la passeuse obtient le ballon dans ce temps. Les flèches ignorent la grille. Grille activée par un bouton (aucun raccourci inventé). | Petits trous de 6.2 et 6.3. |
| Q16 | Numéros en double dans une équipe : avertissement, pas de blocage. | Le lot 3 associe par numéro. |
| Q17 | Inspecteur : dimensions bornées à la Règle 1 (longueur 94 à 100 m, largeur 68 à 70 m, en-but 6 à 22 m). Hors bornes dans un fichier : avertissement. | |
| Q18 | Vue demi-terrain `attack` : la moitié qui contient la ligne de but attaquée, avec son en-but. | |
| Q19 | Cadrage automatique en lecture seulement ; l'éditeur part de la vue enregistrée, puis zoom et déplacement libres. Aperçu d'orientation disponible aussi en édition. Cadre libre réglé par « Enregistrer la vue actuelle comme cadre » et des champs numériques. Pendant le vol d'une passe, la portion parcourue est tracée en pointillés. | |
| Q20 | `LibraryStore` garde les 5 méthodes de 8.1 et en ajoute : `issues()`, `resolveDuplicate()`, `getSettings()`, `putSettings()`, `put(play, { expected })`. `stamp` est un compteur de relectures, pas une heure ; chaque `Change` porte son `stamp`. | Les horloges des deux PC et les dates posées par Drive peuvent diverger. |
| Q21 | Mode dégradé : dans Chrome sans dossier, bandeau « Aucun dossier choisi : la bibliothèque reste dans ce navigateur » avec « Choisir un dossier ». Au premier choix d'un dossier, proposer d'y copier les combinaisons du navigateur. Réglages et corbeille du mode dégradé dans IndexedDB. | Le texte de 8.6 ne convient pas à Chrome sans dossier. |
| Q22 | « Garder les deux » (modification extérieure) : ma version reçoit un nouvel id et le suffixe « (copie) ». « Choisir celle-ci » : l'autre fichier part en corbeille. « Remplacer » à l'import : l'ancienne version part d'abord en corbeille. Un doublon non résolu est en lecture seule. | Règle 9 de CLAUDE.md. |
| Q23 | Nom court : on garde `[a-z0-9]`, tout le reste devient « - », tirets multiples réduits, tirets de bord retirés, 40 caractères, nom vide = `sans-nom`. La relecture prend tout `*.json` de `combinaisons/` et ignore le reste (dont `.crswap`). En corbeille : `AAAA-MM-JJ_HH-MM-SS--<nom d'origine>`. | Copies de conflit Drive quel que soit leur nom ; caractères interdits par Windows. |
| Q24 | Clé inconnue : fichier invalide, laissé intact. `schemaVersion` supérieur à celui de l'application : fichier intact, message « créé par une version plus récente, recharger la page ». | Supprimer une clé effacerait des données à la sauvegarde suivante. |
| Q25 | Brouillon écrit dans IndexedDB à chaque modification, effacé après une sauvegarde réussie ; au démarrage, s'il diffère du fichier, proposer « Restaurer le brouillon » ou « Ignorer ». | 3.5 prévoyait le brouillon sans comportement. |
| Q26 | Préférences par poste (calques, vitesse, panneau replié, « S'arrêter aux options », pause entre les temps) en `localStorage` préfixé `abla-rck7:`, non synchronisées. `reglages.json` contient au lot 1 les allures, la vitesse de passe et le thème. | |
| Q27 | Dossiers ajoutés à l'arborescence 3.2 : `src/state/` (stores Zustand), `src/test/` (outils de test), `src/types/` (déclarations), `e2e/`. | |
| | Protection de `main` : statut CI « checks » obligatoire avant fusion, administrateurs compris, sans revue exigée. | Travail en solo ; pas de fusion si la CI est rouge. |

### Choix techniques (14 octobre 2026)

| Décision | Raison |
|---|---|
| TypeScript 6.0 (et non 7.0) | `typescript-eslint` ne prend en charge que TypeScript < 6.1. |
| Vite 8, Vitest 5, ESLint 10 (config « flat »), React 19, Zod 4, Zustand 5, Playwright 1.64 | Versions stables courantes, figées par `package-lock.json`. |
| Un seul `tsconfig.json` (DOM et Node), `tsc --noEmit` | Commande imposée par CLAUDE.md ; les règles ESLint interdisent les API Node dans le code de l'application. |
| Règles ESLint de pureté (`model/`, `engine/`, `field/`, `render/`, `config/`) et d'aplats (`render/`, `field/`), interdiction du tiret cadratin dans `ui/` | Contrôle statique des règles 7 et 8 de CLAUDE.md et des conventions. |
| Tests e2e du mode dossier : `window.showDirectoryPicker` remplacé par un sous-dossier OPFS via `page.addInitScript` | Vérifié : sous Playwright Chromium, OPFS écrit, le handle se stocke dans IndexedDB, survit au rechargement et `queryPermission` renvoie `granted`. Aucun code propre aux tests dans l'application. |
| Images de référence de `render` avec `@napi-rs/canvas` et la police Atkinson Hyperlegible embarquée (OFL), comparées avec `pixelmatch` et une tolérance | Rendu de texte identique entre Windows et la CI Linux ; police lisible, réutilisable au lot 2. |
| Actions GitHub aux dernières versions majeures (checkout v7, setup-node v7, upload-pages-artifact v5, deploy-pages v5) | |
| Moteur : point fixe de la passe à 5 itérations (borne haute de 5.4) ; le ballon finit toujours exactement sur la receveuse à `arrivalT` | Pour une receveuse qui sprinte à 7 m/s en s'éloignant droit de la passeuse (pire cas), la vitesse de vol réelle s'écarte d'environ 3 % de la vitesse de passe ; moins de 1 % pour une course en travers. |
| Moteur : une course de la même joueuse au-delà de la première dans un temps, une passe ignorée et les actions des lots 3 à 5 ne comptent pas dans la durée du temps | Seules les actions appliquées ont une durée. |
| Caches : clé = hachage cyrb53 de la sérialisation canonique de (combinaison, ligne, réglages), recalculée à chaque appel ; caches LRU bornés | Pas de mémoïsation par identité d'objet : le cache reste correct même si un objet était modifié en place. |
