// Player state (Zustand): transport, edit or playback mode (D-010), layers, orientation,
// full screen. The transport logic lives in player/transport.ts. The displayed area is the same
// in both modes (viewStore, D-049).
import { create } from 'zustand'
import { compileLine } from '../engine/timeline'
import { defaultLineThrough } from '../model/phaseTree'
import type { Id, Play } from '../model/types'
import * as transport from '../player/transport'
import type { LineTiming, PlaybackSpeed, TransportState } from '../player/transport'
import type { Layers } from '../render/layers'
import type { Orientation } from '../render/viewport'
import { useEditorStore } from './editorStore'
import { loadPrefs, savePrefs, type Prefs } from './prefs'
import { appCaches, currentEngineSettings } from './settingsStore'
import { resetView } from './viewStore'

export type ViewMode = 'edit' | 'play'

export interface PlayerState {
  transport: TransportState
  mode: ViewMode
  layers: Layers
  orientation: Orientation
  fullscreen: boolean
}

const prefs = loadPrefs()

export const usePlayerStore = create<PlayerState>(() => ({
  transport: {
    ...transport.initialTransport([]),
    speed: prefs.speed,
    loop: prefs.loop,
    pauseBetweenPhases: prefs.pauseBetweenPhases,
    stopAtOptions: prefs.stopAtOptions,
  },
  mode: 'edit',
  layers: prefs.layers,
  orientation: prefs.orientation,
  fullscreen: false,
}))

function persist(patch: Partial<Prefs>): void {
  savePrefs({ ...loadPrefs(), ...patch })
}

export function timingOf(play: Play, line: readonly Id[]): LineTiming {
  const compiled = compileLine(play, line, currentEngineSettings(), appCaches)
  return {
    phaseIds: compiled.phases.map((p) => p.phaseId),
    starts: compiled.phases.map((p) => p.start),
    ends: compiled.phases.map((p) => p.end),
    duration: compiled.duration,
  }
}

function currentPlay(): Play | null {
  return useEditorStore.getState().play
}

function update(
  fn: (state: TransportState, timing: LineTiming, play: Play) => TransportState,
  mode?: ViewMode,
): void {
  const play = currentPlay()
  if (!play) return
  const state = usePlayerStore.getState()
  const timing = timingOf(play, state.transport.line)
  usePlayerStore.setState({
    transport: fn(state.transport, timing, play),
    ...(mode ? { mode } : {}),
  })
}

/** Start time of a phase on a line. */
function phaseStart(play: Play, line: Id[], phaseId: Id): number {
  const timing = timingOf(play, line)
  return timing.starts[line.indexOf(phaseId)] ?? 0
}

/** Shows a phase at rest: its default line, at its start, edit mode (D-010). */
export function showPhaseInPlayer(phaseId: Id): void {
  const play = currentPlay()
  if (!play) return
  const state = usePlayerStore.getState()
  usePlayerStore.setState({
    transport: transport.showPhase(state.transport, play, phaseId, (line) =>
      phaseStart(play, line, phaseId),
    ),
    mode: 'edit',
  })
}

/** Keeps the line valid after an edit of the tree. */
export function syncLineWithPlay(): void {
  const play = currentPlay()
  const phaseId = useEditorStore.getState().selectedPhaseId
  if (!play || !phaseId) return
  const state = usePlayerStore.getState()
  if (state.mode === 'edit') {
    showPhaseInPlayer(phaseId)
    return
  }
  const line = defaultLineThrough(play, phaseId)
  const valid = state.transport.line.every((id, i) => line[i] === id || i >= line.length)
  if (!valid || state.transport.line.length === 0) showPhaseInPlayer(phaseId)
}

export const playPause = (): void => {
  const state = usePlayerStore.getState()
  if (state.transport.playing) update((t) => transport.pause(t))
  else update((t, timing) => transport.play(t, timing), 'play')
}
export const tickPlayer = (dt: number): void => {
  update((t, timing, play) => transport.tick(t, dt, timing, play))
}
export const seekPlayer = (t: number): void => {
  update((s, timing) => transport.seek(s, t, timing), 'play')
}
export const nextPhaseInPlayer = (): void => {
  update((s, timing) => transport.nextPhase(s, timing), 'play')
}
export const previousPhaseInPlayer = (): void => {
  update((s, timing) => transport.previousPhase(s, timing), 'play')
}
export const chooseOptionInPlayer = (optionId: Id): void => {
  update((s, _timing, play) => transport.chooseOption(s, play, optionId), 'play')
}
export const backToBranchPointInPlayer = (): void => {
  update((s, timing, play) => transport.backToBranchPoint(s, timing, play), 'play')
}

export function setSpeed(speed: PlaybackSpeed): void {
  usePlayerStore.setState((s) => ({ transport: { ...s.transport, speed } }))
  persist({ speed })
}

export function setTransportFlag(
  flag: 'loop' | 'pauseBetweenPhases' | 'stopAtOptions',
  value: boolean,
): void {
  usePlayerStore.setState((s) => ({ transport: { ...s.transport, [flag]: value } }))
  persist({ [flag]: value })
}

export function setLayer(layer: 'traces' | 'instruction' | 'gainLine', value: boolean): void {
  const layers = { ...usePlayerStore.getState().layers, [layer]: value }
  usePlayerStore.setState({ layers })
  persist({ layers })
}

export function setOrientation(orientation: Orientation): void {
  usePlayerStore.setState({ orientation })
  persist({ orientation })
  // The canvas shape changes: fit the saved view again (D-048).
  resetView()
}

export function setFullscreen(fullscreen: boolean): void {
  usePlayerStore.setState({ fullscreen })
}

/** Back to edit mode at the start of the selected phase (any editing gesture, D-010). */
export function enterEditMode(): void {
  const phaseId = useEditorStore.getState().selectedPhaseId
  if (phaseId) showPhaseInPlayer(phaseId)
}
