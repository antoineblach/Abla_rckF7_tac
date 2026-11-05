// Hit testing on the field at the cursor (SPEC 6.2, 6.3), in metres (tolerances given in metres by
// the caller from the viewport scale).
import type { Bounds } from '../engine/bounds'
import type { SchematicRun, WindowSchematic } from '../engine/evaluate'
import type { Id, Vec2 } from '../model/types'

export type Hit =
  | { kind: 'waypoint'; actionId: Id; index: number }
  /** Target point of a kick to a point (lot 3), draggable like a waypoint. */
  | { kind: 'kickTarget'; actionId: Id }
  /** Ball on the ground at the cursor (lot 3, D-083). */
  | { kind: 'ball' }
  | { kind: 'player'; id: Id }
  /** Line of a run, with the input segment under the pointer (D-114). */
  | { kind: 'run'; actionId: Id; segment: number }
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

/** Distance along a polyline to its point closest to `p`. */
export function arcLengthAt(p: Vec2, points: readonly Vec2[]): number {
  let best = Infinity
  let bestS = 0
  let travelled = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Vec2
    const b = points[i] as Vec2
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    const k =
      len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len ** 2))
    const d = Math.hypot(p.x - (a.x + k * dx), p.y - (a.y + k * dy))
    if (d < best) {
      best = d
      bestS = travelled + k * len
    }
    travelled += len
  }
  return bestS
}

/** Input segment of a run under `p` (segment i arrives at waypoint i), ignored part included. */
export function segmentAt(run: SchematicRun, p: Vec2): number {
  const s = arcLengthAt(p, [...run.points, ...run.ignoredPoints])
  const index = run.segmentEnds.findIndex((end) => s <= end + 1e-9)
  return index === -1 ? Math.max(0, run.segmentEnds.length - 1) : index
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
 * Priority: waypoint handles and kick target points of the interval, then the ball on the ground,
 * then players, then the lines of the interval: runs (ignored parts included) and relays (they select
 * their breakdown), passes, kicks and the ring of a breakdown, closest first; then, the same way, the
 * earlier lines in grey: selecting one brings the cursor to its interval (SPEC 6.3). The points of an
 * earlier run are not drawn: only the interval has handles.
 */
export function hitTest(schematic: WindowSchematic, p: Vec2, tol: HitTolerances): Hit {
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
  return (
    closest<Hit>([
      ...schematic.runs.map((r) => runCandidate(r, p, tol)),
      ...schematic.relays.map((r) => relayCandidate(r, p, tol)),
      ...passCandidates(schematic.passes, p, tol),
      ...kickCandidates(schematic.kicks, p, tol),
      ...breakdownCandidates(schematic.breakdowns, p, tol),
    ]) ??
    closest<Hit>([
      ...schematic.earlierRuns.map((r) =>
        // Relays come with the runs there: their action is the breakdown they join.
        schematic.earlierBreakdowns.some((b) => b.actionId === r.actionId)
          ? relayCandidate(r, p, tol)
          : runCandidate(r, p, tol),
      ),
      ...passCandidates(schematic.earlierPasses, p, tol),
      ...kickCandidates(schematic.earlierKicks, p, tol),
      ...breakdownCandidates(schematic.earlierBreakdowns, p, tol),
    ])
  )
}

function runCandidate(run: SchematicRun, p: Vec2, tol: HitTolerances) {
  return {
    value: { kind: 'run' as const, actionId: run.actionId, segment: segmentAt(run, p) },
    d: distanceToPolyline(p, [...run.points, ...run.ignoredPoints]),
    max: tol.line,
  }
}

function relayCandidate(relay: SchematicRun, p: Vec2, tol: HitTolerances) {
  return {
    value: { kind: 'breakdown' as const, actionId: relay.actionId },
    d: distanceToPolyline(p, relay.points),
    max: tol.line,
  }
}

function passCandidates(passes: WindowSchematic['passes'], p: Vec2, tol: HitTolerances) {
  return passes.map((pass) => ({
    value: { kind: 'pass' as const, actionId: pass.actionId },
    d: distanceToSegment(p, pass.from, pass.to),
    max: tol.line,
  }))
}

function kickCandidates(kicks: WindowSchematic['kicks'], p: Vec2, tol: HitTolerances) {
  return kicks.map((kick) => ({
    value: { kind: 'kick' as const, actionId: kick.actionId },
    d: distanceToSegment(p, kick.from, kick.to),
    max: tol.line,
  }))
}

function breakdownCandidates(
  breakdowns: WindowSchematic['breakdowns'],
  p: Vec2,
  tol: HitTolerances,
) {
  return breakdowns.map((breakdown) => ({
    // The ring of a breakdown has a radius of two tokens (D-084).
    value: { kind: 'breakdown' as const, actionId: breakdown.actionId },
    d: Math.abs(dist(p, breakdown.pos) - 2 * tol.token),
    max: tol.line,
  }))
}

/** Players whose position at the cursor lies in a rubber-band box. */
export function playersInBox(schematic: WindowSchematic, box: Bounds): Id[] {
  const minX = Math.min(box.min.x, box.max.x)
  const maxX = Math.max(box.min.x, box.max.x)
  const minY = Math.min(box.min.y, box.max.y)
  const maxY = Math.max(box.min.y, box.max.y)
  return schematic.players
    .filter((p) => p.pos.x >= minX && p.pos.x <= maxX && p.pos.y >= minY && p.pos.y <= maxY)
    .map((p) => p.id)
}
