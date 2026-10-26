import { describe, expect, it } from 'vitest'
import { KICK_FLIGHT_TIME } from '../config/defaults'
import { defaultSettings, engineSettingsOf, type EngineSettings } from '../model/settings'
import type { Action, Play, Vec2 } from '../model/types'
import { basePlay, ball, kick, pass, phase, player, run, uuid } from '../test/builders'
import { kickFlightTime, kickLift } from './ballEvents'
import { lineBounds } from './bounds'
import { createCaches } from './caches'
import { PROFILE_TOLERANCE, timeFromRest } from '../test/profileMath'
import { evaluate, phaseSchematic } from './evaluate'
import { compileLine } from './timeline'
import { distance } from './vec'

const settings: EngineSettings = engineSettingsOf(defaultSettings())
const { motion } = settings
const { walk, jog, sprint } = settings.paces
/** Pickup instants follow the speed profile, exact on its samples. */
const expectInstant = (actual: number | undefined, expected: number) => {
  expect(Math.abs((actual ?? NaN) - expected)).toBeLessThan(PROFILE_TOLERANCE)
}

const A1 = uuid(1)
const A2 = uuid(2)
const B1 = uuid(11)
const T1 = uuid(10)
const T2 = uuid(11 + 100)
const KICK = uuid(30)

function kickPlay(
  t1: Action[],
  t2: Action[] = [],
  setup: Partial<Play['setup']> = {},
  positions: Record<string, Vec2> = {},
): Play {
  return basePlay({
    entities: [player(A1, 'A', 1), player(A2, 'A', 2), player(B1, 'B', 1), ball(uuid(20))],
    setup: {
      positions: {
        [A1]: { x: 40, y: 30 },
        [A2]: { x: 60, y: 30 },
        [B1]: { x: 90, y: 30 },
        ...positions,
      },
      ballCarrierId: A1,
      ballPosition: null,
      ...setup,
    },
    phases: [phase(T1, null, t1), phase(T2, T1, t2)],
  })
}

const state = (play: Play, t: number, line = [T1, T2]) =>
  evaluate(play, line, t, settings, createCaches())

describe('kicks (SPEC 10.4)', () => {
  it('arrives on the receiver at release + flightTime', () => {
    // B1 runs towards the ball; restart kick released at 0.5 s, default flight time 3 s.
    const play = kickPlay([
      run(uuid(40), B1, [{ x: 70, y: 40 }], { pace: 'jog' }),
      kick(KICK, A1, { receiverId: B1 }, 0.5, { kind: 'restart' }),
    ])
    const compiled = compileLine(play, [T1], settings, createCaches())
    const k = compiled.phases[0]?.kicks[0]
    expect(k?.applied).toBe(true)
    expect(k?.arrivalT).toBe(0.5 + KICK_FLIGHT_TIME.restart)
    const atArrival = state(play, 3.5, [T1])
    expect(atArrival.ball?.kind === 'carried' && atArrival.ball.carrierId).toBe(B1)
    const receiver = atArrival.players.find((p) => p.id === B1)?.pos ?? { x: NaN, y: NaN }
    expect(distance(receiver, k?.to ?? { x: 0, y: 0 })).toBeLessThan(1e-9)
    // No warning for a kick to the other team (D-083).
    expect(compiled.issues).toEqual([])
  })

  it('counts its flight in the duration of the phase', () => {
    const play = kickPlay([kick(KICK, A1, { point: { x: 75, y: 30 } }, 0.5)])
    expect(compileLine(play, [T1], settings, createCaches()).phases[0]?.end).toBe(4)
  })

  it('flies straight, rising to its apex in the middle of the flight', () => {
    const play = kickPlay([kick(KICK, A1, { point: { x: 75, y: 30 } }, 0)])
    const at = (t: number) => state(play, t, [T1]).ball
    const start = at(0)
    expect(start).toMatchObject({ kind: 'inFlight', via: 'kick', toId: null, lift: 0 })
    const middle = at(KICK_FLIGHT_TIME.long / 2)
    expect(middle).toMatchObject({ kind: 'inFlight', lift: 1, pos: { x: 57.5, y: 30 } })
    const quarter = at(KICK_FLIGHT_TIME.long / 4)
    expect(quarter?.kind === 'inFlight' && quarter.lift).toBeCloseTo(0.75, 9)
    expect(kickLift(0)).toBe(0)
    expect(kickLift(1)).toBe(0)
    const traces = state(play, 1, [T1]).kickTraces
    expect(traces).toHaveLength(1)
    expect(traces[0]).toMatchObject({ toPoint: true, completed: false, target: { x: 75, y: 30 } })
  })

  it('uses the default flight time of its kind, or its own', () => {
    expect(kickFlightTime({ kind: 'restart' })).toBe(3)
    expect(kickFlightTime({ kind: 'long' })).toBe(3.5)
    expect(kickFlightTime({ kind: 'long', flightTime: 2 })).toBe(2)
  })

  it('leaves the ball on the ground at the target point, picked up by the first player within 1 m', () => {
    // Landing at 3.5 s. A2 sprints through the point from 3 s; B1 sprints from the other side
    // from 2.5 s: both have 14 m to cover to come within 1 m, B1 half a second earlier.
    const play = kickPlay([
      kick(KICK, A1, { point: { x: 75, y: 30 } }, 0),
      run(uuid(41), A2, [{ x: 90, y: 30 }], { pace: 'sprint', delay: 3 }),
      run(uuid(42), B1, [{ x: 60, y: 30 }], { pace: 'sprint', delay: 2.5 }),
    ])
    const landed = state(play, 3.5, [T1]).ball
    expect(landed).toEqual({ kind: 'loose', pos: { x: 75, y: 30 } })
    const segments = compileLine(play, [T1], settings, createCaches()).phases[0]?.ball ?? []
    const pickup = segments.at(-1)
    expect(pickup?.kind === 'carried' && pickup.carrierId).toBe(B1)
    const pickupT = 2.5 + timeFromRest(14, sprint, motion, sprint)
    expectInstant(pickup?.start, pickupT)
    expect(state(play, pickupT - 0.05, [T1]).ball?.kind).toBe('loose')
    const after = state(play, pickupT + 0.05, [T1]).ball
    expect(after?.kind === 'carried' && after.carrierId).toBe(B1)
  })

  it('lets a player already within reach at the landing pick the ball up at once', () => {
    const play = kickPlay([kick(KICK, A1, { point: { x: 60.5, y: 30 } }, 0)])
    const segments = compileLine(play, [T1], settings, createCaches()).phases[0]?.ball ?? []
    expect(segments.map((s) => s.kind)).toEqual(['carried', 'flight', 'loose', 'carried'])
    expect(segments.at(-1)).toEqual({ kind: 'carried', start: 3.5, carrierId: A2 })
  })

  it('keeps searching for the pickup in the following phases', () => {
    const play = kickPlay(
      [kick(KICK, A1, { point: { x: 75, y: 30 } }, 0)],
      [run(uuid(41), A2, [{ x: 80, y: 30 }], { pace: 'jog' })],
    )
    const compiled = compileLine(play, [T1, T2], settings, createCaches())
    expect(compiled.phases[0]?.holderAtEnd).toEqual({ kind: 'loose', pos: { x: 75, y: 30 } })
    // A2 jogs from x = 60 from 3.5 s: x = 74 after 14 m.
    const pickup = compiled.phases[1]?.ball.at(-1)
    expect(pickup?.kind === 'carried' && pickup.carrierId).toBe(A2)
    expectInstant(pickup?.start, 3.5 + timeFromRest(14, jog, motion, sprint))
  })

  it('stays on the ground when nobody comes', () => {
    const play = kickPlay([kick(KICK, A1, { point: { x: 75, y: 30 } }, 0)])
    expect(state(play, 100).ball).toEqual({ kind: 'loose', pos: { x: 75, y: 30 } })
  })

  it('ignores a kick from a player without the ball, with an error', () => {
    const play = kickPlay([kick(KICK, A2, { point: { x: 75, y: 30 } }, 0)])
    const compiled = compileLine(play, [T1], settings, createCaches())
    expect(compiled.issues.map((i) => i.code)).toEqual(['kickerWithoutBall'])
    expect(compiled.phases[0]?.kicks[0]?.applied).toBe(false)
    expect(compiled.phases[0]?.end).toBe(0)
    const after = state(play, 1, [T1]).ball
    expect(after?.kind === 'carried' && after.carrierId).toBe(A1)
  })

  it('keeps only the first of a pass and a kick released together', () => {
    const play = kickPlay(
      [pass(uuid(50), A1, A2, 0), kick(KICK, A1, { point: { x: 75, y: 30 } }, 0)],
      [],
      {},
      { [A2]: { x: 35, y: 30 } },
    )
    const compiled = compileLine(play, [T1], settings, createCaches())
    expect(compiled.issues.map((i) => i.code)).toEqual(['simultaneousPass'])
  })

  it('appears in the schematic data and in the bounds', () => {
    const play = kickPlay(
      [kick(KICK, A1, { point: { x: 85, y: 12 } }, 0)],
      [run(uuid(41), A2, [{ x: 62, y: 30 }])],
    )
    const caches = createCaches()
    const schematic = phaseSchematic(play, T1, settings, caches)
    expect(schematic?.kicks).toEqual([
      {
        actionId: KICK,
        phaseId: T1,
        kickerId: A1,
        receiverId: null,
        from: { x: 40, y: 30 },
        to: { x: 85, y: 12 },
        applied: true,
      },
    ])
    expect(phaseSchematic(play, T2, settings, caches)?.ancestorKicks).toHaveLength(1)
    expect(phaseSchematic(play, T2, settings, caches)?.ball).toEqual({
      kind: 'loose',
      pos: { x: 85, y: 12 },
    })
    const bounds = lineBounds(compileLine(play, [T1, T2], settings, caches))
    expect(bounds?.min.y).toBe(12)
  })
})

describe('ball on the ground at the start (D-083)', () => {
  it('is picked up at once by the closest player within reach', () => {
    const play = kickPlay([], [], { ballCarrierId: null, ballPosition: { x: 40.6, y: 30 } })
    const segments = compileLine(play, [T1], settings, createCaches()).phases[0]?.ball ?? []
    expect(segments).toEqual([
      { kind: 'loose', start: 0, pos: { x: 40.6, y: 30 } },
      { kind: 'carried', start: 0, carrierId: A1 },
    ])
    expect(state(play, 0, [T1]).gainLineX).toBe(40.6)
  })

  it('waits on the ground for the first player who comes', () => {
    const play = kickPlay([run(uuid(41), A2, [{ x: 50, y: 30 }], { pace: 'walk' })], [], {
      ballCarrierId: null,
      ballPosition: { x: 55, y: 30 },
    })
    expect(state(play, 1, [T1]).ball).toEqual({ kind: 'loose', pos: { x: 55, y: 30 } })
    // A2 walks from x = 60 at 2 m/s: within 1 m (x = 56) after 4 m.
    const pickup = compileLine(play, [T1], settings, createCaches()).phases[0]?.ball.at(-1)
    expect(pickup?.kind === 'carried' && pickup.carrierId).toBe(A2)
    expectInstant(pickup?.start, timeFromRest(4, walk, motion, sprint))
  })
})
