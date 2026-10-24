// Selection of the editor (SPEC 6.2): players, actions, one waypoint; lot 3 bis: one segment of a
// run (D-114).
import type { Id } from '../model/types'

/** Segment `index` of a run: from point index - 1 (the start for 0) to point index. */
export interface SegmentRef {
  actionId: Id
  index: number
}

export interface Selection {
  players: Id[]
  actions: Id[]
  waypoint: { actionId: Id; index: number } | null
  /** Segment clicked on the line of a run (D-114). */
  segment: SegmentRef | null
}

export const EMPTY_SELECTION: Selection = {
  players: [],
  actions: [],
  waypoint: null,
  segment: null,
}

export function isEmptySelection(selection: Selection): boolean {
  return (
    selection.players.length === 0 &&
    selection.actions.length === 0 &&
    selection.waypoint === null &&
    selection.segment === null
  )
}

/** Only these actions selected. */
export function actionsSelection(actions: Id[]): Selection {
  return { ...EMPTY_SELECTION, actions }
}

/** Only these players selected. */
export function playersSelection(players: Id[]): Selection {
  return { ...EMPTY_SELECTION, players }
}

/** A waypoint of a run, with its run. */
export function waypointSelection(actionId: Id, index: number): Selection {
  return { ...EMPTY_SELECTION, actions: [actionId], waypoint: { actionId, index } }
}

/** A segment of a run, with its run (click on its line, D-114). */
export function segmentSelection(actionId: Id, index: number): Selection {
  return { ...EMPTY_SELECTION, actions: [actionId], segment: { actionId, index } }
}

/** Segment designated by the selection: the one clicked, or the one arriving at the selected point. */
export function selectedSegment(selection: Selection): SegmentRef | null {
  return selection.segment ?? selection.waypoint
}

/** Click: replaces the selection; Shift+click: adds (or removes when already selected). */
export function selectPlayer(selection: Selection, id: Id, additive: boolean): Selection {
  if (!additive) return playersSelection([id])
  const players = selection.players.includes(id)
    ? selection.players.filter((p) => p !== id)
    : [...selection.players, id]
  return { ...selection, players, waypoint: null, segment: null }
}

export function selectAction(selection: Selection, id: Id, additive: boolean): Selection {
  if (!additive) return actionsSelection([id])
  const actions = selection.actions.includes(id)
    ? selection.actions.filter((a) => a !== id)
    : [...selection.actions, id]
  return { ...selection, actions, waypoint: null, segment: null }
}

export function selectPlayersInBox(
  selection: Selection,
  ids: readonly Id[],
  additive: boolean,
): Selection {
  if (!additive) return playersSelection([...ids])
  return {
    ...selection,
    players: [...new Set([...selection.players, ...ids])],
    waypoint: null,
    segment: null,
  }
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
  const segment =
    selection.segment && actionIds.has(selection.segment.actionId) ? selection.segment : null
  if (
    players.length === selection.players.length &&
    actions.length === selection.actions.length &&
    waypoint === selection.waypoint &&
    segment === selection.segment
  ) {
    return selection
  }
  return { players, actions, waypoint, segment }
}
