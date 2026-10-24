import { describe, expect, it } from 'vitest'
import { createCaches } from '../engine/caches'
import { compiledPhaseOf, phaseSchematic } from '../engine/evaluate'
import { childrenOf, phaseLabelParts } from '../model/phaseTree'
import { defaultSettings, engineSettingsOf } from '../model/settings'
import { isPlayer, type Play, type RunAction } from '../model/types'
import { validatePlay } from '../model/validate'
import { P, basePlay, sequentialIds, sevenVsSevenWithOptions, uuid } from '../test/builders'
import {
  addBall,
  addPass,
  addPhaseAfter,
  addPlayer,
  addRun,
  canAddPhaseAfter,
  createOption,
  deleteActions,
  deletePhase,
  deletePlayers,
  deleteWaypoint,
  duplicatePhase,
  duplicatePlayers,
  insertPhaseAfter,
  moveSetupPositions,
  moveWaypoint,
  nextFreeNumber,
  removeBall,
  setBallCarrier,
  setDefaultOption,
  updatePass,
  updatePhase,
  updatePlayMeta,
  updatePlayer,
  updateRun,
  type CommandContext,
} from './commands'
import { EMPTY_HISTORY, record, redo, undo } from './history'
import { hitTest, playersInBox } from './hitTest'
import { createNewPlay } from './placements'
import {
  EMPTY_SELECTION,
  pruneSelection,
  selectAction,
  selectPlayer,
  selectPlayersInBox,
} from './selection'
import { shortcutFor } from './shortcuts'
import { maybeSnap, snapToGrid } from './snap'
import { passToolClick } from './tools/passTool'
import { runToolClick, runToolFinish, runToolPreview } from './tools/runTool'

const settings = engineSettingsOf(defaultSettings())
const ctx = (start = 5000): CommandContext => ({
  ids: sequentialIds(start),
  settings,
  caches: createCaches(),
})
const NOW = new Date('2026-10-14T12:00:00.000Z')

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
    play = deletePlayers(play, [firstA?.id ?? ''])
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

  it('deletes players with their runs and passes in every phase (D-014)', () => {
    const play = deletePlayers(sevenVsSevenWithOptions(), [P.A(5)])
    expect(play.entities.some((e) => e.id === P.A(5))).toBe(false)
    expect(P.A(5) in play.setup.positions).toBe(false)
    for (const phase of play.phases) {
      for (const action of phase.actions) {
        if (action.type === 'run') expect(action.entityId).not.toBe(P.A(5))
        if (action.type === 'pass') expect([action.fromId, action.toId]).not.toContain(P.A(5))
      }
    }
    expect(validatePlay(play).filter((i) => i.severity === 'error')).toEqual([])
    const noCarrier = deletePlayers(sevenVsSevenWithOptions(), [P.A(4)])
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

describe('runs and passes (SPEC 6.2, D-015)', () => {
  it('adds a run, or extends the existing run of the player in the phase', () => {
    const c = ctx()
    let play = sevenVsSevenWithOptions()
    const added = addRun(play, P.t1, P.A(1), [{ x: 45, y: 5 }], c)
    play = added.play
    const t1 = play.phases.find((p) => p.id === P.t1)
    expect(t1?.actions.find((a) => a.id === added.actionId)).toMatchObject({
      type: 'run',
      pace: 'jog',
      delay: 0,
    })
    const extended = addRun(play, P.t1, P.A(1), [{ x: 50, y: 6 }], c)
    expect(extended.actionId).toBe(added.actionId)
    const run = extended.play.phases
      .find((p) => p.id === P.t1)
      ?.actions.find((a) => a.id === added.actionId) as RunAction
    expect(run.waypoints).toEqual([
      { x: 45, y: 5 },
      { x: 50, y: 6 },
    ])
    expect(addRun(play, P.t1, P.A(1), [], c).actionId).toBeNull()
  })

  it('moves and deletes waypoints; deleting the last one deletes the run', () => {
    let play = sevenVsSevenWithOptions()
    play = moveWaypoint(play, uuid(200), 1, { x: 47, y: 41 })
    const run = play.phases[0]?.actions.find((a) => a.id === uuid(200)) as RunAction
    expect(run.waypoints[1]).toEqual({ x: 47, y: 41 })
    play = deleteWaypoint(play, uuid(200), 0).play
    play = deleteWaypoint(play, uuid(200), 0).play
    expect(play.phases[0]?.actions.some((a) => a.id === uuid(200))).toBe(false)
  })

  it('releases a new pass at a fixed instant from the carrier, on receipt otherwise (D-110)', () => {
    const c = ctx()
    const play = sevenVsSevenWithOptions()
    const fromCarrier = addPass(play, P.t1, P.A(4), P.A(3), c)
    expect(
      fromCarrier.play.phases[0]?.actions.find((a) => a.id === fromCarrier.actionId),
    ).toMatchObject({ delay: 0 })
    // A5 receives the pass of T1: her pass leaves on receipt, without control time.
    const fromReceiver = addPass(play, P.t1, P.A(5), P.A(6), c)
    const pass = fromReceiver.play.phases[0]?.actions.find((a) => a.id === fromReceiver.actionId)
    expect(pass).toMatchObject({ delay: 0, release: 'onReceipt' })
    const compiled = compiledPhaseOf(fromReceiver.play, P.t1, c.settings, c.caches)
    const released = compiled?.passes.find((p) => p.actionId === fromReceiver.actionId)
    expect(released?.applied).toBe(true)
    expect((released?.releaseT ?? 0) - (compiled?.start ?? 0)).toBeGreaterThan(0.8)
    expect(addPass(play, P.t1, P.A(5), P.A(5), c).actionId).toBeNull()
  })

  it('edits pace, imposed duration, delay and pass speed; deletes actions', () => {
    let play = sevenVsSevenWithOptions()
    play = updateRun(play, uuid(200), { pace: 'sprint', durationOverride: 3, delay: 0.4 })
    expect(play.phases[0]?.actions.find((a) => a.id === uuid(200))).toMatchObject({
      pace: 'sprint',
      durationOverride: 3,
      delay: 0.4,
    })
    play = updateRun(play, uuid(200), { durationOverride: null })
    expect(play.phases[0]?.actions.find((a) => a.id === uuid(200))).not.toHaveProperty(
      'durationOverride',
    )
    play = updatePass(play, uuid(202), { ballSpeed: 9, delay: 1 })
    expect(play.phases[0]?.actions.find((a) => a.id === uuid(202))).toMatchObject({
      ballSpeed: 9,
      delay: 1,
    })
    play = deleteActions(play, [uuid(202)])
    expect(play.phases[0]?.actions.some((a) => a.id === uuid(202))).toBe(false)
  })
})

describe('phase tree (SPEC 6.4, D-012)', () => {
  it('adds a phase after a leaf only', () => {
    const play = sevenVsSevenWithOptions()
    expect(canAddPhaseAfter(play, P.t2)).toBe(false)
    expect(addPhaseAfter(play, P.t2, ctx()).phaseId).toBeNull()
    const added = addPhaseAfter(play, P.t3a, ctx())
    expect(childrenOf(added.play, P.t3a).map((p) => p.id)).toEqual([added.phaseId])
  })

  it('inserts a phase between a phase and its children, keeping the default option', () => {
    const { play, phaseId } = insertPhaseAfter(sevenVsSevenWithOptions(), P.t2, ctx())
    expect(childrenOf(play, P.t2).map((p) => p.id)).toEqual([phaseId])
    expect(childrenOf(play, phaseId ?? '').map((p) => p.id)).toEqual([P.t3a, P.t3b])
    expect(play.phases.find((p) => p.id === P.t3a)?.isDefault).toBe(true)
    expect(phaseLabelParts(play, P.t3b)).toEqual({ depth: 4, option: 'B', custom: null })
    expect(validatePlay(play)).toEqual([])
  })

  it('creates options: a phase alone becomes option A by default; not on the root', () => {
    let play = basePlay()
    const root = play.phases[0]?.id ?? ''
    expect(createOption(play, root, ctx()).phaseId).toBeNull()
    const t2 = addPhaseAfter(play, root, ctx(10))
    play = t2.play
    const option = createOption(play, t2.phaseId ?? '', ctx(20))
    play = option.play
    expect(childrenOf(play, root).map((p) => [p.id, p.isDefault])).toEqual([
      [t2.phaseId, true],
      [option.phaseId, false],
    ])
    expect(phaseLabelParts(play, option.phaseId ?? '').option).toBe('B')
    expect(validatePlay(play)).toEqual([])
  })

  it('duplicates a phase as a sibling with copied actions, without descendants', () => {
    const { play, phaseId } = duplicatePhase(sevenVsSevenWithOptions(), P.t2, ctx())
    const copy = play.phases.find((p) => p.id === phaseId)
    expect(copy?.parentId).toBe(P.t1)
    expect(copy?.actions).toHaveLength(2)
    expect(copy?.actions.map((a) => a.id)).not.toContain(uuid(210))
    expect(childrenOf(play, phaseId ?? '')).toEqual([])
    expect(play.phases.find((p) => p.id === P.t2)?.isDefault).toBe(true)
    expect(validatePlay(play)).toEqual([])
  })

  it('deletes a phase with its descendants, never the root, and keeps one default', () => {
    const play = sevenVsSevenWithOptions()
    expect(deletePhase(play, P.t1)).toBe(play)
    const withoutT2 = deletePhase(play, P.t2)
    expect(withoutT2.phases.map((p) => p.id)).toEqual([P.t1])
    const withoutA = deletePhase(play, P.t3a)
    expect(withoutA.phases.find((p) => p.id === P.t3b)?.isDefault).toBe(true)
  })

  it('chooses the default option, renames, sets condition and instruction', () => {
    let play = setDefaultOption(sevenVsSevenWithOptions(), P.t3b)
    expect(childrenOf(play, P.t2).map((p) => p.isDefault)).toEqual([false, true])
    play = updatePhase(play, P.t3b, { label: 'Retour', condition: 'Montée', instruction: 'Vite' })
    expect(play.phases.find((p) => p.id === P.t3b)).toMatchObject({
      label: 'Retour',
      condition: 'Montée',
      instruction: 'Vite',
    })
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
  const schematic = phaseSchematic(play, P.t1, settings, createCaches())
  if (!schematic) throw new Error('schematic')
  const tol = { token: 1.2, handle: 0.8, line: 0.6 }

  it('hits handles first, then players, runs and passes', () => {
    expect(hitTest(schematic, { x: 44.2, y: 36.1 }, tol)).toEqual({
      kind: 'waypoint',
      actionId: uuid(200),
      index: 0,
    })
    expect(hitTest(schematic, { x: 40.5, y: 25.4 }, tol)).toEqual({ kind: 'player', id: P.A(3) })
    expect(hitTest(schematic, { x: 30, y: 60 }, tol)).toBeNull()
    const pass = schematic.passes[0]
    if (!pass) throw new Error('pass')
    const mid = { x: (pass.from.x + pass.to.x) / 2, y: (pass.from.y + pass.to.y) / 2 }
    expect(hitTest(schematic, mid, tol)).toEqual({ kind: 'pass', actionId: uuid(202) })
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
  it('creates « Équipe A seule en ligne » and « 7 contre 7 en ligne »', () => {
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
      name: 'Nouvelle combinaison',
      category: 'phasePlay',
      attackingTeam: 'A',
    })
    expect(seven.field).toEqual({ length: 100, width: 70, inGoal: 10, view: { kind: 'full' } })
  })
})
