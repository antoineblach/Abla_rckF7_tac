// Pass flight (SPEC 5.4): straight line at constant speed, from the passer position at release
// to the receiver position evaluated at arrival time, solved by fixed point.
import { PASS_FIXED_POINT_ITERATIONS } from '../config/defaults'
import type { Vec2 } from '../model/types'
import { distance } from './vec'

/**
 * arrivalT = releaseT + distance(from, receiver(arrivalT)) / speed.
 * Fixed number of iterations for determinism; converges while the receiver is slower than the ball.
 */
export function solvePassArrival(
  from: Vec2,
  releaseT: number,
  speed: number,
  receiverAt: (t: number) => Vec2,
  iterations = PASS_FIXED_POINT_ITERATIONS,
): number {
  if (speed <= 0) return releaseT
  let arrivalT = releaseT + distance(from, receiverAt(releaseT)) / speed
  for (let i = 1; i < iterations; i++) {
    arrivalT = releaseT + distance(from, receiverAt(arrivalT)) / speed
  }
  return arrivalT
}
