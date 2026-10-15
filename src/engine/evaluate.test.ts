import { describe, expect, it } from 'vitest'
import { allLines } from '../model/phaseTree'
import { defaultSettings, engineSettingsOf, type EngineSettings } from '../model/settings'
import type { Play, RunAction } from '../model/types'
import {
  P,
  basePlay,
  fourVsTwoNoBall,
  pass,
  phase,
  player,
  run,
  sevenVsSevenWithOptions,
  uuid,
} from '../test/builders'
import { lineBounds } from './bounds'
import { createCaches } from './caches'
import {
  ballObtainedAt,
  evaluate,
  phaseSchematic,
  positionsAtPhaseStart,
  sampleLine,
} from './evaluate'
import type { SceneState } from './sceneState'
import { compileLine, compileLineUncached } from './timeline'
import { distance } from './vec'

const settings: EngineSettings = engineSettingsOf(defaultSettings())
const LINE_A = [P.t1, P.t2, P.t3a]
const LINE_B = [P.t1, P.t2, P.t3b]

/** Drawable content of a state, without line metadata. */
const drawable = (s: SceneState) => ({
  players: s.players,
  ball: s.ball,
  traces: s.traces,
  passTraces: s.passTraces,
  gainLineX: s.gainLineX,
})

describe('continuity (SPEC 5.2)', () => {
  const play = sevenVsSevenWithOptions()

  it('each phase starts where its parent ends, positions and ball', () => {
    for (const line of allLines(play)) {
      const compiled = compileLine(play, line, settings, createCaches())
      expect(compiled.phases).toHaveLength(line.length)
      for (let i = 1; i < compiled.phases.length; i++) {
        const previous = compiled.phases[i - 1]
        const next = compiled.phases[i]
        expect(next?.startPositions).toEqual(previous?.endPositions)
        expect(next?.holderAtStart).toEqual(previous?.holderAtEnd)
        expect(next?.start).toBe(previous?.end)
      }
    }
  })

  it('all options start from the same state at the branch point', () => {
    const caches = createCaches()
    const a = compileLine(play, LINE_A, settings, caches).phases[2]
    const b = compileLine(play, LINE_B, settings, caches).phases[2]
    expect(a?.startPositions).toEqual(b?.startPositions)
    expect(a?.holderAtStart).toEqual(b?.holderAtStart)
    expect(a?.start).toBe(b?.start)
    // Positions are continuous in time around the branch point.
    const start = a?.start ?? NaN
    for (const line of [LINE_A, LINE_B]) {
      const before = evaluate(play, line, start - 1e-6, settings, caches)
      const after = evaluate(play, line, start, settings, caches)
      for (const p of after.players) {
        const q = before.players.find((x) => x.id === p.id)
        expect(distance(p.pos, q?.pos ?? { x: NaN, y: NaN })).toBeLessThan(1e-3)
      }
    }
  })

  it('the trunk is identical in every line for the same t', () => {
    const caches = createCaches()
    const trunkEnd = compileLine(play, LINE_A, settings, caches).phases[1]?.end ?? 0
    for (let t = 0; t < trunkEnd; t += 0.05) {
      expect(drawable(evaluate(play, LINE_A, t, settings, caches))).toEqual(
        drawable(evaluate(play, LINE_B, t, settings, caches)),
      )
    }
  })
})

describe('evaluation of every leaf', () => {
  it('evaluates each line from start to end without issue', () => {
    const play = sevenVsSevenWithOptions()
    const caches = createCaches()
    const lines = allLines(play)
    expect(lines).toHaveLength(2)
    for (const line of lines) {
      const compiled = compileLine(play, line, settings, caches)
      expect(compiled.issues).toEqual([])
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
      expect(end.phaseId).toBe(line[line.length - 1])
    }
    const endA = evaluate(play, LINE_A, 1e9, settings, caches)
    const endB = evaluate(play, LINE_B, 1e9, settings, caches)
    expect(endA.ball?.kind === 'carried' && endA.ball.carrierId).toBe(P.A(7))
    expect(endB.ball?.kind === 'carried' && endB.ball.carrierId).toBe(P.A(5))
  })
})

describe('durations (SPEC 5.1)', () => {
  it('phase duration = max(delay + duration), line duration = sum', () => {
    const a = uuid(1)
    const b = uuid(2)
    const play = basePlay({
      entities: [player(a, 'A', 1), player(b, 'A', 2), { id: uuid(3), kind: 'ball' }],
      setup: {
        positions: { [a]: { x: 0, y: 0 }, [b]: { x: 0, y: 12 } },
        ballCarrierId: a,
        ballPosition: null,
      },
      phases: [
        phase(uuid(10), null, [
          run(uuid(20), a, [{ x: 8, y: 0 }], { pace: 'jog', delay: 1 }), // 1 + 8 / 4 = 3 s
          run(uuid(21), b, [{ x: 0, y: 26 }], { pace: 'sprint' }), // 14 / 7 = 2 s
        ]),
        phase(uuid(11), uuid(10), []),
        phase(uuid(12), uuid(11), [pass(uuid(22), a, b, 0.5)]),
      ],
    })
    const compiled = compileLine(play, [uuid(10), uuid(11), uuid(12)], settings, createCaches())
    const [p1, p2, p3] = compiled.phases
    expect((p1?.end ?? 0) - (p1?.start ?? 0)).toBeCloseTo(3, 9)
    expect((p2?.end ?? 0) - (p2?.start ?? 0)).toBe(0)
    // Pass from (8, 0) to (0, 26), still receiver: 0.5 + distance / 12.
    const flight = Math.hypot(8, 26) / 12
    expect((p3?.end ?? 0) - (p3?.start ?? 0)).toBeCloseTo(0.5 + flight, 9)
    expect(compiled.duration).toBeCloseTo(3 + 0 + 0.5 + flight, 9)
  })

  it('uses the paces of the settings, durationOverride and ballSpeed', () => {
    const a = uuid(1)
    const b = uuid(2)
    const make = (extra: Partial<RunAction>, ballSpeed?: number): Play =>
      basePlay({
        entities: [player(a, 'A', 1), player(b, 'A', 2), { id: uuid(3), kind: 'ball' }],
        setup: {
          positions: { [a]: { x: 0, y: 0 }, [b]: { x: 0, y: 12 } },
          ballCarrierId: a,
          ballPosition: null,
        },
        phases: [
          phase(uuid(10), null, [
            run(uuid(20), a, [{ x: 8, y: 0 }], extra),
            pass(uuid(21), a, b, 0, ballSpeed === undefined ? {} : { ballSpeed }),
          ]),
        ],
      })
    const duration = (play: Play, s: EngineSettings = settings) =>
      compileLine(play, [uuid(10)], s, createCaches()).duration
    expect(duration(make({}))).toBeCloseTo(2, 9)
    expect(duration(make({}), { ...settings, paces: { ...settings.paces, jog: 2 } })).toBeCloseTo(
      4,
      9,
    )
    expect(duration(make({ durationOverride: 5 }))).toBeCloseTo(5, 9)
    expect(duration(make({ delay: 1.5 }))).toBeCloseTo(3.5, 9)
    // Pass of 12 m at 6 m/s instead of 12 m/s.
    expect(duration(make({ durationOverride: 0.5 }, 6))).toBeCloseTo(2, 9)
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
    phases: [
      phase(uuid(10), null, [
        run(uuid(20), b, [{ x: 6, y: 40 }], { pace: 'sprint' }),
        pass(uuid(21), a, b, 1),
      ]),
    ],
  })
  const caches = createCaches()
  const compiled = compileLine(play, [uuid(10)], settings, caches)
  const thePass = compiled.phases[0]?.passes[0]

  it('meets a moving receiver at arrivalT', () => {
    expect(thePass?.applied).toBe(true)
    if (!thePass) return
    const receiverAtArrival = evaluate(
      play,
      [uuid(10)],
      thePass.arrivalT,
      settings,
      caches,
    ).players.find((p) => p.id === b)
    expect(distance(thePass.to, receiverAtArrival?.pos ?? { x: NaN, y: NaN })).toBeLessThan(1e-9)
    const flightSpeed = distance(thePass.from, thePass.to) / (thePass.arrivalT - thePass.releaseT)
    expect(Math.abs(flightSpeed - 12) / 12).toBeLessThan(0.01)
    expect(thePass.from).toEqual({ x: 10, y: 10 })
  })

  it('derives the ball state around release and reception', () => {
    if (!thePass) return
    const at = (t: number) => evaluate(play, [uuid(10)], t, settings, caches).ball
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

  it('gives the instant the passer obtains the ball (default pass delay, DECISIONS Q15)', () => {
    const scenario = sevenVsSevenWithOptions()
    expect(ballObtainedAt(scenario, P.t1, P.A(4), settings, caches)).toBe(0)
    const t1 = compileLine(scenario, [P.t1], settings, caches).phases[0]
    const arrival = t1?.passes[0]?.arrivalT ?? NaN
    expect(ballObtainedAt(scenario, P.t1, P.A(5), settings, caches)).toBeCloseTo(arrival, 9)
    expect(ballObtainedAt(scenario, P.t1, P.A(1), settings, caches)).toBeNull()
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

  it('emphasise the current phase and draw completed passes', () => {
    const play = sevenVsSevenWithOptions()
    const caches = createCaches()
    const compiled = compileLine(play, LINE_A, settings, caches)
    const t3Start = compiled.phases[2]?.start ?? 0
    const state = evaluate(play, LINE_A, t3Start + 0.5, settings, caches)
    expect(state.traces.some((tr) => tr.current && tr.phaseId === P.t3a)).toBe(true)
    expect(state.traces.filter((tr) => tr.phaseId === P.t1).every((tr) => !tr.current)).toBe(true)
    expect(state.passTraces.filter((p) => p.phaseId === P.t1).every((p) => p.completed)).toBe(true)
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
      phases: [
        phase(uuid(10), null, [
          run(uuid(20), b1, [{ x: 55, y: 32 }]),
          run(uuid(21), b2, [{ x: 54, y: 42 }], { pace: 'sprint' }),
          pass(uuid(22), b1, b2, 0.5),
        ]),
      ],
    })
    const caches = createCaches()
    const compiled = compileLine(play, [uuid(10)], settings, caches)
    expect(compiled.issues).toEqual([])
    const end = evaluate(play, [uuid(10)], compiled.duration, settings, caches)
    expect(end.attackingTeam).toBe('B')
    expect(end.gainLineX).toBe(60)
    expect(end.ball?.kind === 'carried' && end.ball.carrierId).toBe(b2)
    // A pass from B to A is a pass to the other team.
    const toA = { ...play, phases: [phase(uuid(10), null, [pass(uuid(22), b1, a1, 0)])] }
    expect(compileLine(toA, [uuid(10)], settings, caches).issues.map((i) => i.code)).toEqual([
      'passToOpponent',
    ])
  })

  it('handles 4 against 2 without ball', () => {
    const play = fourVsTwoNoBall()
    const caches = createCaches()
    const compiled = compileLine(play, [P.t1], settings, caches)
    expect(compiled.issues).toEqual([])
    expect(compiled.hasBall).toBe(false)
    const state = evaluate(play, [P.t1], compiled.duration / 2, settings, caches)
    expect(state.players.filter((p) => p.team === 'A')).toHaveLength(4)
    expect(state.players.filter((p) => p.team === 'B')).toHaveLength(2)
    expect(state.ball).toBeNull()
    expect(state.gainLineX).toBeNull()
    expect(state.traces.length).toBe(2)
  })

  it('handles an empty play and an empty line', () => {
    const state = evaluate(basePlay({ phases: [] }), [], 3, settings, createCaches())
    expect(state.phaseIndex).toBe(-1)
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

describe('editing a phase-1 run (acceptance criterion 3)', () => {
  it('breaks neither passes nor following phases, in any option', () => {
    const original = sevenVsSevenWithOptions()
    const edited: Play = {
      ...original,
      phases: original.phases.map((ph) =>
        ph.id !== P.t1
          ? ph
          : {
              ...ph,
              actions: ph.actions.map((action) =>
                action.type === 'run' && action.entityId === P.A(5)
                  ? {
                      ...action,
                      waypoints: [
                        { x: 41, y: 45 },
                        { x: 49, y: 47 },
                      ],
                    }
                  : action,
              ),
            },
      ),
    }
    const caches = createCaches()
    for (const line of allLines(edited)) {
      const before = compileLine(original, line, settings, caches)
      const after = compileLine(edited, line, settings, caches)
      expect(after.issues).toEqual([])
      for (let i = 1; i < after.phases.length; i++) {
        const ph = after.phases[i]
        const ref = before.phases[i]
        // Waypoints of descendant phases are untouched; only their start point moves.
        expect(ph?.motions.map((m) => m.waypoints)).toEqual(ref?.motions.map((m) => m.waypoints))
      }
      expect(after.phases[1]?.startPositions[P.A(5)]).toEqual({ x: 49, y: 47 })
      // Every pass is still applied and ends on its receiver.
      for (const ph of after.phases) {
        for (const p of ph.passes) {
          expect(p.applied).toBe(true)
          const state = sampleLine(after, p.arrivalT)
          const receiver = state.players.find((x) => x.id === p.toId)
          expect(distance(receiver?.pos ?? { x: NaN, y: NaN }, p.to)).toBeLessThan(1e-9)
        }
      }
    }
  })
})

describe('engine validations and fallbacks (SPEC 5.3, 5.4, DECISIONS Q13)', () => {
  const base = sevenVsSevenWithOptions()
  const withT1 = (actions: Play['phases'][number]['actions']): Play => ({
    ...base,
    phases: [phase(P.t1, null, actions)],
  })
  const issueCodes = (play: Play) =>
    compileLine(play, [P.t1], settings, createCaches()).issues.map((i) => i.code)

  it('executes a pass to the other team and signals it', () => {
    const play = withT1([pass(uuid(500), P.A(4), P.B(4), 0)])
    expect(issueCodes(play)).toEqual(['passToOpponent'])
    const end = evaluate(play, [P.t1], 10, settings, createCaches())
    expect(end.ball?.kind === 'carried' && end.ball.carrierId).toBe(P.B(4))
  })

  it('ignores a pass from a player without the ball', () => {
    const play = withT1([pass(uuid(500), P.A(1), P.A(2), 0)])
    expect(issueCodes(play)).toEqual(['passerWithoutBall'])
    const end = evaluate(play, [P.t1], 10, settings, createCaches())
    expect(end.ball?.kind === 'carried' && end.ball.carrierId).toBe(P.A(4))
    // A pass released while the ball is in flight is also a pass without the ball.
    const chained = withT1([
      pass(uuid(500), P.A(4), P.A(5), 0),
      pass(uuid(501), P.A(5), P.A(6), 0.1),
    ])
    expect(issueCodes(chained)).toEqual(['passerWithoutBall'])
  })

  it('keeps only the first of two simultaneous passes', () => {
    const play = withT1([
      pass(uuid(500), P.A(4), P.A(5), 0.8),
      pass(uuid(501), P.A(4), P.A(3), 0.8),
    ])
    expect(issueCodes(play)).toEqual(['simultaneousPass'])
    const end = evaluate(play, [P.t1], 10, settings, createCaches())
    expect(end.ball?.kind === 'carried' && end.ball.carrierId).toBe(P.A(5))
  })

  it('applies only the first of two runs of a player in a phase', () => {
    const play = withT1([
      run(uuid(500), P.A(1), [{ x: 30, y: 5 }]),
      run(uuid(501), P.A(1), [{ x: 50, y: 5 }]),
    ])
    expect(issueCodes(play)).toEqual(['twoRunsSamePhase'])
    const end = evaluate(play, [P.t1], 100, settings, createCaches())
    expect(end.players.find((p) => p.id === P.A(1))?.pos).toEqual({ x: 30, y: 5 })
  })

  it('ignores actions of later lots with a warning', () => {
    const kick = {
      id: uuid(500),
      type: 'kick' as const,
      kickerId: P.A(4),
      kind: 'long' as const,
      target: { point: { x: 80, y: 30 } },
      delay: 0,
    }
    const issues = compileLine(withT1([kick]), [P.t1], settings, createCaches()).issues
    expect(issues).toEqual([
      {
        code: 'unsupportedAction',
        severity: 'warning',
        target: { kind: 'action', id: uuid(500), phaseId: P.t1 },
        params: { type: 'kick' },
      },
    ])
  })

  it('never throws on references to missing entities', () => {
    const play = withT1([
      run(uuid(500), uuid(777), [{ x: 1, y: 1 }]),
      pass(uuid(501), uuid(778), P.A(4), 0),
    ])
    expect(() => evaluate(play, [P.t1], 1, settings, createCaches())).not.toThrow()
  })
})

describe('schematic data and bounds', () => {
  const play = sevenVsSevenWithOptions()
  const caches = createCaches()

  it('gives the start positions of a phase, its actions and its ancestors', () => {
    const schematic = phaseSchematic(play, P.t3b, settings, caches)
    expect(schematic?.path).toEqual(LINE_B)
    const t2End = compileLine(play, [P.t1, P.t2], settings, caches).phases[1]?.endPositions
    expect(positionsAtPhaseStart(play, P.t3b, settings, caches)).toEqual(t2End)
    expect(schematic?.runs.map((r) => r.actionId)).toEqual([uuid(230)])
    expect(schematic?.passes.map((p) => p.actionId)).toEqual([uuid(231)])
    expect(schematic?.ancestorRuns.map((r) => r.phaseId)).toEqual([P.t1, P.t1, P.t2])
    expect(schematic?.ball?.kind === 'carried' && schematic.ball.carrierId).toBe(P.A(6))
    expect(phaseSchematic(play, uuid(4242), settings, caches)).toBeNull()
  })

  it('bounds every position of the line', () => {
    const bounds = lineBounds(compileLine(play, LINE_A, settings, caches))
    expect(bounds?.min).toEqual({ x: 40, y: 5 })
    expect(bounds?.max.x).toBeGreaterThanOrEqual(58)
    expect(bounds?.max.y).toBe(66)
  })
})
