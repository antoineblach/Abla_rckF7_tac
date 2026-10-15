// Field drawing (SPEC 13.1): flat surfaces, solid and dashed lines, halfway mark, posts.
import type { Vec2 } from '../model/types'
import type { Ctx2D } from '../render/ctx2d'
import { fillCircle, strokePolyline } from '../render/primitives'
import type { Theme } from '../render/themes'
import { sizePx, toPx, type Viewport } from '../render/viewport'
import { fieldMarkings, type FieldDimensions } from './geometry'

function fillRectMeters(ctx: Ctx2D, viewport: Viewport, min: Vec2, max: Vec2, color: string): void {
  const corners = [min, { x: max.x, y: min.y }, max, { x: min.x, y: max.y }].map((p) =>
    toPx(viewport, p),
  )
  ctx.fillStyle = color
  ctx.beginPath()
  corners.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  })
  ctx.closePath()
  ctx.fill()
}

export function drawField(
  ctx: Ctx2D,
  viewport: Viewport,
  theme: Theme,
  field: FieldDimensions,
): void {
  const markings = fieldMarkings(field)
  fillRectMeters(ctx, viewport, markings.surface.min, markings.surface.max, theme.grass)
  for (const inGoal of markings.inGoals)
    fillRectMeters(ctx, viewport, inGoal.min, inGoal.max, theme.inGoal)
  const line = { color: theme.fieldLine, width: theme.fieldLineWidth, cap: 'butt' as const }
  for (const segment of markings.solid) strokePolyline(ctx, viewport, [segment.a, segment.b], line)
  for (const dash of markings.dashes) strokePolyline(ctx, viewport, [dash.a, dash.b], line)
  strokePolyline(ctx, viewport, [markings.halfwayMark.a, markings.halfwayMark.b], line)
  const postRadius = sizePx(viewport, theme.postRadius)
  for (const post of markings.posts)
    fillCircle(ctx, toPx(viewport, post), postRadius, theme.fieldLine)
}
