// Ball events of lot 3 (SPEC 5.7, 10.3, 10.4, D-083, D-085, D-094): pickup of a loose ball,
// forward pass check, kick flight. Pure helpers working on position functions, so that the
// compilation of a phase can use them while it builds its motions.
import {
  FORWARD_PASS_THRESHOLD,
  KICK_FLIGHT_TIME,
  LOOSE_BALL_PICKUP_DISTANCE,
  PICKUP_SEARCH,
} from '../config/defaults'
import { attackDirection, type Id, type KickAction, type Team, type Vec2 } from '../model/types'
import { distance } from './vec'

/** Position of an entity at an absolute instant, undefined when it has no position. */
export type PositionAt = (entityId: Id, t: number) => Vec2 | undefined

/** Flight time of a kick: its own, or the default of its kind (SPEC 10.4). */
export function kickFlightTime(kick: Pick<KickAction, 'kind' | 'flightTime'>): number {
  return kick.flightTime ?? KICK_FLIGHT_TIME[kick.kind]
}

/** Height of a kicked ball, 0 at both ends and 1 at the apex (parabola, D-084). */
export function kickLift(progress: number): number {
  const k = Math.min(1, Math.max(0, progress))
  return 4 * k * (1 - k)
}

/**
 * First player within the pickup distance of a loose ball between `from` and `to` (D-083).
 * Already within reach at `from`: the closest one. Later: the first crossing, found by a fixed
 * step search refined by bisection; ties follow the order of `playerIds`.
 */
export function findPickup(
  ball: Vec2,
  from: number,
  to: number,
  playerIds: readonly Id[],
  positionAt: PositionAt,
): { id: Id; t: number } | null {
  if (to < from) return null
  const reach = (id: Id, t: number): number => {
    const p = positionAt(id, t)
    return p ? distance(p, ball) : Infinity
  }
  let closest: { id: Id; d: number } | null = null
  for (const id of playerIds) {
    const d = reach(id, from)
    if (d <= LOOSE_BALL_PICKUP_DISTANCE && (!closest || d < closest.d)) closest = { id, d }
  }
  if (closest) return { id: closest.id, t: from }
  let previous = from
  for (let k = 1; previous < to; k++) {
    const t = Math.min(from + k * PICKUP_SEARCH.step, to)
    let first: { id: Id; t: number } | null = null
    for (const id of playerIds) {
      if (reach(id, t) > LOOSE_BALL_PICKUP_DISTANCE) continue
      let lo = previous
      let hi = t
      for (let i = 0; i < PICKUP_SEARCH.bisections; i++) {
        const mid = (lo + hi) / 2
        if (reach(id, mid) <= LOOSE_BALL_PICKUP_DISTANCE) hi = mid
        else lo = mid
      }
      if (!first || hi < first.t) first = { id, t: hi }
    }
    if (first) return first
    previous = t
  }
  return null
}

/** Step of the numerical left derivative of a trajectory, in seconds. */
const VELOCITY_STEP = 1e-3

/** Velocity just before t (left derivative, D-085): the speed a passer has when she lets go. */
export function velocityBefore(positionAt: (t: number) => Vec2 | undefined, t: number): Vec2 {
  const before = positionAt(t - VELOCITY_STEP)
  const now = positionAt(t)
  if (!before || !now) return { x: 0, y: 0 }
  return { x: (now.x - before.x) / VELOCITY_STEP, y: (now.y - before.y) / VELOCITY_STEP }
}

/**
 * Forward pass check (SPEC 5.7): ball velocity in the field frame minus the passer velocity at
 * release; flagged when its component towards the attack of the passer's team exceeds the
 * threshold (D-085). The ball flies straight at constant speed (SPEC 5.4).
 */
export function isForwardPass(
  from: Vec2,
  to: Vec2,
  releaseT: number,
  arrivalT: number,
  passerVelocity: Vec2,
  passerTeam: Team,
): boolean {
  const span = arrivalT - releaseT
  if (span <= 0) return false
  const relative = (to.x - from.x) / span - passerVelocity.x
  return relative * attackDirection(passerTeam) > FORWARD_PASS_THRESHOLD
}
