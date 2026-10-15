# Prompts Claude Code : Abla_rckF7_tac

## Mode d'emploi

1. Faire le préalable de `RECETTE.md` (dépôt, Pages, Drive, favori).
2. Cloner le dépôt sur le PC de développement.
3. Copier `CLAUDE.md` à la racine du dépôt, `SPEC.md` et `RECETTE.md` dans `docs/`. Commit sur `main`.
4. Lancer Claude Code à la racine du dépôt et coller le prompt du lot 1.
5. Valider le plan (ou le corriger), laisser implémenter, relire la PR, dérouler la recette du lot, fusionner.
6. Passer au lot suivant avec son prompt. Ne jamais lancer deux lots à la fois.

Une session interrompue se reprend avec le prompt « Reprise » en fin de fichier.

## Lot 1 : socle

```
Lis CLAUDE.md, puis docs/SPEC.md en entier. Réalise le lot 1 : sections 3 (architecture), 4 (modèle, hors types marqués lot 3 à 5 qu'il faut seulement déclarer), 5.1 à 5.6 (moteur), 6 (éditeur), 7 (lecteur), 8 (stockage et synchronisation), 13 (terrain et conventions graphiques), et les valeurs de la section 14 qui concernent ces sections.

Le dépôt est vide à part CLAUDE.md et docs/. Initialise le projet : Vite + React + TypeScript strict, ESLint, Prettier, Vitest, Playwright (Chromium et Firefox), scripts npm de CLAUDE.md, workflow GitHub Actions (lint, typecheck, test, test:e2e, puis déploiement Pages depuis main seulement si tout passe), base Vite "/Abla_rckF7_tac/".

Commence en mode plan et attends ma validation. Le plan doit contenir :
- l'arborescence complète des fichiers créés ;
- l'ordre d'implémentation par étapes testables (d'abord model et engine avec leurs tests, puis render et viewport, puis io, puis editor et player, puis l'interface) ;
- les dépendances et leur justification ;
- la liste des tests unitaires et de bout en bout prévus ;
- les points de la spécification que tu juges ambigus ou contradictoires, sans les trancher.

Tests unitaires obligatoires, en plus de ceux que tu jugeras utiles :
- engine : continuité entre phases et au point d'option ; évaluation de chaque feuille ; vitesse constante le long d'une spline (écart inférieur à 2 %) ; passe vers une receveuse en mouvement ; état du ballon au lâcher et à la réception ; durées des phases et des lignes ; traces identiques en lecture continue et après un saut à t ; attackingTeam = B ; effectif 4 contre 2 sans ballon ; déterminisme d'evaluate.
- model et io (contre un faux système de fichiers en mémoire) : aller-retour fichier ; rejet d'un fichier invalide sans le modifier ; migration depuis une fixture version 0 fictive ; détection d'une copie de conflit (même id) ; détection d'une modification extérieure ; suppression = déplacement en corbeille ; renommage.
- render : image de référence (snapshot) d'une scène simple dans les thèmes écran et contraste fort, et dans chaque orientation.

Bout en bout (Playwright) : sous Chromium, créer 2 temps puis 2 options au temps 3, enregistrer, recharger, lire chaque option ; sous Firefox, le même scénario en mode dégradé avec export et import. Le sélecteur de dossier natif ne s'automatise pas : en mode test, propose dans le plan un dossier de substitution injecté à la place de showDirectoryPicker (par exemple le système de fichiers privé de l'origine, navigator.storage.getDirectory(), si son API d'écriture convient ; à vérifier).

Critères d'acceptation :
- une combinaison 7 contre 7 avec un tronc de 2 temps et 2 options au temps 3, créée sur le PC 1 dans le dossier Drive, apparaît sur le PC 2 après synchronisation et se lit à l'identique, options comprises ;
- modifiée sur le PC 2, elle est rechargée sur le PC 1 au retour sur la fenêtre ;
- retoucher une course du temps 1 ne casse ni les passes ni les temps suivants, dans aucune option.

Hors périmètre : exports (lot 2), modèles de placement, symétrie, regroupements, jeu au pied, contrôle d'en-avant (lot 3), défense simulée (lot 4), matériel, zones, annotations, course groupée (lot 5). Déclare leurs types, n'implémente rien.

Livrables : code, README (installation, lancement, build, déploiement GitHub Pages, configuration de Google Drive pour ordinateur et du dossier, conseil « Autoriser à chaque visite »), docs/ARCHITECTURE.md, docs/DECISIONS.md.
```

## Lot 2 : exports GIF et PDF

```
Lis CLAUDE.md, docs/SPEC.md (en particulier les sections 3, 9, 13 et 14) et docs/ARCHITECTURE.md. Réalise le lot 2 : section 9 de la spécification.

Commence en mode plan et attends ma validation. Le plan doit contenir en plus :
- une évaluation du PDF vectoriel (renderSchematic sur le contexte 2D de jsPDF) face au PDF en images à 300 dpi : prototype minimal, rendu obtenu, limites rencontrées, poids des fichiers, puis ta recommandation ; je choisis ;
- une estimation du poids d'un GIF portrait standard de 20 s pour une combinaison type, avec et sans l'optimisation des pixels inchangés ;
- la structure du Web Worker d'encodage et le protocole de messages (progression, annulation).

Tests obligatoires :
- déterminisme : deux exports successifs du même GIF sont identiques octet pour octet ;
- GIF enchaîné : nombre d'images conforme au calcul attendu (carton titre, cartons d'option, deux vitesses, pause finale) ;
- PDF : nombre de pages et sommaire corrects pour un cahier de 5 combinaisons dont une à 3 options ; liens internes présents ;
- images de référence pour une vignette PDF et une image de GIF, dans les thèmes contraste fort et impression N&B ;
- annulation d'un export : aucun fichier partiel écrit.

Critères d'acceptation :
- une combinaison à 2 options, exportée en GIF portrait enchaîné et envoyée sur WhatsApp, reste animée et lisible sur téléphone, consignes comprises ;
- le PDF en mise en page impression sort lisible en noir et blanc sur une imprimante laser ;
- un cahier de jeu de 5 combinaisons s'ouvre sur téléphone avec un sommaire cliquable.

Hors périmètre : tout ce qui relève des lots 3 à 5. Les exports doivent cependant accepter, sans modification future de leur structure, les calques et éléments à venir (jeu au pied, regroupements, défense simulée, matériel).

Livrables : code, mise à jour de docs/ARCHITECTURE.md et docs/DECISIONS.md, recette manuelle restante.
```

## Lot 3 : mise en place

```
Lis CLAUDE.md, docs/SPEC.md (en particulier les sections 4, 5.7, 10, 13 et 14) et docs/ARCHITECTURE.md. Réalise le lot 3 : modèles de placement, déplacement et symétrie d'une combinaison, regroupements (ruck et maul), jeu au pied, contrôle d'en-avant (section 10 et 5.7).

Commence en mode plan et attends ma validation. Le plan doit contenir en plus :
- l'incrément de schemaVersion, les migrations et les fixtures nécessaires ;
- la façon dont les regroupements et le jeu au pied s'insèrent dans evaluate sans casser la continuité ni la pureté ;
- l'interface de pose d'un modèle (ancre, aimantation, choix du côté ouvert) et d'un regroupement (proposition du soutien et du relayeur).

Tests obligatoires :
- modèle de placement : aller-retour fichier ; application aux quatre cas (côté ouvert à gauche ou à droite, croisé avec A ou B qui attaque) ; ancre de touche refusée à moins de 5 m d'une ligne de but ; association par rôle et numéro (déplacées, créées, inchangées) ;
- symétrie appliquée deux fois = identité ; déplacement puis déplacement inverse = identité ;
- regroupement : ballon inBreakdown pendant la durée, relayeur porteuse à la fin, phase suivante au bon instant, ligne d'avantage recalée ;
- jeu au pied : arrivée à release + flightTime ; ballon au sol ramassé par la première joueuse à moins de 1 m ;
- en-avant : passe plate d'une passeuse lancée non signalée ; passe vers l'avant dans le repère de la passeuse signalée ;
- migration des fichiers du lot 1 vers le nouveau schéma.

Hors périmètre : défense simulée (lot 4), ateliers (lot 5). Les rôles de défense des regroupements (plaqueur, gratteur ou garde) sont seulement enregistrés, pas simulés.

Livrables : code, mise à jour de docs/ARCHITECTURE.md et docs/DECISIONS.md, recette manuelle restante.
```

## Lot 4 : défense simulée

```
Lis CLAUDE.md, docs/SPEC.md (en particulier les sections 3.3, 5, 10.3 et 11, et la section 14) et docs/ARCHITECTURE.md. Réalise le lot 4 : défense simulée (section 11).

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

Livrables : code, mise à jour de docs/ARCHITECTURE.md et docs/DECISIONS.md, recette manuelle restante.
```

## Lot 5 : ateliers

```
Lis CLAUDE.md, docs/SPEC.md (en particulier les sections 4, 12, 13 et 14) et docs/ARCHITECTURE.md. Réalise le lot 5 : matériel, zones cotées, annotations, course groupée (section 12).

Commence en mode plan et attends ma validation. Le plan doit contenir en plus :
- l'incrément de schemaVersion, les migrations et les fixtures ;
- le rendu de chaque type de matériel dans les trois thèmes (écran, contraste fort, impression N&B) ;
- l'interaction de la course groupée avec la défense simulée et les modèles de placement.

Tests obligatoires :
- aller-retour fichier de chaque nouvel élément ; migration des fichiers des lots précédents ;
- course groupée : chaque joueuse garde son décalage ; durée calculée sur la trajectoire de référence ;
- cotes d'une zone exactes après redimensionnement ;
- images de référence du matériel dans les trois thèmes ;
- exports GIF et PDF d'un atelier complet.

Livrables : code, mise à jour de docs/ARCHITECTURE.md et docs/DECISIONS.md, recette manuelle restante.
```

## Prompts utilitaires

### Reprise d'une session interrompue

```
Lis CLAUDE.md (qui charge docs/ETAT.md), puis le plan du lot en cours (docs/plans/lot-N.md), les dernières entrées de docs/DECISIONS.md et docs/ARCHITECTURE.md ; lis docs/SPEC.md à la demande. Vérifie l'état réel du dépôt (git log -10, git status, branche, PR ouverte, CI) et signale tout écart avec docs/ETAT.md et les cases du plan. Résume en dix lignes au plus où en est le lot en cours, l'action suivante, ce qui reste à faire, les questions ouvertes et ce qui bloque. Propose la suite en mode plan et attends ma validation.
```

### Correction après recette

```
Recette du lot N : voici les cases non validées et ce que j'ai constaté :
<coller la liste>
Pour chaque point : identifie la cause, propose la correction en mode plan, avec le test qui aurait dû l'attraper. Attends ma validation avant de corriger.
```

### Changement de spécification

```
Je modifie la spécification : <décrire le changement>.
Mets à jour docs/SPEC.md et docs/DECISIONS.md, liste les impacts sur le code existant, les migrations éventuelles et les tests à ajouter ou modifier. Mode plan, attends ma validation.
```
