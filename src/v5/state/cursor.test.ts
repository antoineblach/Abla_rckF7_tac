// The field at the cursor (SPEC 6.3, D-141, D-142, D-145, D-146, D-172): transport and editor
// together, line and cursor of a play, selection that shows its action, list and overlay.
import { beforeEach, describe, expect, it } from 'vitest'
import type { Hit } from '../editor/hitTest'
import { EMPTY_SELECTION, type Selection } from '../../editor/selection'
import { evaluate, lineSchematic, windowSchematic } from '../engine/evaluate'
import { compileLine } from '../engine/timeline'
import { defaultSettings } from '../../model/settings'
import type { Id, Play } from '../model/types'
import {
  basePlay,
  branch,
  breakdown,
  kick,
  P,
  player,
  realisticRunsPlay,
  ROOT_BRANCH,
  run,
  sevenVsSevenWithOptions,
  speedsPlay,
  SPEEDS,
  uuid,
} from '../test/builders'
import {
  currentHoverSchematic,
  currentSchematic,
  editorPointerDown,
  editorPointerMove,
  editorPointerUp,
  handleKey,
  selectListedAction,
  useInteractionStore,
} from './editorActions'
import {
  applyEdit,
  markSaved,
  openPlay,
  reloadPlay,
  setSelection,
  setTool,
  useEditorStore,
} from './editorStore'
import { buildOverlay, hoverOverlay } from './overlay'
import {
  backToBranchPointInPlayer,
  chooseOptionInPlayer,
  currentCursor,
  nextEdgeInPlayer,
  playPause,
  previousEdgeInPlayer,
  seekPlayer,
  showLineInPlayer,
  tickPlayer,
  timingOf,
  usePlayerStore,
} from './playerStore'
import {
  actionReportOf,
  actionsInProgress,
  findAction,
  kickLanding,
  lineChoices,
  lineReportOf,
  playerName,
  playIssues,
  runDuration,
  teammatesOf,
} from './selectors'
import { appCaches, currentEngineSettings } from './settingsStore'

const SETTINGS = defaultSettings()
const OPT_A = [P.root, P.optA]
const OPT_B = [P.root, P.optB]
/** The branch point of the 7 v 7 scenario. */
const BRANCH_AT = 6.335
const RUN_A4 = uuid(200)
const RUN_A6_A = uuid(220)

const transport = () => usePlayerStore.getState().transport
const down = (pos: { x: number; y: number }, hit: Hit = null, shift = false) => {
  editorPointerDown({ pos, hit, shift })
}
const key = (k: string) => handleKey({ key: k, ctrl: false, shift: false, alt: false })
const current = (): Play => {
  const play = useEditorStore.getState().play
  if (!play) throw new Error('no play')
  return play
}

beforeEach(() => {
  openPlay(sevenVsSevenWithOptions(), null, false)
  setTool('select')
  useInteractionStore.setState({ metersPerPx: 0, cursor: null, hoveredActionId: null })
})

describe('line and cursor of the open play (D-141)', () => {
  it('opens on the default line at t = 0, again for the same play', () => {
    expect(transport()).toMatchObject({ line: OPT_A, t: 0, playing: false, waitingAt: null })
    showLineInPlayer(OPT_B)
    seekPlayer(3)
    openPlay(current(), null, false)
    expect(transport()).toMatchObject({ line: OPT_A, t: 0 })
    useEditorStore.setState({ play: null, openCount: useEditorStore.getState().openCount + 1 })
    expect(transport().line).toEqual([])
  })

  it('keeps the line and the cursor over a save and an edit', () => {
    showLineInPlayer(OPT_B)
    seekPlayer(3)
    const play = current()
    applyEdit((p) => ({ ...p, notes: 'x' }))
    markSaved({ play: current(), fileName: null, version: null }, current())
    expect(transport()).toMatchObject({ line: OPT_B, t: 3 })
    expect(current()).not.toBe(play)
  })

  it('replaces a line that no longer holds, completes one that goes on, after a reload', () => {
    showLineInPlayer(OPT_B)
    const play = current()
    reloadPlay(
      {
        ...play,
        branches: [branch(ROOT_BRANCH, null)],
        actions: [],
        sequences: [],
      },
      null,
    )
    expect(transport().line).toEqual([P.root])
    reloadPlay(play, null)
    expect(transport().line).toEqual(OPT_A)
  })

  it('brings the cursor back within the duration when the line gets shorter', () => {
    const play = basePlay({
      entities: [player(P.A(1), 'A', 1)],
      setup: { positions: { [P.A(1)]: { x: 40, y: 30 } }, ballCarrierId: null, ballPosition: null },
      actions: [
        run(uuid(1), P.A(1), [{ x: 50, y: 30 }]),
        run(uuid(2), P.A(1), [{ x: 60, y: 30 }], { start: 5 }),
      ],
    })
    openPlay(play, null, false)
    const { duration } = timingOf(play, transport().line)
    seekPlayer(duration)
    applyEdit((p) => ({ ...p, actions: p.actions.filter((a) => a.id !== uuid(2)) }))
    expect(transport().t).toBeLessThan(duration)
    expect(transport().t).toBe(timingOf(current(), transport().line).duration)
  })

  it('waits for the end of a gesture to do so: a drag does not lose the cursor', () => {
    openPlay(speedsPlay(), null, false)
    const { line } = transport()
    const { duration } = timingOf(current(), line)
    seekPlayer(duration)
    down({ x: 95, y: 30 }, { kind: 'waypoint', actionId: SPEEDS.RUN_FAST, index: 2 })
    // Shorter, then back: the cursor has not moved.
    editorPointerMove({ x: 72, y: 30 })
    expect(timingOf(current(), line).duration).toBeLessThan(duration)
    expect(transport().t).toBe(duration)
    editorPointerMove({ x: 95, y: 30 })
    editorPointerUp()
    expect(transport().t).toBe(timingOf(current(), line).duration)
  })
})

describe('actions at the cursor (SPEC 6.3)', () => {
  it('lays a new action in the branch of the line at t; at the branch point, the displayed option', () => {
    seekPlayer(1)
    key('p')
    down({ x: 0, y: 0 }, { kind: 'player', id: P.A(1) })
    down({ x: 0, y: 0 }, { kind: 'player', id: P.A(2) })
    expect(current().actions.at(-1)).toMatchObject({ branchId: P.root, start: 1 })
    showLineInPlayer(OPT_B)
    seekPlayer(BRANCH_AT)
    down({ x: 0, y: 0 }, { kind: 'player', id: P.A(1) })
    down({ x: 0, y: 0 }, { kind: 'player', id: P.A(2) })
    expect(current().actions.at(-1)).toMatchObject({ branchId: P.optB, start: BRANCH_AT })
  })

  it('moving the cursor drops the draft of a tool, which started from another instant', () => {
    key('r')
    down({ x: 0, y: 0 }, { kind: 'player', id: P.A(1) })
    expect(useEditorStore.getState().runDraft).not.toBeNull()
    seekPlayer(1)
    expect(useEditorStore.getState().runDraft).toBeNull()
    key('p')
    down({ x: 0, y: 0 }, { kind: 'player', id: P.A(1) })
    nextEdgeInPlayer()
    expect(useEditorStore.getState().passFromId).toBeNull()
  })

  it('a seek at the same instant keeps it', () => {
    key('r')
    down({ x: 0, y: 0 }, { kind: 'player', id: P.A(1) })
    seekPlayer(0)
    expect(useEditorStore.getState().runDraft).not.toBeNull()
  })

  it('shows the positions at t, the window in full and the earlier actions in grey', () => {
    seekPlayer(7)
    const schematic = currentSchematic()
    expect(schematic?.t).toBe(7)
    expect(schematic?.line).toEqual(OPT_A)
    expect(schematic?.runs.map((r) => r.actionId)).toContain(RUN_A6_A)
    expect(schematic?.earlierRuns.map((r) => r.actionId)).toContain(RUN_A4)
  })
})

describe('at rest, the field edits; during playback, it does not (SPEC 6.3, D-172)', () => {
  it('plays and pauses without a mode of its own', () => {
    playPause()
    expect(transport().playing).toBe(true)
    tickPlayer(1)
    expect(transport().t).toBe(1)
    playPause()
    expect(transport()).toMatchObject({ playing: false, t: 1 })
  })

  it('stops at the branch point, then an option goes on, and the button comes back to it', () => {
    playPause()
    tickPlayer(100)
    expect(transport()).toMatchObject({ playing: false, t: BRANCH_AT, waitingAt: P.root })
    chooseOptionInPlayer(P.optB)
    expect(transport()).toMatchObject({ playing: true, line: OPT_B, waitingAt: null })
    tickPlayer(1)
    backToBranchPointInPlayer()
    expect(transport()).toMatchObject({ playing: false, t: BRANCH_AT, waitingAt: P.root })
  })

  it('an edit stops the playback; a save or a reload does not', () => {
    playPause()
    markSaved({ play: current(), fileName: null, version: null }, current())
    expect(transport().playing).toBe(true)
    reloadPlay({ ...current(), notes: 'autre PC' }, null)
    expect(transport().playing).toBe(true)
    applyEdit((p) => ({ ...p, notes: 'x' }))
    expect(transport().playing).toBe(false)
  })
})

describe('edges of the blocks (D-146)', () => {
  it('jumps to the next and the previous edge at rest, without playing', () => {
    const { edges } = timingOf(current(), OPT_A)
    nextEdgeInPlayer()
    expect(transport()).toMatchObject({ t: edges[1], playing: false })
    nextEdgeInPlayer()
    expect(transport().t).toBe(edges[2])
    previousEdgeInPlayer()
    expect(transport().t).toBe(edges[1])
  })
})

describe('selection shows its action (SPEC 6.3, D-145)', () => {
  it('a line of an earlier interval brings the cursor to its start', () => {
    seekPlayer(7)
    down({ x: 44, y: 36 }, { kind: 'run', actionId: RUN_A4, segment: 0 })
    expect(transport().t).toBe(0)
    expect(useEditorStore.getState().selection.segment).toEqual({ actionId: RUN_A4, index: 0 })
  })

  it('the cursor stays when the action is in its interval', () => {
    seekPlayer(8)
    down({ x: 52, y: 60 }, { kind: 'run', actionId: RUN_A6_A, segment: 0 })
    expect(transport().t).toBe(8)
    seekPlayer(2)
    down({ x: 44, y: 36 }, { kind: 'pass', actionId: uuid(202) })
    expect(transport().t).toBe(2)
  })

  it('Shift removing an action does not move the cursor', () => {
    seekPlayer(7)
    setSelection({ ...EMPTY_SELECTION, actions: [RUN_A4] })
    down({ x: 44, y: 36 }, { kind: 'run', actionId: RUN_A4, segment: 0 }, true)
    expect(useEditorStore.getState().selection.actions).toEqual([])
    expect(transport().t).toBe(7)
  })

  it('a row of the list too; during playback, it pauses first', () => {
    seekPlayer(7)
    selectListedAction(RUN_A4)
    expect(transport().t).toBe(0)
    expect(useEditorStore.getState().selection.actions).toEqual([RUN_A4])
    seekPlayer(7)
    playPause()
    selectListedAction(RUN_A6_A)
    expect(transport()).toMatchObject({ playing: false, t: 7 })
  })

  it('a kick laid later than the cursor is shown once selected', () => {
    const play = realisticRunsPlay()
    openPlay(play, null, false)
    setTool('kick')
    // A7 is passed the ball later on: the kick is glued to that reception, out of the interval.
    down({ x: 0, y: 0 }, { kind: 'player', id: P.A(7) })
    down({ x: 80, y: 40 })
    const kick = current().actions.at(-1)
    if (kick?.type !== 'kick') throw new Error('no kick')
    expect(kick.startGlue?.targetId).toBe(uuid(513))
    expect(useEditorStore.getState().selection.actions).toEqual([kick.id])
    expect(currentCursor().t).toBeGreaterThan(0)
    expect(currentSchematic()?.kicks.map((k) => k.actionId)).toContain(kick.id)
  })
})

describe('list of the actions (D-145)', () => {
  it('gives every action of the line, sorted by start, in absolute instants', () => {
    const report = lineReportOf(current(), OPT_B, SETTINGS)
    const starts = report.rows.map((r) => r.start)
    expect(starts).toEqual([...starts].sort((a, b) => a - b))
    expect(report.rows.map((r) => r.actionId)).toEqual(
      expect.arrayContaining([RUN_A4, uuid(230), uuid(231)]),
    )
    expect(report.rows.map((r) => r.actionId)).not.toContain(RUN_A6_A)
    expect(actionReportOf(current(), OPT_B, uuid(231), SETTINGS)?.kind).toBe('pass')
    expect(actionReportOf(current(), OPT_B, RUN_A6_A, SETTINGS)).toBeNull()
  })

  it('marks the actions in progress at the cursor', () => {
    const report = lineReportOf(current(), OPT_A, SETTINGS)
    const row = report.rows.find((r) => r.actionId === RUN_A4)
    if (!row) throw new Error('no row')
    expect(actionsInProgress(report, row.start)).toContain(RUN_A4)
    expect(actionsInProgress(report, (row.start + row.end) / 2)).toContain(RUN_A4)
    expect(actionsInProgress(report, row.end)).not.toContain(RUN_A4)
  })
})

describe('selectors', () => {
  it('names the lines of the list « Ligne » by their options (D-142)', () => {
    expect(lineChoices(current())).toEqual([
      { line: OPT_A, label: 'Option A : Défense en retrait' },
      { line: OPT_B, label: 'Option B : Défense montée' },
    ])
    expect(lineChoices(basePlay())).toEqual([{ line: [ROOT_BRANCH], label: '' }])
  })

  it('merges the business and engine issues of every line, without duplicates', () => {
    const issues = playIssues(realisticRunsPlay(), SETTINGS)
    const keys = issues.map((i) => `${i.code}${JSON.stringify(i.target)}${i.key ?? ''}`)
    expect(new Set(keys).size).toBe(keys.length)
    const broken = { ...sevenVsSevenWithOptions(), sequences: [] }
    const withBad: Play = {
      ...broken,
      actions: [...broken.actions, run(uuid(990), uuid(991), [{ x: 1, y: 1 }])],
    }
    expect(playIssues(withBad, SETTINGS).map((i) => i.code)).toContain('missingEntity')
  })

  it('reads an action, its duration, a landing and the teammates', () => {
    const play = current()
    expect(findAction(play, RUN_A4)?.id).toBe(RUN_A4)
    expect(findAction(play, uuid(4242))).toBeNull()
    expect(runDuration(play, OPT_A, RUN_A4, SETTINGS)).toBeGreaterThan(0)
    expect(runDuration(play, OPT_A, uuid(202), SETTINGS)).toBeNull()
    expect(kickLanding(play, OPT_A, RUN_A4, SETTINGS)).toBeNull()
    expect(teammatesOf(play, P.A(4)).map((p) => p.number)).toEqual([1, 2, 3, 5, 6, 7])
    expect(teammatesOf(play, uuid(4242))).toEqual([])
    expect(playerName(play, P.B(3))).toBe('B 3')
    expect(playerName(play, uuid(4242))).toBe('?')
  })
})

describe('overlay at the cursor (SPEC 5.8, D-113)', () => {
  const selecting = (actions: Id[]): Selection => ({ ...EMPTY_SELECTION, actions })
  const line = [ROOT_BRANCH]
  const settings = () => currentEngineSettings()
  const overlayFor = (play: Play, selection: Selection, hoveredActionId: Id | null, t = 0) =>
    buildOverlay({
      play,
      schematic: windowSchematic(play, line, t, settings(), appCaches),
      hoverSchematic: lineSchematic(play, line, settings(), appCaches),
      selection,
      tool: 'select',
      runDraft: null,
      passFromId: null,
      kickFromId: null,
      placement: null,
      cursor: null,
      selectionBox: null,
      hoveredActionId,
    })

  it('draws a glue line when the glued block or its target is selected, and only then', () => {
    const play = speedsPlay()
    const link = windowSchematic(play, line, 0, settings(), appCaches).glueLinks[0]
    if (!link?.to) throw new Error('no glue line')
    const expected = [{ from: link.from, to: link.to }]
    expect(overlayFor(play, selecting([SPEEDS.RUN_LINKED]), null).glueLinks).toEqual(expected)
    expect(overlayFor(play, selecting([SPEEDS.RUN_WARNING]), null).glueLinks).toEqual(expected)
    expect(overlayFor(play, selecting([SPEEDS.RUN_FAST]), null).glueLinks).toEqual([])
    expect(overlayFor(play, EMPTY_SELECTION, null).glueLinks).toEqual([])
  })

  it('skips a glue line whose target has no point', () => {
    const play = current()
    const glued: Play = {
      ...play,
      actions: [
        ...play.actions,
        run(uuid(901), P.A(1), [{ x: 45, y: 5 }], {
          startGlue: { targetId: P.root, event: 'end' },
        }),
      ],
    }
    const schematic = windowSchematic(glued, OPT_A, BRANCH_AT, settings(), appCaches)
    expect(schematic.glueLinks.find((l) => l.ownerId === uuid(901))?.to).toBeNull()
    const overlay = buildOverlay({
      play: glued,
      schematic,
      hoverSchematic: schematic,
      selection: selecting([uuid(901)]),
      tool: 'select',
      runDraft: null,
      passFromId: null,
      kickFromId: null,
      placement: null,
      cursor: null,
      selectionBox: null,
      hoveredActionId: null,
    })
    expect(overlay.glueLinks).toEqual([])
  })

  it('halos the hovered action: the curve of a run, the segment of a pass', () => {
    const play = speedsPlay()
    expect(overlayFor(play, EMPTY_SELECTION, null).hover).toBeNull()
    const runHover = overlayFor(play, EMPTY_SELECTION, SPEEDS.RUN_FAST).hover
    expect(runHover?.paths).toHaveLength(1)
    expect(runHover?.paths[0]?.at(-1)).toEqual({ x: 95, y: 30 })
    const pass = windowSchematic(play, line, 0, settings(), appCaches).passes[0]
    const passHover = overlayFor(play, EMPTY_SELECTION, SPEEDS.PASS).hover
    expect(passHover?.paths).toEqual([[pass?.from, pass?.to]])
    expect(overlayFor(play, EMPTY_SELECTION, uuid(4242)).hover).toBeNull()
  })

  describe('schematic of the hover (SPEC 6.4, D-121, D-173)', () => {
    const RUN_A6 = uuid(210)
    const PASS_A5_A6 = uuid(211)
    const hoverAt = (t: number, actionId: Id, playing: boolean) => {
      showLineInPlayer(OPT_A)
      seekPlayer(t)
      if (playing) playPause()
      const schematic = currentHoverSchematic()
      if (!schematic) throw new Error('no schematic')
      return hoverOverlay(schematic, actionId).hover
    }
    const wholeRun = (actionId: Id) =>
      lineSchematic(current(), OPT_A, settings(), appCaches).runs.find(
        (r) => r.actionId === actionId,
      )

    it('at rest, halos a later action of the line, in full', () => {
      expect(hoverAt(1, RUN_A6_A, false)?.paths).toEqual([wholeRun(RUN_A6_A)?.points])
      expect(usePlayerStore.getState().transport.playing).toBe(false)
    })

    it('during playback, no halo for an action not drawn yet, even in the interval at t', () => {
      expect(hoverAt(1, RUN_A6_A, true)).toBeNull()
      const window = windowSchematic(current(), OPT_A, 1, settings(), appCaches)
      expect(window.runs.map((r) => r.actionId)).toContain(RUN_A6)
      playPause()
      expect(hoverAt(1, RUN_A6, true)).toBeNull()
    })

    it('during playback, halos an action of the scene, as far as it is drawn', () => {
      const hover = hoverAt(1, RUN_A4, true)
      const drawn = evaluate(current(), OPT_A, 1, settings(), appCaches).traces.find(
        (tr) => tr.actionId === RUN_A4,
      )
      expect(hover?.paths).toEqual([drawn?.points])
      expect(drawn?.points.length).toBeLessThan(wholeRun(RUN_A4)?.points.length ?? 0)
    })

    it('during playback, halos an earlier action drawn in grey, out of the window', () => {
      const window = windowSchematic(current(), OPT_A, BRANCH_AT + 1, settings(), appCaches)
      expect(window.runs.map((r) => r.actionId)).not.toContain(RUN_A4)
      expect(hoverAt(BRANCH_AT + 1, RUN_A4, true)?.paths).toHaveLength(1)
    })

    it('during playback, halos a pass from its release, up to the ball', () => {
      expect(hoverAt(3, PASS_A5_A6, true)).toBeNull()
      playPause()
      const scene = evaluate(current(), OPT_A, 4.05, settings(), appCaches)
      const trace = scene.passTraces.find((p) => p.actionId === PASS_A5_A6)
      expect(trace?.completed).toBe(false)
      expect(hoverAt(4.05, PASS_A5_A6, true)?.paths).toEqual([[trace?.from, trace?.to]])
    })

    it('during playback, halos a kick from its release', () => {
      const ID = uuid(902)
      const play = current()
      openPlay(
        {
          ...play,
          actions: [...play.actions, kick(ID, P.A(6), { point: { x: 90, y: 40 } }, 5)],
        },
        null,
        false,
      )
      expect(hoverAt(4.5, ID, true)).toBeNull()
      playPause()
      const scene = evaluate(current(), OPT_A, 5.2, settings(), appCaches)
      const trace = scene.kickTraces.find((k) => k.actionId === ID)
      expect(trace?.completed).toBe(false)
      expect(hoverAt(5.2, ID, true)?.paths).toEqual([[trace?.from, trace?.to]])
    })

    it('during playback, halos a breakdown only while it is on the field', () => {
      const ID = uuid(901)
      const play = current()
      openPlay(
        {
          ...play,
          actions: [
            ...play.actions.filter((a) => a.id !== uuid(202) && a.id !== PASS_A5_A6),
            breakdown(ID, P.A(4), P.A(5), P.A(3), 1),
          ],
        },
        null,
        false,
      )
      expect(hoverAt(0.5, ID, true)).toBeNull()
      playPause()
      const { end } = compileLine(current(), OPT_A, settings(), appCaches).breakdowns[0] ?? {}
      if (end === undefined) throw new Error('no breakdown')
      expect(hoverAt(1.1, ID, true)?.points).toHaveLength(1)
      playPause()
      expect(hoverAt(end + 0.1, ID, true)?.points ?? []).toEqual([])
      playPause()
      expect(hoverAt(0.5, ID, false)?.points).toHaveLength(1)
    })

    it('comes back to the whole line when the playback stops', () => {
      expect(hoverAt(1, RUN_A6, true)).toBeNull()
      playPause()
      const schematic = currentHoverSchematic()
      if (!schematic) throw new Error('no schematic')
      expect(hoverOverlay(schematic, RUN_A6).hover?.paths).toHaveLength(1)
    })
  })

  it('outlines a selected action of an earlier interval, without its handles', () => {
    const play = current()
    const schematic = windowSchematic(play, OPT_A, 7, settings(), appCaches)
    const overlay = buildOverlay({
      play,
      schematic,
      hoverSchematic: schematic,
      selection: selecting([RUN_A4]),
      tool: 'select',
      runDraft: null,
      passFromId: null,
      kickFromId: null,
      placement: null,
      cursor: null,
      selectionBox: null,
      hoveredActionId: null,
    })
    expect(overlay.selectedPaths).toHaveLength(1)
    expect(overlay.handles).not.toContainEqual({ x: 44, y: 36 })
  })
})
