import { describe, expect, it } from 'vitest'
import { defaultSettings, engineSettingsOf, type EngineSettings } from '../../model/settings'
import type { Action, Play, Team, Vec2 } from '../model/types'
import { P, basePlay, ball, pass, player, run, uuid } from '../test/builders'
import { createCaches } from './caches'
import { evaluate, windowSchematic } from './evaluate'
import { compileLine } from './timeline'

const settings: EngineSettings = engineSettingsOf(defaultSettings())
const P1 = uuid(1)
const P2 = uuid(2)
const PASS = uuid(50)
const LINE = [P.root]

function passPlay(from: Vec2, to: Vec2, actions: Action[], team: Team = 'A'): Play {
  return basePlay({
    attackingTeam: team,
    entities: [player(P1, team, 1), player(P2, team, 2), ball(uuid(20))],
    setup: { positions: { [P1]: from, [P2]: to }, ballCarrierId: P1, ballPosition: null },
    actions,
  })
}

function forward(play: Play): boolean {
  const compiled = compileLine(play, LINE, settings, createCaches())
  const flagged = compiled.issues.filter((i) => i.code === 'forwardPass')
  expect(flagged.length).toBe(compiled.passes.filter((p) => p.forward).length)
  return compiled.passes[0]?.forward ?? false
}

const sprint = (id: string, to: Vec2, extra = {}) =>
  run(uuid(id === P1 ? 40 : 41), id, [to], { pace: 'sprint', ...extra })

describe('forward pass check (SPEC 5.7)', () => {
  it('does not flag a flat pass from a running passer', () => {
    // Both sprint side by side, at full speed (5.5 m/s) after 3 s: the ball moves forward in the
    // field frame only by the speed of the passer.
    const play = passPlay({ x: 40, y: 30 }, { x: 40, y: 25 }, [
      sprint(P1, { x: 80, y: 30 }),
      sprint(P2, { x: 80, y: 25 }),
      pass(PASS, P1, P2, 3),
    ])
    expect(forward(play)).toBe(false)
    // Hands backwards: still not flagged.
    const backwards = passPlay({ x: 40, y: 30 }, { x: 38, y: 25 }, [
      sprint(P1, { x: 80, y: 30 }),
      sprint(P2, { x: 78, y: 25 }),
      pass(PASS, P1, P2, 3),
    ])
    expect(forward(backwards)).toBe(false)
  })

  it('flags a pass forward in the passer frame', () => {
    const play = passPlay({ x: 40, y: 30 }, { x: 43, y: 25 }, [
      sprint(P1, { x: 80, y: 30 }),
      sprint(P2, { x: 83, y: 25 }),
      pass(PASS, P1, P2, 3),
    ])
    expect(forward(play)).toBe(true)
    const state = evaluate(play, LINE, 3.2, settings, createCaches())
    expect(state.passTraces[0]?.forward).toBe(true)
    expect(windowSchematic(play, LINE, 3, settings, createCaches()).passes[0]?.forward).toBe(true)
  })

  it('applies the threshold of 0.5 m/s', () => {
    // Still players 5 m apart: flight of about 0.417 s; 0.2 m forward is 0.48 m/s, 0.3 m is 0.72.
    const at = (dx: number) =>
      passPlay({ x: 40, y: 30 }, { x: 40 + dx, y: 25 }, [pass(PASS, P1, P2, 0)])
    expect(forward(at(0.2))).toBe(false)
    expect(forward(at(0.3))).toBe(true)
  })

  it('uses the attack direction of the passer team (B towards -x)', () => {
    const ahead = passPlay({ x: 60, y: 30 }, { x: 57, y: 25 }, [pass(PASS, P1, P2, 0)], 'B')
    expect(forward(ahead)).toBe(true)
    const behind = passPlay({ x: 60, y: 30 }, { x: 63, y: 25 }, [pass(PASS, P1, P2, 0)], 'B')
    expect(forward(behind)).toBe(false)
  })

  it('flags the same pass when the passer had already stopped', () => {
    // The passer stops after 2.9 s; the receiver still runs at full speed at 4 s.
    const play = passPlay({ x: 40, y: 30 }, { x: 40, y: 25 }, [
      sprint(P1, { x: 47, y: 30 }),
      sprint(P2, { x: 87, y: 25 }),
      pass(PASS, P1, P2, 4),
    ])
    expect(forward(play)).toBe(true)
  })

  it('never blocks the pass: it is executed as drawn', () => {
    const play = passPlay({ x: 40, y: 30 }, { x: 45, y: 25 }, [pass(PASS, P1, P2, 0)])
    const end = evaluate(play, LINE, 10, settings, createCaches()).ball
    expect(end?.kind === 'carried' && end.carrierId).toBe(P2)
  })
})
