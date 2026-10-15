// Run tool (SPEC 6.2): click on a player, then one click per waypoint; Enter or double click
// finishes, Escape cancels. On a player who already runs in the phase, the run is extended
// from its last point (D-015).
import type { Id, Vec2 } from '../../model/types'
import type { Hit } from '../hitTest'

export interface RunDraft {
  entityId: Id
  /** First point of the preview: start position, or last point of the existing run. */
  anchor: Vec2
  points: Vec2[]
}

/** Points closer than this are the same click (double click). */
const SAME_POINT = 0.05

export function runToolClick(
  draft: RunDraft | null,
  hit: Hit,
  pos: Vec2,
  anchorOf: (entityId: Id) => Vec2 | undefined,
): RunDraft | null {
  if (!draft) {
    if (hit?.kind !== 'player') return null
    const anchor = anchorOf(hit.id)
    return anchor ? { entityId: hit.id, anchor, points: [] } : null
  }
  const last = draft.points[draft.points.length - 1] ?? draft.anchor
  if (Math.hypot(pos.x - last.x, pos.y - last.y) < SAME_POINT) return draft
  return { ...draft, points: [...draft.points, { x: pos.x, y: pos.y }] }
}

/** The run to create, or null when no waypoint was clicked. */
export function runToolFinish(draft: RunDraft | null): { entityId: Id; waypoints: Vec2[] } | null {
  if (!draft || draft.points.length === 0) return null
  return { entityId: draft.entityId, waypoints: draft.points }
}

export function runToolPreview(draft: RunDraft | null, cursor: Vec2 | null): Vec2[] | null {
  if (!draft) return null
  return cursor ? [draft.anchor, ...draft.points, cursor] : [draft.anchor, ...draft.points]
}
