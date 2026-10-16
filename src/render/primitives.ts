// Drawing primitives, flat colours only (SPEC 3.3.3, 13.3). Positions in metres are converted
// by the viewport; sizes come from the theme in CSS pixels at scale 1.
import type { Team, Vec2 } from '../model/types'
import type { Ctx2D } from './ctx2d'
import type { Theme } from './themes'
import { readableTextColor, tokenFill } from './themes'
import { sizePx, toPx, type ImageFrame, type Viewport } from './viewport'

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

/**
 * Player token: a disc showing only the number (SPEC 6.3), of the player colour or of the colour
 * the theme gives to the team (N&B: A filled black, B hollow, D-062).
 */
export function drawToken(
  ctx: Ctx2D,
  viewport: Viewport,
  theme: Theme,
  centerPx: Vec2,
  team: Team,
  color: string,
  label: string,
): void {
  const fill = tokenFill(theme, team, color)
  const radius = sizePx(viewport, theme.tokenRadius)
  fillCircle(ctx, centerPx, radius, fill)
  strokeCircle(ctx, centerPx, radius, theme.tokenStroke, sizePx(viewport, theme.tokenStrokeWidth))
  ctx.fillStyle = readableTextColor(fill)
  ctx.font = `bold ${sizePx(viewport, theme.tokenFontSize)}px ${theme.font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, centerPx.x, centerPx.y + sizePx(viewport, 0.5))
}

/** Bézier approximation of a quarter circle (control point distance for a unit radius). */
const QUARTER_ARC_KAPPA = 0.5522847498

/**
 * Ellipse path of half axes `a` along `direction` (unit, screen space) and `b` across. Built from
 * four Bézier curves in device pixels, without transformation, so that jsPDF draws it (D-071).
 */
function ellipsePath(ctx: Ctx2D, centerPx: Vec2, a: number, b: number, direction: Vec2): void {
  const len = Math.hypot(direction.x, direction.y)
  const ux = len > 0 ? direction.x / len : 1
  const uy = len > 0 ? direction.y / len : 0
  const k = QUARTER_ARC_KAPPA
  // Point at (s along the long axis, t along the short axis) from the centre.
  const at = (s: number, t: number): Vec2 => ({
    x: centerPx.x + ux * s - uy * t,
    y: centerPx.y + uy * s + ux * t,
  })
  const curve = (c1: Vec2, c2: Vec2, end: Vec2): void => {
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y)
  }
  ctx.beginPath()
  const start = at(a, 0)
  ctx.moveTo(start.x, start.y)
  curve(at(a, k * b), at(k * a, b), at(0, b))
  curve(at(-k * a, b), at(-a, k * b), at(-a, 0))
  curve(at(-a, -k * b), at(-k * a, -b), at(0, -b))
  curve(at(k * a, -b), at(a, -k * b), at(a, 0))
  ctx.closePath()
}

/** Flat filled ellipse (the ground shadow of a kicked ball, D-084). */
export function fillEllipse(
  ctx: Ctx2D,
  centerPx: Vec2,
  a: number,
  b: number,
  direction: Vec2,
  color: string,
): void {
  ellipsePath(ctx, centerPx, a, b, direction)
  ctx.fillStyle = color
  ctx.fill()
}

/**
 * Ball: a flat ellipse whose long axis follows `direction` (unit, screen space), `scale` times its
 * size (a kicked ball grows up to its apex, SPEC 10.4).
 */
export function drawBall(
  ctx: Ctx2D,
  viewport: Viewport,
  theme: Theme,
  centerPx: Vec2,
  direction: Vec2,
  scale = 1,
): void {
  const a = (sizePx(viewport, theme.ballLength) / 2) * scale
  const b = (sizePx(viewport, theme.ballWidth) / 2) * scale
  ellipsePath(ctx, centerPx, a, b, direction)
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

/** Maximum number of lines of the instruction banner (D-041). */
export const BANNER_MAX_LINES = 2

/** Lines of an instruction in the banner, at most two, the last one ellipsed. */
export function bannerLines(
  ctx: Ctx2D,
  viewport: ImageFrame,
  theme: Theme,
  text: string,
): string[] {
  if (text.trim() === '') return []
  const padding = sizePx(viewport, theme.bannerPadding)
  ctx.font = `bold ${sizePx(viewport, theme.bannerFontSize)}px ${theme.font}`
  return wrapText(ctx, text.trim(), viewport.widthPx - 2 * padding, BANNER_MAX_LINES)
}

/** Height in device pixels of a banner of `lines` lines (0 lines: no banner). */
export function bannerHeightPx(viewport: ImageFrame, theme: Theme, lines: number): number {
  if (lines <= 0) return 0
  const fontSize = sizePx(viewport, theme.bannerFontSize)
  return lines * fontSize * 1.25 + 2 * sizePx(viewport, theme.bannerPadding)
}

/**
 * Instruction banner across the image (SPEC 7), at the top or `top` pixels lower (exports: under
 * their header, D-060). `minLines` keeps the same height whatever the text, so that the framing
 * of an export never moves; with `minLines`, the band is drawn even without text.
 */
export function drawBanner(
  ctx: Ctx2D,
  viewport: ImageFrame,
  theme: Theme,
  text: string,
  top = 0,
  minLines = 0,
): void {
  const lines = bannerLines(ctx, viewport, theme, text)
  const count = Math.max(lines.length, minLines)
  if (count === 0) return
  const fontSize = sizePx(viewport, theme.bannerFontSize)
  const padding = sizePx(viewport, theme.bannerPadding)
  const lineHeight = fontSize * 1.25
  ctx.fillStyle = theme.bannerBackground
  ctx.fillRect(0, top, viewport.widthPx, bannerHeightPx(viewport, theme, count))
  ctx.font = `bold ${fontSize}px ${theme.font}`
  ctx.fillStyle = theme.bannerText
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Fewer lines than the band holds: centred vertically in it.
  const offset = ((count - lines.length) * lineHeight) / 2
  lines.forEach((line, i) => {
    ctx.fillText(line, viewport.widthPx / 2, top + offset + padding + lineHeight * (i + 0.5))
  })
}
