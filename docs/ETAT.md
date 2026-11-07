# État du projet

- Mise à jour : 2026-11-07
- Branche : `lot-frise-1` (depuis `main` à `00bd163`), poussée, PR vers `main` ouverte par `/fin-lot`, non fusionnée
- `main` : lots 1 à 3bis-1, chantiers `docs-outils` et `frise-spec` (PR #1 à #10, `00bd163`), CI verte, déployés sur Pages
- Dépôt public ; Pages en mode « GitHub Actions » ; protection de `main` selon D-055 (D-102)

## En cours

- Lot frise-1 (`docs/plans/lot-frise-1.md`, D-140 à D-179) : étapes faites ; `/fin-lot` du 07/11 : SPEC 1.11 (D-168 pour sa partie GIF ; D-178 hors SPEC), fixtures v0 à v3 supprimées (D-179), documents, PR.
- Suite : CI de la PR verte, fusion par l'utilisateur, puis les 3 vérifications manuelles et la séance d'usage libre de `docs/RECETTE.md` (« Lot frise-1 ») ; retour par `/correction-recette`.

## Reste à faire

- Reportés à frise-2 (D-148) : « Caler sur… » de `run-speeds` ; arbre, création d'option et consigne longue de `interface` ; création d'option de `field-stability`.
- Puis frise-2 à frise-4 par `/nouveau-lot` (section 7 de `docs/archive/plans/frise-spec.md`) ; 3bis-2 réduit et 3bis-3 (D-128) ; lot 4 ; lot 5.
- Recettes en attente : 3bis-1, séance d'usage libre ; 3 bis, 3 vérifications manuelles.
- Terrain, non bloquant : conflit Drive réel ; modèle d'un PC appliqué sur l'autre ; GIF sur WhatsApp ; PDF N&B sur la laser ; cahier sur le téléphone.

## Pistes notées pour plus tard (D-118)

- Vitesse initiale à t = 0 ; ballon porté du côté du sens de course (D-041).

## Questions ouvertes

- Embranchement après la dernière action (D-153, D-167) : à reposer au `/nouveau-lot frise-2`.
- D-172 à D-175 : précisions de C3 et C4, à contredire au besoin.
- Ordre des bords (D-162, par `start` enregistré) : un bord peut être résolu avant une course absente (D-177) dont dépend ce qu'il lit ; collage « ok » mais faux. Limite assumée de 5.8 (Résolution). Mesuré en C4c : Q3, départ 15,71 s contre 15,15 ; fixture v5, jeu au pied de B1, 24,86 s contre 24,37 (D-178). À trancher par `/changement-spec`.

## Écarts connus

- Ni option ni séquence créées avant frise-2 (D-142).
- Raccord de Bézier plus serré que la course entière (D-176) : 3,7 contre 4,7 m/s, à reprendre en frise-2 si visible.
- Fixtures figées : `play-v5-frise.json`, `reglages-v1` à `v3`, `preset-v1-touche.json` ; `play-v4-lot3bis1.json` pour les e2e (D-179).
- D-098 : version remise à l'identique depuis l'autre PC défaite tant que la page qui l'a écrite est ouverte.
- Hypothèses 3 et 4 sur Drive : à constater par le journal.
- Contraste fort, « traits >= 3 px » testé sur `render`, pas sur la surcouche.
- Transport défilant à 1280 px, et à 1440 px avec « Vitesses » (D-121) ; titre masqué sous 1500 px.
- GIF portrait d'une combinaison large : vide au-dessus et au-dessous (D-061) ; GIF différent entre Chromium et Firefox.
- Morceau principal de 568 Ko ; lecture de démarrage au-dessus de 8 000 o.
- Losanges placés en mètres (D-137) : contre le jeton sous 11 px/m environ.
- Bench (D-150) : une ligne 12,1 ms, glisser 12,2 ms, cible 16 ms.

## Pièges rencontrés

- `docs/PIEGES.md`, par domaine : lire la section avant d'y toucher.

## Chantiers en parallèle

- Aucun.
