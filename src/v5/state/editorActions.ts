// Interactions of the field canvas and keyboard shortcuts (SPEC 6.2, 6.3, D-009, D-010, D-015; lot 3
// bis: segments, speed keys, D-114; frise: the field edits the instant of the cursor, D-141).
// Positions arrive already converted to metres; the logic is delegated to editor/.
import { create } from 'zustand'
import { DRAG_THRESHOLD_PX, NUDGE_STEP, NUDGE_STEP_LARGE } from '../../config/defaults'
import type { Bounds } from '../engine/bounds'
import { windowSchematic, type WindowSchematic } from '../engine/evaluate'
import {
  addBreakdown,
  addKick,
  addPass,
  addPlayer,
  addRun,
  deleteActions,
  deletePlayers,
  deleteWaypoint,
  duplicatePlayers,
  moveBallPosition,
  moveKickTarget,
  moveSetupPositions,
  moveWaypoint,
  runAnchor,
  setSegmentSpeed,
  updateRun,
  type CommandContext,
} from '../editor/commands'
import { playersInBox, type Hit } from '../editor/hitTest'
import { placementClick, type PlacementMode, type SavePresetRequest } from '../editor/placementMode'
import {
  actionsSelection,
  playersSelection,
  selectAction,
  selectPlayer,
  selectPlayersInBox,
  segmentSelection,
  selectedSegment,
  waypointSelection,
  EMPTY_SELECTION,
} from '../../editor/selection'
import { shortcutFor, type KeyInput } from '../../editor/shortcuts'
import { maybeSnap } from '../../editor/snap'
import {
  spaceHeld,
  spaceStep,
  SPACE_UP,
  type SpaceEvent,
  type SpaceState,
} from '../../editor/spaceKey'
import { kickToolClick } from '../editor/tools/kickTool'
import { passToolClick } from '../editor/tools/passTool'
import { runToolClick, runToolFinish } from '../editor/tools/runTool'
import { mirrorPlay } from '../editor/transform'
import { randomIds } from '../../model/ids'
import type { PlacementPreset } from '../../model/preset'
import type { Id, Pace, Play, Vec2 } from '../model/types'
import {
  applyEdit,
  beginGesture,
  cancelGesture,
  creationValidated,
  endGesture,
  placementDropsCreation,
  previewGesture,
  redoEdit,
  setNotice,
  setPlacement,
  setSelection,
  setTool,
  undoEdit,
  useEditorStore,
  validateCreation,
} from './editorStore'
import {
  currentCursor,
  pausePlayer,
  playPause,
  seekPlayer,
  showActionInPlayer,
  usePlayerStore,
} from './playerStore'
import { appCaches, currentEngineSettings } from './settingsStore'
import { adjustView, type FitTarget } from './viewStore'

export interface InteractionState {
  cursor: Vec2 | null
  selectionBox: Bounds | null
  /** Action hovered in the list of the line, haloed on the field (D-113). */
  hoveredActionId: Id | null
  /** Space bar: short press plays or pauses, held with a drag pans (D-116). */
  space: SpaceState
  /** Converts a screen-space nudge (arrow keys) to a field vector; set by the canvas. */
  screenToField: (dx: number, dy: number) => Vec2
  /** Metres per CSS pixel of the canvas, for the drag threshold; set by the canvas. */
  metersPerPx: number
}

export const useInteractionStore = create<InteractionState>(() => ({
  cursor: null,
  selectionBox: null,
  hoveredActionId: null,
  space: SPACE_UP,
  screenToField: (dx, dy) => ({ x: dx, y: dy }),
  metersPerPx: 0,
}))

/** A space bar event (D-116): a short press without drag plays or pauses. */
export function spaceEvent(event: SpaceEvent): void {
  const step = spaceStep(useInteractionStore.getState().space, event)
  useInteractionStore.setState({ space: step.state })
  if (step.toggle) playPause()
}

/** True while the space bar is held: a drag pans the field. */
export function isSpaceHeld(): boolean {
  return spaceHeld(useInteractionStore.getState().space)
}

/** Called with the request to save now (Ctrl+S): set by the session. */
let saveRequest: () => void = () => undefined

export function setSaveRequest(handler: () => void): void {
  saveRequest = handler
}

type PresetAnchorHandler = (
  request: SavePresetRequest,
  content: Pick<PlacementPreset, 'positions' | 'ball'>,
) => void

/** Called with the content of a preset when its anchor is clicked: set by the preset session. */
let presetAnchorHandler: PresetAnchorHandler = () => undefined

export function setPresetAnchorHandler(handler: PresetAnchorHandler): void {
  presetAnchorHandler = handler
}

// `origin`: raw pointer position at the press; `started`: the pointer went past the drag
// threshold (D-051).
type Drag =
  | { kind: 'players'; ids: Id[]; grab: Vec2; origin: Vec2; started: boolean }
  | { kind: 'waypoint'; actionId: Id; index: number; origin: Vec2; started: boolean }
  | { kind: 'kickTarget'; actionId: Id; origin: Vec2; started: boolean }
  | { kind: 'ball'; origin: Vec2; started: boolean }
  | { kind: 'box'; origin: Vec2; additive: boolean }
  | null

let drag: Drag = null

export function commandContext(): CommandContext {
  return { ids: randomIds, settings: currentEngineSettings(), caches: appCaches }
}

/** The field at the cursor (SPEC 6.3). */
export function currentSchematic(): WindowSchematic | null {
  const { play } = useEditorStore.getState()
  if (!play) return null
  const { line, t } = currentCursor()
  return windowSchematic(play, line, t, currentEngineSettings(), appCaches)
}

/** Placements and the ball on the ground move only at t = 0 (SPEC 6.3, D-141). */
function atStart(): boolean {
  return currentCursor().t === 0
}

/** During playback, a click on the field comes back to editing at the cursor, nothing else. */
function leavePlayback(): boolean {
  if (!usePlayerStore.getState().transport.playing) return false
  pausePlayer()
  return true
}

/**
 * Click on a row of the list of the actions (D-113, D-145): selects the action, on the field and in
 * the inspector, and brings the cursor to it when it is out of its interval; during playback, back
 * to editing first.
 */
export function selectListedAction(actionId: Id): void {
  leavePlayback()
  selectShown(actionId)
}

/** Row of the list under the pointer: its action is haloed on the field (D-113). */
export function hoverListedAction(actionId: Id | null): void {
  if (useInteractionStore.getState().hoveredActionId !== actionId) {
    useInteractionStore.setState({ hoveredActionId: actionId })
  }
}

/** The action selected alone, its interval shown (SPEC 6.3). */
function selectShown(actionId: Id): void {
  setSelection(actionsSelection([actionId]))
  showActionInPlayer(actionId)
}

export interface PointerInput {
  pos: Vec2
  hit: Hit
  shift: boolean
}

export function editorPointerDown(input: PointerInput): void {
  if (leavePlayback()) return
  const state = useEditorStore.getState()
  const { play, tool, snap } = state
  if (!play) return
  const pos = maybeSnap(input.pos, snap)
  if (state.placement) {
    placementPointerDown(play, state.placement, pos)
    return
  }
  switch (tool) {
    case 'placeA':
    case 'placeB': {
      const team = tool === 'placeA' ? 'A' : 'B'
      applyEdit((p) => addPlayer(p, team, pos, commandContext()).play)
      return
    }
    case 'run': {
      const draft = runToolClick(state.runDraft, input.hit, pos, (entityId) =>
        runAnchor(play, currentCursor(), entityId, commandContext()),
      )
      useEditorStore.setState({ runDraft: draft })
      return
    }
    case 'pass': {
      const result = passToolClick(state.passFromId, input.hit)
      useEditorStore.setState({ passFromId: result.fromId })
      const commit = result.commit
      if (commit)
        applyEdit(
          (p) => addPass(p, currentCursor(), commit.fromId, commit.toId, commandContext()).play,
        )
      return
    }
    case 'kick': {
      const result = kickToolClick(state.kickFromId, input.hit, pos)
      useEditorStore.setState({ kickFromId: result.kickerId })
      const commit = result.commit
      if (commit) {
        const added = addKick(
          play,
          currentCursor(),
          commit.kickerId,
          commit.target,
          commandContext(),
        )
        const actionId = added.actionId
        if (actionId !== null) {
          applyEdit(() => added.play)
          selectShown(actionId)
        }
      }
      return
    }
    case 'breakdown': {
      // The marker is laid on the carrier; support and relayer are proposed (D-081).
      if (input.hit?.kind !== 'player') return
      const tackledId = input.hit.id
      const result = addBreakdown(play, currentCursor(), tackledId, commandContext())
      if (result.refused === 'noBall') setNotice('breakdownNoBall')
      else if (result.refused === 'teammates') setNotice('breakdownTeammates')
      const actionId = result.actionId
      if (actionId !== null) {
        applyEdit(() => result.play)
        selectShown(actionId)
      }
      return
    }
    case 'select':
      selectPointerDown(play, input, pos)
  }
}

/** A placement concerns the starting positions: the field shows them (D-096, D-147). */
function cursorToStart(): void {
  seekPlayer(0)
}

/** Starts a placement at t = 0, the selection tool active (D-096, D-147). */
export function startPlacement(mode: PlacementMode): void {
  // Another placement drops a new play still waiting for its anchor (D-101).
  if (placementDropsCreation()) {
    setPlacement(null)
    return
  }
  if (!useEditorStore.getState().play) return
  setTool('select')
  cursorToStart()
  setPlacement(mode)
}

/** Click during a placement: anchor of a preset, or start and end of a move (D-088, D-090). */
function placementPointerDown(play: Play, mode: PlacementMode, pos: Vec2): void {
  const step = placementClick(mode, play, pos, commandContext().ids)
  switch (step.kind) {
    case 'refused':
      return
    case 'continue':
      setPlacement(step.mode)
      return
    case 'edit': {
      // The anchor of a new play from a preset: the play is created now, and saved (D-101).
      const created = mode.kind === 'applyPreset' && validateCreation()
      setPlacement(null)
      applyEdit(() => step.play)
      if (mode.kind === 'applyPreset') cursorToStart()
      if (created) creationValidated()
      return
    }
    case 'save':
      if (mode.kind !== 'savePreset') return
      setPlacement(null)
      presetAnchorHandler(mode.request, step.content)
  }
}

/** « Déplacer la combinaison »: two clicks, start then end (D-090). */
export function startMovePlay(): void {
  const { play, readOnly } = useEditorStore.getState()
  if (!play) return
  if (readOnly) {
    setNotice('readOnly')
    return
  }
  startPlacement({ kind: 'movePlay', from: null })
}

/** « Retourner »: left-right symmetry of the whole play, one undo step (D-090). */
export function flipWholePlay(): void {
  applyEdit(mirrorPlay)
}

function selectPointerDown(play: Play, input: PointerInput, pos: Vec2): void {
  const { selection } = useEditorStore.getState()
  const hit = input.hit
  if (hit?.kind === 'waypoint') {
    setSelection(waypointSelection(hit.actionId, hit.index))
    drag = {
      kind: 'waypoint',
      actionId: hit.actionId,
      index: hit.index,
      origin: input.pos,
      started: false,
    }
    beginGesture()
    return
  }
  if (hit?.kind === 'kickTarget') {
    setSelection(actionsSelection([hit.actionId]))
    drag = { kind: 'kickTarget', actionId: hit.actionId, origin: input.pos, started: false }
    beginGesture()
    return
  }
  if (hit?.kind === 'ball') {
    // The ball on the ground at the start moves like a starting placement (D-009, D-083).
    if (!atStart()) {
      setNotice('placementAtStart')
      return
    }
    drag = { kind: 'ball', origin: input.pos, started: false }
    beginGesture()
    return
  }
  if (hit?.kind === 'player') {
    const keep = !input.shift && selection.players.includes(hit.id)
    const next = keep ? selection : selectPlayer(selection, hit.id, input.shift)
    setSelection(next)
    if (!next.players.includes(hit.id)) return
    if (!atStart()) {
      // The position of a player at t comes from her actions (D-009, D-141).
      setNotice('placementAtStart')
      return
    }
    const grab = play.setup.positions[hit.id]
    if (!grab) return
    drag = { kind: 'players', ids: next.players, grab, origin: input.pos, started: false }
    beginGesture()
    return
  }
  if (hit?.kind === 'run' && !input.shift) {
    // A click on the line of a run selects it with the segment under the pointer (D-114).
    setSelection(segmentSelection(hit.actionId, hit.segment))
    showActionInPlayer(hit.actionId)
    return
  }
  if (
    hit?.kind === 'run' ||
    hit?.kind === 'pass' ||
    hit?.kind === 'kick' ||
    hit?.kind === 'breakdown'
  ) {
    const next = selectAction(selection, hit.actionId, input.shift)
    setSelection(next)
    if (next.actions.includes(hit.actionId)) showActionInPlayer(hit.actionId)
    return
  }
  if (!input.shift) setSelection(EMPTY_SELECTION)
  drag = { kind: 'box', origin: pos, additive: input.shift }
  useInteractionStore.setState({ selectionBox: { min: pos, max: pos } })
}

export function editorPointerMove(raw: Vec2): void {
  const { snap } = useEditorStore.getState()
  useInteractionStore.setState({ cursor: maybeSnap(raw, snap) })
  if (!drag) return
  const current = drag
  if (current.kind !== 'box' && !current.started) {
    // A click shaking by a pixel or two must not move anything (D-051).
    const threshold = DRAG_THRESHOLD_PX * useInteractionStore.getState().metersPerPx
    if (Math.hypot(raw.x - current.origin.x, raw.y - current.origin.y) < threshold) return
    current.started = true
  }
  if (current.kind === 'players') {
    const target = maybeSnap(
      {
        x: current.grab.x + raw.x - current.origin.x,
        y: current.grab.y + raw.y - current.origin.y,
      },
      snap,
    )
    const delta = { x: target.x - current.grab.x, y: target.y - current.grab.y }
    previewGesture((start) => moveSetupPositions(start, current.ids, delta))
  } else if (current.kind === 'waypoint') {
    previewGesture((start) =>
      moveWaypoint(start, current.actionId, current.index, maybeSnap(raw, snap)),
    )
  } else if (current.kind === 'kickTarget') {
    previewGesture((start) => moveKickTarget(start, current.actionId, maybeSnap(raw, snap)))
  } else if (current.kind === 'ball') {
    previewGesture((start) => moveBallPosition(start, maybeSnap(raw, snap)))
  } else {
    useInteractionStore.setState({ selectionBox: { min: current.origin, max: raw } })
  }
}

export function editorPointerUp(): void {
  const current = drag
  drag = null
  if (!current) return
  if (current.kind === 'box') {
    const box = useInteractionStore.getState().selectionBox
    useInteractionStore.setState({ selectionBox: null })
    const schematic = currentSchematic()
    if (box && schematic && (box.max.x !== box.min.x || box.max.y !== box.min.y)) {
      const { selection } = useEditorStore.getState()
      setSelection(selectPlayersInBox(selection, playersInBox(schematic, box), current.additive))
    }
    return
  }
  endGesture()
}

export function editorPointerLeave(): void {
  useInteractionStore.setState({ cursor: null })
}

export function editorDoubleClick(): void {
  if (useEditorStore.getState().tool === 'run') finishRun()
}

/** Removes a waypoint; an edge glued to it stays at its value, with a message (SPEC 5.8). */
function removeWaypoint(actionId: Id, index: number): void {
  let frozen = 0
  applyEdit((p) => {
    const result = deleteWaypoint(p, actionId, index, commandContext())
    frozen = result.frozen
    return result.play
  })
  if (frozen > 0) setNotice('edgeFrozen')
}

/** Right click on a waypoint removes it (SPEC 6.2). */
export function editorContextMenu(hit: Hit): void {
  if (hit?.kind === 'waypoint') {
    removeWaypoint(hit.actionId, hit.index)
    setSelection(EMPTY_SELECTION)
  }
}

/** Ends the run tool: the run is laid at the cursor, glued to the previous one if it ends there. */
function finishRun(): void {
  const { runDraft } = useEditorStore.getState()
  const result = runToolFinish(runDraft)
  useEditorStore.setState({ runDraft: null })
  if (!result) return
  applyEdit(
    (p) => addRun(p, currentCursor(), result.entityId, result.waypoints, commandContext()).play,
  )
}

export function deleteSelection(): void {
  const { selection } = useEditorStore.getState()
  const waypoint = selection.waypoint
  if (waypoint) {
    removeWaypoint(waypoint.actionId, waypoint.index)
  } else {
    let frozen = 0
    applyEdit((p) => {
      const players = deletePlayers(p, selection.players, commandContext())
      const actions = deleteActions(players.play, selection.actions, commandContext())
      frozen = players.frozen + actions.frozen
      return actions.play
    })
    // An edge glued to what was removed stays at its value, with a message (SPEC 5.8).
    if (frozen > 0) setNotice('edgeFrozen')
  }
  setSelection(EMPTY_SELECTION)
}

/**
 * Keys 1, 2, 3 and 0 (D-114): speed of the selected segment (0: « Allure de la course »); without
 * a segment, 1, 2 and 3 set the pace of the selected runs. False when nothing applies.
 */
function applySpeedKey(speed: Pace | null): boolean {
  const { play, selection } = useEditorStore.getState()
  if (!play) return false
  const segment = selectedSegment(selection)
  if (segment) return applyEdit((p) => setSegmentSpeed(p, segment.actionId, segment.index, speed))
  if (speed === null) return false
  const runs = play.actions
    .filter((a) => a.type === 'run' && selection.actions.includes(a.id))
    .map((a) => a.id)
  if (runs.length === 0) return false
  return applyEdit((p) => runs.reduce((acc, id) => updateRun(acc, id, { pace: speed }), p))
}

function nudge(dx: number, dy: number): void {
  const { play, selection } = useEditorStore.getState()
  if (!play) return
  const delta = useInteractionStore.getState().screenToField(dx, dy)
  const waypoint = selection.waypoint
  if (waypoint) {
    const run = play.actions.find((a) => a.id === waypoint.actionId)
    const point = run?.type === 'run' ? run.waypoints[waypoint.index] : undefined
    if (point)
      applyEdit((p) =>
        moveWaypoint(p, waypoint.actionId, waypoint.index, {
          x: point.x + delta.x,
          y: point.y + delta.y,
        }),
      )
    return
  }
  if (selection.players.length === 0) return
  if (!atStart()) {
    setNotice('placementAtStart')
    return
  }
  applyEdit((p) => moveSetupPositions(p, selection.players, delta))
}

/** « Ajuster » (F) and « Zone utile »: fit the view on the saved view or the line (D-049). */
export function adjustViewTo(target: FitTarget): void {
  const play = useEditorStore.getState().play
  if (!play) return
  const { orientation, transport } = usePlayerStore.getState()
  adjustView(play, target, orientation, transport.line)
}

/** Keyboard shortcuts of SPEC 6.2. Returns true when the key was handled. */
export function handleKey(input: KeyInput): boolean {
  const command = shortcutFor(input, NUDGE_STEP, NUDGE_STEP_LARGE)
  if (!command) return false
  switch (command.kind) {
    case 'tool':
      setTool(command.tool)
      return true
    case 'delete':
      deleteSelection()
      return true
    case 'duplicate': {
      const { selection } = useEditorStore.getState()
      const created: Id[] = []
      applyEdit((p) => {
        const result = duplicatePlayers(p, selection.players, commandContext())
        created.push(...result.ids)
        return result.play
      })
      if (created.length > 0) setSelection(playersSelection(created))
      return true
    }
    case 'nudge':
      nudge(command.dx, command.dy)
      return true
    case 'playPause':
      playPause()
      return true
    case 'undo':
      undoEdit()
      return true
    case 'redo':
      redoEdit()
      return true
    case 'save':
      saveRequest()
      return true
    case 'finish':
      finishRun()
      return true
    case 'fit':
      adjustViewTo('saved')
      return true
    case 'speed':
      return applySpeedKey(command.speed)
    case 'cancel':
      cancelGesture()
      drag = null
      // Ends the placement; a new play still waiting for its anchor is dropped (D-101).
      if (useEditorStore.getState().placement) setPlacement(null)
      useEditorStore.setState({ runDraft: null, passFromId: null, kickFromId: null })
      useInteractionStore.setState({ selectionBox: null })
      setSelection(EMPTY_SELECTION)
      return true
  }
}
