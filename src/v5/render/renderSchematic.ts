// renderSchematic: the field at rest at an instant (SPEC 3.3.2, 6.3, D-139). Positions at t, the
// actions of the window with their arrows, earlier trajectories greyed, later ones absent. Arrows
// end exactly on the end points: a token standing there at t covers its own arrow head.
import type { EngineSettings } from '../../model/settings'
import type { Ctx2D } from '../../render/ctx2d'
import { arrowAtEnd, drawToken, strokePolyline } from '../../render/primitives'
import { runColor, type Theme } from '../../render/themes'
import { toPx, type Viewport } from '../../render/viewport'
import type { EvalCaches } from '../engine/caches'
import { windowSchematic, type WindowSchematic } from '../engine/evaluate'
import { drawField } from '../../field/drawField'
import type { Id, Play } from '../model/types'
import {
  clearBackground,
  colorOf,
  drawBallState,
  drawBreakdownLabel,
  drawBreakdownRing,
  drawForwardBadge,
  drawGainLine,
  drawKickPath,
  drawRunParts,
  drawSpeedBadge,
} from './render'

export interface SchematicOptions {
  /**
   * Badge of the forward passes: shown by the editor (D-085), never in the exports nor in the
   * library thumbnails (D-086).
   */
  forwardPass: boolean
  /** Badges of the speed thresholds: the editor only, like the forward passes (D-112). */
  speedBadges: boolean
}

const NO_BADGE: SchematicOptions = { forwardPass: false, speedBadges: false }

/** Draws already computed schematic data (the editor reuses it for hit tests). */
export function drawSchematic(
  ctx: Ctx2D,
  schematic: WindowSchematic,
  viewport: Viewport,
  theme: Theme,
  options: SchematicOptions = NO_BADGE,
): void {
  ctx.save()
  clearBackground(ctx, viewport, theme)
  drawField(ctx, viewport, theme, schematic.field)
  if (schematic.gainLineX !== null) {
    drawGainLine(
      ctx,
      viewport,
      theme,
      schematic.gainLineX,
      schematic.field,
      schematic.attackingTeam,
    )
  }
  const ghost = { color: theme.ghost, width: theme.ghostWidth, cap: 'round' as const }
  for (const run of schematic.earlierRuns) strokePolyline(ctx, viewport, run.points, ghost)
  for (const pass of schematic.earlierPasses) {
    strokePolyline(ctx, viewport, [pass.from, pass.to], { ...ghost, dash: theme.passDash })
  }
  for (const kick of schematic.earlierKicks) {
    strokePolyline(ctx, viewport, [kick.from, kick.to], { ...ghost, dash: theme.kickDash })
  }
  for (const breakdown of schematic.earlierBreakdowns) {
    drawBreakdownRing(ctx, viewport, theme, breakdown.pos, theme.ghost)
  }
  for (const run of [...schematic.runs, ...schematic.relays]) {
    const color = runColor(theme, colorOf(schematic.players, run.entityId))
    drawRunParts(ctx, viewport, theme, run.parts, color)
    if (run.ignoredPoints.length === 0)
      arrowAtEnd(ctx, viewport, run.points, color, theme.arrowSize)
    // Part of a run ignored after a breakdown formation (D-079).
    strokePolyline(ctx, viewport, run.ignoredPoints, {
      color: theme.error,
      width: theme.ghostWidth,
      cap: 'round',
    })
  }
  for (const pass of schematic.passes) {
    const color = pass.applied ? theme.passColor : theme.error
    const points = [pass.from, pass.to]
    strokePolyline(ctx, viewport, points, {
      color,
      width: theme.passWidth,
      dash: theme.passDash,
      cap: 'round',
    })
    arrowAtEnd(ctx, viewport, points, color, theme.arrowSize)
  }
  for (const kick of schematic.kicks) {
    const color = kick.applied ? theme.passColor : theme.error
    const target = kick.receiverId === null ? kick.to : null
    drawKickPath(ctx, viewport, theme, kick.from, kick.to, color, { backOff: 0 }, target)
  }
  for (const breakdown of schematic.breakdowns) {
    const color = breakdown.applied ? theme.breakdownColor : theme.error
    drawBreakdownRing(ctx, viewport, theme, breakdown.pos, color)
  }
  for (const player of schematic.players) {
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
  for (const breakdown of schematic.breakdowns) {
    const color = breakdown.applied ? theme.breakdownColor : theme.error
    drawBreakdownLabel(ctx, viewport, theme, breakdown.pos, breakdown.kind, color)
  }
  if (schematic.ball) {
    drawBallState(ctx, viewport, theme, schematic.ball, schematic.attackingTeam)
  }
  if (options.forwardPass) {
    for (const pass of schematic.passes) {
      if (pass.forward) drawForwardBadge(ctx, viewport, theme, pass.from, pass.to)
    }
  }
  if (options.speedBadges) {
    for (const badge of schematic.speedBadges) drawSpeedBadge(ctx, viewport, theme, badge)
  }
  ctx.restore()
}

export function renderSchematic(
  ctx: Ctx2D,
  play: Play,
  line: readonly Id[],
  t: number,
  viewport: Viewport,
  theme: Theme,
  settings: EngineSettings,
  caches: EvalCaches,
  options: SchematicOptions = NO_BADGE,
): void {
  drawSchematic(ctx, windowSchematic(play, line, t, settings, caches), viewport, theme, options)
}
