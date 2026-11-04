import { describe, expect, it } from 'vitest'
import { distance } from '../../engine/vec'
import { defaultSettings, engineSettingsOf, type EngineSettings } from '../../model/settings'
import { PROFILE_TOLERANCE, straightRun } from '../../test/profileMath'
import { allLines } from '../model/branches'
import { issueKey } from '../model/issues'
import type { Action, Play, RunAction } from '../model/types'
import {
  P,
  basePlay,
  branch,
  fourVsTwoNoBall,
  friseFixturePlay,
  kick,
  pass,
  player,
  run,
  sequence,
  setPiecesPlay,
  sevenVsSevenWithOptions,
  uuid,
} from '../test/builders'
import { lineBounds } from './bounds'
import { createCaches } from './caches'
import { ballObtainedAt, evaluate, positionsAt, sampleLine, windowSchematic } from './evaluate'
import { compileLine, compileLineUncached, intervalIndexAt } from './timeline'
import { engineIssues } from './validate'

const settings: EngineSettings = engineSettingsOf(defaultSettings())
const LINE_A = [P.root, P.optA]
const LINE_B = [P.root, P.optB]
const LINE = [P.root]

describe('evaluation of every leaf', () => {
  it('evaluates each line from start to end without issue', () => {
    const play = sevenVsSevenWithOptions()
    const caches = createCaches()
    const lines = allLines(play)
    expect(lines).toHaveLength(2)
    for (const line of lines) {
      const compiled = compileLine(play, line, settings, caches)
      // Only the pass of option B is forward in the passer frame (SPEC 5.7): A6, still, gives to
      // A5 who arrives at full speed ahead of her.
      expect(compiled.issues.filter((i) => i.code !== 'forwardPass')).toEqual([])
      expect(compiled.issues.filter((i) => i.code === 'forwardPass').map((i) => i.target)).toEqual(
        line[1] === P.optB ? [{ kind: 'action', id: uuid(231), branchId: P.optB }] : [],
      )
      expect(compiled.duration).toBeGreaterThan(0)
      for (let t = 0; t <= compiled.duration + 0.5; t += 0.1) {
        const state = evaluate(play, line, t, settings, caches)
        expect(state.players).toHaveLength(14)
        expect(state.ball).not.toBeNull()
        for (const p of state.players) {
          expect(Number.isFinite(p.pos.x) && Number.isFinite(p.pos.y)).toBe(true)
        }
      }
      // At the end, the last pass of each option has arrived.
      const end = evaluate(play, line, compiled.duration, settings, caches)
      expect(end.ball?.kind).toBe('carried')
      const inOption = evaluate(play, line, 7, settings, caches)
      expect(inOption.interval?.branchId).toBe(line[line.length - 1])
    }
    const endA = evaluate(play, LINE_A, 1e9, settings, caches)
    const endB = evaluate(play, LINE_B, 1e9, settings, caches)
    expect(endA.ball?.kind === 'carried' && endA.ball.carrierId).toBe(P.A(7))
    expect(endB.ball?.kind === 'carried' && endB.ball.carrierId).toBe(P.A(5))
  })

  it('never throws on the fixture, glues ignored until they are resolved', () => {
    const play = friseFixturePlay()
    const caches = createCaches()
    for (const line of allLines(play)) {
      const compiled = compileLine(play, line, settings, caches)
      for (let t = 0; t <= compiled.duration; t += 0.5) {
        expect(evaluate(play, line, t, settings, caches).players).toHaveLength(14)
      }
    }
  })
})

describe('durations (SPEC 5.1, 5.3)', () => {
  const { motion } = settings
  const { sprint } = settings.paces
  const a = uuid(1)
  const b = uuid(2)
  const make = (actions: Action[]): Play =>
    basePlay({
      entities: [player(a, 'A', 1), player(b, 'A', 2), { id: uuid(3), kind: 'ball' }],
      setup: {
        positions: { [a]: { x: 0, y: 0 }, [b]: { x: 0, y: 12 } },
        ballCarrierId: a,
        ballPosition: null,
      },
      actions,
    })
  const duration = (play: Play, s: EngineSettings = settings) =>
    compileLine(play, LINE, s, createCaches()).duration
  const close = (actual: number, expected: number) => {
    expect(Math.abs(actual - expected)).toBeLessThan(PROFILE_TOLERANCE)
  }

  it('is the latest end of the actions of the line, 0 without action', () => {
    expect(duration(make([]))).toBe(0)
    const play = make([
      run(uuid(20), a, [{ x: 8, y: 0 }], { pace: 'jog', start: 1 }),
      run(uuid(21), b, [{ x: 0, y: 26 }], { pace: 'sprint' }),
    ])
    const compiled = compileLine(play, LINE, settings, createCaches())
    const [mb, ma] = compiled.motions
    // Durations of the speed profile: jog 8 m (3.19 s), sprint 14 m (4.05 s).
    close(ma?.duration ?? 0, straightRun(8, 4, motion, sprint))
    close(mb?.duration ?? 0, straightRun(14, 5.5, motion, sprint))
    expect(compiled.duration).toBeCloseTo(Math.max(1 + (ma?.duration ?? 0), mb?.duration ?? 0), 9)
    // A pass counts up to its arrival, whenever it is released.
    const later = make([pass(uuid(22), a, b, 10)])
    expect(duration(later)).toBeCloseTo(10 + 12 / 12, 9)
  })

  it('does not count an ignored action, and lets a branch point lie beyond it (D-038, D-153)', () => {
    expect(duration(make([pass(uuid(22), b, a, 10)]))).toBe(0)
    expect(duration(make([kick(uuid(22), b, { point: { x: 50, y: 0 } }, 10)]))).toBe(0)
    // Letter of SPEC 5.1: a branch point after the last action is never reached.
    const branched: Play = {
      ...make([run(uuid(20), a, [{ x: 8, y: 0 }])]),
      branches: [
        branch(P.root, null, { branchAt: 20 }),
        branch(P.optA, P.root, { isDefault: true }),
        branch(P.optB, P.root),
      ],
    }
    close(
      compileLine(branched, LINE_A, settings, createCaches()).duration,
      straightRun(8, 4, motion, sprint),
    )
  })

  it('uses the paces of the settings, durationOverride and ballSpeed', () => {
    const runOf = (extra: Partial<RunAction>) => make([run(uuid(20), a, [{ x: 8, y: 0 }], extra)])
    close(duration(runOf({})), straightRun(8, 4, motion, sprint))
    close(
      duration(runOf({}), { ...settings, paces: { ...settings.paces, jog: 2 } }),
      straightRun(8, 2, motion, sprint),
    )
    close(
      duration(runOf({}), { ...settings, motion: { ...settings.motion, accel: 6 } }),
      straightRun(8, 4, { ...motion, accel: 6 }, sprint),
    )
    // The imposed duration is met exactly (common factor, D-107).
    expect(duration(runOf({ durationOverride: 5 }))).toBeCloseTo(5, 9)
    close(duration(runOf({ start: 1.5 })), 1.5 + straightRun(8, 4, motion, sprint))
    // Pass of 12 m at 6 m/s instead of 12 m/s.
    expect(duration(make([pass(uuid(21), a, b, 0)]))).toBeCloseTo(1, 9)
    expect(duration(make([pass(uuid(21), a, b, 0, { ballSpeed: 6 })]))).toBeCloseTo(2, 9)
  })

  it('meets an imposed duration beyond the bounds exactly, the thresholds alone warn (D-129)', () => {
    const play = basePlay({
      entities: [player(a, 'A', 1)],
      setup: { positions: { [a]: { x: 0, y: 0 } }, ballCarrierId: null, ballPosition: null },
      actions: [run(uuid(20), a, [{ x: 8, y: 0 }], { durationOverride: 1 })],
    })
    const compiled = compileLine(play, LINE, settings, createCaches())
    expect(compiled.issues.map((i) => i.code)).toEqual([
      'runSpeedTooHigh',
      'runAccelTooHigh',
      'runBrakeTooHigh',
    ])
    // Shorter than the bounds allow: lever 2 scales the accelerations too (D-130).
    expect(1).toBeLessThan(straightRun(8, 1000, motion, sprint))
    expect(compiled.duration).toBeCloseTo(1, 9)
    const m = compiled.motions[0]
    expect(m?.accelFactor).toBeGreaterThan(1)
    expect(m?.factor).toBeCloseTo(
      (motion.topSpeed / settings.paces.jog) * Math.sqrt(m?.accelFactor ?? NaN),
      9,
    )
    // The alert thresholds never change the motion (D-129).
    const strict = {
      ...settings,
      speedAlert: { warning: 1, danger: 2 },
      accelAlert: { warning: 1, danger: 2 },
      decelAlert: { warning: 1, danger: 2 },
    }
    const loose = {
      ...settings,
      speedAlert: { warning: 40, danger: 50 },
      accelAlert: { warning: 400, danger: 500 },
      decelAlert: { warning: 400, danger: 500 },
    }
    const profileWith = (s: EngineSettings) =>
      compileLine(play, LINE, s, createCaches()).motions[0]?.profile
    expect(profileWith(strict)).toEqual(m?.profile)
    expect(profileWith(loose)).toEqual(m?.profile)
  })
})

describe('intervals (SPEC 5.1, D-139 Q8)', () => {
  const a = uuid(1)
  const b = uuid(2)
  const make = (extra: Partial<Play>): Play =>
    basePlay({
      entities: [player(a, 'A', 1), player(b, 'A', 2), { id: uuid(3), kind: 'ball' }],
      setup: {
        positions: { [a]: { x: 40, y: 30 }, [b]: { x: 40, y: 40 } },
        ballCarrierId: a,
        ballPosition: null,
      },
      ...extra,
    })
  const walk = (id: string, who: string, start: number, extra: Partial<RunAction> = {}) =>
    run(id, who, [{ x: 60, y: who === a ? 30 : 40 }], { pace: 'sprint', start, ...extra })
  const spans = (play: Play, line = LINE) =>
    compileLine(play, line, settings, createCaches()).intervals.map((i) => [
      i.start,
      i.end,
      i.branchId,
      i.sequenceId,
    ])

  it('gives one interval without sequence nor branch point', () => {
    const play = make({ actions: [walk(uuid(20), a, 0)] })
    const compiled = compileLine(play, LINE, settings, createCaches())
    expect(spans(play)).toEqual([[0, compiled.duration, P.root, null]])
    expect(intervalIndexAt(compiled, 0)).toBe(0)
    expect(intervalIndexAt(compiled, compiled.duration)).toBe(0)
  })

  it('gives no interval without action nor sequence', () => {
    expect(spans(make({}))).toEqual([])
  })

  it('gives one for the trunk and one per option with a branch point', () => {
    const play = make({
      branches: [
        branch(P.root, null, { branchAt: 2 }),
        branch(P.optA, P.root, { isDefault: true }),
        branch(P.optB, P.root),
      ],
      actions: [walk(uuid(20), a, 0), walk(uuid(21), b, 2, { branchId: P.optA })],
    })
    const compiled = compileLine(play, LINE_A, settings, createCaches())
    expect(spans(play, LINE_A)).toEqual([
      [0, 2, P.root, null],
      [2, compiled.duration, P.optA, null],
    ])
    // An option where no action starts has no interval (a gap needs an action).
    expect(spans(play, LINE_B).map((s) => s[2])).toEqual([P.root])
  })

  it('gives the sequences, and the gaps of a branch where an action starts', () => {
    const play = make({
      actions: [walk(uuid(20), a, 0.5), walk(uuid(21), b, 3)],
      sequences: [sequence(uuid(30), 1, 2.5, { label: 'Lancement', instruction: 'On fixe' })],
    })
    const compiled = compileLine(play, LINE, settings, createCaches())
    expect(spans(play)).toEqual([
      [0, 1, P.root, null],
      [1, 2.5, P.root, uuid(30)],
      [2.5, compiled.duration, P.root, null],
    ])
    expect(compiled.intervals[1]).toMatchObject({ label: 'Lancement', instruction: 'On fixe' })
    expect(compiled.intervals[0]).toMatchObject({ label: '', instruction: '' })
  })

  it('leaves out a gap where no action starts, and reads an instant in it as no interval', () => {
    const play = make({
      actions: [walk(uuid(20), a, 0)],
      sequences: [sequence(uuid(30), 0, 1), sequence(uuid(31), 2, 3)],
    })
    const compiled = compileLine(play, LINE, settings, createCaches())
    expect(compiled.intervals.map((i) => i.sequenceId)).toEqual([uuid(30), uuid(31)])
    expect(intervalIndexAt(compiled, 0.5)).toBe(0)
    expect(intervalIndexAt(compiled, 1.5)).toBe(-1)
    expect(intervalIndexAt(compiled, 2)).toBe(1)
    expect(sampleLine(compiled, 1.5).interval).toBeNull()
    expect(sampleLine(compiled, 2.5).instruction).toBe('')
  })

  it('counts the real start of an action: one delayed goes into the next gap', () => {
    const play = make({
      actions: [walk(uuid(20), a, 0), walk(uuid(21), a, 1)],
      sequences: [sequence(uuid(30), 0, 2)],
    })
    const compiled = compileLine(play, LINE, settings, createCaches())
    const start = compiled.blocks[uuid(21)]?.start ?? NaN
    expect(start).toBeGreaterThan(2)
    expect(compiled.intervals.map((i) => [i.start, i.sequenceId])).toEqual([
      [0, uuid(30)],
      [2, null],
    ])
    expect(intervalIndexAt(compiled, start)).toBe(1)
  })

  it('gives an interval to an ignored action after the end of the line', () => {
    const play = make({ actions: [pass(uuid(22), b, a, 10)] })
    const compiled = compileLine(play, LINE, settings, createCaches())
    expect(compiled.duration).toBe(0)
    expect(compiled.intervals.map((i) => [i.start, i.end])).toEqual([[0, 10]])
  })

  it('cuts the gaps at a branch point after the last action at the end of the line (D-153)', () => {
    const play = make({
      branches: [
        branch(P.root, null, { branchAt: 50 }),
        branch(P.optA, P.root, { isDefault: true }),
        branch(P.optB, P.root),
      ],
      actions: [walk(uuid(20), a, 0)],
    })
    const compiled = compileLine(play, LINE_A, settings, createCaches())
    expect(compiled.intervals.map((i) => [i.start, i.end])).toEqual([[0, compiled.duration]])
  })

  it('follows a nested branch point', () => {
    const play = friseFixturePlay()
    const lines = allLines(play)
    const nested = lines.find((line) => line.includes(P.optB2)) ?? []
    const compiled = compileLine(play, nested, settings, createCaches())
    for (let i = 1; i < compiled.intervals.length; i++) {
      const previous = compiled.intervals[i - 1]
      expect(compiled.intervals[i]?.start).toBeGreaterThanOrEqual(previous?.end ?? NaN)
    }
    expect(compiled.intervals.at(-1)?.branchId).toBe(P.optB2)
  })
})

describe('blocks of a line', () => {
  it('gives the real span of each action and sequence, ignored ones at their start', () => {
    const a = uuid(1)
    const b = uuid(2)
    const play = basePlay({
      entities: [player(a, 'A', 1), player(b, 'A', 2), { id: uuid(3), kind: 'ball' }],
      setup: {
        positions: { [a]: { x: 0, y: 0 }, [b]: { x: 0, y: 12 } },
        ballCarrierId: a,
        ballPosition: null,
      },
      actions: [pass(uuid(21), a, b, 1), pass(uuid(22), a, b, 5)],
      sequences: [sequence(uuid(30), 0.5, 4)],
    })
    const { blocks } = compileLine(play, LINE, settings, createCaches())
    expect(blocks[uuid(21)]).toEqual({ start: 1, end: 2 })
    expect(blocks[uuid(22)]).toEqual({ start: 5, end: 5 })
    expect(blocks[uuid(30)]).toEqual({ start: 0.5, end: 4 })
  })
})

describe('ball and passes (SPEC 5.4)', () => {
  const a = uuid(1)
  const b = uuid(2)
  // Passer still, receiver sprinting across: the ball must meet the receiver.
  const play = basePlay({
    entities: [player(a, 'A', 1), player(b, 'A', 2), { id: uuid(3), kind: 'ball' }],
    setup: {
      positions: { [a]: { x: 10, y: 10 }, [b]: { x: 6, y: 18 } },
      ballCarrierId: a,
      ballPosition: null,
    },
    actions: [run(uuid(20), b, [{ x: 6, y: 40 }], { pace: 'sprint' }), pass(uuid(21), a, b, 1)],
  })
  const caches = createCaches()
  const compiled = compileLine(play, LINE, settings, caches)
  const thePass = compiled.passes[0]

  it('meets a moving receiver at arrivalT', () => {
    expect(thePass?.applied).toBe(true)
    if (!thePass) return
    const receiverAtArrival = evaluate(play, LINE, thePass.arrivalT, settings, caches).players.find(
      (p) => p.id === b,
    )
    expect(distance(thePass.to, receiverAtArrival?.pos ?? { x: NaN, y: NaN })).toBeLessThan(1e-9)
    const flightSpeed = distance(thePass.from, thePass.to) / (thePass.arrivalT - thePass.releaseT)
    expect(Math.abs(flightSpeed - 12) / 12).toBeLessThan(0.01)
    expect(thePass.from).toEqual({ x: 10, y: 10 })
  })

  it('derives the ball state around release and reception', () => {
    if (!thePass) return
    const at = (t: number) => evaluate(play, LINE, t, settings, caches).ball
    const beforeRelease = at(thePass.releaseT - 1e-6)
    expect(beforeRelease?.kind === 'carried' && beforeRelease.carrierId).toBe(a)
    const atRelease = at(thePass.releaseT)
    expect(atRelease?.kind).toBe('inFlight')
    expect(atRelease?.pos).toEqual(thePass.from)
    const beforeArrival = at(thePass.arrivalT - 1e-6)
    expect(beforeArrival?.kind).toBe('inFlight')
    expect(distance(beforeArrival?.pos ?? { x: NaN, y: NaN }, thePass.to)).toBeLessThan(1e-3)
    const atArrival = at(thePass.arrivalT)
    expect(atArrival?.kind === 'carried' && atArrival.carrierId).toBe(b)
    expect(distance(atArrival?.pos ?? { x: NaN, y: NaN }, thePass.to)).toBeLessThan(1e-9)
  })

  it('gives the instant a player first holds the ball', () => {
    const scenario = sevenVsSevenWithOptions()
    expect(ballObtainedAt(scenario, LINE_A, P.A(4), settings, caches)).toBe(0)
    const arrival = compileLine(scenario, LINE_A, settings, caches).passes[0]?.arrivalT ?? NaN
    expect(ballObtainedAt(scenario, LINE_A, P.A(5), settings, caches)).toBeCloseTo(arrival, 9)
    expect(ballObtainedAt(scenario, LINE_A, P.A(1), settings, caches)).toBeNull()
  })

  it('waits for a reception within the tolerance, the real instant shown (D-110)', () => {
    // The relayer of the pass: A2 receives about 1 s after the release of A1; her pass 0.4 s before.
    const chain = basePlay({
      entities: [
        player(a, 'A', 1),
        player(b, 'A', 2),
        player(uuid(5), 'A', 3),
        { id: uuid(3), kind: 'ball' },
      ],
      setup: {
        positions: { [a]: { x: 0, y: 0 }, [b]: { x: 0, y: 12 }, [uuid(5)]: { x: 0, y: 24 } },
        ballCarrierId: a,
        ballPosition: null,
      },
      actions: [pass(uuid(21), a, b, 0), pass(uuid(22), b, uuid(5), 0.6)],
    })
    const within = compileLine(chain, LINE, settings, createCaches())
    expect(within.issues).toEqual([])
    expect(within.passes[1]).toMatchObject({ applied: true, plannedT: 0.6, releaseT: 1 })
    // Beyond the tolerance: ignored and signalled.
    const beyond: Play = {
      ...chain,
      actions: [pass(uuid(21), a, b, 0), pass(uuid(22), b, uuid(5), 0.4)],
    }
    const compiled2 = compileLine(beyond, LINE, settings, createCaches())
    expect(compiled2.issues.map((i) => i.code)).toEqual(['passerWithoutBall'])
    expect(compiled2.passes[1]).toMatchObject({ applied: false, releaseT: 0.4 })
  })
})

describe('traces (SPEC 5.5)', () => {
  it('are identical in continuous playback and after a direct jump to t', () => {
    const play = sevenVsSevenWithOptions()
    const shared = createCaches()
    const duration = compileLine(play, LINE_B, settings, shared).duration
    const targets = [0.3, duration / 2, duration - 0.1, duration]
    let t = 0
    for (const target of targets) {
      while (t < target) {
        evaluate(play, LINE_B, t, settings, shared)
        t += 1 / 30
      }
      const continuous = evaluate(play, LINE_B, target, settings, shared)
      const jump = evaluate(play, LINE_B, target, settings, createCaches())
      expect(JSON.stringify(continuous)).toBe(JSON.stringify(jump))
    }
  })

  it('emphasise the current interval and draw completed passes', () => {
    const play = sevenVsSevenWithOptions()
    const caches = createCaches()
    const compiled = compileLine(play, LINE_A, settings, caches)
    const branchAt = compiled.branches[0]?.branchAt ?? 0
    const state = evaluate(play, LINE_A, branchAt + 0.5, settings, caches)
    expect(state.traces.some((tr) => tr.current && tr.branchId === P.optA)).toBe(true)
    expect(state.traces.filter((tr) => tr.branchId === P.root).every((tr) => !tr.current)).toBe(
      true,
    )
    expect(state.passTraces.filter((p) => p.branchId === P.root).every((p) => p.completed)).toBe(
      true,
    )
    expect(state.passTraces.filter((p) => p.branchId === P.root).every((p) => !p.current)).toBe(
      true,
    )
    // Before the start of a run, there is no trace for it.
    const start = evaluate(play, LINE_A, 0, settings, caches)
    expect(start.traces).toEqual([])
  })
})

describe('attacking team and squads', () => {
  it('works when B attacks: nothing assumes that A attacks', () => {
    const b1 = uuid(1)
    const b2 = uuid(2)
    const a1 = uuid(3)
    const play = basePlay({
      attackingTeam: 'B',
      entities: [
        player(b1, 'B', 1),
        player(b2, 'B', 2),
        player(a1, 'A', 1),
        { id: uuid(4), kind: 'ball' },
      ],
      setup: {
        positions: { [b1]: { x: 60, y: 30 }, [b2]: { x: 62, y: 40 }, [a1]: { x: 50, y: 30 } },
        ballCarrierId: b1,
        ballPosition: null,
      },
      actions: [
        run(uuid(20), b1, [{ x: 55, y: 32 }]),
        run(uuid(21), b2, [{ x: 58, y: 42 }], { pace: 'sprint' }),
        pass(uuid(22), b1, b2, 0.5),
      ],
    })
    const caches = createCaches()
    const compiled = compileLine(play, LINE, settings, caches)
    expect(compiled.issues).toEqual([])
    const end = evaluate(play, LINE, compiled.duration, settings, caches)
    expect(end.attackingTeam).toBe('B')
    expect(end.gainLineX).toBe(60)
    expect(end.ball?.kind === 'carried' && end.ball.carrierId).toBe(b2)
    // A pass from B to A is a pass to the other team, and forward for B (towards -x).
    const toA: Play = { ...play, actions: [pass(uuid(22), b1, a1, 0)] }
    expect(compileLine(toA, LINE, settings, caches).issues.map((i) => i.code)).toEqual([
      'passToOpponent',
      'forwardPass',
    ])
  })

  it('handles 4 against 2 without ball', () => {
    const play = fourVsTwoNoBall()
    const caches = createCaches()
    const compiled = compileLine(play, LINE, settings, caches)
    expect(compiled.issues).toEqual([])
    expect(compiled.hasBall).toBe(false)
    const state = evaluate(play, LINE, compiled.duration / 2, settings, caches)
    expect(state.players.filter((p) => p.team === 'A')).toHaveLength(4)
    expect(state.players.filter((p) => p.team === 'B')).toHaveLength(2)
    expect(state.ball).toBeNull()
    expect(state.gainLineX).toBeNull()
    expect(state.traces.length).toBe(2)
  })

  it('handles an empty play and an empty line', () => {
    const state = evaluate(basePlay({ branches: [] }), [], 3, settings, createCaches())
    expect(state.interval).toBeNull()
    expect(state.players).toEqual([])
    expect(state.duration).toBe(0)
  })
})

describe('determinism', () => {
  it('gives byte-identical results for identical inputs, warm or cold caches', () => {
    const play = sevenVsSevenWithOptions()
    const warm = createCaches()
    for (const line of allLines(play)) {
      for (const t of [0, 0.7, 1.9, 3.3, 5.5, 100]) {
        const first = JSON.stringify(evaluate(play, line, t, settings, warm))
        const second = JSON.stringify(evaluate(play, line, t, settings, warm))
        const cold = JSON.stringify(
          evaluate(structuredClone(play), line, t, settings, createCaches()),
        )
        expect(second).toBe(first)
        expect(cold).toBe(first)
      }
      const cached = compileLine(play, line, settings, warm)
      const uncached = compileLineUncached(play, line, settings, createCaches())
      expect(JSON.stringify(sampleLine(cached, 2))).toBe(JSON.stringify(sampleLine(uncached, 2)))
    }
  })
})

describe('editing a run of the trunk (acceptance criterion 3)', () => {
  it('breaks neither passes nor following actions, in any option', () => {
    const original = sevenVsSevenWithOptions()
    const edited: Play = {
      ...original,
      actions: original.actions.map((action) =>
        action.type === 'run' && action.id === uuid(201)
          ? {
              ...action,
              waypoints: [
                { x: 41, y: 45 },
                { x: 49, y: 47 },
              ],
            }
          : action,
      ),
    }
    const caches = createCaches()
    for (const line of allLines(edited)) {
      const before = compileLine(original, line, settings, caches)
      const after = compileLine(edited, line, settings, caches)
      expect(after.issues.filter((i) => i.code !== 'forwardPass')).toEqual([])
      // Waypoints of later actions are untouched; only their start point moves.
      expect(after.motions.filter((m) => m.branchId !== P.root).map((m) => m.waypoints)).toEqual(
        before.motions.filter((m) => m.branchId !== P.root).map((m) => m.waypoints),
      )
      expect(after.branches).toEqual(before.branches)
      const next = after.motions.find((m) => m.entityId === P.A(5) && m.branchId === P.optB)
      if (next) expect(next.spline.points[0]).toEqual({ x: 49, y: 47 })
      // Every pass is still applied and ends on its receiver.
      for (const p of after.passes) {
        expect(p.applied).toBe(true)
        const state = sampleLine(after, p.arrivalT)
        const receiver = state.players.find((x) => x.id === p.toId)
        expect(distance(receiver?.pos ?? { x: NaN, y: NaN }, p.to)).toBeLessThan(1e-9)
      }
    }
  })
})

describe('engine validations and fallbacks (SPEC 5.3, 5.4, DECISIONS Q13)', () => {
  const base = sevenVsSevenWithOptions()
  const withActions = (actions: Action[]): Play => ({
    ...base,
    branches: [branch(P.root, null)],
    sequences: [],
    actions,
  })
  const issueCodes = (play: Play) =>
    compileLine(play, LINE, settings, createCaches()).issues.map((i) => i.code)

  it('executes a pass to the other team and signals it', () => {
    // B4 stands straight ahead of A4: the pass is also forward.
    const play = withActions([pass(uuid(500), P.A(4), P.B(4), 0)])
    expect(issueCodes(play)).toEqual(['passToOpponent', 'forwardPass'])
    const end = evaluate(play, LINE, 10, settings, createCaches())
    expect(end.ball?.kind === 'carried' && end.ball.carrierId).toBe(P.B(4))
  })

  it('ignores a pass from a player without the ball', () => {
    const play = withActions([pass(uuid(500), P.A(1), P.A(2), 0)])
    expect(issueCodes(play)).toEqual(['passerWithoutBall'])
    const end = evaluate(play, LINE, 10, settings, createCaches())
    expect(end.ball?.kind === 'carried' && end.ball.carrierId).toBe(P.A(4))
    // A pass released long before the reception is also a pass without the ball.
    const chained = withActions([
      pass(uuid(500), P.A(4), P.A(2), 0),
      pass(uuid(501), P.A(2), P.A(1), 0.1),
    ])
    expect(issueCodes(chained)).toEqual(['passerWithoutBall'])
  })

  it('keeps only the first of two simultaneous passes', () => {
    const play = withActions([
      pass(uuid(500), P.A(4), P.A(5), 0.8),
      pass(uuid(501), P.A(4), P.A(3), 0.8),
    ])
    expect(issueCodes(play)).toEqual(['simultaneousPass'])
    const end = evaluate(play, LINE, 10, settings, createCaches())
    expect(end.ball?.kind === 'carried' && end.ball.carrierId).toBe(P.A(5))
  })

  it('ignores actions of later lots with a warning', () => {
    const groupRun = {
      id: uuid(500),
      type: 'groupRun' as const,
      branchId: P.root,
      start: 0,
      entityIds: [P.A(1), P.A(2)],
      waypoints: [{ x: 50, y: 10 }],
      pace: 'jog' as const,
    }
    expect(compileLine(withActions([groupRun]), LINE, settings, createCaches()).issues).toEqual([
      {
        code: 'unsupportedAction',
        severity: 'warning',
        target: { kind: 'action', id: uuid(500), branchId: P.root },
        params: { type: 'groupRun' },
      },
    ])
  })

  it('never throws on references to missing entities', () => {
    const play = withActions([
      run(uuid(500), uuid(777), [{ x: 1, y: 1 }]),
      pass(uuid(501), uuid(778), P.A(4), 0),
    ])
    expect(() => evaluate(play, LINE, 1, settings, createCaches())).not.toThrow()
  })

  it('merges the issues of every line without duplicates', () => {
    // The same action of the trunk is reported by both lines, once here.
    const play: Play = {
      ...base,
      actions: [...base.actions, pass(uuid(500), P.A(1), P.A(2), 0)],
    }
    const caches = createCaches()
    const issues = engineIssues(play, settings, caches)
    const keys = issues.map(issueKey)
    expect(new Set(keys).size).toBe(keys.length)
    expect(issues.filter((i) => i.code === 'passerWithoutBall')).toHaveLength(1)
  })
})

describe('set pieces of lot 3: continuity and determinism (D-094)', () => {
  const play = setPiecesPlay()
  const lines = allLines(play)

  it('gives the same image in continuous playback and after a direct jump', () => {
    for (const line of lines) {
      const shared = createCaches()
      const duration = compileLine(play, line, settings, shared).duration
      let t = 0
      for (const target of [0.7, 2, duration / 2, duration - 0.2, duration]) {
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

  it('plays the fixture as described: pickup, ruck, pass, kick, maul', () => {
    const caches = createCaches()
    const [lineA, lineB] = lines as [string[], string[]]
    const a = compileLine(play, lineA, settings, caches)
    expect(a.ball.map((s) => s.kind)).toEqual([
      'loose',
      'carried',
      'breakdown',
      'carried',
      'flight',
      'carried',
      'flight',
      'loose',
    ])
    // The ruck forms at 1.5 s where A4 has run to by then: the end of her run, its imposed
    // duration of 1.5 s being met exactly (D-129).
    const ruck = a.breakdowns[0]?.pos
    expect(a.gainLine).toEqual([
      { t: 0, x: 40.5 },
      { t: 1.5, x: ruck?.x },
    ])
    expect(ruck?.x).toBeCloseTo(46, 9)
    // Forward when the ruck formed 2 m behind (run capped, lot 3 bis); now 0.2 m/s forward only.
    expect(a.passes[0]?.forward).toBe(false)
    expect(evaluate(play, lineA, 1e9, settings, caches).ball).toEqual({
      kind: 'loose',
      pos: { x: 75, y: 12 },
    })
    const b = compileLine(play, lineB, settings, caches)
    expect(b.breakdowns.at(-1)).toMatchObject({ kind: 'maul', applied: true })
    expect(b.gainLine.at(-1)?.x).toBe(50)
    const end = evaluate(play, lineB, 1e9, settings, caches).ball
    expect(end?.kind === 'carried' && end.carrierId).toBe(P.B(7))
  })
})

describe('schematic data and bounds', () => {
  const play = sevenVsSevenWithOptions()
  const caches = createCaches()
  const branchAt = compileLine(play, LINE_B, settings, caches).branches[0]?.branchAt ?? NaN

  it('gives the positions at t, the actions of the window and the earlier ones', () => {
    const schematic = windowSchematic(play, LINE_B, branchAt + 0.1, settings, caches)
    expect(schematic.line).toEqual(LINE_B)
    expect(schematic.window?.branchId).toBe(P.optB)
    expect(schematic.t).toBeCloseTo(branchAt + 0.1, 12)
    expect(positionsAt(play, LINE_B, branchAt + 0.1, settings, caches)).toEqual(
      Object.fromEntries(schematic.players.map((p) => [p.id, p.pos])),
    )
    expect(schematic.runs.map((r) => r.actionId)).toEqual([uuid(230)])
    expect(schematic.passes.map((p) => p.actionId)).toEqual([uuid(231)])
    expect(schematic.earlierRuns.map((r) => r.branchId)).toEqual([P.root, P.root, P.root])
    expect(schematic.earlierPasses.map((p) => p.actionId)).toEqual([uuid(202), uuid(211)])
    expect(schematic.ball?.kind === 'carried' && schematic.ball.carrierId).toBe(P.A(6))
  })

  it('draws nothing later than the window', () => {
    const schematic = windowSchematic(play, LINE_A, 0, settings, caches)
    expect(schematic.window?.branchId).toBe(P.root)
    const ids = [
      ...schematic.runs.map((r) => r.actionId),
      ...schematic.passes.map((p) => p.actionId),
    ]
    expect(ids).toEqual([uuid(200), uuid(201), uuid(210), uuid(202), uuid(211)])
    expect(schematic.earlierRuns).toEqual([])
    expect(schematic.earlierPasses).toEqual([])
  })

  it('shows everything before t in grey in a gap where no action starts', () => {
    const a = uuid(1)
    const sparse = basePlay({
      entities: [player(a, 'A', 1)],
      setup: { positions: { [a]: { x: 0, y: 0 } }, ballCarrierId: null, ballPosition: null },
      actions: [run(uuid(20), a, [{ x: 40, y: 0 }])],
      sequences: [sequence(uuid(30), 0, 1), sequence(uuid(31), 2, 3)],
    })
    const schematic = windowSchematic(sparse, LINE, 1.5, settings, createCaches())
    expect(schematic.window).toBeNull()
    expect(schematic.runs).toEqual([])
    expect(schematic.earlierRuns.map((r) => r.actionId)).toEqual([uuid(20)])
    expect(schematic.instruction).toBe('')
  })

  it('clamps t to the line', () => {
    const duration = compileLine(play, LINE_A, settings, caches).duration
    expect(windowSchematic(play, LINE_A, 1e9, settings, caches).t).toBe(duration)
    expect(windowSchematic(play, LINE_A, -1, settings, caches).t).toBe(0)
  })

  it('gives the instruction of the sequence of the window', () => {
    const schematic = windowSchematic(play, LINE_A, branchAt + 0.1, settings, caches)
    expect(schematic.instruction).toBe('On fixe et on donne')
    expect(evaluate(play, LINE_A, branchAt + 0.1, settings, caches).instruction).toBe(
      'On fixe et on donne',
    )
  })

  it('bounds every position of the line', () => {
    const bounds = lineBounds(compileLine(play, LINE_A, settings, caches))
    expect(bounds?.min).toEqual({ x: 40, y: 5 })
    expect(bounds?.max.x).toBeGreaterThanOrEqual(58)
    expect(bounds?.max.y).toBe(66)
  })
})
