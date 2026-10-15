// Hit testing on the schematic of the displayed phase, in metres (tolerances given in metres by
// the caller from the viewport scale).
import type { Bounds } from '../engine/bounds'
import type { PhaseSchematic } from '../engine/evaluate'
import type { Id, Vec2 } from '../model/types'

export type Hit =
  | { kind: 'waypoint'; actionId: Id; index: number }
  | { kind: 'player'; id: Id }
  | { kind: 'run'; actionId: Id }
  | { kind: 'pass'; actionId: Id }
  | null

export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const k = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + k * dx), p.y - (a.y + k * dy))
}

export function distanceToPolyline(p: Vec2, points: readonly Vec2[]): number {
  let best = Infinity
  for (let i = 1; i < points.length; i++) {
    best = Math.min(best, distanceToSegment(p, points[i - 1] as Vec2, points[i] as Vec2))
  }
  return best
}

export interface HitTolerances {
  /** Radius of a token, in metres. */
  token: number
  /** Radius of a waypoint handle, in metres. */
  handle: number
  /** Distance to a line, in metres. */
  line: number
}

/** Closest candidate within its tolerance, or null. */
function closest<T>(candidates: readonly { value: T; d: number; max: number }[]): T | null {
  let best: { value: T; d: number } | null = null
  for (const c of candidates) {
    if (c.d <= c.max && (best === null || c.d < best.d)) best = { value: c.value, d: c.d }
  }
  return best ? best.value : null
}

/** Priority: waypoint handles, then players, then runs, then passes (closest first in each). */
export function hitTest(schematic: PhaseSchematic, p: Vec2, tol: HitTolerances): Hit {
  const handle = closest(
    schematic.runs.flatMap((run) =>
      run.waypoints.map((w, index) => ({
        value: { kind: 'waypoint' as const, actionId: run.actionId, index },
        d: Math.hypot(p.x - w.x, p.y - w.y),
        max: tol.handle,
      })),
    ),
  )
  if (handle) return handle
  const player = closest(
    schematic.players.map((pl) => ({
      value: { kind: 'player' as const, id: pl.id },
      d: Math.hypot(p.x - pl.pos.x, p.y - pl.pos.y),
      max: tol.token,
    })),
  )
  if (player) return player
  const run = closest(
    schematic.runs.map((r) => ({
      value: { kind: 'run' as const, actionId: r.actionId },
      d: distanceToPolyline(p, r.points),
      max: tol.line,
    })),
  )
  if (run) return run
  return closest(
    schematic.passes.map((ps) => ({
      value: { kind: 'pass' as const, actionId: ps.actionId },
      d: distanceToSegment(p, ps.from, ps.to),
      max: tol.line,
    })),
  )
}

/** Players whose start position lies in a rubber-band box. */
export function playersInBox(schematic: PhaseSchematic, box: Bounds): Id[] {
  const minX = Math.min(box.min.x, box.max.x)
  const maxX = Math.max(box.min.x, box.max.x)
  const minY = Math.min(box.min.y, box.max.y)
  const maxY = Math.max(box.min.y, box.max.y)
  return schematic.players
    .filter((p) => p.pos.x >= minX && p.pos.x <= maxX && p.pos.y >= minY && p.pos.y <= maxY)
    .map((p) => p.id)
}
