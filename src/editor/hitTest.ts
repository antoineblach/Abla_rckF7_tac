// Hit testing on the schematic of the displayed phase, in metres (tolerances given in metres by
// the caller from the viewport scale).
import type { Bounds } from '../engine/bounds'
import type { PhaseSchematic } from '../engine/evaluate'
import type { Id, Vec2 } from '../model/types'

export type Hit =
  | { kind: 'waypoint'; actionId: Id; index: number }
  /** Target point of a kick to a point (lot 3), draggable like a waypoint. */
  | { kind: 'kickTarget'; actionId: Id }
  /** Ball on the ground at the start of the phase (lot 3, D-083). */
  | { kind: 'ball' }
  | { kind: 'player'; id: Id }
  | { kind: 'run'; actionId: Id }
  | { kind: 'pass'; actionId: Id }
  | { kind: 'kick'; actionId: Id }
  | { kind: 'breakdown'; actionId: Id }
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

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Priority: waypoint handles and kick target points, then the ball on the ground, then players,
 * then runs (ignored parts included) and relays (they select their breakdown), passes, kicks,
 * and the ring of a breakdown (closest first in each).
 */
export function hitTest(schematic: PhaseSchematic, p: Vec2, tol: HitTolerances): Hit {
  const handle = closest<Hit>([
    ...schematic.runs.flatMap((run) =>
      run.waypoints.map((w, index) => ({
        value: { kind: 'waypoint' as const, actionId: run.actionId, index },
        d: dist(p, w),
        max: tol.handle,
      })),
    ),
    ...schematic.kicks
      .filter((k) => k.receiverId === null)
      .map((k) => ({
        value: { kind: 'kickTarget' as const, actionId: k.actionId },
        d: dist(p, k.to),
        max: tol.handle,
      })),
  ])
  if (handle) return handle
  if (schematic.ball?.kind === 'loose' && dist(p, schematic.ball.pos) <= tol.handle) {
    return { kind: 'ball' }
  }
  const player = closest(
    schematic.players.map((pl) => ({
      value: { kind: 'player' as const, id: pl.id },
      d: dist(p, pl.pos),
      max: tol.token,
    })),
  )
  if (player) return player
  return closest<Hit>([
    ...schematic.runs.map((r) => ({
      value: { kind: 'run' as const, actionId: r.actionId },
      d: distanceToPolyline(p, [...r.points, ...r.ignoredPoints]),
      max: tol.line,
    })),
    ...schematic.relays.map((r) => ({
      value: { kind: 'breakdown' as const, actionId: r.actionId },
      d: distanceToPolyline(p, r.points),
      max: tol.line,
    })),
    ...schematic.passes.map((ps) => ({
      value: { kind: 'pass' as const, actionId: ps.actionId },
      d: distanceToSegment(p, ps.from, ps.to),
      max: tol.line,
    })),
    ...schematic.kicks.map((k) => ({
      value: { kind: 'kick' as const, actionId: k.actionId },
      d: distanceToSegment(p, k.from, k.to),
      max: tol.line,
    })),
    ...schematic.breakdowns.map((b) => ({
      // The ring of a breakdown has a radius of two tokens (D-084).
      value: { kind: 'breakdown' as const, actionId: b.actionId },
      d: Math.abs(dist(p, b.pos) - 2 * tol.token),
      max: tol.line,
    })),
  ])
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
