## 8. Stockage et synchronisation (lot 1)

### 8.1 Interface

```ts
interface LibraryStore {
  list(): Promise<PlaySummary[]>
  get(id: Id): Promise<Play>
  put(play: Play): Promise<void>
  remove(id: Id): Promise<void>            // déplacement en corbeille
  changesSince(stamp: number): Promise<Change[]>
}
```

Deux implémentations : `FolderStore` (principale) et `IdbStore` (mode dégradé). Les modèles de placement (lot 3) et les réglages passent par la même couche.

Extensions du lot 1 (D-020) : `issues()` (fichiers invalides, copies de conflit), `resolveDuplicate(id, choix)`, `getSettings()` et `putSettings()`, `versionOf(id)`, `put(play, { expected, archivePrevious })` pour la concurrence optimiste et le remplacement à l'import. `stamp` est un compteur de relectures, pas une heure (les horloges des deux PC et les dates posées par Drive peuvent diverger) ; chaque `Change` porte son `stamp`. Correction du lot 3 : le jeton de version porte l'empreinte du contenu (`{ lastModified, size, contentHash }`, D-097) et `isOwnWrite(collection, id, empreinte)` dit si un contenu est une version écrite par la page (D-098).

### 8.2 Dossier

- L'utilisateur choisit une fois un dossier avec `showDirectoryPicker` (Chrome). Le handle est conservé dans IndexedDB.
- Au démarrage, si la permission n'est plus accordée, un bouton « Réautoriser le dossier » la redemande en un clic. Chrome (version 122 et suivantes) propose « Autoriser à chaque visite » (« Allow on every visit »), qui rend l'accès permanent (établi).
- Structure créée au premier usage (`exports/` depuis le lot 2, D-076) :

```
<dossier choisi>/
  reglages.json
  combinaisons/
  modeles/          (lot 3)
  exports/          (lot 2)
  _corbeille/
```

### 8.3 Lecture, écriture, détection des changements

- Relecture complète au démarrage, à chaque retour du focus sur la fenêtre, et toutes les 30 s tant que la fenêtre est visible (HYPOTHÈSE de période). La relecture prend tout fichier `*.json` de `combinaisons/` et de `modeles/` (lot 3, D-092), copies de conflit comprises, et ignore les autres, dont les fichiers temporaires `.crswap` de Chrome (D-023).
- Un changement est détecté par la date de modification et la taille du fichier, puis confirmé par l'empreinte du contenu. L'empreinte se calcule d'une seule façon : `contentHash` de l'élément obtenu en relisant le texte écrit ou lu (lecture et migration), jamais de l'objet en mémoire (D-097).
- Avant d'écrire, l'outil vérifie que le fichier n'a pas changé depuis la version dont part l'éditeur : date et taille égales à celles de cette version, ou contenu relu dont l'empreinte est celle de cette version ou d'une version écrite par cette page. Une date ou une taille différente ne prouve jamais un conflit. Sinon, il propose les choix de 8.4 au lieu d'écraser (D-043, D-097). L'empreinte de départ est gardée par l'éditeur hors de la combinaison : elle change à l'ouverture, après chaque écriture réussie, à chaque rechargement et à chaque résolution de conflit ou de fichier retiré ; annuler, rétablir et glisser n'y touchent pas.
- Versions écrites par la page (D-098) : pour chaque combinaison et chaque modèle, la page garde les empreintes des 50 dernières versions qu'elle a écrites (HYPOTHÈSE) et une référence, la dernière version tenue pour courante (écrite par la page, ou lue depuis l'extérieur après). Un fichier relu dont le contenu est l'une de ces versions n'est jamais une modification extérieure : ni dialogue, ni rechargement, ni refus d'action sur un modèle. Si ce n'est pas la référence, la synchronisation est revenue en arrière : la référence est réécrite à l'identique dans le même fichier, sans toucher aux modifications en cours (pas si une copie de conflit porte le même identifiant, ni si le fichier a encore changé). Limite : une ancienne version remise volontairement à l'identique depuis l'autre PC (historique de Drive, import) est défaite tant que la page qui l'avait écrite est ouverte ; recharger la page avant.
- Sauvegarde automatique 2 s après la dernière modification, plus Ctrl+S. Jamais pendant un glisser : elle part à la fin du geste, ou à son annulation s'il restait des modifications non enregistrées ; Ctrl+S reste immédiat (D-099).
- Journal de synchronisation (D-100) : les 200 derniers événements, en mémoire seulement (relecture, écriture, vérification avant écriture, changement détecté, décision, retour en arrière corrigé, sauvegarde différée, refus sur un modèle), avec l'heure et la date du fichier en heure locale du PC (millisecondes comprises), le fichier, la taille, `updatedAt` tel qu'il est dans le fichier, une empreinte courte et l'origine retenue (« cette page » ou « extérieure »). Bouton discret « Copier le journal de synchronisation » dans les réglages de l'inspecteur ; rien n'est écrit dans le dossier.
- Écriture via `createWritable()` puis `close()` : l'écriture passe par un fichier temporaire (`.crswap`) et n'est validée qu'à la fermeture (vérifié en recette le 15/10/2026 sur le lecteur Drive : aucun `.crswap` résiduel).
- Renommer une combinaison renomme son fichier : écrire le nouveau, puis déplacer l'ancien en corbeille, toujours ; le renommage n'a lieu qu'à la validation du nom (D-005).

### 8.4 Conflits

- **Modification extérieure** : un contenu jamais écrit par cette page, différent de la version dont part l'éditeur (D-097, D-098). Une version écrite par la page n'en est jamais une, quoi que la synchronisation fasse ensuite de la date ou du contenu du fichier (8.3).
- **Modification extérieure sans modification locale en cours** : rechargement silencieux, notification discrète.
- **Modification extérieure avec modification locale non enregistrée** : choix « Garder la version du dossier », « Garder la mienne », « Garder les deux ». « Garder les deux » : ma version reçoit un nouvel `id` et le suffixe « (copie) » (D-022).
- **Deux fichiers portant le même `id`** (copie de conflit créée par la synchronisation, établi pour Drive pour ordinateur) : signalement dans la bibliothèque, choix « Garder les deux » (nouvel `id` pour l'une, nom suffixé « (copie) ») ou « Choisir celle-ci », qui déplace l'autre fichier en corbeille. Tant que le doublon n'est pas résolu, la combinaison est en lecture seule (D-022).
- **Import d'un `id` déjà présent** : « Remplacer » ou « Garder les deux », dates affichées. « Remplacer » déplace d'abord l'ancienne version en corbeille (D-022).

### 8.5 Suppression

- Jamais d'effacement définitif : déplacement dans `_corbeille/`, avec un horodatage en tête du nom : `AAAA-MM-JJ_HH-MM-SS--<nom d'origine>` (D-023). Le déplacement copie le fichier octet par octet, vérifie la copie, puis retire l'original (D-043) ; il sert aussi aux exports remplacés (D-065).

### 8.6 Mode dégradé (Firefox, ou aucun dossier choisi)

- Bibliothèque dans IndexedDB ; import et export manuels `.combi.json` et `.combipack.json`.
- Bandeau permanent, en surimpression du haut du terrain (D-050) : « Synchronisation par dossier disponible dans Chrome » (Firefox) ; dans Chrome sans dossier : « Aucun dossier choisi : la bibliothèque reste dans ce navigateur », avec un bouton « Choisir un dossier ». Au premier choix d'un dossier, l'outil propose d'y copier les combinaisons du navigateur (D-021).

### 8.7 Bibliothèque

- Deux onglets : « Combinaisons » et « Modèles » (modèles de placement, 10.1, D-096).
- Liste avec vignette (mode schéma du premier temps), nom, catégorie, date de modification.
- Recherche par nom ; filtre par catégorie ; tri par nom ou date.
- Dupliquer ; supprimer (corbeille, après confirmation) ; exporter en fichier ; importer.

### 8.8 Configuration Drive (côté utilisateur, documentée dans le README)

- Installer Google Drive pour ordinateur sur les deux PC.
- Choisir un dossier dans « Mon Drive », par exemple `Mon Drive/Rugby7`.
- Mode **miroir** recommandé : fichiers sur le disque et dans le cloud, disponibles hors connexion (établi). En mode **diffusion**, les fichiers ne sont en local qu'à l'usage (établi) : marquer alors le dossier « disponible hors connexion ». La File System Access API fonctionne sur le lecteur virtuel du mode diffusion (vérifié en recette le 15/10/2026, dossier `G:\Mon Drive\Rugby7` : choix, structure, écriture, sauvegarde automatique).
- Historique : Drive conserve les versions d'un fichier jusqu'à 30 jours ou 100 versions, sauf « Conserver indéfiniment » (établi).
- Bonne pratique : attendre la fin de la synchronisation avant de passer d'un PC à l'autre.

