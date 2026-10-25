---
name: nouveau-lot
description: Prépare un nouveau lot (4, 5, 3bis-1...) en mode plan à partir de son prompt puis, après validation, son étape 0 (branche, plan, décisions, ETAT).
argument-hint: "<id> <prompt>"
---

# Nouveau lot

Arguments : $ARGUMENTS

Le premier mot est l'identifiant du lot (`4`, `5`, `3bis-1`...), le reste est le prompt de l'utilisateur.

## 1. Lecture, ciblée

- Complément du lot : `.claude/skills/nouveau-lot/lot-<id>.md`, s'il existe (lots 4 et 5). Il précise le contenu du plan et les tests obligatoires ; ses mentions de lecture se lisent selon les règles ci-dessous.
- SPEC : l'index `docs/spec/README.md`, puis les fichiers des sections du lot (colonne « Lots », sections citées par le prompt ou le complément). Jamais la SPEC entière.
- Décisions non intégrées à la SPEC : Grep « non intégrée » dans `docs/decisions/README.md`, puis chaque entrée par son numéro (Grep `### D-0xx` avec `-A 12`).
- `docs/ARCHITECTURE.md` : Grep des titres `^## `, puis les seules sections touchées.
- `docs/PIEGES.md` : les sections des domaines touchés.
- Partie d'un lot déjà commencé (3bis-1...) : la section du plan précédent qui la décrit, et les décisions qu'elle cite.

## 2. Plan, en mode plan

Passer en mode plan ; rien n'est écrit avant la validation. Le plan contient :
- les fichiers créés ou modifiés ;
- les étapes, groupées en blocs (D-125) : une étape lourde (beaucoup de code lu ou écrit, tests de bout en bout) est seule dans son bloc, les étapes légères (documents, scripts, petites corrections) sont regroupées par 2 ou 3 ; le bloc 0 est l'étape 0 ;
- les dépendances ajoutées et leur justification ;
- les tests prévus ;
- les points de la spécification jugés ambigus ou contradictoires, en questions numérotées Q1, Q2... : ne jamais les trancher, ne jamais inventer une règle de rugby ;
- ce que demande le complément du lot.

## 3. Étape 0, après validation

- Branche `lot-<id>` depuis `main` à jour : `git switch main`, `git pull`, `git switch -c lot-<id>`.
- Plans terminés : `git mv` vers `docs/archive/plans/` (au démarrage de 3bis-1 : `docs/plans/lot-3bis.md`, D-128).
- Plan validé dans `docs/plans/lot-<id>.md` : date de validation, questions et réponses, détail par étape, section « Étapes » (blocs, cases à cocher).
- Décisions du plan dans le fichier du lot : `docs/decisions/lot-3bis.md` pour 3bis-1 à 3bis-3, sinon `docs/decisions/lot-<id>.md`, ajouté au tableau « Fichiers » de l'index ; une ligne d'index par décision.
- `docs/ETAT.md` réécrit : lot en cours, plan, bloc suivant.
- `/fin-etape 0`, puis s'arrêter sur « Bloc 0 terminé, commité et poussé. /clear puis /reprise. ».
