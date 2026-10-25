# Plan : réorganisation de la documentation et des outils de travail (`docs-outils`)

Validé le 25 octobre 2026, avec les réponses Q1 à Q4 et 7 compléments de l'utilisateur, intégrés ci-dessous. Décisions : D-122 à D-128. Branche `docs-outils` depuis `main` à `ba76d6c`.

Ce plan doit se suffire : chaque bloc est lancé dans une nouvelle conversation par « Exécute le bloc n de docs/plans/docs-outils.md ».

## Contexte

Deux préparations de plan ont été coupées par la limite d'usage. Sur 7 jours :
- 92 % de la consommation vient de conversations trop longues ;
- 30 % vient des sous-agents ;
- 10 % vient de SPEC.md lue en entier (94 696 o, environ 33 000 tokens, deux fois) ;
- DECISIONS.md (98 617 o) a été lu jusqu'à 19 000 tokens.

Objectif : qu'une nouvelle conversation démarre avec le minimum à lire, et que chaque lecture soit ciblée.

Aucun changement de comportement de l'application. Aucun fichier de `src/` n'est modifié (les références « SPEC section 14 » du code restent justes, voir Q1). La CI reste inchangée et doit rester verte.

## Règles d'exécution

- **Blocs.** Un bloc par conversation. Dans un bloc, enchaîner les étapes sans validation intermédiaire. Pour chaque étape, appliquer la procédure de fin d'étape :
  - lancer les tests si l'étape touche autre chose que des documents ;
  - mettre à jour ETAT ;
  - cocher la case de l'étape ;
  - commit en français ;
  - `git push`.
- **Fin de bloc.** S'arrêter sur « Bloc n terminé, commité et poussé. » et indiquer la commande suivante :
  - « Exécute le bloc n+1 de docs/plans/docs-outils.md » tant que les skills n'existent pas ;
  - « /clear puis /reprise » après le bloc 3.
- **Case du plan.** Elle est cochée dans le commit de l'étape, sous la forme « (commit « titre », après `hash du commit précédent` ) ». C'est la convention du lot 3 bis : un commit ne peut pas contenir son propre hash.
- **Scripts (complément 4).** Les découpages, les index et les remplacements de chemins se font par des scripts Node écrits dans l'espace temporaire de la session (le scratchpad), jamais dans le dépôt. Ne jamais lire un contenu pour le réécrire dans la conversation. Ne lire que les sorties de contrôle, et le diff de la section 14.
- **CLAUDE.md suit les déplacements (complément 3).** Chaque étape met à jour, dans CLAUDE.md, les chemins de ce qu'elle déplace. Une reprise à n'importe quelle étape lit ainsi des chemins valides. La réécriture complète a lieu à l'étape 5.
- **Sous-agents.** Au plus un à la fois, seulement si une recherche ciblée ne suffit pas.

## Questions et réponses

- **Q1, section 14 : accord.** La section 14 devient un renvoi à `src/config/defaults.ts`, qui fait foi. Elle garde un tableau restreint aux lignes absentes de `defaults.ts` :
  - les 9 lignes « Défense » du lot 4 : montée et accélération, tolérance de ligne, profondeur d'alignement, épaule intérieure, réintégration, balayeur, garde, contact et franchissement, anticipation de poursuite ;
  - la palette des GIF (255 couleurs), avec son emplacement : `GIF_MAX_COLORS`, `src/export/gif/encode.ts`.

  Les valeurs fixées par l'utilisateur (regroupement 3 s, journal 200, maintien 1 s, préférences d'export) restent sans marqueur. Leur commentaire donne la justification (D-126).
- **Q2, section 16 : accord.** Une seule entrée, D-122, reprend les points 1 à 14 recopiés à l'identique et numérotés. Les points 15 à 21 (renvois vers des plages D-xxx) sont retirés. Quand un point change, D-122 passe à « remplacée en partie par D-xxx ». La partie 3bis-3 (positions préréglées) remplacera le point 9.
- **Q3, lot 3 bis : accord.** Le lot 3 bis reste le lot en cours. Sa suite tient en trois PR (D-128) :

  | Identifiant | Sujet | Plan | Branche |
  |---|---|---|---|
  | 3bis-1 | mouvement | `docs/plans/lot-3bis-1.md` | `lot-3bis-1` |
  | 3bis-2 | interactions | `docs/plans/lot-3bis-2.md` | `lot-3bis-2` |
  | 3bis-3 | positions préréglées | `docs/plans/lot-3bis-3.md` | `lot-3bis-3` |

  - Les décisions de ces trois parties vont dans `docs/decisions/lot-3bis.md`.
  - `docs/plans/lot-3bis.md` reste dans `docs/plans/` jusqu'au démarrage de 3bis-1, où il est archivé.
  - Les décisions de ce chantier vont dans `docs/decisions/exploitation.md`, avec D-102.
- **Q4, enchaînement des étapes : une conversation par bloc d'étapes** (D-125) :
  - **Blocs.** La section « Étapes » de chaque plan regroupe les étapes en blocs, proposés avec le plan et validés avec lui. Une étape lourde est seule dans son bloc. Une étape est lourde si elle lit ou écrit beaucoup de code, ou lance les tests de bout en bout. Les étapes légères (documents, scripts, petites corrections) sont regroupées par 2 ou 3.
  - **`/fin-etape` est invocable par Claude.** Dans un bloc, Claude enchaîne étape, `/fin-etape`, étape suivante. En fin de bloc, il s'arrête sur « Bloc n terminé, commité et poussé. /clear puis /reprise. ».
  - **`/reprise` constate l'état** : git, PR, CI, cases du plan, travail non commité. Si un plan validé existe et que l'état est cohérent, il reprend l'étape en cours ou lance le bloc suivant directement, sans mode plan, en gardant tout ce qui n'est pas commité. Il passe en mode plan seulement s'il n'y a pas de plan validé, ou si l'état contredit ETAT ou le plan.
  - **`/fin-lot` garde `disable-model-invocation`.**
  - **Règle 1 de CLAUDE.md.** Le mode plan vaut pour un lot, une correction ou un changement de SPEC, pas pour une étape d'un plan validé. Cette règle est appliquée dès l'étape 0.
  - **README**, section « Travailler avec Claude Code » : entre deux blocs, l'utilisateur fait /clear puis /reprise.

## Compléments de l'utilisateur

1. **Décisions non intégrées à la SPEC.** La SPEC 1.6 intègre D-001 à D-118. D-119 à D-121 n'y sont pas, et la lecture ciblée ne les verrait plus.
   - Dans l'index des décisions, la colonne des sections porte « non intégrée (x.y) » pour ces entrées. Elle le porte aussi pour toute décision future qui touche la SPEC sans la mettre à jour.
   - `/nouveau-lot`, `/correction-recette` et `/changement-spec` lisent ces entrées (Grep « non intégrée »).
   - `/fin-lot` les intègre à la SPEC et met l'index à jour.
   - L'index de la SPEC dit exactement ce que la version 1.7 intègre : D-001 à D-118, D-122 (cadrage, déjà dans les sections 1 et 2), D-123 (découpage) et D-126 (section 14). D-119 à D-121 n'y sont pas intégrées.
2. **Lecture d'une décision.** `-A 8` tronque D-102, D-120 et D-121, qui font 10 à 11 lignes. Il faut lire jusqu'à l'entrée suivante : Grep `### D-0xx` avec `-A 12`, ou un Read ciblé.
3. **Interruption en cours de chantier.** Chaque étape met à jour, dans CLAUDE.md, les chemins de ce qu'elle déplace. À l'étape 2, « À lire en entier avant chaque lot » devient : lire l'index, puis les fichiers concernés.
4. **Scripts dans l'espace temporaire** (voir les règles d'exécution).
5. **Contrôle d'identité des entrées.** Comparer les entrées avant d'ajouter les mentions à D-030 et D-047.
6. **Exceptions attendues du `git grep` final** :
   - D-029 ;
   - `docs/plans/docs-outils.md` ;
   - la table des chemins de D-123.
7. **`origin/lot-3bis` n'existe plus.** `git fetch --prune` est fait, et ETAT ne la mentionne pas.

## Arborescence cible

```
CLAUDE.md                      réécrit à l'étape 5 (≈ 4,5 Ko ; glossaire et @docs/ETAT.md gardés)
.claude/skills/
  reprise/SKILL.md             invocable par Claude
  nouveau-lot/SKILL.md, lot-4.md, lot-5.md
  correction-recette/SKILL.md
  changement-spec/SKILL.md
  fin-etape/SKILL.md           invocable par Claude
  fin-lot/SKILL.md             disable-model-invocation: true
scripts/check.js               lint, types et tests unitaires en parallèle, sortie concise
docs/
  ETAT.md                      ≈ 3 Ko
  PIEGES.md                    pièges rangés par domaine
  ARCHITECTURE.md, RECETTE.md  inchangés hors références
  spec/README.md + 00-conventions.md … 15-sources.md
  decisions/README.md + cadrage.md, lot-1.md, lot-2.md, lot-3.md, exploitation.md, lot-3bis.md
  plans/lot-3bis.md, plans/docs-outils.md
  archive/PASSATION.md, archive/plans/lot-1.md, lot-1-corrections.md, lot-2.md, lot-3.md, lot-3-corrections.md
```

Supprimés :
- `docs/SPEC.md` ;
- `docs/DECISIONS.md` ;
- `docs/PROMPTS.md` : les lots 4 et 5 vont dans `/nouveau-lot`, les prompts utilitaires dans les skills ; les lots 1 à 3 restent dans l'historique git.

## Détail par étape

### Étape 1 : décisions découpées

Correspondance des sections de `docs/DECISIONS.md` (avant découpage) :

| Section | Entrées | Fichier |
|---|---|---|
| Lignes 1 à 7 (règles, renvoi à SPEC 16) | aucune | `README.md` (réécrit) |
| `## Lot 1 : socle` | D-001 à D-056 | `lot-1.md` |
| `## Lot 2 : exports GIF et PDF` | D-057 à D-077 | `lot-2.md` |
| `## Lot 3 : mise en place` et `## Lot 3 : correction après recette` | D-078 à D-101 | `lot-3.md` |
| `## Exploitation du dépôt` et `## Documentation et outils de travail` | D-102, D-123 à D-128 | `exploitation.md` |
| `## Lot 3 bis : courses réalistes` | D-103 à D-121 | `lot-3bis.md` |
| `## Cadrage initial` | D-122 | `cadrage.md` |

**Introductions de section.** Ce ne sont pas des entrées. Les chemins des lignes 408 (`docs/plans/lot-2.md`), 561 (`lot-3.md`) et 699 (`lot-3-corrections.md`) deviennent `docs/archive/plans/…`. La ligne 751 (`lot-3bis.md`) ne change pas.

**Contrôle d'identité** (script) :
- chaque bloc `### D-xxx` d'origine, du titre jusqu'au bloc suivant, est identique octet pour octet dans un seul fichier ;
- les 128 numéros sont présents, sans doublon.

Le contrôle est fait **avant** d'ajouter les mentions :
- D-030 : « Précisée par D-123 et D-125 » ;
- D-047 : « Remplacée par D-124 » ;
- D-122 : rien à ajouter.

**Index `docs/decisions/README.md`.**
- En-tête :
  - règles du journal (lignes 1 à 7, mises à jour) ;
  - fichier qui contient chaque plage de numéros ;
  - mode de lecture (index, puis Grep `### D-0xx` avec `-A 12`).
- Tableau : `| D-047 | longueur de ETAT.md | remplacée par D-124 | — |`.
- Statut :
  - « en vigueur » ;
  - « remplacée par D-xxx » ;
  - « remplacée en partie par D-xxx » ;
  - « précisée par D-xxx ».
- Sections : les « SPEC x.y » de l'entrée, sinon « — ». Pour D-119 à D-121 : « non intégrée (x.y) ».

**Construction de l'index** (script) :
- titre tiré du `###` ;
- statut tiré des mentions « Remplacée par », « Précisée par », « remplacée par D- », « Précise D- », « précision de D- », « Complète D- » ;
- sections tirées de `SPEC \d+(\.\d+)*` et des « x.y ne précis… ».

Relecture à la main en ne lisant que la ligne « Décision » (tronquée à 250 caractères) des entrées sans section. Liens connus, à vérifier par le script :

| Décision | Statut |
|---|---|
| D-019 | remplacée en partie par D-049 (cadrage) |
| D-043 | remplacée en partie par D-097 |
| D-096 | remplacée en partie par D-101 |
| D-030 | précisée par D-047, D-123 et D-125 |
| D-045 | précisée par D-052 |
| D-047 | remplacée par D-124 |
| D-110 | précisée par D-119 |
| D-061, D-063 et D-064 | précisées par D-075 |

**Références à mettre à jour** :
- `README.md:6` ;
- `docs/ARCHITECTURE.md:3` (« `DECISIONS.md` ») ;
- `docs/RECETTE.md` si besoin ;
- `docs/plans/lot-3bis.md` ;
- `CLAUDE.md` : les deux mentions de `docs/DECISIONS.md` deviennent l'index et le fichier du lot en cours.

`git rm docs/DECISIONS.md`.

### Étape 2 : SPEC découpée

**Découpage** (script). Les lignes des titres `## N.` dans `docs/SPEC.md` sont : 6, 13, 21, 32, 87, 219, 318, 392, 403, 479, 529, 639, 722, 739, 767, 822, 863. Chaque fichier est copié octet pour octet, titre compris :

| Fichier | Fichier | Fichier | Fichier |
|---|---|---|---|
| `00-conventions.md` | `04-modele.md` | `08-stockage.md` | `12-ateliers.md` |
| `01-contexte.md` | `05-moteur.md` | `09-exports.md` | `13-terrain.md` |
| `02-decisions-structurantes.md` | `06-editeur.md` | `10-mise-en-place.md` | `14-valeurs-par-defaut.md` |
| `03-architecture.md` | `07-lecteur.md` | `11-defense.md` | `15-sources.md` |

**Lignes hors fichiers.**
- Lignes 1 à 4 (titre, version, règle de contradiction) : elles passent dans l'index.
- Section 16 (lignes 863 et suivantes) : retirée (D-122).

**Section 14.** Elle garde son titre `## 14. Valeurs par défaut et hypothèses`. Elle contient :
- un renvoi à `src/config/defaults.ts`, qui fait foi (D-126) ;
- le tableau des 9 lignes de défense, recopiées à l'identique ;
- la ligne de la palette, avec l'emplacement de `GIF_MAX_COLORS`.

Seul ce diff est relu.

**Index `docs/spec/README.md`** (une page) :
- titre ;
- « source de vérité » ;
- règle de contradiction ;
- version 1.7 du 25/10/2026, avec ce qu'elle intègre (complément 1) ;
- la convention « SPEC 8.4 » = fichier `08-…` ;
- la règle de version ;
- un tableau : fichier, contenu en une ligne (tiré des `###` du fichier), lots concernés, version.

**Version d'un fichier** (script). C'est la dernière version de la SPEC dont le commit a modifié la section. Le script parcourt l'historique git de `docs/SPEC.md` :
- `f0293a0` (1.0) ;
- `4a566e1` (1.0, correction 13.1) ;
- `e69ebcb` (1.1) ;
- `df5ceb9` (1.2) ;
- `abe4424` (1.3) ;
- `119b9cd` (1.4) ;
- `1bf85cd` (1.5) ;
- `7d34445` (1.6) ;
- `8dcf9d9` et `6f2223b` (précisions sans changement de numéro, comptées en 1.6).

Les hunks sont rapportés aux sections du fichier de la même version. La section 14 passe en 1.7. Ensuite, toute modification incrémente la version globale et celle du fichier.

**Contrôle** (script). La concaténation des fichiers 00 à 13 et 15 est identique aux lignes 6 à 766 et 822 à 862 de l'ancienne SPEC.

**Références à mettre à jour** :
- `README.md:6` ;
- `docs/plans/lot-3bis.md` ;
- `CLAUDE.md` (complément 3) :
  - « docs/SPEC.md : source de vérité… À lire en entier avant chaque lot » devient « docs/spec/ : lire l'index docs/spec/README.md, puis les seuls fichiers concernés » ;
  - « Ne jamais importer docs/SPEC.md » devient « docs/spec/ ».

`git rm docs/SPEC.md`.

### Étape 3 : ETAT, PIEGES, archive

**ETAT.md** (≈ 3 Ko).
- On garde : l'en-tête, « En cours », « Reste à faire » (avec 3bis-1 à 3bis-3), les pistes de D-118 (D-118 dit qu'elles sont notées dans ETAT), « Questions ouvertes », « Écarts connus » et « Chantiers en parallèle ».
- « Fait » est limité au chantier en cours.
- « Pièges » est remplacé par un renvoi à `docs/PIEGES.md`.

**docs/PIEGES.md.** Le script répartit les puces actuelles par domaine (sous-puces OPFS comprises), sans les réécrire :

| Domaine | Pièges |
|---|---|
| TypeScript et ESLint | TS 7 refusé ; lint strict des tests ; `no-restricted-properties` sur `filter` ; caractères invisibles ; règle des hooks |
| Playwright et OPFS | Playwright `fill`, `selectOption` et clics ; les 4 sous-puces OPFS ; `.crswap` de Chrome |
| jsPDF et pdf.js | contexte 2D de jsPDF ; pdf.js renvoie `null` |
| gifenc | `dispose` et `buffer` |
| Git et GitHub | dépôt privé ; branche supprimée visible ; arbre de travail temporaire |
| Outils de Claude Code | `prettier --write` ; heredocs de Bash |
| Vitest et images de référence | délai de 5 s ; tolérance de 0,5 % |
| Application | grille CSS ; commande sans effet ; morceau principal ; police Atkinson |

**Archive.**
- `git mv` vers `docs/archive/plans/` : `docs/plans/lot-1.md`, `lot-1-corrections.md`, `lot-2.md`, `lot-3.md`, `lot-3-corrections.md`.
- `git mv docs/PASSATION.md docs/archive/`.

**Remplacement mécanique des chemins** (script). Il s'applique à `docs/plans/lot-3bis.md`, aux 5 plans archivés, à `PASSATION.md` et à `docs/RECETTE.md:160` :

| Ancien chemin | Nouveau chemin |
|---|---|
| `docs/SPEC.md` | `docs/spec/` |
| `docs/DECISIONS.md` | `docs/decisions/` |
| `docs/plans/<plan archivé>` | `docs/archive/plans/<plan archivé>` |
| `docs/PROMPTS.md` | `.claude/skills/` |

**CLAUDE.md** : mention de `docs/PIEGES.md`.

### Étape 4 : scripts npm

**Scripts.** Ils marchent sous PowerShell, cmd et Git Bash. La CI est inchangée et aucune dépendance n'est ajoutée.
- `check` : `node scripts/check.js`. Il lance en parallèle `eslint .`, `tsc --noEmit --pretty false` et `vitest run --reporter=minimal --silent=passed-only`.
  - Pour une commande réussie, il affiche une ligne (« lint OK (14 s) », « tests OK : N réussis »).
  - Pour une commande en échec, il affiche sa sortie seule.
  - Le code de sortie vaut 1 si une commande échoue.
- `test:short` : `vitest run --reporter=minimal --silent=passed-only`, avec des filtres (`npm run test:short -- src/engine`). Vitest 5 passe déjà en « minimal » sous Claude Code (`std-env` isAgent), mais pas sous PowerShell.
- `test:e2e:short` : `playwright test --reporter=dot --quiet`, avec des filtres (`-- e2e/space.spec.ts --project=chromium`).
- `scripts/check.js` est couvert par la configuration ESLint des `**/*.js` (globales Node, sans typage).

**Fichiers d'exclusion.** `.prettierignore` reçoit `.claude`, et `.gitignore` reçoit `.claude/settings.local.json`.

**Essais.**
- Le vert est cohérent avec `lint`, `typecheck` et `test` lancés séparément.
- Échec provoqué par un fichier temporaire hors `src/`, non commité : seule l'erreur s'affiche, avec le code 1.
- Lancements ciblés.
- Le tout sous PowerShell et sous Git Bash.

### Étape 5 : skills, CLAUDE.md, README

**Skills.** Ils sont en français et prennent leurs arguments par `$ARGUMENTS`.

| Skill | Contenu |
|---|---|
| `/reprise` | invocable par Claude. Constat : `git status`, `git log --oneline -10`, branche, PR ouverte, CI, travail non commité, cases du plan (Grep des cases, puis la section de l'étape suivante seulement), 5 dernières lignes de l'index des décisions. Si un plan validé existe et que l'état est cohérent, reprend l'étape en cours ou lance le bloc suivant sans mode plan, en gardant le travail non commité. Sinon, signale les écarts, fait un résumé en 10 lignes et propose la suite en mode plan. |
| `/nouveau-lot <id> <prompt>` | identifiant (`4`, `3bis-1`…) suivi du texte du prompt. Lit le complément `lot-<id>.md` du skill s'il existe (lots 4 et 5, repris de PROMPTS.md). Lit l'index de la SPEC et les fichiers du lot, les décisions « non intégrée », ARCHITECTURE par sections et PIEGES pour les domaines touchés. Mode plan : contenu de la règle 2, blocs d'étapes, questions Q1… Après validation, étape 0 : branche depuis `main` à jour, plans terminés archivés (dont `lot-3bis.md` au démarrage de 3bis-1), plan dans `docs/plans/lot-<id>.md`, décisions, ETAT. |
| `/correction-recette <constats>` | cause, correction, et test qui aurait dû attraper chaque point ; lit les décisions « non intégrée » ; mode plan, avec des blocs. |
| `/changement-spec <changement>` | fichiers de `docs/spec/` concernés, version du fichier et version globale, décision et ligne d'index, décisions « non intégrée » de ces sections, impacts sur le code, migrations, tests ; mode plan. |
| `/fin-etape [étape]` | invocable par Claude. Si l'étape touche du code ou de la configuration : `npm run check`, plus `npm run test:e2e:short` si elle touche l'interface, l'état, io, les exports ou e2e ; rouge = corriger, sans commiter. Ensuite : décisions et index, ETAT, case du plan, commit en français avec les lignes d'attribution en vigueur, `git push`. Compte rendu en 3 lignes ; en fin de bloc, « Bloc n terminé, commité et poussé. /clear puis /reprise. ». |
| `/fin-lot` | `disable-model-invocation: true`. Recette automatisable complète : check, e2e Chromium et Firefox, build, points automatisables de la section du lot dans RECETTE. Intégration des décisions « non intégrée » à la SPEC (versions, index). ARCHITECTURE ; RECETTE avec au plus 5 vérifications manuelles indispensables et impossibles à automatiser ; README ; ETAT. Commit, push, `gh pr create` vers `main` sans fusionner ; liste des vérifications manuelles. |

**`git rm docs/PROMPTS.md`.**

**CLAUDE.md réécrit.** On garde :
- le résumé et `@docs/ETAT.md` ;
- les règles 1 à 12 condensées (procédures envoyées aux skills ; règle 1 selon Q4) ;
- les conventions ;
- le tableau npm complété (`check`, `test:short`, `test:e2e:short`) ;
- le glossaire.

Ce qui change :
- **Lecture :**
  - index de `docs/spec/`, puis les fichiers concernés ;
  - une décision par son numéro (index, puis Grep `### D-0xx` avec `-A 12`), jamais un journal entier ;
  - `PIEGES.md` (section du domaine) avant de toucher à un domaine qui y figure ;
  - ARCHITECTURE et RECETTE par section, à la demande ;
  - `docs/archive/` jamais lu par défaut.
- **Début de session :** ETAT est déjà chargé ; `git status` et `git log --oneline -5` ; signaler tout écart. Pour une reprise ou après un compactage : `/reprise`.
- **Économie :**
  - au plus un sous-agent à la fois, seulement si une recherche ciblée ne suffit pas, mode plan compris ;
  - tests ciblés pendant une étape, suite complète en fin d'étape ;
  - push après chaque commit ;
  - un bloc d'étapes par conversation.
- **Mémoire :**
  - ETAT d'environ 3 Ko ;
  - une nouvelle décision va dans le fichier du lot en cours, avec une ligne dans l'index ;
  - une décision remplacée change de statut ;
  - une décision qui touche la SPEC sans la mettre à jour est marquée « non intégrée (x.y) ».

**README.** Ligne 6 : liens vers les index. Nouvelle section « Travailler avec Claude Code » :
- le cycle par blocs ;
- entre deux blocs, `/clear` puis `/reprise` ;
- les 6 commandes.

**RECETTE.md:6.** Le prompt « Correction après recette » de PROMPTS.md devient `/correction-recette`.

### Étape 6 : contrôle et PR

**Contrôles** (scripts) :
- chaque lien relatif des `.md` (README, CLAUDE, docs, skills) pointe vers un fichier existant ;
- `git grep -n -E 'docs/(SPEC|DECISIONS|PROMPTS|PASSATION)\.md|docs/plans/lot-(1|2|3)(-corrections)?\.md'` ne renvoie que les exceptions attendues : D-029, `docs/plans/docs-outils.md` et la table de D-123 ;
- aucun fichier de `src/` n'a changé (`git diff --stat main -- src`).

**Mesures.** En octets, et en tokens estimés à 2,9 o par token. Ce rapport est calibré sur SPEC.md : 94 696 o pour environ 33 000 tokens selon /usage.

| Lecture | Avant | Après (cible) |
|---|---|---|
| Démarrage | CLAUDE.md 5 650 + ETAT 8 572 = 14 222 o | ≈ 8 000 o (avec les descriptions des skills invocables) |
| Reprise | démarrage + plan lot-3bis 41 998 + ARCHITECTURE 24 401 + entrées de DECISIONS (jusqu'à 98 617) | démarrage + `/reprise` + section « Étapes » du plan + fin de l'index ≈ 15 Ko |
| Début de lot (exemple : lot 4) | SPEC entière 94 696 + ARCHITECTURE | index + sections 3, 5, 10, 11, 14 ≈ 40 Ko |

**PR et fin.**
- ETAT mis à jour ; PR vers `main` avec ces mesures et les 2 vérifications manuelles ; CI verte ; aucune fusion.
- Vérifications manuelles :
  1. dans une nouvelle conversation, `/` liste les 6 skills et `/reprise` constate l'état ;
  2. `npm run check` sous PowerShell sur l'autre PC.

**Résultats (étape 6).**
- Liens relatifs : 35 dans 46 fichiers, aucun cassé. Chemins entre accents graves, en plus : les absents sont dans ce plan, l'archive, D-123, D-125, les plans futurs de D-128 ou désignent des dossiers générés.
- Anciens chemins : ce plan, la table de D-123 et D-125 ; D-029 écrit « SPEC.md » sans `docs/` et n'est pas trouvée.
- `git diff --stat main -- src` : vide.

| Lecture | Avant | Après (mesuré) | Cible |
|---|---|---|---|
| Démarrage | 14 222 o (≈ 4 900 tokens) | 10 319 o (≈ 3 560 tokens) : CLAUDE 5 715, ETAT 3 576, descriptions de 5 skills 1 028 | ≈ 8 000 o |
| Reprise | 80 621 à 179 238 o | 14 236 o (≈ 4 910 tokens) ; 17 376 o avec la section de l'étape et `/fin-etape` | ≈ 15 Ko |
| Début du lot 4 | 119 097 o (≈ 41 100 tokens) | 39 944 o (≈ 13 770 tokens) ; 45 005 o avec `/nouveau-lot` et `lot-4.md` | ≈ 40 Ko |

## Étapes

Les blocs ont été validés avec le plan.

### Bloc 0 (cette conversation)
- [x] **Étape 0 : branche, plan, décisions D-122 à D-128, ETAT.** (commit « Étape 0 : plan de la réorganisation de la documentation, D-122 à D-128 », après `ba76d6c`)

### Bloc 1 : décisions (étape lourde : construction de l'index)
- [x] **Étape 1 : décisions découpées, index, mentions de D-030 et D-047, références.** (commit « Étape 1 : journal des décisions découpé par lot, index », après `36eca6a`)

### Bloc 2 : SPEC et mémoire (découpages par script)
- [x] **Étape 2 : SPEC découpée, index, sections 14 et 16, version 1.7, références.** (commit « Étape 2 : spécification découpée par section, index, version 1.7 », après `0412b51`)
- [x] **Étape 3 : ETAT, PIEGES, archive, chemins des plans.** (commit « Étape 3 : état réécrit, pièges par domaine, plans terminés archivés », après `fca9512`)

### Bloc 3 : outils
- [x] **Étape 4 : scripts npm et essais.** (commit « Étape 4 : scripts npm de contrôle à sortie concise », après `b5c5a39`)
- [x] **Étape 5 : skills, CLAUDE.md, README.** (commit « Étape 5 : procédures en skills, CLAUDE.md réécrit, README », après `d19ff69`)

### Bloc 4 : clôture (après le bloc 3 : « /clear puis /reprise »)
- [x] **Étape 6 : contrôles, mesures, PR.** (commit « Étape 6 : contrôles des liens et des chemins, mesures », après `b6f4ec0`)
