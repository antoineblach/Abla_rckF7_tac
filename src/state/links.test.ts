// Editor flows of lot 3 bis (D-106, D-108, D-109, D-114): a click on a run line selects its
// segment, keys 1 2 3 0, « Caler sur… » with its refusals and Escape, point carrying a link
// removed with a message, « Finit lancée » laid by the run tool in the same undo step.
import { beforeEach, describe, expect, it } from 'vitest'
import type { Hit } from '../editor/hitTest'
import { actionsSelection, waypointSelection } from '../editor/selection'
import type { Id, Play, RunAction } from '../model/types'
import { P, sevenVsSevenWithOptions, uuid } from '../test/builders'
import {
  cancelSyncPick,
  editorContextMenu,
  editorPointerDown,
  handleKey,
  startSyncPick,
  useInteractionStore,
} from './editorActions'
import {
  openPlay,
  selectPhase,
  setSelection,
  setTool,
  undoEdit,
  useEditorStore,
} from './editorStore'
import { usePlayerStore } from './playerStore'

const RUN_A4 = uuid(200)
const RUN_A5 = uuid(201)

const key = (k: string, code?: string) =>
  handleKey({ key: k, ...(code ? { code } : {}), ctrl: false, shift: false, alt: false })
const down = (hit: Hit, pos = { x: 0, y: 0 }) => {
  editorPointerDown({ pos, hit, shift: false })
}
const current = (): Play => {
  const play = useEditorStore.getState().play
  if (!play) throw new Error('no play')
  return play
}
const runOf = (id: Id): RunAction => {
  const action = current()
    .phases.flatMap((p) => p.actions)
    .find((a) => a.id === id)
  if (action?.type !== 'run') throw new Error(`no run ${id}`)
  return action
}

beforeEach(() => {
  openPlay(sevenVsSevenWithOptions(), null, false)
  setTool('select')
  usePlayerStore.setState({ mode: 'edit' })
  useInteractionStore.setState({ metersPerPx: 0 })
})

describe('segments and speed keys (D-114)', () => {
  it('selects the segment under the pointer, then 3 and 0 set and clear its speed', () => {
    down({ kind: 'run', actionId: RUN_A4, segment: 1 })
    expect(useEditorStore.getState().selection.segment).toEqual({ actionId: RUN_A4, index: 1 })
    expect(key('3')).toBe(true)
    expect(runOf(RUN_A4).waypoints[1]?.speed).toBe('sprint')
    // AZERTY: the key 0 without Shift gives « à ».
    expect(key('à', 'Digit0')).toBe(true)
    expect(runOf(RUN_A4).waypoints[1]?.speed).toBeUndefined()
    undoEdit()
    expect(runOf(RUN_A4).waypoints[1]?.speed).toBe('sprint')
  })

  it('a selected point designates the segment that arrives at it', () => {
    setSelection(waypointSelection(RUN_A4, 0))
    key('1')
    expect(runOf(RUN_A4).waypoints[0]?.speed).toBe('walk')
  })

  it('without a segment, 1 2 3 set the pace of the selected runs, 0 does nothing', () => {
    setSelection(actionsSelection([RUN_A4, RUN_A5]))
    expect(key('&', 'Digit1')).toBe(true)
    expect([runOf(RUN_A4).pace, runOf(RUN_A5).pace]).toEqual(['walk', 'walk'])
    expect(key('0')).toBe(false)
    setSelection(actionsSelection([uuid(202)]))
    expect(key('3')).toBe(false)
  })
})

describe('« Caler sur… » (D-109)', () => {
  it('links the selected run to the clicked action, in one undo step', () => {
    setSelection(actionsSelection([RUN_A5]))
    expect(startSyncPick()).toBe(true)
    expect(useEditorStore.getState().syncPick).toEqual({ runId: RUN_A5 })
    // A click on the run itself is refused and keeps waiting.
    down({ kind: 'run', actionId: RUN_A5, segment: 0 })
    expect(useEditorStore.getState().notice).toBe('syncSelf')
    expect(useEditorStore.getState().syncPick).not.toBeNull()
    down({ kind: 'run', actionId: RUN_A4, segment: 0 })
    expect(useEditorStore.getState().syncPick).toBeNull()
    expect(runOf(RUN_A5).sync).toEqual({
      target: { actionId: RUN_A4, event: 'runEnd' },
      adjust: 'delay',
    })
    expect(useEditorStore.getState().selection.actions).toEqual([RUN_A5])
    undoEdit()
    expect(runOf(RUN_A5).sync).toBeUndefined()
  })

  it('meets at the selected point, refuses a loop, and Escape cancels', () => {
    setSelection(waypointSelection(RUN_A5, 0))
    startSyncPick()
    down({ kind: 'waypoint', actionId: RUN_A4, index: 1 })
    expect(runOf(RUN_A5).sync).toEqual({
      target: { actionId: RUN_A4, event: 'runEnd' },
      adjust: 'delay',
      at: 0,
    })
    setSelection(actionsSelection([RUN_A4]))
    startSyncPick()
    down({ kind: 'run', actionId: RUN_A5, segment: 1 })
    expect(useEditorStore.getState().notice).toBe('syncCycle')
    expect(runOf(RUN_A4).sync).toBeUndefined()
    key('Escape')
    expect(useEditorStore.getState().syncPick).toBeNull()
  })

  it('needs one run selected alone; a tool or a phase change ends it', () => {
    setSelection(actionsSelection([RUN_A4, RUN_A5]))
    expect(startSyncPick()).toBe(false)
    setSelection(actionsSelection([uuid(202)]))
    expect(startSyncPick()).toBe(false)
    setSelection(actionsSelection([RUN_A5]))
    startSyncPick()
    setTool('run')
    expect(useEditorStore.getState().syncPick).toBeNull()
    setTool('select')
    setSelection(actionsSelection([RUN_A5]))
    startSyncPick()
    selectPhase(P.t2)
    expect(useEditorStore.getState().syncPick).toBeNull()
    setSelection(actionsSelection([RUN_A5]))
    startSyncPick()
    cancelSyncPick()
    expect(useEditorStore.getState().syncPick).toBeNull()
  })

  it('refuses in a read-only play', () => {
    openPlay(sevenVsSevenWithOptions(), null, true)
    setSelection(actionsSelection([RUN_A5]))
    expect(startSyncPick()).toBe(false)
    expect(useEditorStore.getState().notice).toBe('readOnly')
  })
})

describe('point carrying a link, run tool (D-106, D-108)', () => {
  it('removes the link of a deleted point with a message', () => {
    setSelection(waypointSelection(RUN_A5, 0))
    startSyncPick()
    down({ kind: 'run', actionId: RUN_A4, segment: 0 })
    editorContextMenu({ kind: 'waypoint', actionId: RUN_A5, index: 0 })
    expect(runOf(RUN_A5).sync).toBeUndefined()
    expect(useEditorStore.getState().notice).toBe('syncLinkRemoved')
  })

  it('lays « Finit lancée » on the prolonged run in the same undo step as the new run', () => {
    selectPhase(P.t2)
    key('r')
    down({ kind: 'player', id: P.A(5) })
    down(null, { x: 55, y: 52 })
    key('Enter')
    expect(runOf(RUN_A5).endsAtSpeed).toBe(true)
    const runs = current()
      .phases.find((p) => p.id === P.t2)
      ?.actions.filter((a) => a.type === 'run')
    expect(runs).toHaveLength(2)
    undoEdit()
    expect(runOf(RUN_A5).endsAtSpeed).toBeUndefined()
    expect(
      current()
        .phases.find((p) => p.id === P.t2)
        ?.actions.filter((a) => a.type === 'run'),
    ).toHaveLength(1)
  })
})
