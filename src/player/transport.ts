// Playback transport (SPEC 7, DECISIONS Q11 / D-011): a pure state machine driven by the time
// elapsed between two frames, never by the clock itself.
import { extendWithDefaults, isBranchPoint, pathToPhase } from '../model/phaseTree'
import type { Id, Play } from '../model/types'

export type PlaybackSpeed = 0.5 | 1 | 2

export const PLAYBACK_SPEEDS: readonly PlaybackSpeed[] = [0.5, 1, 2]

export interface TransportState {
  /** Line being played: root to leaf, default options beyond the choices made. */
  line: Id[]
  t: number
  playing: boolean
  speed: PlaybackSpeed
  loop: boolean
  pauseBetweenPhases: boolean
  /** « S'arrêter aux options », on by default (D-011). */
  stopAtOptions: boolean
  /** Branch point where playback waits for a choice, null otherwise. */
  waitingAt: Id | null
}

/** Timing of the line (from the compiled line). */
export interface LineTiming {
  phaseIds: readonly Id[]
  starts: readonly number[]
  ends: readonly number[]
  duration: number
}

export function initialTransport(line: Id[]): TransportState {
  return {
    line,
    t: 0,
    playing: false,
    speed: 1,
    loop: false,
    pauseBetweenPhases: false,
    stopAtOptions: true,
    waitingAt: null,
  }
}

/** Index of the phase shown at t (same rule as the engine: last phase starting at or before t). */
export function phaseIndexAtTime(timing: LineTiming, t: number): number {
  let index = timing.phaseIds.length > 0 ? 0 : -1
  timing.starts.forEach((start, i) => {
    if (start <= t) index = i
  })
  return index
}

/** Advances the playback by `dt` seconds of real time. */
export function tick(
  state: TransportState,
  dt: number,
  timing: LineTiming,
  play: Play,
): TransportState {
  if (!state.playing || dt <= 0) return state
  const target = state.t + dt * state.speed
  for (let i = 0; i < timing.phaseIds.length; i++) {
    const end = timing.ends[i] ?? 0
    if (end <= state.t || end > target) continue
    const isLast = i === timing.phaseIds.length - 1
    if (isLast) break
    const phaseId = timing.phaseIds[i] as Id
    if (state.stopAtOptions && isBranchPoint(play, phaseId)) {
      return { ...state, t: end, playing: false, waitingAt: phaseId }
    }
    if (state.pauseBetweenPhases) return { ...state, t: end, playing: false }
  }
  if (target >= timing.duration) {
    if (state.loop) return { ...state, t: 0, waitingAt: null }
    return { ...state, t: timing.duration, playing: false }
  }
  return { ...state, t: target }
}

export function play(state: TransportState, timing: LineTiming): TransportState {
  const t = state.t >= timing.duration ? 0 : state.t
  return { ...state, t, playing: true, waitingAt: null }
}

export function pause(state: TransportState): TransportState {
  return { ...state, playing: false }
}

export function seek(state: TransportState, t: number, timing: LineTiming): TransportState {
  return { ...state, t: Math.min(Math.max(0, t), timing.duration), waitingAt: null }
}

export function nextPhase(state: TransportState, timing: LineTiming): TransportState {
  const index = phaseIndexAtTime(timing, state.t)
  const next = timing.starts[index + 1]
  return { ...state, t: next ?? timing.duration, waitingAt: null }
}

export function previousPhase(state: TransportState, timing: LineTiming): TransportState {
  const index = phaseIndexAtTime(timing, state.t)
  const start = timing.starts[index] ?? 0
  const t = state.t - start > 0.05 || index <= 0 ? start : (timing.starts[index - 1] ?? 0)
  return { ...state, t, waitingAt: null }
}

/** Chooses an option at the branch point and resumes playback. */
export function chooseOption(state: TransportState, play: Play, optionId: Id): TransportState {
  const path = pathToPhase(play, optionId)
  if (path.length === 0) return state
  return { ...state, line: extendWithDefaults(play, path), playing: true, waitingAt: null }
}

/** Back to the last branch point passed, to play another option (SPEC 7). */
export function backToBranchPoint(
  state: TransportState,
  timing: LineTiming,
  play: Play,
): TransportState {
  const index = phaseIndexAtTime(timing, state.t)
  for (let i = Math.min(index, timing.phaseIds.length - 2); i >= 0; i--) {
    const phaseId = timing.phaseIds[i] as Id
    const end = timing.ends[i] ?? 0
    if (isBranchPoint(play, phaseId) && end <= state.t) {
      return { ...state, t: end, playing: false, waitingAt: phaseId }
    }
  }
  return state
}

/** Selecting a phase in the tree: its default line, positioned at its start (D-010). */
export function showPhase(
  state: TransportState,
  play: Play,
  phaseId: Id,
  startOf: (line: Id[]) => number,
): TransportState {
  const path = pathToPhase(play, phaseId)
  if (path.length === 0) return state
  const line = extendWithDefaults(play, path)
  return { ...state, line, t: startOf(line), playing: false, waitingAt: null }
}
