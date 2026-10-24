// Space bar (SPEC 6.2, D-116): a short press, released without any drag in less than
// SPACE_TAP_MAX_MS, plays or pauses; held down with a drag, it pans the field without playing.
// Key repeat is ignored. Pure automaton: instants come from the caller (event time stamps).
import { SPACE_TAP_MAX_MS } from '../config/defaults'

export type SpaceState =
  | { kind: 'up' }
  /** Pressed at `since` (milliseconds); `dragged` once a pan started while it was held. */
  | { kind: 'down'; since: number; dragged: boolean }

export const SPACE_UP: SpaceState = { kind: 'up' }

export type SpaceEvent =
  | { kind: 'press'; t: number; repeat: boolean }
  /** A drag (pan) started while the bar was held. */
  | { kind: 'drag' }
  | { kind: 'release'; t: number }
  /** Focus lost or window hidden: the bar is considered released, without toggling. */
  | { kind: 'reset' }

export interface SpaceStep {
  state: SpaceState
  /** True when the event plays or pauses. */
  toggle: boolean
}

export function spaceStep(state: SpaceState, event: SpaceEvent): SpaceStep {
  switch (event.kind) {
    case 'press':
      // A repeated keydown, or a second press without release, changes nothing.
      if (event.repeat || state.kind === 'down') return { state, toggle: false }
      return { state: { kind: 'down', since: event.t, dragged: false }, toggle: false }
    case 'drag':
      if (state.kind !== 'down') return { state, toggle: false }
      return { state: { ...state, dragged: true }, toggle: false }
    case 'release': {
      if (state.kind !== 'down') return { state: SPACE_UP, toggle: false }
      const short = event.t - state.since < SPACE_TAP_MAX_MS
      return { state: SPACE_UP, toggle: short && !state.dragged }
    }
    case 'reset':
      return { state: SPACE_UP, toggle: false }
  }
}

/** True while the bar is held: a drag pans the field (D-116). */
export function spaceHeld(state: SpaceState): boolean {
  return state.kind === 'down'
}
