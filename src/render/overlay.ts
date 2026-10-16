// Editor overlay drawn on top of the schematic: selection, waypoint handles, selection box,
// previews of the tools, ghost tokens and anchor of a placement (lot 3). Pure drawing, flat
// colours only.
import type { Bounds } from '../engine/bounds'
import type { Team, Vec2 } from '../model/types'
import type { Ctx2D } from './ctx2d'
import {
  fillArrowHead,
  fillCircle,
  strokeCircle,
  strokePolyline,
  strokePolylinePx,
} from './primitives'
import type { Theme } from './themes'
import { sizePx, toPx, type Viewport } from './viewport'

/** Token previewed by a placement (preset or move), drawn hollow in the selection colour. */
export interface GhostToken {
  pos: Vec2
  team: Team
  label: string
}

/** Anchor of a preset under the pointer, with the axes of its local frame (SPEC 10.1). */
export interface AnchorMark {
  pos: Vec2
  /** Refused anchor (lineout less than 5 m from a goal line): drawn as a cross of the error colour. */
  refused: boolean
  /** Unit vectors (field frame) of « forward » and « towards the open side », or null. */
  axes: { forward: Vec2; openSide: Vec2 } | null
}

export interface EditorOverlay {
  /** Positions (metres) of the selected players, at the start of the displayed phase. */
  selectedPlayers: Vec2[]
  /** Curves (metres) of the selected runs and passes. */
  selectedPaths: Vec2[][]
  /** Waypoint handles (metres) of the runs of the displayed phase. */
  handles: Vec2[]
  /** Rubber-band selection box, in metres. */
  selectionBox: Bounds | null
  /** Preview of the run, pass or kick being drawn, in metres. */
  preview: Vec2[] | null
  ghosts: GhostToken[]
  anchor: AnchorMark | null
}

export const EMPTY_OVERLAY: EditorOverlay = {
  selectedPlayers: [],
  selectedPaths: [],
  handles: [],
  selectionBox: null,
  preview: null,
  ghosts: [],
  anchor: null,
}

/** Length of the axes of an anchor mark, in metres. */
const AXIS_LENGTH = 5

function drawAnchor(ctx: Ctx2D, viewport: Viewport, theme: Theme, anchor: AnchorMark): void {
  const center = toPx(viewport, anchor.pos)
  const arm = sizePx(viewport, theme.handleRadius) * 1.6
  const color = anchor.refused ? theme.error : theme.selection
  const style = { color, width: theme.selectionWidth, cap: 'round' as const }
  if (anchor.refused) {
    strokePolylinePx(
      ctx,
      viewport,
      [
        { x: center.x - arm, y: center.y - arm },
        { x: center.x + arm, y: center.y + arm },
      ],
      style,
    )
    strokePolylinePx(
      ctx,
      viewport,
      [
        { x: center.x - arm, y: center.y + arm },
        { x: center.x + arm, y: center.y - arm },
      ],
      style,
    )
    return
  }
  strokePolylinePx(
    ctx,
    viewport,
    [
      { x: center.x - arm, y: center.y },
      { x: center.x + arm, y: center.y },
    ],
    style,
  )
  strokePolylinePx(
    ctx,
    viewport,
    [
      { x: center.x, y: center.y - arm },
      { x: center.x, y: center.y + arm },
    ],
    style,
  )
  if (!anchor.axes) return
  for (const axis of [anchor.axes.forward, anchor.axes.openSide]) {
    const tip = toPx(viewport, {
      x: anchor.pos.x + axis.x * AXIS_LENGTH,
      y: anchor.pos.y + axis.y * AXIS_LENGTH,
    })
    strokePolylinePx(ctx, viewport, [center, tip], style)
    fillArrowHead(ctx, viewport, center, tip, color, theme.arrowSize)
  }
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
  const tokenRadius = sizePx(viewport, theme.tokenRadius)
  for (const ghost of overlay.ghosts) {
    const center = toPx(viewport, ghost.pos)
    strokeCircle(ctx, center, tokenRadius, theme.selection, sizePx(viewport, theme.selectionWidth))
    ctx.fillStyle = theme.selection
    ctx.font = `bold ${sizePx(viewport, theme.tokenFontSize)}px ${theme.font}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(ghost.label, center.x, center.y + sizePx(viewport, 0.5))
  }
  if (overlay.anchor) drawAnchor(ctx, viewport, theme, overlay.anchor)
  ctx.restore()
}
