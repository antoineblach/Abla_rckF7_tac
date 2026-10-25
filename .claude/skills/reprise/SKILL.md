---
name: reprise
description: Reprend le travail après /clear ou un compactage. Constate l'état du dépôt (git, PR, CI, cases du plan) puis reprend l'étape en cours ou lance le bloc suivant du plan validé.
---

# Reprise

Reprise dans une nouvelle conversation (après `/clear`) ou après un compactage (D-125). `docs/ETAT.md` est déjà chargé par `CLAUDE.md`. Précision éventuelle de l'utilisateur : $ARGUMENTS

## 1. Constat

Ne lire que ceci :
- `git status`, `git log --oneline -10`, branche courante et son écart avec `origin` ;
- PR de la branche : `gh pr list --head <branche> --state all --limit 3` ; CI : `gh run list --branch <branche> --limit 3` (si `gh` échoue, le signaler et continuer) ;
- travail non commité : `git diff --stat`, sans lire le diff entier ;
- plan en cours, nommé dans « En cours » de ETAT : Grep des cases (`^- \[[ x]\]`, avec numéros de ligne), pour situer la première case non cochée et son bloc ;
- les 5 dernières lignes de l'index `docs/decisions/README.md`.

## 2. Cohérence

L'état est cohérent si :
- la branche est celle de ETAT ;
- chaque case cochée a son commit dans `git log` (titre cité dans la case), et ETAT dit la même chose que les cases ;
- le travail non commité, s'il y en a, relève de l'étape en cours (première case non cochée).

## 3. Suite

**Plan validé et état cohérent** : pas de mode plan.
- Lire, dans le plan, la section de l'étape à faire seulement (Grep de son titre, puis Read ciblé), et ce qu'elle cite, selon les règles de lecture de `CLAUDE.md`.
- Garder tout le travail non commité.
- Étape en cours (travail non commité, ou bloc entamé) : la reprendre et finir son bloc. Sinon : lancer le bloc suivant.
- Dans le bloc : étape, `/fin-etape`, étape suivante, sans validation intermédiaire. En fin de bloc : « Bloc n terminé, commité et poussé. /clear puis /reprise. ».

**Pas de plan validé, ou état qui contredit ETAT ou le plan** : ne rien modifier.
- Signaler les écarts.
- Résumer en 10 lignes au plus : lot en cours, action suivante, reste à faire, questions ouvertes, blocages.
- Proposer la suite en mode plan et attendre la validation (pour un nouveau lot : `/nouveau-lot <id> <prompt>`).
