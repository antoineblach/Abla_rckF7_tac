## 10. Mise en place (lot 3)

### 10.1 Modèles de placement

- **Enregistrer** : depuis le placement de départ d'une combinaison, ou d'une sélection (par exemple la défense seule). L'utilisateur saisit un nom, un type, et clique le point d'ancrage.
- **Types et ancrage** :

| Type | Ancre | Aimantation |
|---|---|---|
| Mêlée | Marque de la mêlée | Grille de 1 m |
| Touche | Marque de touche, sur la ligne de touche | Ligne de touche, pas à moins de 5 m d'une ligne de but (établi) |
| Coup d'envoi/renvoi | Point du coup de pied | Centre de la médiane, ligne des 22 m |
| Ruck | Point du regroupement | Grille de 1 m |
| Libre | Point cliqué | Grille de 1 m |

- **Repère local** : axe « vers l'avant » = sens d'attaque de l'équipe qui attaque ; axe « vers le côté ouvert » = vers le côté le plus large du terrain par défaut, inversable ; pour la touche, « vers l'intérieur du terrain ».
- **Rôles** : les positions sont rangées par rôle (attaque, défense) et numéro, pas par équipe A ou B. Un même modèle sert quelle que soit l'équipe qui attaque, des deux côtés et partout sur le terrain.
- **Appliquer** : choisir le modèle, cliquer le point d'ancrage, choisir le côté ouvert (symétrie). Les joueuses sont associées par rôle et numéro : existantes déplacées, manquantes créées, autres inchangées.
- **Combinables** : un modèle d'attaque plus un modèle de défense.
- **Gestion** : liste avec vignette ; renommer, dupliquer, mettre à jour depuis le placement courant, supprimer (corbeille).
- **Lien avec le lot 4** : le type du modèle fixe le type de lancement de la combinaison (lignes de hors-jeu). Les défenseures en mode auto ignorent les positions du modèle.

Précisions (lot 3) :
- **Aimantation de l'ancre** : toujours active, indépendamment du bouton « Grille 1 m » ; renvoi : centre de la médiane ou ligne des 22 m captés à moins de 3 m (HYPOTHÈSE), sinon grille ; touche : ligne de touche la plus proche, x sur la grille, refus à moins de 5 m d'une ligne de but (D-088).
- **Côté ouvert** : « Auto » (le côté le plus large depuis l'ancre ; au centre exact, à droite de l'équipe qui attaque), « Gauche » ou « Droite », vus par l'équipe qui attaque face à la ligne de but adverse ; touche : toujours vers l'intérieur, sans choix (D-088).
- **Enregistrer** : dialogue (nom, type, « Placement de départ entier » ou « Sélection », « Inclure le ballon » cochée pour le placement entier ou quand la porteuse est sélectionnée, côté ouvert), puis clic de l'ancre ; rôle selon l'équipe (l'équipe qui attaque = attaque) ; « Mettre à jour » garde l'identifiant, le nom et le type (D-089, D-096).
- **Appliquer** : bandeau en surimpression, jetons fantômes au pointeur, une seule étape d'annulation, temps 1 sélectionné ; numéros en double : la k-ième position d'un numéro va à la k-ième joueuse de ce numéro ; joueuses créées en couleur d'équipe et défense manuelle ; un modèle sans ballon laisse le ballon de la combinaison (D-089, D-096).
- **Catégorie** : appliquer un modèle met la catégorie à mêlée, touche, coup d'envoi/renvoi ou ruck/jeu courant selon son type ; un modèle libre la laisse inchangée (D-087).
- **Synchronisation** : comme les combinaisons (8.3 à 8.5) ; une action sur un modèle changé sur l'autre PC depuis sa lecture est refusée avec un message, et la liste est relue ; une version écrite par la page n'est jamais un modèle changé ailleurs : l'action continue avec la version enregistrée (D-098) ; pas d'import ni d'export de modèles (D-092).
- **Nouvelle combinaison depuis un modèle** : enregistrée seulement à la validation de l'ancre (6.6, D-101).

```ts
interface PlacementPreset {
  schemaVersion: 1
  id: Id
  name: string
  type: 'scrum' | 'lineout' | 'restart' | 'ruck' | 'free'
  positions: { role: 'attack' | 'defense'; number: number; forward: number; openSide: number }[]
  ball: { forward: number; openSide: number; carrierRole?: 'attack' | 'defense'; carrierNumber?: number } | null
  createdAt: string
  updatedAt: string
}
```

### 10.2 Déplacer ou retourner une combinaison

- La même transformation (ancrage et symétrie) s'applique à une combinaison entière : positions de départ, points de passage, cibles de jeu au pied.
- « Déplacer la combinaison » : translation par deux clics (départ, arrivée, grille si active). « Retourner » : symétrie gauche-droite par rapport à l'axe du terrain (y devient largeur − y), sens d'attaque inchangé. Les deux s'appliquent aussi au ballon au sol et au cadre libre de la vue enregistrée (D-090).

### 10.3 Regroupements (ruck et maul)

Composition fournie par l'utilisateur (établi) :
- **Attaque** : la plaquée (porteuse au moment du plaquage) et le soutien sont engagés dans le regroupement ; le relayeur se place au ballon et le sort.
- **Défense** : le plaqueur est engagé ; une seule joueuse fait gratteur ou garde, au choix par regroupement. En gratteur, elle est engagée ; en garde, elle se place au ras du dernier pied, côté ouvert.
- **Maul** : même composition que le ruck.

```ts
interface BreakdownAction {
  id: Id
  type: 'breakdown'
  kind: 'ruck' | 'maul'
  tackledId: Id          // la porteuse plaquée
  supportId: Id
  relayerId: Id          // le relayeur
  delay: number          // instant de formation dans la phase
  duration: number       // défaut 3 s (établi, valeur fournie par l'utilisateur)
  contest?: 'guard' | 'jackal'   // surcharge du réglage de défense
}
```

Comportement :
- À la formation, le ballon passe à l'état `inBreakdown` au point de la plaquée ; la plaquée et le soutien s'immobilisent au regroupement ; le relayeur rejoint la position de relais (1 m derrière le ballon côté attaque, HYPOTHÈSE).
- À la fin de `duration`, le relayeur devient porteuse. La phase se termine au plus tôt à cet instant (sa durée inclut le regroupement).
- La ligne d'avantage est recalée au point du regroupement.
- Pose dans l'éditeur : le marqueur se pose sur la porteuse ; l'éditeur propose les deux coéquipières les plus proches comme soutien et relayeur, modifiables.

Précisions (lot 3, D-078 à D-081) :
- Seule la défense au regroupement (`contest`) est enregistrée ; le plaqueur et la joueuse au ras sont désignés par la simulation du lot 4.
- La plaquée et le soutien s'immobilisent là où leurs courses les ont amenées ; le relayeur rejoint en ligne droite, au sprint des réglages, le point situé 1 m derrière le ballon du côté de l'équipe de la plaquée ; trop loin, il arrive exactement à la sortie de balle (vitesse augmentée), avec une alerte. Lot 3 bis : ce déplacement suit le profil de vitesse (départ arrêté), la vitesse augmentée par le facteur de vitesse (5.3).
- Les courses des trois participantes s'arrêtent à la formation : la partie ultérieure est ignorée, dessinée en rouge et signalée ; une passe ou un jeu au pied du relayeur après la sortie reste possible dans le même temps.
- Plaquée sans ballon à la formation : regroupement entièrement ignoré et signalé, sans recalage de la ligne d'avantage.
- Maul : identique au ruck et immobile au lot 3 ; seul `kind` change.
- Proposition à la pose : instant de formation à la fin de la course de la porteuse dans le temps, ou à la réception si elle est plus tardive ; soutien = la coéquipière la plus proche à cet instant, relayeur = la deuxième ; ruck par défaut. Repère : contour circulaire et libellé « Ruck » ou « Maul » (D-084).

### 10.4 Jeu au pied

Deux types seulement (choix utilisateur) : coup d'envoi/renvoi, et jeu au pied long/recentrage.

```ts
interface KickAction {
  id: Id
  type: 'kick'
  kickerId: Id
  kind: 'restart' | 'long'
  target: { receiverId: Id } | { point: Vec2 }
  delay: number
  flightTime?: number    // défaut : restart 3,0 s ; long 3,5 s (HYPOTHÈSES)
  release?: 'onReceipt'  // lot 3 bis : lâcher à la réception + délai, comme une passe (5.4, D-110)
}
```

- Trajectoire vue de dessus en tirets longs ; hauteur figurée par l'ombre au sol et un ballon qui grossit jusqu'au sommet (facteur 1,8 au sommet, HYPOTHÈSE). Le ballon reste sur la trajectoire ; l'ombre, ellipse grise pleine, est décalée vers le bas à droite de l'image proportionnellement à la hauteur ; un petit cercle marque un point visé (D-084).
- Avec receveuse : arrivée à sa position à `release + flightTime`. Sur un point : ballon `loose` au point d'impact ; il devient porté par la première joueuse qui passe à moins de 1 m après l'impact (HYPOTHÈSE de distance), de l'une ou l'autre équipe, la recherche continuant dans les temps suivants (D-083). La frappeuse doit porter le ballon, sinon le jeu au pied est ignoré et signalé.
- La poursuite reste dessinée à la main ; la défense simulée ne s'applique pas aux coups d'envoi.

### 10.5 Contrôle d'en-avant

- Voir 5.7. Pastille ronde au milieu de la passe concernée (jaune à « ! » noir ; noire à « ! » blanc en N&B) et alerte « En-avant probable » dans l'inspecteur ; toujours affichée dans l'éditeur, selon le calque « En-avant » dans le lecteur (D-084, D-085).
- Jamais dans les exports, ni GIF ni PDF, quel que soit le calque, ni dans les vignettes de la bibliothèque : c'est une aide pour le coach, pas une information pour les joueuses (D-086). Même règle pour les pastilles de vitesse (5.9, D-112) et les liens de synchronisation (5.8).

