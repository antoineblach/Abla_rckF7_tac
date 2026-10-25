---
name: correction-recette
description: Prépare en mode plan la correction des constats de la recette d'un lot (vérifications manuelles et séance d'usage libre) avec, pour chaque point, la cause, la correction et le test qui aurait dû l'attraper.
argument-hint: "<constats>"
---

# Correction après recette

Constats de l'utilisateur, recette du lot (vérifications manuelles et séance d'usage libre) :

$ARGUMENTS

## 1. Lecture, ciblée

- Décisions non intégrées à la SPEC : Grep « non intégrée » dans `docs/decisions/README.md`, puis chaque entrée par son numéro (Grep `### D-0xx` avec `-A 12`).
- Pour chaque constat : les sections de SPEC concernées (index `docs/spec/README.md`, puis les fichiers), le code en cause (recherche ciblée), la section du domaine dans `docs/PIEGES.md`.

## 2. Plan, en mode plan

Passer en mode plan et attendre la validation avant de corriger. Pour chaque constat :
- la cause identifiée, ou les hypothèses et la façon de les départager ;
- la correction proposée ;
- le test qui aurait dû l'attraper, ajouté avec la correction.

Un constat qui demande une règle absente de la SPEC, ou contraire à elle, devient une question (Q1, Q2...) : jamais une décision prise seul. Le plan contient aussi les fichiers modifiés, les tests prévus et les étapes groupées en blocs (D-125).

## 3. Après validation

- Branche : si la PR du lot est fusionnée, `lot-<id>-corrections` depuis `main` à jour (convention des lots 1 et 3) ; sinon, la branche du lot.
- Plan dans `docs/plans/lot-<id>-corrections.md`, décisions dans le fichier du lot et l'index, `docs/ETAT.md`.
- `/fin-etape 0`, puis « Bloc 0 terminé, commité et poussé. /clear puis /reprise. ».
