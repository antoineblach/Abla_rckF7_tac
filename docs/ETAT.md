# État du projet

- Mise à jour : 2026-11-08
- Branche : `lot-ordre-bords` (depuis `main` à `381480a`), PR vers `main` à la fin du lot
- `main` : lots 1 à 3bis-1, frise-1, chantiers `docs-outils` et `frise-spec`, correctif de CI (PR #1 à #12, `381480a`) ; CI verte ; frise-1 déployée et recettée
- Dépôt public ; Pages en mode « GitHub Actions » ; protection de `main` selon D-055 (D-102)

## En cours

- Lot ordre-bords (`docs/plans/lot-ordre-bords.md`, D-180 à D-182) : ordre des bords qui ne lit plus un `start` périmé (5.8). Étapes 0 et 1 faites : règle V retenue (D-182), SPEC 1.12 ; mesures dans la section « Sonde » du plan ; prototype et sonde en `git stash` « sonde ordre-bords », sur ce poste seulement.
- Suite : bloc 2, étape 2 : règle V dans le moteur (`syncGraph.ts`, `glue.ts`), cas 1 à 7, 2v, 6a''', 7e, 7b en tests, test de D-162 sur l'ordre réel, bench, ARCHITECTURE, PIEGES, ETAT ; puis `/fin-lot` par l'utilisateur.

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
- Ordre des bords : tranché par D-182 (SPEC 5.8, 1.12), code au bloc 2 ; d'ici là, le moteur suit encore D-162 (par `start` enregistré).

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
