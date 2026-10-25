# Complément du lot 5 : ateliers

Texte du prompt du lot 5, repris de l'ancien fichier des prompts, chemins mis à jour (D-123). Les règles de lecture et de plan du skill priment : index de la SPEC puis les fichiers cités, ARCHITECTURE par sections.
Lis CLAUDE.md, docs/spec/ (en particulier les sections 4, 12, 13 et 14) et docs/ARCHITECTURE.md. Réalise le lot 5 : matériel, zones cotées, annotations, course groupée (section 12).

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

Livrables : code et tests (tout ce qui est automatisable est testé), mise à jour de docs/ARCHITECTURE.md et docs/decisions/, au plus 5 vérifications manuelles indispensables et impossibles à automatiser (D-054).
