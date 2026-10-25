## 11. Défense simulée (lot 4)

### 11.1 Principes établis par les sources

- « Chacun le sien » : chaque défenseur prend un joueur (défense individuelle).
- À 7, le dispositif classique aligne six défenseurs et un balayeur ; la tendance actuelle est de mettre les sept en ligne.
- Alignement sur l'épaule intérieure de l'attaquant, défense de l'intérieur vers l'extérieur.
- Variante de glissement : individuel jusqu'à ce que le ballon passe le milieu de l'attaque, puis glissement d'un cran vers l'extérieur ; montée en ligne sans trou.
- Sans ruck ni maul, pas de ligne de hors-jeu en jeu courant à 7 : la défense peut dépasser le niveau du ballon et doit se replacer dès qu'un regroupement se forme.

### 11.2 Lignes de hors-jeu (Règles World Rugby, établi)

| Lancement | Ligne de hors-jeu de la défense |
|---|---|
| Ruck | Parallèle à la ligne de but, par le point le plus en arrière de tout participant ; la ligne de but si ce point est sur ou derrière elle. |
| Maul | Par le dernier pied des participants le plus proche de la ligne de but de l'équipe ; la ligne de but si ce pied est sur ou derrière elle. |
| Mêlée | À 7 : trois joueuses par équipe. Non-participantes à 5 m au moins derrière le dernier pied de leur équipe ; la ligne de but si ce pied est à moins de 5 m d'elle. Ces lignes disparaissent à la fin de la mêlée, qui à 7 se termine quand la demi de mêlée joue le ballon. La demi qui n'a pas le ballon reste près de la mêlée ou recule à 5 m. |
| Touche | Non-participantes à 10 m au moins de la marque de touche, de leur côté (ou derrière la ligne de but si plus proche) ; elles peuvent avancer dès que le ballon est lancé. Au moins deux joueuses par équipe dans l'alignement ; l'équipe qui ne lance pas peut en mettre moins, jamais plus. Alignement entre les lignes des 5 m et des 15 m. L'équipe qui ne lance pas place une joueuse entre la touche et la ligne des 5 m, à 2 m de la marque. |
| Jeu courant | Aucune ligne de hors-jeu pour la défense. |
| Coup d'envoi/renvoi | Simulation désactivée (défense dessinée à la main). |

### 11.3 Réglages

```ts
interface DefenseSettings {
  system: '6+1' | '7'                   // choix par combinaison ; défaut global 6+1
  breakdownContest: 'guard' | 'jackal'  // défaut 'guard'
  guardSide: 'open'                     // côté ouvert
  lineSpeed: number                     // 6 m/s (HYPOTHÈSE)
  maxAccel: number                      // 4 m/s² (HYPOTHÈSE)
  lineTolerance: number                 // 1,5 m (HYPOTHÈSE)
  alignDepth: number                    // 1 m derrière la ligne de hors-jeu (HYPOTHÈSE)
  insideShoulder: number                // 0,5 m (HYPOTHÈSE)
  reintegrationDelay: number            // 2 s (HYPOTHÈSE)
  sweeperDepth: number                  // 10 m derrière la ligne (HYPOTHÈSE)
  drift: boolean                        // glissement, défaut false
}
```

### 11.4 Rôles attribués à chaque lancement ou regroupement

- **Engagées** :
  - mêlée : trois défenseures dans la mêlée ;
  - touche : autant que l'alignement adverse, plus la joueuse face à la lanceuse ;
  - ruck et maul : le plaqueur (la défenseure en contact avec la porteuse à la formation), plus la joueuse qui gratte si `jackal`.
  - Les engagées restent au regroupement jusqu'à la sortie de balle, puis rejoignent la ligne par l'intérieur après `reintegrationDelay`.
- **Garde** (ruck et maul, si `guard`) : la plus proche défenseure non engagée. Avant la sortie : au ras du dernier pied, côté ouvert, à 1 m du bord du regroupement (HYPOTHÈSE). Après : prend le relayeur s'il attaque au ras (à moins de 5 m latéralement du regroupement, HYPOTHÈSE), sinon tient 1 s puis rejoint la ligne.
- **Demi défensive** (mêlée) : la défenseure non engagée la plus proche de la mêlée suit la demi adverse.
- **Balayeur** (système 6+1) : la défenseure restante la plus en retrait.
- **Ligne « chacun le sien »** : les autres. À la sortie de balle, appariement de chaque côté du regroupement, de l'intérieur vers l'extérieur : la i-ème défenseure prend la i-ème attaquante. Sont exclues de l'appariement : la plaquée, le soutien et le relayeur. En jeu courant, l'intérieur est défini par rapport à la porteuse au déclenchement.
- L'appariement est figé jusqu'au regroupement suivant. Attaquantes non appariées : **surnombre**.

### 11.5 Mouvement

- Intégration à pas fixe de 1/50 s sur toute la ligne lue ; vitesse et accélération plafonnées.
- **Avant la sortie de balle** : alignées sur la ligne de hors-jeu du lancement, à `alignDepth` derrière, sur l'épaule intérieure de leur vis-à-vis.
- **Déclenchement** : premier mouvement du ballon hors du point d'ancrage (passe ou course du relayeur ; lancer en touche ; balle jouée par la demi en mêlée). En jeu courant : `t = 0`.
- **Après** : chaque défenseure vise l'épaule intérieure de son attaquante. Aucune ne devance la moyenne de ses deux voisines de plus de `lineTolerance` (montée en ligne).
- **Poursuite** : la défenseure dont l'attaquante porte le ballon vise la position anticipée de la porteuse (position + vitesse x 0,3 s, HYPOTHÈSE).
- **Balayeur** : derrière la ligne à `sweeperDepth`, suit latéralement le ballon avec un retard (filtre de constante 0,5 s, HYPOTHÈSE) ; poursuit la porteuse dès qu'elle franchit la ligne.
- **Glissement** (si `drift`) : décalage d'un cran vers l'extérieur quand le ballon dépasse le milieu de la ligne d'attaque.

### 11.6 Indicateurs

- **Surnombre** : halo sur les attaquantes non appariées.
- **Contact probable** : défenseure à moins de 1 m de la porteuse (HYPOTHÈSE).
- **Franchissement** : la porteuse dépasse la ligne défensive sans défenseure à moins de 1,5 m (HYPOTHÈSE).
- Calques optionnels : traits d'appariement ; ligne de hors-jeu pendant le regroupement.

### 11.7 Intégration

- Mode par défenseure : `manual` ou `auto` ; mélange possible. Les défenseures manuelles ne sont jamais réappariées.
- « Figer » : convertit la trajectoire simulée d'une défenseure en courses éditables (points simplifiés par Ramer-Douglas-Peucker, tolérance 0,3 m, HYPOTHÈSE).
- Résultat mis en cache par (combinaison, branche, réglages) ; recalcul à chaque modification ; objectif inférieur à 50 ms par ligne (HYPOTHÈSE).
- Effectifs quelconques (N contre M), y compris ateliers à effectif réduit.

### 11.8 Limites assumées

- Aucune issue de plaquage : l'attaque reste celle qui est dessinée.
- Pas d'échange de vis-à-vis sur une croisée ; un leurre attire sa défenseure (individuel strict).
- Pas de réaction au jeu au pied ; pas de simulation des coups d'envoi.
- Le système « 7 en ligne » ne modélise pas la bascule de la défense dite « pendule ».

