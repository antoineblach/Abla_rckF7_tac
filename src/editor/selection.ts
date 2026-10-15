// Selection of the editor (SPEC 6.2): players, actions, one waypoint.
import type { Id } from '../model/types'

export interface Selection {
  players: Id[]
  actions: Id[]
  waypoint: { actionId: Id; index: number } | null
}

export const EMPTY_SELECTION: Selection = { players: [], actions: [], waypoint: null }

export function isEmptySelection(selection: Selection): boolean {
  return (
    selection.players.length === 0 && selection.actions.length === 0 && selection.waypoint === null
  )
}

/** Click: replaces the selection; Shift+click: adds (or removes when already selected). */
export function selectPlayer(selection: Selection, id: Id, additive: boolean): Selection {
  if (!additive) return { players: [id], actions: [], waypoint: null }
  const players = selection.players.includes(id)
    ? selection.players.filter((p) => p !== id)
    : [...selection.players, id]
  return { ...selection, players, waypoint: null }
}

export function selectAction(selection: Selection, id: Id, additive: boolean): Selection {
  if (!additive) return { players: [], actions: [id], waypoint: null }
  const actions = selection.actions.includes(id)
    ? selection.actions.filter((a) => a !== id)
    : [...selection.actions, id]
  return { ...selection, actions, waypoint: null }
}

export function selectPlayersInBox(
  selection: Selection,
  ids: readonly Id[],
  additive: boolean,
): Selection {
  if (!additive) return { players: [...ids], actions: [], waypoint: null }
  return { ...selection, players: [...new Set([...selection.players, ...ids])], waypoint: null }
}

/** Drops references to elements that no longer exist. */
export function pruneSelection(
  selection: Selection,
  entityIds: ReadonlySet<Id>,
  actionIds: ReadonlySet<Id>,
): Selection {
  const players = selection.players.filter((id) => entityIds.has(id))
  const actions = selection.actions.filter((id) => actionIds.has(id))
  const waypoint =
    selection.waypoint && actionIds.has(selection.waypoint.actionId) ? selection.waypoint : null
  if (
    players.length === selection.players.length &&
    actions.length === selection.actions.length &&
    waypoint === selection.waypoint
  ) {
    return selection
  }
  return { players, actions, waypoint }
}
