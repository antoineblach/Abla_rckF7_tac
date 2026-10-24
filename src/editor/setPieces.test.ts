// Editing the set pieces of lot 3: kick and breakdown commands, proposal of the support and the
// relayer (D-081), ball on the ground (D-083), extended deletion (D-014), tools, shortcuts (D-093)
// and hit testing.
import { describe, expect, it } from 'vitest'
import { BREAKDOWN_DURATION_DEFAULT } from '../config/defaults'
import { createCaches } from '../engine/caches'
import { compiledPhaseOf, phaseSchematic } from '../engine/evaluate'
import { defaultSettings, engineSettingsOf } from '../model/settings'
import type { BreakdownAction, KickAction, Play } from '../model/types'
import {
  breakdown,
  kick,
  P,
  phase,
  run,
  sequentialIds,
  setPiecesPlay,
  sevenVsSevenWithOptions,
  uuid,
} from '../test/builders'
import {
  addBreakdown,
  addKick,
  deletePlayers,
  moveBallPosition,
  moveKickTarget,
  proposeBreakdown,
  setBallCarrier,
  setBallOnGround,
  updateBreakdown,
  updateKick,
  type CommandContext,
} from './commands'
import { hitTest } from './hitTest'
import { shortcutFor } from './shortcuts'
import { kickToolClick } from './tools/kickTool'
import { TOOL_IDS } from './tools/types'

const settings = engineSettingsOf(defaultSettings())
const ctx = (): CommandContext => ({ ids: sequentialIds(700), settings, caches: createCaches() })
const actionsOf = (play: Play, phaseId = P.t1) =>
  play.phases.find((p) => p.id === phaseId)?.actions ?? []

/** T1 only: A4 carries the ball and jogs to (46, 36); A5 runs to (45, 37). */
function contactPlay(): Play {
  const play = sevenVsSevenWithOptions()
  return {
    ...play,
    phases: [
      phase(P.t1, null, [
        run(uuid(400), P.A(4), [{ x: 46, y: 36 }], { durationOverride: 3 }),
        run(uuid(401), P.A(5), [{ x: 45, y: 37 }], { durationOverride: 3 }),
      ]),
    ],
  }
}

describe('kick commands (SPEC 10.4)', () => {
  it('adds a kick at the instant the kicker has the ball, long by default, restart for a restart', () => {
    const play = sevenVsSevenWithOptions()
    const added = addKick(play, P.t1, P.A(4), { point: { x: 80, y: 30 } }, ctx())
    const k = actionsOf(added.play).at(-1) as KickAction
    expect(k).toEqual({
      id: uuid(700),
      type: 'kick',
      kickerId: P.A(4),
      kind: 'long',
      target: { point: { x: 80, y: 30 } },
      delay: 0,
    })
    // A5 receives the pass of T1: her kick leaves on receipt of the ball (D-110).
    const c = ctx()
    const second = addKick(play, P.t1, P.A(5), { receiverId: P.B(5) }, c)
    const kick = actionsOf(second.play).at(-1) as KickAction
    expect(kick).toMatchObject({ delay: 0, release: 'onReceipt' })
    const compiled = compiledPhaseOf(second.play, P.t1, c.settings, c.caches)
    const kicked = compiled?.kicks.find((k) => k.actionId === kick.id)
    expect(kicked?.applied).toBe(true)
    expect((kicked?.releaseT ?? 0) - (compiled?.start ?? 0)).toBeGreaterThan(0.8)
    const restart = addKick(
      { ...play, category: 'restart' },
      P.t1,
      P.A(4),
      { receiverId: P.B(1) },
      ctx(),
    )
    expect((actionsOf(restart.play).at(-1) as KickAction).kind).toBe('restart')
  })

  it('refuses a kick to the kicker herself or from a missing player', () => {
    const play = sevenVsSevenWithOptions()
    expect(addKick(play, P.t1, P.A(4), { receiverId: P.A(4) }, ctx()).actionId).toBeNull()
    expect(addKick(play, P.t1, uuid(999), { point: { x: 1, y: 1 } }, ctx()).actionId).toBeNull()
  })

  it('updates the kind, delay, flight time and target, and moves a target point', () => {
    const base = {
      ...sevenVsSevenWithOptions(),
      phases: [phase(P.t1, null, [kick(uuid(1), P.A(4), { point: { x: 70, y: 30 } }, 0)])],
    }
    const k = (play: Play) => actionsOf(play)[0] as KickAction
    let play = updateKick(base, uuid(1), { kind: 'restart', delay: -2, flightTime: 2.5 })
    expect(k(play)).toMatchObject({ kind: 'restart', delay: 0, flightTime: 2.5 })
    play = updateKick(play, uuid(1), { flightTime: null })
    expect('flightTime' in k(play)).toBe(false)
    play = updateKick(play, uuid(1), { target: { receiverId: P.A(4) } })
    expect(k(play).target).toEqual({ point: { x: 70, y: 30 } })
    play = moveKickTarget(play, uuid(1), { x: 72, y: 31 })
    expect(k(play).target).toEqual({ point: { x: 72, y: 31 } })
    play = updateKick(play, uuid(1), { target: { receiverId: P.B(2) } })
    expect(k(play).target).toEqual({ receiverId: P.B(2) })
    expect(moveKickTarget(play, uuid(1), { x: 0, y: 0 })).toEqual(play)
  })
})

describe('breakdown commands (SPEC 10.3, D-081)', () => {
  it('proposes the formation at the end of the run, the two closest teammates as support and relayer', () => {
    const proposal = proposeBreakdown(contactPlay(), P.t1, P.A(4), ctx())
    // A4 is at (46, 36) at 3 s; A5 at (45, 37) is the closest, then A3 still at (40, 25)
    // (11.7 m) before A6 at (40, 55) (19.9 m).
    expect(proposal).toEqual({ ok: true, delay: 3, supportId: P.A(5), relayerId: P.A(3) })
  })

  it('forms the breakdown when she receives the ball if that is later than her run', () => {
    const play = sevenVsSevenWithOptions()
    // In T1, A5 receives the pass of A4 after the end of her run.
    const proposal = proposeBreakdown(play, P.t1, P.A(5), ctx())
    if (!proposal.ok) throw new Error('refused')
    expect(proposal.delay).toBeGreaterThan(1)
  })

  it('refuses a player without the ball in the phase, or without two teammates', () => {
    expect(proposeBreakdown(contactPlay(), P.t1, P.A(1), ctx())).toEqual({
      ok: false,
      reason: 'noBall',
    })
    const lonely = {
      ...contactPlay(),
      entities: contactPlay().entities.filter(
        (e) => e.kind !== 'player' || e.team === 'B' || e.id === P.A(4) || e.id === P.A(5),
      ),
    }
    expect(proposeBreakdown(lonely, P.t1, P.A(4), ctx())).toEqual({
      ok: false,
      reason: 'teammates',
    })
  })

  it('lays a ruck of 3 s and updates it; « Par défaut » removes the contest (D-078)', () => {
    const added = addBreakdown(contactPlay(), P.t1, P.A(4), ctx())
    expect(added.refused).toBeNull()
    const b = (play: Play) => actionsOf(play).at(-1) as BreakdownAction
    expect(b(added.play)).toEqual({
      id: uuid(700),
      type: 'breakdown',
      kind: 'ruck',
      tackledId: P.A(4),
      supportId: P.A(5),
      relayerId: P.A(3),
      delay: 3,
      duration: BREAKDOWN_DURATION_DEFAULT,
    })
    let play = updateBreakdown(added.play, uuid(700), {
      kind: 'maul',
      contest: 'jackal',
      duration: 2,
      relayerId: P.A(6),
    })
    expect(b(play)).toMatchObject({
      kind: 'maul',
      contest: 'jackal',
      duration: 2,
      relayerId: P.A(6),
    })
    play = updateBreakdown(play, uuid(700), { contest: null, duration: 0 })
    expect('contest' in b(play)).toBe(false)
    expect(b(play).duration).toBe(2)
    expect(addBreakdown(contactPlay(), P.t1, P.A(1), ctx())).toMatchObject({
      actionId: null,
      refused: 'noBall',
    })
  })
})

describe('ball on the ground and deletion', () => {
  it('puts the ball on the ground at the start, moves it, and gives it back to a carrier', () => {
    const play = setBallOnGround(sevenVsSevenWithOptions(), { x: 41, y: 35 }, ctx())
    expect(play.setup).toMatchObject({ ballCarrierId: null, ballPosition: { x: 41, y: 35 } })
    const moved = moveBallPosition(play, { x: 42, y: 30 })
    expect(moved.setup.ballPosition).toEqual({ x: 42, y: 30 })
    expect(moveBallPosition(sevenVsSevenWithOptions(), { x: 0, y: 0 })).toEqual(
      sevenVsSevenWithOptions(),
    )
    const carried = setBallCarrier(moved, P.A(2), ctx())
    expect(carried.setup).toMatchObject({ ballCarrierId: P.A(2), ballPosition: null })
  })

  it('deletes the kicks and breakdowns of a deleted player (D-014)', () => {
    const play = setPiecesPlay()
    const all = (p: Play) => p.phases.flatMap((ph) => ph.actions)
    const withoutA3 = deletePlayers(play, [P.A(3)])
    expect(all(withoutA3).filter((a) => a.type === 'breakdown')).toEqual([])
    expect(all(withoutA3).some((a) => a.type === 'kick' && a.kickerId === P.A(3))).toBe(false)
    const withoutB7 = deletePlayers(play, [P.B(7)])
    expect(all(withoutB7).filter((a) => a.type === 'kick')).toHaveLength(1)
    const withoutA2 = deletePlayers(play, [P.A(2)])
    expect(all(withoutA2).filter((a) => a.type === 'kick')).toHaveLength(1)
    expect(all(withoutA2).filter((a) => a.type === 'breakdown')).toHaveLength(1)
  })
})

describe('kick tool, shortcuts and hit testing', () => {
  it('chooses the kicker, then a receiver or a point; the kicker again cancels', () => {
    const hitA = { kind: 'player' as const, id: P.A(1) }
    const pos = { x: 70, y: 20 }
    expect(kickToolClick(null, null, pos)).toEqual({ kickerId: null, commit: null })
    expect(kickToolClick(null, hitA, pos)).toEqual({ kickerId: P.A(1), commit: null })
    expect(kickToolClick(P.A(1), hitA, pos)).toEqual({ kickerId: null, commit: null })
    expect(kickToolClick(P.A(1), { kind: 'player', id: P.B(2) }, pos)).toEqual({
      kickerId: null,
      commit: { kickerId: P.A(1), target: { receiverId: P.B(2) } },
    })
    expect(kickToolClick(P.A(1), null, pos)).toEqual({
      kickerId: null,
      commit: { kickerId: P.A(1), target: { point: pos } },
    })
  })

  it('maps J to the kick tool and G to the breakdown tool (D-093)', () => {
    const at = (key: string) => shortcutFor({ key, ctrl: false, shift: false, alt: false }, 0.5, 5)
    expect(at('j')).toEqual({ kind: 'tool', tool: 'kick' })
    expect(at('G')).toEqual({ kind: 'tool', tool: 'breakdown' })
    expect(TOOL_IDS).toEqual(['select', 'placeA', 'placeB', 'run', 'pass', 'kick', 'breakdown'])
  })

  it('reaches the target point, the ball on the ground, kicks, breakdown rings and relays', () => {
    const tol = { token: 1, handle: 0.6, line: 0.4 }
    const play = setPiecesPlay()
    const caches = createCaches()
    const t1 = phaseSchematic(play, P.t1, settings, caches)
    const t3a = phaseSchematic(play, P.t3a, settings, caches)
    if (!t1 || !t3a) throw new Error('no schematic')
    expect(hitTest(t3a, { x: 75.3, y: 12 }, tol)).toEqual({
      kind: 'kickTarget',
      actionId: uuid(420),
    })
    expect(hitTest(t3a, { x: 62.5, y: 15 }, tol)).toEqual({ kind: 'kick', actionId: uuid(420) })
    // Ruck ring of two tokens around the point of A4 at the formation.
    const ruck = t1.breakdowns[0]?.pos ?? { x: NaN, y: NaN }
    expect(hitTest(t1, { x: ruck.x, y: ruck.y + 2.1 }, tol)).toEqual({
      kind: 'breakdown',
      actionId: uuid(402),
    })
    // The relayer path selects the breakdown.
    const relay = t1.relays[0]?.points[10] ?? { x: NaN, y: NaN }
    expect(hitTest(t1, relay, tol)).toEqual({ kind: 'breakdown', actionId: uuid(402) })
    // The ball on the ground at the start is reached before the player next to it.
    const ground = { ...play, setup: { ...play.setup, ballPosition: { x: 41, y: 35 } } }
    const g1 = phaseSchematic(ground, P.t1, settings, caches)
    if (!g1) throw new Error('no schematic')
    expect(hitTest(g1, { x: 41.1, y: 35 }, tol)).toEqual({ kind: 'ball' })
  })

  it('reaches a run entirely ignored after a breakdown by its ignored part', () => {
    const play = {
      ...contactPlay(),
      phases: [
        phase(P.t1, null, [
          ...actionsOf(contactPlay()),
          run(uuid(402), P.A(3), [{ x: 30, y: 25 }], { delay: 3 }),
          breakdown(uuid(403), P.A(4), P.A(5), P.A(3), 1.5),
        ]),
      ],
    }
    const schematic = phaseSchematic(play, P.t1, settings, createCaches())
    if (!schematic) throw new Error('no schematic')
    expect(hitTest(schematic, { x: 35, y: 25 }, { token: 1, handle: 0.6, line: 0.4 })).toEqual({
      kind: 'run',
      actionId: uuid(402),
      segment: 0,
    })
  })
})
