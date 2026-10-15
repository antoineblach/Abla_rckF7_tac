// Editor state (Zustand): the open play, its history, selection, tool and drafts.
// Logic lives in editor/ and model/; this store only holds state and applies commands.
import { create } from 'zustand'
import { EMPTY_HISTORY, record, redo, undo, type History } from '../editor/history'
import { EMPTY_SELECTION, pruneSelection, type Selection } from '../editor/selection'
import type { RunDraft } from '../editor/tools/runTool'
import type { ToolId } from '../editor/tools/types'
import type { VersionToken, PutResult } from '../io/LibraryStore'
import { findPhase, rootPhase } from '../model/phaseTree'
import type { Id, Play } from '../model/types'
import { resetView } from './viewStore'

export type EditorNotice = 'inheritedPosition' | 'readOnly' | 'rootOption' | 'notLeaf' | null

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
  snap: false,
  notice: null,
}

export const useEditorStore = create<EditorState>(() => initial)

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
    notice: null,
  })
}

export function setTool(tool: ToolId): void {
  useEditorStore.setState({ tool, runDraft: null, passFromId: null, notice: null })
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
