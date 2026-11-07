import { useMemo } from 'react'
import { lineOptionsText } from '../../model/labels'
import {
  hoverListedAction,
  selectListedAction,
  useInteractionStore,
} from '../../state/editorActions'
import { useEditorStore } from '../../state/editorStore'
import { usePlayerStore } from '../../state/playerStore'
import { actionsInProgress, lineReportOf, playIssues } from '../../state/selectors'
import { useSettingsStore } from '../../state/settingsStore'
import { timeTicks } from '../describe'
import { decimal } from '../format'
import { issueMessage } from '../strings'
import { actionRows, barGeometry, type ActionRow } from './actionRows'

const KIND_LABELS: Record<ActionRow['kind'], string> = {
  run: 'Course',
  pass: 'Passe',
  kick: 'Jeu au pied',
  breakdown: 'Regroupement',
}

const percent = (fraction: number) => `${String(fraction * 100)}%`

function Badges({ row }: { row: ActionRow }) {
  const errors = row.issues.filter((i) => i.severity === 'error')
  const warnings = row.issues.filter((i) => i.severity === 'warning')
  return (
    <span className="action-row__badges">
      {errors.length > 0 || row.ignored ? (
        <span
          className="action-row__badge action-row__badge--error"
          title={errors.map(issueMessage).join('\n') || 'Action ignorée'}
        >
          {errors.length > 1 ? String(errors.length) : '!'}
        </span>
      ) : null}
      {warnings.length > 0 ? (
        <span
          className="action-row__badge action-row__badge--warning"
          title={warnings.map(issueMessage).join('\n')}
        >
          {warnings.length > 1 ? String(warnings.length) : '!'}
        </span>
      ) : null}
    </span>
  )
}

/**
 * Actions of the line (SPEC 6.7, D-113, D-145): one row per action, sorted by start, with its bar
 * on the time scale of the line, those in progress at the cursor marked. Click: selection; hover:
 * halo on the field; Delete: the shortcut of the selection.
 */
export function ActionList() {
  const play = useEditorStore((s) => s.play)
  const selection = useEditorStore((s) => s.selection)
  const line = usePlayerStore((s) => s.transport.line)
  const t = usePlayerStore((s) => s.transport.t)
  const settings = useSettingsStore((s) => s.settings)
  const hovered = useInteractionStore((s) => s.hoveredActionId)
  const report = useMemo(
    () => (play ? lineReportOf(play, line, settings) : null),
    [play, line, settings],
  )
  const data = useMemo(
    () => (play && report ? actionRows(play, report, playIssues(play, settings)) : null),
    [play, report, settings],
  )
  const inProgress = report ? actionsInProgress(report, t) : []
  const options = play ? lineOptionsText(play, line) : ''
  return (
    <section className="action-list" aria-label="Actions de la ligne">
      <h3 className="action-list__title">
        {options ? `Actions de la ligne : ${options}` : 'Actions de la ligne'}
      </h3>
      {!data ? null : data.rows.length === 0 ? (
        <p className="action-list__empty">Aucune action sur cette ligne.</p>
      ) : (
        <div className="action-list__scroll">
          <div className="action-list__scale" aria-hidden="true">
            <span />
            <span className="action-list__ticks">
              {timeTicks(data.duration).map((tick) => (
                <span
                  key={tick}
                  className="action-list__tick"
                  style={{ left: percent(data.duration > 0 ? tick / data.duration : 0) }}
                >
                  {`${decimal(tick, 0)} s`}
                </span>
              ))}
            </span>
          </div>
          <ul className="action-list__rows">
            {data.rows.map((row) => {
              const selected = selection.actions.includes(row.actionId)
              const bar = barGeometry(row, data.duration)
              const current = inProgress.includes(row.actionId)
              const classes = ['action-row', `action-row--${row.kind}`]
              if (selected) classes.push('action-row--selected')
              if (current) classes.push('action-row--current')
              if (row.ignored) classes.push('action-row--ignored')
              if (hovered === row.actionId) classes.push('action-row--hovered')
              return (
                <li key={row.actionId}>
                  <button
                    type="button"
                    className={classes.join(' ')}
                    aria-pressed={selected}
                    aria-current={current ? 'true' : undefined}
                    data-testid="action-row"
                    data-action-id={row.actionId}
                    title={[KIND_LABELS[row.kind], ...row.details].join('\n')}
                    onClick={() => {
                      selectListedAction(row.actionId)
                    }}
                    onMouseEnter={() => {
                      hoverListedAction(row.actionId)
                    }}
                    onMouseLeave={() => {
                      hoverListedAction(null)
                    }}
                  >
                    <span className="action-row__title">{row.title}</span>
                    <span className="action-row__track">
                      <span
                        className="action-row__bar"
                        data-testid="action-bar"
                        style={{ left: percent(bar.left), width: percent(bar.width) }}
                      />
                    </span>
                    <span className="action-row__summary">{row.summary}</span>
                    <Badges row={row} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
