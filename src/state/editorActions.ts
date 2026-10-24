// Interactions of the field canvas and keyboard shortcuts (SPEC 6.2, 6.3, D-009, D-010,
// D-015). Positions arrive already converted to metres; the logic is delegated to editor/.
import { create } from 'zustand'
import { DRAG_THRESHOLD_PX, NUDGE_STEP, NUDGE_STEP_LARGE } from '../config/defaults'
import type { Bounds } from '../engine/bounds'
import { phaseSchematic, type PhaseSchematic } from '../engine/evaluate'
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
  type CommandContext,
} from '../editor/commands'
import { playersInBox, type Hit } from '../editor/hitTest'
import { placementClick, type PlacementMode, type SavePresetRequest } from '../editor/placementMode'
import {
  selectAction,
  selectPlayer,
  selectPlayersInBox,
  EMPTY_SELECTION,
} from '../editor/selection'
import { shortcutFor, type KeyInput } from '../editor/shortcuts'
import { maybeSnap } from '../editor/snap'
import { kickToolClick } from '../editor/tools/kickTool'
import { passToolClick } from '../editor/tools/passTool'
import { runToolClick, runToolFinish } from '../editor/tools/runTool'
import { mirrorPlay } from '../editor/transform'
import { randomIds } from '../model/ids'
import { findPhase, rootPhase } from '../model/phaseTree'
import type { PlacementPreset } from '../model/preset'
import { phaseIndexAtTime } from '../player/transport'
import type { Id, Play, Vec2 } from '../model/types'
import {
  applyEdit,
  beginGesture,
  cancelGesture,
  creationValidated,
  endGesture,
  placementDropsCreation,
  previewGesture,
  redoEdit,
  selectPhase,
  setNotice,
  setPlacement,
  setSelection,
  setTool,
  undoEdit,
  useEditorStore,
  validateCreation,
} from './editorStore'
import {
  enterEditMode,
  playPause,
  showPhaseInPlayer,
  timingOf,
  usePlayerStore,
} from './playerStore'
import { appCaches, currentEngineSettings } from './settingsStore'
import { adjustView, type FitTarget } from './viewStore'

export interface InteractionState {
  cursor: Vec2 | null
  selectionBox: Bounds | null
  /** Action hovered in the list of the phase, haloed on the field (D-113). */
  hoveredActionId: Id | null
  /** Converts a screen-space nudge (arrow keys) to a field vector; set by the canvas. */
  screenToField: (dx: number, dy: number) => Vec2
  /** Metres per CSS pixel of the canvas, for the drag threshold; set by the canvas. */
  metersPerPx: number
}

export const useInteractionStore = create<InteractionState>(() => ({
  cursor: null,
  selectionBox: null,
  hoveredActionId: null,
  screenToField: (dx, dy) => ({ x: dx, y: dy }),
  metersPerPx: 0,
}))

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

export function currentSchematic(): PhaseSchematic | null {
  const { play, selectedPhaseId } = useEditorStore.getState()
  if (!play || !selectedPhaseId) return null
  return phaseSchematic(play, selectedPhaseId, currentEngineSettings(), appCaches)
}

function isRootSelected(play: Play, phaseId: Id | null): boolean {
  return phaseId !== null && findPhase(play, phaseId)?.parentId === null
}

/** During playback, a click on the field comes back to edit mode on the displayed phase. */
function leavePlayback(): boolean {
  const player = usePlayerStore.getState()
  if (player.mode !== 'play') return false
  const play = useEditorStore.getState().play
  if (play) {
    const timing = timingOf(play, player.transport.line)
    const phaseId = timing.phaseIds[phaseIndexAtTime(timing, player.transport.t)]
    if (phaseId) {
      selectPhase(phaseId)
      showPhaseInPlayer(phaseId)
      return true
    }
  }
  enterEditMode()
  return true
}

function anchorOf(play: Play, phaseId: Id, schematic: PhaseSchematic | null) {
  return (entityId: Id): Vec2 | undefined => {
    const existing = findPhase(play, phaseId)?.actions.find(
      (a) => a.type === 'run' && a.entityId === entityId,
    )
    if (existing?.type === 'run') return existing.waypoints[existing.waypoints.length - 1]
    return schematic?.players.find((p) => p.id === entityId)?.pos
  }
}

export interface PointerInput {
  pos: Vec2
  hit: Hit
  shift: boolean
}

export function editorPointerDown(input: PointerInput): void {
  if (leavePlayback()) return
  const state = useEditorStore.getState()
  const { play, selectedPhaseId, tool, snap } = state
  if (!play || !selectedPhaseId) return
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
      const draft = runToolClick(
        state.runDraft,
        input.hit,
        pos,
        anchorOf(play, selectedPhaseId, currentSchematic()),
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
          (p) => addPass(p, selectedPhaseId, commit.fromId, commit.toId, commandContext()).play,
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
          selectedPhaseId,
          commit.kickerId,
          commit.target,
          commandContext(),
        )
        const actionId = added.actionId
        if (actionId !== null) {
          applyEdit(() => added.play)
          setSelection({ players: [], actions: [actionId], waypoint: null })
        }
      }
      return
    }
    case 'breakdown': {
      // The marker is laid on the carrier; support and relayer are proposed (D-081).
      if (input.hit?.kind !== 'player') return
      const tackledId = input.hit.id
      const result = addBreakdown(play, selectedPhaseId, tackledId, commandContext())
      if (result.refused === 'noBall') setNotice('breakdownNoBall')
      else if (result.refused === 'teammates') setNotice('breakdownTeammates')
      const actionId = result.actionId
      if (actionId !== null) {
        applyEdit(() => result.play)
        setSelection({ players: [], actions: [actionId], waypoint: null })
      }
      return
    }
    case 'select':
      selectPointerDown(play, selectedPhaseId, input, pos)
  }
}

/** Shows the first phase in edit mode: a placement concerns the starting positions. */
function showRootPhase(play: Play): void {
  const root = rootPhase(play)
  if (!root) return
  selectPhase(root.id)
  showPhaseInPlayer(root.id)
}

/** Starts a placement on the first phase, the selection tool active (D-096). */
export function startPlacement(mode: PlacementMode): void {
  // Another placement drops a new play still waiting for its anchor (D-101).
  if (placementDropsCreation()) {
    setPlacement(null)
    return
  }
  const play = useEditorStore.getState().play
  if (!play) return
  setTool('select')
  showRootPhase(play)
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
      if (mode.kind === 'applyPreset') showRootPhase(play)
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

function selectPointerDown(play: Play, phaseId: Id, input: PointerInput, pos: Vec2): void {
  const { selection } = useEditorStore.getState()
  const hit = input.hit
  if (hit?.kind === 'waypoint') {
    setSelection({
      players: [],
      actions: [hit.actionId],
      waypoint: { actionId: hit.actionId, index: hit.index },
    })
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
    setSelection({ players: [], actions: [hit.actionId], waypoint: null })
    drag = { kind: 'kickTarget', actionId: hit.actionId, origin: input.pos, started: false }
    beginGesture()
    return
  }
  if (hit?.kind === 'ball') {
    // The ball on the ground at the start moves like a starting placement (D-009, D-083).
    if (!isRootSelected(play, phaseId)) {
      setNotice('inheritedPosition')
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
    if (!isRootSelected(play, phaseId)) {
      // Positions inherited from a previous phase never move (D-009).
      setNotice('inheritedPosition')
      return
    }
    const grab = play.setup.positions[hit.id]
    if (!grab) return
    drag = { kind: 'players', ids: next.players, grab, origin: input.pos, started: false }
    beginGesture()
    return
  }
  if (
    hit?.kind === 'run' ||
    hit?.kind === 'pass' ||
    hit?.kind === 'kick' ||
    hit?.kind === 'breakdown'
  ) {
    setSelection(selectAction(selection, hit.actionId, input.shift))
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

/** Right click on a waypoint removes it (SPEC 6.2). */
export function editorContextMenu(hit: Hit): void {
  if (hit?.kind === 'waypoint') {
    applyEdit((p) => deleteWaypoint(p, hit.actionId, hit.index))
    setSelection(EMPTY_SELECTION)
  }
}

function finishRun(): void {
  const { runDraft, selectedPhaseId } = useEditorStore.getState()
  const result = runToolFinish(runDraft)
  useEditorStore.setState({ runDraft: null })
  if (!result || !selectedPhaseId) return
  applyEdit(
    (p) => addRun(p, selectedPhaseId, result.entityId, result.waypoints, commandContext()).play,
  )
}

export function deleteSelection(): void {
  const { selection } = useEditorStore.getState()
  const waypoint = selection.waypoint
  if (waypoint) {
    applyEdit((p) => deleteWaypoint(p, waypoint.actionId, waypoint.index))
  } else {
    applyEdit((p) => deleteActions(deletePlayers(p, selection.players), selection.actions))
  }
  setSelection(EMPTY_SELECTION)
}

function nudge(dx: number, dy: number): void {
  const { play, selection, selectedPhaseId } = useEditorStore.getState()
  if (!play) return
  const delta = useInteractionStore.getState().screenToField(dx, dy)
  const waypoint = selection.waypoint
  if (waypoint) {
    const run = play.phases.flatMap((p) => p.actions).find((a) => a.id === waypoint.actionId)
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
  if (!isRootSelected(play, selectedPhaseId)) {
    setNotice('inheritedPosition')
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
      if (created.length > 0) setSelection({ players: created, actions: [], waypoint: null })
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
