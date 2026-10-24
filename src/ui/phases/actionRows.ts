// Rows of the list of the actions of a phase (SPEC 6.7, D-113), from the report of the engine and
// the issues of the play. Pure.
import type { ActionReport, PhaseReport } from '../../engine/actionReport'
import type { Issue } from '../../model/issues'
import type { Id, Play } from '../../model/types'
import { actionDetails, actionSummary, actionTitle } from '../describe'

export interface ActionRow {
  actionId: Id
  kind: ActionReport['kind']
  title: string
  summary: string
  /** Every detail, for the tooltip. */
  details: string[]
  /** Start and end relative to the phase, in seconds. */
  start: number
  end: number
  /** Never played (second run, passer without the ball...): marked as an error. */
  ignored: boolean
  issues: Issue[]
}

export interface ActionRows {
  phaseId: Id
  duration: number
  rows: ActionRow[]
}

export function actionRows(play: Play, report: PhaseReport, issues: readonly Issue[]): ActionRows {
  const actions = play.phases.find((p) => p.id === report.phaseId)?.actions ?? []
  return {
    phaseId: report.phaseId,
    duration: report.duration,
    rows: report.rows.map((row) => {
      const action = actions.find((a) => a.id === row.actionId)
      const link =
        action?.type === 'run' && action.sync ? { sync: action.sync, delay: action.delay } : null
      const delay = action && 'delay' in action ? action.delay : 0
      return {
        actionId: row.actionId,
        kind: row.kind,
        title: actionTitle(play, row),
        summary: actionSummary(row),
        details: actionDetails(play, row, link, delay),
        start: row.start,
        end: row.end,
        ignored: !row.applied,
        issues: issues.filter(
          (issue) => issue.target.kind === 'action' && issue.target.id === row.actionId,
        ),
      }
    }),
  }
}

/** Left offset and width of the bar of a row, as fractions of the duration of the phase. */
export function barGeometry(row: Pick<ActionRow, 'start' | 'end'>, duration: number) {
  if (duration <= 0) return { left: 0, width: 0 }
  const left = Math.min(1, Math.max(0, row.start / duration))
  const right = Math.min(1, Math.max(left, row.end / duration))
  return { left, width: right - left }
}
