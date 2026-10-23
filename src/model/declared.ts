// Types of later lots, declared only (CLAUDE.md rule 4). Nothing here is implemented: the file
// schema rejects them and the engine ignores them with an issue (DECISIONS Q4). Kicks,
// breakdowns and placement presets are implemented since lot 3 (types.ts, preset.ts).
import type { Id, Vec2, Waypoint } from './types'

/** Lot 5 (SPEC 12); waypoints with segment speeds since lot 3 bis (D-104). */
export interface GroupRunAction {
  id: Id
  type: 'groupRun'
  entityIds: Id[]
  waypoints: Waypoint[]
  pace: 'walk' | 'jog' | 'sprint'
  durationOverride?: number
  delay: number
}

/** Lot 5 (SPEC 12). */
export interface EquipmentEntity {
  id: Id
  kind: 'equipment'
  type: 'cone' | 'disc' | 'shield' | 'tackleBag' | 'pole'
  color: string
  position: Vec2
}

/** Lot 5 (SPEC 12). */
export interface ZoneEntity {
  id: Id
  kind: 'zone'
  min: Vec2
  max: Vec2
  color: string
  label: string
  showDimensions: boolean
}

/** Lot 5 (SPEC 12). */
export interface AnnotationEntity {
  id: Id
  kind: 'annotation'
  position: Vec2
  text: string
}

/** Lot 4 (SPEC 11.3). */
export interface DefenseSettings {
  system: '6+1' | '7'
  breakdownContest: 'guard' | 'jackal'
  guardSide: 'open'
  lineSpeed: number
  maxAccel: number
  lineTolerance: number
  alignDepth: number
  insideShoulder: number
  reintegrationDelay: number
  sweeperDepth: number
  drift: boolean
}
