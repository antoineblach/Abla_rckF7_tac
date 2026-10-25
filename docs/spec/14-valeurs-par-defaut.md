## 14. Valeurs par défaut et hypothèses

`src/config/defaults.ts` fait foi pour les valeurs par défaut et les hypothèses (D-126). Chaque valeur provisoire y porte un commentaire `HYPOTHÈSE` ou `SOURCE: <url>`. Une valeur fixée par l'utilisateur n'en porte pas : son commentaire donne la justification (choix de l'utilisateur, D-xxx).

Ce tableau ne garde que les valeurs absentes de `defaults.ts`. Les lignes de la défense simulée passeront dans `defaults.ts` au lot 4 et sortiront alors du tableau.

| Paramètre | Valeur | Statut |
|---|---|---|
| Palette des GIF | 255 couleurs, plus un index réservé à la transparence (`GIF_MAX_COLORS`, `src/export/gif/encode.ts`) | Conséquence du format GIF, 256 entrées (D-126) |
| Défense : montée, accélération | 6 m/s, 4 m/s² | Hypothèse |
| Défense : tolérance de ligne | 1,5 m | Hypothèse |
| Défense : profondeur d'alignement | 1 m | Hypothèse |
| Défense : épaule intérieure | 0,5 m | Hypothèse |
| Défense : réintégration | 2 s | Hypothèse |
| Défense : balayeur | 10 m derrière la ligne | Hypothèse |
| Défense : garde | 1 m du bord, prise au ras à moins de 5 m | Hypothèse |
| Défense : contact, franchissement | 1 m, 1,5 m | Hypothèse |
| Défense : anticipation de poursuite | 0,3 s | Hypothèse |
