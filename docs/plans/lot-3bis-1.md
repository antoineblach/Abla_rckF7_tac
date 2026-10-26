# Plan du lot 3bis-1 : le mouvement sert l'intention tactique

Validé le 25 octobre 2026, avec les réponses Q1 à Q9 et 6 modifications de l'utilisateur, intégrées ci-dessous. Décisions : D-129 à D-134 (étape 0), puis D-135 (bloc 1 : modèle et calibration, réponses Q10 à Q14). Branche `lot-3bis-1` depuis `main` à `8467815`. Partie 1 sur 3 de la suite du lot 3 bis (D-128) ; 3bis-2 (interactions) et 3bis-3 (positions préréglées) suivront, chacune par `/nouveau-lot`.

Ce plan doit se suffire : chaque bloc est lancé dans une nouvelle conversation par `/reprise`. Lecture : dans ce plan, seulement le « Détail par étape » de l'étape, les sections qu'il cite et les puces de « Tests » qui la concernent (Grep du titre, Read ciblé, comme `/reprise`) ; jamais le plan entier. Aucun sous-agent. Dans un bloc : étape, `/fin-etape`, étape suivante (D-125).

## Contexte

Retour de la séance d'usage du 24/10 : accélérations trop lentes et trop contraignantes ; vitesses à calibrer avec un curseur à repères ; les plafonnements « créent le désordre ». Règle de l'utilisateur : ne jamais bloquer, seulement signaler.

État du code au départ :
- `src/engine/profile.ts` : profil trapèze sur les échantillons de la spline (plafond par échantillon, passe avant à `accel`, passe arrière à `decel`, intervalles à accélération constante ; `distanceAt`, `speedAt`, `timeAtDistance` en formule fermée). `solveFactor` : dichotomie sur le logarithme du facteur des vitesses cibles, bornée par `maxFactor`. `scaleTime` / `withDuration` : temps ×r, vitesses ÷r (accélérations ÷r², `accelOf` étant dérivée de v²).
- `src/engine/timeline.ts` : `runMotion` (durée imposée, `maxFactor = speedAlert.danger / cible la plus rapide`, `durationCapped`) ; `resolveLink` (départ différé : délai négatif ramené à 0, `syncLate` ; vitesse ajustée : facteur sur les segments jusqu'au rendez-vous, plafonné au seuil rouge, `syncSpeedCapped`, aussi pour une cible avant le départ) ; `relayMotion` (sprint, facteur jusqu'à `RELAY_MAX_FACTOR = 1000`, puis `withDuration` : le relayeur arrive déjà exactement à la sortie, `relayerLate`) ; `speedLevelsOf` sur les pics réels de chaque segment ; pastilles de vitesse dans `src/engine/evaluate.ts` (`speedBadgesOf`).
- Valeurs (`src/config/defaults.ts`) : `MOTION_DEFAULTS` 3 / 4 / 4 m/s² (HYPOTHÈSE), `MIN_CORNER_SPEED` 1 m/s, `PACE_DEFAULTS` 2 / 4 / 5,5 m/s, `SPEED_ALERT_DEFAULTS` 20 et 25 km/h, `SPEED_FACTOR_SEARCH`.
- Modèle : `RunAction.pace: Pace` ; `Waypoint.speed?: SegmentSpeed` (`Pace | number`) ; `reglages.json` v3 (`motion`, `speedAlert`).
- Le calque du lecteur s'appelle « Vitesses » (clé `speedAlert`, `src/render/layers.ts`).

## Modifications de l'utilisateur à la validation

1. Pas d'étape de documentation ni de PR dans le plan : SPEC 1.8, ARCHITECTURE, RECETTE, README, ETAT, suite complète et PR sont le travail de `/fin-lot` (étapes 1 à 4 de son skill). À l'étape 0 : la ligne de `.claude/skills/fin-lot/SKILL.md` sur « reportée à <lot> » ; D-129 et suivantes marquées « non intégrée (x.y) » dans l'index.
2. Ancien bloc 3 découpé : étape 3 (intentions tenues) et étape 4 (alertes d'accélération et de freinage), puis étape 5 (schéma v4), étape 6 (interface), étape 7 (combinaisons existantes), chacune seule dans son bloc.
3. Bascule (Q2) : la pointe de la joueuse (`topSpeed`) est un réglage de `reglages.json` v4 dans les deux modèles ; avec le trapèze, elle ne sert qu'à la bascule. Le seuil rouge ne règle plus jamais le mouvement. Choisir le trapèze retire seulement la loi a(v).
4. Pastilles d'accélération et de freinage (Q5) : placement hors du jeton et des poignées (A.3).
5. Vérification de bout en bout : pas de relance du script jetable (non commité) ; le test du profil calibré vérifie le moteur réel.
6. Question Q14 ajoutée à la fin du bloc 1.

## A. Principe : le mouvement sert l'intention (D-129)

Les bornes physiques (vitesse, accélération, freinage, virages) façonnent le mouvement par défaut ; elles ne contraignent jamais une intention du coach : durée imposée (D-107), lien de synchronisation dans ses deux réglages (D-108, jusqu'à son remplacement en 3bis-2), relayeur au ballon à la sortie (10.3). Chacune est tenue exactement ; si cela demande plus que les bornes, la course va plus vite, accélère, freine ou tourne plus fort, et seuls les seuils d'alerte le signalent (Q3). Jamais bloquant, jamais dans les exports. Les seuils d'alerte ne règlent jamais le mouvement.

### A.1 Solveur à deux leviers (D-130)

- **Levier 1, vitesses cibles** (comme aujourd'hui) : facteur commun f sur les vitesses cibles, accélérations bornées. Sert seul pour ralentir (f < 1, toujours possible) et pour accélérer jusqu'à la bascule : f au plus `topSpeed` / cible la plus rapide (1 si une cible atteint déjà la pointe). `motion.topSpeed`, pointe de la joueuse, est un réglage de `reglages.json` v4 dans les deux modèles ; avec le trapèze, elle ne sert qu'à la bascule.
- **Levier 2, mise à l'échelle du temps** : au-delà de la bascule, facteur k >= 1 : vitesses cibles ×k, et toutes les bornes de l'intervalle ×k² (accélération, freinage, latérale ; vitesse minimale en virage et pointe ×k). Une course entière ainsi mise à l'échelle est exactement la même course jouée plus vite.
- **Relayeur** : même solveur et même bascule (`topSpeed` / sprint) ; `RELAY_MAX_FACTOR` supprimé.
- Les bornes deviennent **par intervalle** dans `buildProfile` (`ProfileInput.boundScale` : un facteur par segment de spline, 1 par défaut) au lieu d'un `scaleTime` global : la vitesse de départ imposée (course lancée, D-106) reste continue.
- **Vitesse ajustée** : les deux leviers ne portent que sur les segments avant le rendez-vous. Continuité au rendez-vous : un seul profil sur toute la spline ; les passes avant et arrière raccordent les vitesses (le point de rendez-vous prend déjà le plus bas des deux plafonds voisins, `targetAt`) ; la course freine avant le rendez-vous avec le freinage ×k² si la suite est plus lente ; seule l'accélération change de valeur au rendez-vous, comme à tout plafond.
- **Exactitude** : le temps au point visé décroît continûment avec f puis k (vitesses de la partie mise à l'échelle croissantes en chaque échantillon) ; dichotomie à nombre fixe d'itérations sur log f puis log k (déterminisme) ; correction finale existante (`scaleTime` d'un rapport à 1e-15 près). Borne numérique de recherche `SPEED_FACTOR_SEARCH.maxTimeScale` (1000) : au-delà, le cas est traité comme « cible avant le départ ».
- `RunMotion` : `factor` (vitesses cibles) et `accelFactor` (k², 1 sinon) ; l'inspecteur et la liste les affichent (« vitesses ×1,25, accélérations ×1,6 »).

### A.2 Tableau des cas (D-129 à D-131)

| Cas | Aujourd'hui | Nouveau | Alerte |
|---|---|---|---|
| Durée imposée plus longue que la durée naturelle | facteur < 1 sur les vitesses cibles | inchangé | aucune |
| Durée imposée trop courte | facteur plafonné au seuil rouge ; la course dure plus que demandé ; `durationCapped` | durée tenue exactement : levier 1, puis levier 2 | seuils de vitesse, d'accélération et de freinage seuls ; `durationCapped` retiré |
| Vitesse ajustée au-delà des bornes | facteur plafonné, arrivée en retard ; `syncSpeedCapped` | rendez-vous tenu exactement, leviers sur les segments avant le rendez-vous | seuils seuls ; `syncSpeedCapped` retiré |
| Départ différé, délai calculé négatif | départ à 0, arrivée en retard ; `syncLate` | départ à 0 et leviers sur les segments avant le rendez-vous, comme une vitesse ajustée : arrivée à l'heure | `syncLate` gardé, reformulé : « il aurait fallu partir x s plus tôt : départ immédiat, course accélérée » ; seuils |
| Cible avant le départ (instant voulu <= 0, ou au-delà de la borne de recherche) | facteur au seuil rouge ; `syncSpeedCapped` sans vitesse | seul repli : vitesses et délai enregistrés, arrivée en retard | `syncTargetBeforeStart` : retard en secondes |
| Relayeur trop loin | facteur <= 1000 puis `withDuration` : arrivée exacte | inchangé sur le fond ; même solveur et même bascule que les courses | `relayerLate` gardé, avec la vitesse de pointe et le facteur d'accélération |
| Course lancée dont la vitesse de départ dépasse le freinage possible | la vitesse de départ prime, sans alerte | inchangé | alerte de freinage si au-delà d'un seuil |

Hors périmètre : les validations du ballon (passeuse sans ballon, tolérance de 0,5 s, lâcher à la réception ; D-013, D-110, D-119) ne sont pas des plafonnements et restent.

### A.3 Alertes d'accélération et de freinage (D-132)

- Seuils orange (avertissement) et rouge (erreur) pour l'accélération et pour le freinage, en m/s², réglables (`reglages.json` v4, `accelAlert`, `decelAlert`), accélération 6 et 8 m/s², freinage 5 et 7 m/s² (D-135). Mesurés sur le profil réel après mise à l'échelle, sur la partie courue de chaque segment (course arrêtée par un regroupement : comme `speedLevelsOf`) : pic d'accélération = plus grande accélération instantanée du modèle au début d'un intervalle qui accélère (a(v) × k², avec l'a0 et l'asymptote du segment), pas `accelOf`, moyenne de l'intervalle qui dépend de la longueur du segment (D-135) ; pic de freinage = plus grand −`accelOf` (constant, exact).
- Codes : `runAccelHigh` / `runAccelTooHigh`, `runBrakeHigh` / `runBrakeTooHigh`, paramètres segment et valeur. `durationCapped` et `syncSpeedCapped` sont retirés sans remplacement ; les alertes ne sont pas stockées dans les fichiers.
- Affichage comme les vitesses (D-112) : inspecteur, liste des actions (pastilles par gravité, D-121), pastilles dans l'éditeur, calque « Vitesses » du lecteur, nom gardé, infobulle « Vitesses et accélérations » ; jamais dans les GIF, les PDF ni les vignettes.
- Pastille : losange orange ou rouge, « + » pour l'accélération, « − » pour le freinage ; une par segment et par type au-delà d'un seuil ; visible dès que la joueuse atteint son point dans le lecteur, toujours dans l'éditeur. La pastille de vitesse reste ronde à « ! » au milieu du segment.
- Placement : avec a(v), le pic d'accélération est au départ de la course et celui de freinage juste avant un arrêt ou un rendez-vous, donc sous le jeton ou une poignée dans l'éditeur. La pastille va au point de la zone au-delà du seuil (intervalles du segment dont l'accélération, ou le freinage, dépasse le seuil) le plus proche du pic, à au moins `ACCEL_BADGE_CLEARANCE` des extrémités du segment (rayon du jeton plus une marge, HYPOTHÈSE dans `defaults.ts`). Segment trop court (moins de deux fois cette distance) : milieu du segment, décalé le long du segment, vers le pic, d'un diamètre de pastille, pour ne pas couvrir la pastille de vitesse.
- Accélération latérale : pas d'alerte (Q7).

## B. Calibration et choix du modèle : bloc 1

Bloc 1 seul dans son bloc, après le bloc 0. Rien n'est codé dans `src/`.

- **Recherche** (WebSearch, WebFetch, sans sous-agent, une dizaine au plus) : relire les trois sources du prompt :
  - France féminine à 7, meilleurs temps 2019-2020 : 10 m 1,83 s ; 20 m 3,24 s ; 50 m 7,08 s. https://www.frontiersin.org/articles/10.3389/fspor.2023.1120162/full
  - rugby à 7 féminin professionnel : seuil de sprint adapté aux femmes 4,7 m/s, seuil usuel 5,6 m/s. https://lida.sport-iat.de/ta/Record/4067490
  - amatrices à XV, GPS : environ 2 sprints par match, 12 m en moyenne, 24 m au plus. https://www.iat.uni-leipzig.de/datenbanken/iks/drv-rugby/Record/4050053
  - puis : Samozino et al. 2016 et la méthode simple de Morin (modèle v = vmax(1 − e^(−t/τ)), correction du départ des cellules) ; vitesses de pointe GPS à 7 féminin ; temps de sprint de joueuses amatrices ou de club ; capacité de freinage (décélération maximale) de sportives collectives ; vitesse en virage ou accélération centripète ; zones de vitesse GPS (marche, trot).
- Calcul de l'architecte, à relire : 10 m en 1,83 s depuis l'arrêt, à accélération constante, donnent environ 6 m/s² (les 3 m/s² actuels sont deux fois trop faibles) ; un ajustement exponentiel brut sur les trois temps donne vmax ≈ 7,7 m/s et τ ≈ 0,6 s, peu crédible (départ lancé des cellules) : ne pas s'y fier sans l'expliquer.
- **Tableau à remplir**, dans ce plan :

| Paramètre | Actuel | Proposé | SOURCE ou HYPOTHÈSE justifiée | Élite ou amatrice |
|---|---|---|---|---|
| Marche, trot, sprint (allures) | 2 / 4 / 5,5 m/s | inchangées | HYPOTHÈSE, choix du coach (D-111). Repères : sprint (19,8 km/h) au-dessus du seuil de sprint féminin (17 km/h, Bradley 2024 ; 4,7 m/s, Misseldine 2021) ; trot (14,4 km/h) au seuil de course intense féminine (14 km/h) | amatrice |
| Pointe de la joueuse `topSpeed` | (aucune) | 24 km/h (6,67 m/s) | HYPOTHÈSE : 0,84 fois l'élite (28,6 km/h, B.1) ; sous le seuil rouge (D-111) ; handballeuses de 17 ans : 6,82 m/s (van den Tillaar 2022) | amatrice ; élite 7,94 m/s |
| Accélération au départ a0 (ou accélération du trapèze) | 3 m/s² | 5,2 m/s² (τ = 1,28 s) ; trapèze : 3,5 m/s² | SOURCE : France à 7 féminine corrigée de +0,5 s (Haugen) : élite 6,2 m/s², τ 1,28 s. HYPOTHÈSE : même τ pour l'amatrice. Trapèze : ajusté sur l'exponentiel amateur plafonné au sprint, de 0 à 20 m | amatrice ; élite 6,2 (6,2 à 7,8 selon la correction) |
| Accélération au départ de la marche et du trot (Q14) | 3 m/s² | a0 × cible / sprint : 1,9 et 3,8 m/s² | HYPOTHÈSE (Q14) | |
| Freinage | 4 m/s² | inchangé | SOURCE : Philipp 2024, freinage maximal moyen de 4,0 à 4,5 m/s² | sportives universitaires |
| Accélération latérale | 4 m/s² | inchangée | HYPOTHÈSE, aucune source trouvée : rayon 5 m à 16 km/h | |
| Vitesse minimale en virage | 1 m/s | inchangée | HYPOTHÈSE | |
| Seuils d'accélération orange, rouge | (aucun) | 6 / 8 m/s² | HYPOTHÈSE : orange au niveau de l'élite (6,2), rouge au-delà du haut de sa fourchette (7,8) | |
| Seuils de freinage orange, rouge | (aucun) | 5 / 7 m/s² | HYPOTHÈSE appuyée sur Philipp 2024 : orange au-dessus du freinage maximal moyen (4,0 à 4,5), rouge au pic mesuré (6,6 à 7,4) | |
| Seuils de vitesse | 20 / 25 km/h | inchangés (D-111) | choix du coach | |

- **Script jetable** dans le dossier temporaire de la session, non commité : reproduit `buildProfile` en ligne droite et en virage (rayon 5 m) pour les deux modèles ; ajuste les paramètres aux trois temps avec un décalage de départ (et explique le τ ≈ 0,6 s de l'ajustement brut) ; mesure les écarts à 10, 20 et 50 m, l'écart entre l'exponentiel exact et sa version échantillonnée (C), le temps de calcul d'un profil, la distance de freinage depuis le sprint ; chiffre les exemples de la section F (20 m au trot, 30 m au sprint, avant et après).
- **Proposition** écrite dans ce plan, puis arrêt sur Q10 à Q14. L'utilisateur répond dans la même conversation ; décision dans `docs/decisions/lot-3bis.md` (D-118 change de statut) ; plan mis à jour (C, F, valeurs, et blocs 2 à 7 si le trapèze est choisi) ; `/fin-etape 1`. Si une allure calibrée dépasse un seuil (sprint au-delà de 20 km/h par exemple), c'est une question ; aucune nouvelle allure nommée sans question. Seuils de vitesse inchangés.

### B.1 Résultats du bloc 1 (25/10)

Script `calib.mjs` dans le dossier temporaire de la session, non commité : reproduit `buildProfile` (64 échantillons par segment, passes avant et arrière, intervalles à accélération constante) en trapèze et en exponentiel.

**Sources lues** (12 recherches ou lectures, dont 2 sans contenu) :
- France à 7 féminine, 2019-2020 (https://www.frontiersin.org/articles/10.3389/fspor.2023.1120162/full) : moyennes des meilleurs essais, 10 m 1,83 ± 0,08 s, 20 m 3,24 ± 0,12 s, 50 m 7,08 ± 0,24 s ; cellules à 0, 10, 20 et 50 m ; départ debout, pied avant 0,5 m derrière la ligne ; pas de vitesse maximale publiée.
- Misseldine et al. 2021, JSCR 35(1) (https://lida.sport-iat.de/ta/Record/4067490) : 12 professionnelles à 7 ; seuils de sprint 4,7 m/s (adapté) et 5,6 m/s (usuel) ; pic par match 90,6 % de la vitesse maximale.
- Westbrook 2018, J Aust Strength Cond 26(3) (https://lida.sport-iat.de/drv-rugby/Record/4050053) : 6 amatrices à XV ; 2,3 sprints par match, 11,8 m en moyenne, 24,3 m au plus ; pas de vitesse publiée.
- van den Tillaar et al. 2022 (https://www.frontiersin.org/articles/10.3389/fspor.2022.877482/full) : correction de +0,5 s des temps aux cellules recommandée par Haugen et al. (2019, 2020) pour un départ à 0,5 m de la première cellule (+0,21 à +0,3 s à 0,05 m) ; handballeuses de 17 ans : pic de 6,82 m/s au laser.
- Philipp et al. 2024 (https://pmc.ncbi.nlm.nih.gov/articles/PMC11246955/) : 20 joueuses de lacrosse (NCAA D1), freinage maximal depuis 5,9 à 6,0 m/s : moyen 4,0 à 4,5 m/s², pic 6,6 à 7,4 m/s², arrêt en 4,6 à 4,9 m.
- Bradley et al. 2024, Eur J Sport Sci (https://sure.sunderland.ac.uk/id/eprint/17758/, résumé seul) : seuils féminins de course intense (> 14 km/h) et de sprint (>= 17 km/h).
- Samozino et al. 2016 : modèle v = vmax(1 − e^(−t/τ)) de la méthode simple, d'après les articles qui la citent ; texte intégral non lu. Aucune source trouvée sur la vitesse en virage, ni sur les zones de marche et de trot.

**Ajustements aux trois temps** (temps aux cellules) :

| Modèle et départ | Pointe | τ | a0 | Écarts 10 / 20 / 50 m |
|---|---|---|---|---|
| Exponentiel brut (chronomètre lancé à l'arrêt) | 7,70 m/s | 0,60 s | 12,8 m/s² | +41 / −47 / +10 ms |
| Exponentiel, temps + 0,5 s (Haugen) | 7,94 m/s (28,6 km/h) | 1,28 s | 6,2 m/s² | +6 / −6 / +1 ms |
| Exponentiel, départ fixé de 0,5 à 1 m avant la cellule | 7,81 à 7,88 m/s | 1,00 à 1,21 s | 7,8 à 6,5 m/s² | ±26 à ±15 ms |
| Exponentiel, départ libre (3 inconnues) | 8,05 m/s | 1,67 s | 4,8 m/s² | 0, mais départ 2,2 m avant la cellule : pas crédible |
| Trapèze (brut, + 0,5 s ou départ libre) | 7,66 m/s | | 6,7 ; 3,6 ; 4,6 m/s² | +45 / −60 / +15 ms |

- τ ≈ 0,6 s de l'ajustement brut : le chronomètre part quand la joueuse franchit la première cellule, environ 0,5 s et 0,7 m après le début du mouvement, déjà à 2,6 m/s. Supposée arrêtée à la cellule, elle doit couvrir 10 m en 1,83 s, d'où a0 = 12,8 m/s² et τ = pointe / a0 ≈ 0,6 s. Les 6 m/s² à accélération constante (2 × 10 / 1,83²) tombent près de la valeur corrigée par compensation de deux erreurs.
- Élite retenue : correction de Haugen, prévue pour ce protocole. Trois temps ne fixent pas mieux a0 : de 6,2 à 7,8 m/s² selon la correction. Le trapèze manque les trois temps de 45 à 60 ms : il ne peut pas être à la fois vif au départ et lent à l'approche de la pointe.
- Amatrice (HYPOTHÈSE) : pointe 24 km/h, 0,84 fois l'élite, même τ (1,28 s), donc a0 = 5,2 m/s². Depuis l'arrêt : 10 m en 2,62 s, 20 m en 4,24 s, 50 m en 8,78 s (2,12, 3,74 et 8,28 s aux cellules, 16 % de plus que l'élite) ; 21,6 km/h après 12 m.

**Exponentiel échantillonné** (C) : la représentation à accélération constante entre deux échantillons retarde la course d'un temps constant, pris presque entier sur le premier intervalle depuis l'arrêt : 9 ms sur un segment de 10 m, 18 ms sur 20 m, 48 ms sur 50 m ; 32 cm au plus à un même instant, en pleine vitesse. C'est sous l'incertitude de la calibration (écarts types de 0,08 à 0,24 s, rapport amateur supposé). Coût d'un profil de 193 échantillons : 11 µs en trapèze ; 30 µs en exponentiel avec Newton (5 itérations depuis l'estimation à accélération constante ; 4 suffisent, écart 1e-14 m/s) ; 78 µs en dichotomie de 60 itérations ; environ 3 ms pour une résolution à deux leviers (une centaine de profils).

**Comparaison** (ligne droite, de l'arrêt à l'arrêt, freinage 4 m/s², durées en secondes) :

| Course | Actuel : trapèze 3 | Trapèze 3,5 | Exponentiel amatrice | Exponentiel élite |
|---|---|---|---|---|
| 3 m au sprint | 1,87 | 1,79 | 1,71 | 1,63 |
| 5 m au sprint | 2,42 | 2,31 | 2,25 | 2,14 |
| 10 m au sprint | 3,42 | 3,29 | 3,32 | 3,13 |
| 30 m au sprint | 7,06 | 6,93 | 6,98 | 6,78 |
| 20 m au trot | 6,17 | 6,07 | 6,02 (Q14 a) ; 6,21 (Q14 b) | 5,91 |
| 20 m à la marche | 10,59 | 10,55 | 10,50 (Q14 a) ; 10,87 (Q14 b) | 10,45 |
| Virage : 10 m, quart de cercle de 5 m, 10 m | 7,04 | 6,91 | 6,98 | non calculé |
| Distance au bout de 1 s, sprint | 1,50 m | 1,75 m | 1,94 m | 2,33 m |
| Allure du sprint atteinte | 1,83 s, 5,0 m | 1,57 s, 4,3 m | 2,24 s, 7,9 m | |

- Freinage à 4 m/s² : 3,8 m et 1,4 s depuis le sprint ; 5,6 m depuis la pointe amatrice.
- Le trapèze à 3,5 m/s² donne presque les mêmes durées que l'exponentiel amateur (0,15 s d'écart au plus). L'exponentiel part plus vite (1,94 m contre 1,75 m au bout de 1 s), approche l'allure progressivement et réaccélère moins à vitesse élevée (1,7 m/s² à 16 km/h, après un virage).
- Pour la section F : courses au sprint de 1 % (30 m) à 9 % (3 m) plus courtes ; au bout de 1 s, une joueuse est 0,44 m plus loin ; trot et marche de −2 % à +3 % selon Q14 ; GIF à peine plus courts.

**Proposition** (questions Q10 à Q14, section « Questions et réponses ») :
- Q10 : exponentiel en a(v) (C) : modèle de référence, celui de la calibration ; a0 et pointe gardent leur sens pour les alertes et pour le lot 4 ; piste voulue en D-118. Représentation à accélération constante gardée ; Newton à 5 itérations ; test du profil calibré : 10 et 20 m en un segment, 50 m en deux segments de 25 m, tolérance 0,05 s.
- Q11 : valeurs amatrices du tableau : pointe 24 km/h, a0 5,2 m/s² ; freinage, latérale, vitesse minimale en virage et allures inchangés ; aucune allure au-delà d'un seuil (l'amatrice du modèle dépasse 20 km/h après 12 m de sprint, ce n'est pas une allure).
- Q12 : accélération 6 et 8 m/s², freinage 5 et 7 m/s². Précision de A.3 : le pic d'accélération mesuré est l'accélération instantanée du modèle au début de chaque intervalle (a(v) × k²), pas `accelOf`, moyenne d'un intervalle qui dépend de la longueur du segment (4,74 m/s² sur 5 m, 4,14 m/s² sur 30 m pour a0 = 5,2) ; le freinage reste mesuré par `accelOf` (constant, exact).
- Q13 : asymptote relevée, a0 gardé : pour une cible au-delà de 0,95 fois la pointe (22,8 km/h), l'asymptote du segment devient cible / 0,95 (HYPOTHÈSE dans `defaults.ts`). 30 m à 28 km/h : 5,21 s, 28 km/h atteints à 26,7 m. Autres : a(v) nul au-delà de la pointe, plafonnée à 23,7 km/h en silence (exclu) ; plancher d'accélération de 1 m/s², 5,44 s ; asymptote relevée avec a0 proportionnel, 4,96 s.
- Q14 : a0 proportionnel à la cible jusqu'au sprint, a0 × min(1, cible / sprint) : marche 1,9 m/s² (2 m/s en 1,39 s), trot 3,8 m/s² (4 m/s en 1,64 s) ; continu avec le curseur, sans nouveau réglage ; sprint et au-delà inchangés. Avec a0 pour toutes les allures, une marche atteint 2 m/s en 0,55 s et 0,55 m.

## C. Modèle de mouvement

Retenu au bloc 1 (D-135, Q10) : **exponentiel en a(v)**, valeurs d'une joueuse amatrice (tableau de B, B.1).

- Loi de la passe avant : a(v) = a0·(1 − v/vmax), vmax = `topSpeed` (24 km/h), pointe de la joueuse, pas la vitesse du segment ; équivaut à v = vmax(1 − e^(−t/τ)), τ = vmax/a0 (1,28 s), modèle de la méthode de Samozino et al. 2016. Au-delà de vmax (départ lancé plus rapide), a(v) = 0 : la vitesse se maintient si le plafond le permet, la passe arrière freine sinon.
- a0 et asymptote par segment, selon sa vitesse cible c (après le facteur f du levier 1) : a0 × min(1, c / sprint) (Q14 : marche 1,9 m/s², trot 3,8 m/s²) ; asymptote max(`topSpeed`, c / 0,95), a0 gardé (Q13 : une cible au-delà de 22,8 km/h est atteinte ; 0,95 : HYPOTHÈSE dans `defaults.ts`). Le levier 2 multiplie ensuite a0 par k² et l'asymptote par k.
- Sur un intervalle qui accélère librement, v1 en fonction de Δs par la relation fermée Δs = τ·(vmax·ln((vmax − v0)/(vmax − v1)) − (v1 − v0)) : si la distance pour atteindre le plafond de l'échantillon est <= Δs, v1 = plafond ; sinon Newton à 5 itérations sur w = ln((vmax − v1)/vmax), depuis l'estimation à accélération constante (4 suffisent : écart 1e-14 m/s à une dichotomie de 60 itérations).
- L'intervalle reste représenté à accélération constante entre ses deux vitesses (temps 2Δs/(v0 + v1)) : `distanceAt`, `speedAt`, `timeAtDistance`, `accelOf` et `scaleTime` ne changent pas ; position et vitesse continues ; lecture continue et saut à `t` identiques ; table des temps monotone, inverse exacte. Écart à l'exponentiel exact, pris presque entier sur le premier intervalle depuis l'arrêt : 9 ms sur un segment de 10 m, 18 ms sur 20 m, 48 ms sur 50 m (32 cm au plus à un même instant) ; gardé (D-135). Coût : 30 µs par profil de 193 échantillons (11 µs en trapèze), environ 3 ms pour une résolution à deux leviers.
- Plafonds de segment et de virage, passe arrière (freinage constant) : inchangés. Déterminisme : aucune source d'aléa, itérations fixes.

## D. Curseur de vitesse et combinaison v4 (D-133)

- `RunAction.pace: Pace | number` (type `SpeedValue` ; `SegmentSpeed` en devient un alias) : `schemaVersion` 4. `src/model/schemaV3.ts` (schéma v3 figé, comme `schemaV2.ts`), `src/model/schema.ts` en v4, migration v3 vers v4 sans changement de contenu ; `play-v3-lot3bis.json` reste figée ; nouvelle fixture figée `play-v4-lot3bis1.json` (allure saisie sur une course, vitesse saisie sur un segment, lien, durée imposée) pour les lots 4 et 5. Une page non rechargée refuse les fichiers v4 (4.5, mécanisme existant, testé).
- Consommateurs de `run.pace` : `runTargets` (`timeline.ts`), `actionReport.ts`, `src/ui/describe.ts`, `RunInspector.tsx`, `updateRun` (`src/editor/commands.ts`, accepte un nombre > 0), via une fonction pure `speedOf(value, paces)` dans `src/model/`.
- Curseur, dans l'inspecteur seulement (course, et segment quand « Allure de la course » n'est pas choisie ; ce choix reste explicite) :
  - curseur continu en km/h, valeur affichée en m/s et en km/h (D-117) ; champ en km/h gardé pour une valeur exacte (1 à 45 km/h) ;
  - repères Marche, Trot, Sprint aux allures des réglages, aimantation au glisser à ±0,5 km/h d'un repère ; relâché sur un repère : allure nommée gardée (elle suit les réglages) ; ailleurs : vitesse saisie en m/s ; au clavier, pas de 0,1 km/h, et une valeur égale à un repère donne l'allure nommée ;
  - zones orange et rouge en aplats sous la piste (éléments séparés, aucun dégradé) ; bornes de 1 km/h au seuil rouge + 5 km/h (30 km/h par défaut) ; valeurs HYPOTHÈSE dans `defaults.ts` ;
  - une étape d'annulation par geste (validation au relâchement ; une commande sans effet rend la même combinaison, `docs/PIEGES.md` « Application »).
- Logique du curseur pure dans `src/ui/speedSlider.ts` (position, aimantation, valeur au relâchement), composant `src/ui/common/SpeedSlider.tsx` qui l'affiche.
- Raccourcis 1, 2, 3, 0 inchangés (6.2, D-114, D-120) ; menu du clic droit : 3bis-2, rien ici.

## E. Réglages v4 (D-134)

- `reglages.json` v4 : `motion` (accélération a0, freinage, latérale, `topSpeed` ; aucun réglage pour Q14), `accelAlert` et `decelAlert` (orange, rouge, m/s²) ; `speedAlert` inchangé. Défauts : a0 5,2, freinage 4, latérale 4 m/s², pointe 6,67 m/s ; seuils 6 et 8, 5 et 7 m/s² (D-135). Migration v3 vers v4 ; v1 et v2 migrés jusqu'à v4 avec les nouveaux défauts (sans message autre que celui du sprint) ; nouvelle fixture figée `reglages-v3.json`.
- Une valeur égale à l'ancien défaut (accélération 3, freinage 4, latérale 4, `LEGACY_MOTION` dans `defaults.ts`) prend le nouveau défaut calibré, avec un message unique par poste (mémorisé dans le navigateur, comme le sprint, D-121) qui liste les valeurs changées ; toute autre valeur est gardée.
- Inspecteur, section Réglages : pointe de la joueuse (m/s et km/h), seuils d'accélération et de freinage (m/s², orange <= rouge, comme les seuils de vitesse).

## F. Ce qui change pour une combinaison existante

Chiffres du bloc 1 (script, B.1) reportés ici ; confirmés ou corrigés à l'étape 7.
- **Durées** : courses au sprint plus courtes, de 1 % (30 m : 6,98 s au lieu de 7,06) à 9 % (3 m : 1,71 s au lieu de 1,87) ; trot un peu plus long (20 m : 6,21 s au lieu de 6,17), marche aussi (20 m : 10,87 s au lieu de 10,59), départ plus doux (Q14) ; lecture à peine plus courte.
- **Positions intermédiaires** : à un même instant, une joueuse qui sprinte est plus loin au début d'une course (1,94 m au lieu de 1,50 au bout de 1 s), mais atteint l'allure du sprint plus tard (2,24 s et 7,9 m au lieu de 1,83 s et 5,0 m). Positions finales et points de passage inchangés, sauf course arrêtée par un regroupement (point d'arrêt et départs des temps suivants).
- **Passes à instant fixe** : délais inchangés ; arrivées des receveuses décalées ; la tolérance de 0,5 s garde la plupart des enchaînements ; au-delà, « passeuse sans ballon », à recaler ou passer en « à la réception ».
- **En-avant** : vitesse de la passeuse au lâcher changée ; des passes peuvent gagner ou perdre l'alerte.
- **Regroupements et relayeur** : formation inchangée ; relayeur plus rapide à rejoindre ; `relayerLate` peut disparaître.
- **Ramassage** du ballon au sol : instants décalés, même règle.
- **Durées imposées et liens auparavant plafonnés** : désormais tenus exactement (durée, rendez-vous), signalés par les seuils ; positions et instants des actions qui en dépendent changent.
- **Pastilles** : nouvelles pastilles d'accélération ou de freinage là où une intention force le mouvement, ou au départ d'une course lancée qui freine fort.
- **Rendu des segments rapides** (D-115) : inchangé (vitesse cible >= sprint) ; un segment accéléré par un levier peut s'épaissir, comme aujourd'hui avec le facteur.
- **GIF** : à peine plus courts.
- **Fichiers** : réécrits en v4 au premier enregistrement ; `reglages.json` en v4 au premier enregistrement des réglages.

## G. Ce que 3bis-1 change pour le lot 4

`.claude/skills/nouveau-lot/lot-4.md` n'est pas modifié. La décision de principe (D-129) vise les courses dessinées et les intentions du coach ; la défense simulée (« vitesse et accélération jamais dépassées ») sera tranchée au lancement du lot 4.
- `DefenseSettings.maxAccel` (4 m/s², SPEC 14) face au profil calibré (a0 du bloc 1) : à aligner ou à justifier.
- `lineSpeed` 6 m/s (21,6 km/h) face aux seuils de vitesse : au-delà de l'orange.
- Alertes d'accélération et trajectoires simulées : à dire si elles s'appliquent (au lot 3bis-1 : courses dessinées seulement).
- Profil en a(v) : la poursuite lit `motionVelocity`, inchangé dans sa forme.
- Cache par (combinaison, branche, réglages) : réglages v4 plus riches, même principe.

## H. Documentation

- SPEC 1.8 à `/fin-lot` : 4.1, 4.4, 4.5, 5.3, 5.8, 5.9, 6.5, 6.7, 7, 10.3 (et 13.3 si les pastilles y figurent) ; index. D-129 et suivantes portent « non intégrée (x.y) » dans l'index jusque-là.
- Décisions dans `docs/decisions/lot-3bis.md`, section « Lot 3bis-1 » : D-129 principe ; D-130 solveur à deux leviers et bascule ; D-131 départ différé en retard et cible avant le départ ; D-132 alertes d'accélération et de freinage ; D-133 allure saisie, combinaison v4 et curseur ; D-134 réglages v4 ; au bloc 1 : D-135 modèle et calibration (Q10 à Q14). Statuts changés dans l'index : D-105, D-107, D-108 (remplacées en partie), D-079, D-111, D-112, D-114, D-117 (précisées) ; au bloc 1 : D-105 et D-118 (remplacées en partie), D-132 (précisée).
- `/fin-lot` :
  - intègre D-119 ; le point de D-120 sur les raccourcis 1, 2, 3 et 0 lus sur la touche physique (6.2) ; D-121 sauf « Changer la cible » et « Délai calculé par le lien » ; D-129 et suivantes ;
  - laisse de côté le reste de D-120 et ces deux points de D-121, marqués « reportée à 3bis-2 » dans l'index dès l'étape 0 : la ligne ajoutée à l'étape 2 de `.claude/skills/fin-lot/SKILL.md` dit qu'une mention « reportée à <lot> » reste telle quelle jusqu'à ce lot ; 3bis-2 les remplace ;
  - `README.md`, « Travailler avec Claude Code » : une ligne « les skills ne sont pas proposés dans le menu / de l'extension VS Code : les taper en entier » ;
  - `docs/ARCHITECTURE.md` (Modèle et fichiers, Moteur et rendu, Interface), `docs/RECETTE.md` (section « Lot 3bis-1 »), ETAT, PR.

## Fichiers créés ou modifiés

- Moteur : `src/engine/profile.ts` (a(v), bornes par intervalle, solveur à deux leviers, pics d'accélération), `timeline.ts` (`runMotion`, `resolveLink`, `relayMotion`, niveaux d'accélération), `evaluate.ts` et `sceneState.ts` (pastilles d'accélération), `actionReport.ts`.
- Modèle : `src/model/types.ts`, `schema.ts` (v4), `schemaV3.ts` (nouveau, figé), `migrations.ts`, `settings.ts` (v4), `issues.ts`, une fonction `speedOf` ; `src/editor/commands.ts`.
- Valeurs : `src/config/defaults.ts` (`MOTION_DEFAULTS` calibrés avec SOURCE ou HYPOTHÈSE, `LEGACY_MOTION`, `ACCEL_ALERT_DEFAULTS`, `DECEL_ALERT_DEFAULTS`, `SPEED_FACTOR_SEARCH.maxTimeScale`, `ACCEL_BADGE_CLEARANCE`, bornes et aimantation du curseur).
- Rendu : `src/render/render.ts`, `renderSchematic.ts` (pastille en losange) ; `layers.ts` inchangé (clé `speedAlert`).
- Interface : `src/ui/inspector/RunInspector.tsx`, `Inspector.tsx` (réglages), `src/ui/common/SpeedSlider.tsx` et `src/ui/speedSlider.ts` (nouveaux), `src/ui/strings.ts`, `describe.ts`, `format.ts` (m/s²), `src/ui/player/TransportBar.tsx` (infobulle du calque) ; message de migration : `src/state/session.ts`, `prefs.ts`, `src/io/LibraryStore.ts` (comme `sprintReset`).
- Fixtures : `src/test/fixtures/play-v4-lot3bis1.json`, `reglages-v3.json` (nouvelles, figées).
- Étape 0 : `docs/plans/lot-3bis-1.md`, `docs/decisions/lot-3bis.md` et index, ETAT, `.claude/skills/fin-lot/SKILL.md` (une ligne), chemins des plans archivés ; `git mv` de `docs/plans/lot-3bis.md` et `docs/plans/docs-outils.md` vers `docs/archive/plans/`.

## Dépendances

Aucune.

## Détail par étape

- **Étape 1, calibration** (sections B, C) : section B. Sortie : tableau rempli, comparaison chiffrée des deux modèles, proposition, questions Q10 à Q14 ; puis décision et plan mis à jour.
- **Étape 2, modèle et réglages** (sections C, E et le tableau de B) : `buildProfile` en a(v) (ou trapèze recalibré) et `ProfileInput.boundScale` ; défauts calibrés dans `defaults.ts` ; `reglages.json` v4 (`topSpeed`, `accelAlert`, `decelAlert`), migration v3 vers v4 et message par poste, fixture `reglages-v3.json`, `engineSettingsOf`. Tests : profil calibré, forme, inverse et continuité, migrations des réglages. Tests existants qui dépendent des durées du trapèze à 3 m/s² mis à jour ; images de référence régénérées si le profil les change (raison dans le commit).
- **Étape 3, intentions tenues** (sections A.1, A.2) : solveur à deux leviers dans `profile.ts` ; `runMotion`, `resolveLink` (départ différé en retard, cible avant le départ), `relayMotion` ; `durationCapped` et `syncSpeedCapped` retirés (`issues.ts`, `strings.ts`), `syncLate` reformulé, `syncTargetBeforeStart` ; `RunMotion.accelFactor` ; tests modifiés (`evaluate`, `sync`, `breakdown`, `runs`, `actionReport`).
- **Étape 4, alertes d'accélération et de freinage** (section A.3) : niveaux par segment dans `timeline.ts`, codes et messages, pastilles en losange dans `evaluate.ts`, `sceneState.ts` et le rendu (placement de A.3), `actionReport.ts` ; absence dans les exports.
- **Étape 5, combinaison v4** (section D) : partie modèle : `pace: Pace | number`, `schemaV3.ts`, migration, fixture `play-v4-lot3bis1.json`, `speedOf`, commandes et consommateurs.
- **Étape 6, interface** (sections D, E, A.3) : curseur (course, segment), section Réglages de l'inspecteur, liste des actions (pastilles d'accélération, facteurs), infobulle du calque, message de migration des réglages ; tests de bout en bout.
- **Étape 7, combinaisons existantes** (section F) : fixtures v3 et combinaisons d'exemple recompilées ; section F confirmée ou corrigée ; durée et poids des GIF mesurés.

## Tests

Développement d'abord, pas de tests cosmétiques. Pendant une étape : `test:short`, `test:e2e:short` ciblés ; suite complète en fin d'étape (`/fin-etape`).
- **Profil calibré** (`profile.test.ts`) : temps de passage depuis l'arrêt avec les réglages par défaut, contre le modèle exact, cible à 0,95 fois la pointe (la plus haute qui ne relève pas l'asymptote, Q13 ; atteinte à 17,5 m) : 2,62, 4,24 et 8,98 s à 10, 20 et 50 m (a0 5,2, pointe 24 km/h) ; 10 et 20 m en un segment, 50 m en deux segments de 25 m, tolérance 0,05 s (D-135) ; les profils mesurés finissent lancés (`endsAtSpeed: true` dans `buildProfile`), pour qu'aucun freinage ne précède la mesure ; forme : accélération décroissante avec la vitesse, nulle au-delà de la pointe ; a0 selon la cible (Q14) ; cible au-delà de 0,95 fois la pointe atteinte (Q13) ; départ lancé.
- **Nouveau modèle** : inverse exacte (`timeAtDistance(distanceAt(t)) = t`, `distanceAt(timeAtDistance(s)) = s` à 1e-9) ; continuité de position et de vitesse aux échantillons et au rendez-vous ; lecture continue et saut à `t` identiques (`evaluate`) ; déterminisme (deux compilations égales).
- **Intentions tenues au-delà des bornes, sans plafond** : durée imposée très courte (durée exacte, alertes de seuil attendues, plus de `durationCapped`) ; vitesse ajustée au-delà des bornes (instant du rendez-vous exact, vitesse continue au rendez-vous, segments suivants inchangés) ; départ différé au délai négatif (départ à 0, rendez-vous à l'heure, `syncLate`) ; seuils d'alerte modifiés sans effet sur le mouvement ; cible avant le départ (repli, `syncTargetBeforeStart`) ; relayeur trop loin (arrivée exacte, `relayerLate`) ; durée imposée sur une course lancée (vitesse de départ continue).
- **Alertes d'accélération et de freinage** : seuils orange et rouge, gravité, course arrêtée par un regroupement jugée sur sa partie courue ; placement des pastilles hors des extrémités du segment, segment court ; absence dans les GIF et les PDF (`src/export/speeds.test.ts` étendu) ; pastilles dans l'éditeur et selon le calque (`src/render/speeds.test.ts` étendu).
- **Curseur** (`speedSlider.test.ts`) : aimantation près d'un repère, allure nommée gardée au relâchement sur un repère, vitesse saisie ailleurs, valeur au clavier égale à un repère ; bout en bout (`e2e/run-speeds.chromium.spec.ts` étendu) : glisser, relâcher, fichier enregistré.
- **Migrations** : combinaison v3 vers v4 (`play-v3-lot3bis.json`, contenu identique) ; fixture v4 valide ; v4 refusé par une version 3 (`futureVersion`) ; réglages v3 vers v4 (anciens défauts remplacés avec message, autres valeurs gardées), v1 et v2 vers v4.
- **Modifiés** : tests qui attendent `durationCapped`, `syncSpeedCapped`, `syncLate` et les durées du trapèze à 3 m/s² ; images de référence régénérées seulement pour un changement voulu, raison dans le commit.

## Vérifications manuelles prévues (au plus 5)

1. Ressenti du mouvement sur des combinaisons réelles, dans le lecteur (Ctrl+F5 d'abord sur les deux PC) : départs, freinages, virages crédibles.
2. Curseur : aimantation et lecture des repères et des zones orange et rouge, à la souris.
3. Pastilles d'accélération et de freinage : distinctes de celles de vitesse, hors du jeton et des poignées, lisibles dans les deux thèmes d'écran.

## Vérification de bout en bout

- `npm run check` vert à chaque étape de code ; `npm run test:e2e:short` aux étapes qui touchent l'interface, l'état, `io` ou les exports ; CI verte sur la PR (`/fin-lot`).
- Combinaison v3 ouverte, modifiée au curseur, enregistrée : fichier en v4, relu par la page ; ancienne page non rechargée : fichier signalé « recharger la page ».

## Questions et réponses

Posées en mode plan, réponses du 25/10 :
- Q1. Départ différé au délai calculé négatif (`syncLate`) : **arriver à l'heure**. Départ à 0, leviers sur les segments avant le rendez-vous ; `syncLate` gardé, reformulé.
- Q2. Bascule entre le levier 1 et le levier 2 : **pointe de la joueuse** ; même règle pour le relayeur. Précisé à la validation : `topSpeed` est un réglage dans les deux modèles ; le seuil rouge ne règle plus jamais le mouvement.
- Q3. `durationCapped` et `syncSpeedCapped` : **seuils seuls**, codes retirés sans remplacement.
- Q4. Repli de la cible avant le départ : **vitesses et délai enregistrés**, arrivée en retard, `syncTargetBeforeStart`.
- Q5. Pastille d'accélération et de freinage : **losange « + » ou « − »** ; placement précisé à la validation (A.3).
- Q6. Calque : **« Vitesses » gardé**, infobulle « Vitesses et accélérations ».
- Q7. Accélération latérale : **pas d'alerte**.
- Q8. Curseur : **1 km/h au seuil rouge + 5 km/h (30 km/h par défaut), aimantation ±0,5 km/h, pas de 0,1 km/h**.
- Q9. Sans objet : le relayeur est réglé avec Q2.

Posées à la fin du bloc 1, réponses du 25/10 (propositions de B.1 retenues, D-135) :
- Q10. Modèle : **exponentiel en a(v)**, représentation à accélération constante gardée.
- Q11. Valeurs : **joueuse amatrice** : pointe 24 km/h, a0 5,2 m/s² ; freinage, latérale, vitesse minimale en virage et allures inchangés ; aucune allure au-delà d'un seuil.
- Q12. Seuils : **accélération 6 et 8 m/s², freinage 5 et 7 m/s²** ; pic d'accélération mesuré par l'accélération instantanée du modèle (A.3).
- Q13. Cible au-delà de la pointe : **asymptote relevée** à cible / 0,95 au-delà de 0,95 fois la pointe, a0 gardé.
- Q14. Accélération au départ : **a0 × min(1, cible / sprint)**, sans nouveau réglage.

Posée à l'étape 3, réponse du 25/10 (D-136) :
- Q15. Départ différé en retard d'une course à durée imposée : **vitesses enregistrées**, comme une vitesse ajustée ; la durée imposée ne s'applique pas.

## Étapes

- **Bloc 0**
  - [x] **Étape 0 : branche, plans archivés, plan, D-129 à D-134, mentions « reportée à 3bis-2 », ligne de `fin-lot`, ETAT.** (commit « Étape 0 : plan du lot 3bis-1, D-129 à D-134 », après `8467815`)
- **Bloc 1**
  - [x] **Étape 1 : calibration et choix du modèle ; arrêt sur Q10 à Q14 ; décision ; plan mis à jour.** (commit « Étape 1 : calibration du mouvement, modèle exponentiel, D-135 », après `5a9044e`)
- **Bloc 2**
  - [x] **Étape 2 : modèle de profil et réglages v4.** (commit « Étape 2 : profil en a(v) et réglages v4 », après `efff65b`)
- **Bloc 3**
  - [x] **Étape 3 : intentions tenues (solveur à deux leviers).** (commit « Étape 3 : intentions tenues, solveur à deux leviers », après `328fe68`)
- **Bloc 4**
  - [ ] **Étape 4 : alertes d'accélération et de freinage.**
- **Bloc 5**
  - [ ] **Étape 5 : combinaison v4 (allure saisie).**
- **Bloc 6**
  - [ ] **Étape 6 : interface (curseur, réglages, liste, calque).**
- **Bloc 7**
  - [ ] **Étape 7 : combinaisons existantes.**

Puis `/fin-lot`, lancé par l'utilisateur.
