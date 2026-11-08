# Plan du lot ordre-bords : un ordre des bords qui ne lit plus un `start` périmé

Validé le 8 novembre 2026, avec les réponses Q1 à Q4 et les compléments de l'utilisateur du 08/11, intégrés ci-dessous. Décisions : D-180 (cadrage) et D-181 (Q3 complétée, Q4) à l'étape 0 ; D-182 (règle retenue) à l'étape 1, après la sonde.

Ce plan doit se suffire : chaque bloc est lancé dans une nouvelle conversation par `/reprise`. Lecture : dans ce plan, seulement le « Détail par étape » de l'étape et les sections qu'il cite ; jamais le plan entier. Aucun sous-agent. Dans un bloc : étape, `/fin-etape`, étape suivante (D-125).

## Contexte

Question ouverte d'ETAT « Ordre des bords » (SPEC 5.8, Résolution, seconde « Limite assumée » ; D-177). Là où le graphe laisse le choix, `analyse` (`src/model/syncGraph.ts`) range les bords par `start` enregistré, à deux endroits :
- `softOrder` : chaînes « course précédente de la joueuse » et « événement de ballon précédent », bâties par `byStoredStart` ; un regroupement passe avant la fin des courses de ses participantes ;
- `remaining` : liste des nœuds par `byStoredStart(blocks)`, puis premier nœud prêt (dépendances dures et souples faites, sinon dures seules).

Pour un bloc dont un collage calcule le départ (bord gauche collé, ou bord droit qui le fait glisser : le « bloc absent » de D-177, ensemble `unresolved` de `src/engine/glue.ts`), ce `start` n'est qu'un repli, jamais rafraîchi (D-169) : sa place dans l'ordre est donc périmée. Un bord peut alors être résolu avant lui, avec une simulation où il manque, et lire une course suivante ou un ramassage faux : collage « ok » mais faux, sans alerte. Le glisser de frise-2 rendra ces `start` périmés courants.

But : là où un `start` enregistré change ce qu'un bord lit, la résolution n'en dépend plus.

Contraintes déjà tranchées : une seule passe sur les bords, pas de point fixe (D-162) ; résultat déterministe ; aucun cycle de plus (4.3, D-152) ; `start` enregistré jamais mis à jour (D-169) ; écartés par D-177 : ordre topologique dans la file de la joueuse seul, ordre estimé à partir des collages. Une règle qui ne tient qu'en levant l'une de ces contraintes : question, pas de choix. Aucune migration (`schemaVersion` reste 5). Aucune vérification manuelle : moteur seul, tout s'automatise.

## Règles candidates, départagées par la sonde

- **R0** : aujourd'hui (D-162).
- **A, absents en tête** : un bloc absent n'a plus de place par `start` enregistré. Dans ses chaînes (même joueuse ; événements de ballon ; regroupement et courses de ses participantes), il passe avant les autres blocs, sauf ceux dont il dépend (graphe dur, transitif). Statique, `syncGraph.ts` seul. Prévu : tient les cas 1 à 3 et 7 ; échoue au cas 5 (course glissée résolue avant l'étirement de la course d'avant), au cas 4 selon l'ordre du tableau.
- **B, chacun à son instant** : A, puis, dès que les dépendances d'un bloc absent sont résolues, il est rangé dans ses chaînes à l'instant de sa cible (+ `offset`), lu sur la simulation courante : sa fin pour un bloc qui glisse, son départ pour un bord gauche ; les autres blocs restent à leur `start` enregistré. Égalité entre deux blocs absents en conflit : `start` enregistré (Q3, D-181). Ordre dynamique : la boucle `visit` de `glue.ts` tire le bord suivant d'un ordonnanceur au lieu de parcourir `analysis.order`. Prévu : tient les cas 1 à 5 ; cas 6 et 7 à mesurer (fin d'un bloc qui glisse comparée au départ des autres).
- **Variante de B** (D-180, point 4) : seulement si B rate le cas 6 ou le cas 7. Proposée et mesurée à l'arrêt du bloc 1, par exemple : dans une chaîne, un bloc qui glisse comparé par sa fin à la fin des autres blocs ; à égalité, le bloc qui glisse d'abord. Pas de choix sans l'utilisateur.

Ébauche du texte de 5.8 pour B (définitif à l'étape 1, après le choix) : « là où le graphe laisse le choix, la course précédente de la joueuse, l'événement de ballon précédent et le regroupement qui peut arrêter une course passent d'abord, chaque bloc rangé à son instant : son `start` enregistré, ou, quand un collage calcule son départ, l'instant de sa cible, lu dès que ses dépendances sont résolues ; avant cette lecture, il passe avant les autres blocs de ses chaînes, sauf ceux dont il dépend ; à instant égal, l'ordre des `start` enregistrés ; jamais un cycle. »

## Cas mesurés

Pour R0, A, B (et la variante s'il y a lieu), chacun avec `expectGluesOnTarget` et `expectIndependent` (`src/test/glueChecks.ts` ; (b) à 0 et au-delà de la ligne), plus la valeur suivie.

1. **Q3 de C4c** : R1 libre ; R2 collée par son bord gauche à la fin de R1, `start` enregistré périmé au-delà de 10 ; R3 libre à 10, de la même joueuse ; course d'une autre joueuse collée par son bord gauche à la fin de R3. Attendu : départ 15,71 s (15,15 avec R0, mesure de C4c).
2. **Ramassage** : poursuite collée par son bord droit qui glisse (`keep: 'duration'`, Q4) à l'arrivée d'un jeu au pied, qui ramasse ; passe libre de la ramasseuse ; course d'une autre joueuse collée à l'arrivée de cette passe ; `start` de la poursuite à sa valeur de pose, à 0, puis au-delà de la ligne. **Variante** : course collée au lâcher de cette passe ; si R0 la rate et que la règle retenue la tient, elle entre dans les tests sans redemander (D-181).
3. **Fixture v5** : le test « holds on every line of the v5 fixture » de `glue.test.ts` sans `{ beyond: false }` ; jeu au pied de B1 attendu à 24,37 s (24,86 avec R0). Remplace la partie (1) de D-178.
4. **Deux courses glissées d'une joueuse**, cibles indépendantes à 10 et 20 s, `start` enregistrés inversés, et ordre du tableau inversé.
5. **Course glissée entre deux courses étirées** (`keep: 'start'`) de sa joueuse, `start` enregistré périmé.
6. **Égalité sans conflit** (D-181) : « Décoller » fige un départ à sa valeur résolue (D-170), donc un bloc libre part exactement à la fin du bloc qui glisse.
   - a. Course S glissée, `start` enregistré périmé au-delà de F ; course libre F de la même joueuse, départ égal à la fin de S ; course d'une autre joueuse collée à la fin de F.
   - b. Passe P1 glissée ; passe libre P2 de la receveuse, lâcher égal à l'arrivée de P1 ; course d'une autre joueuse collée à l'arrivée de P2.
7. **Chevauchement** : course S glissée jusqu'à une cible à 12 s, partie avant 10 s, `start` enregistré périmé au-delà de 12 ; course libre F de la même joueuse à 10 s, donc retardée à la fin de S avec l'alerte « départ retardé » (4.3) ; course d'une autre joueuse collée à la fin de F. Rangée par sa fin (12) contre le départ de F (10), S passerait après F avec B : le bord lirait F sans retard, « ok » mais faux, là où A le tient. À confirmer par la sonde.

Cas 1 à 7 gardés comme tests avec la règle retenue (Q2, D-180 ; cas 6 et 7 : compléments du 08/11).

Première « Limite assumée » de 5.8 (collage qui change un ramassage et décale une cible déjà résolue) : hors périmètre. La sonde dit, mesure à l'appui, si la règle retenue couvre sa seconde moitié (une autre joueuse ramasse à la place d'une course absente) ; D-182 et la SPEC le diront alors.

**Ordre exposé par `compiledGlues`** (D-180, point 5) : avec B, `compiledGlues` (`glue.ts`) lit encore `analysis.order`, donc l'ordre des `start` enregistrés. Le tableau de la sonde dit quel ordre il expose ; préférence de l'utilisateur : l'ordre réel de résolution (`PlayResolution` l'expose, `compiledGlues` le lit).

## Fichiers créés ou modifiés

- Étape 0 : `docs/plans/lot-ordre-bords.md` (ce fichier) ; `docs/plans/lot-frise-1.md` déplacé vers `docs/archive/plans/` ; `docs/decisions/frise.md` (D-180, D-181) et `docs/decisions/README.md` ; `docs/ETAT.md`.
- Étape 1 : `docs/decisions/frise.md` (D-182) et `docs/decisions/README.md` ; `docs/spec/05-moteur.md` (5.8, Résolution et « Limites assumées ») ; `docs/spec/README.md` (version 1.12) ; mesures de la sonde dans ce plan. Prototype et `src/engine/orderProbe.test.ts` jamais commités (`git stash` « sonde ordre-bords »).
- Étape 2 : `src/model/syncGraph.ts` (chaînes et ordre ; ensemble des départs calculés exposé par `GlueAnalysis`, partagé par `unresolved` de `glue.ts` et `withComputedStarts`) ; `src/engine/glue.ts` (en-tête ; boucle de `visit`, ordre réel exposé et lu par `compiledGlues`, si B ou sa variante) ; `src/test/glueChecks.ts` (commentaires de `resolvedParts`, ensemble partagé) ; `src/model/syncGraph.test.ts` ; `src/engine/glue.test.ts` ; `src/engine/profileCount.test.ts` (plafonds, seulement si une hausse est mesurée et justifiée) ; `docs/ARCHITECTURE.md` (« Moteur et rendu », ligne frise-1) ; `docs/PIEGES.md` (« Vitest et images de référence », ligne des chaînes de courses collées) ; `docs/decisions/README.md` (D-178 : « remplacée en partie (1) par D-182 ») ; `docs/ETAT.md`.

## Dépendances

Aucune.

## Détail par étape

### Étape 0

Branche `lot-ordre-bords` depuis `main` à jour (`381480a`). `git mv docs/plans/lot-frise-1.md docs/archive/plans/`. Ce plan. D-180 et D-181 dans `docs/decisions/frise.md`, section « ## Lot ordre-bords », une ligne d'index chacune ; D-180 « précisée par D-181 ». ETAT réécrit, corrigé au passage : PR #12 fusionnée (`381480a`), CI de `main` verte, frise-1 déployée et recettée ; lot en cours, bloc suivant.

### Étape 1 : sonde, puis règle

Lecture : SPEC 5.8 (Résolution et « Limites assumées » seulement, Grep `Résolution` avec `-A 8`) ; D-177, D-178, D-180, D-181 (Grep `### D-1xx` avec `-A 12`) ; `syncGraph.ts` de `GlueAnalysis` à la fin ; `glue.ts` : en-tête, `unresolved`, `visit`, `resolvePlay`, `compiledGlues` ; `src/test/glueChecks.ts` ; `glue.test.ts` : en-tête (assistants `play`, `run`, `pass`, `kick`, `onEnd`...) et le `describe` de D-177 ; `src/engine/profileCount.test.ts` ; PIEGES « Vitest et images de référence ».

1. Avant toute modification : `npm run bench` (une ligne, glisser) et nombres de profils de `profileCount.test` (443 et 560 attendus), notés ici.
2. Cas 1 à 7 (et la variante du cas 2) dans `src/engine/orderProbe.test.ts`, non commité. Mesures écrites dans un fichier du scratchpad (PIEGES : un `console.log` n'apparaît pas pour un test réussi) : valeur suivie, (a), (b) à la pose, à 0 et au-delà, statuts et alertes.
3. Prototype de B, avec un drapeau qui coupe la lecture de l'instant (donne A). Pour R0, A et B : cas 1 à 7, `npm run test:short` (tests en échec), profils sur la scène réaliste et la fixture, bench ; ordre exposé par `compiledGlues`.
4. Si B rate le cas 6 ou le cas 7 : variante proposée, prototypée et mesurée de la même façon.
5. **Arrêt** : tableau R0, A, B (et variante) sur les cas 1 à 7, profils, bench, ordre exposé par `compiledGlues`, couverture de la seconde moitié de la première limite ; recommandation ; choix de l'utilisateur.
6. Après la réponse : D-182 (règle, mesures, remplace la partie (1) de D-178, précise D-162 et D-177 ; plafonds relevés s'il y a lieu, mesurés et justifiés) ; SPEC 5.8, Résolution et « Limites assumées » (seconde limite retirée ou réduite à ce qui reste, mesure à l'appui ; première limite précisée si la règle couvre sa seconde moitié) ; `docs/spec/README.md` 1.12 (version, décisions intégrées, ligne de `05-moteur.md`) ; mesures ci-dessous, section « Sonde » ; prototype en `git stash`. `/fin-etape 1`.

### Étape 2 : moteur et tests

Lecture : D-182 ; section « Sonde » de ce plan ; mêmes fichiers que l'étape 1, plus `syncGraph.test.ts` (`describe` « order of the glued edges »). Prototype : `git stash list`, s'il est sur ce poste ; sinon réécrit depuis D-182.

Règle retenue, réécrite proprement : `syncGraph.ts` (et `glue.ts` si B ou sa variante, avec l'ordre réel exposé par `PlayResolution` et lu par `compiledGlues`). Tests ci-dessous. Plafonds de `profileCount.test` (hausse seulement mesurée et justifiée dans D-182). `npm run bench`. ARCHITECTURE (« Moteur et rendu », ligne frise-1 : ordre et bench), PIEGES (ligne des chaînes de courses collées : plus de « au-delà de la ligne, l'ordre des bords peut encore changer un résultat »), statut de D-178 dans l'index, ETAT (question ouverte retirée ou réduite à ce qui reste). Tests ciblés pendant l'étape (`test:short`), puis `npm run check` et `npm run test:e2e`. `/fin-etape 2`. Le lot est alors prêt pour le `/fin-lot` de l'utilisateur.

## Tests

- `glue.test.ts`, dans le `describe` de D-177 ou un `describe` voisin cité D-182 : cas 1 à 7, chacun avec `expectGluesOnTarget` et `expectIndependent` (0 et au-delà), plus la valeur attendue (cas 1 : départ à la fin réelle de R3 ; cas 3 : arrivée du jeu au pied de B1) ; cas 2 aux trois `start` de la poursuite, et sa variante selon D-181 ; test de la fixture sans `{ beyond: false }`.
- `syncGraph.test.ts` : un bloc absent n'est plus rangé par son `start` enregistré (ordre statique identique quand on permute ces `start`) ; il ne passe jamais devant ce dont il dépend ; le test de D-162 « takes the run before on the same player first » inchangé (Q3).
- Relancés, inchangés : déterminisme, `trunk.test.ts`, `editor/glues.test.ts` (chaîne de trois courses, D-177), `profileCount.test.ts`.

## Performances

- Référence avant toute modification : `npm run bench` à l'étape 1 (12,1 et 12,2 ms en C4c) ; glisser sous 16 ms.
- Plafonds de `profileCount.test` : 490 et 610 ; toute hausse mesurée et justifiée dans D-182. B lit des cibles sur la simulation courante, déjà calculée pour le bord suivant : coût attendu proche de zéro, à mesurer.

## Vérification

- Cas 1 à 7 verts avec la règle retenue, faux avec R0 là où la sonde l'a mesuré.
- `npm run check` et `npm run test:e2e` verts ; bench sous 16 ms ; profils sous les plafonds.
- SPEC 5.8, index des décisions et ETAT cohérents ; `schemaVersion` à 5.

## Questions et réponses

- **Q1** : la règle B range un bloc absent à l'instant de sa cible, lu sur la simulation courante. Est-ce « l'ordre estimé à partir des collages » écarté par D-177 ? **Réponse : B admissible comme candidate** (D-180).
- **Q2** : cas 4 et 5 ajoutés aux cas mesurés ? **Réponse : oui, mesurés avant et après et gardés comme tests** (D-180).
- **Q3** : égalité exacte entre deux blocs absents (même instant de cible) ? **Réponse : `start` enregistré** ; il ne départage qu'un conflit déjà signalé (l'un des deux finit au repli, avec alerte), jamais un collage « ok » ; le test de D-162 reste tel quel. **Complément du 08/11** : la réponse couvre deux blocs absents en conflit, pas l'égalité sans conflit, naturelle après « Décoller » (D-170) : cas 6 (D-181).
- **Q4** : cas 2, poursuite collée par son bord droit qui glisse (`keep: 'duration'`) à l'arrivée du jeu au pied ? **Réponse du 08/11 : lecture confirmée** ; la variante « course collée au lâcher de la passe » entre dans les tests sans redemander si R0 la rate et que la règle retenue la tient (D-181).
- **Compléments du 08/11** (D-180) : cas 7 (chevauchement) ; variante de B si B rate le cas 6 ou le cas 7, mesurée, pas de choix sans l'utilisateur ; ordre exposé par `compiledGlues` dans le tableau, préférence pour l'ordre réel de résolution.

## Sonde

À remplir à l'étape 1.

## Étapes

- **Bloc 0**
  - [x] **Étape 0 : branche, plan de frise-1 archivé, plan du lot, D-180 et D-181, ETAT.** (commit « Étape 0 : plan du lot ordre-bords, D-180 et D-181, ETAT », après `381480a`)
- **Bloc 1**
  - [ ] **Étape 1 : sonde (R0, A, B, variante s'il y a lieu ; cas 1 à 7), arrêt pour le choix, puis D-182 et SPEC 5.8 (1.12).**
- **Bloc 2**
  - [ ] **Étape 2 : règle retenue dans le moteur, cas 1 à 7 en tests, plafonds, bench, ARCHITECTURE, PIEGES, ETAT.**
