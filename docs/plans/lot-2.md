# Plan du lot 2 : exports GIF et PDF

Plan validé le 15 octobre 2026, avec les réponses aux questions Q1 à Q16 (section 9) et un complément (section 11). Décisions détaillées dans `docs/DECISIONS.md`, entrées D-057 à D-070.
Suivi : une case par étape, cochée dans le commit qui termine l'étape, avec le hash court de ce commit (ou du commit précédent quand le hash du commit lui-même ne peut pas y figurer). L'état courant détaillé est dans `docs/ETAT.md`.

## Contexte

Le lot 2 réalise la section 9 de la spécification :
- des GIF animés : orientation, options, deux vitesses, habillage, poids ;
- des PDF : une vignette par temps, options en arbre, cahier de jeu, couleur ou noir et blanc ;
- l'encodage dans un Web Worker, avec une progression et un bouton Annuler ;
- l'enregistrement dans `exports/` du dossier, ou un téléchargement en repli.

Règle de 9.1 : les exports réutilisent `evaluate`, `render` et `renderSchematic`, sans rendu propre.

État vérifié avant de commencer :
- `main` est à `9a2c379` (fusion de la PR #2) et l'arbre de travail est propre.
- **Écart** : `docs/ETAT.md` indique la PR #2 ouverte et la branche `lot-1-corrections` en cours ; elle est fusionnée. Je le corrige dans le premier commit du lot.
- Hors de ce lot : les 2 vérifications manuelles restantes du lot 1 (synchronisation Drive réelle, conflit réel) et la séance d'usage libre.

Ton choix du 15/10 : les prototypes forment l'**étape 0**, après validation. Les sections 1 et 2 sont donc des évaluations documentaires. Je les ai faites à partir :
- du code source de `context2d.js` de jsPDF 4.2.1 ;
- de l'API de gifenc 1.0.3 ;
- d'un calcul.

Les mesures réelles arrivent à l'étape 0. Tu choisis à ce moment-là, et je m'arrête jusqu'à ton choix.

## 1. PDF vectoriel ou images à 300 dpi

### 1.1 Vectoriel : `renderSchematic` sur le contexte 2D de jsPDF

Le contexte 2D de jsPDF prend en charge tout ce qu'utilise `Ctx2D`, d'après son code source :
- chemins (`moveTo`, `lineTo`, `arc`, `rect`, `closePath`) ;
- `fill`, `stroke`, `fillRect` ;
- `fillText` et `measureText` ;
- `textAlign` et `textBaseline` (`top`, `middle`, `bottom`) ;
- `lineCap`, `lineJoin`, `setLineDash` ;
- `save` et `restore`, `translate`, `rotate`, `scale` ;
- en plus : `clip` et `bezierCurveTo`.

Ni dégradé ni motif, ce que nous n'utilisons pas. Le code n'utilise ni `document` ni `window`.

Limites relevées dans le code source, toutes contournables :

| Limite de jsPDF | Effet sur notre rendu | Contournement |
|---|---|---|
| Les transformations s'appliquent à l'ajout de chaque point. Un `arc` sous une échelle non uniforme reste un cercle. Un chemin construit entre `save()` et `restore()` est perdu. | Le ballon de `drawBall` (rotation, échelle, `arc`, puis `restore`, puis `fill`) n'est pas dessiné. Le `fill` qui suit s'applique au chemin extérieur : risque de défaut graphique. | Ballon tracé par 4 courbes de Bézier calculées en pixels, sans transformation. `bezierCurveTo` est ajouté à `Ctx2D`. |
| `setLineDash` n'est pas mis à l'échelle. `lineWidth` n'est mis à l'échelle que par la composante x. | Tirets et épaisseurs faux si l'on change l'échelle avec `scale()`. | Aucun `scale()` : le viewport produit directement les unités du PDF (`pixelRatio` = mm par pixel CSS). Une vignette est placée par `translate()`, sans effet sur ces valeurs. |
| La taille de police est arrondie à l'entier inférieur, en points. | Numéros des jetons jusqu'à 1 pt plus petits. | Choisir des tailles entières en points pour les vignettes. |
| `textBaseline = 'middle'` est approché (`y + hauteur / 2 - descente`). | Numéro peut-être décalé de quelques dixièmes de millimètre dans le jeton. | À mesurer à l'étape 0, correction éventuelle dans `drawToken`. |
| Aucune découpe implicite : un canevas découpe à ses bords, une page PDF non. | Le terrain déborderait de la vignette sur la page. | `clip()` ajouté à `Ctx2D` ; vignette dessinée dans `save`, `rect`, `clip`, puis `restore`. |
| La police est résolue sur les polices enregistrées, sinon Helvetica. | `"Atkinson Hyperlegible", sans-serif` doit correspondre au nom enregistré. | Police enregistrée sous ce nom (`addFont`). Repli Helvetica à vérifier. |

Points à confirmer à l'étape 0 :
- jsPDF dans un Worker ;
- l'embarquement de la police : entière ou réduite aux glyphes utilisés, avec ou sans table `/ToUnicode` pour la recherche de texte.

Bilan :
- **Rendu attendu** : la même géométrie que l'écran, nette à tout zoom sur le téléphone et sur une laser à 600 dpi, avec du texte sélectionnable.
- **Poids estimé** : 4 à 10 Ko par vignette après compression. Le terrain fait environ 70 tracés ; il y a 14 jetons ; chaque course est échantillonnée à 64 points par segment.
  - une page de combinaison : 30 à 60 Ko ;
  - les polices : environ 110 Ko, si les deux fichiers TTF (54 et 55 Ko) sont embarqués entiers ;
  - un cahier de 5 combinaisons : environ 0,3 à 0,5 Mo.

### 1.2 Images à 300 dpi

Principe : la même fonction `renderSchematic` dessine sur un `OffscreenCanvas` (le même chemin que le GIF). L'image est encodée en PNG puis insérée par `addImage`. Aucune limite propre au contexte de jsPDF.

- **Taille** : une vignette de 75 mm de large fait 886 px ; de 90 mm (mise en page téléphone), 1063 px.
- **Poids estimé** : 40 à 120 Ko par vignette en PNG d'aplats ; 0,2 à 0,6 Mo par page ; environ 1,5 à 3 Mo pour le cahier de 5 combinaisons.
- **Limites** :
  - fichier 5 à 8 fois plus lourd, donc plus lent à ouvrir sur le téléphone et à envoyer par WhatsApp ;
  - texte des vignettes (numéros) non sélectionnable ;
  - environ 30 à 50 ms de rendu et d'encodage par vignette.

### 1.3 Recommandation

**Vectoriel**, à condition que l'étape 0 confirme quatre points :
1. ballon en Bézier, découpe et pointillés corrects ;
2. police, accents, apostrophe typographique et guillemets ;
3. jsPDF dans un Worker ;
4. poids mesurés.

Repli : images à 300 dpi, si l'étape 0 révèle une limite bloquante. Le ballon en Bézier et `clip()` ne s'ajoutent que si le vectoriel est retenu.

**Réponse (Q1, D-057) :** vectoriel. Si l'étape 0 confirme les quatre points, il est retenu sans nouvelle attente et le lot continue. Arrêt seulement si une limite bloquante apparaît.

### 1.4 Prototype de l'étape 0 (jetable, hors dépôt)

- **P1, vectoriel** : la combinaison type est la fixture figée `play-v1-7v7-options.json` (lue seulement), soit 7 contre 7, un tronc de 2 temps et 2 options au temps 3.
  - Une page A4 paysage de ses vignettes, en Contraste fort puis en Impression N&B.
  - Le ballon actuel, puis le ballon en Bézier.
  - Police embarquée, texte « Défense montée », « l’option », « Option B ».
  - Pages tramées par pdf.js pour que tu voies le rendu.
  - Mesures : poids et temps.
- **P2, images** : la même page avec des vignettes PNG à 300 dpi ; poids et temps.
- **P3, GIF** : section 2 mesurée, avec et sans pixels inchangés, en standard et en haute qualité.
  - Vérification avec omggif des délais, de la boucle et du mode de remplacement des images (`dispose`).
- **P4, Worker** : une page minimale servie par Vite et pilotée par Playwright, sous Chromium et sous Firefox. Elle vérifie :
  - `OffscreenCanvas` avec la police chargée dans le Worker ;
  - jsPDF dans le Worker ;
  - gifenc dans le Worker.
- **Restitution** :
  - chiffres et limites rencontrées dans `docs/plans/lot-2.md` ;
  - images et fichiers dans le dossier temporaire de la session, chemins donnés ;
  - vectoriel retenu si les quatre points de 1.3 sont confirmés ; arrêt seulement sur une limite bloquante (D-057).

### 1.5 Résultats de l'étape 0 (15 octobre 2026)

Prototypes compilés par rolldown à partir des sources du dépôt (lecture seule), exécutés sous Node 24 avec `@napi-rs/canvas`, et dans de vrais Workers sous Chromium 156 et Firefox 157 (Playwright). Fichiers et images dans le dossier temporaire de la session (`proto/results/`), non versionnés.

**Les quatre points de 1.3 sont confirmés : vectoriel retenu (D-057, D-071).**

| Point | Résultat |
|---|---|
| 1. Ballon, découpe, pointillés | Avec le `drawBall` actuel, le défaut prévu se produit : ballon absent et dernier jeton dessiné repeint en blanc (le `fill` tombe sur le chemin extérieur). Avec le ballon en 4 courbes de Bézier : correct. Découpe par `clip()` correcte ; pointillés des passes (tiret de 0,1 et bouts ronds) corrects. |
| 2. Police et texte | Atkinson Hyperlegible embarquée **réduite aux glyphes utilisés** (environ 6 Ko compressés par graisse), avec `/ToUnicode`. Texte extrait par pdf.js : « Défense montée », « l’option », « « défense » », « Œil » retrouvés. Numéros des jetons centrés ; taille visée 7,05 pt (jsPDF arrondit à l'entier inférieur). |
| 3. jsPDF dans un Worker | Fonctionne sous Chromium et Firefox, lien interne et signet compris. Police chargée dans le Worker (`self.fonts`) et utilisée par `OffscreenCanvas` dans les deux navigateurs. gifenc fonctionne dans le Worker. |
| 4. Poids mesurés | Page A4 de la fixture (4 vignettes de 87 mm), polices comprises : **vectoriel 63 Ko**, 25 à 50 ms ; images à 300 dpi 160 à 210 Ko, 250 à 300 ms. Rapport mesuré : 2,6 à 3,3 (estimé 5 à 8). Deux exécutions : PDF identiques octet pour octet (date et identifiant fixés). |

Poids mesurés des GIF (enchaînés, deux vitesses, Contraste fort, carton titre, maintiens de 1 s et pause finale), ramenés à 20 s :

| Combinaison | Format | Sans optimisation | Avec pixels inchangés transparents | Rapport |
|---|---|---|---|---|
| Fixture (1 ou 2 joueuses bougent à la fois) | standard 540 × 960, 12 i/s | 3,9 Mo (21 Ko par image) | **0,54 Mo** (3 Ko par image) | 7 |
| Fixture | haute qualité 720 × 1280, 15 i/s | 6,6 Mo | 0,89 Mo | 7 |
| Dense (14 joueuses bougent à chaque temps) | standard | 4,5 Mo (25 Ko par image) | **1,5 Mo** (8,5 Ko par image) | 3 |
| Dense | haute qualité | 7,5 Mo | 2,7 Mo | 3 |

- Estimation du plan : 6,5 Mo sans, 0,9 Mo avec ; la mesure est en dessous dans les deux cas.
- Images composées (décodées par omggif) **identiques au pixel près** avec et sans optimisation, à mi-parcours et à la fin ; délais 8 centièmes (12 i/s), `dispose` 1, boucle infinie ; deux encodages identiques octet pour octet.
- Temps sous Node : 7 à 13 ms par image (rendu 3 à 5, palette 3 à 5, écriture 1 à 2), palette sur échantillon 75 à 130 ms : environ 2 s pour un GIF standard de 20 s.

Limites rencontrées, aucune bloquante :
- `drawBall` doit passer en courbes de Bézier sans transformation (étape 2).
- gifenc : avec la transparence, le mode de remplacement par défaut est 2 (zone remise à vide), qui annulerait l'optimisation : passer `dispose: 1`. `quantize` et `applyPalette` lisent tout le tampon sous-jacent : leur passer des tableaux autonomes.
- jsPDF importe dynamiquement html2canvas, dompurify et canvg : rolldown en fait des morceaux chargés à la demande (environ 740 Ko jamais utilisés) ; à remplacer par des modules vides dans la configuration de Vite (étape 5).
- Le même GIF diffère entre Chromium et Firefox (rendu du texte) : le déterminisme vaut pour un même navigateur sur un même poste.
- En portrait, une combinaison large (70 m de largeur utile) laisse du terrain vide au-dessus et au-dessous : l'échelle est fixée par la largeur ; comportement attendu de l'attaque vers le haut (D-061).

## 2. Poids d'un GIF portrait standard de 20 s

Hypothèses :
- **Combinaison type** : la même fixture.
- **Format** : GIF enchaîné à deux vitesses, 540 × 960, 12 images/s, thème Contraste fort.
- **Durée** : 20 s au total, soit carton titre 1,5 s, carton de vitesse 1 s, pause finale 2 s, et 15,5 s animées.
- **Nombre d'images** : environ 186 images animées et 3 cartons, sur 518 400 pixels par image.

| | Sans optimisation | Avec pixels inchangés transparents |
|---|---|---|
| Octets par image animée | 25 à 45 Ko (image entière en aplats, compression LZW d'environ 12 à 20 pour 1) | 2 à 6 Ko (2 à 4 % des pixels changent : 14 jetons, traces, ballon, en-tête aux changements de temps) |
| GIF standard de 20 s | **environ 6,5 Mo** (4,7 à 8,4) | **environ 0,9 Mo** (0,5 à 1,3) |
| Haute qualité (720 × 1280, 15 images/s) | 10 à 18 Mo, au-delà du seuil de 8 Mo | 1,5 à 3 Mo |

Conclusion : l'optimisation divise le poids par 5 à 8. Je propose de l'appliquer toujours.

Elle suppose quatre réglages :
- une palette globale de 255 couleurs, plus un indice réservé à la transparence ;
- `dispose: 1` : l'image précédente reste en place ;
- les cartons, et la dernière image de chaque option tenue 1 s avant le carton suivant (Q4), codés en une seule image de longue durée ;
- des délais exprimés en centièmes de seconde, arrondis en cumulé pour garder la cadence exacte (12 images/s donne 8, 8, 9 centièmes...).

Temps d'encodage estimé dans le Worker : 15 à 30 ms par image, soit 3 à 6 s en standard et 8 à 15 s en haute qualité. Mesures à l'étape 0 (P3).

## 3. Web Worker d'encodage

Le Worker unique `src/export/worker/exportWorker.ts` est chargé par `new Worker(new URL(...), { type: 'module' })`, puis réutilisé d'un export à l'autre. Le cœur des exports est **pur et pas à pas** : des générateurs qui produisent une image de GIF ou une vignette de PDF à chaque `next()`.

Ce cœur tourne de deux façons :
- dans le Worker, sur un `OffscreenCanvas` créé avec `willReadFrequently` (rendu logiciel, donc lectures rapides et déterministes) ;
- dans Vitest sous Node, avec `@napi-rs/canvas`, par un moteur « en ligne ».

```ts
// src/export/worker/protocol.ts
type ExportJob =
  | { kind: 'gif'; play: Play; settings: EngineSettings; layers: Layers; options: GifOptions }
  | { kind: 'pdf'; plays: Play[]; settings: EngineSettings; options: PdfOptions; book: BookOptions | null }

type ToWorker =
  | { type: 'start'; jobId: number; job: ExportJob }
  | { type: 'cancel'; jobId: number }

type FromWorker =
  | { type: 'progress'; jobId: number; stage: 'fonts' | 'palette' | 'frames' | 'pages'; done: number; total: number }
  | { type: 'done'; jobId: number; files: { variant: string; mime: string; bytes: ArrayBuffer }[] } // octets transférés, pas copiés
  | { type: 'cancelled'; jobId: number }
  | { type: 'error'; jobId: number; message: string }
```

Déroulement :
- **Polices** : chargées une fois par le Worker (`fetch` sous `BASE_URL`, puis `self.fonts.add(new FontFace(...))`). Les mêmes octets servent à jsPDF.
- **GIF** :
  - première passe : palette calculée sur un échantillon (cartons et 12 images régulièrement espacées, HYPOTHÈSE) ;
  - seconde passe : pour chaque image, le Worker dessine, lit les pixels, applique la palette, rend transparents les pixels inchangés et écrit l'image.
  - La mémoire reste bornée : seuls les indices de l'image précédente sont gardés.
- **PDF** : mise en page pure, puis écriture page après page.
- **Progression** : au plus un message toutes les 50 ms, plus le dernier.
- **Annulation** :
  - le Worker rend la main entre deux pas (attente d'un `MessageChannel`, sans le délai minimal de `setTimeout`) ;
  - un `cancel` arrête la boucle, abandonne les tampons et renvoie `cancelled` ;
  - côté page, sans réponse dans la seconde (HYPOTHÈSE), `worker.terminate()` ; le Worker est recréé au besoin.
- **Fichiers** : seule la page écrit, et seulement après `done`. Une annulation ne laisse donc jamais de fichier. L'écriture finale (moins d'une seconde) n'est pas annulable : le bouton devient « Enregistrement… ».
- **« Un GIF par option »** produit tous les fichiers d'un même travail, écrits ensemble à la fin : tout ou rien.
- **Interfaces** : `ExportEngine` a deux implémentations, Worker (navigateur) et en ligne (tests). `io/exportRun.ts` orchestre moteur, annulation et enregistrement, et se teste contre `memoryFs`.

## 4. Fichiers créés ou modifiés

```
package.json, package-lock.json   gifenc, jspdf ; dev : pdfjs-dist, omggif, @types/omggif
eslint.config.js                  règles de pureté et d'aplats étendues à src/export/ (hors worker/)
docs/plans/lot-2.md               ce plan, avec tes réponses
docs/ETAT.md, DECISIONS.md, ARCHITECTURE.md, RECETTE.md, SPEC.md (fin de lot), README.md (exports)
src/types/gifenc.d.ts             déclarations (le paquet n'a pas de types)
src/config/defaults.ts            formats et cadences GIF, durées des cartons, lisibilité, mise en page PDF,
                                  seuil de 8 Mo, couleurs du thème Impression N&B (HYPOTHÈSE ou SPEC)
src/model/labels.ts               libellés des temps et des catégories, déplacés de ui/strings.ts (partagés)
src/model/settings.ts             reglages.json v2 : préférences d'export ; migration v1 -> v2
src/render/
  themes.ts                       + « Impression couleur » (printColor) et « Impression N&B » (printBw), hors des
                                  thèmes de l'éditeur ; style de jeton par équipe
  primitives.ts, render.ts, renderSchematic.ts   jeton plein ou creux selon le thème, tracés noirs en N&B,
                                  bandeau décalable ; ballon en Bézier (si vectoriel)
  captions.ts                     cartons (titre, option, vitesse), en-tête (numéro du temps, pastille)
  viewport.ts                     marges intérieures : cadrage du terrain sous l'en-tête et le bandeau
  ctx2d.ts                        + clip(), bezierCurveTo() (si vectoriel)
src/export/
  types.ts, names.ts, legibility.ts, text.ts (U+202F -> U+00A0, glyphe absent de la police)
  gif/timeline.ts                 plan des images : cartons, segments, vitesses, délais en centièmes
  gif/frame.ts                    une image : evaluate + render + captions
  gif/encode.ts                   palette, transparence, gifenc ; générateur pas à pas
  pdf/layout.ts                   rangées de vignettes, réduction de 90 à 60 mm, suite de page ; téléphone et impression
  pdf/book.ts                     cahier : page de titre, sommaire, numéros, liens, signets (mise en page en deux passes)
  pdf/thumbnail.ts                vignette : viewport, découpe, renderSchematic
  pdf/write.ts, pdf/pdfCtx.ts     écriture jsPDF (police, textes, vignettes, liens, date et identifiant déterministes)
  worker/protocol.ts, worker/exportWorker.ts, worker/engine.ts
src/io/
  fs/types.ts, fs/nativeFs.ts     lecture et écriture binaires
  trash.ts                        mise en corbeille par copie vérifiée, en octets (extraite de FolderStore, D-043)
  FolderStore.ts                  utilise trash.ts ; structure : + exports/ (8.2) ; réglages v2
  IdbStore.ts                     réglages v2
  exportsFolder.ts                exports/ : existence, « Remplacer » (ancien en corbeille), « Garder les deux »
  exportRun.ts                    orchestration et annulation
  download.ts                     + téléchargement d'octets
src/state/exportStore.ts, exportSession.ts ; session.ts (cible d'export du dossier courant)
src/ui/export/                    GifExportDialog.tsx, PdfExportDialog.tsx, BookDialog.tsx, ExportProgress.tsx
src/ui/toolbar/Toolbar.tsx        « Exporter GIF », « Exporter PDF »
src/ui/library/LibraryPanel.tsx   « Cahier de jeu »
src/ui/strings.ts                 textes des exports
src/test/
  memoryFs.ts (contenus binaires), gifInspect.ts (omggif), pdfInspect.ts (pdfjs-dist), exportFixtures.ts
  fixtures/reglages-v1.json
  image-snapshots/gif-frame-{highContrast,printBw}.png, pdf-thumbnail-{highContrast,printColor,printBw}.png
e2e/
  support/opfs.ts (lecture binaire)
  export-gif.chromium.spec.ts, export-pdf.chromium.spec.ts, export.firefox.spec.ts
```

Le modèle `Play` ne change pas : pas d'incrément de son `schemaVersion`. La migration v1 vers v2 reste celle du lot 3. Seul `reglages.json` passe en v2, si Q16 est validée.

## 5. Étapes (chacune finit sur lint, typecheck et test verts, un commit, ETAT.md et la case du plan à jour)

- [x] **Étape 0 : branche, plan, prototypes, ton choix.** (commits `1a41e1f` et « Résultats de l'étape 0 » ; vectoriel confirmé, section 1.5)
  - Branche `lot-2` ; `docs/plans/lot-2.md` ; ETAT.md réécrit (écart corrigé) ; décisions D-057 et suivantes.
  - Installation de gifenc, jspdf, pdfjs-dist, omggif.
  - Prototypes P1 à P4 (section 1.4), non versionnés ; chiffres et limites dans le plan.
  - Vectoriel retenu si les quatre points de 1.3 sont confirmés ; **arrêt** seulement sur une limite bloquante (D-057).
- [x] **Étape 1 : config, model, noms et lisibilité.** (commit `c6fa414` ; reprise après interruption, D-072)
  - Valeurs de `defaults.ts`.
  - `model/labels.ts`, avec `ui/strings.ts` qui le réexporte.
  - Réglages v2 : schéma, migration, fixture v1, test ; lecture versionnée ; une version future n'est jamais réécrite (comme D-024).
  - `export/names.ts`, `legibility.ts` et `text.ts`, avec leurs tests.
- [x] **Étape 2 : render.** (commit `0fe6ebc` ; D-073)
  - Thème Impression N&B ; style de jeton par équipe ; captions ; marges du viewport ; bandeau décalable.
  - Selon le choix de l'étape 0 : ballon en Bézier, `clip()` et `bezierCurveTo()` (contexte enregistreur mis à jour).
  - Tests : images de référence du lot 1 inchangées ou régénérées avec justification ; contrôles par le contexte enregistreur.
- [x] **Étape 3 : GIF.** (commit `38e7ba6` ; D-074)
  - Plan des images, dessin d'une image, palette, transparence, délais, encodage pas à pas.
  - Tests : déterminisme, nombre d'images, délais, cadrage fixe, orientation, images de référence.
- [x] **Étape 4 : PDF.** (commit « Étape 4 : export PDF », après `38e7ba6` ; D-075)
  - Mise en page téléphone et impression, débordement, vignettes (mode choisi), cahier, sommaire, liens, signets, polices, métadonnées déterministes.
  - Tests avec pdf.js.
- [ ] **Étape 5 : io et Worker.**
  - Fichiers binaires, `trash.ts`, `exports/`, existence et confirmation, téléchargement.
  - Protocole, Worker, moteur Worker et moteur en ligne, `exportRun` avec annulation.
  - Tests contre `memoryFs`.
- [ ] **Étape 6 : state et interface.**
  - Stores et session d'export, dialogues GIF, PDF et cahier, progression, Annuler, taille, alerte de 8 Mo et version allégée.
  - Préférences relues et écrites dans `reglages.json`.
  - Tests de bout en bout.
- [ ] **Étape 7 : clôture.**
  - ARCHITECTURE, DECISIONS ; SPEC mise à jour selon tes réponses (3.1, 3.2, 4.4, 8.2, 9, 13.2, 14, 16), sections listées dans la PR.
  - RECETTE : tableau « comportement → tests » du lot 2 et vérifications manuelles ; README (exports, récupération sur le téléphone).
  - Recette automatisable complète ; push ; PR `lot-2` vers `main`. Tu fusionnes.

## 6. Dépendances

| Paquet | Type | Justification |
|---|---|---|
| gifenc 1.0.3 | exécution | imposé (3.1) ; 9 Ko, sans dépendance, MIT ; aucun type : déclaration locale |
| jspdf 4.2.1 | exécution | imposé (3.1) ; MIT ; chargé seulement dans le Worker (aucun poids sur la page principale). Dépendances optionnelles (html2canvas, canvg, dompurify) : à garder hors du bundle, vérifié à l'étape 1 sur le build |
| pdfjs-dist | dev | lire les PDF produits dans les tests : nombre de pages, liens et destinations, signets, texte extrait (accents, guillemets), trame d'une vignette pour l'image de référence. Il trame avec `@napi-rs/canvas`, déjà présent. Fonctionnement sous Vitest vérifié à l'étape 0 |
| omggif, @types/omggif | dev | décoder les GIF produits dans les tests : nombre d'images, délais, boucle, image décodée et composée. Petit, sans dépendance, MIT. Plus sûr qu'un décodeur LZW écrit à la main |

## 7. Tests prévus

### Obligatoires (prompt du lot 2)

| Exigence | Tests |
|---|---|
| Deux exports successifs du même GIF identiques octet pour octet | Unitaire : chemin complet sous Node (`@napi-rs/canvas`, gifenc). Bout en bout Chromium : deux exports réels par le Worker, empreintes comparées (le premier part en corbeille par « Remplacer ») |
| GIF enchaîné : nombre d'images conforme au calcul | Unitaire sur la fixture à 2 options, deux vitesses : 1 carton titre + pour chaque passage (somme des segments de `⌈D·f/s⌉ + 1` images + cartons d'option) + carton de vitesse. Plus : délais des cartons, pause finale de 2 s sur la dernière image, durée totale, boucle infinie (omggif) |
| PDF : pages et sommaire d'un cahier de 5 combinaisons dont une à 3 options ; liens internes | Unitaire avec pdf.js : nombre de pages égal à la mise en page calculée ; numéros du sommaire égaux aux pages où commence chaque combinaison (texte extrait par page) ; une annotation de lien par entrée, destination sur la bonne page ; signets. Bout en bout : même contrôle sur le fichier écrit dans `exports/` |
| Images de référence : une vignette PDF et une image de GIF, en Contraste fort et en Impression N&B | 5 images : les 4 demandées, plus la vignette en Impression couleur (thème réel du PDF « Couleur », D-062). Vignette tramée par pdf.js depuis le PDF produit (prouve le rendu réel de jsPDF). Image de GIF décodée depuis le GIF produit (prouve aussi la palette) |
| Annulation : aucun fichier partiel écrit | Unitaire : `exportRun` avec le moteur en ligne, annulation pendant l'encodage, `exports/` vide et aucune écriture dans `memoryFs`. Bout en bout Chromium : export haute qualité annulé pendant la progression, `exports/` inchangé dans OPFS |

### Autres tests unitaires
- **Plan des images** : un GIF par feuille ; reprise au point de divergence (arbre à plusieurs points d'option) ; vitesses 0,5x seule et 1x seule ; libellé du temps dans l'en-tête ; cadence exacte en moyenne (délais cumulés).
- **Cadrage** : un seul viewport pour tout le GIF, égal à la boîte de toutes les lignes exportées plus 5 m ; le terrain reste sous l'en-tête et le bandeau.
- **Orientation** : attaque vers le haut en portrait et en carré, pour A et pour B ; vers la droite en paysage quand B attaque (rotation de 180°).
- **Lisibilité** : plus petit texte d'au moins la taille minimale, dans chaque format et chaque qualité.
- **Impression N&B** (contexte enregistreur) : seulement des gris (r = g = b) ; jeton A plein, jeton B creux ; courses pleines, passes en pointillés.
- **Aplats** : toujours aucun dégradé, motif ni ombre.
- **Mise en page PDF** :
  - réduction de 90 à 60 mm puis page suivante avec rappel du titre ;
  - une rangée jamais coupée ;
  - rangées d'options titrées par leur condition ;
  - téléphone en une colonne ;
  - accents, apostrophe typographique, « guillemets » retrouvés dans le texte extrait ;
  - même PDF octet pour octet deux fois (date et identifiant tirés des données).
- **Noms** : chaque variante ; suffixes « -2 », « -3 » ; nom court (D-023).
- **exports/** : création ; existant jamais écrasé sans décision ; « Remplacer » met l'ancien en corbeille par copie vérifiée (binaire) ; « Garder les deux » ; « un GIF par option » tout ou rien ; échec d'écriture (Q13).
- **Réglages** : migration v1 vers v2, fixture v1, aller-retour, version future intacte.
- **Protocole** : gardes de type des messages ; le moteur en ligne et le cœur du Worker produisent les mêmes octets.

### Bout en bout (Playwright)
- **export-gif.chromium** (dossier OPFS) :
  - scénario existant à 2 options, export portrait enchaîné ;
  - fichier `exports/<nom-court>--portrait-enchaine.gif`, en-tête `GIF89a`, nombre d'images, taille affichée ;
  - second export : confirmation, « Remplacer », ancien en corbeille, octets identiques ;
  - un GIF par option ;
  - annulation ;
  - interface fluide : aucune tâche longue de plus de 200 ms pendant l'encodage (`PerformanceObserver`, HYPOTHÈSE de seuil) ;
  - alerte de 8 Mo vérifiée en unitaire par un seuil injecté.
- **export-pdf.chromium** :
  - PDF d'une combinaison, impression N&B et téléphone ;
  - cahier de 5 combinaisons (importées d'un `.combipack.json`) dont une à 3 options, vérifié par pdf.js.
- **export.firefox** (mode dégradé) : GIF et PDF téléchargés et valides. Prouve le Worker, `OffscreenCanvas` et la police dans Firefox.

## 8. Vérifications manuelles prévues (D-054, impossibles à automatiser)

1. GIF portrait enchaîné d'une combinaison à 2 options :
   - récupéré par l'app Drive du téléphone dans `exports/` ;
   - envoyé sur WhatsApp : animé en boucle ou vidéo avec bouton lecture (à noter) ;
   - envoyé une fois avec et une fois sans l'optimisation des pixels inchangés (D-069) : rendu identique ou non ;
   - lisible en extérieur, consignes comprises.
2. PDF « Impression » en noir et blanc sur l'imprimante laser : équipes (plein et creux), courses et passes distinguables, texte lisible.
3. Cahier de jeu de 5 combinaisons ouvert sur le téléphone : sommaire cliquable, lecture en défilant.

## 9. Points ambigus ou contradictoires : questions, propositions et réponses

Réponses de l'utilisateur, le 15 octobre 2026 (détail dans `docs/DECISIONS.md`) :

| Question | Réponse | Décision |
|---|---|---|
| Q1 | Vectoriel ; retenu sans attente si l'étape 0 confirme les quatre points de 1.3 ; arrêt seulement sur une limite bloquante. | D-057 |
| Q2, Q3 | Proposition retenue : passage ralenti complet, puis passage complet à vitesse réelle ; reprise au point de divergence. | D-058 |
| Q4 | Proposition retenue, **avec un ajout** : la dernière image de chaque option est tenue 1 s avant le carton suivant (une seule image de longue durée). Pause finale de 2 s inchangée. | D-059 |
| Q5, Q6 | Propositions retenues. | D-060 |
| Q7 | Proposition retenue ; en paysage, téléphone tourné. | D-061 |
| Q8, Q9 | GIF : proposition retenue. PDF « Couleur » : **pas** de Contraste fort (trop d'encre) ; nouveau thème « Impression couleur » (fond blanc ou très clair, lignes du terrain grises, couleurs d'équipe conservées). « Noir et blanc » = Impression N&B, comme proposé en Q9. | D-062 |
| Q10, Q11 | Propositions retenues. | D-063 |
| Q12 | Proposition retenue, **avec un ajout** : une date sur la page de titre, la plus récente des dates de modification des combinaisons incluses (déterministe). | D-064 |
| Q13 | Proposition retenue ; compatible avec la règle 9, ce fichier vide n'ayant jamais contenu de données. | D-065 |
| Q14, Q15, Q16 | Propositions retenues. | D-066, D-067, D-068 |

Les questions telles que posées, avec les propositions :

- **Q1. Vectoriel ou images.** Tu choisis à l'étape 0. Ma recommandation : vectoriel (section 1.3).
- **Q2. GIF enchaîné à deux vitesses : ordre.**
  - Proposition :
    - carton titre ;
    - passage ralenti complet : tronc, option A, carton « Option B », reprise au point d'option, option B ;
    - carton « Vitesse réelle » ;
    - passage à vitesse réelle complet ;
    - pause finale de 2 s.
  - Autre lecture : chaque option jouée au ralenti puis à vitesse réelle.
- **Q3. Plusieurs points d'option dans le GIF enchaîné.**
  - Proposition :
    - les feuilles se suivent dans l'ordre de l'arbre ;
    - chaque option reprend au point d'option où elle diverge de la précédente ;
    - le carton porte « Option B : <condition> », préfixé de « Temps n, » quand la combinaison a plusieurs points d'option ;
    - une condition vide donne « Option B ».
- **Q4. Durées non fixées.** Proposition, en HYPOTHÈSE :
  - carton d'option : 2 s ;
  - carton de vitesse : 1 s ;
  - pas de maintien de la dernière image d'une option avant le carton suivant : la pause de 2 s n'existe qu'à la fin ;
  - chaque carton tient en une seule image de longue durée (poids).
- **Q5. « Aucun rendu propre aux exports » (9.1) et habillage.**
  - Proposition :
    - la scène est toujours dessinée par `render` ou `renderSchematic` ;
    - cartons, en-tête et pastille sont dessinés par des fonctions pures de `render/captions.ts`, avec les mêmes primitives ;
    - les textes des pages PDF (titres, notes, consignes, sommaire) passent par l'API texte de jsPDF.
  - Image du GIF :
    - en haut, un en-tête : numéro du temps à gauche, pastille à droite ;
    - juste dessous, la consigne en bandeau, toujours présente même si le calque « consigne » du lecteur est éteint ;
    - le terrain cadré dans la zone restante.
- **Q6. Pastilles et carton titre.**
  - Proposition :
    - pastille « Ralenti » à 0,5x et « Vitesse réelle » à 1x, dans tous les modes de vitesse ;
    - carton titre : le nom de la combinaison ; pour un GIF par option, l'option en sous-titre.
- **Q7. Lisibilité sur un téléphone de 6 pouces.**
  - Hypothèses :
    - écran de 6 pouces au format 19,5:9, soit 64 mm de large ;
    - texte d'au moins 2,5 mm de corps ;
    - d'où le plus petit texte (numéros des jetons) ≥ largeur du GIF × 2,5 / 64, soit 21 px à 540 px ; les jetons suivent.
  - En paysage, quelle largeur d'écran retenir ?
    - Proposition : téléphone tourné (long côté, environ 139 mm).
    - Sans cela, à 960 px de large, les jetons auraient un rayon d'environ 4,5 m.
- **Q8. Thèmes des exports.**
  - Proposition pour le GIF : Contraste fort par défaut, au choix parmi les trois thèmes (l'image de référence de GIF en N&B le suppose).
  - Proposition pour le PDF :
    - « Couleur » = Contraste fort ; à noter, ses vignettes ont un fond vert foncé, donc beaucoup d'encre à l'impression couleur ;
    - « Noir et blanc » = Impression N&B.
- **Q9. Impression N&B.** Proposition :
  - jetons A pleins noirs à numéro blanc, jetons B creux (fond blanc, contour et numéro noirs), quelle que soit la couleur de la joueuse ;
  - courses noires en trait plein, passes en pointillés, temps précédents en gris clair ;
  - terrain blanc à lignes gris moyen, en-buts gris très clair, ligne d'avantage en tirets noirs fins.
- **Q10. Vignettes PDF.** Proposition :
  - un même cadrage pour toutes les vignettes d'une combinaison : boîte englobante de toutes ses lignes plus 5 m (et non la vue enregistrée) ;
  - attaque vers le haut ;
  - rapport hauteur sur largeur de cette boîte, borné entre 0,45 et 1 (HYPOTHÈSE).
- **Q11. Mise en page.** Proposition :
  - **Impression** :
    - en-tête : titre, catégorie et notes ;
    - première rangée : le tronc jusqu'au premier point d'option compris ;
    - puis une rangée par option, titrée « Option A : <condition> », dans l'ordre de l'arbre, en pleine largeur, sans retrait ;
    - sous chaque vignette, son libellé et sa consigne ;
    - une rangée trop longue passe à la ligne ;
    - vignettes de 90 mm au plus (HYPOTHÈSE), réduites jusqu'à 60 mm ;
    - une rangée n'est jamais coupée entre deux pages.
  - **Téléphone** :
    - page de 100 mm de large (HYPOTHÈSE), hauteur ajustée au contenu ;
    - une vignette pleine largeur par ligne ;
    - les sections d'options empilées ;
    - textes dimensionnés selon la règle de Q7.
- **Q12. Cahier de jeu.** Proposition :
  - **Dialogue** : titre saisi (par défaut « Cahier de jeu », ou le nom de la catégorie choisie) ; cases à cocher par combinaison, plus le choix rapide d'une catégorie.
  - **Ordre des combinaisons** : celui du tri courant de la bibliothèque.
  - **Page de titre** : titre, catégorie ou « Sélection », nombre de combinaisons ; aucune date (déterminisme).
  - **Sommaire** : nom, catégorie, numéro de page, lien cliquable.
  - **Numérotation** : numéro de page en pied de chaque page, sauf la page de titre.
  - **En plus** : signets PDF.
  - Un PDF d'une seule combinaison n'a ni page de titre ni sommaire.
- **Q13. Export déjà présent.**
  - Proposition :
    - vérification avant l'encodage (pas de surprise après l'attente), puis de nouveau à l'écriture ;
    - « Remplacer » déplace d'abord l'ancien fichier dans `_corbeille/` (règle 9, comme D-022) ;
    - « Garder les deux » ajoute « -2 », « -3 » au nom ;
    - « Annuler » arrête l'export.
  - Si l'écriture échoue, le fichier vide que l'export vient de créer (`getFileHandle` le crée avant l'écriture) est retiré, seulement s'il n'existait pas avant et reste vide : aucune donnée n'est perdue.
  - Est-ce compatible avec la règle 9 pour toi ? Sinon, on le laisse et on le signale.
- **Q14. Noms des variantes.** Proposition :

  | Cas | Nom du fichier |
  |---|---|
  | GIF, forme générale | `<nom-court>--<orientation>[-hd][-enchaine \| -option-b \| -option-a-b][-ralenti \| -reel].gif` |
  | GIF, exemple portrait enchaîné | `croisee-au-centre--portrait-enchaine.gif` |
  | GIF, exemple paysage haute qualité à vitesse réelle | `croisee-au-centre--paysage-hd-reel.gif` |
  | PDF d'une combinaison | `<nom-court>--impression[-nb].pdf` ou `--telephone[-nb].pdf` |
  | Cahier de jeu | `<nom-court du titre>--cahier-impression[-nb].pdf` |

  - Orientation : portrait, paysage ou carre.
  - Lignes : `-enchaine`, ou les lettres des options choisies depuis la racine (`-option-b`, `-option-a-b`). Rien quand la combinaison n'a qu'une ligne.
  - Vitesse : rien pour les deux vitesses, `-ralenti` pour 0,5x seule, `-reel` pour 1x seule.
- **Q15. Version allégée au-delà de 8 Mo.** Proposition :
  - même contenu, en résolution standard si l'export était en haute qualité ;
  - cadence ramenée à 8 images/s (HYPOTHÈSE) ;
  - un clic relance l'export.
- **Q16. Préférences d'export.**
  - Proposition :
    - dans `reglages.json` (SPEC 4.4), qui passe en v2 avec migration, fixture et test (règle 6) ;
    - calques du lecteur toujours par poste (D-026), repris tels quels dans le GIF.
  - Valeurs par défaut :
    - GIF : portrait, enchaîné, deux vitesses, standard ;
    - PDF : impression, couleur.

## 10. Vérification de fin de lot

- Automatisée, en local puis sur la CI de `lot-2` (`ubuntu-24.04`) : `npm run lint`, `typecheck`, `test`, `test:e2e` (Chromium et Firefox), `build`, `format:check`.
- Sur le build : jsPDF et gifenc présents seulement dans le morceau du Worker ; aucune dépendance optionnelle de jsPDF chargée.
- Puis les 3 vérifications manuelles de la section 8 et la séance d'usage libre, après fusion et déploiement.

## 11. Complément demandé à la validation

- **Optimisation des pixels inchangés désactivable (D-069).** Un réglage d'export (`reglages.json`) désactive la transparence des pixels inchangés des GIF, au cas où la conversion GIF vers MP4 de WhatsApp la rendrait mal. Activée par défaut. Contrôlé lors de la vérification manuelle WhatsApp (section 8, point 1) : envoyer un GIF avec et sans optimisation.
