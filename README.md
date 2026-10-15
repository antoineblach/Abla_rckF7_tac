# Abla_rckF7_tac

Outil web personnel de préparation de combinaisons de rugby à 7 : éditeur sur PC (Chrome), animation, et (au lot 2) exports GIF et PDF. Un seul utilisateur, deux ordinateurs, données dans un dossier Google Drive.

- Application en ligne : https://antoineblach.github.io/Abla_rckF7_tac/ (la casse de l'adresse compte).
- Spécification : [docs/SPEC.md](docs/SPEC.md). Recette : [docs/RECETTE.md](docs/RECETTE.md). Architecture : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Décisions : [docs/DECISIONS.md](docs/DECISIONS.md). État du projet : [docs/ETAT.md](docs/ETAT.md).

## Utilisation au quotidien

1. Ouvrir l'application dans Chrome depuis le favori.
2. Au premier usage, cliquer sur « Choisir un dossier » et désigner le dossier Drive (par exemple `Mon Drive/Rugby7`). Chrome demande l'autorisation : choisir **« Autoriser à chaque visite »** (« Allow on every visit », Chrome 122 et suivants). L'accès reste alors permanent et l'outil rouvre le dossier sans rien demander.
3. Si Chrome a oublié l'autorisation, un bandeau propose « Réautoriser le dossier » : un clic suffit.
4. L'outil crée dans le dossier `reglages.json`, `combinaisons/` et `_corbeille/`. Chaque combinaison est un fichier `combinaisons/<nom-court>--<id>.combi.json`. Rien n'est jamais effacé : supprimer une combinaison la déplace dans `_corbeille/`.
5. Enregistrement automatique 2 s après la dernière modification, ou Ctrl+S. L'outil relit le dossier au retour sur la fenêtre et toutes les 30 s : une combinaison modifiée sur l'autre PC est rechargée (ou un choix est proposé si vous étiez en train de la modifier).

### Mode dégradé

- **Firefox**, ou Chrome tant qu'aucun dossier n'est choisi : la bibliothèque reste dans le navigateur (IndexedDB). Un bandeau le rappelle.
- Échanges manuels : « Exporter » (une combinaison, `.combi.json`), « Exporter tout » (`.combipack.json`), « Importer ».
- En choisissant ensuite un dossier dans Chrome, l'outil propose d'y copier les combinaisons du navigateur.

## Configuration de Google Drive pour ordinateur (une fois par PC)

1. Installer Google Drive pour ordinateur sur les deux PC et se connecter au même compte.
2. Créer un dossier dans « Mon Drive », par exemple `Mon Drive/Rugby7`.
3. Mode recommandé : **miroir** (fichiers sur le disque et dans le cloud, disponibles hors connexion). Le mode **diffusion** fonctionne aussi : l'accès au dossier, l'écriture et la sauvegarde automatique y ont été vérifiés en recette le 15/10/2026.
4. Historique : Drive garde les versions d'un fichier 30 jours ou 100 versions (sauf « Conserver indéfiniment ») ; clic droit sur un fichier, « Gérer les versions ».
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
| `npm test`          | Vitest (tests unitaires, images de référence du rendu)                                    |
| `npm run test:e2e`  | Playwright, Chromium (mode dossier) et Firefox (mode dégradé), sur le build de production |
| `npm run format`    | Prettier                                                                                  |

- Images de référence du rendu : `src/test/image-snapshots/`. Après un changement volontaire du rendu : `UPDATE_SNAPSHOTS=1 npm test`, puis vérifier les images avant de les committer. En cas d'écart, l'image obtenue et la différence sont écrites dans `src/test/image-snapshots/__diff__/`.
- Le sélecteur de dossier natif ne s'automatise pas : les tests de bout en bout le remplacent par un dossier du système de fichiers privé du navigateur (OPFS), sans code de test dans l'application.

## Déploiement sur GitHub Pages

- Réglage du dépôt (une fois) : Settings, Pages, source « GitHub Actions ».
- Le workflow `.github/workflows/ci.yml` lance, à chaque push et chaque PR : lint, typecheck, tests unitaires, tests de bout en bout et build. Sur `main`, et seulement si tout passe, il publie `dist/` sur Pages.
- `main` est protégée : une PR ne peut être fusionnée que si le statut « checks » est vert. Pas de push direct sur `main`.
- Travail par lot : une branche `lot-N`, une PR vers `main`, fusion après la recette du lot (`docs/RECETTE.md` : tests automatisés, au plus 5 vérifications manuelles, séance d'usage libre).
- La base de Vite est `/Abla_rckF7_tac/` (casse exacte) : la changer seulement si le dépôt est renommé.
