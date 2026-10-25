---
name: fin-lot
description: Fin de lot, lancée par l'utilisateur seul. Recette automatisable complète, intégration des décisions à la SPEC, documents, PR vers main sans fusion.
argument-hint: "[lot]"
disable-model-invocation: true
---

# Fin de lot

Lot : $ARGUMENTS (à défaut, le lot en cours de `docs/ETAT.md`).

1. **Recette automatisable complète** : `npm run check`, `npm run test:e2e:short` (Chromium et Firefox), `npm run build`, et les points automatisables de la section du lot dans `docs/RECETTE.md` (couverts par des tests, sinon à couvrir). Rouge : corriger, sans commiter.
2. **SPEC** : chaque décision « non intégrée » de l'index des décisions (Grep) est intégrée aux fichiers de `docs/spec/` qu'elle touche. Une partie marquée « reportée à <lot> » reste telle quelle jusqu'à ce lot. Mettre à jour la version globale et celle des fichiers, l'index de la SPEC (décisions intégrées) et la colonne des sections de l'index des décisions. Une intégration ambiguë devient une question.
3. **Documents** :
   - `docs/ARCHITECTURE.md` : architecture effective à la fin du lot, sections touchées ;
   - `docs/RECETTE.md`, section du lot : au plus 5 vérifications manuelles, à la fois indispensables et impossibles à automatiser, puis la séance d'usage libre (retour par `/correction-recette`) ;
   - `README.md`, si l'utilisation ou le développement changent ;
   - décisions du lot et index à jour ; `docs/ETAT.md` réécrit ; plan : cases cochées.
4. **Commit** en français, avec les lignes d'attribution en vigueur ; `git push` ; `gh pr create` vers `main` (contenu du lot, tests, vérifications manuelles), sans fusionner. Vérifier que la CI de la PR démarre.
5. **Compte rendu** : lien de la PR, puis la liste des vérifications manuelles (au plus 5).
