// Playback transport (SPEC 7, D-011, D-146): a pure state machine driven by the time elapsed between
// two frames, never by the clock itself. The instants come from the compiled line.
import { extendWithDefaults, pathToBranch } from '../model/branches'
import type { Id, Play } from '../model/types'
import type { CompiledLine } from '../engine/timeline'

export type PlaybackSpeed = 0.5 | 1 | 2

export const PLAYBACK_SPEEDS: readonly PlaybackSpeed[] = [0.5, 1, 2]

export interface TransportState {
  /** Line being played: root to leaf, default options beyond the choices made. */
  line: Id[]
  t: number
  playing: boolean
  speed: PlaybackSpeed
  loop: boolean
  /** « S'arrêter aux options », on by default (D-011). */
  stopAtOptions: boolean
  /** Branch that divides, where playback waits for a choice; null otherwise. */
  waitingAt: Id | null
}

/** Instants of a line, read from its compilation. */
export interface LineTiming {
  /** Branch points of the line that its playback reaches, in time order. */
  branchPoints: readonly { branchId: Id; t: number }[]
  /** Edges of the blocks of the line, 0 and the duration included, sorted, distinct (D-146). */
  edges: readonly number[]
  duration: number
}

/** Two instants closer than this are one edge. */
const EDGE_EPSILON = 1e-9

export function lineTiming(compiled: CompiledLine): LineTiming {
  const { duration } = compiled
  const branchPoints = compiled.branches.flatMap((branch) =>
    branch.branchAt !== null && branch.branchAt <= duration
      ? [{ branchId: branch.id, t: branch.branchAt }]
      : [],
  )
  const instants = Object.values(compiled.blocks).flatMap((span) => [span.start, span.end])
  const sorted = [0, duration, ...instants.filter((t) => t > 0 && t < duration)].sort(
    (a, b) => a - b,
  )
  return {
    branchPoints,
    edges: sorted.filter((t, i) => i === 0 || t - (sorted[i - 1] ?? 0) > EDGE_EPSILON),
    duration,
  }
}

export function initialTransport(line: Id[]): TransportState {
  return {
    line,
    t: 0,
    playing: false,
    speed: 1,
    loop: false,
    stopAtOptions: true,
    waitingAt: null,
  }
}

/** Advances the playback by `dt` seconds of real time. */
export function tick(state: TransportState, dt: number, timing: LineTiming): TransportState {
  if (!state.playing || dt <= 0) return state
  const target = state.t + dt * state.speed
  if (state.stopAtOptions) {
    const reach = Math.min(target, timing.duration)
    const stop = timing.branchPoints.find((point) => point.t > state.t && point.t <= reach)
    if (stop) return { ...state, t: stop.t, playing: false, waitingAt: stop.branchId }
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

/** « Bord suivant » (D-146): the next edge of a block on the line. */
export function nextEdge(state: TransportState, timing: LineTiming): TransportState {
  const next = timing.edges.find((t) => t > state.t + EDGE_EPSILON)
  return { ...state, t: next ?? timing.duration, waitingAt: null }
}

/** « Bord précédent » (D-146): the previous edge of a block on the line. */
export function previousEdge(state: TransportState, timing: LineTiming): TransportState {
  const previous = timing.edges.findLast((t) => t < state.t - EDGE_EPSILON)
  return { ...state, t: previous ?? 0, waitingAt: null }
}

/** Chooses an option at the branch point and resumes playback. */
export function chooseOption(state: TransportState, play: Play, optionId: Id): TransportState {
  const path = pathToBranch(play, optionId)
  if (path.length === 0) return state
  return { ...state, line: extendWithDefaults(play, path), playing: true, waitingAt: null }
}

/** Back to the last branch point passed, to play another option (SPEC 7). */
export function backToBranchPoint(state: TransportState, timing: LineTiming): TransportState {
  const point = timing.branchPoints.findLast((candidate) => candidate.t <= state.t)
  if (!point) return state
  return { ...state, t: point.t, playing: false, waitingAt: point.branchId }
}

/** Liste « Ligne » (D-142): the line shown, the cursor kept within its duration. */
export function showLine(state: TransportState, line: Id[], timing: LineTiming): TransportState {
  return {
    ...state,
    line,
    t: Math.min(state.t, timing.duration),
    playing: false,
    waitingAt: null,
  }
}
