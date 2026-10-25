# État du projet

- Mise à jour : 2026-10-25
- Branche : `docs-outils` (depuis `main` à `ba76d6c`), poussée sur `origin` ; PR #8 vers `main` ouverte, sans fusion
- `main` : lots 1, 2, 3 et 3 bis fusionnés (PR #1 à #7 ; PR #7 le 24/10, commit de fusion `ba76d6c`), CI verte, déployés sur Pages
- Dépôt public ; Pages en mode « GitHub Actions » ; protection de `main` identique à D-055, vérifiée par `gh api` le 23/10 (D-102)

## En cours

- Chantier `docs-outils` (`docs/plans/docs-outils.md` ; D-122 à D-128) : étapes 0 à 6 faites, PR #8 vers `main` ouverte.
- À faire par l'utilisateur avant la fusion, les 2 vérifications manuelles de la PR : dans une nouvelle conversation, `/` liste les 6 skills et `/reprise` constate l'état ; `npm run check` sous PowerShell sur l'autre PC.

## Fait (chantier `docs-outils`, détail dans le plan et les commits)

- Décisions découpées par lot (`docs/decisions/`), SPEC par section (`docs/spec/`, version 1.7), avec leurs index ; ETAT réécrit, `docs/PIEGES.md`, `docs/archive/`.
- `npm run check`, `test:short`, `test:e2e:short` ; six skills dans `.claude/skills/` ; CLAUDE.md et README réécrits.
- Étape 6 : liens relatifs des `.md` tous valides ; anciens chemins présents seulement dans le plan, D-123 et D-125 ; `src/` identique à `main` ; mesures dans la PR.

## Reste à faire

- Après la fusion : suite du lot 3 bis en trois PR, 3bis-1 (mouvement), 3bis-2 (interactions), 3bis-3 (positions préréglées), chacune par `/nouveau-lot` (D-128).
- Lot 3 bis : les 3 vérifications manuelles de `docs/RECETTE.md`, section « Lot 3 bis » (Ctrl+F5 d'abord sur les deux PC).
- D-119 à D-121, prises seul pendant le lot 3 bis : à relire (non intégrées à la SPEC).
- Vérifications de terrain, non bloquantes : conflit Drive réel (correction du lot 3) ; modèle enregistré sur un PC, appliqué sur l'autre ; GIF sur WhatsApp avec et sans allègement ; PDF N&B sur la laser ; cahier de jeu sur le téléphone.
- Puis lot 4 (défense simulée ; le plan du lot 3 bis, section 11, liste ce qui le touche) et lot 5 (ateliers).

## Pistes notées pour plus tard (D-118)

- Accélération exponentielle ; vitesse initiale au temps 1 ; ballon porté du côté du sens de course (D-041).

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- Lecture de démarrage : 10 319 o pour une cible de 8 000 o (14 222 o avant) ; CLAUDE.md fait 5 715 o pour environ 4,5 Ko visés (glossaire, conventions et tableau npm : 2,2 Ko), ETAT 3,6 Ko.
- Fixtures figées : `play-v1-7v7-options.json`, `play-v2-lot3.json`, `play-v3-lot3bis.json`.
- Limite de D-098 : une ancienne version remise à l'identique depuis l'autre PC est défaite tant que la page qui l'avait écrite est ouverte (README : recharger avant de restaurer).
- Hypothèses 3 et 4 sur Drive (date changée après l'envoi, version antérieure rendue) : à constater par le journal de synchronisation.
- Seuil « traits >= 3 px » du thème Contraste fort testé sur `render`, pas sur la surcouche d'édition.
- Seconde rangée du transport défilante à 1280 px, et à 1440 px avec la case « Vitesses » (D-121) ; titre masqué sous 1500 px (D-077).
- GIF en portrait d'une combinaison large : terrain vide au-dessus et au-dessous (D-061). Même GIF différent entre Chromium et Firefox (texte).
- Morceau principal de 557 Ko signalé par Vite (508 Ko sur `main` avant le lot 3 bis).

## Pièges rencontrés

- Dans `docs/PIEGES.md`, rangés par domaine : lire la section d'un domaine avant d'y toucher.

## Chantiers en parallèle

- Aucun.
