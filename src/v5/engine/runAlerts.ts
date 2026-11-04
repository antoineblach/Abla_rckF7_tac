// Speeds, accelerations and brakings of a run beyond the thresholds (SPEC 5.9, D-111, D-132). They
// never change the motion (D-129): they only signal it. Pure.
import { ACCEL_BADGE_CLEARANCE, ACCEL_BADGE_SHIFT } from '../../config/defaults'
import { brakingOf, segmentPeak } from '../../engine/profile'
import type { EngineSettings } from '../../model/settings'
import type { Issue } from '../model/issues'
import { motionDistance, type AccelAlert, type RunMotion, type SpeedLevel } from './motion'

const ACCEL_CODES = {
  accel: { warning: 'runAccelHigh', danger: 'runAccelTooHigh' },
  brake: { warning: 'runBrakeHigh', danger: 'runBrakeTooHigh' },
} as const

/**
 * Peak speeds, accelerations and brakings of the segments of a run beyond the thresholds
 * (SPEC 5.9, D-111, D-132).
 */
export function speedIssues(motion: RunMotion): Issue[] {
  const result: Issue[] = []
  const target = { kind: 'action', id: motion.actionId, branchId: motion.branchId } as const
  const { sourceSegments } = motion.spline
  sourceSegments.forEach((source, segment) => {
    const level = motion.speedLevels[segment]
    if (!level) return
    result.push({
      code: level === 'danger' ? 'runSpeedTooHigh' : 'runSpeedHigh',
      severity: level === 'danger' ? 'error' : 'warning',
      target,
      params: { segment: source + 1, speed: segmentPeak(motion.profile, segment) },
      key: String(source),
    })
  })
  for (const alert of motion.accelAlerts) {
    const source = sourceSegments[alert.segment] ?? alert.segment
    result.push({
      code: ACCEL_CODES[alert.kind][alert.level],
      severity: alert.level === 'danger' ? 'error' : 'warning',
      target,
      params: { segment: source + 1, value: alert.peak },
      key: String(source),
    })
  }
  return result
}

/** Relative gap under which two peaks of a segment are equal (rounding along a braking ramp). */
const PEAK_TIE = 1e-9

/**
 * Peak acceleration and braking of each spline segment of a motion beyond the thresholds (D-132,
 * D-135), on the part it runs, like the speeds: acceleration a(v) of the model at the start of an
 * interval that speeds up, constant braking of an interval.
 */
export function accelAlertsOf(motion: RunMotion, settings: EngineSettings): AccelAlert[] {
  const { profile } = motion
  const reach = motion.until === null ? Infinity : motionDistance(motion, motion.until)
  const { s, samplesPerSegment } = profile
  const alerts: AccelAlert[] = []
  motion.spline.sourceSegments.forEach((_, segment) => {
    const first = segment * samplesPerSegment
    const last = Math.min(first + samplesPerSegment, s.length - 1)
    const from = s[first] ?? 0
    const to = Math.min(s[last] ?? 0, reach)
    for (const kind of ['accel', 'brake'] as const) {
      const { warning, danger } = kind === 'accel' ? settings.accelAlert : settings.decelAlert
      const values: { k: number; value: number }[] = []
      let peak = 0
      let peakK = -1
      for (let k = first; k < last && (s[k] ?? Infinity) < reach; k++) {
        const value = kind === 'accel' ? (profile.startAccel[k] ?? 0) : brakingOf(profile, k)
        values.push({ k, value })
        // Equal peaks: the first acceleration (from the start), the last braking (before a stop).
        const tie = PEAK_TIE * Math.max(peak, value)
        if (value > peak + tie || (kind === 'brake' && value > 0 && value >= peak - tie)) {
          peak = Math.max(peak, value)
          peakK = k
        }
      }
      const level = peak > danger ? 'danger' : peak > warning ? 'warning' : null
      if (!level || peakK < 0) continue
      const threshold = level === 'danger' ? danger : warning
      const zone = values
        .filter((x) => x.value > threshold)
        .map((x): [number, number] => [s[x.k] ?? 0, Math.min(s[x.k + 1] ?? 0, to)])
      const peakStart = s[peakK] ?? 0
      const peakAt =
        kind === 'accel' ? peakStart : (peakStart + Math.min(s[peakK + 1] ?? 0, to)) / 2
      alerts.push({
        segment,
        kind,
        level,
        peak,
        badgeAt: accelBadgeAt(from, to, zone, peakAt, kind === 'brake'),
      })
    }
  })
  return alerts
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(Math.max(x, lo), hi)

/**
 * Arc length of the badge of an acceleration or braking alert on the segment [from, to] (D-132):
 * the point of the zone beyond the threshold nearest to the peak, at least ACCEL_BADGE_CLEARANCE
 * from the ends, where the token or a handle covers the peak (start of a run, stop, rendez-vous);
 * the point of that range nearest to the peak when the zone does not reach it. A segment shorter
 * than twice the clearance: its middle, moved by ACCEL_BADGE_SHIFT towards the peak (towards the
 * end on a tie for a braking), clear of the speed badge.
 */
export function accelBadgeAt(
  from: number,
  to: number,
  zone: readonly (readonly [number, number])[],
  peakAt: number,
  tieTowardsEnd: boolean,
): number {
  const middle = (from + to) / 2
  if (to - from < 2 * ACCEL_BADGE_CLEARANCE) {
    const towardsEnd = peakAt === middle ? tieTowardsEnd : peakAt > middle
    return clamp(middle + (towardsEnd ? 1 : -1) * ACCEL_BADGE_SHIFT, from, to)
  }
  const lo = from + ACCEL_BADGE_CLEARANCE
  const hi = to - ACCEL_BADGE_CLEARANCE
  let best = clamp(peakAt, lo, hi)
  let gap = Infinity
  for (const [a, b] of zone) {
    if (Math.max(a, lo) > Math.min(b, hi)) continue
    const point = clamp(peakAt, Math.max(a, lo), Math.min(b, hi))
    if (Math.abs(point - peakAt) < gap) {
      best = point
      gap = Math.abs(point - peakAt)
    }
  }
  return best
}

/** Level of the peak speed of each spline segment of a motion (SPEC 5.9, D-111). */
export function speedLevelsOf(motion: RunMotion, settings: EngineSettings): (SpeedLevel | null)[] {
  const { warning, danger } = settings.speedAlert
  // A run frozen by a breakdown is judged on the part it runs only.
  const reach = motion.until === null ? Infinity : motionDistance(motion, motion.until)
  const { s, v, samplesPerSegment } = motion.profile
  return motion.spline.sourceSegments.map((_, segment) => {
    let peak = 0
    const first = segment * samplesPerSegment
    const last = Math.min(first + samplesPerSegment, v.length - 1)
    for (let k = first; k <= last && (s[k] ?? Infinity) <= reach; k++)
      peak = Math.max(peak, v[k] ?? 0)
    return peak > danger ? 'danger' : peak > warning ? 'warning' : null
  })
}
