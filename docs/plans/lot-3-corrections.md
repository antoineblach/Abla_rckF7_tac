# Plan de correction après recette du lot 3 : synchronisation et nouvelle combinaison depuis un modèle

Plan validé le 23 octobre 2026, avec trois réponses :
- **Q1 :** un retour en arrière fait réécrire la référence.
- **Q2 :** après l'abandon d'une nouvelle combinaison, la combinaison précédente est relue dans le dossier ou dans IndexedDB.
- **Q3 :** pas d'observation notée ; le journal tranchera.

Compléments demandés : une seule façon de calculer l'empreinte, limite de D-098 élargie, heures du journal en heure locale.
Suivi : une case par étape, cochée dans le commit qui termine l'étape, avec le hash court de ce commit (ou du commit précédent quand le hash du commit lui-même ne peut pas y figurer). L'état courant détaillé est dans `docs/ETAT.md`.

Branche `lot-3-corrections` depuis `main` (`f1f4fcc`), une PR vers `main`.

## Contexte

Pendant la séance d'usage du lot 3, sur un seul PC (Drive pour ordinateur en mode diffusion), le dialogue « Version plus récente dans le dossier » apparaît très souvent. Attendu (SPEC 8.4) : seulement si une autre instance de l'outil a modifié le fichier pendant des modifications non enregistrées. Une version écrite par la page n'est jamais une modification extérieure.

S'y ajoutent :
- la révision de D-096 : une nouvelle combinaison depuis un modèle n'est enregistrée qu'à la validation de la pose ;
- `docs/PASSATION.md`, commité tel quel.

**Écarts constatés à la reprise** (corrigés à l'étape 0) :
- `ETAT.md` indiquait la PR #4 ouverte, alors qu'elle est fusionnée (`f1f4fcc`).
- Les références locales `origin/lot-1`, `origin/lot-1-corrections`, `origin/lot-2` et `origin/lot-3` étaient périmées (`git fetch --prune`).
- `docs/PASSATION.md` n'était pas suivi.

## Causes, établies par la lecture du code

**Cause 1 : la concurrence se confirme par l'`updatedAt` de la combinaison en mémoire.**
- Quand la date et la taille diffèrent du jeton, `FileCollection.checkUnchanged` (`src/io/collection.ts`) relit le fichier et ne l'accepte que si `updatedAt` est égal.
- Or annuler et rétablir (`src/editor/history.ts`, instantanés complets) rendent un ancien `updatedAt`.
- Un glisser aussi : `markSaved` ne met pas à jour `gestureStart`, dont `previewGesture` repart.
- Dès que Drive change la date (hypothèse 3), notre propre version passe pour un conflit, et le dialogue affiche la date d'une de mes sauvegardes.
- En mode navigateur, `IdbStore.write` compare les `updatedAt` sans raccourci par la date : annuler au-delà d'une sauvegarde déclenche le dialogue, même sans Drive.

**Cause 2 : la sauvegarde automatique peut partir pendant un glisser.**
- Le minuteur, armé par la modification précédente, écrit l'état intermédiaire du geste.

**Hypothèse 3 (Drive change la date sans changer le contenu).**
- Seule, elle reste sans effet (l'empreinte du contenu est identique).
- Combinée à la cause 1, elle déclenche le dialogue.

**Hypothèse 4 (Drive restitue brièvement une version antérieure).**
- `decideExternalChange` compare les `updatedAt`.
- Sans modification en cours : rechargement silencieux en arrière.
- Avec une modification en cours : dialogue.
- Pour un modèle : refus « changé ailleurs ».

Aucun changement de format de fichier : `schemaVersion` inchangé.

## Correction

### A. Base de concurrence : l'empreinte du contenu, hors de `Play`

- `VersionToken` devient `{ lastModified, size, contentHash }`. Il n'est jamais écrit sur disque.
- **L'empreinte se calcule d'une seule façon partout :** `contentHash` de l'élément obtenu en relisant le texte écrit ou lu (lecture et migration), jamais de l'objet en mémoire avant sérialisation. Cette règle vaut à l'écriture, à la relecture, dans `checkUnchanged` et dans le jeton de l'éditeur.
- `EditorState.version` (hors de `Play`) est la base de concurrence. Il est mis à jour à l'ouverture, après chaque écriture réussie, à chaque rechargement, à chaque résolution de conflit ou de fichier retiré. Annuler, rétablir et les glissers n'y touchent pas.
- **`checkUnchanged` :**
  - date et taille égales au jeton : raccourci, l'écriture est acceptée ;
  - sinon, le fichier est relu. L'écriture est acceptée si son empreinte est égale à celle de la base ou à une écriture de la page (B) ;
  - sinon, `ConflictError`.
  - Une date ou une taille différente ne prouve jamais un conflit.
- `IdbStore.write` relit l'entrée avant d'écrire et applique la même règle.
- `updatedAt` reste écrit à chaque sauvegarde (affichage, cahier de jeu), sans rôle dans la concurrence.

### B. Écritures de la page et retour en arrière de Drive

- **`src/io/ownWrites.ts` :** registre par collection et par identifiant.
  - `hashes` : les dernières empreintes écrites par la page, au plus `OWN_WRITES_KEPT = 50` (`HYPOTHÈSE`).
  - `reference` : `{ hash, text, fileName }`, la dernière version tenue pour courante, écrite par la page ou lue depuis l'extérieur (Q1).
- **`FileCollection.write`** enregistre chaque écriture : sauvegarde, import, « Garder les deux », copie depuis le navigateur, modèles.
- **`FileCollection.scan` :**
  - **Version écrite par la page, autre que la référence** (retour en arrière) : la référence est réécrite à l'identique dans le même fichier, aucun changement n'est signalé, l'événement va au journal.
    - Garde-fous : même nom de fichier, pas de copie de conflit pour cet identifiant, fichier relu une seconde fois juste avant d'écrire.
  - **Contenu jamais écrit par la page :** modification extérieure, traitement inchangé ; il devient la référence.
- `LibraryStore.isOwnWrite(collection, id, hash)` est ajoutée.
- **Limite documentée :** quand la page qui avait écrit une version est encore ouverte, toute remise volontaire de cette version à l'identique depuis l'autre PC est défaite. Cela vaut pour une restauration par l'historique de Drive comme pour un import qui rendrait à l'identique une version écrite par cette page.

### C. Décision sur la combinaison ouverte

`decideExternalChange({ baseHash, dirty }, { hash, own })` :
- version de la page, ou empreinte égale à la base : `ignore` ;
- sinon, modification en cours : `ask` ; aucune : `reload`.

### D. Aucune sauvegarde automatique pendant un glisser

- Si le minuteur tombe pendant un geste, la sauvegarde est différée et consignée.
- `SyncController.gestureEnded()` la lance dès que `gestureStart` repasse à `null` : fin du geste, Échap, rechargement. Elle ne part que s'il reste des modifications non enregistrées.
- Ctrl+S reste immédiat.

### E. Modèles de placement

- `fresh()` ne refuse une action que si l'empreinte diffère de celle lue **et** n'est pas une écriture de la page.
- « Mettre à jour » écrit avec le jeton (et son empreinte) lu à l'ouverture du dialogue.

### F. Journal de synchronisation

- **`src/io/syncLog.ts` :** les 200 derniers événements (`SYNC_LOG_SIZE`).
  - Un journal par page, créé par `session.ts`, passé aux magasins et à `SyncController`.
- **Événements :** relecture, écriture, vérification avant écriture, changement détecté, décision, retour en arrière corrigé, sauvegarde différée, refus sur un modèle. À l'ouverture du dossier : une ligne de synthèse.
- **Champs :** heure de l'événement et date de modification du fichier en heure locale du PC, avec les millisecondes ; événement, collection, fichier, taille ; `updatedAt` tel qu'il est dans le fichier ; empreinte courte (8 caractères) ; origine retenue (« cette page » ou « extérieure ») ; détail.
- **Interface :** bouton discret « Copier le journal de synchronisation » en bas de la section « Réglages » de l'inspecteur. Il copie le journal dans le presse-papiers ; rien n'est écrit dans le dossier.

### G. D-096 révisée : nouvelle combinaison depuis un modèle

- `createPlayFromPreset` enregistre la combinaison ouverte, puis ouvre la nouvelle sans l'écrire, avec `EditorState.pendingCreation = { previousId }`.
- Tant que la pose n'est pas validée :
  - aucune écriture (Ctrl+S compris) ;
  - aucun brouillon.
- **Validation de l'ancre :** une étape d'annulation, puis enregistrement immédiat.
- **Toute autre fin de pose** (Échap, « Annuler », changement d'outil, autre pose) :
  - la nouvelle combinaison est abandonnée ;
  - la combinaison précédente est relue dans le dossier ou dans IndexedDB et rouverte comme depuis la bibliothèque (Q2). Si elle n'existe plus : état vide.
- Une seule fonction de `editorStore` traite la fin d'une pose.
- Inchangé : toute pose affiche le temps 1 ; un modèle en lecture seule peut être appliqué, pas modifié.

## Fichiers

`src/io/` (`LibraryStore`, `collection`, `ownWrites`, `syncLog`, `FolderStore`, `IdbStore`, `conflicts`, `sync`), `src/state/` (`editorStore`, `editorActions`, `session`, `presetSession`), `src/ui/` (`inspector/Inspector.tsx`, `field/PlacementBanner.tsx`, `strings.ts`, `global.css`), `src/config/defaults.ts`, `src/test/driveSim.ts`. Aucune dépendance ajoutée.

## Tests

Chaque test marqué « échoue avant » est exécuté sur le code non corrigé avant sa correction. Le résultat est noté à l'étape.

**Combinaisons** (`src/state/syncSession.test.ts`)

| Test | Avant correction |
|---|---|
| Annuler après une sauvegarde, date changée par Drive, sauvegarde : aucun conflit | échoue |
| Glisser commencé avant une sauvegarde, date changée, sauvegarde : aucun conflit | échoue |
| Date seule changée : ni dialogue ni rechargement | garde-fou |
| Retour à une version de la page, sans puis avec une modification en cours : ni dialogue ni rechargement, dernière version réécrite | échoue |
| Retour en arrière constaté seulement à l'écriture : écriture acceptée | échoue |
| Vraie modification extérieure : rechargement silencieux, ou dialogue s'il y a une modification en cours | garde-fou |
| Glisser plus long que le délai de sauvegarde : aucune écriture avant la fin du geste | échoue |
| Mode navigateur : annuler au-delà d'une sauvegarde, puis sauvegarder : aucun conflit | échoue |

**Stockage** : `checkUnchanged` (raccourci, empreinte, version de la page, conflit) ; retour en arrière et ses garde-fous ; registre ; `decideExternalChange` ; journal (taille, champs, heures locales).

**Empreinte unique** : pour les fixtures v1 et v2 et une combinaison aux coordonnées non entières, l'empreinte enregistrée à l'écriture est égale à celle de la relecture du fichier.

**Modèles** (`state/presetSession.test.ts`, `io/presets.test.ts`) :

| Test | Avant correction |
|---|---|
| Retour à une version de la page, puis action : aucun refus | échoue |
| « Mettre à jour » après une date changée | garde-fou |
| « Mettre à jour » après un retour en arrière | échoue |
| Liste en retard sur une écriture de la page : aucun refus | échoue |
| Vraie modification extérieure : refus | garde-fou |

**D-096 révisée** : rien n'est écrit avant l'ancre ; l'ancre validée écrit aussitôt ; Échap, « Annuler » et un changement d'outil ne laissent rien, et la précédente est relue (y compris quand elle a changé ailleurs ou n'existe plus).

**Bout en bout Chromium** :
- `e2e/sync-own-writes.chromium.spec.ts` : édition, glissers, annulations et sauvegardes enchaînées, fichier réécrit à l'identique puis remis à une version antérieure de la page entre deux relectures. Aucun dialogue ni rechargement ; le journal copié contient le retour en arrière.
- `placement.chromium.spec.ts` : nouvelle combinaison depuis un modèle, puis Échap : `combinaisons/` inchangé.

## Étapes et commits

### [x] Étape 0 : mémoire (`dc6fcac`)
Branche, `git fetch --prune`, `docs/PASSATION.md` tel quel, `ETAT.md` corrigé, ce plan, D-097 à D-101.

### [x] Étape 1 : base par empreinte, écritures de la page, journal (io) (`b772508`)
A, B, F (partie io), `driveSim.ts` ; tests « Stockage », « Empreinte unique », combinaisons (causes 1, 3, 4) et mode navigateur.

**Résultat sur le code de `main`** (arbre de travail temporaire, `src/state/syncSession.test.ts` copié) : 7 tests échouent sur 11, comme prévu.
- Annuler puis date touchée : conflit.
- Glisser commencé avant une sauvegarde, puis date touchée : conflit.
- Retour en arrière sans modification en cours : rechargement en arrière.
- Retour en arrière avec une modification en cours : conflit.
- Retour en arrière vu seulement à l'écriture : conflit.
- Retour en arrière après une version de l'autre PC : second rechargement, en arrière.
- Mode navigateur, annuler au-delà d'une sauvegarde : conflit.

Les 4 garde-fous passent : date seule changée, vraie modification extérieure (rechargement, dialogue, conflit après une annulation).

**Après correction :** 467 tests unitaires verts.

### [x] Étape 2 : décision sur la combinaison ouverte et glisser (`57e843d`)
C, D, `session.ts` ; tests de la cause 2.

- `decideExternalChange` décide par l'empreinte et l'origine ; chaque décision va au journal.
- Nouveau `state/syncBridge.ts` (`openPlayForSync`, `onGestureEnd`), partagé par la session et les tests.
- **Résultat sur le code de `main`** (même test, câblé comme sur `main`) : les 2 tests du glisser échouent, avec une écriture pendant le geste (3 écritures au lieu de 2).
- **Après correction :** 470 tests unitaires verts.

### [x] Étape 3 : modèles (`c807c98`)
E ; tests « Modèles ».

- `fresh()` ne refuse plus une version écrite par la page ; chaque refus est consigné au journal.
- **Résultat sur le code de `main`** : 4 tests échouent comme prévu.
  - « Modèle changé ailleurs » après un retour en arrière (dupliquer).
  - « Mettre à jour » après un retour en arrière.
  - Liste en retard sur une écriture de la page.
  - Changement signalé au lieu de la réécriture dans `modeles/`.
- Le garde-fou « Mettre à jour » après une date changée passe.
- **Après correction :** 475 tests unitaires verts.

### [x] Étape 4 : D-096 révisée (`d18d676`)
G ; tests unitaires et e2e de la pose.

- **`editorStore` :**
  - `pendingCreation`, `openPendingPlay`, `setCreationListeners` ;
  - `placementDropsCreation` : `setTool`, `setPlacement(null)` et `startPlacement` abandonnent la nouvelle combinaison ;
  - `validateCreation` et `creationValidated` sur l'ancre validée.
- **`OpenPlay.awaitingPlacement`** bloque les écritures ; aucun brouillon.
- **`presetSession.reopenPrevious`** relit le dossier, puis rouvre la précédente.
- **Résultat sur le code de `main`** : l'e2e `placement.chromium` échoue (après Échap, l'éditeur reste sur « Nouvelle combinaison », le fichier vide est écrit).
- **Après correction :** 481 tests unitaires verts ; `placement.chromium` vert.

### [x] Étape 5 : bouton du journal et bout en bout (`5740327`)
F (interface) ; `sync-own-writes.chromium.spec.ts`.

- Bouton `inspector__discreet` en bas de « Réglages », `session.copySyncLog` (presse-papiers, notification).
- **Résultat sur le code de `main`** : l'e2e échoue à la sauvegarde qui suit deux annulations et une date touchée (« Modifications en cours » : écriture refusée, dialogue).
- **Après correction :** l'e2e est vert ; le journal copié contient « retour en arrière » et « sauvegarde différée », et aucune « écriture refusée ».

### [x] Étape 6 : documents et clôture (`1bf85cd` ; PR #5)

Fait : SPEC 1.5 (6.6, 8.1, 8.3, 8.4, 10.1, 14, 16) ; ARCHITECTURE ; RECETTE (section « Lot 3 : correction après recette ») ; README (synchronisation, journal, nouvelle combinaison depuis un modèle, restauration par l'historique de Drive) ; ETAT.
Recette automatisable verte : format, lint, typecheck, 481 tests unitaires, 33 tests de bout en bout (Chromium et Firefox), build.

Prévu :
- **SPEC 1.5 :**
  - 8.3 : empreinte du contenu, écritures de la page, retour en arrière, pas de sauvegarde automatique pendant un glisser, journal ;
  - 8.4 : modification extérieure = contenu jamais écrit par la page ;
  - 6.6 et 10.1 : enregistrement à la validation de la pose ;
  - 16 : entrée 19.
- ARCHITECTURE, RECETTE (section de la correction, au plus 2 vérifications manuelles), ETAT.
- Recette automatisable : lint, typecheck, format, tests unitaires, e2e, build.
- PR.

## Décisions à consigner

| Entrée | Décision |
|---|---|
| D-097 | Base de concurrence : empreinte du contenu relu, hors de `Play`. Remplace la confirmation par `updatedAt` de D-043. |
| D-098 | Écritures de la page, référence, retour en arrière réécrit à l'identique, limite. |
| D-099 | Aucune sauvegarde automatique pendant un glisser. |
| D-100 | Journal de synchronisation. |
| D-101 | Révise D-096 : nouvelle combinaison depuis un modèle enregistrée à la validation de la pose, la précédente relue à l'abandon. |

## Vérifications manuelles prévues

1. 15 minutes d'édition sur un PC en mode diffusion : aucun dialogue. Sinon, copier le journal.
2. Vraie modification sur l'autre PC : rechargement silencieux, ou dialogue s'il y a une modification en cours.
