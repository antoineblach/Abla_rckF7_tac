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

export interface RunTrace {
  actionId: Id
  entityId: Id
  phaseId: Id
  /** True for the phase being played (drawn emphasised), false for previous phases (faded). */
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
  phaseId: Id
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
  phaseId: Id
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
  /** Index of the current phase in the line, -1 when the line is empty. */
  phaseIndex: number
  phaseId: Id | null
  phaseStart: number
  phaseEnd: number
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
