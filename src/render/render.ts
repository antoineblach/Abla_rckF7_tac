// render(ctx, state, viewport, theme, layers): draws one image of a scene (SPEC 3.3.2).
// Pure: same inputs, same drawing calls.
import { TEAM_COLORS } from '../config/defaults'
import type { BallState, SceneState } from '../engine/sceneState'
import { drawField } from '../field/drawField'
import { attackDirection, type Id, type Team, type Vec2 } from '../model/types'
import type { Ctx2D } from './ctx2d'
import type { Layers } from './layers'
import {
  arrowAtEnd,
  drawBall,
  drawBanner,
  drawToken,
  fillArrowHead,
  strokePolyline,
  strokePolylinePx,
} from './primitives'
import { mixColors, type Theme } from './themes'
import { directionPx, sizePx, toPx, type Viewport } from './viewport'

export function clearBackground(ctx: Ctx2D, viewport: Viewport, theme: Theme): void {
  ctx.fillStyle = theme.background
  ctx.fillRect(0, 0, viewport.widthPx, viewport.heightPx)
}

/** Gain line in thin dashes, with arrows showing the attack direction (SPEC 5.6, DECISIONS Q6). */
export function drawGainLine(
  ctx: Ctx2D,
  viewport: Viewport,
  theme: Theme,
  x: number,
  field: { width: number },
  attackingTeam: Team,
): void {
  strokePolyline(
    ctx,
    viewport,
    [
      { x, y: 0 },
      { x, y: field.width },
    ],
    { color: theme.gainLine, width: theme.gainLineWidth, dash: theme.gainLineDash },
  )
  const dir = directionPx(viewport, { x: attackDirection(attackingTeam), y: 0 })
  const arrowLength = sizePx(viewport, theme.gainArrowSize) * 3
  for (const y of [field.width * 0.12, field.width * 0.88]) {
    const start = toPx(viewport, { x, y })
    const tip = { x: start.x + dir.x * arrowLength, y: start.y + dir.y * arrowLength }
    strokePolylinePx(ctx, viewport, [start, tip], {
      color: theme.gainLine,
      width: theme.gainLineWidth,
    })
    fillArrowHead(ctx, viewport, start, tip, theme.gainLine, theme.gainArrowSize)
  }
}

/** Colour of an entity, falling back on the team colour. */
export function colorOf(
  players: readonly { id: Id; color: string }[],
  id: Id,
  team: Team = 'A',
): string {
  return players.find((p) => p.id === id)?.color ?? TEAM_COLORS[team]
}

/** Ball drawn against the carrier token, towards the attack (SPEC 5.4). */
export function drawBallState(
  ctx: Ctx2D,
  viewport: Viewport,
  theme: Theme,
  ball: BallState,
  attackingTeam: Team,
): void {
  const attack = directionPx(viewport, { x: attackDirection(attackingTeam), y: 0 })
  switch (ball.kind) {
    case 'carried': {
      const center = toPx(viewport, ball.pos)
      const offset = sizePx(viewport, theme.tokenRadius) + sizePx(viewport, theme.ballLength) * 0.3
      drawBall(
        ctx,
        viewport,
        theme,
        { x: center.x + attack.x * offset, y: center.y + attack.y * offset },
        attack,
      )
      return
    }
    case 'inFlight': {
      const from = toPx(viewport, ball.from)
      const to = toPx(viewport, ball.to)
      const len = Math.hypot(to.x - from.x, to.y - from.y)
      const dir = len > 0 ? { x: (to.x - from.x) / len, y: (to.y - from.y) / len } : attack
      drawBall(ctx, viewport, theme, toPx(viewport, ball.pos), dir)
      return
    }
    case 'loose':
    case 'inBreakdown':
      drawBall(ctx, viewport, theme, toPx(viewport, ball.pos), attack)
      return
  }
}

function drawTraces(ctx: Ctx2D, viewport: Viewport, theme: Theme, state: SceneState): void {
  const tokenRadius = sizePx(viewport, theme.tokenRadius)
  // Previous phases first (faded), then the current phase (emphasised) on top.
  for (const current of [false, true]) {
    for (const trace of state.traces.filter((tr) => tr.current === current)) {
      const base = colorOf(state.players, trace.entityId)
      const color = current ? base : mixColors(base, theme.grass, theme.fadeTowardsGrass)
      strokePolyline(ctx, viewport, trace.points, { color, width: theme.runWidth, cap: 'round' })
      if (trace.completed) {
        arrowAtEnd(ctx, viewport, trace.points, color, theme.arrowSize, tokenRadius)
      }
    }
    for (const pass of state.passTraces.filter((p) => p.current === current)) {
      const color = current
        ? theme.ballFill
        : mixColors(theme.ballFill, theme.grass, theme.fadeTowardsGrass)
      const points: Vec2[] = [pass.from, pass.to]
      strokePolyline(ctx, viewport, points, {
        color,
        width: theme.passWidth,
        dash: theme.passDash,
        cap: 'round',
      })
      if (pass.completed) arrowAtEnd(ctx, viewport, points, color, theme.arrowSize, tokenRadius)
    }
  }
}

export function render(
  ctx: Ctx2D,
  state: SceneState,
  viewport: Viewport,
  theme: Theme,
  layers: Layers,
): void {
  ctx.save()
  clearBackground(ctx, viewport, theme)
  drawField(ctx, viewport, theme, state.field)
  if (layers.gainLine && state.gainLineX !== null) {
    drawGainLine(ctx, viewport, theme, state.gainLineX, state.field, state.attackingTeam)
  }
  if (layers.traces) drawTraces(ctx, viewport, theme, state)
  for (const player of state.players) {
    drawToken(ctx, viewport, theme, toPx(viewport, player.pos), player.color, String(player.number))
  }
  if (state.ball) drawBallState(ctx, viewport, theme, state.ball, state.attackingTeam)
  if (layers.instruction) drawBanner(ctx, viewport, theme, state.instruction)
  ctx.restore()
}
