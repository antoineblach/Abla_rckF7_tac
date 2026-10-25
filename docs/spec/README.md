# Spécification : outil de combinaisons de rugby à 7 (Abla_rckF7_tac)

Ce dossier est la source de vérité du projet, fonctionnel et technique, pour tous les lots.

En cas de contradiction entre un prompt et la spécification, ou entre deux sections de la spécification : s'arrêter et demander, ne jamais trancher seul.

## Version

Version 1.7 du 25 octobre 2026. Elle intègre :
- D-001 à D-118 ;
- D-122 (décisions de cadrage, déjà dans les sections 1 et 2) ;
- D-123 (découpage de la spécification) ;
- D-126 (section 14 réduite à un renvoi).

D-119 à D-121 n'y sont pas intégrées. L'index des décisions, [docs/decisions/README.md](../decisions/README.md), marque « non intégrée (x.y) » toute décision qui touche la spécification sans l'avoir mise à jour.

Règle de version :
- la version d'un fichier est la dernière version globale qui l'a modifié (jusqu'à 1.6, calculée sur l'historique git de l'ancien `docs/SPEC.md`) ;
- toute modification d'un fichier incrémente la version globale, et le fichier modifié prend ce numéro ;
- cet index est mis à jour dans le même commit : version globale, décisions intégrées, ligne du fichier.

## Lecture

- Lire cet index, puis les seuls fichiers concernés.
- « SPEC 8.4 » désigne la sous-section 8.4, dans `08-stockage.md` : le numéro de section donne le préfixe du fichier.
- Les sections gardent leur numérotation : les renvois internes (« voir 6.2 ») et ceux du code (« SPEC section 14 ») restent valables.

## Fichiers

| Fichier | Contenu | Lots | Version |
|---|---|---|---|
| [00-conventions.md](00-conventions.md) | Statuts « Établi » et « Hypothèse », unités, vocabulaire | tous | 1.0 |
| [01-contexte.md](01-contexte.md) | Utilisateur, postes de travail, besoin, diffusion, hors périmètre | tous | 1.0 |
| [02-decisions-structurantes.md](02-decisions-structurantes.md) | Décisions structurantes et leurs raisons : hébergement, stockage, rendu, repère, arbre des temps, défense | tous | 1.0 |
| [03-architecture.md](03-architecture.md) | Pile ; arborescence de `src/` ; principes d'architecture ; déploiement et intégration continue ; stockage navigateur | tous | 1.6 |
| [04-modele.md](04-modele.md) | Modèle de données (schemaVersion 3) : types ; repère ; règles de validité ; fichiers ; migrations | tous | 1.6 |
| [05-moteur.md](05-moteur.md) | Lignes et temps ; continuité ; trajectoires ; ballon ; traces ; ligne d'avantage ; contrôle d'en-avant ; synchronisation et rendez-vous ; vitesses irréalistes | 1, 3 (5.7), 3 bis (5.8, 5.9), 4 | 1.6 |
| [06-editeur.md](06-editeur.md) | Disposition de l'écran ; outils ; comportements ; arbre des temps ; inspecteur ; départ d'une nouvelle combinaison ; liste des actions du temps | 1, 3 bis (6.7) | 1.6 |
| [07-lecteur.md](07-lecteur.md) | Lecteur intégré à l'éditeur : commandes, points d'option, calques, vue, aperçu d'orientation | 1 | 1.6 |
| [08-stockage.md](08-stockage.md) | Interface ; dossier ; lecture, écriture et détection des changements ; conflits ; suppression ; mode dégradé ; bibliothèque ; configuration Drive | 1 | 1.5 |
| [09-exports.md](09-exports.md) | Principes ; GIF ; PDF | 2 | 1.4 |
| [10-mise-en-place.md](10-mise-en-place.md) | Modèles de placement ; déplacer ou retourner une combinaison ; regroupements ; jeu au pied ; contrôle d'en-avant | 3, 4 (10.3) | 1.6 |
| [11-defense.md](11-defense.md) | Principes établis ; lignes de hors-jeu ; réglages ; rôles ; mouvement ; indicateurs ; intégration ; limites assumées | 4 | 1.0 |
| [12-ateliers.md](12-ateliers.md) | Matériel, zones cotées, annotations, course groupée ; types des entités | 5 | 1.6 |
| [13-terrain.md](13-terrain.md) | Terrain (Règle 1) ; thèmes ; conventions de tracé | tous | 1.6 |
| [14-valeurs-par-defaut.md](14-valeurs-par-defaut.md) | Renvoi à `src/config/defaults.ts` ; valeurs de la défense simulée et palette des GIF | tous | 1.7 |
| [15-sources.md](15-sources.md) | Règles World Rugby, en-avant, défense, technique | tous | 1.0 |
