# Passation architecte : outil combinaisons rugby à 7

État au vendredi 16/10/2026, 14 h 50 (heure de Guyane). Rédigé depuis l'historique complet de la conversation de conception, pour la reprendre dans une nouvelle conversation sans perte.

Ce document complète le dépôt ; il ne le remplace pas. En cas d'écart, le dépôt fait foi (`docs/ETAT.md`, `docs/DECISIONS.md`, `docs/SPEC.md`).

---

## 1. Rôle de Claude dans ce projet

- **Architecte et rédacteur des prompts pour Claude Code.** Claude ne code pas, sauf demande explicite d'Antoine.
- **Guidage étape par étape**, une étape à la fois, numérotées. Dernière étape donnée : **étape 32**. La suivante sera l'étape 33.
- **Cycle habituel** : Antoine colle le plan ou le rapport de Claude Code ; Claude le relit, relève les écarts avec la spécification et les choix de coach, puis donne le message exact à envoyer (souvent un message mis en file d'attente, avec une réponse par question Q1, Q2...).
- **Développement d'abord** (demande d'Antoine) : pas de listes de tests cosmétiques. Quand un essai est utile, Claude le dit ; Antoine s'en sert comme en vrai et fait un retour brut. Une liste de vérifications seulement si c'est primordial.
- **Forme des réponses** : français ; aucun tiret cadratin ; concis sur les explications, exhaustif sur les livrables ; séparer l'établi de l'hypothèse ; questions seulement si elles conditionnent la réponse ; pas de proposition d'aller plus loin en fin de message ; signaler les anglicismes.

## 2. Environnement (établi)

| Élément | Valeur |
|---|---|
| PC de développement | Windows, dépôt `C:\Dev\Abla_rckF7_tac`, VS Code avec l'extension Claude Code, terminal PowerShell intégré |
| Outils | git 2.52, Node 24.15, GitHub CLI authentifié, Claude Code dans `%USERPROFILE%\.local\bin` (ajouté au PATH utilisateur) |
| Second PC | Pas d'environnement de développement : Chrome et le site en ligne suffisent. Si Claude Code y est lancé un jour : `git pull` d'abord |
| Dépôt | `antoineblach/Abla_rckF7_tac`, public |
| Site | https://antoineblach.github.io/Abla_rckF7_tac/ (GitHub Pages, déploiement par Actions à chaque fusion sur `main`) |
| Protection de `main` | Statut « checks » obligatoire, administrateurs inclus, sans revue (D-055). Plus aucun push direct : tout passe par une PR |
| Données | Google Drive pour ordinateur en **mode diffusion**, dossier `G:\Mon Drive\Rugby7` |
| Accès au dossier | Chrome, « Autoriser à chaque visite » : autorisation persistante vérifiée |
| Téléphone | App Google Drive pour récupérer GIF et PDF ; diffusion aux joueuses par WhatsApp |

## 3. Mémoire du projet dans le dépôt

| Fichier | Rôle |
|---|---|
| `CLAUDE.md` | Règles de travail, conventions, glossaire français / anglais, procédure de reprise, « Réponds-moi toujours en français. », importe `@docs/ETAT.md` |
| `docs/ETAT.md` | État courant, mis à jour à chaque commit. Environ 60 lignes, limite indicative : ne rien supprimer de nécessaire |
| `docs/plans/lot-N.md` | Plan validé de chaque lot |
| `docs/DECISIONS.md` | Journal des décisions, D-001 à D-096 à ce jour |
| `docs/SPEC.md` | Spécification, version 1.4 (écrite par Claude en v1.0, tenue à jour par Claude Code) |
| `docs/ARCHITECTURE.md` | Architecture effective |
| `docs/RECETTE.md` | Recette par lot. Règle D-054 : au plus 5 vérifications manuelles par lot, plus une séance d'usage libre |
| `docs/PROMPTS.md` | Prompts des lots 1 à 5 et prompts utilitaires : « Reprise », « Correction après recette », « Changement de spécification » |

Les valeurs provisoires du code sont dans `src/config/defaults.ts`, marquées `HYPOTHÈSE` ou `SOURCE: <url>`.

## 4. Méthode avec Claude Code (établie à l'usage)

**Nouveau lot**
1. Nouvelle conversation Claude Code, mode **Plan** : `Lis docs/PROMPTS.md et exécute le prompt « Lot N : <titre> ».`
2. Antoine envoie le plan à Claude pour relecture.
3. Approbation du plan en mode **Auto**, puis message en file d'attente avec les réponses Q par Q, terminé par : `Enchaîne les étapes sans m'attendre ; ne t'arrête que sur une question bloquante.`
4. Claude Code fait un commit par étape et met `ETAT.md` à jour à chaque commit, puis ouvre une PR.

**Fusion**
```powershell
gh pr checks N --watch
gh pr merge N --merge --delete-branch
```
Puis Ctrl+F5 sur le site, sur les deux PC (une page restée sur l'ancienne version peut refuser les fichiers d'un format plus récent).

**Interruption par la limite d'usage**
- Ne pas relancer l'ancienne conversation : elle relirait environ 400 000 à 450 000 tokens.
- Constater l'état réel avant de reprendre : `git log`, `git status`, dates des fichiers modifiés après le dernier commit. Claude peut le faire lui-même si la conversation est liée au PC (lecture de `.git/HEAD`, `.git/logs/HEAD`, `docs/ETAT.md`).
- Nouvelle conversation en mode **Auto** (le plan est déjà validé), avec ce modèle :
```
Reprise du lot N après une interruption (limite d'usage atteinte <pendant l'étape X / juste après le commit de l'étape X, <hash>>).
Applique la procédure de reprise de CLAUDE.md (ETAT.md, docs/plans/lot-N.md, dernières entrées de DECISIONS.md, git log, git status, git diff).
Ne jette rien de ce qui n'est pas commité : compare-le au plan, complète, fais passer lint, typecheck et tests, puis commite.
Enchaîne ensuite les étapes restantes sans m'attendre, selon le plan validé et les décisions D-xxx à D-yyy. Ne t'arrête que sur une question bloquante.
```
- Le fichier `msg.txt` du scratchpad de Claude Code est le message du commit en préparation : rien à récupérer.

## 5. Historique

| PR | Contenu | Statut au 16/10, 14 h 50 |
|---|---|---|
| #1 | Lot 1 : socle (éditeur, lecteur, stockage Drive, déploiement) | Fusionnée ; recette validée le 15/10 |
| #2 | Correction : terrain stable (vue {centre, échelle} conservée, touche F « Ajuster », bouton « Zone utile », seuil de glisser de 4 px, section Combinaison en tête de l'inspecteur) | Fusionnée |
| #3 | Lot 2 : exports GIF et PDF (D-057 à D-077, SPEC 1.3) | Fusionnée |
| #4 | Lot 3 : mise en place (D-078 à D-096, SPEC 1.4). Commits `f44ee27` (étape 6), `a5fe836` (étape 7), `119b9cd` (étape 8) | **CI verte, à fusionner par Antoine** |

Tests au dernier rapport : 438 tests unitaires, 32 tests de bout en bout (Chromium et Firefox), aucun désactivé.

## 6. Choix de coach et arbitrages à garder en tête

Ils sont consignés dans `docs/DECISIONS.md` ; rappel des plus structurants.

**Rugby**
- Ruck, côté attaque : plaquée (qui avait le ballon), soutien, relayeur. Côté défense : plaqueur, puis gratteur ou garde.
- Défense au choix : 6+1 ou 7 en ligne. Principe « chacun le sien », plus les joueuses consommées dans ruck, maul ou mêlée, et celles qui protègent les abords du ruck.
- Durée de ruck par défaut : environ 3 s, modifiable.
- Terrain réduit : seul l'écart entre les lignes diminue (Règle 1), les autres dimensions ne sont pas réduites en proportion.
- Équipe féminine ; staff de 3 ; Antoine seul utilisateur de l'outil.

**Lot 2 (exports)**
- PDF vectoriel.
- GIF : passage ralenti complet, puis passage complet à vitesse réelle ; dernière image de chaque option tenue 1 s ; pause finale de 2 s.
- Thème PDF « Impression couleur » : fond clair, lignes du terrain grises, couleurs d'équipe conservées. « Noir et blanc » = Impression N&B.
- Date du cahier de jeu : la plus récente des dates de modification des combinaisons incluses.
- Réglage pour désactiver l'optimisation des pixels inchangés des GIF (transparence), au cas où la conversion de WhatsApp la rendrait mal.
- Version allégée d'un GIF : suffixe `-allege`, proposée au-delà de 8 Mo.

**Lot 3 (mise en place)**
- Q1 : seulement « contest ».
- Q2 : le soutien s'arrête là où sa course est dessinée ; l'outil n'invente pas de position.
- Q3 : le relayeur rejoint en ligne droite, au sprint, une position à 1 m derrière le ballon.
- Q5 : le maul reste immobile, comme un ruck.
- Q10 : alerte d'en-avant dans l'éditeur et le lecteur.
- Q11 : l'alerte d'en-avant n'apparaît **jamais** dans les exports (exception à D-068) : aide pour le coach, pas information pour les joueuses.
- Q16 : « Retourner » = symétrie gauche-droite, sens d'attaque inchangé.
- Q19 : raccourcis J (jeu au pied) et G (regroupement), en plus des boutons.

## 7. Prochaines actions, dans l'ordre

1. **Antoine** : fusionner la PR #4 (`gh pr merge 4 --merge --delete-branch`), puis Ctrl+F5 sur les deux PC.
2. **Antoine** : séance d'usage de 30 à 45 minutes, comme pour préparer un entraînement :
   - 2 ou 3 combinaisons réelles : une sur mêlée ou touche à partir d'un modèle enregistré, une avec un ruck, une sur coup d'envoi ;
   - le GIF de l'une d'elles envoyé sur WhatsApp ;
   - notes en vrac, sans tri.
3. **Claude** : transformer les notes brutes en demande de correction, à partir du prompt « Correction après recette » de `docs/PROMPTS.md`, en ajoutant la correction déjà notée :
   - **D-096 à revoir** : une nouvelle combinaison créée depuis un modèle est enregistrée tout de suite ; Échap laisse alors une combinaison vide dans la bibliothèque. Attendu : ne la créer qu'une fois la pose validée.
   - Les deux autres choix de D-096 sont acceptés : toute pose affiche le temps 1 ; un modèle peut être appliqué en lecture seule (copie de conflit non résolue) sans pouvoir être modifié.
4. **En parallèle, en option** : plan du lot 4 dans une nouvelle conversation Claude Code en mode Plan :
   ```
   Lis docs/PROMPTS.md et exécute le prompt « Lot 4 : défense simulée ». Prépare seulement le plan : l'implémentation ne commencera qu'après une correction issue de ma séance d'usage.
   ```
   Le plan est relu par Claude, puis validé une fois les corrections fusionnées.
5. **Lot 4 : défense simulée** : 6+1 ou 7 en ligne, « chacun le sien », plaqueur puis garde ou gratteur au ruck, lignes de hors-jeu en mêlée et en touche, aucune en jeu courant, simulation désactivée au coup d'envoi, glissement, surnombre et franchissement signalés, « Figer » une défenseure pour obtenir des courses éditables, défense identique dans le lecteur, le GIF et le PDF.
6. **Lot 5 : ateliers** : plots, coupelles, boucliers, sacs de plaquage, piquets, zones cotées, annotations, course groupée.

## 8. Vérifications terrain encore ouvertes

| Vérification | Statut |
|---|---|
| Combinaison créée sur un PC, visible et identique sur l'autre après synchronisation Drive | Pas encore fait |
| Rechargement au retour sur la fenêtre après modification sur l'autre PC | Pas encore fait |
| Conflit Drive réel (synchro en pause, modification des deux côtés), « Garder les deux » | Pas encore fait |
| Modèle enregistré sur un PC, visible et applicable sur l'autre | Pas encore fait |
| GIF sur WhatsApp, avec et sans « Alléger le fichier » : boucle ou vidéo à lancer, netteté, lisibilité en plein soleil | Pas encore fait |
| PDF N&B sur la laser : équipes (plein / creux), passes, courses et jeu au pied (tirets longs) distinguables | Pas encore fait |
| Cahier de jeu ouvert sur le téléphone : sommaire cliquable, lecture en défilant | Pas encore fait |

## 9. Faits vérifiés et hypothèses

**Établi**
- Chrome 122 et suivants : « Autoriser à chaque visite » rend l'accès au dossier persistant ; vérifié sur le PC de développement.
- File System Access sur le lecteur virtuel Drive en mode diffusion : création de la structure et écriture des combinaisons vérifiées le 15/10 (hypothèses 8.3 et 8.8 de la spécification) ; aucun fichier `.crswap` résiduel.
- Claude Code : `CLAUDE.md` est relu après `/compact` ; les imports `@fichier` fonctionnent ; la mémoire automatique de Claude Code est locale à la machine, d'où le choix de tout porter dans le dépôt.
- TypeScript 6.0 et non 7 : typescript-eslint ne prend pas encore en charge TypeScript 7 (D-031).

**Hypothèses non vérifiées**
- WhatsApp ré-encode les GIF en MP4. Le seuil de 3,5 Mo au-delà duquel le fichier devient une vidéo à lancer n'est documenté que pour WhatsApp Business ; le comportement de l'application grand public est à constater.
- Conflits Drive en mode diffusion : la détection des copies de conflit n'a pas encore été observée en conditions réelles.

## 10. Livrables rédigés par Claude

- `CLAUDE.md`, `docs/SPEC.md` (v1.0), `docs/RECETTE.md`, `docs/PROMPTS.md` : tous dans le dépôt ; les versions du dépôt font foi.
- Présentation récapitulative « Outil combinaisons rugby à 7 » (2 diapositives, 16/10) : ce que l'outil sait faire, ce qui vient ensuite.
