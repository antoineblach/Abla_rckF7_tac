// Placements through the editor store (SPEC 10.1, 10.2, D-088, D-090, D-096): apply a preset by
// its anchor, save one, move and flip the whole play; one undo step each, Escape cancels.
import { beforeEach, describe, expect, it } from 'vitest'
import type { Hit } from '../editor/hitTest'
import { mirrorPlay, translatePlay } from '../editor/transform'
import { canonicalJson } from '../model/canonical'
import { isPlayer, type Play } from '../model/types'
import { lineoutPreset, P, sevenVsSevenWithOptions } from '../test/builders'
import {
  editorPointerDown,
  editorPointerMove,
  flipWholePlay,
  handleKey,
  setPresetAnchorHandler,
  startMovePlay,
  startPlacement,
  useInteractionStore,
} from './editorActions'
import {
  openPlay,
  selectPhase,
  setPlacementOpenSide,
  setSnap,
  setTool,
  useEditorStore,
} from './editorStore'
import { buildOverlay } from './overlay'
import { currentSchematic } from './editorActions'
import { usePlayerStore } from './playerStore'

const down = (pos: { x: number; y: number }, hit: Hit = null) => {
  editorPointerDown({ pos, hit, shift: false })
}
const current = (): Play => {
  const play = useEditorStore.getState().play
  if (!play) throw new Error('no play')
  return play
}
const escape = () => handleKey({ key: 'Escape', ctrl: false, shift: false, alt: false })
const past = () => useEditorStore.getState().history.past.length

function placed(play: Play, team: 'A' | 'B', number: number) {
  const entity = play.entities.find((e) => isPlayer(e) && e.team === team && e.number === number)
  return entity ? play.setup.positions[entity.id] : undefined
}

beforeEach(() => {
  openPlay(sevenVsSevenWithOptions(), null, false)
  setTool('select')
  setSnap(false)
  usePlayerStore.setState({ mode: 'edit' })
  useInteractionStore.setState({ metersPerPx: 0, cursor: null })
})

describe('applying a preset by its anchor (SPEC 10.1, D-088)', () => {
  it('lays the preset in one undo step, the first phase selected', () => {
    selectPhase(P.t2)
    startPlacement({ kind: 'applyPreset', preset: lineoutPreset(), openSide: 'auto' })
    expect(useEditorStore.getState().selectedPhaseId).toBe(P.t1)
    down({ x: 30.3, y: 2 })
    const play = current()
    expect(useEditorStore.getState().placement).toBeNull()
    expect(past()).toBe(1)
    expect(play.category).toBe('lineout')
    // A 2 throws in from the left touchline at x = 30, 0.5 m behind the mark.
    expect(placed(play, 'A', 2)).toEqual({ x: 29.5, y: -1 })
    expect(placed(play, 'B', 2)).toEqual({ x: 32, y: 2 })
    // Players not in the preset are unchanged.
    expect(placed(play, 'A', 7)).toEqual({ x: 40, y: 65 })
    expect(useEditorStore.getState().selectedPhaseId).toBe(P.t1)
    handleKey({ key: 'z', ctrl: true, shift: false, alt: false })
    expect(canonicalJson(current())).toBe(canonicalJson(sevenVsSevenWithOptions()))
  })

  it('ignores a click on a refused lineout anchor and keeps the placement going', () => {
    startPlacement({ kind: 'applyPreset', preset: lineoutPreset(), openSide: 'auto' })
    down({ x: 3, y: 1 })
    expect(useEditorStore.getState().placement?.kind).toBe('applyPreset')
    expect(past()).toBe(0)
  })

  it('follows the open side chosen in the banner', () => {
    const scrum = {
      ...lineoutPreset(),
      type: 'scrum' as const,
      positions: [{ role: 'attack' as const, number: 4, forward: 0, openSide: 10 }],
      ball: null,
    }
    startPlacement({ kind: 'applyPreset', preset: scrum, openSide: 'auto' })
    setPlacementOpenSide('left')
    down({ x: 50, y: 30 })
    expect(placed(current(), 'A', 4)).toEqual({ x: 50, y: 20 })
  })

  it('draws the ghost tokens and the anchor under the pointer', () => {
    startPlacement({ kind: 'applyPreset', preset: lineoutPreset(), openSide: 'auto' })
    editorPointerMove({ x: 30.3, y: 2 })
    const schematic = currentSchematic()
    if (!schematic) throw new Error('no schematic')
    const state = useEditorStore.getState()
    const overlay = buildOverlay({
      play: current(),
      schematic,
      selection: state.selection,
      tool: state.tool,
      runDraft: null,
      passFromId: null,
      kickFromId: null,
      placement: state.placement,
      cursor: useInteractionStore.getState().cursor,
      selectionBox: null,
      hoveredActionId: null,
    })
    expect(overlay.ghosts).toHaveLength(7)
    expect(overlay.ghosts[0]).toEqual({ pos: { x: 29.5, y: -1 }, team: 'A', label: '2' })
    expect(overlay.anchor?.pos).toEqual({ x: 30, y: 0 })
    expect(overlay.handles).toEqual([])
  })

  it('is cancelled by Escape and by another tool, without any change', () => {
    startPlacement({ kind: 'applyPreset', preset: lineoutPreset(), openSide: 'auto' })
    escape()
    expect(useEditorStore.getState().placement).toBeNull()
    startPlacement({ kind: 'applyPreset', preset: lineoutPreset(), openSide: 'auto' })
    handleKey({ key: 'r', ctrl: false, shift: false, alt: false })
    expect(useEditorStore.getState().placement).toBeNull()
    expect(useEditorStore.getState().tool).toBe('run')
    expect(past()).toBe(0)
  })
})

describe('saving a preset: the anchor click (SPEC 10.1)', () => {
  it('hands the content in the local frame to the preset session', () => {
    const received: unknown[] = []
    setPresetAnchorHandler((request, content) => {
      received.push({ request, content })
    })
    const request = {
      name: 'A seule',
      type: 'free' as const,
      playerIds: [P.A(4)],
      includeBall: true,
    }
    startPlacement({ kind: 'savePreset', request, openSide: 'right' })
    down({ x: 40, y: 35 })
    expect(received).toEqual([
      {
        request,
        content: {
          positions: [{ role: 'attack', number: 4, forward: 0, openSide: 0 }],
          ball: { forward: 0, openSide: 0, carrierRole: 'attack', carrierNumber: 4 },
        },
      },
    ])
    expect(useEditorStore.getState().placement).toBeNull()
    expect(past()).toBe(0)
  })
})

describe('moving and flipping the whole play (SPEC 10.2, D-090)', () => {
  it('moves by two clicks on the grid when it is on, as one undo step', () => {
    setSnap(true)
    startMovePlay()
    down({ x: 40.2, y: 35.4 })
    expect(useEditorStore.getState().placement).toEqual({
      kind: 'movePlay',
      from: { x: 40, y: 35 },
    })
    expect(past()).toBe(0)
    down({ x: 47.6, y: 30.2 })
    expect(useEditorStore.getState().placement).toBeNull()
    expect(past()).toBe(1)
    expect(current()).toEqual(translatePlay(sevenVsSevenWithOptions(), { x: 8, y: -5 }))
  })

  it('flips the play left-right in one undo step; twice gives it back', () => {
    flipWholePlay()
    expect(current()).toEqual(mirrorPlay(sevenVsSevenWithOptions()))
    expect(past()).toBe(1)
    flipWholePlay()
    expect(canonicalJson(current())).toBe(canonicalJson(sevenVsSevenWithOptions()))
  })

  it('refuses to move a read-only play', () => {
    openPlay(sevenVsSevenWithOptions(), null, true)
    startMovePlay()
    expect(useEditorStore.getState().placement).toBeNull()
    expect(useEditorStore.getState().notice).toBe('readOnly')
  })
})
