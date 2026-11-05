import { describe, expect, it } from 'vitest'
import { defaultSettings, engineSettingsOf, type EngineSettings } from '../../model/settings'
import { allLines } from '../model/branches'
import type { Action, Id, Play, RunAction, Vec2 } from '../model/types'
import {
  P,
  ball,
  basePlay,
  branch,
  breakdown,
  friseFixturePlay,
  kick,
  pass,
  player,
  realisticRunsPlay,
  run,
  setPiecesPlay,
  sevenVsSevenWithOptions,
  uuid,
} from '../test/builders'
import { createCaches, type EvalCaches } from './caches'
import { evaluate } from './evaluate'
import type { SceneState } from './sceneState'
import { compileLine, type CompiledLine } from './timeline'

const settings: EngineSettings = engineSettingsOf(defaultSettings())
const A1 = uuid(1)
const A2 = uuid(2)
const A3 = uuid(3)
const LINE_A = [P.root, P.optA]
const LINE_B = [P.root, P.optB]

/** Everything drawn at t, without what names the line. */
const drawable = (s: SceneState) => ({
  players: s.players,
  ball: s.ball,
  traces: s.traces,
  passTraces: s.passTraces,
  kickTraces: s.kickTraces,
  breakdowns: s.breakdowns,
  speedBadges: s.speedBadges,
  gainLineX: s.gainLineX,
})

/** Instants of the branch points of a line. */
function branchPointsOf(compiled: CompiledLine): number[] {
  return compiled.branches.flatMap((b) => (b.branchAt === null ? [] : [b.branchAt]))
}

/**
 * Every pair of lines of the play gives the same state for t on a grid, before the first branch
 * point where they part (SPEC 5.2).
 */
function expectSameTrunks(play: Play, step = 0.05): void {
  const lines = allLines(play)
  const caches = new Map<Id[], EvalCaches>(lines.map((line) => [line, createCaches()]))
  const at = (line: Id[], t: number) =>
    drawable(evaluate(play, line, t, settings, caches.get(line) ?? createCaches()))
  for (const a of lines) {
    for (const b of lines) {
      if (a === b) continue
      const compiled = compileLine(play, a, settings, createCaches())
      const shared = a.findIndex((id, i) => b[i] !== id)
      const point = compiled.branches[shared - 1]?.branchAt
      if (point === null || point === undefined) continue
      for (let t = 0; t < point - 1e-9; t += step) {
        expect(at(a, t), `t = ${t}`).toEqual(at(b, t))
      }
    }
  }
}

function twoOptions(actions: Action[], branchAt: number, positions: Record<Id, Vec2> = {}): Play {
  return basePlay({
    entities: [player(A1, 'A', 1), player(A2, 'A', 2), player(A3, 'A', 3), ball(uuid(20))],
    setup: {
      positions: {
        [A1]: { x: 40, y: 30 },
        [A2]: { x: 36, y: 42 },
        [A3]: { x: 36, y: 50 },
        ...positions,
      },
      ballCarrierId: A1,
      ballPosition: null,
    },
    branches: [
      branch(P.root, null, { branchAt }),
      branch(P.optA, P.root, { isDefault: true }),
      branch(P.optB, P.root),
    ],
    actions,
  })
}

const compile = (play: Play, line: Id[]) => compileLine(play, line, settings, createCaches())
const codesOf = (compiled: CompiledLine, id: Id) =>
  compiled.issues.filter((i) => i.target.kind === 'action' && i.target.id === id).map((i) => i.code)

describe('trunk identical in every line (SPEC 5.2)', () => {
  it('holds on the acceptance scenarios', () => {
    expectSameTrunks(sevenVsSevenWithOptions())
    expectSameTrunks(setPiecesPlay())
    expectSameTrunks(realisticRunsPlay())
  })

  it('holds on the nested branch points of the fixture', () => {
    const play = friseFixturePlay()
    expect(allLines(play)).toHaveLength(3)
    expectSameTrunks(play, 0.1)
  })

  it('holds with a run of the trunk prolonged by part of the options (D-139 Q1)', () => {
    // Ends after the branch point, at speed in every line: option A goes on, option B stops short.
    const first = run(uuid(30), A1, [{ x: 60, y: 30 }], { pace: 'sprint' })
    const play = twoOptions(
      [
        first,
        run(uuid(31), A1, [{ x: 70, y: 40 }], {
          branchId: P.optA,
          pace: 'sprint',
          startGlue: { targetId: first.id, event: 'end' },
        }),
        run(uuid(32), A2, [{ x: 50, y: 42 }], { branchId: P.optB, start: 2 }),
      ],
      2,
    )
    expectSameTrunks(play)
    const end = (line: Id[]) => compile(play, line).motions.find((m) => m.actionId === first.id)
    expect(end(LINE_B)).toEqual(end(LINE_A))
    expect(end(LINE_A)?.endsAtSpeed).toBe(true)
  })

  it('holds with glues that read the trunk: nothing of an option reaches back', () => {
    // In the trunk: A2 ends with A1, A3 starts at her end; the branch point is glued to that start.
    const a1 = run(uuid(30), A1, [{ x: 60, y: 30 }])
    const a2 = run(uuid(31), A2, [{ x: 50, y: 42 }], {
      endGlue: { targetId: a1.id, event: 'end', keep: 'duration' },
    })
    const a3 = run(uuid(32), A3, [{ x: 50, y: 50 }], {
      startGlue: { targetId: a2.id, event: 'start', offset: 0.5 },
    })
    const play: Play = {
      ...twoOptions(
        [
          a1,
          a2,
          a3,
          run(uuid(33), A1, [{ x: 70, y: 30 }], {
            branchId: P.optA,
            startGlue: { targetId: P.root, event: 'end', offset: 0.1 },
          }),
          breakdown(uuid(34), A2, A1, A3, 9, {
            branchId: P.optB,
            startGlue: { targetId: P.root, event: 'end', offset: 0.1 },
          }),
        ],
        1,
      ),
    }
    play.branches = play.branches.map((b) =>
      b.id === P.root ? { ...b, branchAtGlue: { targetId: a3.id, event: 'start' } } : b,
    )
    expectSameTrunks(play)
    const [lineA, lineB] = [compile(play, LINE_A), compile(play, LINE_B)]
    expect(lineA.branches[0]?.branchAt).toBe(lineB.branches[0]?.branchAt)
    expect(lineA.branches[0]?.branchAt).toBeGreaterThan(0.5)
  })

  it('holds for an action started before the branch point: it goes on in every option', () => {
    // A2 runs from 0 to well after the branch point at 1 s; each option does something else.
    const play = twoOptions(
      [
        run(uuid(30), A2, [{ x: 70, y: 42 }]),
        run(uuid(31), A3, [{ x: 50, y: 50 }], { branchId: P.optA, start: 1 }),
        pass(uuid(32), A1, A3, 1.5, { branchId: P.optB }),
      ],
      1,
    )
    expectSameTrunks(play)
    for (const line of [LINE_A, LINE_B]) {
      const motion = compile(play, line).motions.find((m) => m.actionId === uuid(30))
      expect(motion?.start).toBe(0)
      expect(motion?.until).toBeNull()
    }
  })

  it('never lets an option move anything before its branch point (SPEC 4.3)', () => {
    const play = twoOptions(
      [
        run(uuid(30), A2, [{ x: 60, y: 42 }], { branchId: P.optA, start: 0.5 }),
        run(uuid(31), A2, [{ x: 20, y: 42 }], { branchId: P.optB, start: 0.2 }),
      ],
      2,
    )
    expectSameTrunks(play)
    expect(compile(play, LINE_A).motions[0]?.start).toBe(2)
    expect(compile(play, LINE_B).motions[0]?.start).toBe(2)
  })

  it('keeps the same state on both sides of the branch point', () => {
    const play = sevenVsSevenWithOptions()
    const caches = createCaches()
    const point = branchPointsOf(compileLine(play, LINE_A, settings, caches))[0] ?? NaN
    for (const line of [LINE_A, LINE_B]) {
      const before = evaluate(play, line, point - 1e-7, settings, caches)
      const after = evaluate(play, line, point, settings, caches)
      for (const p of after.players) {
        const q = before.players.find((x) => x.id === p.id)?.pos ?? { x: NaN, y: NaN }
        expect(Math.hypot(p.pos.x - q.x, p.pos.y - q.y)).toBeLessThan(1e-3)
      }
    }
  })
})

describe('flight across a branch point (SPEC 5.2, D-139 Q2)', () => {
  // A1 passes at 1 s; A2 is 12.65 m away: the ball lands at about 2.05 s, after the branch at 1.5 s.
  const withPass = (optionA: Partial<RunAction> = {}): Play =>
    twoOptions(
      [
        pass(uuid(40), A1, A2, 1),
        run(uuid(41), A2, [{ x: 60, y: 60 }], { branchId: P.optA, start: 1.6, ...optionA }),
        run(uuid(42), A2, [{ x: 20, y: 20 }], { branchId: P.optB, start: 1.7 }),
      ],
      1.5,
    )

  it('makes the flight depend on the trunk alone', () => {
    const play = withPass()
    const a = compile(play, LINE_A).passes[0]
    const b = compile(play, LINE_B).passes[0]
    expect(a?.applied).toBe(true)
    expect(a).toEqual(b)
    // A2 stands still in the flight: 12 m and 4 m from A1.
    expect(a?.to).toEqual({ x: 36, y: 42 })
    expect(a?.arrivalT).toBeCloseTo(1 + Math.hypot(4, 12) / 12, 9)
    expectSameTrunks(play)
  })

  it('delays the run of the receiver of an option to the arrival, with the alert', () => {
    const play = withPass()
    const compiled = compile(play, LINE_A)
    const arrival = compiled.passes[0]?.arrivalT ?? NaN
    const motion = compiled.motions.find((m) => m.actionId === uuid(41))
    expect(motion?.planned).toBe(1.6)
    expect(motion?.start).toBe(arrival)
    expect(compiled.blocks[uuid(41)]?.start).toBe(arrival)
    const delayed = compiled.issues.find((i) => i.code === 'runStartDelayed')
    expect(delayed?.target).toEqual({ kind: 'action', id: uuid(41), branchId: P.optA })
    expect(delayed?.params?.delay).toBeCloseTo(arrival - 1.6, 9)
  })

  it('does not delay a run of the receiver that starts after the arrival', () => {
    const play = withPass({ start: 3 })
    const compiled = compile(play, LINE_A)
    expect(codesOf(compiled, uuid(41))).toEqual([])
    expect(compiled.motions.find((m) => m.actionId === uuid(41))?.start).toBe(3)
  })

  it('does not delay the run of another player', () => {
    const play = twoOptions(
      [
        pass(uuid(40), A1, A2, 1),
        run(uuid(41), A3, [{ x: 60, y: 60 }], { branchId: P.optA, start: 1.6 }),
      ],
      1.5,
    )
    const compiled = compile(play, LINE_A)
    expect(compiled.motions.find((m) => m.actionId === uuid(41))?.start).toBe(1.6)
    expect(compiled.issues).toEqual([])
  })

  it('keeps a run of the trunk of the receiver in the flight', () => {
    // A2 runs in the trunk during the whole flight: the ball meets her on it.
    const play = twoOptions(
      [
        run(uuid(43), A2, [{ x: 50, y: 42 }]),
        pass(uuid(40), A1, A2, 1),
        run(uuid(41), A2, [{ x: 70, y: 60 }], { branchId: P.optA, start: 1.6 }),
      ],
      1.5,
    )
    const compiled = compile(play, LINE_A)
    const flight = compiled.passes[0]
    expect(flight).toEqual(compile(play, LINE_B).passes[0])
    const trunkRun = compiled.motions.find((m) => m.actionId === uuid(43))
    const second = compiled.motions.find((m) => m.actionId === uuid(41))
    // The run of the option is after the run of the trunk and after the arrival.
    expect(second?.start).toBeGreaterThanOrEqual(flight?.arrivalT ?? NaN)
    expect(second?.start).toBeCloseTo((trunkRun?.start ?? 0) + (trunkRun?.duration ?? 0), 9)
    expectSameTrunks(play)
  })

  it('applies to a kick towards a receiver, not to a kick towards a point', () => {
    const toReceiver = twoOptions(
      [
        kick(uuid(40), A1, { receiverId: A2 }, 1),
        run(uuid(41), A2, [{ x: 60, y: 60 }], { branchId: P.optA, start: 1.6 }),
        run(uuid(42), A2, [{ x: 20, y: 20 }], { branchId: P.optB, start: 2 }),
      ],
      1.5,
    )
    const a = compile(toReceiver, LINE_A)
    expect(a.kicks[0]).toEqual(compile(toReceiver, LINE_B).kicks[0])
    expect(a.kicks[0]?.to).toEqual({ x: 36, y: 42 })
    expect(a.motions.find((m) => m.actionId === uuid(41))?.start).toBe(1 + 3.5)
    expect(codesOf(a, uuid(41))).toContain('runStartDelayed')
    expectSameTrunks(toReceiver)

    const toPoint = twoOptions(
      [
        kick(uuid(40), A1, { point: { x: 75, y: 30 } }, 1),
        run(uuid(41), A2, [{ x: 60, y: 60 }], { branchId: P.optA, start: 1.6 }),
      ],
      1.5,
    )
    expect(compile(toPoint, LINE_A).motions[0]?.start).toBe(1.6)
    expectSameTrunks(toPoint)
  })

  it('does not apply to a pass released at or after the branch point', () => {
    const play = twoOptions(
      [
        pass(uuid(40), A1, A2, 1.5, { branchId: P.optA }),
        run(uuid(41), A2, [{ x: 60, y: 60 }], { branchId: P.optA, start: 1.6 }),
      ],
      1.5,
    )
    const compiled = compile(play, LINE_A)
    expect(compiled.motions[0]?.start).toBe(1.6)
    // The ball meets her on her run: the option decides.
    expect(compiled.passes[0]?.to).not.toEqual({ x: 36, y: 42 })
  })

  it('does not delay anything for an ignored pass', () => {
    const play = twoOptions(
      [
        pass(uuid(40), A3, A2, 1),
        run(uuid(41), A2, [{ x: 60, y: 60 }], { branchId: P.optA, start: 1.6 }),
      ],
      1.5,
    )
    const compiled = compile(play, LINE_A)
    expect(compiled.passes[0]?.applied).toBe(false)
    expect(compiled.motions[0]?.start).toBe(1.6)
    expect(codesOf(compiled, uuid(40))).toEqual(['passerWithoutBall'])
  })

  it('keeps the order of the runs read ahead by the flight (SPEC 5.3)', () => {
    // A2 runs towards the ball: the first estimate of the arrival, from her position at the release,
    // is after the real arrival, and reads her run of 2.7 s, which starts after that arrival. It is
    // built again in its order, after the run of the option, ready at the arrival.
    const play = twoOptions(
      [
        run(uuid(45), A2, [{ x: 24, y: 30 }], { pace: 'sprint' }),
        pass(uuid(40), A1, A2, 1),
        run(uuid(41), A2, [{ x: 24, y: 40 }], { branchId: P.optA, pace: 'walk', start: 1.6 }),
        run(uuid(43), A2, [{ x: 10, y: 60 }], { start: 2.7 }),
      ],
      1.5,
      { [A2]: { x: 16, y: 30 } },
    )
    const compiled = compile(play, LINE_A)
    const arrival = compiled.passes[0]?.arrivalT ?? NaN
    expect(arrival).toBeLessThan(2.7)
    const estimate = 1 + 22 / 12
    expect(estimate).toBeGreaterThan(2.7)
    const first = compiled.motions.find((m) => m.actionId === uuid(45))
    const option = compiled.motions.find((m) => m.actionId === uuid(41))
    const trunk = compiled.motions.find((m) => m.actionId === uuid(43))
    expect(option?.start).toBeCloseTo(
      Math.max(arrival, (first?.start ?? 0) + (first?.duration ?? 0)),
      9,
    )
    expect(trunk?.start).toBeCloseTo((option?.start ?? 0) + (option?.duration ?? 0), 9)
  })

  it('leaves the runs in their order after a kick that is ignored', () => {
    // A3 has no ball: nothing waits for an arrival, and the run of 2 s read ahead for the target of
    // the kick is built again after the run of the option, which is ready first.
    const play = twoOptions(
      [
        kick(uuid(40), A3, { receiverId: A2 }, 1),
        run(uuid(41), A2, [{ x: 40, y: 42 }], { branchId: P.optA, start: 1.6 }),
        run(uuid(43), A2, [{ x: 38, y: 60 }], { start: 2 }),
      ],
      1.5,
    )
    const compiled = compile(play, LINE_A)
    expect(compiled.kicks[0]?.applied).toBe(false)
    const option = compiled.motions.find((m) => m.actionId === uuid(41))
    const trunk = compiled.motions.find((m) => m.actionId === uuid(43))
    expect(option?.start).toBe(1.6)
    expect(trunk?.start).toBeCloseTo(1.6 + (option?.duration ?? 0), 9)
  })

  it('is not concerned by a breakdown of an option: no ball, no formation', () => {
    const play = twoOptions(
      [pass(uuid(40), A1, A2, 1), breakdown(uuid(44), A2, A1, A3, 1.6, { branchId: P.optA })],
      1.5,
    )
    expect(compile(play, LINE_A).breakdowns[0]?.applied).toBe(false)
    expect(compile(play, LINE_A).passes[0]).toEqual(compile(play, LINE_B).passes[0])
    expectSameTrunks(play)
  })
})
