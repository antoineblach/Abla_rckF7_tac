// Drawing primitives, flat colours only (SPEC 3.3.3, 13.3). Positions in metres are converted
// by the viewport; sizes come from the theme in CSS pixels at scale 1.
import type { Vec2 } from '../model/types'
import type { Ctx2D } from './ctx2d'
import type { Theme } from './themes'
import { readableTextColor } from './themes'
import { sizePx, toPx, type Viewport } from './viewport'

export interface StrokeStyle {
  color: string
  /** CSS pixels at scale 1. */
  width: number
  /** Dash pattern in CSS pixels at scale 1; empty for a solid line. */
  dash?: readonly number[]
  cap?: 'butt' | 'round' | 'square'
}

function applyStroke(ctx: Ctx2D, viewport: Viewport, style: StrokeStyle): void {
  ctx.strokeStyle = style.color
  ctx.lineWidth = sizePx(viewport, style.width)
  ctx.lineCap = style.cap ?? 'butt'
  ctx.lineJoin = 'round'
  ctx.setLineDash((style.dash ?? []).map((d) => sizePx(viewport, d)))
}

/** Polyline through points in metres. */
export function strokePolyline(
  ctx: Ctx2D,
  viewport: Viewport,
  points: readonly Vec2[],
  style: StrokeStyle,
): void {
  const first = points[0]
  if (!first || points.length < 2) return
  applyStroke(ctx, viewport, style)
  ctx.beginPath()
  const p0 = toPx(viewport, first)
  ctx.moveTo(p0.x, p0.y)
  for (let i = 1; i < points.length; i++) {
    const p = toPx(viewport, points[i] as Vec2)
    ctx.lineTo(p.x, p.y)
  }
  ctx.stroke()
  ctx.setLineDash([])
}

/** Polyline through points already in device pixels. */
export function strokePolylinePx(
  ctx: Ctx2D,
  viewport: Viewport,
  points: readonly Vec2[],
  style: StrokeStyle,
): void {
  const first = points[0]
  if (!first || points.length < 2) return
  applyStroke(ctx, viewport, style)
  ctx.beginPath()
  ctx.moveTo(first.x, first.y)
  for (let i = 1; i < points.length; i++) {
    const p = points[i] as Vec2
    ctx.lineTo(p.x, p.y)
  }
  ctx.stroke()
  ctx.setLineDash([])
}

/**
 * Filled arrow head whose tip is at `tipPx`, pointing along the direction from `fromPx` to `tipPx`.
 * `backOff` (device pixels) moves the tip back, for example to stop at the edge of a token.
 */
export function fillArrowHead(
  ctx: Ctx2D,
  viewport: Viewport,
  fromPx: Vec2,
  tipPx: Vec2,
  color: string,
  sizeCss: number,
  backOff = 0,
): void {
  const dx = tipPx.x - fromPx.x
  const dy = tipPx.y - fromPx.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return
  const ux = dx / len
  const uy = dy / len
  const size = sizePx(viewport, sizeCss)
  const tip = { x: tipPx.x - ux * backOff, y: tipPx.y - uy * backOff }
  const base = { x: tip.x - ux * size, y: tip.y - uy * size }
  const half = size * 0.5
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  ctx.lineTo(base.x - uy * half, base.y + ux * half)
  ctx.lineTo(base.x + uy * half, base.y - ux * half)
  ctx.closePath()
  ctx.fill()
}

/** Arrow head at the end of a polyline in metres, using the last non-degenerate direction. */
export function arrowAtEnd(
  ctx: Ctx2D,
  viewport: Viewport,
  points: readonly Vec2[],
  color: string,
  sizeCss: number,
  backOff = 0,
): void {
  const last = points[points.length - 1]
  if (!last) return
  const tip = toPx(viewport, last)
  const minDistance = sizePx(viewport, sizeCss) * 0.5
  for (let i = points.length - 2; i >= 0; i--) {
    const from = toPx(viewport, points[i] as Vec2)
    if (Math.hypot(tip.x - from.x, tip.y - from.y) >= minDistance) {
      fillArrowHead(ctx, viewport, from, tip, color, sizeCss, backOff)
      return
    }
  }
}

export function fillCircle(ctx: Ctx2D, center: Vec2, radius: number, color: string): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
  ctx.fill()
}

export function strokeCircle(
  ctx: Ctx2D,
  center: Vec2,
  radius: number,
  color: string,
  width: number,
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
  ctx.stroke()
}

/** Player token: a disc of the player colour showing only the number (SPEC 6.3). */
export function drawToken(
  ctx: Ctx2D,
  viewport: Viewport,
  theme: Theme,
  centerPx: Vec2,
  color: string,
  label: string,
): void {
  const radius = sizePx(viewport, theme.tokenRadius)
  fillCircle(ctx, centerPx, radius, color)
  strokeCircle(ctx, centerPx, radius, theme.tokenStroke, sizePx(viewport, theme.tokenStrokeWidth))
  ctx.fillStyle = readableTextColor(color)
  ctx.font = `bold ${sizePx(viewport, theme.tokenFontSize)}px ${theme.font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, centerPx.x, centerPx.y + sizePx(viewport, 0.5))
}

/** Ball: a flat ellipse whose long axis follows `direction` (unit, screen space). */
export function drawBall(
  ctx: Ctx2D,
  viewport: Viewport,
  theme: Theme,
  centerPx: Vec2,
  direction: Vec2,
): void {
  const length = sizePx(viewport, theme.ballLength)
  const width = sizePx(viewport, theme.ballWidth)
  ctx.save()
  ctx.translate(centerPx.x, centerPx.y)
  ctx.rotate(Math.atan2(direction.y, direction.x))
  ctx.scale(1, width / length)
  ctx.beginPath()
  ctx.arc(0, 0, length / 2, 0, Math.PI * 2)
  ctx.restore()
  ctx.fillStyle = theme.ballFill
  ctx.fill()
  ctx.strokeStyle = theme.ballStroke
  ctx.lineWidth = sizePx(viewport, theme.ballStrokeWidth)
  ctx.setLineDash([])
  ctx.stroke()
}

/** Splits a text into at most `maxLines` lines that fit `maxWidth` (device pixels). */
export function wrapText(ctx: Ctx2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`
    if (ctx.measureText(candidate).width <= maxWidth || current === '') {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current !== '') lines.push(current)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = `${kept[maxLines - 1] ?? ''}…`
  return kept
}

/** Instruction banner across the top of the image (SPEC 7). */
export function drawBanner(ctx: Ctx2D, viewport: Viewport, theme: Theme, text: string): void {
  if (text.trim() === '') return
  const fontSize = sizePx(viewport, theme.bannerFontSize)
  const padding = sizePx(viewport, theme.bannerPadding)
  ctx.font = `bold ${fontSize}px ${theme.font}`
  const lines = wrapText(ctx, text.trim(), viewport.widthPx - 2 * padding, 2)
  const lineHeight = fontSize * 1.25
  const height = lines.length * lineHeight + 2 * padding
  ctx.fillStyle = theme.bannerBackground
  ctx.fillRect(0, 0, viewport.widthPx, height)
  ctx.fillStyle = theme.bannerText
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((line, i) => {
    ctx.fillText(line, viewport.widthPx / 2, padding + lineHeight * (i + 0.5))
  })
}
