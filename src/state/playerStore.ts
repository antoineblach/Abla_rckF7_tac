// Player state (Zustand): transport (the displayed line and the cursor), layers, orientation, full
// screen. The transport logic lives in player/transport.ts. Playing or at rest: at rest, the field
// shows and edits the instant of the cursor (SPEC 6.3, D-141, D-172). The displayed area is the same
// in both cases (viewStore, D-049).
import { create } from 'zustand'
import type { Cursor } from '../editor/commands'
import { compileLine, intervalIndexAt } from '../engine/timeline'
import { defaultLine, extendWithDefaults, isValidLine } from '../model/branches'
import type { Id, Play } from '../model/types'
import * as transport from '../player/transport'
import type { LineTiming, PlaybackSpeed, TransportState } from '../player/transport'
import type { Layers } from '../render/layers'
import type { Orientation } from '../render/viewport'
import { loadPrefs, savePrefs, type Prefs } from './prefs'
import { dropToolDrafts, useEditorStore } from './editorStore'
import { appCaches, currentEngineSettings } from './settingsStore'
import { resetView } from './viewStore'

export interface PlayerState {
  transport: TransportState
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
    stopAtOptions: prefs.stopAtOptions,
  },
  layers: prefs.layers,
  orientation: prefs.orientation,
  fullscreen: false,
}))

function persist(patch: Partial<Prefs>): void {
  savePrefs({ ...loadPrefs(), ...patch })
}

export function timingOf(play: Play, line: readonly Id[]): LineTiming {
  return transport.lineTiming(compileLine(play, line, currentEngineSettings(), appCaches))
}

function currentPlay(): Play | null {
  return useEditorStore.getState().play
}

/** Where a new action is laid: the displayed line, the instant of the cursor (SPEC 6.3). */
export function currentCursor(): Cursor {
  const { line, t } = usePlayerStore.getState().transport
  return { line, t }
}

function update(
  fn: (state: TransportState, timing: LineTiming, play: Play) => TransportState,
): void {
  const play = currentPlay()
  if (!play) return
  const before = usePlayerStore.getState().transport
  const next = fn(before, timingOf(play, before.line), play)
  if (next === before) return
  usePlayerStore.setState({ transport: next })
  if (next.t !== before.t || next.line !== before.line || next.playing) dropToolDrafts()
}

/** A complete line of the play: the same one when it still holds, else the default line. */
function lineFor(play: Play, line: Id[]): Id[] {
  if (!isValidLine(play, line)) return defaultLine(play)
  const extended = extendWithDefaults(play, line)
  return extended.length === line.length ? line : extended
}

/** Keeps the line valid and the cursor within the duration, after a change of the play. */
function followPlay(play: Play): void {
  const state = usePlayerStore.getState().transport
  const line = lineFor(play, state.line)
  const t = Math.min(state.t, compileLine(play, line, currentEngineSettings(), appCaches).duration)
  if (line !== state.line || t !== state.t) {
    usePlayerStore.setState({ transport: { ...state, line, t } })
  }
}

// The transport follows the editor: each play opens on its default line at t = 0, and a gesture
// waits for its end, so that a drag does not leave the cursor where a shorter line clamped it.
useEditorStore.subscribe((state, previous) => {
  const { play } = state
  if (state.openCount !== previous.openCount) {
    usePlayerStore.setState((s) => ({
      transport: {
        ...s.transport,
        line: play ? defaultLine(play) : [],
        t: 0,
        playing: false,
        waitingAt: null,
      },
    }))
    return
  }
  if (!play || state.gestureStart) return
  if (play === previous.play && !previous.gestureStart) return
  // An editing gesture stops the playback (SPEC 6.3); a save or a reload does not.
  if (state.history !== previous.history) update((t) => (t.playing ? transport.pause(t) : t))
  followPlay(play)
})

export const playPause = (): void => {
  const state = usePlayerStore.getState()
  if (state.transport.playing) update((t) => transport.pause(t))
  else update((t, timing) => transport.play(t, timing))
}
export const pausePlayer = (): void => {
  update((t) => (t.playing ? transport.pause(t) : t))
}
export const tickPlayer = (dt: number): void => {
  update((t, timing) => transport.tick(t, dt, timing))
}
export const seekPlayer = (t: number): void => {
  update((s, timing) => transport.seek(s, t, timing))
}
export const nextEdgeInPlayer = (): void => {
  update((s, timing) => transport.nextEdge(s, timing))
}
export const previousEdgeInPlayer = (): void => {
  update((s, timing) => transport.previousEdge(s, timing))
}
export const chooseOptionInPlayer = (optionId: Id): void => {
  update((s, _timing, play) => transport.chooseOption(s, play, optionId))
}
export const backToBranchPointInPlayer = (): void => {
  update((s, timing) => transport.backToBranchPoint(s, timing))
}

/** Liste « Ligne » (D-142): the line read, shown and edited. */
export function showLineInPlayer(line: Id[]): void {
  update((s, _timing, play) => transport.showLine(s, line, timingOf(play, line)))
}

/**
 * Selecting an action brings the cursor to the start of the action when it is out of its interval:
 * otherwise its path is not drawn and cannot be modified (SPEC 6.3, D-145).
 */
export function showActionInPlayer(actionId: Id): void {
  const play = currentPlay()
  if (!play) return
  const { line, t } = usePlayerStore.getState().transport
  const compiled = compileLine(play, line, currentEngineSettings(), appCaches)
  const block = compiled.blocks[actionId]
  if (block && intervalIndexAt(compiled, t) !== intervalIndexAt(compiled, block.start)) {
    seekPlayer(block.start)
  }
}

export function setSpeed(speed: PlaybackSpeed): void {
  usePlayerStore.setState((s) => ({ transport: { ...s.transport, speed } }))
  persist({ speed })
}

export function setTransportFlag(flag: 'loop' | 'stopAtOptions', value: boolean): void {
  usePlayerStore.setState((s) => ({ transport: { ...s.transport, [flag]: value } }))
  persist({ [flag]: value })
}

export function setLayer(
  layer: 'traces' | 'instruction' | 'gainLine' | 'forwardPass' | 'speedAlert',
  value: boolean,
): void {
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
