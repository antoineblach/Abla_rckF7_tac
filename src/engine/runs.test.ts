import { describe, expect, it } from 'vitest'
import { ACCEL_BADGE_CLEARANCE, ACCEL_BADGE_SHIFT } from '../config/defaults'
import { segmentPeak } from './profile'
import { distance } from './vec'
import { defaultSettings, engineSettingsOf, type EngineSettings } from '../model/settings'
import { allLines } from '../model/branches'
import type { Action, Id, Play, RunAction } from '../model/types'
import {
  P,
  basePlay,
  ball,
  breakdown,
  pass,
  player,
  realisticRunsPlay,
  run,
  uuid,
} from '../test/builders'
import { createCaches } from './caches'
import { evaluate } from './evaluate'
import { motionSpeed, motionVelocity, type RunMotion } from './motion'
import { accelBadgeAt } from './runAlerts'
import { compileLine, type CompiledLine } from './timeline'

const settings: EngineSettings = engineSettingsOf(defaultSettings())
const { motion } = settings
const A1 = uuid(1)
const A2 = uuid(2)
const LINE = [P.root]

function twoPlayers(actions: Action[]): Play {
  return basePlay({
    entities: [player(A1, 'A', 1), player(A2, 'A', 2), ball(uuid(20))],
    setup: {
      positions: { [A1]: { x: 40, y: 30 }, [A2]: { x: 40, y: 20 } },
      ballCarrierId: A1,
      ballPosition: null,
    },
    actions,
  })
}

const compile = (play: Play, s: EngineSettings = settings): CompiledLine =>
  compileLine(play, LINE, s, createCaches())

function motionOf(compiled: CompiledLine, actionId: Id): RunMotion {
  const found = compiled.motions.find((m) => m.actionId === actionId)
  if (!found) throw new Error(`no motion ${actionId}`)
  return found
}

const codes = (compiled: CompiledLine) => compiled.issues.map((i) => i.code)

describe('segment speeds (SPEC 5.3, D-114)', () => {
  it('runs each segment at its own speed, the pace of the run elsewhere', () => {
    const r = run(uuid(30), A1, [
      { x: 60, y: 30, speed: 'walk' },
      { x: 90, y: 30 },
      { x: 100, y: 30, speed: 3 },
    ])
    const m = motionOf(compile(twoPlayers([r])), r.id)
    expect(m.targets).toEqual([2, 4, 3])
    expect(segmentPeak(m.profile, 0)).toBeCloseTo(2, 9)
    expect(segmentPeak(m.profile, 1)).toBeCloseTo(4, 9)
    expect(segmentPeak(m.profile, 2)).toBeLessThanOrEqual(4 + 1e-9)
    // The walking segment is the slowest by far.
    const sprint = { ...r, pace: 'sprint' as const }
    const fast = motionOf(compile(twoPlayers([sprint])), r.id)
    expect(fast.targets).toEqual([2, 5.5, 3])
    expect(fast.duration).toBeLessThan(m.duration)
  })

  it('runs a typed pace like the same speed typed on every segment (D-133)', () => {
    const points = [
      { x: 55, y: 34 },
      { x: 70, y: 30 },
    ]
    const typed = run(uuid(30), A1, points, { pace: 4.6 })
    const perSegment = run(
      uuid(30),
      A1,
      points.map((p) => ({ ...p, speed: 4.6 })),
      { pace: 'jog' },
    )
    const a = motionOf(compile(twoPlayers([typed])), typed.id)
    const b = motionOf(compile(twoPlayers([perSegment])), typed.id)
    expect(a.targets).toEqual([4.6, 4.6])
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('maps the speeds of zero-length segments away', () => {
    const r = run(uuid(30), A1, [
      { x: 40, y: 30, speed: 'sprint' },
      { x: 50, y: 30, speed: 'walk' },
    ])
    const m = motionOf(compile(twoPlayers([r])), r.id)
    expect(m.targets).toEqual([2])
    expect(m.spline.sourceSegments).toEqual([1])
  })
})

describe('speed alerts (SPEC 5.9, D-111)', () => {
  const at = (kmh: number, length = 60) =>
    compile(twoPlayers([run(uuid(30), A1, [{ x: 40 + length, y: 30, speed: kmh / 3.6 }])]))
  it('warns beyond 20 km/h and errs beyond 25 km/h, on the real peak', () => {
    expect(codes(at(19.9))).toEqual([])
    expect(codes(at(20.1))).toEqual(['runSpeedHigh'])
    expect(codes(at(25.1))).toEqual(['runSpeedTooHigh'])
    const issue = at(25.1).issues[0]
    expect(issue?.params?.segment).toBe(1)
    expect((issue?.params?.speed as number) * 3.6).toBeCloseTo(25.1, 6)
    // A target too high for a 3 m run is never reached: no alert.
    expect(codes(at(30, 3))).toEqual([])
  })

  it('follows the thresholds of the settings', () => {
    const strict = { ...settings, speedAlert: { warning: 3, danger: 3.5 } }
    const compiled = compile(twoPlayers([run(uuid(30), A1, [{ x: 60, y: 30 }])]), strict)
    expect(codes(compiled)).toEqual(['runSpeedTooHigh'])
  })

  it('reports each segment once', () => {
    const r = run(uuid(30), A1, [
      { x: 70, y: 30, speed: 6.5 },
      { x: 100, y: 30, speed: 6.5 },
    ])
    const compiled = compile(twoPlayers([r]))
    expect(compiled.issues.map((i) => [i.code, i.params?.segment, i.key])).toEqual([
      ['runSpeedHigh', 1, '0'],
      ['runSpeedHigh', 2, '1'],
    ])
  })
})

describe('acceleration and braking alerts (D-132)', () => {
  const sprintRun = (extra: Partial<RunAction> = {}, to = { x: 60, y: 30 }) =>
    run(uuid(30), A1, [to], { pace: 'sprint', ...extra })
  const compileRun = (r: RunAction, s: EngineSettings = settings) => compile(twoPlayers([r]), s)
  const alerts = (compiled: CompiledLine) =>
    compiled.issues
      .filter((i) => /^run(Accel|Brake)/.test(i.code))
      .map((i) => [i.code, i.severity, i.params?.segment, i.key])
  const thresholds = (accel: [number, number], decel: [number, number]): EngineSettings => ({
    ...settings,
    accelAlert: { warning: accel[0], danger: accel[1] },
    decelAlert: { warning: decel[0], danger: decel[1] },
  })

  it('stays silent within the bounds of the settings', () => {
    expect(codes(compileRun(sprintRun()))).toEqual([])
  })

  it('warns beyond the orange threshold and errs beyond the red one, on the peaks', () => {
    // From rest to rest: peak acceleration a0 = 5.2 at the start, braking 4 before the stop.
    expect(alerts(compileRun(sprintRun(), thresholds([5, 6], [3.9, 5])))).toEqual([
      ['runAccelHigh', 'warning', 1, '0'],
      ['runBrakeHigh', 'warning', 1, '0'],
    ])
    const red = compileRun(sprintRun(), thresholds([4, 5], [3, 3.9]))
    expect(alerts(red)).toEqual([
      ['runAccelTooHigh', 'error', 1, '0'],
      ['runBrakeTooHigh', 'error', 1, '0'],
    ])
    expect(red.issues[0]?.params?.value).toBe(motion.accel)
    expect(red.issues[1]?.params?.value).toBeCloseTo(motion.decel, 9)
  })

  it('measures the profile once sped up by the levers: peaks times k² (D-130)', () => {
    const compiled = compileRun(sprintRun({ durationOverride: 3.5 }))
    const m = motionOf(compiled, uuid(30))
    expect(m.accelFactor).toBeGreaterThan(2)
    const value = (code: string) => compiled.issues.find((i) => i.code === code)?.params?.value
    expect(value('runAccelTooHigh')).toBeCloseTo(motion.accel * m.accelFactor, 9)
    expect(value('runBrakeTooHigh')).toBeCloseTo(motion.decel * m.accelFactor, 9)
  })

  it('judges a run frozen by a breakdown on the part it runs only', () => {
    const A3 = uuid(3)
    const ruck = (actions: Action[]) =>
      basePlay({
        entities: [player(A1, 'A', 1), player(A2, 'A', 2), player(A3, 'A', 3), ball(uuid(20))],
        setup: {
          positions: { [A1]: { x: 40, y: 30 }, [A2]: { x: 40, y: 33 }, [A3]: { x: 38, y: 36 } },
          ballCarrierId: A1,
          ballPosition: null,
        },
        actions,
      })
    const strict = thresholds([6, 8], [3, 3.9])
    const whole = compile(ruck([sprintRun()]), strict)
    expect(alerts(whole)).toEqual([['runBrakeTooHigh', 'error', 1, '0']])
    // Frozen 2 s after the start, still speeding up: the braking before the stop never comes.
    const cut = compile(ruck([sprintRun(), breakdown(uuid(40), A1, A2, A3, 2)]), strict)
    expect(codes(cut)).toContain('runCutByBreakdown')
    expect(alerts(cut)).toEqual([])
  })

  it('places the badges clear of the ends of the segment, near the peaks', () => {
    const long = motionOf(compileRun(sprintRun({ durationOverride: 3.5 })), uuid(30))
    expect(long.accelAlerts.map((a) => [a.kind, a.badgeAt])).toEqual([
      ['accel', ACCEL_BADGE_CLEARANCE],
      ['brake', 20 - ACCEL_BADGE_CLEARANCE],
    ])
    // A segment shorter than twice the clearance: its middle, moved towards each peak.
    const short = sprintRun({ durationOverride: 1 }, { x: 44.6, y: 30 })
    const m = motionOf(compileRun(short), uuid(30))
    const at = m.accelAlerts.map((a) => [a.kind, a.badgeAt])
    expect(at).toHaveLength(2)
    expect(at[0]?.[0]).toBe('accel')
    expect(at[0]?.[1]).toBeCloseTo(2.3 - ACCEL_BADGE_SHIFT, 9)
    expect(at[1]?.[0]).toBe('brake')
    expect(at[1]?.[1]).toBeCloseTo(2.3 + ACCEL_BADGE_SHIFT, 9)
  })

  it('takes the point of the zone beyond the threshold nearest to the peak', () => {
    const c = ACCEL_BADGE_CLEARANCE
    // A peak clear of the ends: on it.
    expect(accelBadgeAt(0, 20, [[8, 12]], 10, false)).toBe(10)
    // A zone under the token or a handle: the nearest clear point.
    expect(accelBadgeAt(0, 20, [[0, 0.5]], 0, false)).toBe(c)
    expect(accelBadgeAt(0, 20, [[16, 20]], 19.9, true)).toBe(20 - c)
    // Another part of the zone clear of the ends: its point nearest to the peak.
    expect(
      accelBadgeAt(
        10,
        30,
        [
          [10, 11],
          [14, 16],
        ],
        10,
        false,
      ),
    ).toBe(14)
    // A short segment: the middle moved towards the peak, towards the end on a tie for a braking.
    expect(accelBadgeAt(10, 14.6, [[10, 14.6]], 10, false)).toBeCloseTo(
      12.3 - ACCEL_BADGE_SHIFT,
      12,
    )
    expect(accelBadgeAt(10, 14.6, [[10, 14.6]], 12.3, true)).toBeCloseTo(
      12.3 + ACCEL_BADGE_SHIFT,
      12,
    )
    expect(accelBadgeAt(10, 14.6, [[10, 14.6]], 12.3, false)).toBeCloseTo(
      12.3 - ACCEL_BADGE_SHIFT,
      12,
    )
  })
})

describe('motion accessors (SPEC 5.3)', () => {
  it('reads the speed and the velocity on the profile', () => {
    const r = run(uuid(30), A1, [{ x: 80, y: 30 }], { pace: 'sprint', start: 1 })
    const m = motionOf(compile(twoPlayers([r])), r.id)
    expect(motionSpeed(m, 0.5)).toBe(0)
    expect(motionSpeed(m, 4)).toBeCloseTo(5.5, 6)
    expect(motionVelocity(m, 4).x).toBeCloseTo(5.5, 6)
    expect(motionVelocity(m, 4).y).toBeCloseTo(0, 9)
    expect(motionVelocity(m, 0.5)).toEqual({ x: 0, y: 0 })
  })
})

describe('continuity and determinism with profiles (SPEC 5.2, 5.5)', () => {
  const play = realisticRunsPlay()
  const lines = allLines(play)

  it('gives the same state in continuous playback and after a direct jump', () => {
    for (const line of lines) {
      const shared = createCaches()
      const duration = compileLine(play, line, settings, shared).duration
      let t = 0
      for (const target of [0.4, 1.7, duration / 3, duration / 2, duration - 0.2, duration]) {
        while (t < target) {
          evaluate(play, line, t, settings, shared)
          t += 1 / 24
        }
        const continuous = evaluate(play, line, target, settings, shared)
        const jump = evaluate(structuredClone(play), line, target, settings, createCaches())
        expect(JSON.stringify(continuous)).toBe(JSON.stringify(jump))
      }
    }
  })

  it('moves every player continuously, at every start of a motion', () => {
    for (const line of lines) {
      const caches = createCaches()
      const compiled = compileLine(play, line, settings, caches)
      for (const instant of compiled.motions.map((m) => m.start)) {
        const before = evaluate(play, line, instant - 1e-7, settings, caches)
        const after = evaluate(play, line, instant, settings, caches)
        for (const p of after.players) {
          const q = before.players.find((x) => x.id === p.id)
          expect(distance(p.pos, q?.pos ?? { x: NaN, y: NaN })).toBeLessThan(1e-5)
        }
      }
    }
  })

  it('compiles the same bytes twice', () => {
    const a = compileLine(play, lines[0] ?? [], settings, createCaches())
    const b = compileLine(structuredClone(play), lines[0] ?? [], settings, createCaches())
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('passes on profiles (SPEC 5.4, 5.7)', () => {
  it('meets an accelerating receiver exactly at arrival', () => {
    const actions: Action[] = [
      run(uuid(30), A2, [{ x: 70, y: 20 }], { pace: 'sprint' }),
      pass(uuid(31), A1, A2, 0.5),
    ]
    const play = twoPlayers(actions)
    const flight = compile(play).passes[0]
    const receiver = evaluate(
      play,
      LINE,
      flight?.arrivalT ?? NaN,
      settings,
      createCaches(),
    ).players.find((p) => p.id === A2)?.pos
    expect(distance(flight?.to ?? { x: 0, y: 0 }, receiver ?? { x: NaN, y: NaN })).toBeLessThan(
      1e-9,
    )
  })

  it('meets a receiver on a run that starts during the flight', () => {
    // A1 passes at 0 to A2, 10 m away; A2 starts running while the ball flies.
    const actions: Action[] = [
      pass(uuid(31), A1, A2, 0),
      run(uuid(30), A2, [{ x: 40, y: 0 }], { pace: 'sprint', start: 0.3 }),
    ]
    const play = twoPlayers(actions)
    const flight = compile(play).passes[0]
    expect(flight?.arrivalT).toBeGreaterThan(0.3)
    const receiver = evaluate(
      play,
      LINE,
      flight?.arrivalT ?? NaN,
      settings,
      createCaches(),
    ).players.find((p) => p.id === A2)?.pos
    expect(distance(flight?.to ?? { x: 0, y: 0 }, receiver ?? { x: NaN, y: NaN })).toBeLessThan(
      1e-9,
    )
    expect(flight?.to.y).toBeLessThan(20)
  })
})
