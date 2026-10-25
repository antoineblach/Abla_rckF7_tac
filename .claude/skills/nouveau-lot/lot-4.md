# Complément du lot 4 : défense simulée

Texte du prompt du lot 4, repris de l'ancien fichier des prompts, chemins mis à jour (D-123). Les règles de lecture et de plan du skill priment : index de la SPEC puis les fichiers cités, ARCHITECTURE par sections.
Lis CLAUDE.md, docs/spec/ (en particulier les sections 3.3, 5, 10.3 et 11, et la section 14) et docs/ARCHITECTURE.md. Réalise le lot 4 : défense simulée (section 11).

Commence en mode plan et attends ma validation. Le plan doit contenir en plus :
- l'algorithme détaillé, étape par étape, pour chaque type de lancement (ruck, maul, mêlée, touche, jeu courant), avec les rôles, le déclenchement et le mouvement ;
- la structure du cache des trajectoires précalculées et son invalidation ;
- la liste des valeurs de la section 14 que tu utilises, avec leur emplacement dans src/config/defaults.ts ;
- les cas limites que tu identifies (effectifs inégaux, défenseures manuelles au milieu de l'appariement, regroupement près d'une ligne de but, ballon perdu au pied, etc.) et le comportement proposé pour chacun.

Tests obligatoires :
- 6+1 et 7 en ligne : effectifs en ligne attendus après un ruck (4 + balayeur, ou 5) ;
- garde : prend le relayeur qui attaque au ras ; gratteur : personne au ras ;
- appariement de l'intérieur vers l'extérieur, de chaque côté, figé jusqu'au regroupement suivant ; surnombre détecté ;
- lignes de hors-jeu : ruck, maul, mêlée (5 m, levée à la sortie de balle), touche (10 m, montée au lancer), jeu courant (aucune) ;
- vitesse et accélération jamais dépassées ; tolérance de ligne respectée ;
- contact probable et franchissement détectés sur des scénarios construits ;
- déterminisme : deux simulations identiques au bit près ; tronc commun identique dans toutes les options ;
- « Figer » : la trajectoire figée et la trajectoire simulée diffèrent de moins de 0,3 m ;
- performance : simulation d'une ligne de 20 s en moins de 50 ms sur le poste de CI (à signaler si irréaliste) ;
- effectif 4 contre 3.

Hors périmètre : ateliers (lot 5) ; réaction au jeu au pied ; coups d'envoi.

Livrables : code et tests (tout ce qui est automatisable est testé), mise à jour de docs/ARCHITECTURE.md et docs/decisions/, au plus 5 vérifications manuelles indispensables et impossibles à automatiser (D-054).
