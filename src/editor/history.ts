// Undo and redo by snapshots of the play, 100 levels; a finished gesture is one step (SPEC 6.3).
import { UNDO_LEVELS } from '../config/defaults'
import type { Play } from '../model/types'

export interface History {
  past: Play[]
  future: Play[]
}

export const EMPTY_HISTORY: History = { past: [], future: [] }

/** Records the state before a change; clears the redo stack. */
export function record(history: History, before: Play, limit = UNDO_LEVELS): History {
  const past = [...history.past, before]
  if (past.length > limit) past.splice(0, past.length - limit)
  return { past, future: [] }
}

export function undo(history: History, current: Play): { history: History; play: Play } | null {
  const previous = history.past[history.past.length - 1]
  if (!previous) return null
  return {
    play: previous,
    history: { past: history.past.slice(0, -1), future: [current, ...history.future] },
  }
}

export function redo(history: History, current: Play): { history: History; play: Play } | null {
  const next = history.future[0]
  if (!next) return null
  return {
    play: next,
    history: { past: [...history.past, current], future: history.future.slice(1) },
  }
}
