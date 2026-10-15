// State of a scene at an instant: everything render() needs to draw one image (SPEC 3.3).
import type { Issue } from '../model/issues'
import type { Id, Team, Vec2 } from '../model/types'

export type BallState =
  | { kind: 'carried'; carrierId: Id; pos: Vec2 }
  | {
      kind: 'inFlight'
      from: Vec2
      to: Vec2
      releaseT: number
      arrivalT: number
      toId: Id
      pos: Vec2
    }
  /** Ball on the ground. Lot 1: only a starting ball without carrier, never picked up (lot 3). */
  | { kind: 'loose'; pos: Vec2 }
  /** Lot 3: ball in a ruck or a maul. Declared only. */
  | { kind: 'inBreakdown'; pos: Vec2 }

export interface ScenePlayer {
  id: Id
  team: Team
  number: number
  color: string
  pos: Vec2
}

export interface RunTrace {
  actionId: Id
  entityId: Id
  phaseId: Id
  /** True for the phase being played (drawn emphasised), false for previous phases (faded). */
  current: boolean
  points: Vec2[]
}

export interface PassTrace {
  actionId: Id
  phaseId: Id
  current: boolean
  from: Vec2
  /** Arrival point, or current ball position while in flight. */
  to: Vec2
  completed: boolean
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
  /** Abscissa of the gain line (ball at t = 0), null without ball (SPEC 5.6). */
  gainLineX: number | null
  issues: Issue[]
}
