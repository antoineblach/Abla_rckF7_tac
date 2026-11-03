# État du projet

- Mise à jour : 2026-11-03
- Branche : `frise-spec` (depuis `main` à `d33313f`), poussée sur `origin` ; PR prévue à l'étape 3, sans fusion
- `main` : lots 1, 2, 3, 3 bis et 3bis-1 et chantier `docs-outils` fusionnés (PR #1 à #9 ; PR #9 le 03/11, commit de fusion `d33313f`), CI verte, déployés sur Pages
- Dépôt public ; Pages en mode « GitHub Actions » ; protection de `main` identique à D-055, vérifiée par `gh api` le 23/10 (D-102)

## En cours

- Chantier `frise-spec`, SPEC 1.9 : frise chronologique à la place des temps (`docs/plans/frise-spec.md`, D-139 à écrire), sans code. Plan validé le 03/11 : Q1 à Q13 selon les recommandations, 5 précisions reportées.
- Étape 0 faite. Suite : étape 1 (bloc A : D-139, statuts, SPEC 2 à 5), sur demande de l'utilisateur.
- Lot 3bis-1 : vérifications manuelles faites et validées par l'utilisateur le 03/11.

## Reste à faire

- Après la fusion de `frise-spec` : `/nouveau-lot` pour frise-1, frise-2, frise-3 et frise-4 (plan, section 7), avant 3bis-2, 3bis-3 et le lot 4.
- Puis 3bis-2 réduit (menu du clic droit, même course pour plusieurs joueuses) et 3bis-3 (positions préréglées), chacune par `/nouveau-lot` (D-128).
- Lot 3bis-1 : séance d'usage libre (`docs/RECETTE.md`), non signalée comme faite ; retour par `/correction-recette`.
- Lot 3 bis : les 3 vérifications manuelles de `docs/RECETTE.md` (Ctrl+F5 d'abord).
- Vérifications de terrain, non bloquantes : conflit Drive réel ; modèle enregistré sur un PC, appliqué sur l'autre ; GIF sur WhatsApp ; PDF N&B sur la laser ; cahier de jeu sur le téléphone.
- Puis lot 4 (défense simulée ; le plan archivé de 3bis-1, section G, liste ce qui le touche) et lot 5 (ateliers).

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
- Morceau principal de 568 Ko signalé par Vite.
- Compilation de la combinaison réaliste : 3 puis 14 ms (leviers, D-130).
- Losanges placés en mètres (D-137) : contre le jeton sous 11 px/m environ, ou sur un segment de moins de 5 m.
- Combinaisons existantes non confrontées au nouveau mouvement (plan, section F, sans objet).

## Pièges rencontrés

- Dans `docs/PIEGES.md`, rangés par domaine : lire la section d'un domaine avant d'y toucher.

## Chantiers en parallèle

- Aucun.
