# CLAUDE.md

Outil web personnel de préparation de combinaisons de rugby à 7 : éditeur sur PC (Chrome), animation, exports GIF et PDF. Un seul utilisateur, deux ordinateurs, données dans un dossier Google Drive.

## Documents de référence

- `docs/SPEC.md` : source de vérité (fonctionnel et technique, tous lots). À lire en entier avant chaque lot.
- `docs/RECETTE.md` : recette manuelle par lot.
- `docs/ARCHITECTURE.md` : architecture effective, tenue à jour à la fin de chaque lot.
- `docs/DECISIONS.md` : journal des décisions prises en cours de route (date, décision, raison).

## Mémoire du projet

La mémoire du projet vit dans le dépôt, jamais seulement dans la conversation ni dans la mémoire automatique (locale à une machine). État courant :

@docs/ETAT.md

- Au début de toute session et après tout compactage : relire `docs/ETAT.md`, le plan du lot en cours (`docs/plans/lot-N.md`), les dernières entrées de `docs/DECISIONS.md`, puis `git log -10` et `git status`. Signaler tout écart entre `ETAT.md` et l'état réel du dépôt avant de continuer.
- Mettre à jour `docs/ETAT.md` (60 lignes au plus, réécrit et non allongé) et le plan (case cochée avec le hash court du commit) dans le commit qui termine chaque étape, ainsi qu'avant toute pause, tout compactage ou toute question posée à l'utilisateur.
- Toute décision va dans `docs/DECISIONS.md` au moment où elle est prise : entrée numérotée (D-001...), date, décision, raison, alternatives écartées, origine. Aucune entrée n'est effacée ; une décision remplacée reçoit une nouvelle entrée qui cite l'ancienne.
- Une seule session active par branche. Une session parallèle travaille sur sa propre branche et s'inscrit dans la section « Chantiers en parallèle » de `docs/ETAT.md`.
- Ne jamais importer `docs/SPEC.md` dans ce fichier : la lire à la demande.

## Règles de travail

1. Un lot à la fois, dans l'ordre. Toujours commencer en mode plan ; attendre ma validation avant d'écrire du code.
2. Le plan contient : fichiers créés ou modifiés, étapes, dépendances ajoutées et leur justification, tests prévus, points de la spécification jugés ambigus ou contradictoires.
3. Ambiguïté ou contradiction : s'arrêter et demander. Ne jamais trancher seul, ne jamais inventer une règle de rugby.
4. Ne jamais implémenter un élément d'un lot ultérieur ; ne jamais rendre son arrivée plus difficile (types déclarés, interfaces ouvertes).
5. Toute valeur provisoire va dans `src/config/defaults.ts`, avec un commentaire `HYPOTHÈSE` ou `SOURCE: <url>`.
6. Toute modification du modèle de données : incrément de `schemaVersion`, migration, fixture de l'ancienne version, test.
7. Moteur et rendu purs : pas de `Date.now()`, pas de `Math.random()`, pas d'état global. Le déterminisme est testé.
8. Rendu en aplats uniquement : pas de dégradé, de motif ni de flou d'ombre.
9. Dossier de l'utilisateur : jamais d'effacement définitif. Supprimer = déplacer dans `_corbeille/`. Un fichier invalide n'est jamais modifié ni déplacé automatiquement.
10. Chaque fonctionnalité arrive avec ses tests. Pas de fusion si la CI est rouge.
11. Une branche par lot (`lot-1`, `lot-2`...), une PR vers `main`. `main` est déployé sur GitHub Pages.
12. Fin de lot : mettre à jour `docs/ARCHITECTURE.md` et `docs/DECISIONS.md`, exécuter la recette automatisable, me lister la recette manuelle restante (section du lot dans `docs/RECETTE.md`).

## Conventions

- TypeScript strict ; pas de `any` ; pas de `@ts-ignore` sans commentaire justifié.
- Code, identifiants et noms de fichiers sources en anglais. Commentaires en anglais, sauf les marqueurs `HYPOTHÈSE` et `SOURCE:` de `src/config/defaults.ts`.
- Textes d'interface en français, sans tiret cadratin. Messages de commit en français.
- Aucune logique métier dans les composants React : React affiche, Zustand porte l'état, `model/`, `engine/`, `io/` portent la logique.
- Unités : mètres, secondes, m/s.

## Commandes npm attendues

| Script | Rôle |
|---|---|
| `dev` | Serveur de développement |
| `build` | Build de production |
| `preview` | Prévisualisation du build |
| `lint` | ESLint |
| `typecheck` | `tsc --noEmit` |
| `test` | Vitest |
| `test:e2e` | Playwright (Chromium et Firefox) |
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
