# CLAUDE.md

Outil web personnel de préparation de combinaisons de rugby à 7 : éditeur sur PC (Chrome), animation, exports GIF et PDF. Un seul utilisateur, deux ordinateurs, données dans un dossier Google Drive.

## Mémoire du projet

Dans le dépôt, jamais seulement dans la conversation ni dans la mémoire automatique (locale à une machine). État courant :

@docs/ETAT.md

- Début de session : `git status` et `git log --oneline -5`, signaler tout écart avec ETAT. Reprise, ou après un compactage : `/reprise`.
- ETAT (environ 3 Ko, réécrit et non allongé) et la case du plan : à jour dans le commit de chaque étape (`/fin-etape`), et avant toute pause, tout compactage ou toute question.
- Décision : dès qu'elle est prise, dans le fichier du lot en cours de `docs/decisions/`, avec une ligne dans l'index. Jamais effacée : une décision remplacée reçoit une nouvelle entrée qui la cite, et change de statut. Si elle touche la SPEC sans la modifier : « non intégrée (x.y) » dans l'index.
- Une session par branche ; une session parallèle a sa branche et s'inscrit dans « Chantiers en parallèle » de ETAT.

## Lecture

- `docs/spec/`, source de vérité : l'index `docs/spec/README.md`, puis les seuls fichiers concernés ; jamais la SPEC entière, jamais importée ici.
- Une décision par son numéro : index `docs/decisions/README.md`, puis Grep `### D-0xx` avec `-A 12` ; jamais un journal entier.
- `docs/PIEGES.md` : la section du domaine avant d'y toucher.
- `docs/ARCHITECTURE.md`, `docs/RECETTE.md`, plan du lot (`docs/plans/`) : par section, à la demande. `docs/archive/` : jamais par défaut.

## Économie

- Au plus un sous-agent à la fois, seulement si une recherche ciblée ne suffit pas, mode plan compris.
- Pendant une étape, tests ciblés (`test:short`, `test:e2e:short`) ; suite complète en fin d'étape.
- Un bloc d'étapes par conversation ; push après chaque commit.

## Règles de travail

1. Un lot à la fois, dans l'ordre. Lot, correction ou changement de SPEC : mode plan (`/nouveau-lot`, `/correction-recette`, `/changement-spec`), et ma validation avant tout code. Étape d'un plan validé : sans mode plan ; dans un bloc, étape, `/fin-etape`, étape suivante (D-125).
2. Le plan contient : fichiers créés ou modifiés, étapes en blocs, dépendances ajoutées et leur justification, tests prévus, points de la SPEC jugés ambigus ou contradictoires.
3. Ambiguïté ou contradiction : s'arrêter et demander. Ne jamais trancher seul, ne jamais inventer une règle de rugby.
4. Ne jamais implémenter un élément d'un lot ultérieur, ni rendre son arrivée plus difficile (types déclarés, interfaces ouvertes).
5. Valeur provisoire : dans `src/config/defaults.ts`, avec un commentaire `HYPOTHÈSE` ou `SOURCE: <url>`.
6. Modèle de données modifié : incrément de `schemaVersion`, migration, fixture de l'ancienne version, test.
7. Moteur et rendu purs : ni `Date.now()`, ni `Math.random()`, ni état global. Le déterminisme est testé.
8. Rendu en aplats : ni dégradé, ni motif, ni flou d'ombre.
9. Dossier de l'utilisateur : jamais d'effacement définitif (supprimer = déplacer dans `_corbeille/`). Un fichier invalide n'est jamais modifié ni déplacé automatiquement.
10. Chaque fonctionnalité arrive avec ses tests. Pas de fusion si la CI est rouge.
11. Une branche par lot (`lot-4`, `lot-3bis-1`...), une PR vers `main`, déployé sur GitHub Pages.
12. Fin de lot : `/fin-lot`, lancé par moi. L'automatisable est testé ; au plus 5 vérifications manuelles, indispensables et impossibles à automatiser (`docs/RECETTE.md`) ; puis une séance d'usage libre, dont je te fais un retour (`/correction-recette`).

## Conventions

- TypeScript strict ; pas de `any` ; pas de `@ts-ignore` sans commentaire justifié.
- Code, identifiants et noms de fichiers sources en anglais. Commentaires en anglais, sauf les marqueurs `HYPOTHÈSE` et `SOURCE:` de `src/config/defaults.ts`.
- Textes d'interface en français, sans tiret cadratin. Messages de commit en français.
- Aucune logique métier dans les composants React : React affiche, Zustand porte l'état, `model/`, `engine/`, `io/` portent la logique.
- Unités : mètres, secondes, m/s.
- Réponds-moi toujours en français.

## Commandes npm

| Script | Rôle |
|---|---|
| `dev`, `build`, `preview` | Serveur de développement, build de production, prévisualisation |
| `lint`, `typecheck` | ESLint, `tsc --noEmit` |
| `test`, `test:e2e` | Vitest ; Playwright (Chromium et Firefox) |
| `check` | Lint, types et tests unitaires en parallèle ; n'affiche que les échecs |
| `test:short`, `test:e2e:short` | Vitest, Playwright en sortie concise ; filtres après `--` |
| `format` | Prettier |

## Glossaire (interface française, code anglais)

| Interface | Code |
|---|---|
| Combinaison | play |
| Temps | phase |
| Option | branch |
| Point d'option | branch point |
| Ligne (chemin racine-feuille) | line / branchPath |
| Consigne | instruction |
| Condition d'une option | condition |
| Course | run |
| Passe | pass |
| Jeu au pied | kick |
| Coup d'envoi / renvoi | restart |
| Regroupement | breakdown |
| Plaquée | tackled |
| Soutien | support |
| Relayeur | relayer |
| Plaqueur | tackler |
| Gratteur | jackal |
| Garde | guard |
| Balayeur | sweeper |
| Ligne d'avantage | gain line |
| Ligne de hors-jeu | offside line |
| Surnombre | overlap |
| Franchissement | line break |
| Modèle de placement | placement preset |
| Atelier | drill |
| Plot | cone |
| Coupelle | disc |
| Bouclier | shield |
| Sac de plaquage | tackle bag |
| Piquet | pole |
| Zone | zone |
| Calque | layer |
| Mode schéma | schematic |
| Corbeille | trash (`_corbeille/` sur disque) |
