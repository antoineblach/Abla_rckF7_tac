// Types of later lots, declared only (CLAUDE.md rule 4). Nothing here is implemented
// in lot 1: the v1 file schema rejects them and the engine ignores them with an issue
// (DECISIONS Q4).
import type { Id, Vec2 } from './types'

/** Lot 3 (SPEC 10.4). */
export interface KickAction {
  id: Id
  type: 'kick'
  kickerId: Id
  kind: 'restart' | 'long'
  target: { receiverId: Id } | { point: Vec2 }
  delay: number
  flightTime?: number
}

/** Lot 3 (SPEC 10.3). */
export interface BreakdownAction {
  id: Id
  type: 'breakdown'
  kind: 'ruck' | 'maul'
  tackledId: Id
  supportId: Id
  relayerId: Id
  delay: number
  duration: number
  contest?: 'guard' | 'jackal'
}

/** Lot 5 (SPEC 12). */
export interface GroupRunAction {
  id: Id
  type: 'groupRun'
  entityIds: Id[]
  waypoints: Vec2[]
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

/** Lot 3 (SPEC 10.1). */
export interface PlacementPreset {
  schemaVersion: 1
  id: Id
  name: string
  type: 'scrum' | 'lineout' | 'restart' | 'ruck' | 'free'
  positions: { role: 'attack' | 'defense'; number: number; forward: number; openSide: number }[]
  ball: {
    forward: number
    openSide: number
    carrierRole?: 'attack' | 'defense'
    carrierNumber?: number
  } | null
  createdAt: string
  updatedAt: string
}
