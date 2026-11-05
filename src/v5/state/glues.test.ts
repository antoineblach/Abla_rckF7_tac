// Editor flows on the glues and the segments (SPEC 5.8, 6.2, D-114, D-143, D-144): a click on a run
// line selects its segment, keys 1 2 3 0, runs laid at the cursor, edges frozen with a message.
import { beforeEach, describe, expect, it } from 'vitest'
import type { Hit } from '../editor/hitTest'
import { actionsSelection, waypointSelection } from '../../editor/selection'
import { defaultSettings } from '../../model/settings'
import type { Id, Play, RunAction } from '../model/types'
import { P, realisticRunsPlay, sevenVsSevenWithOptions, uuid } from '../test/builders'
import { compileLine } from '../engine/timeline'
import {
  editorContextMenu,
  editorPointerDown,
  handleKey,
  useInteractionStore,
} from './editorActions'
import { deleteSelection } from './editorActions'
import { openPlay, setSelection, setTool, undoEdit, useEditorStore } from './editorStore'
import { seekPlayer } from './playerStore'
import { playIssues } from './selectors'
import { appCaches, currentEngineSettings } from './settingsStore'

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
  const action = current().actions.find((a) => a.id === id)
  if (action?.type !== 'run') throw new Error(`no run ${id}`)
  return action
}
const endOf = (id: Id): number => {
  const line = [P.root, P.optA]
  const span = compileLine(current(), line, currentEngineSettings(), appCaches).blocks[id]
  if (!span) throw new Error(`no block ${id}`)
  return span.end
}

beforeEach(() => {
  openPlay(sevenVsSevenWithOptions(), null, false)
  setTool('select')
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

describe('runs laid by the tool (SPEC 6.2, D-144)', () => {
  /** Draws a run of A4 to a point, at the cursor. */
  const drawRun = (): void => {
    key('r')
    down({ kind: 'player', id: P.A(4) })
    down(null, { x: 55, y: 52 })
    key('Enter')
  }
  const added = (): RunAction => {
    const action = current().actions.at(-1)
    if (action?.type !== 'run') throw new Error('no new run')
    return action
  }

  it('glues the new run to the previous one when the cursor is on its end, in one undo step', () => {
    seekPlayer(endOf(RUN_A4))
    const before = current()
    drawRun()
    expect(added()).toMatchObject({
      entityId: P.A(4),
      startGlue: { targetId: RUN_A4, event: 'end' },
    })
    expect(useEditorStore.getState().history.past).toHaveLength(1)
    undoEdit()
    expect(current()).toBe(before)
  })

  it('lays it at the cursor, not glued, elsewhere', () => {
    const t = endOf(RUN_A4) + 1
    seekPlayer(t)
    drawRun()
    expect(added().start).toBe(t)
    expect(added().startGlue).toBeUndefined()
  })

  it('during a run of hers, the fallback of SPEC 4.3 delays it, with its alert', () => {
    const t = endOf(RUN_A4) / 2
    seekPlayer(t)
    drawRun()
    expect(added().start).toBe(t)
    expect(added().startGlue).toBeUndefined()
    const delayed = playIssues(current(), defaultSettings()).find(
      (i) =>
        i.code === 'runStartDelayed' && i.target.kind === 'action' && i.target.id === added().id,
    )
    expect(delayed?.params?.delay).toBeGreaterThan(0)
  })
})

describe('edges frozen by a removal (SPEC 5.8)', () => {
  const RUN4 = uuid(500)
  const RUN2 = uuid(502)
  const GLUED_START = uuid(510)

  beforeEach(() => {
    openPlay(realisticRunsPlay(), null, false)
  })

  it('removing the target freezes the edge at its value, with a message, in one undo step', () => {
    const before = current()
    setSelection(actionsSelection([RUN4]))
    deleteSelection()
    expect(useEditorStore.getState().notice).toBe('edgeFrozen')
    expect(current().actions.some((a) => a.id === RUN4)).toBe(false)
    expect(runOf(GLUED_START).startGlue).toBeUndefined()
    expect(useEditorStore.getState().history.past).toHaveLength(1)
    undoEdit()
    expect(current()).toBe(before)
  })

  it('removing a point that is a target too, by the right click and by Suppr', () => {
    editorContextMenu({ kind: 'waypoint', actionId: RUN4, index: 0 })
    expect(useEditorStore.getState().notice).toBe('edgeFrozen')
    expect(runOf(RUN2).endGlue).toBeUndefined()
    undoEdit()
    setSelection(waypointSelection(RUN4, 0))
    deleteSelection()
    expect(useEditorStore.getState().notice).toBe('edgeFrozen')
    expect(runOf(RUN2).endGlue).toBeUndefined()
  })

  it('says nothing when nothing is frozen', () => {
    setSelection(actionsSelection([uuid(503)]))
    deleteSelection()
    expect(useEditorStore.getState().notice).toBeNull()
  })
})
