// renderSchematic: one phase at rest (SPEC 3.3.2, 6.3, DECISIONS Q3). Start positions in full,
// the actions of the phase with their arrows, the trajectories of the ancestor phases greyed.
// Arrows end exactly on the end points: no token stands there at rest.
import type { EvalCaches } from '../engine/caches'
import { phaseSchematic, type PhaseSchematic } from '../engine/evaluate'
import { drawField } from '../field/drawField'
import type { EngineSettings } from '../model/settings'
import type { Id, Play } from '../model/types'
import type { Ctx2D } from './ctx2d'
import { arrowAtEnd, drawToken, strokePolyline } from './primitives'
import {
  clearBackground,
  colorOf,
  drawBallState,
  drawBreakdownLabel,
  drawBreakdownRing,
  drawForwardBadge,
  drawGainLine,
  drawKickPath,
} from './render'
import { runColor, type Theme } from './themes'
import { toPx, type Viewport } from './viewport'

export interface SchematicOptions {
  /**
   * Badge of the forward passes: shown by the editor (D-085), never in the exports nor in the
   * library thumbnails (D-086).
   */
  forwardPass: boolean
}

const NO_BADGE: SchematicOptions = { forwardPass: false }

/** Draws already computed schematic data (the editor reuses it for hit tests). */
export function drawSchematic(
  ctx: Ctx2D,
  schematic: PhaseSchematic,
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
  for (const run of schematic.ancestorRuns) strokePolyline(ctx, viewport, run.points, ghost)
  for (const pass of schematic.ancestorPasses) {
    strokePolyline(ctx, viewport, [pass.from, pass.to], { ...ghost, dash: theme.passDash })
  }
  for (const kick of schematic.ancestorKicks) {
    strokePolyline(ctx, viewport, [kick.from, kick.to], { ...ghost, dash: theme.kickDash })
  }
  for (const breakdown of schematic.ancestorBreakdowns) {
    drawBreakdownRing(ctx, viewport, theme, breakdown.pos, theme.ghost)
  }
  for (const run of [...schematic.runs, ...schematic.relays]) {
    const color = runColor(theme, colorOf(schematic.players, run.entityId))
    strokePolyline(ctx, viewport, run.points, { color, width: theme.runWidth, cap: 'round' })
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
  ctx.restore()
}

export function renderSchematic(
  ctx: Ctx2D,
  play: Play,
  _branchPath: readonly Id[],
  phaseId: Id,
  viewport: Viewport,
  theme: Theme,
  settings: EngineSettings,
  caches: EvalCaches,
  options: SchematicOptions = NO_BADGE,
): void {
  const schematic = phaseSchematic(play, phaseId, settings, caches)
  if (!schematic) {
    clearBackground(ctx, viewport, theme)
    drawField(ctx, viewport, theme, play.field)
    return
  }
  drawSchematic(ctx, schematic, viewport, theme, options)
}
