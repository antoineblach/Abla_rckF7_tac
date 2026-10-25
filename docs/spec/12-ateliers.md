## 12. Ateliers (lot 5)

- Matériel : plots, coupelles, boucliers de contact, sacs de plaquage, piquets. Statiques, déplaçables, visibles dans tous les temps.
- Zones : rectangles colorés semi-transparents, avec étiquette et cotes affichées (par exemple « 20 x 15 m »).
- Annotations : texte libre positionné sur le terrain.
- Course groupée : une trajectoire appliquée en translation à une sélection de joueuses (chacune garde son décalage).
- Un seul ballon ; pas de rotation animée (consigne ou notes).

```ts
type EquipmentEntity = { id: Id; kind: 'equipment'; type: 'cone' | 'disc' | 'shield' | 'tackleBag' | 'pole'; color: string; position: Vec2 }
type ZoneEntity = { id: Id; kind: 'zone'; min: Vec2; max: Vec2; color: string; label: string; showDimensions: boolean }
type AnnotationEntity = { id: Id; kind: 'annotation'; position: Vec2; text: string }
type GroupRunAction = { id: Id; type: 'groupRun'; entityIds: Id[]; waypoints: Waypoint[]; pace: 'walk' | 'jog' | 'sprint'; durationOverride?: number; delay: number }  // Waypoint depuis le lot 3 bis (D-104)
```

Note : la position des équipements, zones et annotations est portée par l'entité elle-même (ils ne bougent pas), pas par `setup.positions`.

