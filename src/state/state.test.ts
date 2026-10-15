import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_SELECTION } from '../editor/selection'
import type { Hit } from '../editor/hitTest'
import { isPlayer, type Play, type RunAction } from '../model/types'
import { P, sevenVsSevenWithOptions, uuid } from '../test/builders'
import { compileLine } from '../engine/timeline'
import { autoFrame } from '../player/framing'
import { fitView } from '../render/viewport'
import {
  adjustViewTo,
  editorContextMenu,
  editorDoubleClick,
  editorPointerDown,
  editorPointerMove,
  editorPointerUp,
  handleKey,
  useInteractionStore,
} from './editorActions'
import {
  applyEdit,
  beginGesture,
  endGesture,
  markSaved,
  openPlay,
  previewGesture,
  reloadPlay,
  selectPhase,
  setEditorChangeListener,
  setTool,
  useEditorStore,
} from './editorStore'
import { visibleSummaries } from './libraryState'
import { playPause, setOrientation, showPhaseInPlayer, usePlayerStore } from './playerStore'
import { appCaches, currentEngineSettings } from './settingsStore'
import { savedFrame, setCanvasSize, setView, useViewStore } from './viewStore'

const key = (k: string, ctrl = false, shift = false) =>
  handleKey({ key: k, ctrl, shift, alt: false })
const down = (pos: { x: number; y: number }, hit: Hit = null, shift = false) => {
  editorPointerDown({ pos, hit, shift })
}
const current = (): Play => {
  const play = useEditorStore.getState().play
  if (!play) throw new Error('no play')
  return play
}

let changes = 0

beforeEach(() => {
  changes = 0
  setEditorChangeListener(() => {
    changes++
  })
  openPlay(sevenVsSevenWithOptions(), null, false)
  setTool('select')
  usePlayerStore.setState({ mode: 'edit', orientation: 'landscape' })
  useInteractionStore.setState({ metersPerPx: 0 })
})

describe('editor store (SPEC 6.3)', () => {
  it('applies an edit as one undo step and notifies the session', () => {
    expect(applyEdit((p) => ({ ...p, notes: 'x' }))).toBe(true)
    expect(useEditorStore.getState()).toMatchObject({ dirty: true })
    expect(useEditorStore.getState().history.past).toHaveLength(1)
    expect(changes).toBe(1)
    expect(applyEdit((p) => p)).toBe(false)
  })

  it('refuses edits of a read-only play (duplicate not resolved)', () => {
    openPlay(sevenVsSevenWithOptions(), null, true)
    expect(applyEdit((p) => ({ ...p, notes: 'x' }))).toBe(false)
    expect(useEditorStore.getState().notice).toBe('readOnly')
  })

  it('records a whole gesture as a single step', () => {
    beginGesture()
    for (let i = 1; i <= 20; i++) previewGesture((start) => ({ ...start, notes: String(i) }))
    endGesture()
    expect(current().notes).toBe('20')
    expect(useEditorStore.getState().history.past).toHaveLength(1)
    key('z', true)
    expect(current().notes).toBe('')
  })

  it('keeps changes made during a save', () => {
    applyEdit((p) => ({ ...p, notes: 'a' }))
    const savedFrom = current()
    const saved = { ...savedFrom, updatedAt: '2026-10-14T20:00:00.000Z' }
    markSaved({ play: saved, fileName: 'x', version: { lastModified: 1, size: 2 } }, savedFrom)
    expect(useEditorStore.getState()).toMatchObject({
      dirty: false,
      version: { lastModified: 1, size: 2 },
    })
    expect(current()).toBe(saved)
    applyEdit((p) => ({ ...p, notes: 'b' }))
    const from = current()
    applyEdit((p) => ({ ...p, notes: 'c' }))
    markSaved(
      { play: { ...from, updatedAt: '2026-10-14T21:00:00.000Z' }, fileName: 'x', version: null },
      from,
    )
    expect(useEditorStore.getState().dirty).toBe(true)
    expect(current()).toMatchObject({ notes: 'c', updatedAt: '2026-10-14T21:00:00.000Z' })
  })

  it('reloads silently and restarts the history', () => {
    applyEdit((p) => ({ ...p, notes: 'a' }))
    reloadPlay({ ...sevenVsSevenWithOptions(), notes: 'PC 2' }, null)
    expect(useEditorStore.getState()).toMatchObject({ dirty: false })
    expect(useEditorStore.getState().history.past).toEqual([])
  })
})

describe('field interactions (SPEC 6.2)', () => {
  it('places A and B players with the tools', () => {
    key('a')
    down({ x: 20.3, y: 30 })
    key('b')
    down({ x: 25, y: 30 })
    const players = current().entities.filter(isPlayer)
    expect(players.filter((p) => p.team === 'A').map((p) => p.number)).toContain(8)
    expect(players.filter((p) => p.team === 'B').map((p) => p.number)).toContain(8)
  })

  it('snaps on the grid when enabled', () => {
    useEditorStore.setState({ snap: true })
    key('a')
    down({ x: 20.3, y: 29.6 })
    const created = current()
      .entities.filter(isPlayer)
      .find((p) => p.team === 'A' && p.number === 8)
    expect(current().setup.positions[created?.id ?? '']).toEqual({ x: 20, y: 30 })
    useEditorStore.setState({ snap: false })
  })

  it('draws a run: player, points, Enter; a double click also finishes', () => {
    key('r')
    down({ x: 40, y: 5 }, { kind: 'player', id: P.A(1) })
    down({ x: 43, y: 6 })
    down({ x: 46, y: 4 })
    key('Enter')
    const run = current().phases[0]?.actions.find(
      (a) => a.type === 'run' && a.entityId === P.A(1),
    ) as RunAction
    expect(run.waypoints).toEqual([
      { x: 43, y: 6 },
      { x: 46, y: 4 },
    ])
    down({ x: 40, y: 15 }, { kind: 'player', id: P.A(2) })
    down({ x: 44, y: 15 })
    down({ x: 44, y: 15 })
    editorDoubleClick()
    const second = current().phases[0]?.actions.find(
      (a) => a.type === 'run' && a.entityId === P.A(2),
    ) as RunAction
    expect(second.waypoints).toEqual([{ x: 44, y: 15 }])
    // Escape cancels a run in progress.
    down({ x: 40, y: 25 }, { kind: 'player', id: P.A(3) })
    down({ x: 41, y: 25 })
    key('Escape')
    expect(
      current().phases[0]?.actions.some((a) => a.type === 'run' && a.entityId === P.A(3)),
    ).toBe(false)
  })

  it('draws a pass: passer then receiver', () => {
    key('p')
    down({ x: 40, y: 35 }, { kind: 'player', id: P.A(4) })
    down({ x: 40, y: 25 }, { kind: 'player', id: P.A(3) })
    expect(current().phases[0]?.actions.filter((a) => a.type === 'pass')).toHaveLength(2)
  })

  it('drags players of the starting placement in phase 1, as one undo step', () => {
    down({ x: 40, y: 5 }, { kind: 'player', id: P.A(1) })
    editorPointerMove({ x: 41, y: 6 })
    editorPointerMove({ x: 42, y: 7 })
    editorPointerUp()
    expect(current().setup.positions[P.A(1)]).toEqual({ x: 42, y: 7 })
    expect(useEditorStore.getState().history.past).toHaveLength(1)
  })

  it('never moves a position inherited from a previous phase (D-009)', () => {
    selectPhase(P.t2)
    const before = current()
    down({ x: 47, y: 50 }, { kind: 'player', id: P.A(5) })
    editorPointerMove({ x: 50, y: 50 })
    editorPointerUp()
    expect(current()).toBe(before)
    expect(useEditorStore.getState().notice).toBe('inheritedPosition')
    key('ArrowRight')
    expect(current()).toBe(before)
    // The notice goes away with the phase it was about, and during playback.
    selectPhase(P.t1)
    expect(useEditorStore.getState().notice).toBeNull()
    useEditorStore.setState({ notice: 'inheritedPosition' })
    key('l')
    expect(useEditorStore.getState().notice).toBeNull()
    playPause()
  })

  it('moves a waypoint by drag and removes it with a right click', () => {
    down({ x: 44, y: 36 }, { kind: 'waypoint', actionId: uuid(200), index: 0 })
    editorPointerMove({ x: 45, y: 37 })
    editorPointerUp()
    let run = current().phases[0]?.actions.find((a) => a.id === uuid(200)) as RunAction
    expect(run.waypoints[0]).toEqual({ x: 45, y: 37 })
    editorContextMenu({ kind: 'waypoint', actionId: uuid(200), index: 0 })
    run = current().phases[0]?.actions.find((a) => a.id === uuid(200)) as RunAction
    expect(run.waypoints).toEqual([{ x: 46, y: 40 }])
  })

  it('selects with a rubber band, nudges with the arrows and deletes with Suppr', () => {
    down({ x: 35, y: 0 })
    editorPointerMove({ x: 45, y: 16 })
    editorPointerUp()
    expect(useEditorStore.getState().selection.players).toEqual([P.A(1), P.A(2)])
    key('ArrowRight')
    expect(current().setup.positions[P.A(1)]).toEqual({ x: 40.5, y: 5 })
    key('ArrowRight', false, true)
    expect(current().setup.positions[P.A(1)]).toEqual({ x: 45.5, y: 5 })
    key('Delete')
    expect(current().entities.some((e) => e.id === P.A(1) || e.id === P.A(2))).toBe(false)
    expect(useEditorStore.getState().selection).toEqual(EMPTY_SELECTION)
  })

  it('duplicates the selection with Ctrl+D and undoes then redoes it', () => {
    down({ x: 40, y: 5 }, { kind: 'player', id: P.A(1) })
    editorPointerUp()
    key('d', true)
    expect(current().entities.filter(isPlayer)).toHaveLength(15)
    key('z', true)
    expect(current().entities.filter(isPlayer)).toHaveLength(14)
    key('y', true)
    expect(current().entities.filter(isPlayer)).toHaveLength(15)
  })
})

describe('click threshold (D-051)', () => {
  it('a click shaking by one pixel selects a player without moving it', () => {
    // 10 px per metre: the 4 px threshold is 0.4 m.
    useInteractionStore.setState({ metersPerPx: 0.1 })
    const before = current()
    down({ x: 40, y: 5 }, { kind: 'player', id: P.A(1) })
    editorPointerMove({ x: 40.1, y: 5 })
    editorPointerUp()
    expect(current()).toBe(before)
    expect(useEditorStore.getState()).toMatchObject({ dirty: false })
    expect(useEditorStore.getState().history.past).toHaveLength(0)
    expect(useEditorStore.getState().selection.players).toEqual([P.A(1)])
    // Past the threshold, the drag moves the player, from the press position.
    down({ x: 40, y: 5 }, { kind: 'player', id: P.A(1) })
    editorPointerMove({ x: 40.3, y: 5 })
    editorPointerMove({ x: 41, y: 6 })
    editorPointerUp()
    expect(current().setup.positions[P.A(1)]).toEqual({ x: 41, y: 6 })
    expect(useEditorStore.getState().history.past).toHaveLength(1)
  })

  it('a click on a waypoint does not move it either', () => {
    useInteractionStore.setState({ metersPerPx: 0.1 })
    const before = current()
    down({ x: 44, y: 36 }, { kind: 'waypoint', actionId: uuid(200), index: 0 })
    editorPointerMove({ x: 44.2, y: 36.1 })
    editorPointerUp()
    expect(current()).toBe(before)
    expect(useEditorStore.getState().history.past).toHaveLength(0)
  })
})

describe('view (D-048, D-049)', () => {
  const size = { width: 960, height: 540 }
  const fit = (play: Play) => fitView(savedFrame(play), 960, 540, 'landscape', play.attackingTeam)

  it('keeps the scale and the centre when the canvas changes size', () => {
    setCanvasSize(size)
    adjustViewTo('saved')
    const view = useViewStore.getState().view
    expect(view).toEqual(fit(current()))
    setCanvasSize({ width: 700, height: 400 })
    setCanvasSize({ width: 1400, height: 900 })
    expect(useViewStore.getState().view).toBe(view)
  })

  it('« Ajuster » (F) fits the saved view again; « Zone utile » fits the line being played', () => {
    setCanvasSize(size)
    setView({ center: { x: 3, y: 4 }, scale: 30 })
    key('f')
    expect(useViewStore.getState().view).toEqual(fit(current()))
    showPhaseInPlayer(P.t3b)
    adjustViewTo('useful')
    const line = usePlayerStore.getState().transport.line
    const frame = autoFrame(compileLine(current(), line, currentEngineSettings(), appCaches))
    expect(frame).not.toBeNull()
    if (frame)
      expect(useViewStore.getState().view).toEqual(
        fitView(frame, 960, 540, 'landscape', current().attackingTeam),
      )
  })

  it('opening a play and changing the orientation reset the view; a silent reload does not', () => {
    const view = { center: { x: 3, y: 4 }, scale: 30 }
    setView(view)
    reloadPlay({ ...current(), notes: 'autre PC' }, null)
    expect(useViewStore.getState().view).toBe(view)
    setOrientation('portrait')
    expect(useViewStore.getState().view).toBeNull()
    setView(view)
    openPlay(sevenVsSevenWithOptions(), null, false)
    expect(useViewStore.getState().view).toBeNull()
  })

  it('playback, a chosen option and the way back to editing leave the view as it is', () => {
    const view = { center: { x: 3, y: 4 }, scale: 30 }
    setView(view)
    showPhaseInPlayer(P.t1)
    key('l')
    expect(usePlayerStore.getState().mode).toBe('play')
    playPause()
    showPhaseInPlayer(P.t3b)
    usePlayerStore.setState({ mode: 'play' })
    down({ x: 10, y: 10 })
    expect(usePlayerStore.getState().mode).toBe('edit')
    expect(useViewStore.getState().view).toBe(view)
  })
})

describe('player store (SPEC 7, D-010)', () => {
  it('enters playback with L and comes back to edit mode on a phase selection', () => {
    showPhaseInPlayer(P.t1)
    key('l')
    expect(usePlayerStore.getState()).toMatchObject({ mode: 'play' })
    expect(usePlayerStore.getState().transport.playing).toBe(true)
    playPause()
    showPhaseInPlayer(P.t3b)
    expect(usePlayerStore.getState().mode).toBe('edit')
    expect(usePlayerStore.getState().transport.line).toEqual([P.t1, P.t2, P.t3b])
  })

  it('a click on the field during playback returns to edit mode without editing', () => {
    usePlayerStore.setState({ mode: 'play' })
    const before = current()
    key('a')
    down({ x: 10, y: 10 })
    expect(usePlayerStore.getState().mode).toBe('edit')
    expect(current()).toBe(before)
  })
})

describe('library list (SPEC 8.7)', () => {
  it('searches without accents, filters by category and sorts by name or date', () => {
    const summaries = [
      {
        id: '1',
        name: 'Sautée',
        category: 'phasePlay' as const,
        updatedAt: '2026-01-02',
        fileName: null,
        readOnly: false,
      },
      {
        id: '2',
        name: 'Croisée',
        category: 'scrum' as const,
        updatedAt: '2026-01-03',
        fileName: null,
        readOnly: false,
      },
      {
        id: '3',
        name: 'Atelier',
        category: 'drill' as const,
        updatedAt: '2026-01-01',
        fileName: null,
        readOnly: false,
      },
    ]
    const base = { summaries, search: '', category: 'all' as const, sort: 'date' as const }
    expect(visibleSummaries(base).map((s) => s.id)).toEqual(['2', '1', '3'])
    expect(visibleSummaries({ ...base, sort: 'name' }).map((s) => s.id)).toEqual(['3', '2', '1'])
    expect(visibleSummaries({ ...base, search: 'croisee' }).map((s) => s.id)).toEqual(['2'])
    expect(visibleSummaries({ ...base, category: 'drill' }).map((s) => s.id)).toEqual(['3'])
  })
})

vi.stubGlobal('localStorage', undefined)
