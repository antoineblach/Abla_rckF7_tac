// Data model, schemaVersion 3 (SPEC 4.1; lot 3: kicks and breakdowns; lot 3 bis: segment speeds,
// runs ending at speed, synchronisation links, release on receipt). Units: metres, seconds, m/s.
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

/** Speed of a run segment: a named pace (settings), or a speed in m/s (lot 3 bis, D-114). */
export type SegmentSpeed = Pace | number

/** Waypoint; `speed` is the speed of the segment that ARRIVES at this point (D-114). */
export interface Waypoint extends Vec2 {
  speed?: SegmentSpeed
}

/** Event of another action of the same phase that a run is synchronised with (SPEC 5.8). */
export type SyncTarget =
  | { actionId: Id; event: 'runEnd' }
  | { actionId: Id; event: 'runPoint'; index: number }
  | { actionId: Id; event: 'release' }
  | { actionId: Id; event: 'arrival' }
  | { actionId: Id; event: 'formation' }

export type SyncEvent = SyncTarget['event']

export const SYNC_EVENTS: readonly SyncEvent[] = [
  'runEnd',
  'runPoint',
  'release',
  'arrival',
  'formation',
]

/** Synchronisation link of a run (SPEC 5.8, D-108). */
export interface RunSync {
  target: SyncTarget
  /** Waypoint of this run that meets the target (rendez-vous); absent: its end. */
  at?: number
  /** « Départ différé » (computed delay) or « Vitesse ajustée » (common speed factor). */
  adjust: 'delay' | 'speed'
}

export interface RunAction {
  id: Id
  type: 'run'
  entityId: Id
  /** Segment i goes from point i - 1 (the start position for i = 0) to point i. */
  waypoints: Waypoint[]
  /** Pace of the run: speed of the segments without their own speed. */
  pace: Pace
  /** Imposed duration: every speed scaled by a common factor (D-107). */
  durationOverride?: number
  /** Ignored while a « départ différé » link applies (SPEC 5.8). */
  delay: number
  /** « Finit lancée » (SPEC 5.2, D-106). */
  endsAtSpeed?: true
  sync?: RunSync
}

/** Release of a pass or a kick on receipt of the ball, plus the delay (SPEC 5.4, D-110). */
export type ReleaseMode = 'onReceipt'

export interface PassAction {
  id: Id
  type: 'pass'
  fromId: Id
  toId: Id
  /** Fixed release: from the phase start; on receipt: control time after the reception. */
  delay: number
  ballSpeed?: number
  /** Absent: release at a fixed instant (D-110). */
  release?: ReleaseMode
}

export type KickKind = 'restart' | 'long'

export const KICK_KINDS: readonly KickKind[] = ['restart', 'long']

export type KickTarget = { receiverId: Id } | { point: Vec2 }

/** Kick (SPEC 10.4): restart, or long kick / switch. */
export interface KickAction {
  id: Id
  type: 'kick'
  kickerId: Id
  kind: KickKind
  target: KickTarget
  /** Fixed release: from the phase start; on receipt: control time after the reception. */
  delay: number
  /** Default: KICK_FLIGHT_TIME of its kind. */
  flightTime?: number
  /** Absent: release at a fixed instant (D-110). */
  release?: ReleaseMode
}

export type BreakdownKind = 'ruck' | 'maul'

export const BREAKDOWN_KINDS: readonly BreakdownKind[] = ['ruck', 'maul']

export type BreakdownContest = 'guard' | 'jackal'

/** Ruck or maul (SPEC 10.3). Only `contest` records the defence roles (D-078). */
export interface BreakdownAction {
  id: Id
  type: 'breakdown'
  kind: BreakdownKind
  /** The carrier who is tackled. */
  tackledId: Id
  supportId: Id
  relayerId: Id
  /** Formation instant in the phase. */
  delay: number
  duration: number
  /** Override of the defence setting (lot 4); absent: the setting applies. */
  contest?: BreakdownContest
}

export function isReceiverTarget(target: KickTarget): target is { receiverId: Id } {
  return 'receiverId' in target
}

export type Action = RunAction | PassAction | KickAction | BreakdownAction | GroupRunAction // lot 5

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
  schemaVersion: 3
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
