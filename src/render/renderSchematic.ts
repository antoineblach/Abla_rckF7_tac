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
import { clearBackground, colorOf, drawBallState, drawGainLine } from './render'
import type { Theme } from './themes'
import { toPx, type Viewport } from './viewport'

/** Draws already computed schematic data (the editor reuses it for hit tests). */
export function drawSchematic(
  ctx: Ctx2D,
  schematic: PhaseSchematic,
  viewport: Viewport,
  theme: Theme,
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
  for (const run of schematic.ancestorRuns) {
    strokePolyline(ctx, viewport, run.points, {
      color: theme.ghost,
      width: theme.ghostWidth,
      cap: 'round',
    })
  }
  for (const pass of schematic.ancestorPasses) {
    strokePolyline(ctx, viewport, [pass.from, pass.to], {
      color: theme.ghost,
      width: theme.ghostWidth,
      dash: theme.passDash,
      cap: 'round',
    })
  }
  for (const run of schematic.runs) {
    const color = colorOf(schematic.players, run.entityId)
    strokePolyline(ctx, viewport, run.points, { color, width: theme.runWidth, cap: 'round' })
    arrowAtEnd(ctx, viewport, run.points, color, theme.arrowSize)
  }
  for (const pass of schematic.passes) {
    const color = pass.applied ? theme.ballFill : theme.error
    const points = [pass.from, pass.to]
    strokePolyline(ctx, viewport, points, {
      color,
      width: theme.passWidth,
      dash: theme.passDash,
      cap: 'round',
    })
    arrowAtEnd(ctx, viewport, points, color, theme.arrowSize)
  }
  for (const player of schematic.players) {
    drawToken(ctx, viewport, theme, toPx(viewport, player.pos), player.color, String(player.number))
  }
  if (schematic.ball) {
    drawBallState(ctx, viewport, theme, schematic.ball, schematic.attackingTeam)
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
): void {
  const schematic = phaseSchematic(play, phaseId, settings, caches)
  if (!schematic) {
    clearBackground(ctx, viewport, theme)
    drawField(ctx, viewport, theme, play.field)
    return
  }
  drawSchematic(ctx, schematic, viewport, theme)
}
