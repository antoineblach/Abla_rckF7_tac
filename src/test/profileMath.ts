// Closed forms of the speed profile on a straight line (SPEC 5.3, D-135), for the tests. Never
// imported by the application. Exact model: a(v) = a0 (1 − v / vmax) up to the target speed,
// a0 = accel · min(1, target / sprint), vmax = max(topSpeed, target / 0.95); constant braking.
import { TOP_SPEED_TARGET_RATIO } from '../config/defaults'
import type { MotionSettings } from '../model/settings'

export interface ExactMotion {
  /** Acceleration from rest a0. */
  a0: number
  /** Asymptote of the acceleration. */
  vmax: number
}

/** Acceleration law of a segment of target speed `target` (D-135, Q13, Q14). */
export function exactMotion(target: number, motion: MotionSettings, sprint: number): ExactMotion {
  return {
    a0: motion.accel * Math.min(1, target / sprint),
    vmax: Math.max(motion.topSpeed, target / TOP_SPEED_TARGET_RATIO),
  }
}

/** Time to accelerate from v0 to w. */
export function accelTime({ a0, vmax }: ExactMotion, v0: number, w: number): number {
  return (vmax / a0) * Math.log((vmax - v0) / (vmax - w))
}

/** Distance to accelerate from v0 to w. */
export function accelDistance({ a0, vmax }: ExactMotion, v0: number, w: number): number {
  return (vmax / a0) * (vmax * Math.log((vmax - v0) / (vmax - w)) - (w - v0))
}

/** Distance covered `t` seconds after leaving v0, before reaching any cap. */
export function freeDistance({ a0, vmax }: ExactMotion, v0: number, t: number): number {
  const tau = vmax / a0
  return vmax * t - tau * (vmax - v0) * -Math.expm1(-t / tau)
}

/** Root of an increasing function on [lo, hi], by bisection. */
function solveIncreasing(f: (x: number) => number, lo: number, hi: number): number {
  let a = lo
  let b = hi
  for (let i = 0; i < 200; i++) {
    const mid = (a + b) / 2
    if (f(mid) < 0) a = mid
    else b = mid
  }
  return (a + b) / 2
}

/**
 * Duration of a straight run of length L at target speed c and braking `motion.decel`, from speed
 * v0 to speed vEnd: acceleration, cruise, braking; or acceleration then braking when the target
 * is out of reach.
 */
export function straightRun(
  L: number,
  c: number,
  motion: MotionSettings,
  sprint: number,
  v0 = 0,
  vEnd = 0,
): number {
  const law = exactMotion(c, motion, sprint)
  const d = motion.decel
  const brake = (w: number) => (w * w - vEnd * vEnd) / (2 * d)
  if (accelDistance(law, v0, c) + brake(c) <= L) {
    const cruise = L - accelDistance(law, v0, c) - brake(c)
    return accelTime(law, v0, c) + (c - vEnd) / d + cruise / c
  }
  const peak = solveIncreasing(
    (w) => accelDistance(law, v0, w) + brake(w) - L,
    Math.max(v0, vEnd),
    c,
  )
  return accelTime(law, v0, peak) + (peak - vEnd) / d
}

/** Time for a run from rest at target speed c to cover `distance`, before it starts braking. */
export function timeFromRest(
  distance: number,
  c: number,
  motion: MotionSettings,
  sprint: number,
): number {
  const law = exactMotion(c, motion, sprint)
  const ramp = accelDistance(law, 0, c)
  if (distance > ramp) return accelTime(law, 0, c) + (distance - ramp) / c
  return solveIncreasing((t) => freeDistance(law, 0, t) - distance, 0, accelTime(law, 0, c))
}

/**
 * The sampled profile runs each interval at a constant acceleration: it lags the exact model by
 * a near-constant time, taken almost entirely on its first interval from rest (D-135), about 1 ms
 * per metre of segment. Within this many seconds for the runs of the tests (segments up to 30 m:
 * 28 ms for 30 m at the sprint).
 */
export const PROFILE_TOLERANCE = 0.035
