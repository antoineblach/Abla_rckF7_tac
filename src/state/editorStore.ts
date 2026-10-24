// Editor state (Zustand): the open play, its history, selection, tool and drafts.
// Logic lives in editor/ and model/; this store only holds state and applies commands.
import { create } from 'zustand'
import { EMPTY_HISTORY, record, redo, undo, type History } from '../editor/history'
import type { PlacementMode } from '../editor/placementMode'
import type { OpenSideChoice } from '../editor/presets'
import type { SyncPick } from '../editor/syncPick'
import { EMPTY_SELECTION, pruneSelection, type Selection } from '../editor/selection'
import type { RunDraft } from '../editor/tools/runTool'
import type { ToolId } from '../editor/tools/types'
import type { VersionToken, PutResult } from '../io/LibraryStore'
import { findPhase, rootPhase } from '../model/phaseTree'
import type { Id, Play } from '../model/types'
import { resetView } from './viewStore'

export type EditorNotice =
  | 'inheritedPosition'
  | 'readOnly'
  | 'rootOption'
  | 'notLeaf'
  // Breakdown tool (D-081): no ball in the phase, fewer than two teammates.
  | 'breakdownNoBall'
  | 'breakdownTeammates'
  // Links (D-108, D-109): the run itself, a loop, a target that cannot apply, a link removed with
  // its point.
  | 'syncSelf'
  | 'syncCycle'
  | 'syncInvalid'
  | 'syncLinkRemoved'
  | null

export interface EditorState {
  play: Play | null
  /** Stored version the play started from (optimistic concurrency); null if never saved. */
  version: VersionToken | null
  dirty: boolean
  readOnly: boolean
  history: History
  gestureStart: Play | null
  selectedPhaseId: Id | null
  selection: Selection
  tool: ToolId
  runDraft: RunDraft | null
  passFromId: Id | null
  /** Kicker chosen by the kick tool, waiting for the receiver or the point (lot 3). */
  kickFromId: Id | null
  /** Placement in progress: preset applied or saved, play moved (lot 3, D-096). */
  placement: PlacementMode | null
  /** « Caler sur… » waiting for the click on the target (D-109). */
  syncPick: SyncPick | null
  /**
   * New play from a preset, never written until its placement is validated (D-101), with the play
   * open before it; null otherwise.
   */
  pendingCreation: { previousId: Id | null } | null
  snap: boolean
  notice: EditorNotice
}

const initial: EditorState = {
  play: null,
  version: null,
  dirty: false,
  readOnly: false,
  history: EMPTY_HISTORY,
  gestureStart: null,
  selectedPhaseId: null,
  selection: EMPTY_SELECTION,
  tool: 'select',
  runDraft: null,
  passFromId: null,
  kickFromId: null,
  placement: null,
  syncPick: null,
  pendingCreation: null,
  snap: false,
  notice: null,
}

export const useEditorStore = create<EditorState>(() => initial)

/** What follows the placement of a new play from a preset (D-101): set by the preset session. */
export interface CreationListeners {
  /** The anchor was validated: the new play is saved at once. */
  validated(): void
  /** The placement ended otherwise: the new play is dropped, the previous one opened again. */
  abandoned(previousId: Id | null): void
}

let creationListeners: CreationListeners = {
  validated: () => undefined,
  abandoned: () => undefined,
}

export function setCreationListeners(listeners: CreationListeners): void {
  creationListeners = listeners
}

/** Called after every local change (automatic save, draft): set by the session. */
let changeListener: () => void = () => undefined

export function setEditorChangeListener(listener: () => void): void {
  changeListener = listener
}

function idsOf(play: Play): { entities: Set<Id>; actions: Set<Id> } {
  return {
    entities: new Set(play.entities.map((e) => e.id)),
    actions: new Set(play.phases.flatMap((p) => p.actions.map((a) => a.id))),
  }
}

function withPlay(state: EditorState, play: Play): Partial<EditorState> {
  const { entities, actions } = idsOf(play)
  const selectedPhaseId =
    state.selectedPhaseId && findPhase(play, state.selectedPhaseId)
      ? state.selectedPhaseId
      : (rootPhase(play)?.id ?? null)
  return { play, selection: pruneSelection(state.selection, entities, actions), selectedPhaseId }
}

export function openPlay(
  play: Play,
  version: VersionToken | null,
  readOnly: boolean,
  dirty = false,
): void {
  useEditorStore.setState((state) => ({
    ...initial,
    tool: state.tool,
    snap: state.snap,
    play,
    version,
    readOnly,
    dirty,
    selectedPhaseId: rootPhase(play)?.id ?? null,
  }))
  // Opening a play is one of the actions that set the view (D-048).
  resetView()
}

export function closePlay(): void {
  useEditorStore.setState((state) => ({ ...initial, tool: state.tool, snap: state.snap }))
  resetView()
}

/**
 * Opens a new play from a preset without saving it (D-101): nothing is written until its
 * placement is validated; any other end of the placement drops it.
 */
export function openPendingPlay(play: Play, previousId: Id | null): void {
  openPlay(play, null, false)
  useEditorStore.setState({ pendingCreation: { previousId } })
}

/** True when ending the placement in progress would drop a new play (D-101). */
export function placementDropsCreation(): boolean {
  const state = useEditorStore.getState()
  return state.pendingCreation !== null && state.placement !== null
}

/** The new play is dropped, nothing written; the session opens the previous one again (D-101). */
function dropCreation(): void {
  const previousId = useEditorStore.getState().pendingCreation?.previousId ?? null
  closePlay()
  creationListeners.abandoned(previousId)
}

/** The anchor of the new play was validated: it becomes an ordinary play (D-101). */
export function validateCreation(): boolean {
  if (!useEditorStore.getState().pendingCreation) return false
  useEditorStore.setState({ pendingCreation: null })
  return true
}

/** Called once the validated placement is applied: the new play is saved at once (D-101). */
export function creationValidated(): void {
  creationListeners.validated()
}

/** Applies one editing step (one undo step). Returns false when nothing changed. */
export function applyEdit(fn: (play: Play) => Play): boolean {
  const state = useEditorStore.getState()
  if (!state.play) return false
  if (state.readOnly) {
    useEditorStore.setState({ notice: 'readOnly' })
    return false
  }
  const next = fn(state.play)
  if (next === state.play) return false
  useEditorStore.setState({
    ...withPlay(state, next),
    history: record(state.history, state.play),
    dirty: true,
    notice: null,
  })
  changeListener()
  return true
}

/** A gesture (drag) previews changes and counts as a single undo step (SPEC 6.3). */
export function beginGesture(): void {
  const state = useEditorStore.getState()
  if (!state.play || state.readOnly) return
  useEditorStore.setState({ gestureStart: state.play })
}

export function previewGesture(fn: (start: Play) => Play): void {
  const state = useEditorStore.getState()
  if (!state.gestureStart) return
  useEditorStore.setState({ play: fn(state.gestureStart) })
}

export function endGesture(): void {
  const state = useEditorStore.getState()
  const start = state.gestureStart
  if (!start || !state.play) return
  if (state.play === start) {
    useEditorStore.setState({ gestureStart: null })
    return
  }
  useEditorStore.setState({
    gestureStart: null,
    history: record(state.history, start),
    dirty: true,
  })
  changeListener()
}

export function cancelGesture(): void {
  const state = useEditorStore.getState()
  if (state.gestureStart) useEditorStore.setState({ play: state.gestureStart, gestureStart: null })
}

export function undoEdit(): void {
  const state = useEditorStore.getState()
  if (!state.play || state.readOnly) return
  const result = undo(state.history, state.play)
  if (!result) return
  useEditorStore.setState({ ...withPlay(state, result.play), history: result.history, dirty: true })
  changeListener()
}

export function redoEdit(): void {
  const state = useEditorStore.getState()
  if (!state.play || state.readOnly) return
  const result = redo(state.history, state.play)
  if (!result) return
  useEditorStore.setState({ ...withPlay(state, result.play), history: result.history, dirty: true })
  changeListener()
}

/** After a successful save: keeps changes made meanwhile (still dirty in that case). */
export function markSaved(result: PutResult, savedFrom: Play): void {
  const state = useEditorStore.getState()
  if (!state.play || state.play.id !== savedFrom.id) return
  if (state.play === savedFrom) {
    useEditorStore.setState({ play: result.play, version: result.version, dirty: false })
  } else {
    useEditorStore.setState({
      play: { ...state.play, updatedAt: result.play.updatedAt },
      version: result.version,
    })
  }
}

/** Silent reload of a version changed on the other computer (SPEC 8.4). History restarts. */
export function reloadPlay(play: Play, version: VersionToken | null): void {
  const state = useEditorStore.getState()
  useEditorStore.setState({
    ...withPlay(state, play),
    version,
    dirty: false,
    history: EMPTY_HISTORY,
    gestureStart: null,
  })
}

export function selectPhase(phaseId: Id): void {
  // A notice about the previous phase no longer applies.
  useEditorStore.setState({
    selectedPhaseId: phaseId,
    runDraft: null,
    passFromId: null,
    kickFromId: null,
    syncPick: null,
    notice: null,
  })
}

export function setTool(tool: ToolId): void {
  // A tool change ends the placement: a new play still waiting for it is dropped (D-101).
  if (placementDropsCreation()) dropCreation()
  useEditorStore.setState({
    tool,
    runDraft: null,
    passFromId: null,
    kickFromId: null,
    placement: null,
    syncPick: null,
    notice: null,
  })
}

/**
 * Starts or ends a placement (D-096); the tool drafts in progress are dropped. Ending it (Escape,
 * « Annuler ») or starting another one drops a new play still waiting for its anchor (D-101).
 */
export function setPlacement(placement: PlacementMode | null): void {
  if (placementDropsCreation()) {
    dropCreation()
    return
  }
  useEditorStore.setState({
    placement,
    runDraft: null,
    passFromId: null,
    kickFromId: null,
    syncPick: null,
    notice: null,
  })
}

/** « Côté ouvert : Auto | Gauche | Droite » of the banner (D-088). */
export function setPlacementOpenSide(openSide: OpenSideChoice): void {
  const placement = useEditorStore.getState().placement
  if (placement && placement.kind !== 'movePlay') {
    useEditorStore.setState({ placement: { ...placement, openSide } })
  }
}

/** Starts or ends « Caler sur… » (D-109); the tool drafts in progress are dropped. */
export function setSyncPick(syncPick: SyncPick | null): void {
  useEditorStore.setState({
    syncPick,
    runDraft: null,
    passFromId: null,
    kickFromId: null,
    notice: null,
  })
}

export function setSelection(selection: Selection): void {
  useEditorStore.setState({ selection })
}

export function setSnap(snap: boolean): void {
  useEditorStore.setState({ snap })
}

export function setNotice(notice: EditorNotice): void {
  useEditorStore.setState({ notice })
}
