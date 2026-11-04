## 7. Lecteur (lot 1)

- Intégré à l'éditeur, avec un mode plein écran.
- Commandes : lecture/pause, précédent/suivant (débuts de séquence et embranchements, puis début et fin de la ligne), curseur temporel, vitesse 0,5x / 1x / 2x, boucle, pause automatique à la fin de chaque séquence (D-139).
- Embranchement : bascule « S'arrêter aux options », activée par défaut et indépendante de la pause entre les séquences ; activée, pause à l'embranchement et un bouton par option, libellé par sa condition ; désactivée, l'option par défaut ; un bouton revient à l'embranchement pour lire une autre option (D-011).
- Calques activables séparément : traces (intervalle en cours appuyé, intervalles antérieurs estompés, 5.1) ; consigne de la séquence à `t` en bandeau ; ligne d'avantage en tirets fins ; « En-avant » (icône des passes en avant probables, activé par défaut, D-085) ; « Vitesses » (pastilles des segments au-delà d'un seuil de vitesse, d'accélération ou de freinage, 5.9 ; infobulle « Vitesses et accélérations » sur la case ; activé par défaut ; lot 3 bis, D-112 ; lot 3bis-1, D-132, D-138). Lots suivants : indicateurs de défense, ligne de hors-jeu.
- Lecture et pause : bouton, L, appui bref sur Espace (6.2, D-116).
- Une seule vue (centre et échelle) pour l'édition et la lecture : lancer la lecture, choisir une option ou revenir à l'édition ne la change pas. À l'ouverture d'une combinaison, la vue enregistrée ; puis zoom et déplacement libres, en édition comme en lecture. « Ajuster » (F) recadre sur la vue enregistrée ; « Zone utile » recadre sur la boîte englobante de toutes les positions de la ligne lue, plus 5 m de marge (D-049, remplace la partie cadrage de D-019).
- Aperçu d'orientation : paysage, portrait, carré (prépare les exports du lot 2), disponible aussi en édition (D-019).
- `requestAnimationFrame` uniquement pendant la lecture ; rendu à la demande sinon.

