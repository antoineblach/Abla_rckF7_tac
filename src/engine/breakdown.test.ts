import { describe, expect, it } from 'vitest'
import { distance } from './vec'
import { defaultSettings, engineSettingsOf, type EngineSettings } from '../model/settings'
import type { Action, Play } from '../model/types'
import { P, basePlay, ball, breakdown, pass, player, run, sequence, uuid } from '../test/builders'
import { createCaches } from './caches'
import { evaluate, windowSchematic } from './evaluate'
import { compileLine } from './timeline'

// These tests check the rules of the breakdowns, not the speed profile (profile.test.ts): paces of
// lots 1 to 3 (sprint 7 m/s) and near-instant accelerations keep their timings, ramps of a few
// millimetres apart (accelerations of 1000 m/s², top speed far above the paces, alert thresholds
// of the accelerations out of reach).
const settings: EngineSettings = {
  ...engineSettingsOf(defaultSettings()),
  paces: { walk: 2, jog: 4, sprint: 7 },
  motion: { accel: 1000, decel: 1000, lateralAccel: 1000, topSpeed: 1000 },
  accelAlert: { warning: 1e6, danger: 1e6 },
  decelAlert: { warning: 1e6, danger: 1e6 },
}

// A attacks towards +x. A1 carries the ball and runs into contact in 2 s (3 m/s); A2 arrives in
// support at the same time; A3 is the relayer, 9.22 m from the relay position.
const A1 = uuid(1)
const A2 = uuid(2)
const A3 = uuid(3)
const A4 = uuid(4)
const A7 = uuid(7)
const RUCK = uuid(30)
const LINE = [P.root]

function ruckPlay(actions: Action[], attackingTeam: 'A' | 'B' = 'A'): Play {
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
    actions,
  })
}

const contact = (): Action[] => [
  run(uuid(40), A1, [{ x: 46, y: 30 }], { durationOverride: 2 }),
  run(uuid(41), A2, [{ x: 45.5, y: 31 }], { durationOverride: 2 }),
]

const compile = (play: Play) => compileLine(play, LINE, settings, createCaches())
const at = (play: Play, t: number) => evaluate(play, LINE, t, settings, createCaches())
const posOf = (play: Play, id: string, t: number) =>
  at(play, t).players.find((p) => p.id === id)?.pos ?? { x: NaN, y: NaN }

describe('breakdowns (SPEC 10.3)', () => {
  const ruckOnly = ruckPlay([...contact(), breakdown(RUCK, A1, A2, A3, 2)])
  const play = ruckPlay([...contact(), breakdown(RUCK, A1, A2, A3, 2), pass(uuid(50), A3, A4, 5)])

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
    const end = at(ruckOnly, 5).ball
    expect(end?.kind === 'carried' && end.carrierId).toBe(A3)
    // 1 m behind the ball, on the side of the attacking team (towards -x for A).
    expect(distance(posOf(play, A3, 5), { x: 45, y: 30 })).toBeLessThan(1e-9)
    // The relayer sprints (7 m/s) then waits: 9.22 m in 1.32 s (ramps within one sample).
    const relay = compile(play).motions.find((m) => m.source === 'relay')
    const travel = relay?.duration ?? NaN
    expect(Math.abs(travel - Math.hypot(7, 6) / 7)).toBeLessThan(0.05)
    expect(distance(posOf(play, A3, 2 + travel), { x: 45, y: 30 })).toBeLessThan(1e-9)
    // Symmetric ramps: half the way at half the time.
    expect(distance(posOf(play, A3, 2 + travel / 2), { x: 41.5, y: 33 })).toBeLessThan(1e-3)
    expect(at(play, 5).breakdowns).toEqual([])
  })

  it('freezes the tackled player and the support during the breakdown', () => {
    for (const t of [2, 3, 4.9]) {
      expect(posOf(play, A1, t)).toEqual({ x: 46, y: 30 })
      expect(posOf(play, A2, t)).toEqual({ x: 45.5, y: 31 })
    }
  })

  it('lets the relayer pass exactly when the ball comes out', () => {
    const compiled = compile(play)
    expect(compiled.passes[0]?.applied).toBe(true)
    expect(compiled.passes[0]?.releaseT).toBe(5)
    expect(compiled.issues).toEqual([])
  })

  it('moves the gain line to the breakdown point at its formation', () => {
    expect(at(play, 0).gainLineX).toBe(40)
    expect(at(play, 1.999).gainLineX).toBe(40)
    expect(at(play, 2).gainLineX).toBe(46)
    expect(at(play, 6).gainLineX).toBe(46)
    // Schematic mode: the gain line in force at the start of the interval (D-082).
    const caches = createCaches()
    const split = { ...play, sequences: [sequence(uuid(60), 0, 5)] }
    expect(windowSchematic(split, LINE, 3, settings, caches).gainLineX).toBe(40)
    expect(windowSchematic(split, LINE, 5.5, settings, caches).gainLineX).toBe(46)
  })

  it('places the relay position behind the ball when B attacks', () => {
    // Same players in team B, attacking towards -x: B1 runs back into contact at x = 46.
    const asB = ruckPlay([...contact(), breakdown(RUCK, A1, A2, A3, 2)], 'B')
    const bTeam: Play = {
      ...asB,
      entities: asB.entities.map((e) => (e.kind === 'player' ? { ...e, team: 'B' } : e)),
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
    const compiled = compile(early)
    expect(compiled.issues.map((i) => [i.code, i.target.kind === 'action' && i.target.id])).toEqual(
      [
        ['runCutByBreakdown', uuid(40)],
        ['runCutByBreakdown', uuid(41)],
      ],
    )
    // Frozen half way (a few millimetres short, the start ramp).
    const frozen = posOf(early, A1, 3)
    expect(distance(frozen, { x: 43, y: 30 })).toBeLessThan(0.01)
    const schematic = windowSchematic(early, LINE, 0, settings, createCaches())
    const cut = schematic.runs.find((r) => r.actionId === uuid(40))
    expect(cut?.points.at(-1)).toEqual(frozen)
    expect(cut?.ignoredPoints[0]).toEqual(frozen)
    expect(cut?.ignoredPoints.at(-1)).toEqual({ x: 46, y: 30 })
    expect(cut?.waypoints).toEqual([{ x: 46, y: 30 }])
    // The line lasts until the ball comes out, not until the end of the cut runs.
    expect(compiled.duration).toBe(4)
    expect(compiled.blocks[uuid(40)]).toEqual({ start: 0, end: 1 })
  })

  it('delays a run of a participant that starts after the formation to the ball out', () => {
    const late = ruckPlay([
      ...contact(),
      run(uuid(42), A3, [{ x: 30, y: 36 }], { start: 3 }),
      breakdown(RUCK, A1, A2, A3, 2),
    ])
    const compiled = compile(late)
    expect(compiled.issues.map((i) => i.code)).toEqual(['runStartDelayed'])
    expect(distance(posOf(late, A3, 5), { x: 45, y: 30 })).toBeLessThan(1e-9)
    const schematic = windowSchematic(late, LINE, 0, settings, createCaches())
    const delayed = schematic.runs.find((r) => r.actionId === uuid(42))
    expect(delayed?.points[0]).toEqual({ x: 45, y: 30 })
    expect(delayed?.ignoredPoints).toEqual([])
    expect(schematic.relays.map((r) => r.entityId)).toEqual([A3])
  })

  it('makes a far relayer arrive exactly when the ball comes out, with a warning', () => {
    const far = ruckPlay([...contact(), breakdown(RUCK, A1, A2, A7, 2)])
    const compiled = compile(far)
    expect(compiled.issues.map((i) => i.code)).toEqual(['relayerLate'])
    expect(distance(posOf(far, A7, 5), { x: 45, y: 30 })).toBeLessThan(1e-9)
    expect(distance(posOf(far, A7, 4.9), { x: 45, y: 30 })).toBeGreaterThan(0.1)
    // Same levers as a run (D-130): her peak speed, and her accelerations scaled if needed.
    const relay = compiled.motions.find((m) => m.source === 'relay')
    const params = compiled.issues[0]?.params
    expect(params?.speed).toBeGreaterThan(settings.paces.sprint)
    expect(params?.speed).toBeCloseTo(Math.max(...(relay?.profile.v ?? [])), 12)
    expect(params?.accel).toBe(relay?.accelFactor)
  })

  it('ignores a breakdown whose tackled player has no ball, with an error (D-079)', () => {
    const wrong = ruckPlay([...contact(), breakdown(RUCK, A2, A1, A3, 2)])
    const compiled = compile(wrong)
    expect(compiled.issues.map((i) => i.code)).toEqual(['tackledWithoutBall'])
    expect(compiled.duration).toBe(2)
    expect(compiled.breakdowns[0]?.applied).toBe(false)
    const state = at(wrong, 3)
    expect(state.ball?.kind === 'carried' && state.ball.carrierId).toBe(A1)
    expect(state.gainLineX).toBe(40)
    expect(posOf(wrong, A3, 3)).toEqual({ x: 38, y: 36 })
  })

  it('lets the relayer pass after the ball comes out', () => {
    const same = ruckPlay([
      ...contact(),
      breakdown(RUCK, A1, A2, A3, 2),
      pass(uuid(51), A3, A4, 5.5),
    ])
    const compiled = compile(same)
    expect(compiled.issues).toEqual([])
    expect(compiled.passes[0]?.applied).toBe(true)
    const end = at(same, 100).ball
    expect(end?.kind === 'carried' && end.carrierId).toBe(A4)
  })

  it('refuses a second breakdown formed while the first is in progress', () => {
    const twice = ruckPlay([
      ...contact(),
      breakdown(RUCK, A1, A2, A3, 2),
      breakdown(uuid(31), A3, A2, A4, 3),
    ])
    expect(compile(twice).issues.map((i) => i.code)).toEqual(['tackledWithoutBall'])
  })
})
