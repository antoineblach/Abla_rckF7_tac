// Automatic framing of the player (SPEC 7, D-019): bounding box of every position of the line
// being played, plus a 5 m margin.
import { AUTO_FRAME_MARGIN } from '../config/defaults'
import { expandBounds, lineBounds, type Bounds } from '../engine/bounds'
import type { CompiledLine } from '../engine/timeline'

export function autoFrame(compiled: CompiledLine, margin = AUTO_FRAME_MARGIN): Bounds | null {
  const bounds = lineBounds(compiled)
  return bounds ? expandBounds(bounds, margin) : null
}
