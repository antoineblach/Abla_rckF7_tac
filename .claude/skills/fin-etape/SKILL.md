---
name: fin-etape
description: Termine une étape d'un plan validé (tests, décisions, ETAT, case du plan, commit en français, push). À lancer après chaque étape d'un bloc.
argument-hint: "[étape]"
---

# Fin d'étape

Étape : $ARGUMENTS (à défaut, la première case non cochée du plan en cours).

1. **Tests**, si l'étape touche du code ou de la configuration (une étape qui ne touche que des documents n'en lance pas) :
   - `npm run check` ;
   - en plus, `npm run test:e2e:short` si elle touche l'interface (`src/ui/`), l'état (`src/state/`), `src/io/`, les exports (`src/export/`) ou `e2e/` ;
   - rouge : corriger et relancer, sans commiter ; si la correction sort de l'étape, s'arrêter et demander.
2. **Décisions** : chaque décision prise pendant l'étape est dans le fichier du lot en cours de `docs/decisions/`, avec sa ligne dans l'index `docs/decisions/README.md` (statut ; sections de SPEC, ou « non intégrée (x.y) » si elle touche la SPEC sans la mettre à jour). Une décision remplacée ou précisée change de statut.
3. **Pièges** : un piège rencontré va dans la section de son domaine de `docs/PIEGES.md`.
4. **ETAT** : `docs/ETAT.md` réécrit, non allongé (environ 3 Ko, D-124) : en cours, fait, reste à faire, écarts.
5. **Case du plan** cochée, sous la forme « (commit « titre », après `hash du commit précédent`) » : un commit ne peut pas contenir son propre hash.
6. **Commit** en français (titre « Étape n : ... », corps en puces), avec les lignes d'attribution en vigueur ; puis `git push` (`git push -u origin <branche>` au premier push).
7. **Compte rendu** en 3 lignes : fait, tests, commit. En fin de bloc, terminer par « Bloc n terminé, commité et poussé. /clear puis /reprise. ».
