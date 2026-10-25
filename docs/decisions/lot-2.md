# Décisions du lot 2

Index, règles du journal et mode de lecture : [README.md](README.md).

## Lot 2 : exports GIF et PDF

Les entrées D-057 à D-070 reprennent les réponses aux questions Q1 à Q16 du plan du lot 2 (`docs/archive/plans/lot-2.md`, section 9) et son complément (section 11).

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
