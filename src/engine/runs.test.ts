import { describe, expect, it } from 'vitest'
import { allLines } from '../model/phaseTree'
import { defaultSettings, engineSettingsOf, type EngineSettings } from '../model/settings'
import type { Action, Id, Play, RunAction } from '../model/types'
import { basePlay, ball, pass, phase, player, realisticRunsPlay, run, uuid } from '../test/builders'
import { PROFILE_TOLERANCE, trapezoid } from '../test/profileMath'
import { createCaches } from './caches'
import { evaluate } from './evaluate'
import { segmentPeak } from './profile'
import { endDirection } from './spline'
import {
  compileLine,
  motionEnd,
  motionSpeed,
  motionVelocity,
  type CompiledLine,
  type RunMotion,
} from './timeline'
import { distance } from './vec'

const settings: EngineSettings = engineSettingsOf(defaultSettings())
const { accel, decel } = settings.motion
const A1 = uuid(1)
const A2 = uuid(2)
const T1 = uuid(10)
const T2 = uuid(11)
const T3 = uuid(12)

function twoPlayers(phases: ReturnType<typeof phase>[]): Play {
  return basePlay({
    entities: [player(A1, 'A', 1), player(A2, 'A', 2), ball(uuid(20))],
    setup: {
      positions: { [A1]: { x: 40, y: 30 }, [A2]: { x: 40, y: 20 } },
      ballCarrierId: A1,
      ballPosition: null,
    },
    phases,
  })
}

const compile = (play: Play, line: Id[], s: EngineSettings = settings): CompiledLine =>
  compileLine(play, line, s, createCaches())

function motionOf(compiled: CompiledLine, actionId: Id): RunMotion {
  for (const p of compiled.phases) {
    const found = p.motions.find((m) => m.actionId === actionId)
    if (found) return found
  }
  throw new Error(`no motion ${actionId}`)
}

const codes = (compiled: CompiledLine) => compiled.issues.map((i) => i.code)

describe('segment speeds (SPEC 5.3, D-114)', () => {
  it('runs each segment at its own speed, the pace of the run elsewhere', () => {
    const r = run(uuid(30), A1, [
      { x: 60, y: 30, speed: 'walk' },
      { x: 90, y: 30 },
      { x: 100, y: 30, speed: 3 },
    ])
    const m = motionOf(compile(twoPlayers([phase(T1, null, [r])]), [T1]), r.id)
    expect(m.targets).toEqual([2, 4, 3])
    expect(segmentPeak(m.profile, 0)).toBeCloseTo(2, 9)
    expect(segmentPeak(m.profile, 1)).toBeCloseTo(4, 9)
    expect(segmentPeak(m.profile, 2)).toBeLessThanOrEqual(4 + 1e-9)
    // The walking segment is the slowest by far.
    const sprint = { ...r, pace: 'sprint' as const }
    const fast = motionOf(compile(twoPlayers([phase(T1, null, [sprint])]), [T1]), r.id)
    expect(fast.targets).toEqual([2, 5.5, 3])
    expect(fast.duration).toBeLessThan(m.duration)
  })

  it('maps the speeds of zero-length segments away', () => {
    const r = run(uuid(30), A1, [
      { x: 40, y: 30, speed: 'sprint' },
      { x: 50, y: 30, speed: 'walk' },
    ])
    const m = motionOf(compile(twoPlayers([phase(T1, null, [r])]), [T1]), r.id)
    expect(m.targets).toEqual([2])
    expect(m.spline.sourceSegments).toEqual([1])
  })
})

describe('speed alerts (SPEC 5.9, D-111)', () => {
  const at = (kmh: number, length = 60) =>
    compile(
      twoPlayers([
        phase(T1, null, [run(uuid(30), A1, [{ x: 40 + length, y: 30, speed: kmh / 3.6 }])]),
      ]),
      [T1],
    )
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
    const compiled = compile(
      twoPlayers([phase(T1, null, [run(uuid(30), A1, [{ x: 60, y: 30 }])])]),
      [T1],
      strict,
    )
    expect(codes(compiled)).toEqual(['runSpeedTooHigh'])
  })

  it('reports each segment once', () => {
    const r = run(uuid(30), A1, [
      { x: 70, y: 30, speed: 6.5 },
      { x: 100, y: 30, speed: 6.5 },
    ])
    const compiled = compile(twoPlayers([phase(T1, null, [r])]), [T1])
    expect(compiled.issues.map((i) => [i.code, i.params?.segment, i.key])).toEqual([
      ['runSpeedHigh', 1, '0'],
      ['runSpeedHigh', 2, '1'],
    ])
  })
})

describe('runs ending at speed (SPEC 5.2, D-106)', () => {
  const t1Run: RunAction = run(uuid(30), A1, [{ x: 60, y: 30 }], {
    endsAtSpeed: true,
    pace: 'sprint',
  })
  const t2Run: RunAction = run(uuid(31), A1, [{ x: 70, y: 40 }], { pace: 'sprint' })

  it('ends at speed and goes on at that speed in its arrival direction', () => {
    const play = twoPlayers([phase(T1, null, [t1Run]), phase(T2, T1, [t2Run])])
    const compiled = compile(play, [T1, T2])
    const first = motionOf(compiled, t1Run.id)
    const second = motionOf(compiled, t2Run.id)
    expect(first.endsAtSpeed).toBe(true)
    expect(Math.abs(first.duration - trapezoid(20, 5.5, accel, decel, 0, 5.5))).toBeLessThan(
      PROFILE_TOLERANCE,
    )
    const boundary = compiled.phases[1]?.start ?? NaN
    expect(motionSpeed(first, boundary - 1e-9)).toBeCloseTo(5.5, 6)
    expect(motionSpeed(second, boundary)).toBeCloseTo(5.5, 6)
    // Same velocity on both sides of the boundary: speed, and direction (tangent junction) up to
    // the chord of one sample interval.
    const before = motionVelocity(first, boundary - 1e-6)
    const after = motionVelocity(second, boundary + 1e-6)
    const angle = Math.atan2(after.y, after.x) - Math.atan2(before.y, before.x)
    expect(Math.abs(angle)).toBeLessThan(0.05)
    // Without the junction, the run would turn 45° at once.
    expect(Math.atan2(before.y, before.x)).toBeCloseTo(0, 9)
    expect(second.prolongs).toBe(true)
    expect(second.spline.startDirection).toEqual(endDirection(first.spline))
    // Its waypoints are those drawn; the parent phase does not change (SPEC 5.2).
    expect(second.waypoints).toEqual([{ x: 70, y: 40 }])
    expect(compile(play, [T1]).phases[0]).toEqual(compiled.phases[0])
    expect(codes(compiled)).toEqual([])
  })

  it('stops short in an option that does not prolong it, with a warning naming it', () => {
    const play = twoPlayers([
      phase(T1, null, [t1Run]),
      phase(T2, T1, [t2Run], { isDefault: true }),
      phase(T3, T1, [run(uuid(32), A1, [{ x: 70, y: 40 }], { delay: 0.5 })]),
    ])
    const prolonged = compile(play, [T1, T2])
    const stopped = compile(play, [T1, T3])
    expect(codes(prolonged)).toEqual([])
    expect(stopped.issues).toEqual([
      {
        code: 'runNotContinued',
        severity: 'warning',
        target: { kind: 'action', id: t1Run.id, phaseId: T1 },
        params: { phase: 'Temps 2, option B' },
        key: T3,
      },
    ])
    // The trunk is the same in both options (SPEC 5.2); option B starts from rest.
    expect(stopped.phases[0]).toEqual(prolonged.phases[0])
    const late = motionOf(stopped, uuid(32))
    expect(late.prolongs).toBe(false)
    expect(motionSpeed(late, (stopped.phases[1]?.start ?? 0) + 0.5)).toBe(0)
  })

  it('raises no warning at the end of a line', () => {
    const play = twoPlayers([phase(T1, null, [t1Run])])
    expect(codes(compile(play, [T1]))).toEqual([])
    expect(motionOf(compile(play, [T1]), t1Run.id).endsAtSpeed).toBe(true)
  })

  it('brakes normally when the player waits for the end of the phase, without warning', () => {
    // A2 runs longer: A1 would wait at speed. She brakes instead, the wait is measured.
    const play = twoPlayers([
      phase(T1, null, [t1Run, run(uuid(33), A2, [{ x: 90, y: 20 }])]),
      phase(T2, T1, [t2Run]),
    ])
    const compiled = compile(play, [T1, T2])
    const first = motionOf(compiled, t1Run.id)
    expect(first.endsAtSpeed).toBe(false)
    expect(first.launchWait).toBeGreaterThan(0)
    const atSpeed = compile(twoPlayers([phase(T1, null, [t1Run])]), [T1])
    const end = compiled.phases[0]?.end ?? NaN
    expect(first.launchWait).toBeCloseTo(end - motionEnd(motionOf(atSpeed, t1Run.id)), 9)
    expect(motionSpeed(first, motionEnd(first))).toBe(0)
    expect(Math.abs(first.duration - trapezoid(20, 5.5, accel, decel))).toBeLessThan(
      PROFILE_TOLERANCE,
    )
    // The next phase is then not prolonged, and nothing is reported.
    expect(motionOf(compiled, t2Run.id).prolongs).toBe(false)
    expect(codes(compiled)).toEqual([])
  })
})

describe('continuity and determinism with profiles (SPEC 5.2, 5.5)', () => {
  const play = realisticRunsPlay()
  const lines = allLines(play)
  const drawable = (play: Play, line: Id[], t: number) => {
    const s = evaluate(play, line, t, settings, createCaches())
    return {
      players: s.players,
      ball: s.ball,
      traces: s.traces,
      passTraces: s.passTraces,
      kickTraces: s.kickTraces,
      breakdowns: s.breakdowns,
      gainLineX: s.gainLineX,
    }
  }

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

  it('keeps the trunk identical in every option, a run at speed included', () => {
    const [lineA, lineB] = lines as [Id[], Id[]]
    const trunkEnd = compileLine(play, lineA, settings, createCaches()).phases[1]?.end ?? 0
    for (let t = 0; t < trunkEnd; t += 0.05) {
      expect(drawable(play, lineA, t)).toEqual(drawable(play, lineB, t))
    }
  })

  it('moves every player continuously across phase boundaries', () => {
    for (const line of lines) {
      const compiled = compileLine(play, line, settings, createCaches())
      for (const boundary of compiled.phases.slice(1).map((p) => p.start)) {
        const before = evaluate(play, line, boundary - 1e-7, settings, createCaches())
        const after = evaluate(play, line, boundary, settings, createCaches())
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
    const play = twoPlayers([phase(T1, null, actions)])
    const compiled = compile(play, [T1])
    const flight = compiled.phases[0]?.passes[0]
    const receiver = evaluate(
      play,
      [T1],
      flight?.arrivalT ?? NaN,
      settings,
      createCaches(),
    ).players.find((p) => p.id === A2)?.pos
    expect(distance(flight?.to ?? { x: 0, y: 0 }, receiver ?? { x: NaN, y: NaN })).toBeLessThan(
      1e-9,
    )
  })
})
