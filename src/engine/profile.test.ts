import { describe, expect, it } from 'vitest'
import { ARC_LENGTH_SAMPLES_PER_SEGMENT, MIN_CORNER_SPEED } from '../config/defaults'
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
import { PROFILE_TOLERANCE, trapezoid } from '../test/profileMath'
import { buildSpline, pointAtDistance } from './spline'

const motion: MotionSettings = { accel: 3, decel: 4, lateralAccel: 4 }

function expectDuration(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(PROFILE_TOLERANCE)
}

function profileOf(
  points: Vec2[],
  targets: number[],
  extra: { startSpeed?: number; endsAtSpeed?: boolean; motion?: MotionSettings } = {},
): SpeedProfile {
  return buildProfile({
    spline: buildSpline(points, ARC_LENGTH_SAMPLES_PER_SEGMENT),
    targets,
    startSpeed: extra.startSpeed ?? 0,
    endsAtSpeed: extra.endsAtSpeed ?? false,
    motion: extra.motion ?? motion,
  })
}

describe('speed profile: durations (SPEC 5.3, D-105)', () => {
  it('matches the trapezoid of a long straight run', () => {
    const p = profileOf(
      [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
      ],
      [5.5],
    )
    expectDuration(p.duration, trapezoid(30, 5.5, 3, 4))
    expect(p.duration).toBeCloseTo(7.06, 2)
    expect(Math.max(...p.v)).toBeCloseTo(5.5, 9)
  })

  it('matches the triangle of a short run that never reaches its pace', () => {
    const p = profileOf(
      [
        { x: 0, y: 0 },
        { x: 0, y: 4 },
      ],
      [5.5],
    )
    expectDuration(p.duration, trapezoid(4, 5.5, 3, 4))
    expect(Math.max(...p.v)).toBeLessThan(5.5)
  })

  it('follows the motion settings', () => {
    const fast = profileOf(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ],
      [4],
      {
        motion: { accel: 6, decel: 8, lateralAccel: 4 },
      },
    )
    expectDuration(fast.duration, trapezoid(20, 4, 6, 8))
  })

  it('ends at speed, or starts at speed, without the ramps', () => {
    const ends = profileOf(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ],
      [4],
      { endsAtSpeed: true },
    )
    expectDuration(ends.duration, trapezoid(20, 4, 3, 4, 0, 4))
    expect(ends.v[ends.v.length - 1]).toBeCloseTo(4, 9)
    const starts = profileOf(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ],
      [4],
      { startSpeed: 4 },
    )
    expectDuration(starts.duration, trapezoid(20, 4, 3, 4, 4, 0))
    expect(starts.v[0]).toBe(4)
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
  const p = buildProfile({
    spline,
    targets: [2, 5.5, 4],
    startSpeed: 0,
    endsAtSpeed: false,
    motion,
  })

  it('moves continuously, speed and acceleration bounded', () => {
    const dt = 0.001
    let previous = distanceAt(p, 0)
    let previousSpeed = speedAt(p, 0)
    for (let t = dt; t <= p.duration + dt; t += dt) {
      const s = distanceAt(p, t)
      const v = speedAt(p, t)
      expect(s - previous).toBeGreaterThanOrEqual(-1e-12)
      expect(s - previous).toBeLessThanOrEqual(5.5 * dt + 1e-9)
      expect(Math.abs(v - previousSpeed)).toBeLessThanOrEqual(4 * dt + 1e-6)
      previous = s
      previousSpeed = v
    }
    expect(previous).toBeCloseTo(spline.length, 9)
  })

  it('gives a speed equal to the derivative of the distance', () => {
    const h = 1e-5
    for (const t of [0.3, 1.1, 2.5, p.duration / 2, p.duration - 0.2]) {
      const derivative = (distanceAt(p, t + h) - distanceAt(p, t - h)) / (2 * h)
      expect(speedAt(p, t)).toBeCloseTo(derivative, 4)
    }
  })

  it('inverts exactly: time at a distance', () => {
    for (const t of [0.2, 0.9, 1.7, p.duration / 2, p.duration - 0.05]) {
      expect(timeAtDistance(p, distanceAt(p, t))).toBeCloseTo(t, 9)
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
  const spline = buildSpline(
    [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ],
    ARC_LENGTH_SAMPLES_PER_SEGMENT,
  )
  const build = (factor: number) =>
    buildProfile({ spline, targets: [4 * factor], startSpeed: 0, endsAtSpeed: false, motion })

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
