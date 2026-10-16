// Bounding box of everything that moves on a line (automatic framing, SPEC 7).
import type { Vec2 } from '../model/types'
import type { CompiledLine } from './timeline'

export interface Bounds {
  min: Vec2
  max: Vec2
}

export function boundsOfPoints(points: Iterable<Vec2>): Bounds | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (minX === Infinity) return null
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } }
}

/**
 * All positions of the line: starting positions, sampled runs (relays and ignored parts
 * included), pass and kick end points, breakdowns and loose balls.
 */
export function lineBounds(compiled: CompiledLine): Bounds | null {
  function* points(): Generator<Vec2> {
    for (const phase of compiled.phases) {
      yield* Object.values(phase.startPositions)
      yield* Object.values(phase.endPositions)
      for (const motion of [...phase.motions, ...phase.ignoredRuns]) yield* motion.spline.samples
      for (const pass of phase.passes) {
        yield pass.from
        yield pass.to
      }
      for (const kick of phase.kicks) {
        yield kick.from
        yield kick.to
      }
      for (const breakdown of phase.breakdowns) yield breakdown.pos
      for (const segment of phase.ball) if (segment.kind === 'loose') yield segment.pos
    }
  }
  return boundsOfPoints(points())
}

export function expandBounds(bounds: Bounds, margin: number): Bounds {
  return {
    min: { x: bounds.min.x - margin, y: bounds.min.y - margin },
    max: { x: bounds.max.x + margin, y: bounds.max.y + margin },
  }
}

export function unionBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b
  if (!b) return a
  return {
    min: { x: Math.min(a.min.x, b.min.x), y: Math.min(a.min.y, b.min.y) },
    max: { x: Math.max(a.max.x, b.max.x), y: Math.max(a.max.y, b.max.y) },
  }
}
