## 3. Architecture technique

### 3.1 Pile

- TypeScript en mode strict, Vite, React (interface uniquement), Zustand (état), zod (validation), idb-keyval (IndexedDB).
- Lot 2 : gifenc (encodage GIF), jsPDF (PDF), chargés seulement dans le Web Worker d'export (D-076, D-077).
- Tests : Vitest (unitaires), Playwright (bout en bout, Chromium et Firefox) ; pdf.js (`pdfjs-dist`) et omggif relisent les PDF et GIF produits (D-070).
- Toute autre dépendance est justifiée dans le plan du lot concerné.

### 3.2 Arborescence cible de `src/`

```
src/
  config/defaults.ts        valeurs par défaut, sourcées ou HYPOTHÈSE
  model/                    types, schémas zod, migrations, validation métier
  field/                    géométrie et tracé du terrain
  engine/                   evaluate(), trajectoires, ballon, validations
    defense/                (lot 4) simulation défensive
  render/                   render(), mode schéma, viewport, thèmes, calques
  editor/                   outils, sélection, commandes, annuler/rétablir
  player/                   lecture, transport, options
  io/                       LibraryStore, dossier, IndexedDB, fichiers
  export/                   (lot 2) noms, lisibilité, cadrage ; gif/, pdf/, worker/ (protocole, Worker)
  ui/                       composants React
  state/                    stores Zustand, session (D-027)
  types/                    déclarations d'API du navigateur et de gifenc (D-027)
  test/                     outils de test et fixtures, jamais importés par l'application (D-027)
```

Les tests de bout en bout sont dans `e2e/`, à la racine du dépôt (D-027).

### 3.3 Principes d'architecture

1. **Pureté.** `evaluate(play, branchPath, t, settings, caches) -> SceneState` est une fonction pure (`settings` : allures, vitesse de passe, profil de vitesse et seuils de vitesse de `reglages.json`, D-003, D-105, D-111) : aucune lecture d'horloge, aucun aléa, aucun état global. Les caches sont passés en paramètre et indexés par un hachage du contenu.
2. **Rendu unique.** `render(ctx, state, viewport, theme, layers)` dessine une image. `renderSchematic(ctx, play, branchPath, phaseId, viewport, theme, settings, caches)` dessine un temps à l'arrêt (D-003). Les deux fonctionnent sur un canvas affiché, sur un `OffscreenCanvas` et sur tout objet compatible avec le contexte 2D, dont celui de jsPDF : aucun chemin n'y est construit sous une transformation (ballon en courbes de Bézier) et les vignettes y sont découpées explicitement (D-071).
3. **Aplats uniquement.** Le rendu n'utilise ni dégradé, ni motif, ni flou d'ombre. Raison : le contexte 2D de jsPDF ne gère ni dégradés ni motifs en trait (établi), et les GIF sont limités à une palette.
4. **Viewport.** Seule couche qui connaît les pixels. Il gère la conversion mètres vers pixels, le cadrage (terrain complet, demi-terrain, cadre libre, cadrage automatique) et l'orientation (paysage : terrain fixe, x vers la droite, sens d'attaque montré par des flèches sur la ligne d'avantage ; portrait avec rotation de 90° et attaque vers le haut de l'image ; carré comme le portrait). Une rotation supplémentaire de 180° existe : les GIF paysage attaquent toujours vers la droite (D-006). Des marges intérieures cadrent le terrain d'un GIF sous son en-tête et son bandeau (D-073).
5. **Trajectoires précalculées.** `evaluate` sait échantillonner des trajectoires calculées à l'avance (défense simulée, lot 4), mises en cache par (combinaison, branche, réglages).
6. **Déterminisme vérifié.** Mêmes entrées, mêmes pixels, mêmes octets d'export.
7. **Séparation.** Aucune logique métier dans les composants React. React affiche ; Zustand porte l'état ; `model`, `engine`, `io` portent la logique.

### 3.4 Déploiement et intégration continue

- `base` de Vite = `/Abla_rckF7_tac/`, casse exacte.
- Workflow GitHub Actions sur chaque push et chaque PR : `lint`, `typecheck`, `test`, `test:e2e`. Déploiement sur Pages depuis `main` uniquement si tout passe.
- Une branche par lot (`lot-1`, `lot-2`...), fusion par PR.
- `main` est protégée : le statut « checks » de la CI est obligatoire avant fusion, administrateurs compris, sans revue exigée (D-028).

### 3.5 Stockage navigateur

- IndexedDB et localStorage sont partagés par toutes les pages de l'origine `<utilisateur>.github.io`. Toutes les clés sont préfixées par `abla-rck7:`.
- IndexedDB contient uniquement : le handle du dossier choisi, un cache de lecture, le brouillon non enregistré et, en mode dégradé (section 8.6), la bibliothèque complète, sa corbeille et les réglages (D-021).
- Brouillon : écrit à chaque modification, effacé après un enregistrement réussi ; au démarrage, s'il diffère de la version enregistrée, « Restaurer le brouillon » ou « Ignorer » sont proposés (D-025).
- localStorage contient les préférences propres à chaque poste (calques, vitesse, boucle, pause entre les temps, « S'arrêter aux options », orientation, panneau replié), non synchronisées (D-026).

