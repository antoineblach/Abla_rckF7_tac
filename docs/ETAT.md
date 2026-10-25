# État du projet

- Mise à jour : 2026-10-25
- Branche : `lot-3bis-1` (depuis `main` à `8467815`), poussée sur `origin`
- `main` : lots 1, 2, 3 et 3 bis et chantier `docs-outils` fusionnés (PR #1 à #8 ; PR #8 le 25/10, commit de fusion `8467815`), CI verte, déployés sur Pages
- Dépôt public ; Pages en mode « GitHub Actions » ; protection de `main` identique à D-055, vérifiée par `gh api` le 23/10 (D-102)

## En cours

- Lot 3bis-1, le mouvement (`docs/plans/lot-3bis-1.md` ; D-129 à D-134, non intégrées à la SPEC) : bloc 0 fait.
- Bloc suivant : bloc 1, étape 1 (calibration et choix du modèle : recherche web, script jetable non commité, tableau et proposition dans le plan, puis arrêt sur Q10 à Q14 ; rien dans `src/`).

## Fait (lot 3bis-1)

- Étape 0 : branche ; plans `lot-3bis` et `docs-outils` archivés dans `docs/archive/plans/` ; plan validé avec Q1 à Q9 et 6 modifications de l'utilisateur ; D-129 à D-134 et statuts de D-079, D-105, D-107, D-108, D-111, D-112, D-114, D-117 ; parties de D-120 et D-121 « reportée à 3bis-2 » ; ligne de `fin-lot` sur ces mentions.

## Reste à faire

- Lot 3bis-1 : blocs 1 à 7, puis `/fin-lot` (SPEC 1.8, ARCHITECTURE, RECETTE, ligne du README sur les skills dans VS Code, PR).
- Puis 3bis-2 (interactions) et 3bis-3 (positions préréglées), chacune par `/nouveau-lot` (D-128).
- Lot 3 bis : les 3 vérifications manuelles de `docs/RECETTE.md`, section « Lot 3 bis » (Ctrl+F5 d'abord sur les deux PC).
- D-119 à D-121, prises seul pendant le lot 3 bis : à relire ; intégrées au `/fin-lot` de 3bis-1, sauf les parties reportées à 3bis-2.
- Vérifications de terrain, non bloquantes : conflit Drive réel (correction du lot 3) ; modèle enregistré sur un PC, appliqué sur l'autre ; GIF sur WhatsApp avec et sans allègement ; PDF N&B sur la laser ; cahier de jeu sur le téléphone.
- Puis lot 4 (défense simulée ; le plan de 3bis-1, section G, liste ce qui le touche) et lot 5 (ateliers).

## Pistes notées pour plus tard (D-118)

- Accélération exponentielle : traitée au bloc 1 de 3bis-1. Vitesse initiale au temps 1 ; ballon porté du côté du sens de course (D-041).

## Questions ouvertes

- Q10 à Q14 du plan de 3bis-1 (modèle, valeurs calibrées, seuils d'accélération et de freinage, cible au-delà de la pointe, accélération selon l'allure) : posées à la fin du bloc 1.

## Écarts connus

- Aucun test désactivé.
- Lecture de démarrage au-dessus de la cible de 8 000 o (CLAUDE.md et ETAT).
- Fixtures figées : `play-v1-7v7-options.json`, `play-v2-lot3.json`, `play-v3-lot3bis.json`.
- Limite de D-098 : une ancienne version remise à l'identique depuis l'autre PC est défaite tant que la page qui l'avait écrite est ouverte (README : recharger avant de restaurer).
- Hypothèses 3 et 4 sur Drive (date changée après l'envoi, version antérieure rendue) : à constater par le journal de synchronisation.
- Seuil « traits >= 3 px » du thème Contraste fort testé sur `render`, pas sur la surcouche d'édition.
- Seconde rangée du transport défilante à 1280 px, et à 1440 px avec la case « Vitesses » (D-121) ; titre masqué sous 1500 px (D-077).
- GIF en portrait d'une combinaison large : terrain vide au-dessus et au-dessous (D-061). Même GIF différent entre Chromium et Firefox (texte).
- Morceau principal de 557 Ko signalé par Vite.

## Pièges rencontrés

- Dans `docs/PIEGES.md`, rangés par domaine : lire la section d'un domaine avant d'y toucher.

## Chantiers en parallèle

- Aucun.
