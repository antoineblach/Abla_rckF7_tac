// Rows of the list of the actions of a line (SPEC 6.7, D-113, D-145), from the report of the engine
// and the issues of the play. Pure.
import type { ActionReport, LineReport } from '../../engine/actionReport'
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
  /** Start and end on the line, in seconds. */
  start: number
  end: number
  /** Never played (second run, passer without the ball...): marked as an error. */
  ignored: boolean
  issues: Issue[]
}

export interface ActionRows {
  duration: number
  rows: ActionRow[]
}

export function actionRows(play: Play, report: LineReport, issues: readonly Issue[]): ActionRows {
  return {
    duration: report.duration,
    rows: report.rows.map((row) => ({
      actionId: row.actionId,
      kind: row.kind,
      title: actionTitle(play, row),
      summary: actionSummary(row),
      details: actionDetails(play, row),
      start: row.start,
      end: row.end,
      ignored: !row.applied,
      issues: issues.filter(
        (issue) => issue.target.kind === 'action' && issue.target.id === row.actionId,
      ),
    })),
  }
}

/** Left offset and width of the bar of a row, as fractions of the duration of the line. */
export function barGeometry(row: Pick<ActionRow, 'start' | 'end'>, duration: number) {
  if (duration <= 0) return { left: 0, width: 0 }
  const left = Math.min(1, Math.max(0, row.start / duration))
  const right = Math.min(1, Math.max(left, row.end / duration))
  return { left, width: right - left }
}
