// Derived data for display, computed by the engine and the model (never in React components).
import { lineReport, type ActionReport, type LineReport } from '../engine/actionReport'
import { compileLine, intervalIndexAt } from '../engine/timeline'
import { engineIssues } from '../engine/validate'
import { allLines } from '../model/branches'
import { issueKey, type Issue } from '../model/issues'
import { lineOptionsText, sceneHeaderLabel } from '../model/labels'
import type { Settings } from '../model/settings'
import { engineSettingsOf } from '../model/settings'
import {
  isPlayer,
  type Action,
  type Id,
  type Play,
  type PlayerEntity,
  type Vec2,
} from '../model/types'
import { validatePlay } from '../model/validate'
import { appCaches } from './settingsStore'

/** Business and engine issues of the whole play, without duplicates (SPEC 4.3). */
export function playIssues(play: Play, settings: Settings): Issue[] {
  const seen = new Set<string>()
  const result: Issue[] = []
  for (const issue of [
    ...validatePlay(play),
    ...engineIssues(play, engineSettingsOf(settings), appCaches),
  ]) {
    const key = issueKey(issue)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(issue)
    }
  }
  return result
}

export function findAction(play: Play, actionId: Id): Action | null {
  return play.actions.find((a) => a.id === actionId) ?? null
}

/** The lines of a play and their options, for the list « Ligne » (D-142). */
export function lineChoices(play: Play): { line: Id[]; label: string }[] {
  return allLines(play).map((line) => ({ line, label: lineOptionsText(play, line) }))
}

/** « Sortie de mêlée, option B »: the interval at the cursor, empty in a trunk without sequence. */
export function intervalLabelAt(
  play: Play,
  line: readonly Id[],
  t: number,
  settings: Settings,
): string {
  const compiled = compileLine(play, line, engineSettingsOf(settings), appCaches)
  const interval = compiled.intervals[intervalIndexAt(compiled, t)]
  return interval ? sceneHeaderLabel(play, interval.label, interval.branchId) : ''
}

/** Report of the actions of a line (D-113, D-145). */
export function lineReportOf(play: Play, line: readonly Id[], settings: Settings): LineReport {
  return lineReport(play, line, engineSettingsOf(settings), appCaches)
}

/** Report of one action of a line, or null. */
export function actionReportOf(
  play: Play,
  line: readonly Id[],
  actionId: Id,
  settings: Settings,
): ActionReport | null {
  return lineReportOf(play, line, settings).rows.find((r) => r.actionId === actionId) ?? null
}

/** Actions in progress at the cursor, marked in the list (D-145). */
export function actionsInProgress(report: LineReport, t: number): Id[] {
  return report.rows
    .filter((row) => row.applied && row.start <= t && t < row.end)
    .map((row) => row.actionId)
}

/** Computed duration of a run on a line (its length and pace, or the imposed duration). */
export function runDuration(
  play: Play,
  line: readonly Id[],
  actionId: Id,
  settings: Settings,
): number | null {
  const report = actionReportOf(play, line, actionId, settings)
  return report?.kind === 'run' ? report.duration : null
}

/** Landing point of a kick (receiver position at arrival, or its target point), or null. */
export function kickLanding(
  play: Play,
  line: readonly Id[],
  actionId: Id,
  settings: Settings,
): Vec2 | null {
  const compiled = compileLine(play, line, engineSettingsOf(settings), appCaches)
  return compiled.kicks.find((k) => k.actionId === actionId)?.to ?? null
}

/** Players of the same team as `id`, without her, for the lists of the inspector (lot 3). */
export function teammatesOf(play: Play, id: Id): PlayerEntity[] {
  const player = play.entities.find((e) => e.id === id)
  if (!isPlayer(player)) return []
  return play.entities.filter(
    (e): e is PlayerEntity => isPlayer(e) && e.team === player.team && e.id !== id,
  )
}

/** « A 4 »: team and number of a player, or « ? ». */
export function playerName(play: Play, id: Id): string {
  const player = play.entities.find((e) => e.id === id)
  return isPlayer(player) ? `${player.team} ${String(player.number)}` : '?'
}
