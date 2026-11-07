// Gap at a cut point (D-139 Q4, D-161, D-176): two runs glued against one run through the same
// points, at the same speeds. Close, not identical: the first run is straight and the junction
// changes the trajectory near the point (SPEC 5.8).
import { describe, expect, it } from 'vitest'
import { ARC_LENGTH_SAMPLES_PER_SEGMENT } from '../config/defaults'
import { buildProfile, brakingOf } from './profile'
import { buildSpline, pointAtDistance } from './spline'
import { distance } from './vec'
import { defaultSettings, engineSettingsOf, type EngineSettings } from '../model/settings'
import type { Pace, Play, Vec2 } from '../model/types'
import { P, basePlay, player, run, uuid } from '../test/builders'
import { createCaches } from './caches'
import { motionEnd, motionSpeed, waypointTime, type RunMotion } from './motion'
import { compileLine, type CompiledLine } from './timeline'

const settings: EngineSettings = engineSettingsOf(defaultSettings())
const A = uuid(1)
const B = uuid(2)
const SINGLE = uuid(10)
const BEFORE = uuid(11)
const AFTER = uuid(12)
const PACES: Pace[] = ['walk', 'jog', 'sprint']

/** Lengths on each side of the cut point, in metres. */
const LEGS: readonly [number, number][] = [
  [5, 5],
  [8, 8],
  [10, 10],
  [15, 15],
  [20, 20],
  [20, 10],
  [10, 20],
  [30, 10],
  [10, 30],
]

/** HYPOTHÈSE (D-161): turn up to 45°: trajectory gap, as a share of the length of the whole run. */
const TURN_TRAJECTORY_SHARE = 0.05
/** HYPOTHÈSE (D-161): turn up to 45°: gap of the instant at the cut point, in seconds. */
const TURN_CUT_INSTANT = 0.25
/** HYPOTHÈSE (D-161): turn up to 45°: gap of the instant of arrival, in seconds. */
const TURN_ARRIVAL_INSTANT = 0.4
/** HYPOTHÈSE (D-161): straight line: gap of the trajectory, in metres. */
const STRAIGHT_TRAJECTORY = 0.01
/** HYPOTHÈSE (D-161): straight line: gap of each instant, in seconds. */
const STRAIGHT_INSTANT = 0.03
/** HYPOTHÈSE (D-176): turn at 90°: gap of the instant at the cut point, in seconds. */
const RIGHT_ANGLE_CUT_INSTANT = 0.3
/** HYPOTHÈSE (D-176): turn at 90°, jog and sprint: gap of the instant of arrival, in seconds. */
const RIGHT_ANGLE_ARRIVAL_INSTANT = 0.6
/** HYPOTHÈSE (D-176): turn at 90°, walk: gap of the instant of arrival, in seconds. */
const RIGHT_ANGLE_WALK_ARRIVAL_INSTANT = 1.2
/** Rounding of the speeds at a junction. */
const BRAKING_TOLERANCE = 1e-6
/**
 * Sweeps over every geometry and pace: 1.4 s alone and 2.9 s in the whole suite on a desktop
 * computer, above the default 5 s on the CI runner, slower.
 */
const SWEEP_TIMEOUT_MS = 30_000

interface Geometry {
  start: Vec2
  cut: Vec2
  end: Vec2
}

function geometry(before: number, after: number, degrees: number): Geometry {
  const angle = (degrees * Math.PI) / 180
  const cut = { x: 20 + before, y: 30 }
  return {
    start: { x: 20, y: 30 },
    cut,
    end: { x: cut.x + after * Math.cos(angle), y: cut.y + after * Math.sin(angle) },
  }
}

const scene = (g: Geometry, actions: Play['actions']): Play =>
  basePlay({
    entities: [player(A, 'A', 1), player(B, 'A', 2)],
    setup: {
      positions: { [A]: g.start, [B]: { x: 0, y: 0 } },
      ballCarrierId: null,
      ballPosition: null,
    },
    actions,
  })

const compile = (play: Play): CompiledLine => compileLine(play, [P.root], settings, createCaches())

function motionOf(compiled: CompiledLine, id: string): RunMotion {
  const found = compiled.motions.find((m) => m.actionId === id)
  if (!found) throw new Error(`no motion ${id}`)
  return found
}

const SAMPLES = 400

const sampled = (m: RunMotion): Vec2[] =>
  Array.from({ length: SAMPLES + 1 }, (_, i) =>
    pointAtDistance(m.spline, (m.spline.length * i) / SAMPLES),
  )

function toSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const squared = dx * dx + dy * dy
  const k =
    squared === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / squared))
  return distance(p, { x: a.x + k * dx, y: a.y + k * dy })
}

function toPolyline(p: Vec2, points: readonly Vec2[]): number {
  let best = Infinity
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (a && b) best = Math.min(best, toSegment(p, a, b))
  }
  return best
}

/** Largest distance between two curves, both ways. */
function trajectoryGap(a: readonly Vec2[], b: readonly Vec2[]): number {
  const oneWay = (from: readonly Vec2[], to: readonly Vec2[]) =>
    Math.max(...from.map((p) => toPolyline(p, to)))
  return Math.max(oneWay(a, b), oneWay(b, a))
}

function computeGaps(g: Geometry, pace: Pace) {
  const single = compile(scene(g, [run(SINGLE, A, [g.cut, g.end], { pace })]))
  const cut = compile(
    scene(g, [
      run(BEFORE, A, [g.cut], { pace }),
      run(AFTER, A, [g.end], { pace, startGlue: { targetId: BEFORE, event: 'end' } }),
    ]),
  )
  const whole = motionOf(single, SINGLE)
  const before = motionOf(cut, BEFORE)
  const after = motionOf(cut, AFTER)
  return {
    trajectory: trajectoryGap(sampled(whole), [...sampled(before), ...sampled(after)]),
    atCut: Math.abs(whole.start + waypointTime(whole, 0) - motionEnd(before)),
    atArrival: Math.abs(motionEnd(whole) - motionEnd(after)),
    before,
    after,
    codes: cut.issues.map((issue) => issue.code),
  }
}

type Gaps = ReturnType<typeof computeGaps>

/** Gaps already computed, by geometry and pace: several tests read the same ones. */
const computed = new Map<string, Gaps>()

function gaps(g: Geometry, pace: Pace): Gaps {
  const key = `${g.start.x},${g.start.y};${g.cut.x},${g.cut.y};${g.end.x},${g.end.y};${pace}`
  const known = computed.get(key)
  if (known) return known
  const found = computeGaps(g, pace)
  computed.set(key, found)
  return found
}

/** Hardest braking of a motion, its junction included. */
const peakBraking = ({ profile }: RunMotion): number =>
  Math.max(0, ...profile.v.slice(1).map((_, k) => brakingOf(profile, k)))

describe(
  'gap at a cut point against one whole run (D-139 Q4, D-161)',
  { timeout: SWEEP_TIMEOUT_MS },
  () => {
    it('stays within the thresholds in a straight line', () => {
      for (const [a, b] of LEGS) {
        for (const pace of PACES) {
          const found = gaps(geometry(a, b, 0), pace)
          expect(found.trajectory, `${a}/${b} ${pace}`).toBeLessThanOrEqual(STRAIGHT_TRAJECTORY)
          expect(found.atCut, `${a}/${b} ${pace}`).toBeLessThanOrEqual(STRAIGHT_INSTANT)
          expect(found.atArrival, `${a}/${b} ${pace}`).toBeLessThanOrEqual(STRAIGHT_INSTANT)
        }
      }
    })

    it('stays within the thresholds in a turn up to 45°', () => {
      for (const [a, b] of LEGS) {
        for (const degrees of [15, 30, 38, 45]) {
          for (const pace of PACES) {
            const label = `${a}/${b} ${degrees}° ${pace}`
            const found = gaps(geometry(a, b, degrees), pace)
            expect(found.trajectory, label).toBeLessThanOrEqual(TURN_TRAJECTORY_SHARE * (a + b))
            expect(found.atCut, label).toBeLessThanOrEqual(TURN_CUT_INSTANT)
            expect(found.atArrival, label).toBeLessThanOrEqual(TURN_ARRIVAL_INSTANT)
          }
        }
      }
    })

    it('stays within the thresholds at a right angle (D-176)', () => {
      for (const [a, b] of LEGS) {
        for (const pace of PACES) {
          const label = `${a}/${b} ${pace}`
          const found = gaps(geometry(a, b, 90), pace)
          expect(found.atCut, label).toBeLessThanOrEqual(RIGHT_ANGLE_CUT_INSTANT)
          expect(found.atArrival, label).toBeLessThanOrEqual(
            pace === 'walk' ? RIGHT_ANGLE_WALK_ARRIVAL_INSTANT : RIGHT_ANGLE_ARRIVAL_INSTANT,
          )
        }
      }
    })
  },
)

describe('junction of two runs glued (D-176)', { timeout: SWEEP_TIMEOUT_MS }, () => {
  it('never brakes harder than the braking of the settings, up to a right angle', () => {
    for (const [a, b] of LEGS) {
      for (const degrees of [38, 45, 90]) {
        for (const pace of PACES) {
          const label = `${a}/${b} ${degrees}° ${pace}`
          const found = gaps(geometry(a, b, degrees), pace)
          expect(found.codes, label).not.toContain('runBrakeTooHigh')
          expect(peakBraking(found.before), label).toBeLessThanOrEqual(
            settings.motion.decel + BRAKING_TOLERANCE,
          )
          expect(peakBraking(found.after), label).toBeLessThanOrEqual(
            settings.motion.decel + BRAKING_TOLERANCE,
          )
        }
      }
    }
  })

  it('leaves a straight line as it was: the next run does not limit the first one', () => {
    for (const [a, b] of LEGS) {
      for (const pace of PACES) {
        const { before } = gaps(geometry(a, b, 0), pace)
        expect(before.profile, `${a}/${b} ${pace}`).toEqual(
          buildProfile({
            spline: before.spline,
            targets: before.targets,
            startSpeed: 0,
            endsAtSpeed: true,
            motion: settings.motion,
            sprint: settings.paces.sprint,
          }),
        )
      }
    }
  })

  it('changes no trajectory: only the speeds on the curves', () => {
    for (const degrees of [38, 45, 90]) {
      const g = geometry(10, 10, degrees)
      const { before, after } = gaps(g, 'sprint')
      const alone = motionOf(
        compile(scene(g, [run(BEFORE, A, [g.cut], { pace: 'sprint' })])),
        BEFORE,
      )
      expect(before.spline).toEqual(alone.spline)
      const joined = buildSpline([g.cut, g.end], ARC_LENGTH_SAMPLES_PER_SEGMENT, { x: 1, y: 0 })
      after.spline.samples.forEach((point, k) => {
        expect(distance(point, joined.samples[k] ?? { x: NaN, y: NaN })).toBeLessThan(1e-9)
      })
    }
  })
})

describe('rendez-vous at a cut point (SPEC 5.8)', () => {
  it('is met exactly, with the speed and the direction continuous, the levers on the first run', () => {
    const g = geometry(10, 10, 30)
    const wanted = 2.2
    const compiled = compile(
      scene(g, [
        run(uuid(20), B, [{ x: 0, y: 5 }], { durationOverride: wanted }),
        run(BEFORE, A, [g.cut], {
          endGlue: { targetId: uuid(20), event: 'end', keep: 'start' },
        }),
        run(AFTER, A, [g.end], { startGlue: { targetId: BEFORE, event: 'end' } }),
      ]),
    )
    const before = motionOf(compiled, BEFORE)
    const after = motionOf(compiled, AFTER)
    expect(motionEnd(before)).toBeCloseTo(wanted, 9)
    expect(after.start).toBeCloseTo(wanted, 9)
    expect(before.factor).toBeGreaterThan(1)
    expect(after.factor).toBe(1)
    expect(motionSpeed(after, after.start)).toBeCloseTo(
      motionSpeed(before, motionEnd(before) - 1e-9),
      5,
    )
    expect(after.spline.startDirection?.x).toBeCloseTo(1, 9)
    expect(after.spline.startDirection?.y).toBeCloseTo(0, 9)
  })
})
