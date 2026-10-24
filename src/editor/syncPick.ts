// « Caler sur… » (SPEC 5.8, D-109): the click that picks the target of a link. A handle of another
// run designates its point (its end for the last point), the line of a run its end, a pass or a
// kick its nearest end (release or arrival), the ring or the relay of a breakdown its formation.
// Pure; the command refuses the loops (setRunSync).
import type { PhaseSchematic } from '../engine/evaluate'
import type { Id, SyncTarget, Vec2 } from '../model/types'
import type { Hit } from './hitTest'

/** Link waiting for its target: the run, and its rendez-vous point (absent: its end). */
export interface SyncPick {
  runId: Id
  at?: number
}

export type SyncPickResult =
  | { kind: 'target'; target: SyncTarget }
  /** The click designates the run being linked. */
  | { kind: 'self' }
  /** Nothing that can be a target under the pointer: keep waiting. */
  | { kind: 'none' }

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)

/** Release when the click is closer to the start of a pass or kick, arrival otherwise. */
function nearestEnd(actionId: Id, from: Vec2, to: Vec2, pos: Vec2): SyncTarget {
  return dist(pos, from) <= dist(pos, to)
    ? { actionId, event: 'release' }
    : { actionId, event: 'arrival' }
}

export function syncPickClick(
  pick: SyncPick,
  schematic: PhaseSchematic,
  hit: Hit,
  pos: Vec2,
): SyncPickResult {
  if (!hit) return { kind: 'none' }
  switch (hit.kind) {
    case 'waypoint': {
      if (hit.actionId === pick.runId) return { kind: 'self' }
      const run = schematic.runs.find((r) => r.actionId === hit.actionId)
      if (!run) return { kind: 'none' }
      const last = hit.index === run.waypoints.length - 1
      return {
        kind: 'target',
        target: last
          ? { actionId: hit.actionId, event: 'runEnd' }
          : { actionId: hit.actionId, event: 'runPoint', index: hit.index },
      }
    }
    case 'run':
      if (hit.actionId === pick.runId) return { kind: 'self' }
      return { kind: 'target', target: { actionId: hit.actionId, event: 'runEnd' } }
    case 'pass': {
      const pass = schematic.passes.find((p) => p.actionId === hit.actionId)
      return pass
        ? { kind: 'target', target: nearestEnd(pass.actionId, pass.from, pass.to, pos) }
        : { kind: 'none' }
    }
    case 'kick': {
      const kick = schematic.kicks.find((k) => k.actionId === hit.actionId)
      return kick
        ? { kind: 'target', target: nearestEnd(kick.actionId, kick.from, kick.to, pos) }
        : { kind: 'none' }
    }
    case 'kickTarget':
      // The target point of a kick to a point is its arrival.
      return { kind: 'target', target: { actionId: hit.actionId, event: 'arrival' } }
    case 'breakdown':
      return { kind: 'target', target: { actionId: hit.actionId, event: 'formation' } }
    case 'player':
    case 'ball':
      return { kind: 'none' }
  }
}

/** Rendez-vous point of a new link: the selected point of the run, its end otherwise (D-109). */
export function pickRendezVous(
  runId: Id,
  waypointCount: number,
  selected: { actionId: Id; index: number } | null,
): SyncPick {
  if (selected?.actionId !== runId || selected.index >= waypointCount - 1) return { runId }
  return { runId, at: selected.index }
}
