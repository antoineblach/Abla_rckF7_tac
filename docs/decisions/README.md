# Journal des décisions : index

Une entrée numérotée par décision (D-001, D-002…), ajoutée au moment où la décision est prise, dans le fichier du lot en cours, avec une ligne dans le tableau ci-dessous. Aucune entrée n'est effacée, dans aucun fichier : une décision remplacée reçoit une nouvelle entrée qui cite l'ancienne (« Remplace D-0xx »), l'ancienne reçoit la mention « Remplacée par D-0yy » et sa ligne d'index change de statut.

Champs d'une entrée : date, décision, raison, alternatives écartées, origine (réponse de l'utilisateur, SPEC, essai, choix technique).

Les décisions structurantes initiales (ancienne section 16 de la SPEC) sont reprises dans D-122.

## Fichiers

| Fichier | Entrées |
|---|---|
| [cadrage.md](cadrage.md) | D-122 (décisions initiales du 14 octobre 2026) |
| [lot-1.md](lot-1.md) | D-001 à D-056 |
| [lot-2.md](lot-2.md) | D-057 à D-077 |
| [lot-3.md](lot-3.md) | D-078 à D-101 (mise en place, puis correction après recette) |
| [lot-3bis.md](lot-3bis.md) | D-103 à D-121 (lot 3 bis), D-129 à D-137 (3bis-1), puis les décisions de 3bis-2 et 3bis-3 |
| [exploitation.md](exploitation.md) | D-102 (exploitation du dépôt), D-123 à D-128 (documentation et outils de travail) |

## Lecture

- Lire ce tableau, puis une décision par son numéro : Grep `### D-0xx` avec `-A 12` dans le fichier qui la contient, ou un Read ciblé jusqu'à l'entrée suivante. Jamais un fichier entier.
- Statut : « en vigueur », « remplacée par D-xxx », « remplacée en partie par D-xxx » ou « précisée par D-xxx ».
- Sections : sections de la SPEC que la décision touche (« 8.4 » : section 8.4), sinon « — ». « non intégrée (x.y) » : la décision touche la section x.y sans que la SPEC ait été mise à jour ; `/fin-lot` l'intègre à la SPEC et retire la mention. « reportée à <lot> » : la partie ainsi marquée reste non intégrée jusqu'à ce lot ; `/fin-lot` d'un autre lot la laisse telle quelle.

## Décisions

| Décision | Titre | Statut | Sections |
|---|---|---|---|
| D-001 | terrain réduit selon la Règle 1 | en vigueur | 13.1 |
| D-002 | tirets et poteaux | en vigueur | 13.1 |
| D-003 | réglages passés au moteur | en vigueur | 3.3 |
| D-004 | types des lots 3 à 5 | en vigueur | 4.1 |
| D-005 | renommage d'une combinaison | en vigueur | 8.3, 8.5 |
| D-006 | orientation quand B attaque | en vigueur | 3.3, 5.6 |
| D-007 | ballon dans l'éditeur | en vigueur | 6.5 |
| D-008 | placements de départ | en vigueur | 6.6 |
| D-009 | positions héritées | en vigueur | 6.3 |
| D-010 | éditeur et lecteur | en vigueur | 6.3, 7 |
| D-011 | bascule « S'arrêter aux options » | en vigueur | 7 |
| D-012 | actions de l'arbre des temps | en vigueur | 6.4 |
| D-013 | moteur et invalidités | en vigueur | 4.3, 5.4 |
| D-014 | suppression d'une joueuse | en vigueur | 6.3 |
| D-015 | raccourcis et outils | en vigueur | 6.2 |
| D-016 | numéros en double | en vigueur | 4.3 |
| D-017 | dimensions du terrain | en vigueur | 13.1 |
| D-018 | vue demi-terrain | en vigueur | 4.1 |
| D-019 | cadrage, orientation, cadre libre, passe en vol | remplacée en partie par D-049 | 6.5, 7 |
| D-020 | interface LibraryStore | en vigueur | 8.1 |
| D-021 | mode dégradé | en vigueur | 8.6 |
| D-022 | conflits | en vigueur | 8.4 |
| D-023 | noms de fichiers et relecture | en vigueur | 4.4, 8.3 |
| D-024 | fichiers inattendus | en vigueur | 4.4 |
| D-025 | brouillon | en vigueur | 3.5 |
| D-026 | préférences par poste | en vigueur | 3.5 |
| D-027 | dossiers hors arborescence 3.2 | en vigueur | 3.2 |
| D-028 | protection de main | en vigueur | 3.4 |
| D-029 | mise à jour de la SPEC et de la RECETTE en fin de lot | en vigueur | — |
| D-030 | mémoire du projet dans le dépôt | précisée par D-047, D-123 et D-125 | — |
| D-031 | TypeScript 6.0 | en vigueur | 3.1 |
| D-032 | versions de la pile | en vigueur | 3.1, 3.4 |
| D-033 | un seul tsconfig | en vigueur | 3.1 |
| D-034 | règles ESLint de pureté et d'aplats | en vigueur | 3.3 |
| D-035 | e2e du mode dossier sur OPFS | en vigueur | — |
| D-036 | images de référence du rendu | en vigueur | — |
| D-037 | point fixe de la passe | en vigueur | 5.4 |
| D-038 | durée d'un temps | en vigueur | 5.1 |
| D-039 | caches | en vigueur | — |
| D-040 | sérialisation et géométrie | en vigueur | 4.4, 5.3 |
| D-041 | conventions de rendu du lot 1 | en vigueur | 13.3 |
| D-042 | comparaison des images de référence | en vigueur | — |
| D-043 | détection et écriture dans le dossier | remplacée en partie par D-097 | 8.3 |
| D-044 | couche d'état et interactions | en vigueur | 3.2, 3.3 |
| D-045 | interface du lot 1 | précisée par D-052 | 6.1, 6.5 |
| D-046 | réponses en français | en vigueur | — |
| D-047 | longueur de ETAT.md | remplacée par D-124 | — |
| D-048 | stabilité du terrain | en vigueur | 6.1 |
| D-049 | vue unique pour l'édition et la lecture | en vigueur | 6.1, 7 |
| D-050 | bandeau en surimpression | en vigueur | 6.1 |
| D-051 | seuil de glisser | en vigueur | 6.2 |
| D-052 | section « Combinaison » de l'inspecteur | en vigueur | 6.5 |
| D-053 | version d'Ubuntu de la CI | en vigueur | 3.4 |
| D-054 | règle de recette | en vigueur | — |
| D-055 | contrôle du blocage des fusions | en vigueur | 3.4 |
| D-056 | raccourcis et focus des contrôles | en vigueur | 6.2 |
| D-057 | PDF vectoriel | en vigueur | 9.3 |
| D-058 | GIF enchaîné | en vigueur | 9.2 |
| D-059 | durées des cartons et maintiens | en vigueur | 9.2 |
| D-060 | habillage des exports | en vigueur | 9.1 |
| D-061 | lisibilité sur téléphone | précisée par D-075 | 9.2 |
| D-062 | thèmes des exports | en vigueur | 9.1, 13.2 |
| D-063 | vignettes et mise en page du PDF | précisée par D-075 | 9.3 |
| D-064 | cahier de jeu | précisée par D-075 | 9.3 |
| D-065 | export déjà présent, échec d'écriture | en vigueur | 9.1 |
| D-066 | noms des exports | en vigueur | 9.2, 9.3 |
| D-067 | version allégée d'un GIF | en vigueur | 9.2 |
| D-068 | préférences d'export | en vigueur | 4.4 |
| D-069 | optimisation des GIF désactivable | en vigueur | 9.2 |
| D-070 | prototypes et dépendances de test | en vigueur | — |
| D-071 | résultats de l'étape 0, vectoriel confirmé | en vigueur | 9.3 |
| D-072 | réglages v2 et valeurs de l'étape 1 | en vigueur | 4.4, 4.5 |
| D-073 | rendu des exports (étape 2) | en vigueur | 13.2 |
| D-074 | plan et encodage des GIF (étape 3) | en vigueur | 9.2 |
| D-075 | mise en page et écriture des PDF (étape 4) | en vigueur | 9.3 |
| D-076 | io des exports et Worker (étape 5) | en vigueur | 9.1 |
| D-077 | interface des exports (étape 6) | en vigueur | 9.1 |
| D-078 | rôles de défense d'un regroupement | en vigueur | 10.3, 11.4 |
| D-079 | participantes d'un regroupement | précisée par D-130 | 10.3 |
| D-080 | maul | en vigueur | 10.3 |
| D-081 | pose d'un regroupement | en vigueur | 10.3 |
| D-082 | ligne d'avantage en mode schéma | en vigueur | 5.6 |
| D-083 | ballon au sol et ramassage | en vigueur | 10.4 |
| D-084 | conventions graphiques du lot 3 | en vigueur | 10.4, 10.5 |
| D-085 | calque « En-avant » | en vigueur | 5.7, 10.5 |
| D-086 | aucune alerte d'en-avant dans les exports | en vigueur | 10.5 |
| D-087 | type du modèle et catégorie | en vigueur | 10.1 |
| D-088 | ancre et côté ouvert | en vigueur | 10.1 |
| D-089 | enregistrer un modèle | en vigueur | 10.1 |
| D-090 | déplacer, retourner une combinaison | en vigueur | 10.2 |
| D-091 | nouvelle combinaison depuis un modèle | en vigueur | 6.6 |
| D-092 | modèles et synchronisation | en vigueur | 8.1 |
| D-093 | raccourcis des nouveaux outils | en vigueur | 6.2 |
| D-094 | schéma v2, modèle v1 et moteur du lot 3 | en vigueur | 4.1, 4.5 |
| D-095 | interface du jeu au pied et des regroupements (étape 6) | en vigueur | 10.3, 10.4 |
| D-096 | interface des modèles et de la combinaison entière (étape 7) | remplacée en partie par D-101 | 6.6, 10.1, 10.2 |
| D-097 | base de concurrence par l'empreinte du contenu | en vigueur | 8.3, 8.4 |
| D-098 | écritures de la page et retour en arrière de Drive | en vigueur | 8.4 |
| D-099 | aucune sauvegarde automatique pendant un glisser | en vigueur | 8.3 |
| D-100 | journal de synchronisation | en vigueur | 8.3 |
| D-101 | nouvelle combinaison depuis un modèle enregistrée à la validation de la pose | en vigueur | 6.6, 10.1 |
| D-102 | le dépôt reste public | en vigueur | — |
| D-103 | portée du lot 3 bis | en vigueur | — |
| D-104 | combinaison v3 et migration | en vigueur | 4.1, 4.5 |
| D-105 | profil de vitesse | remplacée en partie par D-129, D-130 et D-135 | 5.3 |
| D-106 | course qui finit lancée | en vigueur | 5.3 |
| D-107 | durée imposée | remplacée en partie par D-129 | 5.3 |
| D-108 | liens de synchronisation | remplacée en partie par D-129 et D-131 | 5.8 |
| D-109 | création d'un lien | en vigueur | 6.5 |
| D-110 | lâcher des passes et des jeux au pied | précisée par D-119 | 5.4, 5.8 |
| D-111 | vitesses irréalistes, réglages v3 et sprint | précisée par D-132 et D-134 | 4.4, 5.9 |
| D-112 | calque « Vitesses » | précisée par D-132 | 5.9, 7 |
| D-113 | liste des actions du temps | en vigueur | 6.7 |
| D-114 | vitesse par segment | précisée par D-133 | 5.3, 6.5 |
| D-115 | rendu des segments rapides | en vigueur | 13.3 |
| D-116 | lecture et pause à la barre d'espace | en vigueur | 6.2, 7 |
| D-117 | vitesses en km/h | précisée par D-133 | 6.5 |
| D-118 | pistes reportées | remplacée en partie par D-135 | — |
| D-119 | lâcher posé par les outils pour une joueuse qui ramasse le ballon | en vigueur | non intégrée (5.4, 6.2) |
| D-120 | précisions de l'éditeur des liens et des segments | en vigueur | non intégrée (6.2 : raccourcis lus sur la touche physique) ; le reste : non intégrée (5.8, 6.5), reportée à 3bis-2 |
| D-121 | précisions de l'interface du lot 3 bis | en vigueur | non intégrée (6.1, 6.5, 6.7), sauf « Changer la cible » et « Délai calculé par le lien » : non intégrée (6.5), reportée à 3bis-2 |
| D-122 | décisions initiales du 14 octobre (ancienne SPEC 16) | en vigueur | 1, 2 |
| D-123 | documentation découpée et lecture ciblée | en vigueur | — |
| D-124 | longueur et contenu de ETAT.md | en vigueur | — |
| D-125 | procédures en skills et une conversation par bloc d'étapes | en vigueur | — |
| D-126 | section 14 de la SPEC réduite à un renvoi | en vigueur | 14 |
| D-127 | économie de contexte | en vigueur | — |
| D-128 | suite du lot 3 bis en trois parties | en vigueur | — |
| D-129 | le mouvement sert l'intention du coach | en vigueur | non intégrée (5.3, 5.8, 5.9) |
| D-130 | solveur à deux leviers | en vigueur | non intégrée (5.3, 5.8, 10.3) |
| D-131 | départ différé en retard et cible avant le départ | précisée par D-136 | non intégrée (5.8) |
| D-132 | alertes d'accélération et de freinage | précisée par D-135 et D-137 | non intégrée (4.4, 5.9, 6.5, 6.7, 7) |
| D-133 | allure saisie, combinaison v4 et curseur de vitesse | en vigueur | non intégrée (4.1, 4.5, 6.5) |
| D-134 | réglages v4 | en vigueur | non intégrée (4.4, 6.5) |
| D-135 | modèle de mouvement et calibration | en vigueur | non intégrée (4.4, 5.3, 5.9) |
| D-136 | départ différé en retard d'une course à durée imposée | en vigueur | non intégrée (5.8) |
| D-137 | placement et dessin des pastilles d'accélération et de freinage | en vigueur | non intégrée (5.9, 7) |
