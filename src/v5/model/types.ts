// Data model, schemaVersion 5: continuous timeline, branches, sequences and glues between edges
// (SPEC 4.1, 10.3, 10.4, D-139). Units: metres, seconds, m/s.
import type {
  AnnotationEntity,
  DefenseSettings,
  EquipmentEntity,
  GroupRunAction,
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

/**
 * Event an edge is glued to (SPEC 5.8). start: start of a run, release, formation, start of a
 * sequence. end: end of a run, arrival of a pass or a kick, ball out of a breakdown, end of a
 * sequence, branch point. point: index of a waypoint of a run.
 */
export type GlueEvent = 'start' | 'end' | { point: number }

/** Glue of an edge to an event of the same line (SPEC 5.8). */
export interface GlueRef {
  /** Action, sequence, or branch that divides (with the event `end`). */
  targetId: Id
  event: GlueEvent
  /** Gap >= 0 after the event, default 0 (« Temps de contrôle » on a pass and a kick). */
  offset?: number
}

/** Target moved: the start stays and the duration adapts, or the duration stays and the start follows. */
export type GlueKeep = 'start' | 'duration'

export interface EndGlue extends GlueRef {
  keep: GlueKeep
}

/** Stretch of the timeline between two branch points. */
export interface Branch {
  id: Id
  /** null for the root. */
  parentId: Id | null
  /** Present when it divides: absolute instant of its branch point. */
  branchAt?: number
  /** Branch point glued to an event of the trunk (SPEC 5.8). */
  branchAtGlue?: GlueRef
  /** Empty: computed label « Option A » (D-012). */
  label: string
  /** Text of the option, empty for the root. */
  condition: string
  isDefault: boolean
}

/** Common to all actions and to the sequences. A glued edge keeps its last value (SPEC 4.1). */
export interface Timed {
  id: Id
  branchId: Id
  /** Absolute instant, >= 0: start of a run, release, formation, start of a sequence. */
  start: number
  /** Left edge glued. */
  startGlue?: GlueRef
  /** Right edge glued. */
  endGlue?: EndGlue
}

/** Label and instruction laid on a duration, a block like any other (D-139). */
export interface Sequence extends Timed {
  /** Absolute instant of its end. */
  end: number
  /** Empty: « Séquence n ». */
  label: string
  /** Instruction displayed during the sequence. */
  instruction: string
}

/** A named pace (settings), or a speed in m/s (D-114, D-133). */
export type SpeedValue = Pace | number

/** Speed of a run segment. */
export type SegmentSpeed = SpeedValue

/** Waypoint; `speed` is the speed of the segment that ARRIVES at this point (D-114). */
export interface Waypoint extends Vec2 {
  speed?: SegmentSpeed
}

export interface RunAction extends Timed {
  type: 'run'
  entityId: Id
  /** Segment i goes from point i - 1 (the start position for i = 0) to point i. */
  waypoints: Waypoint[]
  /** Pace of the run: speed of the segments without their own speed (D-133). */
  pace: SpeedValue
  /** Imposed duration: every speed scaled by a common factor (SPEC 5.3, D-107). */
  durationOverride?: number
}

/** `start` is the release. */
export interface PassAction extends Timed {
  type: 'pass'
  fromId: Id
  toId: Id
  ballSpeed?: number
}

export type KickKind = 'restart' | 'long'

export const KICK_KINDS: readonly KickKind[] = ['restart', 'long']

export type KickTarget = { receiverId: Id } | { point: Vec2 }

/** Kick (SPEC 10.4): restart, or long kick / switch. `start` is the release. */
export interface KickAction extends Timed {
  type: 'kick'
  kickerId: Id
  kind: KickKind
  target: KickTarget
  /** Default: KICK_FLIGHT_TIME of its kind. */
  flightTime?: number
}

export type BreakdownKind = 'ruck' | 'maul'

export const BREAKDOWN_KINDS: readonly BreakdownKind[] = ['ruck', 'maul']

export type BreakdownContest = 'guard' | 'jackal'

/** Ruck or maul (SPEC 10.3). `start` is the formation. Only `contest` records the defence roles (D-078). */
export interface BreakdownAction extends Timed {
  type: 'breakdown'
  kind: BreakdownKind
  /** The carrier who is tackled. */
  tackledId: Id
  supportId: Id
  relayerId: Id
  duration: number
  /** Override of the defence setting (lot 4); absent: the setting applies. */
  contest?: BreakdownContest
}

export function isReceiverTarget(target: KickTarget): target is { receiverId: Id } {
  return 'receiverId' in target
}

export type Action = RunAction | PassAction | KickAction | BreakdownAction | GroupRunAction // lot 5

export interface PlaySetup {
  positions: Record<Id, Vec2>
  ballCarrierId: Id | null
  ballPosition: Vec2 | null
}

export interface Play {
  schemaVersion: 5
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
  /** At least the root. */
  branches: Branch[]
  /** Flat array; its order breaks ties. */
  actions: Action[]
  sequences: Sequence[]
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
