// Interactions of lot 3 through the editor store: kick and breakdown tools (D-081, D-093), drag
// of a kick target point and of the ball on the ground (D-083), forward pass layer (D-085).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Hit } from '../editor/hitTest'
import type { BreakdownAction, KickAction, Play } from '../model/types'
import { P, phase, run, setPiecesPlay, sevenVsSevenWithOptions, uuid } from '../test/builders'
import {
  editorPointerDown,
  editorPointerMove,
  editorPointerUp,
  handleKey,
  useInteractionStore,
} from './editorActions'
import { openPlay, selectPhase, setTool, useEditorStore } from './editorStore'
import { setLayer, usePlayerStore } from './playerStore'

const down = (pos: { x: number; y: number }, hit: Hit = null) => {
  editorPointerDown({ pos, hit, shift: false })
}
const current = (): Play => {
  const play = useEditorStore.getState().play
  if (!play) throw new Error('no play')
  return play
}
const actions = () => current().phases.flatMap((p) => p.actions)

function contactPlay(): Play {
  const play = sevenVsSevenWithOptions()
  return {
    ...play,
    phases: [
      phase(P.t1, null, [run(uuid(400), P.A(4), [{ x: 46, y: 36 }], { durationOverride: 1.5 })]),
    ],
  }
}

beforeEach(() => {
  openPlay(contactPlay(), null, false)
  setTool('select')
  usePlayerStore.setState({ mode: 'edit' })
  useInteractionStore.setState({ metersPerPx: 0 })
})

describe('kick tool (J)', () => {
  it('kicks to a point in two clicks and selects the kick', () => {
    expect(handleKey({ key: 'j', ctrl: false, shift: false, alt: false })).toBe(true)
    expect(useEditorStore.getState().tool).toBe('kick')
    down({ x: 40, y: 35 }, { kind: 'player', id: P.A(4) })
    expect(useEditorStore.getState().kickFromId).toBe(P.A(4))
    down({ x: 80, y: 20 })
    const kick = actions().find((a): a is KickAction => a.type === 'kick')
    expect(kick).toMatchObject({ kickerId: P.A(4), target: { point: { x: 80, y: 20 } } })
    expect(useEditorStore.getState().selection.actions).toEqual([kick?.id])
    expect(useEditorStore.getState().kickFromId).toBeNull()
  })

  it('kicks to a receiver, and Escape cancels a kick in progress', () => {
    setTool('kick')
    down({ x: 40, y: 35 }, { kind: 'player', id: P.A(4) })
    handleKey({ key: 'Escape', ctrl: false, shift: false, alt: false })
    expect(useEditorStore.getState().kickFromId).toBeNull()
    down({ x: 40, y: 35 }, { kind: 'player', id: P.A(4) })
    down({ x: 50, y: 35 }, { kind: 'player', id: P.B(4) })
    expect(actions().find((a) => a.type === 'kick')).toMatchObject({
      target: { receiverId: P.B(4) },
    })
  })
})

describe('breakdown tool (G)', () => {
  it('lays a ruck on the carrier with the proposed support and relayer', () => {
    handleKey({ key: 'g', ctrl: false, shift: false, alt: false })
    down({ x: 40, y: 35 }, { kind: 'player', id: P.A(4) })
    const ruck = actions().find((a): a is BreakdownAction => a.type === 'breakdown')
    expect(ruck).toMatchObject({
      tackledId: P.A(4),
      supportId: P.A(5),
      relayerId: P.A(3),
      delay: 1.5,
    })
    expect(useEditorStore.getState().selection.actions).toEqual([ruck?.id])
    expect(useEditorStore.getState().history.past).toHaveLength(1)
  })

  it('refuses a player without the ball with a notice, and changes nothing', () => {
    setTool('breakdown')
    down({ x: 40, y: 5 }, { kind: 'player', id: P.A(1) })
    expect(useEditorStore.getState().notice).toBe('breakdownNoBall')
    expect(actions().some((a) => a.type === 'breakdown')).toBe(false)
    expect(useEditorStore.getState().history.past).toHaveLength(0)
  })
})

describe('dragging lot 3 handles', () => {
  it('drags the target point of a kick as one undo step', () => {
    openPlay(setPiecesPlay(), null, false)
    selectPhase(P.t3a)
    setTool('select')
    down({ x: 75, y: 12 }, { kind: 'kickTarget', actionId: uuid(420) })
    editorPointerMove({ x: 76, y: 13 })
    editorPointerMove({ x: 78, y: 14 })
    editorPointerUp()
    const kick = actions().find((a): a is KickAction => a.type === 'kick' && a.id === uuid(420))
    expect(kick?.target).toEqual({ point: { x: 78, y: 14 } })
    expect(useEditorStore.getState().history.past).toHaveLength(1)
  })

  it('drags the ball on the ground at the start in the first phase only', () => {
    openPlay(setPiecesPlay(), null, false)
    selectPhase(P.t1)
    down({ x: 40.5, y: 35 }, { kind: 'ball' })
    editorPointerMove({ x: 43, y: 33 })
    editorPointerUp()
    expect(current().setup.ballPosition).toEqual({ x: 43, y: 33 })
    selectPhase(P.t2)
    down({ x: 43, y: 33 }, { kind: 'ball' })
    expect(useEditorStore.getState().notice).toBe('inheritedPosition')
  })

  it('selects kicks and breakdowns with the selection tool', () => {
    openPlay(setPiecesPlay(), null, false)
    selectPhase(P.t1)
    down({ x: 46, y: 38 }, { kind: 'breakdown', actionId: uuid(402) })
    expect(useEditorStore.getState().selection.actions).toEqual([uuid(402)])
  })
})

describe('forward pass layer (D-085)', () => {
  it('is on by default and remembered per computer', () => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value)
      },
    })
    try {
      expect(usePlayerStore.getState().layers.forwardPass).toBe(true)
      setLayer('forwardPass', false)
      expect(usePlayerStore.getState().layers.forwardPass).toBe(false)
      const saved = JSON.parse(data.get('abla-rck7:prefs') ?? '{}') as {
        layers?: { forwardPass?: boolean }
      }
      expect(saved.layers?.forwardPass).toBe(false)
      setLayer('forwardPass', true)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
