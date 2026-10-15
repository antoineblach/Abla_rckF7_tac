// Data model, schemaVersion 1 (SPEC 4.1). Units: metres, seconds.
import type {
  AnnotationEntity,
  BreakdownAction,
  DefenseSettings,
  EquipmentEntity,
  GroupRunAction,
  KickAction,
  ZoneEntity,
} from './declared'

export type Team = 'A' | 'B'

/** Metres, field frame (SPEC 4.2). */
export interface Vec2 {
  x: number
  y: number
}

/** UUID v4. */
export type Id = string

export type PlayCategory = 'scrum' | 'lineout' | 'restart' | 'phasePlay' | 'drill'

export const PLAY_CATEGORIES: readonly PlayCategory[] = [
  'scrum',
  'lineout',
  'restart',
  'phasePlay',
  'drill',
]

export type Pace = 'walk' | 'jog' | 'sprint'

export const PACES: readonly Pace[] = ['walk', 'jog', 'sprint']

export type DefenseMode = 'manual' | 'auto'

export type FieldView =
  | { kind: 'full' }
  | { kind: 'half'; side: 'attack' | 'defense' }
  | { kind: 'frame'; min: Vec2; max: Vec2 }

export interface FieldSettings {
  length: number
  width: number
  inGoal: number
  view: FieldView
}

export interface PlayerEntity {
  id: Id
  kind: 'player'
  team: Team
  number: number
  color: string
  defenseMode: DefenseMode
}

export interface BallEntity {
  id: Id
  kind: 'ball'
}

export type Entity =
  | PlayerEntity
  | BallEntity
  | EquipmentEntity // lot 5
  | ZoneEntity // lot 5
  | AnnotationEntity // lot 5

export interface RunAction {
  id: Id
  type: 'run'
  entityId: Id
  waypoints: Vec2[]
  pace: Pace
  durationOverride?: number
  delay: number
}

export interface PassAction {
  id: Id
  type: 'pass'
  fromId: Id
  toId: Id
  delay: number
  ballSpeed?: number
}

export type Action =
  | RunAction
  | PassAction
  | KickAction // lot 3
  | BreakdownAction // lot 3
  | GroupRunAction // lot 5

export interface Phase {
  id: Id
  /** null for the root. */
  parentId: Id | null
  /** Empty: computed label; non empty: label typed by the user (DECISIONS Q12). */
  label: string
  /** Text of the option, empty for the trunk. */
  condition: string
  /** Instruction displayed during the phase. */
  instruction: string
  isDefault: boolean
  actions: Action[]
}

export interface PlaySetup {
  positions: Record<Id, Vec2>
  ballCarrierId: Id | null
  ballPosition: Vec2 | null
}

export interface Play {
  schemaVersion: 1
  id: Id
  createdAt: string
  updatedAt: string
  name: string
  category: PlayCategory
  notes: string
  attackingTeam: Team
  field: FieldSettings
  entities: Entity[]
  setup: PlaySetup
  phases: Phase[]
  defenseSettings?: DefenseSettings // lot 4
}

export function isPlayer(entity: Entity | undefined): entity is PlayerEntity {
  return entity?.kind === 'player'
}

export function isBall(entity: Entity | undefined): entity is BallEntity {
  return entity?.kind === 'ball'
}

/** +1 when A attacks (towards +x), -1 when B attacks (SPEC 4.2). */
export function attackDirection(team: Team): 1 | -1 {
  return team === 'A' ? 1 : -1
}

export function otherTeam(team: Team): Team {
  return team === 'A' ? 'B' : 'A'
}
