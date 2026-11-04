# Frise chronologique à la place des temps (SPEC 1.9, D-139)

Plan validé le 3 novembre 2026 : recommandations de Q1 à Q13 acceptées, avec 5 précisions de l'utilisateur, reportées dans le texte (Q4, Q7, Q11, section 1 et SPEC 6.2, Course). À reprendre telles quelles dans la SPEC et dans D-139.

## Contexte

Une combinaison est aujourd'hui un arbre de temps. Les frontières entre temps obligent à des mécanismes de rattrapage : « Finit lancée » et sa recompilation, liens « Caler sur… », lâcher à la réception. Le changement les remplace par une frise continue, avec des embranchements d'option et une aimantation persistante entre bords.

Ce chantier écrit la SPEC, la décision et le découpage du code ; aucun code. Branche `frise-spec` depuis `main` (`d33313f`), PR vers `main` sans fusion. Le code viendra par `/nouveau-lot frise-N`.

### Constats à la lecture

- **ETAT en retard** : il donne la PR #9 comme non fusionnée ; elle l'est (`d33313f`). Corrigé à l'étape 0.
- **Section 11 : pas rédigée en temps.** Le Grep `temps|phase` n'y trouve rien (seul « optionnels » ressort sur `option`). Un ajout dans 11.7 suffit, et `lot-4.md` ne change pas (section 4, SPEC 11).
- **Jeu au pied** : le modèle porte `flightTime`, pas de vitesse. Le bord droit règle donc le temps de vol, et non « la vitesse du ballon » comme le proposait l'hypothèse.
- **`phasePlay`** (catégorie « ruck/jeu courant », 18 fichiers) n'est pas un temps : ne pas le renommer.
- **Non lus, selon la consigne** : 5.3 et 5.9 (8 lignes à adapter, trouvées par Grep à l'écriture) ; D-128 (3bis-2 et 3bis-3 décrits d'après le prompt et ETAT, à recouper à leur `/nouveau-lot`).

## 1. Modèle v5 proposé

```ts
interface Play {
  schemaVersion: 5
  // id, dates, name, category, notes, attackingTeam, field, entities, setup, defenseSettings : inchangés
  branches: Branch[]        // remplace phases ; au moins la racine
  actions: Action[]         // tableau plat ; son ordre départage les égalités
  sequences: Sequence[]
}

interface Branch {
  id: Id
  parentId: Id | null       // null pour la racine
  branchAt?: number         // présent si elle se divise : instant absolu de l'embranchement
  branchAtGlue?: GlueRef    // Q9
  label: string             // vide : « Option A », lettre calculée (D-012)
  condition: string
  isDefault: boolean
}

interface GlueRef {
  targetId: Id              // action ou séquence de la même ligne
  event: 'start' | 'end' | { point: number }  // start : départ, lâcher, formation ; end : fin, arrivée, sortie de balle
  offset?: number           // Q5
}
interface EndGlue extends GlueRef { keep: 'start' | 'duration' }  // Q3

// Commun à toutes les actions et aux séquences
interface Timed { id: Id; branchId: Id; start: number; startGlue?: GlueRef; endGlue?: EndGlue }

// RunAction       : entityId, waypoints, pace, durationOverride?
// PassAction      : fromId, toId, ballSpeed?
// KickAction      : kickerId, kind, target, flightTime?
// BreakdownAction : kind, tackledId, supportId, relayerId, duration, contest?
// GroupRunAction (lot 5) : mêmes champs, delay remplacé par Timed
// Sequence        : end, label, instruction (label vide : « Séquence n »)
```

- Retirés : `Phase`, `delay`, `endsAtSpeed`, `RunSync`, `SyncTarget`, `ReleaseMode`.
- Une branche couvre `[branchAt du parent, son propre branchAt[`. Une ligne reste un chemin de la racine à une feuille.
- Un bord collé garde sa dernière valeur dans `start` (ou la durée) : c'est le repli quand le collage est ignoré.
- Décoller un bord ou supprimer sa cible ne fait jamais bouger le bloc : la valeur calculée à cet instant est écrite dans `start` (ou la durée).

## 2. Hypothèses du prompt

| Hypothèse | Sort |
|---|---|
| Modèle (branches, instant absolu, collages sur l'action, séquences) | Retenue, précisée en section 1 |
| Créer un embranchement à t | Retenue. Les séquences qui démarrent à t ou après suivent dans l'option A. Un collage du tronc vers une action passée dans l'option devient invalide : le bord se fige, avec un message |
| Action d'une option qui démarre avant l'embranchement | Retenue et complétée : elle part à l'embranchement, sinon le tronc changerait. Cas inverse, action du tronc qui démarre à l'embranchement ou après : elle reste commune, signalée |
| Collage dans la même ligne, cycles signalés | Retenue. À la pose : refus avec message. Dans un fichier : ignoré et signalé. Cible supprimée : le bord se fige à sa valeur calculée, le bloc ne bouge pas (section 1), avec un message |
| Deux courses qui se chevauchent : départ retardé | Retenue. Même repli pour une course d'une participante qui démarre pendant un regroupement : retardée à la sortie de balle |
| Bord droit passe et regroupement | Retenue : vitesse du ballon, sortie de balle. Jeu au pied : temps de vol (voir Constats) |
| Séquence coupée à l'embranchement | Retenue |
| Course non suivie : freine jusqu'à l'arrêt | Retenue, sauf le cas de Q1. Lancée si et seulement si la course suivante est collée à sa fin : la règle se lit dans le modèle, la recompilation disparaît (au plus une reste, pour le cas de Q1 où la suivante part en réalité à l'embranchement) |

## 3. Questions

### Le tronc commun (contradictions à trancher)

Trois règles se heurtent : « tronc identique dans toutes les options » (SPEC 2, 5.2), « une action commencée avant continue dans toutes les options » et « course collée lancée, course non suivie freinée ».

- **Q1. Course du tronc suivie dans une seule option.** R1 finit à l'embranchement ; une course lui est collée dans l'option A, aucune dans l'option B. Lancée dans A et freinée dans B, ses deux profils diffèrent avant l'embranchement, car le freinage commence plus tôt. **Recommandation** : R1 est lancée dans toutes les lignes dès qu'une option la prolonge ; dans une option qui ne la prolonge pas, arrêt net à sa fin, avec un avertissement nommant l'option (règle actuelle de D-106, conservée pour ce seul cas).
- **Q2. Passe ou jeu au pied en vol à l'embranchement.** Le ballon vise la position de la receveuse à l'arrivée. Si elle a une course propre à une option pendant le vol, la trajectoire d'avant l'embranchement diffère selon l'option. **Recommandation** : cette course est retardée à l'arrivée du ballon, alerte « départ retardé de x s » ; pour un vrai choix de cap, placer l'embranchement avant le lâcher. Le vol ne dépend alors que du tronc.

Dans les deux cas, un test vérifie que toutes les lignes donnent le même état pour tout `t` avant l'embranchement.

### Le collage

- **Q3. Bord droit collé, cible déplacée : le bloc glisse ou s'étire ?** C'est ce que distinguaient « Départ différé » et « Vitesse ajustée » (D-108). **Recommandation** : le geste décide, et l'inspecteur le montre et permet de changer. Bloc glissé jusqu'à la cible : il garde sa durée et son départ suit (D-131 et D-136 s'appliquent contre la borne : 0, fin de la course précédente ou embranchement). Bord droit tiré jusqu'à la cible : le départ reste, la durée s'adapte, solveur à deux leviers.
- **Q4. Rendez-vous à un point de passage** (`at`, cible `runPoint`). Un bloc n'a que deux bords. **Recommandation** : `at` disparaît, remplacé par une action « Couper la course ici » qui donne deux courses collées (vitesse et direction continues, solveur sur la première : résultat proche, pas identique, car le raccord lancé en Bézier de 5.2 modifie la trajectoire près du point de coupe ; frise-1 ajoute un test qui mesure l'écart de trajectoire et d'instant au point de coupe). Un point de passage reste une cible possible (`{ point }`), pour le cas « lâcher quand elle passe au point ».
- **Q5. Temps de contrôle** (D-110, D-121). Collé veut dire « au même instant », or on veut pouvoir lâcher 0,3 s après la réception. **Recommandation** : écart optionnel sur le collage (`offset >= 0`, défaut 0), dans l'inspecteur seulement ; il garde le nom « Temps de contrôle » sur une passe et un jeu au pied.
- **Q6. Bord gauche.** Le prompt ne définit que le bord droit. **Recommandation** : même règle pour tous les blocs, l'autre bord ne bouge pas. Tirer le bord gauche change l'instant de départ et donc la durée (durée imposée, vitesse du ballon, temps de vol, durée du regroupement, durée de la séquence). Glisser le bloc entier garde sa durée.
- **Q9. L'embranchement est-il un bord ?** **Recommandation** : oui. Il se colle à un événement du tronc et sert de cible ; ainsi, modifier le tronc l'entraîne, et les actions d'option qui lui sont collées avec lui. Déplacé seul, sans collage, les actions passées du mauvais côté sont signalées (section 2). Un embranchement a au moins deux options ; supprimer l'avant-dernière fond la dernière dans son parent.

### Sans temps : l'édition, les vignettes et les traces

- **Q7. Que montre l'éditeur, et où va une nouvelle action ?** Il n'y a plus de temps sélectionné (D-009, D-010). **Recommandation** : un seul mode à l'arrêt, le terrain montre et édite l'instant du curseur.
  - Jetons à leur position à `t` ; trajectoires de l'intervalle en cours en plein, antérieures en grisé, ultérieures non dessinées.
  - Sélectionner un bloc dans la frise, ou une action sur le terrain, amène le curseur dans l'intervalle de l'action s'il n'y est pas ; sinon sa trajectoire n'est pas dessinée et ne peut pas être modifiée.
  - Nouvelle action : départ au curseur, dans la branche affichée ; à l'instant exact de l'embranchement, dans l'option affichée.
  - Placements de départ déplaçables seulement à `t = 0` ; « Placer » fixe toujours le placement de départ.
  - En lecture, le terrain n'est pas éditable ; un geste d'édition arrête la lecture.
- **Q8. Intervalles.** Des séquences peuvent laisser des trous, ou se chevaucher. **Recommandation** : un **intervalle** est une séquence, ou un trou d'une branche où démarre au moins une action (sans libellé). Cette seule règle sert aux traces (intervalle en cours appuyé, antérieurs estompés), au PDF et à l'éditeur, et répond à la question des traces appuyées. Deux conséquences :
  - sans aucune séquence et sans embranchement : une seule vignette, tout appuyé (point 8) ;
  - sans séquence mais avec un embranchement : une vignette pour le tronc et une par option, et non une par ligne. C'est un écart à la lettre du point 8, pour garder l'arbre de vignettes de D-063.
  - Deux séquences d'une même ligne qui se chevauchent : la seconde part à la fin de la première, signalée.

### Interface, exports, vocabulaire

- **Q10. Liste des actions (6.7, D-113).** **Recommandation** : retirée. Les blocs reprennent clic, survol, Suppr, pastilles et détails en infobulle ; la frise occupe toute la largeur de la bande du bas. Le numéro 6.7 reste, avec un renvoi, pour ne pas casser les références.
- **Q11. Touches.** **Recommandation**, valable pour bloc, bord et embranchement :
  - Maj+clic ajoute ou retire de la sélection, sur le terrain comme dans la frise ; le cadre sélectionne dans les deux ;
  - Ctrl+glisser décale tout ce qui suit dans la branche et ses descendantes, jamais une option sœur (Maj est pris, et Ctrl n'est utilisé dans aucun glisser actuel) ;
  - Alt+glisser désactive l'aimantation, pour poser un bord à côté d'un autre sans le coller. Sous Windows, Alt relâché seul peut donner le focus au menu de Chrome (à vérifier) : vérification prévue dans frise-2, autre touche proposée alors si besoin.
- **Q12. Vocabulaire et cartons.** **Recommandation** :
  - « Embranchement » remplace « Point d'option » dans l'interface et la SPEC (code : `branch point`, comme le glossaire) ;
  - le préfixe « Temps n, » des cartons et titres d'option devient « À 4,5 s, », seulement quand la combinaison a plusieurs embranchements ;
  - en-tête du GIF : « Sortie de mêlée, option B » ; sans séquence, « Option B » ; dans le tronc sans séquence, vide.
- **Q13. `main` entre les lots.** Chaque PR va vers `main` et se déploie (règle 11), et changer le modèle oblige à porter tous les consommateurs d'un coup. **Recommandation** : l'accepter ; après frise-1, le site marche mais sans frise (instants réglés dans l'inspecteur) jusqu'à frise-2. Les combinaisons étant jetables, le risque est faible.

## 4. SPEC 1.9, par section

Version globale 1.9 ; les fichiers 02 à 12 passent en 1.9 ; 00, 01, 13, 14, 15 inchangés (aucune mention trouvée par Grep).

**2.** La ligne « Temps organisés en arbre » devient « Frise chronologique continue, avec embranchements d'option » ; même raison.

**3.3 et 3.5.** `renderSchematic(ctx, play, branchPath, interval, viewport, theme, settings, caches)` dessine un intervalle à l'arrêt. Préférence « pause entre les séquences ».

**4. Modèle**
- 4.1 : types de la section 1 ; paragraphe des versions réduit à la v5.
- 4.3, retiré : racine et phases sœurs reformulées sur les branches ; « deux courses dans un temps » (D-013) ; liens.
- 4.3, ajouté : `branchAt` strictement croissant le long d'une ligne ; au moins deux options par embranchement, une seule par défaut ; séquence et action dans leur branche, sinon signalées (section 2, Q8) ; graphe des dépendances étendu à tous les bords, y compris séquences et embranchements. La règle de `meetsOwnPass` reste (la course de la receveuse collée à l'arrivée de sa passe ne dépend que du lâcher et de la passeuse).
- 4.4 : un fichier de version antérieure à 5 est refusé avec un message clair, jamais modifié ni déplacé (règle 9), import de lot compris ; `reglages.json` inchangé.
- 4.5 : réécrite. Aucune migration vers la v5 (exception écrite) ; le mécanisme reprend à partir de la v5 ; fixture figée `play-v5-frise.json` ; `schemaV0` à `schemaV3` et fixtures `play-v*` supprimés.

**5. Moteur**
- 5.1 : durée d'une ligne = plus tard de ses fins d'actions. Les actions démarrent à leur instant absolu ; plus de durée de phase ni de somme.
- 5.2, retiré : « Finit lancée », « Sans effet », recompilation, drapeau, pose automatique.
- 5.2, gardé : premier point non stocké ; modifier une action n'altère jamais les points des suivantes ; prolongation lancée en Bézier, déclenchée par le collage ; Q1 ; tronc identique (Q2).
- 5.3 et 5.9 : mentions seulement. Choisir une allure retire la durée imposée et décolle un bord droit qui s'étire, une vitesse de segment non (le dernier geste gagne).
- 5.4 : un seul mode de lâcher, à son instant, collé ou non. La tolérance de 0,5 s reste pour un lâcher non collé. Cible de collage jamais atteinte : passe ignorée et signalée. Un ramassage n'est toujours pas une réception (D-119). Recherche de ramassage sur toute la ligne. Bord droit au point que le ballon va moins vite que la receveuse : signalé (convergence non garantie).
- 5.5 : inchangée. 5.6 : ligne d'avantage au début de l'intervalle affiché. 5.7 : la dérivée au lâcher se lit sur la course précédente de la ligne.
- 5.8, renommée « Collage et synchronisation » : remplace les liens ; tableau des cas particuliers repris (borne au lieu de 0, cible jamais atteinte, cycle) ; simulation de la ligne au lieu de la phase, dans l'ordre du graphe ; trait en tirets de la surcouche gardé.

**6. Éditeur**
- 6.1 : bande du bas entièrement occupée par la frise, hauteur fixe, défilement interne (D-048 inchangée).
- 6.2 :
  - Sélection et raccourcis selon Q7 et Q11.
  - Course : départ au curseur ; posée pendant une course de la même joueuse, elle coupe la course en cours au curseur et lui est collée (lancée), comme « Couper la course ici » (Q4) ; collée si le curseur est sur la fin de sa course précédente (le curseur s'aimante aux bords) ; plus de « Finit lancée ».
  - Passe et jeu au pied : au curseur si elle a le ballon ; sinon collés à sa prochaine réception ; une réception tracée plus tard colle une passe en attente ; ramassage : instant fixe (D-119).
  - Regroupement : formation collée à la fin de course ou à la réception.
- 6.3 : remplacée selon Q7.
- 6.4 « Frise », ce qu'elle permet, sans son aspect :
  - une piste, rangées empilées automatiquement, joueuse sans action absente, lisibilité exigée ;
  - blocs d'actions et de séquences, sélection liée au terrain ;
  - bords, collage et décollage (seuil en pixels, HYPOTHÈSE dans `defaults.ts`) ; allonger un bloc ne décale que ce qui lui est collé ;
  - embranchements et options, repris de D-012 : créer à t, condition, défaut, dupliquer, supprimer avec confirmation, lettres recalculées. « Ajouter un temps » et « Insérer un temps » sont retirés, remplacés par Ctrl+glisser ;
  - consigne au-delà de 60 caractères : avertissement, sur la séquence.
- 6.5 : « Départ » absolu (calculé si collé, avec la cible et « Décoller ») ; choix Q3 ; « Temps de contrôle » ; retrait de « Finit lancée », « Caler sur… », « Lâcher à la réception » ; ajout des panneaux Séquence et Embranchement.
- 6.7 : renvoi à 6.4 (Q10).

**7. Lecteur**
- Précédent et suivant : débuts de séquence et embranchements, puis début et fin de la ligne.
- Pause automatique à la fin de chaque séquence.
- « S'arrêter aux options » à l'embranchement (D-011 inchangée).
- Traces par intervalle (Q8) ; consigne de la séquence à `t`.

**8.** Vignette de la bibliothèque : premier intervalle de la ligne par défaut.

**9.2 GIF** (réponse à la question)
- D-058 inchangée : tronc, option A, carton, **reprise à l'instant de l'embranchement**, option B ; une action commencée avant continue d'elle-même.
- Préfixe et en-tête selon Q12 ; bandeau de la séquence à `t`, hauteur fixe, vide sans séquence.
- Noms, cadrage, cadence, encodage inchangés.

**9.3 PDF** (réponse à la question)
- Une vignette par intervalle : positions à son début en plein, ses actions en plein (la part restante pour une action commencée avant), l'antérieur en grisé, l'ultérieur absent.
- Dessous : libellé et consigne ; rien pour un intervalle sans séquence.
- Arbre : une rangée pour les intervalles du tronc, puis une par option, dans l'ordre de l'arbre ; titre « Option A : <condition> », préfixe selon Q12 ; une option s'arrête à son propre embranchement.
- Cadrage, débordement, cahier, vectoriel, déterminisme inchangés.

**10.** 10.1 : « temps 1 » devient « curseur à 0 ». 10.3 et 10.4 : `start` absolu ; `release` retiré ; durée de phase retirée ; proposition à la pose selon 6.2 ; recherche de ramassage sur toute la ligne.

**11.7, défense du lot 4** (réponse à la question ; un ajout, aucune règle changée)
- Une défenseure en mode auto n'a pas de bloc.
- Les déclenchements sont les événements de la ligne.
- La simulation n'utilise que le passé, donc le tronc reste identique.
- « Figer » pose des courses à instant absolu dans la branche de la ligne active.
- Le cache est indexé par ligne.
- `lot-4.md` ne change pas : il cite déjà « tronc commun identique » et ne parle pas de temps.

**12.** `GroupRunAction` : `delay` remplacé par `Timed` ; matériel visible « à tout instant ».

## 5. Parties de D-120 et D-121 reportées à 3bis-2

| Point | Sort |
|---|---|
| D-120 : durée imposée et vitesse ajustée s'excluent, départ différé gardé | Repris par « le dernier geste gagne » et Q3 |
| D-120 : « Caler sur… » (refus, Échap...) | Sans objet ; seul le refus avec message reste, à la pose |
| D-120 : point de rendez-vous valant « Fin » | Sans objet (Q4) |
| D-120 : dernier point d'une course supprimé | Repris : le bord collé à ce point se fige, avec un message |
| D-121 : « Changer la cible » | Sans objet : on recolle en déplaçant le bord |
| D-121 : « Délai calculé par le lien » | Repris : « Départ » calculé et non modifiable (6.5) |

La mention « reportée à 3bis-2 » disparaît de l'index pour ces deux décisions.

## 6. Décision D-139

Nouveau fichier `docs/decisions/frise.md`, ligne dans le tableau « Fichiers » et dans l'index. D-139 reprend les points 1 à 10, les hypothèses retenues et les réponses aux questions ; elle inclut le découpage et l'exception à la règle 6. Chaque décision citée reçoit sa mention, et sa ligne d'index change de statut.

| Statut | Décisions |
|---|---|
| Remplacée par D-139 | D-012, D-106, D-108 (le solveur reste : D-129, D-130), D-109, D-113 |
| Remplacée en partie | D-009, D-010, D-013, D-015, D-094, D-104, D-107, D-110 (la tolérance reste), D-120, D-121, D-122 (ligne de la SPEC 2), D-133 (migration ; l'allure saisie reste) |
| Précisée | D-011, D-038 (ajoutée à l'écriture), D-058, D-063, D-075, D-081, D-082, D-085, D-119, D-128, D-129, D-131, D-136 |

Décisions non intégrées : seules D-120 et D-121 en ont, traitées en section 5. Le SPEC README passe à 1.9 et cite D-139.

`CLAUDE.md`, règle 6 : ajouter « Seule exception : le passage à la v5 (frise, D-139), sans migration ; un fichier antérieur est refusé. » Glossaire : retirer « Temps » ; remplacer « Point d'option » par « Embranchement » ; ajouter Frise (`timeline`), Bloc (`block`), Bord (`edge`), Collage (`glue`), Séquence (`sequence`).

## 7. Découpage du code

Ampleur (lignes contenant « phase », `grep -c`) : 1 625 lignes dans 122 fichiers, dont `engine` 439, `editor` 285, `model` 240, `ui` 188, `state` 177, `export` 79, `e2e` 64, `test` 58, `render` 48, `player` 43. Ces chiffres incluent `phasePlay`.

Migrations et schémas figés disparaissent ; la plupart des tests du moteur et de l'éditeur sont à réécrire (ils passent par `src/test/builders.ts`, à porter en premier).

| Lot | Contenu | Blocs | Le site à la fin |
|---|---|---|---|
| **frise-1, modèle et moteur** | A : types, zod, validation, `branches.ts` (remplace `phaseTree.ts`), refus des versions antérieures, suppressions, builders, fixture v5. B : compilation de ligne continue, collages et graphe (`syncGraph.ts`), chevauchements, lancée par collage, Q1 et Q2. C : portage minimal des commandes, de l'état, du lecteur, du rendu et des exports (une vignette par ligne) ; arbre retiré ; départ et durée dans l'inspecteur | 3 | Fonctionne, sans frise (Q13) |
| **frise-2, la frise** | Empilement pur, blocs, curseur ; bords, collage, décollage, sélection multiple, Ctrl et Alt ; embranchements et séquences éditables ; retrait de la liste. L'aspect se décide ici (blocs, couleurs, rangées, onglets) | 2 ou 3 | Éditeur complet |
| **frise-3, lecteur** | Précédent et suivant, pause, traces par intervalle, bandeau, calques | 1 | Lecture complète |
| **frise-4, exports** | GIF (en-tête, cartons, reprise), PDF (intervalles, arbre), vignette de bibliothèque | 1 ou 2 | Tout est en place |

Tests annoncés (détaillés à chaque `/nouveau-lot`) :
- **frise-1** : tronc identique pour tout `t` avant l'embranchement, y compris Q1 et Q2 ; chevauchements ; cycles ; lancée ; refus v1 à v4 sans écriture, dossier et IndexedDB ; déterminisme ; temps de compilation ; écart de trajectoire et d'instant au point de coupe (Q4).
- **frise-2** : empilement (une rangée si un seul événement, aucun recouvrement, joueuse sans action absente) ; logique de glisser pure ; une étape d'annulation par geste ; stabilité du terrain en e2e, Chromium et Firefox ; vérification d'Alt relâché seul sous Windows (Q11).
- **frise-3** : bornes de navigation ; lecture continue et saut direct donnent la même image.
- **frise-4** : plan des images, mise en page, PDF identique octet pour octet.

Risque à mesurer dès frise-1 : recompiler à chaque mouvement de glisser, avec une simulation de ligne au lieu de phase (14 ms aujourd'hui sur la combinaison réaliste, avant ce changement).

### Ce que deviennent 3bis-2 et 3bis-3

Ordre : frise-1 à 4, 3bis-2, 3bis-3, lot 4, lot 5.
- **3bis-2 réduit** : menu du clic droit (blocs compris) et même course pour plusieurs joueuses. Sans objet : « Partir ensemble », « Arriver ensemble », reste de D-120 et D-121.
- **3bis-3** : positions préréglées, périmètre inchangé ; il agit à `t = 0`.

## 8. Étapes de ce chantier

- [x] **Étape 0** : branche `frise-spec` depuis `main` (`d33313f`) ; ce plan, avec les réponses, dans `docs/plans/frise-spec.md` ; `docs/plans/lot-3bis-1.md` déplacé dans `docs/archive/plans/` ; ETAT (PR #9 fusionnée ; vérifications manuelles de 3bis-1 faites et validées le 03/11 ; chantier en cours). `/fin-etape`. (commit « Étape 0 : plan du chantier frise-spec, plan de 3bis-1 archivé », après `d33313f`)

**Bloc A**
- [x] **Étape 1** : D-139, `docs/decisions/frise.md`, index et statuts (section 6, section 5) ; SPEC 2, 3, 4, 5 ; SPEC README ; ETAT. `/fin-etape`. (commit « Étape 1 : D-139, statuts des décisions, SPEC 2 à 5 en frise », après `71516e8`)

**Bloc B**
- [x] **Étape 2** : SPEC 6 à 12 ; lignes du README. `/fin-etape`. (commit « Étape 2 : SPEC 6 à 12 en frise, collages précisés en 4.3 et 5.8 », après `d046bca`)
- [ ] **Étape 3** : `CLAUDE.md` (règle 6, glossaire) ; Grep de contrôle ; ETAT ; PR vers `main`, sans fusion. `/fin-etape`.

Dépendances ajoutées : aucune. ARCHITECTURE, RECETTE et README attendent les `/fin-lot` de frise-N.

## 9. Vérification

Aucun code, donc pas de suite de tests ; la CI de la PR doit rester verte.
- Grep sur `docs/spec/` de `\btemps\b|phase|point d.option|Finit lancée|Caler sur|à la réception|delay` : chaque résultat restant se justifie (« temps de vol », « temps de contrôle », `phasePlay`, renvoi à D-139).
- Chaque règle 1 à 10 du prompt et chaque réponse à une question se retrouve dans une section nommée, et dans D-139.
- Index : version 1.9, ligne de chaque fichier modifié, mention « reportée à 3bis-2 » retirée, statuts à jour.
- `git diff --stat main` : seulement `docs/`, `CLAUDE.md` ; rien dans `src/`.
