---
name: changement-spec
description: Prépare en mode plan un changement de la spécification (docs/spec/) avec les fichiers et versions touchés, la décision, les impacts sur le code, les migrations et les tests.
argument-hint: "<changement>"
---

# Changement de spécification

Changement demandé par l'utilisateur : $ARGUMENTS

## 1. Lecture, ciblée

- Index `docs/spec/README.md` (règle de version, tableau des fichiers), puis les seuls fichiers concernés.
- Décisions non intégrées de ces sections : Grep « non intégrée » dans `docs/decisions/README.md`, puis chaque entrée concernée par son numéro (Grep `### D-0xx` avec `-A 12`).
- Code touché : recherche ciblée (types, fonctions, mentions « SPEC x.y » du code) ; `docs/ARCHITECTURE.md` par sections.

## 2. Plan, en mode plan

Passer en mode plan et attendre la validation. Le plan contient :
- les fichiers de `docs/spec/` modifiés et le texte proposé ; la version globale suivante et celle de chaque fichier modifié (règle de version de l'index) ;
- les décisions non intégrées de ces sections : intégrées au passage ou non ;
- la décision à ajouter (fichier du lot en cours, ligne d'index) et les décisions qu'elle remplace ou précise ;
- les impacts sur le code existant ; les migrations éventuelles (règle 6 : `schemaVersion`, migration, fixture de l'ancienne version, test) ; les tests à ajouter ou modifier ;
- les points ambigus ou contradictoires, en questions Q1, Q2... ;
- les étapes, groupées en blocs (D-125).

## 3. Après validation

- Dans un même commit : fichiers de `docs/spec/` et index de la SPEC (version globale, décisions intégrées, ligne de chaque fichier modifié) ; décision et index des décisions (colonne des sections des décisions intégrées) ; `docs/ETAT.md`.
- Puis les étapes du code, par blocs, avec `/fin-etape`.
