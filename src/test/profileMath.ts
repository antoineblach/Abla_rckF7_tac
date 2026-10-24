// Closed forms of the speed profile on a straight line (SPEC 5.3, D-105), for the tests. Never
// imported by the application.

/**
 * Duration of a straight run of length L at peak speed v, acceleration a and braking d, from
 * speed v0 to speed vEnd: trapezoid, or triangle when the peak is out of reach.
 */
export function trapezoid(L: number, v: number, a: number, d: number, v0 = 0, vEnd = 0): number {
  const accelDist = (v * v - v0 * v0) / (2 * a)
  const brakeDist = (v * v - vEnd * vEnd) / (2 * d)
  if (accelDist + brakeDist <= L) {
    return (v - v0) / a + (v - vEnd) / d + (L - accelDist - brakeDist) / v
  }
  const w = Math.sqrt((2 * L * a * d + d * v0 * v0 + a * vEnd * vEnd) / (a + d))
  return (w - v0) / a + (w - vEnd) / d
}

/** Time for a run from rest (acceleration a, peak v) to cover d, before it starts braking. */
export function timeFromRest(d: number, v: number, a: number): number {
  const ramp = (v * v) / (2 * a)
  return d <= ramp ? Math.sqrt((2 * d) / a) : v / a + (d - ramp) / v
}

/** The profile is exact on its samples: within this many seconds of the continuous trapezoid. */
export const PROFILE_TOLERANCE = 5e-3
