import { describe, expect, it } from 'vitest'
import {
  ARC_LENGTH_SAMPLES_PER_SEGMENT,
  MIN_CORNER_SPEED,
  MOTION_DEFAULTS,
  PACE_DEFAULTS,
} from '../config/defaults'
import type { MotionSettings } from '../model/settings'
import type { Vec2 } from '../model/types'
import {
  buildProfile,
  distanceAt,
  segmentPeak,
  solveFactor,
  speedAt,
  timeAtDistance,
  timeAtSegmentEnd,
  type SpeedProfile,
} from './profile'
import { PROFILE_TOLERANCE, exactMotion, straightRun, timeFromRest } from '../test/profileMath'
import { buildSpline, pointAtDistance } from './spline'

const motion: MotionSettings = { ...MOTION_DEFAULTS }
const sprint = PACE_DEFAULTS.sprint

function expectDuration(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(PROFILE_TOLERANCE)
}

function profileOf(
  points: Vec2[],
  targets: number[],
  extra: {
    startSpeed?: number
    endsAtSpeed?: boolean
    motion?: MotionSettings
    boundScale?: number[]
  } = {},
): SpeedProfile {
  return buildProfile({
    spline: buildSpline(points, ARC_LENGTH_SAMPLES_PER_SEGMENT),
    targets,
    ...(extra.boundScale ? { boundScale: extra.boundScale } : {}),
    startSpeed: extra.startSpeed ?? 0,
    endsAtSpeed: extra.endsAtSpeed ?? false,
    motion: extra.motion ?? motion,
    sprint,
  })
}

/** Straight line from the origin along x, cut into `segments` equal segments. */
function straight(length: number, segments = 1): Vec2[] {
  return Array.from({ length: segments + 1 }, (_, i) => ({ x: (length * i) / segments, y: 0 }))
}

/** Mean acceleration of interval k (exact: d(v²)/ds = 2 a). */
function meanAccel(p: SpeedProfile, k: number): number {
  const ds = (p.s[k + 1] ?? 0) - (p.s[k] ?? 0)
  return ((p.v[k + 1] ?? 0) ** 2 - (p.v[k] ?? 0) ** 2) / (2 * ds)
}

function sampleSpeed(p: SpeedProfile, k: number): number {
  const v = p.v[k]
  if (v === undefined) throw new Error(`no sample ${k}`)
  return v
}

describe('speed profile: calibration (D-135)', () => {
  // Target at 0.95 times the top speed, the highest that keeps the asymptote at the top speed
  // (Q13), reached at 17.5 m; the measured runs end at speed, so that no braking comes first.
  const target = 0.95 * motion.topSpeed

  it('meets the split times of an amateur player from rest: 10, 20 and 50 m', () => {
    const at = (length: number, segments: number) =>
      profileOf(straight(length, segments), new Array<number>(segments).fill(target), {
        endsAtSpeed: true,
      }).duration
    expect(Math.abs(at(10, 1) - 2.62)).toBeLessThan(0.05)
    expect(Math.abs(at(20, 1) - 4.24)).toBeLessThan(0.05)
    expect(Math.abs(at(50, 2) - 8.98)).toBeLessThan(0.05)
    // The same times by the closed forms of the exact model (8.975 s at 50 m).
    for (const [length, time] of [
      [10, 2.62],
      [20, 4.24],
      [50, 8.98],
    ] as const) {
      expect(Math.abs(timeFromRest(length, target, motion, sprint) - time)).toBeLessThan(0.01)
    }
  })

  it('accelerates by a(v) = a0 (1 − v / vmax): less and less as the speed rises', () => {
    const p = profileOf(straight(30), [target], { endsAtSpeed: true })
    const { a0, vmax } = exactMotion(target, motion, sprint)
    expect(a0).toBe(motion.accel)
    expect(vmax).toBe(motion.topSpeed)
    let previous = Infinity
    for (let k = 0; sampleSpeed(p, k + 1) < target; k++) {
      const mean = meanAccel(p, k)
      // The mean over an interval lies between the accelerations at its two speeds.
      expect(mean).toBeLessThanOrEqual(a0 * (1 - sampleSpeed(p, k) / vmax) + 1e-9)
      expect(mean).toBeGreaterThanOrEqual(a0 * (1 - sampleSpeed(p, k + 1) / vmax) - 1e-9)
      expect(mean).toBeLessThan(previous)
      previous = mean
    }
    expect(Math.max(...p.v)).toBeCloseTo(target, 9)
  })

  it('starts more gently at the walk and the jog: a0 × target / sprint (Q14)', () => {
    for (const pace of [PACE_DEFAULTS.walk, PACE_DEFAULTS.jog]) {
      const p = profileOf(straight(10), [pace])
      const a0 = (motion.accel * pace) / sprint
      expect(exactMotion(pace, motion, sprint).a0).toBeCloseTo(a0, 12)
      expect(meanAccel(p, 0)).toBeLessThanOrEqual(a0)
      expect(meanAccel(p, 0)).toBeGreaterThan(0.85 * a0)
      expectDuration(p.duration, straightRun(10, pace, motion, sprint))
    }
    // From the sprint on, the same start.
    expect(exactMotion(6.5, motion, sprint).a0).toBe(motion.accel)
    expect(meanAccel(profileOf(straight(10), [6.5]), 0)).toBeGreaterThan(0.85 * motion.accel)
  })

  it('reaches a target above 0.95 times the top speed: raised asymptote (Q13)', () => {
    const fast = 28 / 3.6
    const p = profileOf(straight(30, 2), [fast, fast], { endsAtSpeed: true })
    expect(Math.max(...p.v)).toBeCloseTo(fast, 9)
    expect(exactMotion(fast, motion, sprint).vmax).toBeCloseTo(fast / 0.95, 12)
    expectDuration(p.duration, timeFromRest(30, fast, motion, sprint))
  })
})

describe('speed profile: durations (SPEC 5.3, D-105, D-135)', () => {
  it('matches the exact model on a long straight run', () => {
    const p = profileOf(straight(30), [5.5])
    expectDuration(p.duration, straightRun(30, 5.5, motion, sprint))
    expect(p.duration).toBeCloseTo(6.98, 2)
    expect(Math.max(...p.v)).toBeCloseTo(5.5, 9)
  })

  it('matches the exact model on a short run that never reaches its pace', () => {
    const p = profileOf(
      [
        { x: 0, y: 0 },
        { x: 0, y: 4 },
      ],
      [5.5],
    )
    expectDuration(p.duration, straightRun(4, 5.5, motion, sprint))
    expect(Math.max(...p.v)).toBeLessThan(5.5)
  })

  it('follows the motion settings', () => {
    const quick: MotionSettings = { accel: 7, decel: 8, lateralAccel: 4, topSpeed: 8 }
    const fast = profileOf(straight(20), [4], { motion: quick })
    expectDuration(fast.duration, straightRun(20, 4, quick, sprint))
    expect(fast.duration).toBeLessThan(profileOf(straight(20), [4]).duration - 0.1)
  })

  it('ends at speed, or starts at speed, without the ramps', () => {
    const ends = profileOf(straight(20), [4], { endsAtSpeed: true })
    expectDuration(ends.duration, straightRun(20, 4, motion, sprint, 0, 4))
    expect(ends.v[ends.v.length - 1]).toBeCloseTo(4, 9)
    const starts = profileOf(straight(20), [4], { startSpeed: 4 })
    expectDuration(starts.duration, straightRun(20, 4, motion, sprint, 4, 0))
    expect(starts.v[0]).toBe(4)
    // Launched below its pace: it goes on accelerating from its start speed.
    const launched = profileOf(straight(20), [5.5], { startSpeed: 3 })
    expect(launched.v[0]).toBe(3)
    expectDuration(launched.duration, straightRun(20, 5.5, motion, sprint, 3, 0))
  })

  it('lasts nothing for a run without length', () => {
    const p = profileOf(
      [
        { x: 3, y: 3 },
        { x: 3, y: 3 },
      ],
      [4],
    )
    expect(p.duration).toBe(0)
    expect(distanceAt(p, 1)).toBe(0)
    expect(speedAt(p, 0.5)).toBe(0)
  })
})

describe('speed profile: continuity (SPEC 5.3, 5.5)', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 2 },
    { x: 14, y: 10 },
    { x: 20, y: 9 },
  ]
  const spline = buildSpline(points, ARC_LENGTH_SAMPLES_PER_SEGMENT)
  const input = {
    spline,
    targets: [2, 5.5, 4],
    startSpeed: 0,
    endsAtSpeed: false,
    motion,
    sprint,
  }
  const p = buildProfile(input)

  it('moves continuously, speed and acceleration bounded', () => {
    const dt = 0.001
    const steepest = Math.max(motion.accel, motion.decel)
    let previous = distanceAt(p, 0)
    let previousSpeed = speedAt(p, 0)
    for (let t = dt; t <= p.duration + dt; t += dt) {
      const s = distanceAt(p, t)
      const v = speedAt(p, t)
      expect(s - previous).toBeGreaterThanOrEqual(-1e-12)
      expect(s - previous).toBeLessThanOrEqual(5.5 * dt + 1e-9)
      expect(Math.abs(v - previousSpeed)).toBeLessThanOrEqual(steepest * dt + 1e-6)
      previous = s
      previousSpeed = v
    }
    expect(previous).toBeCloseTo(spline.length, 9)
  })

  it('keeps position and speed continuous at the samples', () => {
    for (let k = 1; k < p.t.length - 1; k++) {
      const tk = p.t[k] ?? 0
      expect(distanceAt(p, tk)).toBeCloseTo(p.s[k] ?? 0, 9)
      expect(speedAt(p, tk)).toBeCloseTo(sampleSpeed(p, k), 9)
      // Left limit: the end of the previous interval.
      expect(speedAt(p, tk - 1e-9)).toBeCloseTo(sampleSpeed(p, k), 6)
    }
  })

  it('gives a speed equal to the derivative of the distance', () => {
    const h = 1e-5
    for (const t of [0.3, 1.1, 2.5, p.duration / 2, p.duration - 0.2]) {
      const derivative = (distanceAt(p, t + h) - distanceAt(p, t - h)) / (2 * h)
      expect(speedAt(p, t)).toBeCloseTo(derivative, 4)
    }
  })

  it('inverts exactly: time at a distance, distance at a time', () => {
    for (const t of [0.2, 0.9, 1.7, p.duration / 2, p.duration - 0.05]) {
      expect(Math.abs(timeAtDistance(p, distanceAt(p, t)) - t)).toBeLessThan(1e-9)
    }
    for (const s of [0.01, 0.5, 3, spline.length / 2, spline.length - 0.1]) {
      expect(Math.abs(distanceAt(p, timeAtDistance(p, s)) - s)).toBeLessThan(1e-9)
    }
    expect(timeAtDistance(p, 0)).toBe(0)
    expect(timeAtDistance(p, spline.length)).toBe(p.duration)
  })

  it('keeps each segment under its target speed, the slower one at a waypoint', () => {
    expect(segmentPeak(p, 0)).toBeLessThanOrEqual(2 + 1e-9)
    expect(segmentPeak(p, 1)).toBeLessThanOrEqual(5.5 + 1e-9)
    expect(segmentPeak(p, 2)).toBeLessThanOrEqual(4 + 1e-9)
    // Walk then sprint: at the first waypoint she still walks.
    const atWaypoint = speedAt(p, timeAtSegmentEnd(p, 0))
    expect(atWaypoint).toBeLessThanOrEqual(2 + 1e-9)
  })

  it('is deterministic', () => {
    expect(buildProfile(input)).toEqual(p)
  })
})

describe('speed profile: bounds per segment (D-130)', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 2 },
    { x: 14, y: 10 },
    { x: 20, y: 9 },
  ]
  const targets = [2, 5.5, 4]

  it('plays a run scaled as a whole k times faster, turns included', () => {
    const base = profileOf(points, targets)
    const scaled = profileOf(points, targets, { boundScale: [1.6, 1.6, 1.6] })
    expect(scaled.duration).toBeCloseTo(base.duration / 1.6, 9)
    base.v.forEach((v, k) => {
      expect(sampleSpeed(scaled, k)).toBeCloseTo(v * 1.6, 9)
    })
    // The lowest corner speed is scaled too.
    const turn = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 0.5 },
    ]
    const back = profileOf(turn, [5.5, 5.5])
    const backScaled = profileOf(turn, [5.5, 5.5], { boundScale: [2, 2] })
    expect(backScaled.duration).toBeCloseTo(back.duration / 2, 9)
  })

  it('scales only its segments: the others keep their bounds', () => {
    const base = profileOf(points, targets)
    const middle = profileOf(points, targets, { boundScale: [1, 2, 1] })
    // Before: the same walk, up to the same speed at the first waypoint.
    expect(timeAtSegmentEnd(middle, 0)).toBeCloseTo(timeAtSegmentEnd(base, 0), 9)
    expect(segmentPeak(middle, 1)).toBeGreaterThan(segmentPeak(base, 1) + 1)
    expect(segmentPeak(middle, 1)).toBeLessThanOrEqual(2 * 5.5 + 1e-9)
    // After: the same jog, from the same speed at the second waypoint.
    const after = (p: SpeedProfile) => p.duration - timeAtSegmentEnd(p, 1)
    expect(after(middle)).toBeCloseTo(after(base), 9)
    expect(middle.duration).toBeLessThan(base.duration - 0.3)
  })

  it('keeps an imposed start speed continuous', () => {
    const launched = profileOf(straight(20), [4], { startSpeed: 4, boundScale: [1.5] })
    expect(launched.v[0]).toBe(4)
    expect(Math.max(...launched.v)).toBeCloseTo(6, 9)
    expect(launched.duration).toBeLessThan(profileOf(straight(20), [4], { startSpeed: 4 }).duration)
  })
})

describe('speed profile: turns (SPEC 5.3, D-105)', () => {
  it('slows down in a tight turn: v <= sqrt(a_lat × radius)', () => {
    // Quarter circle of radius 5 m, sampled densely: the curve follows the circle closely.
    const radius = 5
    const arc = Array.from({ length: 9 }, (_, i) => {
      const angle = (i / 8) * (Math.PI / 2)
      return { x: radius * Math.sin(angle), y: radius * (1 - Math.cos(angle)) }
    })
    const points = [{ x: -20, y: 0 }, ...arc, { x: radius, y: 25 }]
    const p = profileOf(points, new Array<number>(points.length - 1).fill(7))
    const spline = buildSpline(points, ARC_LENGTH_SAMPLES_PER_SEGMENT)
    const middle = spline.cumulative[Math.floor(spline.cumulative.length / 2)] ?? 0
    const inTurn = speedAt(p, timeAtDistance(p, middle))
    expect(inTurn).toBeLessThanOrEqual(Math.sqrt(4 * radius) * 1.05)
    expect(Math.max(...p.v)).toBeGreaterThan(inTurn + 1)
  })

  it('loses more time in a sharper corner', () => {
    const free: MotionSettings = { ...motion, lateralAccel: 1e6 }
    const lost = (corner: number): number => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: corner },
        { x: 20, y: 0 },
      ]
      return (
        profileOf(points, [5.5, 5.5]).duration -
        profileOf(points, [5.5, 5.5], { motion: free }).duration
      )
    }
    expect(lost(2)).toBeGreaterThanOrEqual(0)
    expect(lost(8)).toBeGreaterThan(lost(2) + 0.1)
  })

  it('turns back at the lowest corner speed', () => {
    const p = profileOf(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 0.5 },
      ],
      [5.5, 5.5],
    )
    expect(Math.min(...p.v.slice(10, -10))).toBeLessThanOrEqual(MIN_CORNER_SPEED + 1e-9)
  })
})

describe('speed factor (SPEC 5.3, D-107)', () => {
  const spline = buildSpline(straight(20), ARC_LENGTH_SAMPLES_PER_SEGMENT)
  const build = (factor: number) =>
    buildProfile({
      spline,
      targets: [4 * factor],
      startSpeed: 0,
      endsAtSpeed: false,
      motion,
      sprint,
    })

  it('finds the factor of an imposed duration', () => {
    const solution = solveFactor(build, (p) => p.duration, 9, 10)
    expect(solution.capped).toBe('none')
    expect(solution.profile.duration).toBeCloseTo(9, 6)
    expect(solution.factor).toBeLessThan(1)
  })

  it('caps the factor and says so when the duration is out of reach', () => {
    const solution = solveFactor(build, (p) => p.duration, 2, 25 / 3.6 / 4)
    expect(solution.capped).toBe('slow')
    expect(solution.factor).toBeCloseTo(25 / 3.6 / 4, 12)
    expect(solution.profile.duration).toBeGreaterThan(2)
  })

  it('is deterministic', () => {
    const a = solveFactor(build, (p) => p.duration, 6.3, 10)
    const b = solveFactor(build, (p) => p.duration, 6.3, 10)
    expect(a.factor).toBe(b.factor)
    expect(pointAtDistance(spline, distanceAt(a.profile, 2))).toEqual(
      pointAtDistance(spline, distanceAt(b.profile, 2)),
    )
  })
})
