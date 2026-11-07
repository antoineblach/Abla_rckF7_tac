// State of a scene at an instant: everything render() needs to draw one image (SPEC 3.3).
import type { Issue } from '../model/issues'
import type { BreakdownKind, Id, Team, Vec2 } from '../model/types'

export type BallState =
  | { kind: 'carried'; carrierId: Id; pos: Vec2 }
  | {
      kind: 'inFlight'
      from: Vec2
      to: Vec2
      releaseT: number
      arrivalT: number
      /** Receiver, or null for a kick to a point. */
      toId: Id | null
      pos: Vec2
      via: 'pass' | 'kick'
      /** Height of a kicked ball, 0 on the ground to 1 at the apex; always 0 for a pass. */
      lift: number
    }
  /** Ball on the ground: starting ball without carrier, or after a kick to a point (SPEC 10.4). */
  | { kind: 'loose'; pos: Vec2 }
  /** Ball in a ruck or a maul (SPEC 10.3). */
  | { kind: 'inBreakdown'; pos: Vec2 }

export interface ScenePlayer {
  id: Id
  team: Team
  number: number
  color: string
  pos: Vec2
}

/** A polyline of a run, fast when at the sprint pace of the settings or faster (D-115). */
export interface RunPart {
  points: Vec2[]
  fast: boolean
}

/**
 * An interval of a line (SPEC 5.1, D-139): a sequence, or a gap of a branch where at least one
 * action starts. Between `start` and `end`, in time order, they never overlap.
 */
export interface LineInterval {
  start: number
  end: number
  /** The branch of the line it belongs to. */
  branchId: Id
  /** Its sequence, null for a gap. */
  sequenceId: Id | null
  /** Displayed label of the sequence, empty for a gap. */
  label: string
  /** Instruction of the sequence, empty for a gap. */
  instruction: string
}

export interface RunTrace {
  actionId: Id
  entityId: Id
  branchId: Id
  /** True for an action of the interval being played (emphasised), false before it (faded). */
  current: boolean
  /** True when the run is finished (drawn with its arrow head). */
  completed: boolean
  points: Vec2[]
  /** The same polyline cut by speed (fast segments drawn thicker, D-115). */
  parts: RunPart[]
}

/**
 * Badge of a run segment beyond a threshold (SPEC 5.9, D-112, D-132): round « ! » of the speed in
 * its middle, diamond « + » of the acceleration or « − » of the braking near its peak.
 */
export interface SpeedBadge {
  actionId: Id
  /** Input segment of the run (from point segment - 1 to point segment). */
  segment: number
  pos: Vec2
  level: 'warning' | 'danger'
  kind: 'speed' | 'accel' | 'brake'
}

export interface PassTrace {
  actionId: Id
  branchId: Id
  current: boolean
  from: Vec2
  /** Arrival point, or current ball position while in flight. */
  to: Vec2
  /** Arrival point (receiver position at arrival). */
  target: Vec2
  completed: boolean
  /** « En avant probable » (SPEC 5.7). */
  forward: boolean
}

export interface KickTrace {
  actionId: Id
  branchId: Id
  current: boolean
  from: Vec2
  /** Landing point, or current ball position while in flight. */
  to: Vec2
  /** Landing point (receiver position at arrival, or the target point). */
  target: Vec2
  /** True for a kick to a point (its target is marked, D-084). */
  toPoint: boolean
  completed: boolean
}

/** Ruck or maul in progress at the instant of the scene (SPEC 10.3). */
export interface SceneBreakdown {
  actionId: Id
  kind: BreakdownKind
  pos: Vec2
}

export interface SceneState {
  t: number
  /** Duration of the line, in seconds. */
  duration: number
  line: Id[]
  /** The interval at t, null in a gap where no action starts (SPEC 5.1). */
  interval: LineInterval | null
  /** Instruction of the sequence at t (SPEC 7). */
  instruction: string
  attackingTeam: Team
  field: { length: number; width: number; inGoal: number }
  players: ScenePlayer[]
  ball: BallState | null
  traces: RunTrace[]
  passTraces: PassTrace[]
  kickTraces: KickTrace[]
  breakdowns: SceneBreakdown[]
  /**
   * Segments beyond a speed threshold already entered at t, accelerations and brakings beyond a
   * threshold whose badge is already reached (calque « Vitesses », D-112, D-132).
   */
  speedBadges: SpeedBadge[]
  /** Abscissa of the gain line at t (ball at t = 0, then each ruck or maul), null without ball. */
  gainLineX: number | null
  issues: Issue[]
}
