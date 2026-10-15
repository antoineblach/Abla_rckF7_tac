// Optional snapping on a 1 m grid (SPEC 6.3).
import { SNAP_GRID_STEP } from '../config/defaults'
import type { Vec2 } from '../model/types'

export function snapToGrid(p: Vec2, step = SNAP_GRID_STEP): Vec2 {
  return { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step }
}

export function maybeSnap(p: Vec2, enabled: boolean): Vec2 {
  return enabled ? snapToGrid(p) : p
}
