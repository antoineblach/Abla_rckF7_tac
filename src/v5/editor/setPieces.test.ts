// Editing the set pieces of lot 3: kick and breakdown commands laid at the cursor, formation and
// proposal of the support and the relayer (SPEC 6.2, D-081), ball on the ground (D-083), extended
// deletion (D-014), tools, shortcuts (D-093) and hit testing.
import { describe, expect, it } from 'vitest'
import { BREAKDOWN_DURATION_DEFAULT } from '../../config/defaults'
import { shortcutFor } from '../../editor/shortcuts'
import { TOOL_IDS } from '../../editor/tools/types'
import { defaultSettings, engineSettingsOf } from '../../model/settings'
import { createCaches } from '../engine/caches'
import { windowSchematic } from '../engine/evaluate'
import { compileLine } from '../engine/timeline'
import type { BreakdownAction, Id, KickAction, Play } from '../model/types'
import {
  branch,
  breakdown,
  kick,
  P,
  pass,
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
  setStart,
  updateBreakdown,
  updateKick,
  updateRun,
  type CommandContext,
} from './commands'
import { hitTest } from './hitTest'
import { kickToolClick } from './tools/kickTool'

const settings = engineSettingsOf(defaultSettings())
const ctx = (): CommandContext => ({ ids: sequentialIds(700), settings, caches: createCaches() })
const LINE_A = [P.root, P.optA]
const ROOT_LINE = [P.root]

function actionOf(play: Play, id: Id | null) {
  const action = play.actions.find((candidate) => candidate.id === id)
  if (!action) throw new Error(`no action ${String(id)}`)
  return action
}

/** Root only: A4 carries the ball and jogs to (46, 36) in 3 s; A5 runs to (45, 37) in 3 s. */
function contactPlay(extra: Play['actions'] = []): Play {
  return {
    ...sevenVsSevenWithOptions(),
    branches: [branch(P.root, null)],
    actions: [
      run(uuid(400), P.A(4), [{ x: 46, y: 36 }], { durationOverride: 3 }),
      run(uuid(401), P.A(5), [{ x: 45, y: 37 }], { durationOverride: 3 }),
      ...extra,
    ],
    sequences: [],
  }
}

describe('kick commands (SPEC 10.4, 6.2)', () => {
  it('adds a kick at the cursor when she has the ball, long by default, restart for a restart', () => {
    const play = sevenVsSevenWithOptions()
    const added = addKick(
      play,
      { line: LINE_A, t: 0.4 },
      P.A(4),
      { point: { x: 80, y: 30 } },
      ctx(),
    )
    expect(actionOf(added.play, added.actionId)).toEqual({
      id: uuid(700),
      type: 'kick',
      branchId: P.root,
      start: 0.4,
      kickerId: P.A(4),
      kind: 'long',
      target: { point: { x: 80, y: 30 } },
    })
    const restart = addKick(
      { ...play, category: 'restart' },
      { line: LINE_A, t: 0 },
      P.A(4),
      { receiverId: P.B(1) },
      ctx(),
    )
    expect((actionOf(restart.play, restart.actionId) as KickAction).kind).toBe('restart')
  })

  it('glues the release to her next reception otherwise (SPEC 6.2)', () => {
    const c = ctx()
    const play = sevenVsSevenWithOptions()
    const added = addKick(play, { line: LINE_A, t: 0 }, P.A(5), { receiverId: P.B(5) }, c)
    const laid = actionOf(added.play, added.actionId) as KickAction
    expect(laid.startGlue).toEqual({ targetId: uuid(202), event: 'end' })
    const compiled = compileLine(added.play, LINE_A, c.settings, c.caches)
    const kicked = compiled.kicks.find((k) => k.actionId === laid.id)
    expect(kicked?.applied).toBe(true)
    expect(kicked?.releaseT).toBeCloseTo(
      compiled.passes.find((p) => p.actionId === uuid(202))?.arrivalT ?? NaN,
      9,
    )
  })

  it('glues the release to her reception when the cursor is on it, and follows it (D-171)', () => {
    const c = ctx()
    const play = sevenVsSevenWithOptions()
    const arrival = compileLine(play, LINE_A, c.settings, c.caches).passes.find(
      (p) => p.actionId === uuid(202),
    )?.arrivalT
    if (arrival === undefined) throw new Error('no arrival')
    for (const t of [arrival, arrival + 0.004]) {
      const added = addKick(play, { line: LINE_A, t }, P.A(5), { point: { x: 80, y: 30 } }, c)
      const laid = actionOf(added.play, added.actionId) as KickAction
      expect(laid.startGlue).toEqual({ targetId: uuid(202), event: 'end' })
      expect(laid.start).toBe(arrival)
    }
    const added = addKick(
      play,
      { line: LINE_A, t: arrival },
      P.A(5),
      { point: { x: 80, y: 30 } },
      c,
    )
    const moved = setStart(added.play, uuid(202), 1.5)
    const compiled = compileLine(moved, LINE_A, c.settings, c.caches)
    const kicked = compiled.kicks.find((k) => k.actionId === added.actionId)
    expect(kicked?.applied).toBe(true)
    expect(kicked?.releaseT).toBeCloseTo(
      compiled.passes.find((p) => p.actionId === uuid(202))?.arrivalT ?? NaN,
      9,
    )
    const left = addKick(
      play,
      { line: LINE_A, t: arrival + 0.01 },
      P.A(5),
      { point: { x: 80, y: 30 } },
      c,
    )
    const leftLaid = actionOf(left.play, left.actionId) as KickAction
    expect(leftLaid.start).toBe(arrival + 0.01)
    expect(leftLaid.startGlue).toBeUndefined()
  })

  it('refuses a kick to the kicker herself or from a missing player', () => {
    const play = sevenVsSevenWithOptions()
    const cursor = { line: LINE_A, t: 0 }
    expect(addKick(play, cursor, P.A(4), { receiverId: P.A(4) }, ctx()).actionId).toBeNull()
    expect(addKick(play, cursor, uuid(999), { point: { x: 1, y: 1 } }, ctx()).actionId).toBeNull()
  })

  it('updates the kind, flight time and target, and moves a target point', () => {
    const base = {
      ...sevenVsSevenWithOptions(),
      actions: [kick(uuid(1), P.A(4), { point: { x: 70, y: 30 } }, 0)],
    }
    const k = (play: Play) => actionOf(play, uuid(1)) as KickAction
    let play = updateKick(base, uuid(1), { kind: 'restart', flightTime: 2.5 })
    expect(k(play)).toMatchObject({ kind: 'restart', flightTime: 2.5 })
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

describe('breakdown laid at the cursor (SPEC 6.2, 10.3, D-081)', () => {
  it('glues the formation to the end of her run in progress, with the two closest teammates', () => {
    const cursor = { line: ROOT_LINE, t: 1 }
    const proposal = proposeBreakdown(contactPlay(), cursor, P.A(4), ctx())
    // A4 is at (46, 36) at 3 s; A5 at (45, 37) is the closest, then A3 still at (40, 25)
    // (11.7 m) before A6 at (40, 55) (19.9 m).
    expect(proposal).toEqual({
      ok: true,
      start: 3,
      glue: { targetId: uuid(400), event: 'end' },
      supportId: P.A(5),
      relayerId: P.A(3),
    })
  })

  it('glues it to the run that starts at the cursor, or that ends there', () => {
    const c = ctx()
    for (const t of [0, 3]) {
      const proposal = proposeBreakdown(contactPlay(), { line: ROOT_LINE, t }, P.A(4), c)
      if (!proposal.ok) throw new Error('refused')
      expect(proposal).toMatchObject({ start: 3, glue: { targetId: uuid(400), event: 'end' } })
    }
  })

  it('takes her next reception when it is later than her run', () => {
    const play = contactPlay([pass(uuid(402), P.A(4), P.A(5), 4)])
    const proposal = proposeBreakdown(play, { line: ROOT_LINE, t: 1 }, P.A(5), ctx())
    if (!proposal.ok) throw new Error('refused')
    expect(proposal.glue).toEqual({ targetId: uuid(402), event: 'end' })
    expect(proposal.start).toBeGreaterThan(4)
  })

  it('keeps the end of her run when the reception comes during it', () => {
    const play = contactPlay([pass(uuid(402), P.A(4), P.A(5), 0.5)])
    const proposal = proposeBreakdown(play, { line: ROOT_LINE, t: 0.2 }, P.A(5), ctx())
    if (!proposal.ok) throw new Error('refused')
    expect(proposal).toMatchObject({ start: 3, glue: { targetId: uuid(401), event: 'end' } })
  })

  it('forms at the cursor without run or reception to come', () => {
    const proposal = proposeBreakdown(contactPlay(), { line: ROOT_LINE, t: 5 }, P.A(4), ctx())
    expect(proposal).toMatchObject({ ok: true, start: 5, glue: null })
  })

  describe('cursor on a reception (D-171)', () => {
    const PASS = uuid(402)
    const arrivalOf = (play: Play, c: CommandContext): number => {
      const compiled = compileLine(play, ROOT_LINE, c.settings, c.caches)
      const arrival = compiled.passes.find((p) => p.actionId === PASS)?.arrivalT
      if (arrival === undefined) throw new Error('no arrival')
      return arrival
    }

    it('glues the formation to it, gap 0, and follows it', () => {
      const c = ctx()
      const play = contactPlay([pass(PASS, P.A(4), P.A(5), 4)])
      const arrival = arrivalOf(play, c)
      for (const t of [arrival, arrival + 0.004, arrival - 0.004]) {
        expect(proposeBreakdown(play, { line: ROOT_LINE, t }, P.A(5), c)).toMatchObject({
          ok: true,
          start: arrival,
          glue: { targetId: PASS, event: 'end' },
        })
      }
      const added = addBreakdown(play, { line: ROOT_LINE, t: arrival }, P.A(5), c)
      const moved = setStart(added.play, PASS, 5)
      const compiled = compileLine(moved, ROOT_LINE, c.settings, c.caches)
      expect(compiled.breakdowns[0]?.applied).toBe(true)
      expect(compiled.breakdowns[0]?.start).toBeCloseTo(arrivalOf(moved, c), 9)
    })

    it('forms at the cursor, not glued, once it has left the reception', () => {
      const c = ctx()
      const play = contactPlay([pass(PASS, P.A(4), P.A(5), 4)])
      const t = arrivalOf(play, c) + 0.01
      expect(proposeBreakdown(play, { line: ROOT_LINE, t }, P.A(5), c)).toMatchObject({
        ok: true,
        start: t,
        glue: null,
      })
    })

    it('prefers the run that ends at this instant', () => {
      const c = ctx()
      const play: Play = {
        ...contactPlay(),
        actions: [
          run(uuid(401), P.A(5), [{ x: 45, y: 37 }], {
            endGlue: { targetId: PASS, event: 'end', keep: 'duration' },
          }),
          pass(PASS, P.A(4), P.A(5), 4),
        ],
      }
      const proposal = proposeBreakdown(play, { line: ROOT_LINE, t: arrivalOf(play, c) }, P.A(5), c)
      expect(proposal).toMatchObject({ ok: true, glue: { targetId: uuid(401), event: 'end' } })
    })

    it('keeps the end of the run still in progress on it (SPEC 6.2)', () => {
      const c = ctx()
      const play = contactPlay([pass(PASS, P.A(4), P.A(5), 0.5)])
      const proposal = proposeBreakdown(play, { line: ROOT_LINE, t: arrivalOf(play, c) }, P.A(5), c)
      expect(proposal).toMatchObject({
        ok: true,
        start: 3,
        glue: { targetId: uuid(401), event: 'end' },
      })
    })

    it('counts the exit of a breakdown she relays, not a pickup', () => {
      const c = ctx()
      const rucked = contactPlay([breakdown(uuid(403), P.A(4), P.A(5), P.A(3), 1, { duration: 1 })])
      expect(proposeBreakdown(rucked, { line: ROOT_LINE, t: 2 }, P.A(3), c)).toMatchObject({
        ok: true,
        start: 2,
        glue: { targetId: uuid(403), event: 'end' },
      })
      const ground: Play = {
        ...contactPlay(),
        setup: {
          ...contactPlay().setup,
          ballCarrierId: null,
          ballPosition: { x: 40.5, y: 35 },
        },
        actions: [],
      }
      expect(proposeBreakdown(ground, { line: ROOT_LINE, t: 0 }, P.A(4), c)).toMatchObject({
        ok: true,
        start: 0,
        glue: null,
      })
    })
  })

  it('refuses a player without the ball at the formation, or without two teammates', () => {
    const noBall = { ok: false, reason: 'noBall' }
    const cursor = { line: ROOT_LINE, t: 1 }
    expect(proposeBreakdown(contactPlay(), cursor, P.A(1), ctx())).toEqual(noBall)
    // She has passed it before the end of her run.
    const passed = contactPlay([pass(uuid(402), P.A(4), P.A(1), 2)])
    expect(proposeBreakdown(passed, cursor, P.A(4), ctx())).toEqual(noBall)
    expect(proposeBreakdown(contactPlay(), { line: [], t: 1 }, P.A(4), ctx())).toEqual(noBall)
    const lonely = {
      ...contactPlay(),
      entities: contactPlay().entities.filter(
        (e) => e.kind !== 'player' || e.team === 'B' || e.id === P.A(4) || e.id === P.A(5),
      ),
    }
    expect(proposeBreakdown(lonely, cursor, P.A(4), ctx())).toEqual({
      ok: false,
      reason: 'teammates',
    })
  })

  it('lays a ruck of 3 s that follows its target, and updates it (D-078)', () => {
    const c = ctx()
    const added = addBreakdown(contactPlay(), { line: ROOT_LINE, t: 1 }, P.A(4), c)
    expect(added.refused).toBeNull()
    const b = (play: Play) => actionOf(play, uuid(700)) as BreakdownAction
    expect(b(added.play)).toEqual({
      id: uuid(700),
      type: 'breakdown',
      branchId: P.root,
      start: 3,
      startGlue: { targetId: uuid(400), event: 'end' },
      kind: 'ruck',
      tackledId: P.A(4),
      supportId: P.A(5),
      relayerId: P.A(3),
      duration: BREAKDOWN_DURATION_DEFAULT,
    })
    const compiled = compileLine(added.play, ROOT_LINE, c.settings, c.caches)
    expect(compiled.breakdowns[0]).toMatchObject({ applied: true })
    expect(compiled.breakdowns[0]?.start).toBeCloseTo(3, 9)

    const slower = updateRun(added.play, uuid(400), { durationOverride: 4 })
    const follows = compileLine(slower, ROOT_LINE, c.settings, c.caches)
    expect(follows.breakdowns[0]?.start).toBeCloseTo(4, 9)

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
    expect(addBreakdown(contactPlay(), { line: ROOT_LINE, t: 1 }, P.A(1), ctx())).toMatchObject({
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
    const withoutA3 = deletePlayers(play, [P.A(3)], ctx()).play
    expect(withoutA3.actions.filter((a) => a.type === 'breakdown')).toEqual([])
    expect(withoutA3.actions.some((a) => a.type === 'kick' && a.kickerId === P.A(3))).toBe(false)
    const withoutB7 = deletePlayers(play, [P.B(7)], ctx()).play
    expect(withoutB7.actions.filter((a) => a.type === 'kick')).toHaveLength(1)
    const withoutA2 = deletePlayers(play, [P.A(2)], ctx()).play
    expect(withoutA2.actions.filter((a) => a.type === 'kick')).toHaveLength(1)
    expect(withoutA2.actions.filter((a) => a.type === 'breakdown')).toHaveLength(1)
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
    const start = windowSchematic(play, LINE_A, 0, settings, caches)
    const option = windowSchematic(play, LINE_A, 8, settings, caches)
    expect(hitTest(option, { x: 75.3, y: 12 }, tol)).toEqual({
      kind: 'kickTarget',
      actionId: uuid(420),
    })
    expect(hitTest(option, { x: 62.5, y: 15 }, tol)).toEqual({ kind: 'kick', actionId: uuid(420) })
    // Ruck ring of two tokens around the point of A4 at the formation.
    const ruck = start.breakdowns[0]?.pos ?? { x: NaN, y: NaN }
    expect(hitTest(start, { x: ruck.x, y: ruck.y + 2.1 }, tol)).toEqual({
      kind: 'breakdown',
      actionId: uuid(402),
    })
    // The relayer path selects the breakdown, in the interval as in grey (SPEC 6.3).
    const relay = start.relays[0]?.points[10] ?? { x: NaN, y: NaN }
    expect(hitTest(start, relay, tol)).toEqual({ kind: 'breakdown', actionId: uuid(402) })
    const greyRelay = option.earlierRuns.find((r) => r.actionId === uuid(402))
    const onGrey = greyRelay?.points[10] ?? { x: NaN, y: NaN }
    expect(hitTest(option, onGrey, { ...tol, token: 0.01 })).toEqual({
      kind: 'breakdown',
      actionId: uuid(402),
    })
    // The ball on the ground at the start is reached before the player next to it.
    const ground = {
      ...play,
      setup: { ...play.setup, ballPosition: { x: 42.5, y: 35 } },
      actions: [],
      sequences: [],
    }
    const free = windowSchematic(ground, LINE_A, 0, settings, caches)
    expect(hitTest(free, { x: 42.6, y: 35 }, { ...tol, token: 2 })).toEqual({ kind: 'ball' })
  })

  it('reaches a run cut by a breakdown by its ignored part', () => {
    const play = contactPlay([
      run(uuid(402), P.A(3), [{ x: 30, y: 25 }], { start: 1 }),
      breakdown(uuid(403), P.A(4), P.A(5), P.A(3), 1.5),
    ])
    const schematic = windowSchematic(play, ROOT_LINE, 0, settings, createCaches())
    const cut = schematic.runs.find((r) => r.ignoredPoints.length > 0)
    const onIgnored = cut?.ignoredPoints[Math.floor((cut.ignoredPoints.length || 0) / 2)]
    if (!cut || !onIgnored) throw new Error('no run cut')
    expect(hitTest(schematic, onIgnored, { token: 0.01, handle: 0.01, line: 0.4 })).toMatchObject({
      kind: 'run',
      actionId: cut.actionId,
    })
  })
})
