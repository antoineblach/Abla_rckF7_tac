// Editor overlay drawn on top of the schematic: selection, waypoint handles, selection box,
// previews of the run and pass tools. Pure drawing, flat colours only.
import type { Bounds } from '../engine/bounds'
import type { Vec2 } from '../model/types'
import type { Ctx2D } from './ctx2d'
import { fillCircle, strokeCircle, strokePolyline } from './primitives'
import type { Theme } from './themes'
import { sizePx, toPx, type Viewport } from './viewport'

export interface EditorOverlay {
  /** Positions (metres) of the selected players, at the start of the displayed phase. */
  selectedPlayers: Vec2[]
  /** Curves (metres) of the selected runs and passes. */
  selectedPaths: Vec2[][]
  /** Waypoint handles (metres) of the runs of the displayed phase. */
  handles: Vec2[]
  /** Rubber-band selection box, in metres. */
  selectionBox: Bounds | null
  /** Preview of the run or pass being drawn, in metres. */
  preview: Vec2[] | null
}

export const EMPTY_OVERLAY: EditorOverlay = {
  selectedPlayers: [],
  selectedPaths: [],
  handles: [],
  selectionBox: null,
  preview: null,
}

export function renderOverlay(
  ctx: Ctx2D,
  viewport: Viewport,
  theme: Theme,
  overlay: EditorOverlay,
): void {
  ctx.save()
  const selection = { color: theme.selection, width: theme.selectionWidth, cap: 'round' as const }
  for (const path of overlay.selectedPaths) {
    strokePolyline(ctx, viewport, path, { ...selection, width: theme.runWidth + 3 })
  }
  const ringRadius = sizePx(viewport, theme.tokenRadius + 4)
  for (const pos of overlay.selectedPlayers) {
    strokeCircle(
      ctx,
      toPx(viewport, pos),
      ringRadius,
      theme.selection,
      sizePx(viewport, theme.selectionWidth),
    )
  }
  const handleRadius = sizePx(viewport, theme.handleRadius)
  for (const handle of overlay.handles) {
    const center = toPx(viewport, handle)
    fillCircle(ctx, center, handleRadius, theme.handleFill)
    strokeCircle(ctx, center, handleRadius, theme.handleStroke, sizePx(viewport, 1.5))
  }
  if (overlay.preview && overlay.preview.length >= 2) {
    strokePolyline(ctx, viewport, overlay.preview, { ...selection, dash: [6, 4] })
  }
  if (overlay.selectionBox) {
    const { min, max } = overlay.selectionBox
    strokePolyline(ctx, viewport, [min, { x: max.x, y: min.y }, max, { x: min.x, y: max.y }, min], {
      ...selection,
      dash: [4, 4],
      cap: 'butt',
    })
  }
  ctx.restore()
}
