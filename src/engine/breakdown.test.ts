import { describe, expect, it } from 'vitest'
import { defaultSettings, engineSettingsOf, type EngineSettings } from '../model/settings'
import type { Action, Play } from '../model/types'
import { basePlay, ball, breakdown, pass, phase, player, run, uuid } from '../test/builders'
import { createCaches } from './caches'
import { evaluate, phaseSchematic } from './evaluate'
import { compileLine } from './timeline'
import { distance } from './vec'

// Paces of lots 1 to 3 (sprint 7 m/s), which these timings were written for.
const settings: EngineSettings = {
  ...engineSettingsOf(defaultSettings()),
  paces: { walk: 2, jog: 4, sprint: 7 },
}

// A attacks towards +x. A1 carries the ball and runs into contact in 2 s (3 m/s); A2 arrives in
// support at the same time; A3 is the relayer, 9.22 m from the relay position.
const A1 = uuid(1)
const A2 = uuid(2)
const A3 = uuid(3)
const A4 = uuid(4)
const A7 = uuid(7)
const T1 = uuid(10)
const T2 = uuid(11)
const RUCK = uuid(30)

function ruckPlay(t1: Action[], t2: Action[] = [], attackingTeam: 'A' | 'B' = 'A'): Play {
  return basePlay({
    attackingTeam,
    entities: [
      player(A1, 'A', 1),
      player(A2, 'A', 2),
      player(A3, 'A', 3),
      player(A4, 'A', 4),
      player(A7, 'A', 7),
      ball(uuid(20)),
    ],
    setup: {
      positions: {
        [A1]: { x: 40, y: 30 },
        [A2]: { x: 40, y: 33 },
        [A3]: { x: 38, y: 36 },
        [A4]: { x: 37, y: 40 },
        [A7]: { x: 40, y: 65 },
      },
      ballCarrierId: A1,
      ballPosition: null,
    },
    phases: [phase(T1, null, t1), phase(T2, T1, t2)],
  })
}

const contact = (): Action[] => [
  run(uuid(40), A1, [{ x: 46, y: 30 }], { durationOverride: 2 }),
  run(uuid(41), A2, [{ x: 45.5, y: 31 }], { durationOverride: 2 }),
]

const at = (play: Play, t: number, line = [T1, T2]) =>
  evaluate(play, line, t, settings, createCaches())
const posOf = (play: Play, id: string, t: number) =>
  at(play, t).players.find((p) => p.id === id)?.pos ?? { x: NaN, y: NaN }

describe('breakdowns (SPEC 10.3)', () => {
  const play = ruckPlay([...contact(), breakdown(RUCK, A1, A2, A3, 2)], [pass(uuid(50), A3, A4, 0)])

  it('holds the ball in the breakdown for its whole duration', () => {
    for (const t of [2, 2.5, 4, 4.999]) {
      const state = at(play, t)
      expect(state.ball).toEqual({ kind: 'inBreakdown', pos: { x: 46, y: 30 } })
      expect(state.breakdowns).toEqual([{ actionId: RUCK, kind: 'ruck', pos: { x: 46, y: 30 } }])
    }
    const before = at(play, 1.999).ball
    expect(before?.kind === 'carried' && before.carrierId).toBe(A1)
  })

  it('makes the relayer the carrier at the end, at the relay position', () => {
    // At t = 5 on the full line, the pass of phase 2 (delay 0) already flies: read phase 1 alone.
    const end = at(play, 5, [T1]).ball
    expect(end?.kind === 'carried' && end.carrierId).toBe(A3)
    // 1 m behind the ball, on the side of the attacking team (towards -x for A).
    expect(distance(posOf(play, A3, 5), { x: 45, y: 30 })).toBeLessThan(1e-9)
    // The relayer sprints (7 m/s) then waits: 9.22 m in 1.32 s.
    const travel = Math.hypot(7, 6) / 7
    expect(distance(posOf(play, A3, 2 + travel), { x: 45, y: 30 })).toBeLessThan(1e-6)
    expect(distance(posOf(play, A3, 2 + travel / 2), { x: 41.5, y: 33 })).toBeLessThan(1e-6)
    expect(at(play, 5).breakdowns).toEqual([])
  })

  it('freezes the tackled player and the support during the breakdown', () => {
    for (const t of [2, 3, 4.9]) {
      expect(posOf(play, A1, t)).toEqual({ x: 46, y: 30 })
      expect(posOf(play, A2, t)).toEqual({ x: 45.5, y: 31 })
    }
  })

  it('starts the next phase when the ball comes out', () => {
    const compiled = compileLine(play, [T1, T2], settings, createCaches())
    expect(compiled.phases[0]?.end).toBe(5)
    expect(compiled.phases[1]?.start).toBe(5)
    expect(compiled.phases[1]?.holderAtStart).toEqual({ kind: 'carried', carrierId: A3 })
    expect(compiled.phases[1]?.passes[0]?.applied).toBe(true)
    expect(compiled.issues).toEqual([])
  })

  it('moves the gain line to the breakdown point at its formation', () => {
    expect(at(play, 0).gainLineX).toBe(40)
    expect(at(play, 1.999).gainLineX).toBe(40)
    expect(at(play, 2).gainLineX).toBe(46)
    expect(at(play, 6).gainLineX).toBe(46)
    // Schematic mode: the gain line in force at the start of the phase (D-082).
    const caches = createCaches()
    expect(phaseSchematic(play, T1, settings, caches)?.gainLineX).toBe(40)
    expect(phaseSchematic(play, T2, settings, caches)?.gainLineX).toBe(46)
  })

  it('places the relay position behind the ball when B attacks', () => {
    // Same players in team B, attacking towards -x: B1 runs back into contact at x = 46.
    const play = ruckPlay([...contact(), breakdown(RUCK, A1, A2, A3, 2)], [], 'B')
    const bTeam: Play = {
      ...play,
      entities: play.entities.map((e) => (e.kind === 'player' ? { ...e, team: 'B' } : e)),
    }
    expect(distance(posOf(bTeam, A3, 5), { x: 47, y: 30 })).toBeLessThan(1e-9)
    expect(at(bTeam, 3).gainLineX).toBe(46)
  })

  it('behaves the same for a maul (D-080)', () => {
    const maul = ruckPlay([...contact(), breakdown(RUCK, A1, A2, A3, 2, { kind: 'maul' })])
    expect(at(maul, 3).ball).toEqual({ kind: 'inBreakdown', pos: { x: 46, y: 30 } })
    expect(at(maul, 3).breakdowns[0]?.kind).toBe('maul')
    expect(at(maul, 3).gainLineX).toBe(46)
    const end = at(maul, 5).ball
    expect(end?.kind === 'carried' && end.carrierId).toBe(A3)
  })

  it('cuts the runs of the participants at the formation, with a warning (D-079)', () => {
    const early = ruckPlay([...contact(), breakdown(RUCK, A1, A2, A3, 1)])
    const compiled = compileLine(early, [T1, T2], settings, createCaches())
    expect(compiled.issues.map((i) => [i.code, i.target.kind === 'action' && i.target.id])).toEqual(
      [
        ['runCutByBreakdown', uuid(40)],
        ['runCutByBreakdown', uuid(41)],
      ],
    )
    expect(posOf(early, A1, 3)).toEqual({ x: 43, y: 30 })
    const schematic = phaseSchematic(early, T1, settings, createCaches())
    const cut = schematic?.runs.find((r) => r.actionId === uuid(40))
    expect(cut?.points.at(-1)).toEqual({ x: 43, y: 30 })
    expect(cut?.ignoredPoints[0]).toEqual({ x: 43, y: 30 })
    expect(cut?.ignoredPoints.at(-1)).toEqual({ x: 46, y: 30 })
    expect(cut?.waypoints).toEqual([{ x: 46, y: 30 }])
    // The phase lasts until the ball comes out, not until the end of the cut runs.
    expect(compiled.phases[0]?.end).toBe(4)
  })

  it('ignores a run of a participant that starts after the formation', () => {
    const late = ruckPlay([
      ...contact(),
      run(uuid(42), A3, [{ x: 30, y: 36 }], { delay: 3 }),
      breakdown(RUCK, A1, A2, A3, 2),
    ])
    const compiled = compileLine(late, [T1, T2], settings, createCaches())
    expect(compiled.issues.map((i) => i.code)).toEqual(['runCutByBreakdown'])
    expect(compiled.phases[0]?.ignoredRuns.map((m) => m.actionId)).toEqual([uuid(42)])
    expect(distance(posOf(late, A3, 5), { x: 45, y: 30 })).toBeLessThan(1e-9)
    const schematic = phaseSchematic(late, T1, settings, createCaches())
    const ignored = schematic?.runs.find((r) => r.actionId === uuid(42))
    expect(ignored?.points).toHaveLength(1)
    expect(ignored?.ignoredPoints.at(-1)).toEqual({ x: 30, y: 36 })
    expect(schematic?.relays.map((r) => r.entityId)).toEqual([A3])
  })

  it('makes a far relayer arrive exactly when the ball comes out, with a warning', () => {
    const far = ruckPlay([...contact(), breakdown(RUCK, A1, A2, A7, 2)])
    const compiled = compileLine(far, [T1, T2], settings, createCaches())
    expect(compiled.issues.map((i) => i.code)).toEqual(['relayerLate'])
    expect(distance(posOf(far, A7, 5), { x: 45, y: 30 })).toBeLessThan(1e-9)
    expect(distance(posOf(far, A7, 4.9), { x: 45, y: 30 })).toBeGreaterThan(0.1)
  })

  it('ignores a breakdown whose tackled player has no ball, with an error (D-079)', () => {
    const wrong = ruckPlay([...contact(), breakdown(RUCK, A2, A1, A3, 2)])
    const compiled = compileLine(wrong, [T1, T2], settings, createCaches())
    expect(compiled.issues.map((i) => i.code)).toEqual(['tackledWithoutBall'])
    expect(compiled.phases[0]?.end).toBe(2)
    expect(compiled.phases[0]?.breakdowns[0]?.applied).toBe(false)
    const state = at(wrong, 3)
    expect(state.ball?.kind === 'carried' && state.ball.carrierId).toBe(A1)
    expect(state.gainLineX).toBe(40)
    expect(posOf(wrong, A3, 3)).toEqual({ x: 38, y: 36 })
  })

  it('lets the relayer pass after the ball comes out, in the same phase', () => {
    const same = ruckPlay([
      ...contact(),
      breakdown(RUCK, A1, A2, A3, 2),
      pass(uuid(51), A3, A4, 5.5),
    ])
    const compiled = compileLine(same, [T1], settings, createCaches())
    expect(compiled.issues).toEqual([])
    expect(compiled.phases[0]?.passes[0]?.applied).toBe(true)
    const end = at(same, 100, [T1]).ball
    expect(end?.kind === 'carried' && end.carrierId).toBe(A4)
  })

  it('refuses a second breakdown formed while the first is in progress', () => {
    const twice = ruckPlay([
      ...contact(),
      breakdown(RUCK, A1, A2, A3, 2),
      breakdown(uuid(31), A3, A2, A4, 3),
    ])
    const compiled = compileLine(twice, [T1], settings, createCaches())
    expect(compiled.issues.map((i) => i.code)).toEqual(['tackledWithoutBall'])
  })
})
