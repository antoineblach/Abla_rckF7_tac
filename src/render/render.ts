// render(ctx, state, viewport, theme, layers): draws one image of a scene (SPEC 3.3.2).
// Pure: same inputs, same drawing calls.
import { KICK_APEX_SCALE, TEAM_COLORS } from '../config/defaults'
import type { BallState, SceneState } from '../engine/sceneState'
import { drawField } from '../field/drawField'
import { BREAKDOWN_KIND_LABELS } from '../model/labels'
import { attackDirection, type BreakdownKind, type Id, type Team, type Vec2 } from '../model/types'
import type { Ctx2D } from './ctx2d'
import type { Layers } from './layers'
import {
  arrowAtEnd,
  drawBall,
  drawBanner,
  drawToken,
  fillArrowHead,
  fillCircle,
  fillEllipse,
  strokeCircle,
  strokePolyline,
  strokePolylinePx,
} from './primitives'
import { mixColors, runColor, type Theme } from './themes'
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
      const center = toPx(viewport, ball.pos)
      if (ball.via === 'kick' && ball.lift > 0) {
        // Ground shadow, offset towards the bottom right with the height (D-084).
        const offset = sizePx(viewport, theme.kickShadowOffset) * ball.lift
        fillEllipse(
          ctx,
          { x: center.x + offset, y: center.y + offset },
          sizePx(viewport, theme.ballLength) / 2,
          sizePx(viewport, theme.ballWidth) / 2,
          dir,
          theme.kickShadow,
        )
      }
      const scale = ball.via === 'kick' ? 1 + (KICK_APEX_SCALE - 1) * ball.lift : 1
      drawBall(ctx, viewport, theme, center, dir, scale)
      return
    }
    case 'loose':
      drawBall(ctx, viewport, theme, toPx(viewport, ball.pos), attack)
      return
    case 'inBreakdown': {
      // Placed back, behind the tackled player, so that her number stays readable.
      const center = toPx(viewport, ball.pos)
      const offset = sizePx(viewport, theme.tokenRadius) + sizePx(viewport, theme.ballLength) * 0.3
      drawBall(
        ctx,
        viewport,
        theme,
        { x: center.x - attack.x * offset, y: center.y - attack.y * offset },
        attack,
      )
      return
    }
  }
}

/** Kick in long dashes (SPEC 13.3), a small circle on a target point (D-084). */
export function drawKickPath(
  ctx: Ctx2D,
  viewport: Viewport,
  theme: Theme,
  from: Vec2,
  to: Vec2,
  color: string,
  arrow: { backOff: number } | null,
  targetPoint: Vec2 | null,
): void {
  const points = [from, to]
  strokePolyline(ctx, viewport, points, { color, width: theme.kickWidth, dash: theme.kickDash })
  if (arrow) arrowAtEnd(ctx, viewport, points, color, theme.arrowSize, arrow.backOff)
  if (targetPoint) {
    strokeCircle(
      ctx,
      toPx(viewport, targetPoint),
      sizePx(viewport, theme.arrowSize) * 0.6,
      color,
      sizePx(viewport, theme.kickWidth),
    )
  }
}

/** Ring of a ruck or a maul around its point (D-084). */
export function drawBreakdownRing(
  ctx: Ctx2D,
  viewport: Viewport,
  theme: Theme,
  pos: Vec2,
  color: string,
): void {
  strokeCircle(
    ctx,
    toPx(viewport, pos),
    sizePx(viewport, theme.tokenRadius) * 2,
    color,
    sizePx(viewport, theme.breakdownWidth),
  )
}

/** Label « Ruck » or « Maul » above the ring (D-084). */
export function drawBreakdownLabel(
  ctx: Ctx2D,
  viewport: Viewport,
  theme: Theme,
  pos: Vec2,
  kind: BreakdownKind,
  color: string,
): void {
  const center = toPx(viewport, pos)
  const radius = sizePx(viewport, theme.tokenRadius) * 2
  ctx.fillStyle = color
  ctx.font = `bold ${sizePx(viewport, theme.tokenFontSize)}px ${theme.font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(BREAKDOWN_KIND_LABELS[kind], center.x, center.y - radius - sizePx(viewport, 2))
}

/** Badge « ! » in the middle of a forward pass (SPEC 10.5, D-084). */
export function drawForwardBadge(
  ctx: Ctx2D,
  viewport: Viewport,
  theme: Theme,
  from: Vec2,
  to: Vec2,
): void {
  const center = toPx(viewport, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 })
  const radius = sizePx(viewport, theme.tokenRadius) * 0.75
  fillCircle(ctx, center, radius, theme.forwardFill)
  strokeCircle(ctx, center, radius, theme.forwardText, sizePx(viewport, theme.tokenStrokeWidth))
  ctx.fillStyle = theme.forwardText
  ctx.font = `bold ${sizePx(viewport, theme.tokenFontSize)}px ${theme.font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('!', center.x, center.y + sizePx(viewport, 0.5))
}

function drawTraces(ctx: Ctx2D, viewport: Viewport, theme: Theme, state: SceneState): void {
  const tokenRadius = sizePx(viewport, theme.tokenRadius)
  // Previous phases first (faded), then the current phase (emphasised) on top.
  for (const current of [false, true]) {
    for (const trace of state.traces.filter((tr) => tr.current === current)) {
      const base = runColor(theme, colorOf(state.players, trace.entityId))
      const color = current ? base : mixColors(base, theme.grass, theme.fadeTowardsGrass)
      strokePolyline(ctx, viewport, trace.points, { color, width: theme.runWidth, cap: 'round' })
      if (trace.completed) {
        arrowAtEnd(ctx, viewport, trace.points, color, theme.arrowSize, tokenRadius)
      }
    }
    for (const pass of state.passTraces.filter((p) => p.current === current)) {
      const color = current
        ? theme.passColor
        : mixColors(theme.passColor, theme.grass, theme.fadeTowardsGrass)
      const points: Vec2[] = [pass.from, pass.to]
      strokePolyline(ctx, viewport, points, {
        color,
        width: theme.passWidth,
        dash: theme.passDash,
        cap: 'round',
      })
      if (pass.completed) arrowAtEnd(ctx, viewport, points, color, theme.arrowSize, tokenRadius)
    }
    for (const kick of state.kickTraces.filter((k) => k.current === current)) {
      const color = current
        ? theme.passColor
        : mixColors(theme.passColor, theme.grass, theme.fadeTowardsGrass)
      drawKickPath(
        ctx,
        viewport,
        theme,
        kick.from,
        kick.to,
        color,
        kick.completed ? { backOff: kick.toPoint ? 0 : tokenRadius } : null,
        kick.toPoint ? kick.target : null,
      )
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
  for (const breakdown of state.breakdowns) {
    drawBreakdownRing(ctx, viewport, theme, breakdown.pos, theme.breakdownColor)
  }
  for (const player of state.players) {
    drawToken(
      ctx,
      viewport,
      theme,
      toPx(viewport, player.pos),
      player.team,
      player.color,
      String(player.number),
    )
  }
  for (const breakdown of state.breakdowns) {
    drawBreakdownLabel(ctx, viewport, theme, breakdown.pos, breakdown.kind, theme.breakdownColor)
  }
  if (state.ball) drawBallState(ctx, viewport, theme, state.ball, state.attackingTeam)
  if (layers.forwardPass) {
    for (const pass of state.passTraces) {
      if (pass.forward) drawForwardBadge(ctx, viewport, theme, pass.from, pass.target)
    }
  }
  if (layers.instruction) drawBanner(ctx, viewport, theme, state.instruction)
  ctx.restore()
}
