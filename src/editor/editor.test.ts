import { describe, expect, it } from 'vitest'
import { maybeSnap, snapToGrid } from './snap'
import {
  EMPTY_SELECTION,
  pruneSelection,
  selectAction,
  selectPlayer,
  selectPlayersInBox,
} from './selection'
import { shortcutFor } from './shortcuts'
import { defaultSettings, engineSettingsOf } from '../model/settings'
import { createCaches } from '../engine/caches'
import { lineReport } from '../engine/actionReport'
import { windowSchematic } from '../engine/evaluate'
import { motionEnd } from '../engine/motion'
import { compileLine, positionAt } from '../engine/timeline'
import { isPlayer, type Id, type PassAction, type Play, type RunAction } from '../model/types'
import { validatePlay } from '../model/validate'
import {
  P,
  ball,
  basePlay,
  breakdown,
  pass,
  player,
  run,
  sequentialIds,
  sevenVsSevenWithOptions,
  uuid,
} from '../test/builders'
import {
  addBall,
  addKick,
  addPass,
  addPlayer,
  addRun,
  branchAtCursor,
  deleteActions,
  deletePlayers,
  deleteWaypoint,
  duplicatePlayers,
  moveSetupPositions,
  moveWaypoint,
  nextFreeNumber,
  removeBall,
  runAnchor,
  setBallCarrier,
  setStart,
  updatePass,
  updatePlayMeta,
  updatePlayer,
  updateRun,
  type CommandContext,
} from './commands'
import { EMPTY_HISTORY, record, redo, undo } from './history'
import { hitTest, playersInBox } from './hitTest'
import { createNewPlay } from './placements'
import { passToolClick } from './tools/passTool'
import { runToolClick, runToolFinish, runToolPreview } from './tools/runTool'

const settings = engineSettingsOf(defaultSettings())
const ctx = (start = 5000): CommandContext => ({
  ids: sequentialIds(start),
  settings,
  caches: createCaches(),
})
const NOW = new Date('2026-10-14T12:00:00.000Z')
const LINE_A = [P.root, P.optA]
const LINE_B = [P.root, P.optB]

function actionOf(play: Play, id: Id | null) {
  const action = play.actions.find((candidate) => candidate.id === id)
  if (!action) throw new Error(`no action ${String(id)}`)
  return action
}

function runOf(play: Play, id: Id | null): RunAction {
  const action = actionOf(play, id)
  if (action.type !== 'run') throw new Error('not a run')
  return action
}

function passOf(play: Play, id: Id | null): PassAction {
  const action = actionOf(play, id)
  if (action.type !== 'pass') throw new Error('not a pass')
  return action
}

/** End of a run in a line once compiled. */
function endOf(play: Play, id: Id, c: CommandContext, line: Id[] = LINE_A): number {
  const motion = compileLine(play, line, c.settings, c.caches).motions.find(
    (m) => m.source === 'run' && m.actionId === id,
  )
  if (!motion) throw new Error('no motion')
  return motionEnd(motion)
}

describe('players (SPEC 6.2, 6.3)', () => {
  it('places players with the next free number and the team colour', () => {
    let play = basePlay()
    const c = ctx()
    play = addPlayer(play, 'A', { x: 10, y: 10 }, c).play
    play = addPlayer(play, 'A', { x: 12, y: 10 }, c).play
    const third = addPlayer(play, 'B', { x: 20, y: 10 }, c)
    play = third.play
    const numbers = play.entities.filter(isPlayer).map((p) => `${p.team}${p.number}:${p.color}`)
    expect(numbers).toEqual(['A1:#0072B2', 'A2:#0072B2', 'B1:#E69F00'])
    expect(play.setup.positions[third.id]).toEqual({ x: 20, y: 10 })
    // A freed number is reused first.
    const firstA = play.entities.find((e) => isPlayer(e) && e.team === 'A' && e.number === 1)
    play = deletePlayers(play, [firstA?.id ?? ''], c).play
    expect(nextFreeNumber(play, 'A')).toBe(1)
  })

  it('moves starting placements and edits numbers and colours', () => {
    let play = sevenVsSevenWithOptions()
    play = moveSetupPositions(play, [P.A(1), P.A(2)], { x: 1, y: -2 })
    expect(play.setup.positions[P.A(1)]).toEqual({ x: 41, y: 3 })
    play = updatePlayer(play, P.A(1), { number: 9, color: '#123456' })
    expect(play.entities.find((e) => e.id === P.A(1))).toMatchObject({
      number: 9,
      color: '#123456',
    })
  })

  it('deletes players with their runs and passes in every branch (D-014)', () => {
    const { play } = deletePlayers(sevenVsSevenWithOptions(), [P.A(5)], ctx())
    expect(play.entities.some((e) => e.id === P.A(5))).toBe(false)
    expect(P.A(5) in play.setup.positions).toBe(false)
    expect(play.actions.length).toBeGreaterThan(0)
    for (const action of play.actions) {
      if (action.type === 'run') expect(action.entityId).not.toBe(P.A(5))
      if (action.type === 'pass') expect([action.fromId, action.toId]).not.toContain(P.A(5))
    }
    expect(validatePlay(play).filter((i) => i.severity === 'error')).toEqual([])
    const noCarrier = deletePlayers(sevenVsSevenWithOptions(), [P.A(4)], ctx()).play
    expect(noCarrier.setup.ballCarrierId).toBeNull()
  })

  it('duplicates players with new numbers, offset, without actions (D-015)', () => {
    const { play, ids } = duplicatePlayers(sevenVsSevenWithOptions(), [P.A(1)], ctx())
    const copy = play.entities.find((e) => e.id === ids[0])
    expect(copy).toMatchObject({ team: 'A', number: 8 })
    expect(play.setup.positions[ids[0] ?? '']).toEqual({ x: 40, y: 7 })
  })
})

describe('ball (D-007)', () => {
  it('sets the starting carrier, adds and removes the ball', () => {
    const c = ctx()
    let play = removeBall(sevenVsSevenWithOptions())
    expect(play.entities.some((e) => e.kind === 'ball')).toBe(false)
    expect(play.setup.ballCarrierId).toBeNull()
    play = setBallCarrier(play, P.A(2), c)
    expect(play.entities.filter((e) => e.kind === 'ball')).toHaveLength(1)
    expect(play.setup.ballCarrierId).toBe(P.A(2))
    expect(addBall(play, c)).toBe(play)
    expect(setBallCarrier(play, null, c).setup.ballCarrierId).toBeNull()
  })
})

describe('branch of a new action (SPEC 6.3)', () => {
  const play = sevenVsSevenWithOptions()

  it('is the branch of the line at the cursor', () => {
    expect(branchAtCursor(play, { line: LINE_A, t: 0 }, ctx())).toBe(P.root)
    expect(branchAtCursor(play, { line: LINE_B, t: 6.3 }, ctx())).toBe(P.root)
    expect(branchAtCursor(play, { line: LINE_A, t: 7 }, ctx())).toBe(P.optA)
    expect(branchAtCursor(play, { line: LINE_B, t: 7 }, ctx())).toBe(P.optB)
  })

  it('is the displayed option at the exact instant of the branch point', () => {
    expect(branchAtCursor(play, { line: LINE_A, t: 6.335 }, ctx())).toBe(P.optA)
    const added = addRun(play, { line: LINE_B, t: 6.335 }, P.A(1), [{ x: 45, y: 5 }], ctx())
    expect(runOf(added.play, added.actionId)).toMatchObject({ branchId: P.optB, start: 6.335 })
  })

  it('stops at the first branch that does not continue the line', () => {
    expect(branchAtCursor(play, { line: [P.root, uuid(999)], t: 7 }, ctx())).toBe(P.root)
    expect(branchAtCursor(play, { line: [], t: 0 }, ctx())).toBeUndefined()
    expect(addRun(play, { line: [], t: 0 }, P.A(1), [{ x: 45, y: 5 }], ctx()).actionId).toBeNull()
  })
})

describe('run tool at the cursor (SPEC 6.2)', () => {
  const RUN_A4 = uuid(200)

  it('adds a run at the cursor, at its own pace, never extending another one', () => {
    const c = ctx()
    const play = sevenVsSevenWithOptions()
    const added = addRun(play, { line: LINE_A, t: 1.5 }, P.A(1), [{ x: 45, y: 5 }], c)
    expect(runOf(added.play, added.actionId)).toEqual({
      id: uuid(5000),
      type: 'run',
      branchId: P.root,
      start: 1.5,
      entityId: P.A(1),
      waypoints: [{ x: 45, y: 5 }],
      pace: 'jog',
    })
    expect(addRun(play, { line: LINE_A, t: 0 }, P.A(1), [], c).actionId).toBeNull()
    expect(addRun(play, { line: LINE_A, t: 0 }, P.ball, [{ x: 1, y: 1 }], c).actionId).toBeNull()
  })

  it('glues the new run to the end of the previous one when the cursor is on it (5.2)', () => {
    const c = ctx()
    const play = sevenVsSevenWithOptions()
    const end = endOf(play, RUN_A4, c)
    const glued = addRun(play, { line: LINE_A, t: end }, P.A(4), [{ x: 50, y: 42 }], c)
    expect(runOf(glued.play, glued.actionId).startGlue).toEqual({
      targetId: RUN_A4,
      event: 'end',
    })
    const compiled = compileLine(glued.play, LINE_A, c.settings, c.caches)
    const motion = compiled.motions.find((m) => m.actionId === glued.actionId)
    expect(motion?.launch).not.toBeNull()
    expect(motion?.start).toBeCloseTo(endOf(glued.play, RUN_A4, c), 9)
  })

  it('reads the cursor on the end within half a step of the slider', () => {
    const c = ctx()
    const play = sevenVsSevenWithOptions()
    const end = endOf(play, RUN_A4, c)
    for (const t of [end + 0.004, end - 0.004]) {
      const added = addRun(play, { line: LINE_A, t }, P.A(4), [{ x: 50, y: 42 }], c)
      expect(runOf(added.play, added.actionId).startGlue).toBeDefined()
    }
    const later = addRun(play, { line: LINE_A, t: end + 0.5 }, P.A(4), [{ x: 50, y: 42 }], c)
    expect(runOf(later.play, later.actionId).startGlue).toBeUndefined()
  })

  it('does not cut a run in progress: the fallback of 4.3 delays the new one (D-144)', () => {
    const c = ctx()
    const play = sevenVsSevenWithOptions()
    const end = endOf(play, RUN_A4, c)
    const cursor = { line: LINE_A, t: 1 }
    const added = addRun(play, cursor, P.A(4), [{ x: 50, y: 42 }], c)
    expect(runOf(added.play, added.actionId)).toMatchObject({ start: 1 })
    expect(runOf(added.play, added.actionId).startGlue).toBeUndefined()
    expect(runOf(added.play, RUN_A4)).toEqual(runOf(play, RUN_A4))
    const compiled = compileLine(added.play, LINE_A, c.settings, c.caches)
    expect(compiled.motions.find((m) => m.actionId === added.actionId)?.start).toBeCloseTo(end, 9)
    expect(compiled.issues).toContainEqual(
      expect.objectContaining({ code: 'runStartDelayed', params: { delay: end - 1 } }),
    )
  })

  it('previews the run from where it will start', () => {
    const c = ctx()
    const play = sevenVsSevenWithOptions()
    const compiled = compileLine(play, LINE_A, c.settings, c.caches)
    const end = endOf(play, RUN_A4, c)
    expect(runAnchor(play, { line: LINE_A, t: 1 }, P.A(4), c)).toEqual(
      positionAt(compiled, P.A(4), end),
    )
    expect(runAnchor(play, { line: LINE_A, t: end + 1 }, P.A(4), c)).toEqual(
      positionAt(compiled, P.A(4), end + 1),
    )
    expect(runAnchor(play, { line: LINE_A, t: 1 }, P.A(1), c)).toEqual(play.setup.positions[P.A(1)])
  })

  it('moves and deletes waypoints; deleting the last one deletes the run', () => {
    const c = ctx()
    let play = sevenVsSevenWithOptions()
    play = moveWaypoint(play, RUN_A4, 1, { x: 47, y: 41 })
    expect(runOf(play, RUN_A4).waypoints[1]).toEqual({ x: 47, y: 41 })
    play = deleteWaypoint(play, RUN_A4, 0, c).play
    play = deleteWaypoint(play, RUN_A4, 0, c).play
    expect(play.actions.some((a) => a.id === RUN_A4)).toBe(false)
  })
})

describe('pass tool at the cursor (SPEC 6.2, 5.4, D-110, D-119)', () => {
  const PASS_A4_A5 = uuid(202)

  it('releases at the cursor when the passer has the ball there', () => {
    const play = sevenVsSevenWithOptions()
    const added = addPass(play, { line: LINE_A, t: 0.3 }, P.A(4), P.A(3), ctx())
    const laid = passOf(added.play, added.actionId)
    expect(laid).toMatchObject({ start: 0.3, branchId: P.root, fromId: P.A(4), toId: P.A(3) })
    expect(laid.startGlue).toBeUndefined()
    expect(addPass(play, { line: LINE_A, t: 0 }, P.A(5), P.A(5), ctx()).actionId).toBeNull()
  })

  it('glues the release to her next reception otherwise, gap 0', () => {
    const c = ctx()
    const play = sevenVsSevenWithOptions()
    const added = addPass(play, { line: LINE_A, t: 0 }, P.A(5), P.A(7), c)
    const laid = passOf(added.play, added.actionId)
    expect(laid.startGlue).toEqual({ targetId: PASS_A4_A5, event: 'end' })
    const compiled = compileLine(added.play, LINE_A, c.settings, c.caches)
    const reception = compiled.passes.find((p) => p.actionId === PASS_A4_A5)
    const release = compiled.passes.find((p) => p.actionId === added.actionId)
    expect(release?.applied).toBe(true)
    expect(release?.releaseT).toBeCloseTo(reception?.arrivalT ?? NaN, 9)
    expect(laid.start).toBeCloseTo(reception?.arrivalT ?? NaN, 9)
  })

  it('glues the release to her reception when the cursor is on it, and follows it (D-171)', () => {
    const c = ctx()
    const play = sevenVsSevenWithOptions()
    const arrival = compileLine(play, LINE_A, c.settings, c.caches).passes.find(
      (p) => p.actionId === PASS_A4_A5,
    )?.arrivalT
    if (arrival === undefined) throw new Error('no arrival')
    for (const t of [arrival, arrival + 0.004, arrival - 0.004]) {
      const added = addPass(play, { line: LINE_A, t }, P.A(5), P.A(7), c)
      const laid = passOf(added.play, added.actionId)
      expect(laid.startGlue).toEqual({ targetId: PASS_A4_A5, event: 'end' })
      expect(laid.start).toBe(arrival)
    }
    const added = addPass(play, { line: LINE_A, t: arrival }, P.A(5), P.A(7), c)
    const moved = setStart(added.play, PASS_A4_A5, 1.5)
    const compiled = compileLine(moved, LINE_A, c.settings, c.caches)
    const reception = compiled.passes.find((p) => p.actionId === PASS_A4_A5)
    const release = compiled.passes.find((p) => p.actionId === added.actionId)
    expect(reception?.arrivalT).toBeGreaterThan(arrival)
    expect(release?.applied).toBe(true)
    expect(release?.releaseT).toBeCloseTo(reception?.arrivalT ?? NaN, 9)
  })

  it('releases at the cursor once it has left the reception', () => {
    const c = ctx()
    const play = sevenVsSevenWithOptions()
    const arrival = compileLine(play, LINE_A, c.settings, c.caches).passes.find(
      (p) => p.actionId === PASS_A4_A5,
    )?.arrivalT
    if (arrival === undefined) throw new Error('no arrival')
    const t = arrival + 0.01
    const added = addPass(play, { line: LINE_A, t }, P.A(5), P.A(7), c)
    const laid = passOf(added.play, added.actionId)
    expect(laid.start).toBe(t)
    expect(laid.startGlue).toBeUndefined()
  })

  it('glues the release to the exit of a breakdown when the cursor is on it (D-171)', () => {
    const c = ctx()
    const rucked: Play = {
      ...sevenVsSevenWithOptions(),
      actions: [breakdown(uuid(300), P.A(4), P.A(5), P.A(3), 1, { duration: 2 })],
      sequences: [],
    }
    const added = addPass(rucked, { line: LINE_A, t: 3 }, P.A(3), P.A(2), c)
    const laid = passOf(added.play, added.actionId)
    expect(laid.startGlue).toEqual({ targetId: uuid(300), event: 'end' })
    expect(laid.start).toBe(3)
  })

  it('glues the release to the exit of a breakdown she relays', () => {
    const c = ctx()
    const rucked = {
      ...sevenVsSevenWithOptions(),
      actions: [
        {
          id: uuid(300),
          type: 'breakdown' as const,
          branchId: P.root,
          start: 1,
          kind: 'ruck' as const,
          tackledId: P.A(4),
          supportId: P.A(5),
          relayerId: P.A(3),
          duration: 2,
        },
      ],
      sequences: [],
    }
    const added = addPass(rucked, { line: LINE_A, t: 0 }, P.A(3), P.A(2), c)
    expect(passOf(added.play, added.actionId).startGlue).toEqual({
      targetId: uuid(300),
      event: 'end',
    })
    const compiled = compileLine(added.play, LINE_A, c.settings, c.caches)
    expect(compiled.passes[0]?.applied).toBe(true)
    expect(compiled.passes[0]?.releaseT).toBeCloseTo(3, 9)
  })

  it('stays at the cursor, ignored and signalled, without any reception traced', () => {
    const c = ctx()
    const added = addPass(sevenVsSevenWithOptions(), { line: LINE_A, t: 0.5 }, P.A(1), P.A(2), c)
    const laid = passOf(added.play, added.actionId)
    expect(laid.start).toBe(0.5)
    expect(laid.startGlue).toBeUndefined()
    const compiled = compileLine(added.play, LINE_A, c.settings, c.caches)
    expect(compiled.passes.find((p) => p.actionId === added.actionId)?.applied).toBe(false)
    expect(compiled.issues).toContainEqual(
      expect.objectContaining({
        code: 'passerWithoutBall',
        target: expect.objectContaining({ id: added.actionId }) as unknown,
      }),
    )
  })

  it('glues a waiting pass to a reception traced afterwards', () => {
    const c = ctx()
    const start = sevenVsSevenWithOptions()
    const cursor = { line: LINE_A, t: 0.2 }
    const waiting = addPass(start, cursor, P.A(1), P.A(2), c)
    const reception = addPass(waiting.play, cursor, P.A(4), P.A(1), c)
    expect(passOf(reception.play, waiting.actionId).startGlue).toEqual({
      targetId: reception.actionId,
      event: 'end',
    })
    const compiled = compileLine(reception.play, LINE_A, c.settings, c.caches)
    const release = compiled.passes.find((p) => p.actionId === waiting.actionId)
    expect(release?.applied).toBe(true)
  })

  it('glues a waiting pass to a kick traced afterwards too', () => {
    const c = ctx()
    const start = sevenVsSevenWithOptions()
    const cursor = { line: LINE_A, t: 0.2 }
    const waiting = addPass(start, cursor, P.A(1), P.A(2), c)
    const reception = addKick(waiting.play, cursor, P.A(4), { receiverId: P.A(1) }, c)
    expect(passOf(reception.play, waiting.actionId).startGlue).toEqual({
      targetId: reception.actionId,
      event: 'end',
    })
  })

  it('glues only the first waiting pass, and none after the arrival of the reception', () => {
    const c = ctx()
    const start = sevenVsSevenWithOptions()
    const first = addPass(start, { line: LINE_A, t: 0.2 }, P.A(1), P.A(2), c)
    const second = addPass(first.play, { line: LINE_A, t: 0.4 }, P.A(1), P.A(3), c)
    const reception = addPass(second.play, { line: LINE_A, t: 0.1 }, P.A(4), P.A(1), c)
    expect(passOf(reception.play, first.actionId).startGlue).toBeDefined()
    expect(passOf(reception.play, second.actionId).startGlue).toBeUndefined()

    const late = addPass(start, { line: LINE_A, t: 5 }, P.A(1), P.A(2), c)
    const early = addPass(late.play, { line: LINE_A, t: 0.1 }, P.A(4), P.A(1), c)
    expect(passOf(early.play, late.actionId).startGlue).toBeUndefined()
  })

  it('leaves the other passes and passes ignored for another reason alone', () => {
    const c = ctx()
    const play = sevenVsSevenWithOptions()
    const twin = addPass(play, { line: LINE_A, t: 0.8 }, P.A(4), P.A(3), c)
    const reception = addPass(twin.play, { line: LINE_A, t: 2 }, P.A(3), P.A(4), c)
    // The twin of the pass at 0.8 s is ignored as simultaneous: it does not wait for a ball.
    expect(passOf(reception.play, twin.actionId).startGlue).toBeUndefined()
  })

  it('glues to a reception traced before, even ignored for now, in the reverse order', () => {
    const c = ctx()
    const start = sevenVsSevenWithOptions()
    const cursor = { line: LINE_A, t: 0.2 }
    const first = addPass(start, cursor, P.A(1), P.A(2), c)
    const next = addPass(first.play, cursor, P.A(2), P.A(3), c)
    expect(passOf(next.play, next.actionId).startGlue).toEqual({
      targetId: first.actionId,
      event: 'end',
    })
    const origin = addPass(next.play, cursor, P.A(4), P.A(1), c)
    const compiled = compileLine(origin.play, LINE_A, c.settings, c.caches)
    expect(compiled.passes.find((p) => p.actionId === next.actionId)?.applied).toBe(true)
  })

  it('keeps a fixed instant at a pickup: it is not a reception (D-119)', () => {
    const c = ctx()
    const a = uuid(1)
    const b = uuid(2)
    const play = basePlay({
      entities: [player(a, 'A', 1), player(b, 'A', 2), ball(uuid(20))],
      setup: {
        positions: { [a]: { x: 40, y: 35 }, [b]: { x: 40, y: 45 } },
        ballCarrierId: null,
        ballPosition: { x: 48, y: 35 },
      },
      actions: [run(uuid(30), a, [{ x: 55, y: 35 }])],
    })
    const line = [P.root]
    const added = addPass(play, { line, t: 0 }, a, b, c)
    const compiled = compileLine(play, line, c.settings, c.caches)
    const pickup = compiled.ball.find((s) => s.kind === 'carried')
    expect(pickup?.start).toBeGreaterThan(0)
    const laid = passOf(added.play, added.actionId)
    expect(laid.start).toBe(pickup?.start)
    expect(laid.startGlue).toBeUndefined()
    // Nor on the pickup itself.
    const on = addPass(play, { line, t: pickup?.start ?? NaN }, a, b, c)
    const onLaid = passOf(on.play, on.actionId)
    expect(onLaid.start).toBe(pickup?.start)
    expect(onLaid.startGlue).toBeUndefined()
  })

  it('does not glue to a reception out of the line of its branch (SPEC 4.3)', () => {
    const c = ctx()
    // In option B, A5 receives from A6 after the branch point: not a target from the trunk.
    const trunkOnly = {
      ...sevenVsSevenWithOptions(),
      actions: sevenVsSevenWithOptions().actions.filter((a) => a.id !== uuid(202)),
    }
    const added = addPass(trunkOnly, { line: LINE_B, t: 0.1 }, P.A(1), P.A(2), c)
    expect(passOf(added.play, added.actionId).startGlue).toBeUndefined()
    const fromOption = addPass(
      {
        ...trunkOnly,
        actions: [...trunkOnly.actions, pass(uuid(310), P.A(4), P.A(1), 7, { branchId: P.optB })],
      },
      { line: LINE_B, t: 0.1 },
      P.A(1),
      P.A(2),
      c,
    )
    expect(passOf(fromOption.play, fromOption.actionId).start).toBe(0.1)
    expect(passOf(fromOption.play, fromOption.actionId).startGlue).toBeUndefined()
  })

  it('edits pace, imposed duration and pass speed; deletes actions', () => {
    const c = ctx()
    let play = sevenVsSevenWithOptions()
    play = updateRun(play, uuid(200), { pace: 'sprint' })
    play = updateRun(play, uuid(200), { durationOverride: 3 })
    expect(actionOf(play, uuid(200))).toMatchObject({ pace: 'sprint', durationOverride: 3 })
    play = updateRun(play, uuid(200), { durationOverride: null })
    expect(actionOf(play, uuid(200))).not.toHaveProperty('durationOverride')
    play = updatePass(play, uuid(202), { ballSpeed: 9 })
    expect(actionOf(play, uuid(202))).toMatchObject({ ballSpeed: 9 })
    play = updatePass(play, uuid(202), { ballSpeed: null })
    expect(actionOf(play, uuid(202))).not.toHaveProperty('ballSpeed')
    play = setStart(play, uuid(202), 1.2)
    expect(actionOf(play, uuid(202))).toMatchObject({ start: 1.2 })
    expect(setStart(play, uuid(202), 1.2)).toBe(play)
    expect(actionOf(setStart(play, uuid(202), -3), uuid(202))).toMatchObject({ start: 0 })
    expect(setStart(play, uuid(202), Number.NaN)).toBe(play)
    play = deleteActions(play, [uuid(202)], c).play
    expect(play.actions.some((a) => a.id === uuid(202))).toBe(false)
  })

  it('edits the play metadata, attacking team included', () => {
    const play = updatePlayMeta(sevenVsSevenWithOptions(), {
      name: 'X',
      attackingTeam: 'B',
      category: 'drill',
    })
    expect(play).toMatchObject({ name: 'X', attackingTeam: 'B', category: 'drill' })
  })
})

describe('history (SPEC 6.3)', () => {
  it('undoes and redoes 10 steps in a row', () => {
    let history = EMPTY_HISTORY
    let play: Play = basePlay()
    const c = ctx()
    const states: Play[] = [play]
    for (let i = 0; i < 10; i++) {
      history = record(history, play)
      play = addPlayer(play, 'A', { x: i, y: 1 }, c).play
      states.push(play)
    }
    for (let i = 9; i >= 0; i--) {
      const result = undo(history, play)
      if (!result) throw new Error('undo')
      history = result.history
      play = result.play
      expect(play).toBe(states[i])
    }
    expect(undo(history, play)).toBeNull()
    for (let i = 1; i <= 10; i++) {
      const result = redo(history, play)
      if (!result) throw new Error('redo')
      history = result.history
      play = result.play
      expect(play).toBe(states[i])
    }
    expect(redo(history, play)).toBeNull()
  })

  it('keeps 100 levels and clears redo on a new change', () => {
    let history = EMPTY_HISTORY
    for (let i = 0; i < 150; i++) history = record(history, basePlay({ name: String(i) }))
    expect(history.past).toHaveLength(100)
    expect(history.past[0]?.name).toBe('50')
    const back = undo(history, basePlay())
    expect(back?.history.future).toHaveLength(1)
    expect(record(back?.history ?? EMPTY_HISTORY, basePlay()).future).toEqual([])
  })
})

describe('selection, hit test and snapping', () => {
  const play = sevenVsSevenWithOptions()
  const schematic = windowSchematic(play, LINE_A, 0, settings, createCaches())
  const tol = { token: 1.2, handle: 0.8, line: 0.6 }

  it('reaches the player at the end of her run without handles, for the other tools (D-175)', () => {
    const run = play.actions.find((a) => a.id === uuid(200))
    const end = run?.type === 'run' ? run.waypoints.at(-1) : undefined
    if (!end) throw new Error('no run')
    const report = lineReport(play, LINE_A, settings, createCaches()).rows.find(
      (r) => r.actionId === uuid(200),
    )
    if (!report) throw new Error('no row')
    const atEnd = windowSchematic(play, LINE_A, report.end, settings, createCaches())
    expect(hitTest(atEnd, end, tol)).toMatchObject({ kind: 'waypoint', actionId: uuid(200) })
    expect(hitTest(atEnd, end, tol, false)).toEqual({ kind: 'player', id: P.A(4) })
  })

  it('hits handles first, then players, runs and passes', () => {
    expect(hitTest(schematic, { x: 44.2, y: 36.1 }, tol)).toEqual({
      kind: 'waypoint',
      actionId: uuid(200),
      index: 0,
    })
    expect(hitTest(schematic, { x: 40.5, y: 25.4 }, tol)).toEqual({ kind: 'player', id: P.A(3) })
    expect(hitTest(schematic, { x: 30, y: 60 }, tol)).toBeNull()
    const passLine = schematic.passes[0]
    if (!passLine) throw new Error('pass')
    const mid = {
      x: (passLine.from.x + passLine.to.x) / 2,
      y: (passLine.from.y + passLine.to.y) / 2,
    }
    expect(hitTest(schematic, mid, tol)).toEqual({ kind: 'pass', actionId: uuid(202) })
  })

  it('reaches the earlier lines in grey, without their handles (SPEC 6.3)', () => {
    const later = windowSchematic(play, LINE_A, 7, settings, createCaches())
    expect(later.runs.some((r) => r.actionId === uuid(200))).toBe(false)
    const earlier = later.earlierRuns.find((r) => r.actionId === uuid(200))
    const onLine = earlier?.points[8]
    if (!onLine) throw new Error('no earlier run')
    expect(hitTest(later, onLine, { ...tol, token: 0.01 })).toEqual({
      kind: 'run',
      actionId: uuid(200),
      segment: 0,
    })
    const earlierPass = later.earlierPasses.find((p) => p.actionId === uuid(202))
    if (!earlierPass) throw new Error('no earlier pass')
    const mid = {
      x: (earlierPass.from.x + earlierPass.to.x) / 2,
      y: (earlierPass.from.y + earlierPass.to.y) / 2,
    }
    expect(hitTest(later, mid, tol)).toEqual({ kind: 'pass', actionId: uuid(202) })
  })

  it('prefers a line of the interval to an earlier one', () => {
    const later = windowSchematic(play, LINE_A, 7, settings, createCaches())
    const current = later.runs.find((r) => r.actionId === uuid(220))
    const onLine = current?.points[12]
    if (!onLine) throw new Error('no run')
    const wide = { token: 0.01, handle: 0.01, line: 100 }
    expect(hitTest(later, onLine, wide)).toMatchObject({ kind: 'run', actionId: uuid(220) })
  })

  it('selects by click, Shift+click and rubber band', () => {
    let selection = selectPlayer(EMPTY_SELECTION, P.A(1), false)
    selection = selectPlayer(selection, P.A(2), true)
    expect(selection.players).toEqual([P.A(1), P.A(2)])
    selection = selectPlayer(selection, P.A(1), true)
    expect(selection.players).toEqual([P.A(2)])
    expect(selectAction(selection, uuid(200), false)).toEqual({
      players: [],
      actions: [uuid(200)],
      waypoint: null,
      segment: null,
    })
    const boxed = playersInBox(schematic, { min: { x: 35, y: 0 }, max: { x: 45, y: 16 } })
    expect(boxed).toEqual([P.A(1), P.A(2)])
    expect(selectPlayersInBox(selection, boxed, true).players).toEqual([P.A(2), P.A(1)])
    expect(pruneSelection(selection, new Set([P.A(1)]), new Set()).players).toEqual([])
  })

  it('takes the players of the box at their position at the cursor', () => {
    const later = windowSchematic(play, LINE_A, 3, settings, createCaches())
    const a4 = later.players.find((p) => p.id === P.A(4))?.pos
    if (!a4) throw new Error('no A4')
    expect(a4).not.toEqual(play.setup.positions[P.A(4)])
    const box = {
      min: { x: a4.x - 0.1, y: a4.y - 0.1 },
      max: { x: a4.x + 0.1, y: a4.y + 0.1 },
    }
    expect(playersInBox(later, box)).toEqual([P.A(4)])
  })

  it('snaps on a 1 m grid when enabled', () => {
    expect(snapToGrid({ x: 10.4, y: 7.6 })).toEqual({ x: 10, y: 8 })
    expect(maybeSnap({ x: 10.4, y: 7.6 }, false)).toEqual({ x: 10.4, y: 7.6 })
  })
})

describe('tools (SPEC 6.2)', () => {
  it('run tool: player, clicks, double click, Enter, Escape', () => {
    const anchor = { x: 1, y: 1 }
    let draft = runToolClick(null, null, { x: 5, y: 5 }, () => anchor)
    expect(draft).toBeNull()
    draft = runToolClick(null, { kind: 'player', id: P.A(1) }, { x: 1, y: 1 }, () => anchor)
    expect(draft).toEqual({ entityId: P.A(1), anchor, points: [] })
    draft = runToolClick(draft, null, { x: 3, y: 2 }, () => anchor)
    draft = runToolClick(draft, null, { x: 6, y: 4 }, () => anchor)
    // The second click of a double click lands on the same point.
    draft = runToolClick(draft, null, { x: 6.01, y: 4 }, () => anchor)
    expect(runToolPreview(draft, { x: 7, y: 7 })).toEqual([
      anchor,
      { x: 3, y: 2 },
      { x: 6, y: 4 },
      { x: 7, y: 7 },
    ])
    expect(runToolFinish(draft)).toEqual({
      entityId: P.A(1),
      waypoints: [
        { x: 3, y: 2 },
        { x: 6, y: 4 },
      ],
    })
    expect(runToolFinish({ entityId: P.A(1), anchor, points: [] })).toBeNull()
  })

  it('pass tool: passer then receiver', () => {
    const first = passToolClick(null, { kind: 'player', id: P.A(1) })
    expect(first).toEqual({ fromId: P.A(1), commit: null })
    expect(passToolClick(first.fromId, { kind: 'player', id: P.A(2) })).toEqual({
      fromId: null,
      commit: { fromId: P.A(1), toId: P.A(2) },
    })
    expect(passToolClick(first.fromId, null)).toEqual({ fromId: null, commit: null })
    expect(passToolClick(first.fromId, { kind: 'player', id: P.A(1) })).toEqual({
      fromId: null,
      commit: null,
    })
  })

  it('maps every shortcut of SPEC 6.2', () => {
    const k = (key: string, ctrl = false, shift = false) =>
      shortcutFor({ key, ctrl, shift, alt: false }, 0.5, 5)
    expect(k('v')).toEqual({ kind: 'tool', tool: 'select' })
    expect(k('A')).toEqual({ kind: 'tool', tool: 'placeA' })
    expect(k('b')).toEqual({ kind: 'tool', tool: 'placeB' })
    expect(k('r')).toEqual({ kind: 'tool', tool: 'run' })
    expect(k('p')).toEqual({ kind: 'tool', tool: 'pass' })
    expect(k('Delete')).toEqual({ kind: 'delete' })
    expect(k('d', true)).toEqual({ kind: 'duplicate' })
    expect(k('ArrowLeft')).toEqual({ kind: 'nudge', dx: -0.5, dy: 0 })
    expect(k('ArrowDown', false, true)).toEqual({ kind: 'nudge', dx: 0, dy: 5 })
    expect(k('l')).toEqual({ kind: 'playPause' })
    expect(k('f')).toEqual({ kind: 'fit' })
    expect(k('z', true)).toEqual({ kind: 'undo' })
    expect(k('y', true)).toEqual({ kind: 'redo' })
    expect(k('s', true)).toEqual({ kind: 'save' })
    expect(k('Enter')).toEqual({ kind: 'finish' })
    expect(k('Escape')).toEqual({ kind: 'cancel' })
    expect(k('x')).toBeNull()
  })
})

describe('starting placements (SPEC 6.6, D-008)', () => {
  it('creates « Équipe A seule en ligne » and « 7 contre 7 en ligne », on the root alone', () => {
    const alone = createNewPlay('teamA', sequentialIds(), NOW)
    const seven = createNewPlay('sevenVsSeven', sequentialIds(), NOW)
    expect(validatePlay(alone)).toEqual([])
    expect(validatePlay(seven)).toEqual([])
    expect(alone.entities.filter(isPlayer)).toHaveLength(7)
    const players = seven.entities.filter(isPlayer)
    expect(players.filter((p) => p.team === 'B')).toHaveLength(7)
    const a4 = players.find((p) => p.team === 'A' && p.number === 4)
    expect(seven.setup.ballCarrierId).toBe(a4?.id)
    expect(seven.setup.positions[a4?.id ?? '']).toEqual({ x: 40, y: 35 })
    const b1 = players.find((p) => p.team === 'B' && p.number === 1)
    expect(seven.setup.positions[b1?.id ?? '']).toEqual({ x: 50, y: 5 })
    expect(seven).toMatchObject({
      schemaVersion: 5,
      name: 'Nouvelle combinaison',
      category: 'phasePlay',
      attackingTeam: 'A',
      actions: [],
      sequences: [],
    })
    expect(seven.branches).toHaveLength(1)
    expect(seven.branches[0]?.parentId).toBeNull()
    expect(seven.field).toEqual({ length: 100, width: 70, inGoal: 10, view: { kind: 'full' } })
  })
})
