# Abla_rckF7_tac

Outil web personnel de préparation de combinaisons de rugby à 7 : éditeur sur PC (Chrome), animation, exports GIF et PDF. Un seul utilisateur, deux ordinateurs, données dans un dossier Google Drive.

- Application en ligne : https://antoineblach.github.io/Abla_rckF7_tac/ (la casse de l'adresse compte).
- Spécification : [docs/SPEC.md](docs/SPEC.md). Recette : [docs/RECETTE.md](docs/RECETTE.md). Architecture : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Décisions : [docs/DECISIONS.md](docs/DECISIONS.md). État du projet : [docs/ETAT.md](docs/ETAT.md).

## Utilisation au quotidien

1. Ouvrir l'application dans Chrome depuis le favori.
2. Au premier usage, cliquer sur « Choisir un dossier » et désigner le dossier Drive (par exemple `Mon Drive/Rugby7`). Chrome demande l'autorisation : choisir **« Autoriser à chaque visite »** (« Allow on every visit », Chrome 122 et suivants). L'accès reste alors permanent et l'outil rouvre le dossier sans rien demander.
3. Si Chrome a oublié l'autorisation, un bandeau propose « Réautoriser le dossier » : un clic suffit.
4. L'outil crée dans le dossier `reglages.json`, `combinaisons/`, `modeles/`, `exports/` et `_corbeille/`. Chaque combinaison est un fichier `combinaisons/<nom-court>--<id>.combi.json`. Rien n'est jamais effacé : supprimer une combinaison la déplace dans `_corbeille/`.
5. Enregistrement automatique 2 s après la dernière modification (jamais pendant un glisser), ou Ctrl+S. L'outil relit le dossier au retour sur la fenêtre et toutes les 30 s : une combinaison modifiée sur l'autre PC est rechargée (ou un choix est proposé si vous étiez en train de la modifier). Une version écrite par la page elle-même n'est jamais prise pour une modification de l'autre PC, même si Drive change la date du fichier ou rend brièvement une version antérieure (l'outil réécrit alors la dernière).
6. Si le dialogue « Version plus récente dans le dossier » apparaît alors que personne n'a touché à la combinaison ailleurs : inspecteur, section « Réglages », « Copier le journal de synchronisation », puis transmettre le texte copié.

### Mises en place (modèles de placement)

- **Enregistrer un modèle** : bibliothèque, onglet « Modèles », « Enregistrer un modèle… » (combinaison ouverte). Choisir le nom, le type (mêlée, touche, coup d'envoi/renvoi, ruck, libre), le placement de départ entier ou la sélection (par exemple la défense seule), le ballon et le côté ouvert, puis cliquer le point d'ancrage sur le terrain. Chaque modèle est un fichier `modeles/<nom-court>--<id>.preset.json`.
- **Appliquer** : « Appliquer », puis cliquer le point d'ancrage ; des jetons fantômes suivent le pointeur et un bandeau propose le côté ouvert (Auto, Gauche, Droite). L'ancre d'une touche se place sur la ligne de touche, jamais à moins de 5 m d'une ligne de but. Les joueuses sont associées par rôle (attaque, défense) et numéro : existantes déplacées, manquantes créées. Échap annule.
- Un modèle d'attaque puis un modèle de défense se combinent. « Nouvelle combinaison » propose aussi les modèles : la nouvelle combinaison n'est enregistrée qu'une fois le point d'ancrage cliqué ; Échap (ou « Annuler ») l'abandonne sans rien laisser dans la bibliothèque et rouvre la combinaison précédente.
- Renommer, dupliquer, mettre à jour depuis le placement courant, supprimer (dans `_corbeille/`). Un modèle modifié sur l'autre PC depuis votre dernière lecture n'est pas touché : l'outil le signale et relit la liste.
- **Combinaison entière** (section Combinaison de l'inspecteur) : « Déplacer la combinaison » (deux clics, départ puis arrivée) et « Retourner » (symétrie gauche-droite).
- **Regroupements et jeu au pied** : outils « Regroupement » (G) et « Jeu au pied » (J) ; le calque « En-avant » du lecteur signale les passes en avant probables (jamais dans les exports).

### Courses réalistes (lot 3 bis)

- **Profil de vitesse** : une joueuse accélère, freine et ralentit dans les virages ; l'allure d'une course est une vitesse de pointe. Accélération, freinage et accélération latérale se règlent dans les réglages de l'inspecteur (m/s²). Allures par défaut : marche 2 m/s, trot 4 m/s, sprint 5,5 m/s (19,8 km/h) ; un ancien `reglages.json` au sprint de 7 m/s passe à 5,5 m/s, avec un message.
- **Vitesse d'un segment** : clic sur le trait d'une course (le segment sous le pointeur est sélectionné) ou sur un point (le segment qui y arrive), puis touches 1 (marche), 2 (trot), 3 (sprint), 0 (allure de la course), ou bloc « Segment n » de l'inspecteur, avec une vitesse saisie en km/h. Un segment au sprint ou plus vite est tracé plus épais, exports compris.
- **Finit lancée** (inspecteur de la course) : la course finit sans freiner et la joueuse repart lancée au temps suivant, dans la même direction. Posée automatiquement quand toutes les options du temps suivant prolongent la course.
- **Caler sur…** (inspecteur de la course) : puis cliquer la cible sur le terrain (point ou trait d'une autre course, passe ou jeu au pied près de son départ ou de son arrivée, regroupement). Réglage « Départ différé » (délai calculé) ou « Vitesse ajustée ». Échap annule. Un lien qui créerait une boucle est refusé.
- **Lâcher d'une passe ou d'un jeu au pied** : « à un instant fixe » (délai) ou « à la réception » (temps de contrôle) ; les outils choisissent « à la réception » quand la joueuse n'a pas le ballon au début du temps.
- **Actions du temps** (bande du bas, à droite de l'arbre) : une ligne par action avec sa barre de temps et ses alertes ; clic pour sélectionner, survol pour la repérer sur le terrain, Suppr pour la supprimer.
- **Vitesses irréalistes** : au-delà de 20 km/h (orange) et 25 km/h (rouge), seuils réglables ; pastille dans l'éditeur, calque « Vitesses » dans le lecteur, jamais dans les exports.
- **Barre d'espace** : un appui bref lance ou met en pause la lecture ; maintenue avec un glisser, elle déplace le terrain.

### Exports GIF et PDF

- **GIF** (« Exporter GIF », combinaison ouverte) : orientation (portrait, paysage, carré), un GIF enchaîné ou un GIF par option, ralenti puis vitesse réelle (ou une seule vitesse), qualité standard ou haute, thème (Contraste fort par défaut). La case « Alléger le fichier » (cochée par défaut) rend le GIF 3 à 7 fois plus léger ; la décocher si WhatsApp le rend mal.
- **PDF** (« Exporter PDF ») : mise en page « Impression » (A4 paysage) ou « Téléphone » (pages de 100 mm lues en défilant), en couleur ou en noir et blanc.
- **Cahier de jeu** (bouton de la bibliothèque) : plusieurs combinaisons ou une catégorie dans un seul PDF, avec page de titre, sommaire cliquable et numéros de page.
- L'encodage se fait en arrière-plan : une barre de progression et « Annuler » ; une annulation ne laisse aucun fichier. À la fin, l'outil affiche le nom et la taille de chaque fichier ; au-delà de 8 Mo, il propose une version allégée.
- Les fichiers vont dans `exports/` du dossier : `<nom-court>--<variante>.gif` ou `.pdf` (par exemple `croisee-au-centre--portrait-enchaine.gif`, `croisee-au-centre--impression-nb.pdf`). Un export déjà présent n'est jamais écrasé sans votre accord : « Remplacer » met d'abord l'ancien dans `_corbeille/`, « Garder les deux » numérote le nouveau (`-2`, `-3`...).
- Sans dossier (Firefox, ou Chrome avant le choix d'un dossier), les fichiers sont téléchargés.
- Les choix des dialogues sont mémorisés dans `reglages.json` (communs aux deux PC).

### Récupérer un export sur le téléphone

1. Attendre que Drive pour ordinateur ait synchronisé le dossier (icône Drive).
2. Sur le téléphone, ouvrir l'app Google Drive, dossier `Rugby7/exports/`.
3. GIF : menu « ⋮ », « Envoyer une copie », puis WhatsApp. PDF : ouvrir pour lire, ou envoyer de la même façon.
4. WhatsApp convertit les GIF en courtes vidéos ; un fichier lourd peut arriver comme une vidéo à lancer : utiliser alors la version allégée.

### Mode dégradé

- **Firefox**, ou Chrome tant qu'aucun dossier n'est choisi : la bibliothèque reste dans le navigateur (IndexedDB). Un bandeau le rappelle.
- Échanges manuels : « Exporter » (une combinaison, `.combi.json`), « Exporter tout » (`.combipack.json`), « Importer ».
- En choisissant ensuite un dossier dans Chrome, l'outil propose d'y copier les combinaisons et les modèles du navigateur.

## Configuration de Google Drive pour ordinateur (une fois par PC)

1. Installer Google Drive pour ordinateur sur les deux PC et se connecter au même compte.
2. Créer un dossier dans « Mon Drive », par exemple `Mon Drive/Rugby7`.
3. Mode recommandé : **miroir** (fichiers sur le disque et dans le cloud, disponibles hors connexion). Le mode **diffusion** fonctionne aussi : l'accès au dossier, l'écriture et la sauvegarde automatique y ont été vérifiés en recette le 15/10/2026.
4. Historique : Drive garde les versions d'un fichier 30 jours ou 100 versions (sauf « Conserver indéfiniment ») ; clic droit sur un fichier, « Gérer les versions ». Avant de restaurer une ancienne version, recharger la page de l'outil sur les deux PC : une page encore ouverte qui avait écrit cette version la prendrait pour un retour en arrière de Drive et réécrirait la dernière.
5. Bonne pratique : attendre la fin de la synchronisation (icône Drive) avant de passer d'un PC à l'autre. Si Drive crée une copie de conflit, l'outil la signale dans la bibliothèque (« Garder les deux » ou « Choisir celle-ci »).

## Développement

Prérequis : Node 24 (voir `.nvmrc`) et npm.

```bash
npm ci                     # installation
npx playwright install chromium firefox   # navigateurs des tests de bout en bout (une fois)
npm run dev                # serveur de développement : http://localhost:5173/Abla_rckF7_tac/
npm run build              # build de production dans dist/
npm run preview            # prévisualisation du build : http://localhost:4173/Abla_rckF7_tac/
```

| Script              | Rôle                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `npm run lint`      | ESLint (dont les règles de pureté du moteur et du rendu, et les aplats)                   |
| `npm run typecheck` | `tsc --noEmit`                                                                            |
| `npm test`          | Vitest (tests unitaires, images de référence du rendu et des exports)                     |
| `npm run test:e2e`  | Playwright, Chromium (mode dossier) et Firefox (mode dégradé), sur le build de production |
| `npm run format`    | Prettier                                                                                  |

- Images de référence du rendu : `src/test/image-snapshots/`. Après un changement volontaire du rendu : `UPDATE_SNAPSHOTS=1 npm test`, puis vérifier les images avant de les committer. En cas d'écart, l'image obtenue et la différence sont écrites dans `src/test/image-snapshots/__diff__/`.
- Le sélecteur de dossier natif ne s'automatise pas : les tests de bout en bout le remplacent par un dossier du système de fichiers privé du navigateur (OPFS), sans code de test dans l'application.

## Déploiement sur GitHub Pages

- Réglage du dépôt (une fois) : Settings, Pages, source « GitHub Actions ».
- Le workflow `.github/workflows/ci.yml` lance, à chaque push et chaque PR : lint, typecheck, tests unitaires, tests de bout en bout et build. Sur `main`, et seulement si tout passe, il publie `dist/` sur Pages.
- `main` est protégée : une PR ne peut être fusionnée que si le statut « checks » est vert. Pas de push direct sur `main`.
- Le dépôt doit rester public : sans abonnement payant, passer en privé désactive GitHub Pages et supprime la protection de `main` (incident du 23/10/2026, D-102).
- Travail par lot : une branche `lot-N`, une PR vers `main`, fusion après la recette du lot (`docs/RECETTE.md` : tests automatisés, au plus 5 vérifications manuelles, séance d'usage libre).
- La base de Vite est `/Abla_rckF7_tac/` (casse exacte) : la changer seulement si le dépôt est renommé.
- Après un déploiement qui change le format des fichiers (lot 3 : combinaisons en version 2 ; lot 3 bis : combinaisons et `reglages.json` en version 3), recharger la page (Ctrl+F5) sur les deux PC : une page restée ouverte sur l'ancienne version signale les nouveaux fichiers comme « créés par une version plus récente » et ne les modifie pas. Les anciens fichiers sont réécrits dans la nouvelle version au premier enregistrement.
