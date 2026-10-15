// Viewport: the only layer that knows pixels (SPEC 3.3.4). It converts metres to pixels, fits a
// frame, and orients the field: landscape keeps x to the right; portrait and square put the
// attack towards the top of the image (DECISIONS Q6). An optional extra rotation of 180° exists
// for lot 2 (landscape GIFs always attacking to the right); it is unused in lot 1.
import { FULL_VIEW_MARGIN } from '../config/defaults'
import type { Bounds } from '../engine/bounds'
import type { FieldView, Team, Vec2 } from '../model/types'

export type Orientation = 'landscape' | 'portrait' | 'square'

export const ORIENTATIONS: readonly Orientation[] = ['landscape', 'portrait', 'square']

export interface ViewportOptions {
  /** Canvas size in device pixels. */
  widthPx: number
  heightPx: number
  /** Multiplier applied to theme sizes (device pixel ratio, export scale). */
  pixelRatio: number
  /** Area in metres that must be fully visible. */
  frame: Bounds
  orientation: Orientation
  attackingTeam: Team
  rotate180?: boolean
}

export interface Viewport {
  readonly widthPx: number
  readonly heightPx: number
  readonly pixelRatio: number
  /** Device pixels per metre. */
  readonly scale: number
  /** Unit screen vectors of the field axes x and y. */
  readonly ex: Vec2
  readonly ey: Vec2
  /** Screen position of the field origin. */
  readonly origin: Vec2
  readonly orientation: Orientation
  readonly attackingTeam: Team
}

/** Screen directions of the field axes for an orientation (always a rotation, never a mirror). */
export function axesFor(
  orientation: Orientation,
  attackingTeam: Team,
  rotate180 = false,
): { ex: Vec2; ey: Vec2 } {
  let ex: Vec2
  let ey: Vec2
  if (orientation === 'landscape') {
    ex = { x: 1, y: 0 }
    ey = { x: 0, y: 1 }
  } else if (attackingTeam === 'A') {
    // +x towards the top of the image.
    ex = { x: 0, y: -1 }
    ey = { x: 1, y: 0 }
  } else {
    // -x towards the top of the image.
    ex = { x: 0, y: 1 }
    ey = { x: -1, y: 0 }
  }
  if (rotate180) {
    ex = { x: -ex.x, y: -ex.y }
    ey = { x: -ey.x, y: -ey.y }
  }
  return { ex, ey }
}

export function createViewport(options: ViewportOptions): Viewport {
  const { widthPx, heightPx, frame, orientation, attackingTeam } = options
  const { ex, ey } = axesFor(orientation, attackingTeam, options.rotate180 ?? false)
  const dx = Math.max(1e-6, frame.max.x - frame.min.x)
  const dy = Math.max(1e-6, frame.max.y - frame.min.y)
  // Extent of the frame on screen, per unit of scale.
  const neededW = Math.abs(ex.x) * dx + Math.abs(ey.x) * dy
  const neededH = Math.abs(ex.y) * dx + Math.abs(ey.y) * dy
  const scale = Math.max(1e-6, Math.min(widthPx / neededW, heightPx / neededH))
  const cx = (frame.min.x + frame.max.x) / 2
  const cy = (frame.min.y + frame.max.y) / 2
  const origin = {
    x: widthPx / 2 - scale * (ex.x * cx + ey.x * cy),
    y: heightPx / 2 - scale * (ex.y * cx + ey.y * cy),
  }
  return {
    widthPx,
    heightPx,
    pixelRatio: options.pixelRatio,
    scale,
    ex,
    ey,
    origin,
    orientation,
    attackingTeam,
  }
}

export function toPx(viewport: Viewport, p: Vec2): Vec2 {
  const { origin, scale, ex, ey } = viewport
  return {
    x: origin.x + scale * (ex.x * p.x + ey.x * p.y),
    y: origin.y + scale * (ex.y * p.x + ey.y * p.y),
  }
}

export function toMeters(viewport: Viewport, px: Vec2): Vec2 {
  const { origin, scale, ex, ey } = viewport
  const dx = (px.x - origin.x) / scale
  const dy = (px.y - origin.y) / scale
  // The axes are orthonormal: project on each of them.
  return { x: dx * ex.x + dy * ex.y, y: dx * ey.x + dy * ey.y }
}

/** Screen direction (unit) of a field vector. */
export function directionPx(viewport: Viewport, v: Vec2): Vec2 {
  const x = viewport.ex.x * v.x + viewport.ey.x * v.y
  const y = viewport.ex.y * v.x + viewport.ey.y * v.y
  const len = Math.hypot(x, y)
  return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 }
}

/** Theme size (CSS pixels at scale 1) in device pixels. */
export function sizePx(viewport: Viewport, cssPixels: number): number {
  return cssPixels * viewport.pixelRatio
}

/** The whole visible area in metres (larger than the frame along one axis when letterboxed). */
export function visibleBounds(viewport: Viewport): Bounds {
  const corners = [
    toMeters(viewport, { x: 0, y: 0 }),
    toMeters(viewport, { x: viewport.widthPx, y: 0 }),
    toMeters(viewport, { x: 0, y: viewport.heightPx }),
    toMeters(viewport, { x: viewport.widthPx, y: viewport.heightPx }),
  ]
  return {
    min: { x: Math.min(...corners.map((c) => c.x)), y: Math.min(...corners.map((c) => c.y)) },
    max: { x: Math.max(...corners.map((c) => c.x)), y: Math.max(...corners.map((c) => c.y)) },
  }
}

export interface FieldSize {
  length: number
  width: number
  inGoal: number
}

/** Frame of a saved view (SPEC 4.1, DECISIONS Q18). */
export function frameForView(view: FieldView, field: FieldSize, attackingTeam: Team): Bounds {
  const m = FULL_VIEW_MARGIN
  const full: Bounds = {
    min: { x: -field.inGoal - m, y: -m },
    max: { x: field.length + field.inGoal + m, y: field.width + m },
  }
  switch (view.kind) {
    case 'full':
      return full
    case 'half': {
      // « attack »: the half containing the goal line attacked by the attacking team.
      const attackedIsHigh = attackingTeam === 'A'
      const high = view.side === 'attack' ? attackedIsHigh : !attackedIsHigh
      const half = field.length / 2
      return high
        ? { min: { x: half - m, y: -m }, max: { x: full.max.x, y: full.max.y } }
        : { min: { x: full.min.x, y: -m }, max: { x: half + m, y: full.max.y } }
    }
    case 'frame':
      return {
        min: { x: Math.min(view.min.x, view.max.x), y: Math.min(view.min.y, view.max.y) },
        max: { x: Math.max(view.min.x, view.max.x), y: Math.max(view.min.y, view.max.y) },
      }
  }
}

/** Frame zoomed by `factor` (> 1 zooms in) around a point in metres. */
export function zoomFrame(frame: Bounds, around: Vec2, factor: number): Bounds {
  const k = 1 / factor
  return {
    min: { x: around.x + (frame.min.x - around.x) * k, y: around.y + (frame.min.y - around.y) * k },
    max: { x: around.x + (frame.max.x - around.x) * k, y: around.y + (frame.max.y - around.y) * k },
  }
}

/** Frame shifted by a vector in metres. */
export function panFrame(frame: Bounds, delta: Vec2): Bounds {
  return {
    min: { x: frame.min.x + delta.x, y: frame.min.y + delta.y },
    max: { x: frame.max.x + delta.x, y: frame.max.y + delta.y },
  }
}
