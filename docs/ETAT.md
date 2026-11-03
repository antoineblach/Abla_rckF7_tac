# État du projet

- Mise à jour : 2026-11-03
- Branche : `lot-3bis-1` (depuis `main` à `8467815`), poussée sur `origin`
- `main` : lots 1, 2, 3 et 3 bis et chantier `docs-outils` fusionnés (PR #1 à #8 ; PR #8 le 25/10, commit de fusion `8467815`), CI verte, déployés sur Pages
- Dépôt public ; Pages en mode « GitHub Actions » ; protection de `main` identique à D-055, vérifiée par `gh api` le 23/10 (D-102)

## En cours

- Lot 3bis-1, le mouvement (`docs/plans/lot-3bis-1.md` ; D-129 à D-138, non intégrées à la SPEC) : blocs 0 à 6 faits ; bloc 7 retiré le 03/11 (plan, section F).
- Suite : `/fin-lot`, lancé par l'utilisateur.

## Fait (lot 3bis-1)

- Étapes 0 à 6, chacune avec son commit (cases du plan) : calibration (D-135) ; profil en a(v) et réglages v4 ; solveur à deux leviers (D-136) ; alertes d'accélération et de freinage (D-137) ; combinaison v4 ; interface : curseur, facteurs, accélérations, pointe et seuils, infobulle du calque (D-138).

## Reste à faire

- Lot 3bis-1 : `/fin-lot` (SPEC 1.8, ARCHITECTURE, RECETTE, ligne du README sur les skills dans VS Code, PR).
- Après la fusion de 3bis-1 : /changement-spec frise chronologique (décision de l'utilisateur du 03/11), avant 3bis-2, 3bis-3 et le lot 4.
- Puis 3bis-2 (interactions) et 3bis-3 (positions préréglées), chacune par `/nouveau-lot` (D-128).
- Lot 3 bis : les 3 vérifications manuelles de `docs/RECETTE.md` (Ctrl+F5 d'abord).
- D-119 à D-121 (lot 3 bis), D-137 (étape 4) et D-138 (étape 6), prises seul : à relire ; intégrées au `/fin-lot` de 3bis-1, sauf les parties reportées à 3bis-2.
- Vérifications de terrain, non bloquantes : conflit Drive réel ; modèle enregistré sur un PC, appliqué sur l'autre ; GIF sur WhatsApp ; PDF N&B sur la laser ; cahier de jeu sur le téléphone.
- Puis lot 4 (défense simulée ; le plan de 3bis-1, section G, liste ce qui le touche) et lot 5 (ateliers).

## Pistes notées pour plus tard (D-118)

- Vitesse initiale au temps 1 ; ballon porté du côté du sens de course (D-041).

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- Lecture de démarrage au-dessus de la cible de 8 000 o (CLAUDE.md et ETAT).
- Fixtures figées : `play-v1-7v7-options.json`, `play-v2-lot3.json`, `play-v3-lot3bis.json`, `play-v4-lot3bis1.json`, `reglages-v3.json`.
- Limite de D-098 : une ancienne version remise à l'identique depuis l'autre PC est défaite tant que la page qui l'avait écrite est ouverte (README : recharger avant de restaurer).
- Hypothèses 3 et 4 sur Drive : à constater par le journal de synchronisation.
- Seuil « traits >= 3 px » du thème Contraste fort testé sur `render`, pas sur la surcouche d'édition.
- Seconde rangée du transport défilante à 1280 px, et à 1440 px avec la case « Vitesses » (D-121) ; titre masqué sous 1500 px (D-077).
- GIF en portrait d'une combinaison large : terrain vide au-dessus et au-dessous (D-061). Même GIF différent entre Chromium et Firefox (texte).
- Morceau principal de 557 Ko signalé par Vite.
- Compilation de la combinaison réaliste : 3 puis 14 ms (leviers, D-130).
- Losanges placés en mètres (D-137) : contre le jeton sous 11 px/m environ, ou sur un segment de moins de 5 m.

## Pièges rencontrés

- Dans `docs/PIEGES.md`, rangés par domaine : lire la section d'un domaine avant d'y toucher.

## Chantiers en parallèle

- Aucun.
