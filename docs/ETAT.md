# État du projet

- Mise à jour : 2026-10-25
- Branche : `docs-outils` (depuis `main` à `ba76d6c`), poussée sur `origin`
- `main` : lots 1, 2, 3 et 3 bis fusionnés (PR #1 à #7 ; PR #7 le 24/10, commit de fusion `ba76d6c`), CI verte, déployés sur Pages
- Dépôt public ; Pages en mode « GitHub Actions » ; protection de `main` identique à D-055, vérifiée par `gh api` le 23/10 (D-102)

## En cours

- Chantier `docs-outils` : réorganisation de la documentation et des outils de travail, sans changement de l'application (`docs/plans/docs-outils.md` ; D-122 à D-128).
- Blocs 0 à 3 faits (étapes 0 à 5).
- Suite : bloc 4 (étape 6 : contrôles, mesures, PR vers `main` sans fusion), par « /clear puis /reprise ».

## Fait (chantier `docs-outils`, détail dans le plan et les commits)

- Étapes 0 à 3 : plan, D-122 à D-128 ; journal découpé par lot (`docs/decisions/`) et SPEC par section (`docs/spec/`, version 1.7), avec leurs index ; ETAT réécrit, `docs/PIEGES.md`, `docs/archive/`.
- Étape 4 : `npm run check` (`scripts/check.js`), `test:short`, `test:e2e:short`, essayés sous PowerShell, Git Bash et cmd ; `.claude` exclu de Prettier, `.claude/settings.local.json` de git.
- Étape 5 : six skills dans `.claude/skills/` (compléments des lots 4 et 5 dans `nouveau-lot/`) ; CLAUDE.md réécrit ; README, section « Travailler avec Claude Code » ; RECETTE renvoie à `/correction-recette` ; ancien fichier des prompts retiré.

## Reste à faire

- Lot 3 bis : les 3 vérifications manuelles de `docs/RECETTE.md`, section « Lot 3 bis » (recharger d'abord la page sur les deux PC avec Ctrl+F5). La séance d'usage libre a eu lieu le 24/10 : son retour a donné 3bis-1 à 3bis-3.
- D-119 à D-121, prises seul pendant le lot 3 bis : à relire (non intégrées à la SPEC).
- Vérifications de terrain, non bloquantes, pas encore faites :
  - conflit Drive réel, avec la vraie modification sur l'autre PC de la correction du lot 3 ;
  - modèle enregistré sur un PC, visible et appliqué sur l'autre ;
  - GIF sur WhatsApp, avec et sans allègement ; PDF N&B sur la laser ; cahier de jeu sur le téléphone.
- Après `docs-outils` : suite du lot 3 bis en trois PR, 3bis-1 (mouvement), 3bis-2 (interactions), 3bis-3 (positions préréglées) (D-128).
- Puis lot 4 (défense simulée ; le plan du lot 3 bis, section 11, liste ce qui le touche) et lot 5 (ateliers).

## Pistes notées pour plus tard (D-118)

- Accélération exponentielle (forte au départ, plus douce près de la vitesse de pointe).
- Vitesse initiale au temps 1 : une joueuse déjà lancée au départ de la combinaison.
- Ballon porté du côté du sens de course plutôt que toujours vers l'attaque (D-041).

## Questions ouvertes

- Aucune.

## Écarts connus

- Aucun test désactivé.
- CLAUDE.md fait 5 715 o (6 382 o avant) pour une cible d'environ 4,5 Ko : glossaire, conventions et tableau npm en prennent 2,2 Ko ; à reporter dans les mesures de l'étape 6.
- Étape 6 de `docs-outils` : le `git grep` des anciens chemins trouvera aussi D-125 (`docs/decisions/exploitation.md`, mention de l'ancien fichier des prompts), entrée qui ne se modifie pas : exception à ajouter à celles du plan.
- Fixtures figées : `play-v1-7v7-options.json`, `play-v2-lot3.json` et `play-v3-lot3bis.json` ; ne plus les modifier.
- Limite de D-098 : une ancienne version remise à l'identique depuis l'autre PC (historique de Drive, import) est défaite tant que la page qui l'avait écrite est ouverte (README : recharger avant de restaurer).
- Les hypothèses 3 et 4 sur Drive (date changée après l'envoi, version antérieure rendue) restent à constater : le journal de synchronisation le dira.
- Le seuil « traits >= 3 px » du thème Contraste fort est testé sur `render`, pas sur la surcouche d'édition (jamais exportée).
- À 1280 px de large, et à 1440 px depuis la case « Vitesses » (D-121), la seconde rangée du transport défile horizontalement ; sous 1500 px, le titre de l'application est masqué (D-077).
- En portrait, une combinaison large laisse du terrain vide au-dessus et au-dessous dans les GIF (D-061).
- Le même GIF diffère entre Chromium et Firefox (rendu du texte) : le déterminisme vaut pour un même navigateur.
- Vite signale un morceau principal de plus de 500 Ko : déjà le cas sur `main` (508 Ko), 557 Ko après le lot 3 bis.

## Pièges rencontrés

- Dans `docs/PIEGES.md`, rangés par domaine : lire la section d'un domaine avant d'y toucher.

## Chantiers en parallèle

- Aucun.
