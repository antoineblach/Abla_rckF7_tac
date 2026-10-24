// Inspector section of a run (SPEC 6.5, lot 3 bis: D-106 to D-109, D-114, D-117): pace, segment
// speed, imposed duration, delay, « Finit lancée », synchronisation link, lengths and speeds.
// Display only: the logic is in editor/commands and state/.
import { removeRunSync, setSegmentSpeed, updateRun, updateRunSync } from '../../editor/commands'
import { selectedSegment, type Selection } from '../../editor/selection'
import type { Settings } from '../../model/settings'
import { PACES, type Id, type Pace, type Play, type RunAction } from '../../model/types'
import { commandContext, startSyncPick } from '../../state/editorActions'
import { applyEdit } from '../../state/editorStore'
import { actionReportOf, playerName, runDuration } from '../../state/selectors'
import { CheckboxField, NumberField, SelectField } from '../common/fields'
import {
  launchText,
  rendezVousText,
  segmentText,
  syncResultText,
  syncTargetText,
} from '../describe'
import { formatMeters, formatSeconds, formatSpeed, kmhToMps, mpsToKmh } from '../format'
import { PACE_LABELS } from '../strings'

type SegmentChoice = 'run' | Pace | 'custom'

const END = 'end'

function SegmentBlock({
  run,
  index,
  settings,
  target,
  disabled,
}: {
  run: RunAction
  index: number
  settings: Settings
  /** Target speed of the segment computed by the engine, m/s. */
  target: number | null
  disabled: boolean
}) {
  const point = run.waypoints[index]
  if (!point) return null
  const speed = point.speed
  const choice: SegmentChoice =
    speed === undefined ? 'run' : typeof speed === 'number' ? 'custom' : speed
  const set = (value: Parameters<typeof setSegmentSpeed>[3]) =>
    applyEdit((p) => setSegmentSpeed(p, run.id, index, value))
  return (
    <div className="inspector__block" aria-label={`Segment ${String(index + 1)}`} role="group">
      <h4>Segment {index + 1}</h4>
      <SelectField<SegmentChoice>
        label="Vitesse du segment"
        value={choice}
        disabled={disabled}
        options={[
          { value: 'run', label: `Allure de la course (${PACE_LABELS[run.pace]})` },
          ...PACES.map((p) => ({ value: p, label: PACE_LABELS[p] })),
          { value: 'custom', label: 'Vitesse saisie' },
        ]}
        onChange={(value) => {
          if (value === 'run') set(null)
          else if (value === 'custom') set(target ?? settings.paces[run.pace])
          else set(value)
        }}
      />
      {typeof speed === 'number' ? (
        <NumberField
          label="Vitesse saisie"
          unit="km/h"
          min={1}
          max={45}
          step={0.1}
          value={Math.round(mpsToKmh(speed) * 10) / 10}
          disabled={disabled}
          onCommit={(kmh) => set(kmhToMps(kmh))}
        />
      ) : null}
    </div>
  )
}

function SyncBlock({
  play,
  run,
  phaseId,
  settings,
  disabled,
}: {
  play: Play
  run: RunAction
  phaseId: Id
  settings: Settings
  disabled: boolean
}) {
  const sync = run.sync
  if (!sync) {
    return (
      <div className="inspector__block" role="group" aria-label="Synchronisation">
        <h4>Synchronisation</h4>
        <button
          type="button"
          disabled={disabled}
          title="Puis cliquez la cible sur le terrain : point ou trait d’une course, passe, jeu au pied, regroupement"
          onClick={() => {
            startSyncPick()
          }}
        >
          Caler sur…
        </button>
      </div>
    )
  }
  const report = actionReportOf(play, phaseId, run.id, settings)
  const result = report?.kind === 'run' ? report.sync : null
  const points = run.waypoints.slice(0, -1).map((_, i) => ({
    value: String(i),
    label: `Point ${String(i + 1)}`,
  }))
  return (
    <div className="inspector__block" role="group" aria-label="Synchronisation">
      <h4>Synchronisation</h4>
      <p className="inspector__info" data-testid="sync-target">
        Calée sur : {syncTargetText(play, sync.target)}
      </p>
      <SelectField
        label="Point de rendez-vous"
        value={sync.at === undefined || sync.at >= run.waypoints.length - 1 ? END : String(sync.at)}
        disabled={disabled}
        options={[{ value: END, label: 'Fin' }, ...points]}
        onChange={(value) =>
          applyEdit((p) => updateRunSync(p, run.id, { at: value === END ? null : Number(value) }))
        }
      />
      <SelectField
        label="Réglage"
        value={sync.adjust}
        disabled={disabled}
        options={[
          { value: 'delay', label: 'Départ différé' },
          { value: 'speed', label: 'Vitesse ajustée' },
        ]}
        onChange={(adjust) => applyEdit((p) => updateRunSync(p, run.id, { adjust }))}
      />
      <p className="inspector__info" data-testid="sync-result">
        {rendezVousText(sync)} : {syncResultText(result)}
      </p>
      <div className="form-row form-row--buttons">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            startSyncPick()
          }}
        >
          Changer la cible
        </button>
        <button
          type="button"
          disabled={disabled}
          title="Un départ différé garde le délai calculé"
          onClick={() => applyEdit((p) => removeRunSync(p, run.id, commandContext()))}
        >
          Retirer le lien
        </button>
      </div>
    </div>
  )
}

export function RunInspector({
  play,
  run,
  phaseId,
  settings,
  selection,
  disabled,
}: {
  play: Play
  run: RunAction
  phaseId: Id
  settings: Settings
  selection: Selection
  disabled: boolean
}) {
  const duration = runDuration(play, phaseId, run.id, settings)
  const found = actionReportOf(play, phaseId, run.id, settings)
  const report = found?.kind === 'run' ? found : null
  const segment = selectedSegment(selection)
  const segmentIndex = segment?.actionId === run.id ? segment.index : null
  const result = report?.sync ?? null
  const delayLocked =
    run.sync?.adjust === 'delay' && result !== null && result.status !== 'unreached'
  const launch = report ? launchText(report) : null
  return (
    <section className="inspector__section" aria-label="Course">
      <h3>Course de {playerName(play, run.entityId)}</h3>
      <SelectField
        label="Allure"
        value={run.pace}
        disabled={disabled}
        options={PACES.map((p) => ({
          value: p,
          label: `${PACE_LABELS[p]} : ${formatSpeed(settings.paces[p])}`,
        }))}
        onChange={(pace) => applyEdit((p) => updateRun(p, run.id, { pace }))}
      />
      {segmentIndex !== null ? (
        <SegmentBlock
          run={run}
          index={segmentIndex}
          settings={settings}
          target={report?.segments[segmentIndex]?.target ?? null}
          disabled={disabled}
        />
      ) : null}
      <CheckboxField
        label="Durée imposée"
        checked={run.durationOverride !== undefined}
        disabled={disabled}
        onChange={(checked) =>
          applyEdit((p) =>
            updateRun(p, run.id, { durationOverride: checked ? (duration ?? 2) : null }),
          )
        }
      />
      {run.durationOverride !== undefined ? (
        <NumberField
          label="Durée"
          unit="s"
          min={0.1}
          max={60}
          value={run.durationOverride}
          disabled={disabled}
          onCommit={(value) => applyEdit((p) => updateRun(p, run.id, { durationOverride: value }))}
        />
      ) : null}
      {delayLocked ? (
        <p className="inspector__info" data-testid="run-delay-computed">
          Délai calculé par le lien : {formatSeconds(result.delay)}
        </p>
      ) : (
        <NumberField
          label="Délai"
          unit="s"
          min={0}
          max={60}
          value={run.delay}
          disabled={disabled}
          onCommit={(delay) => applyEdit((p) => updateRun(p, run.id, { delay }))}
        />
      )}
      <CheckboxField
        label="Finit lancée"
        checked={run.endsAtSpeed === true}
        disabled={disabled}
        onChange={(endsAtSpeed) => applyEdit((p) => updateRun(p, run.id, { endsAtSpeed }))}
      />
      {launch && report?.launchWait !== null ? (
        <p className="inspector__info" data-testid="launch-wait">
          {launch}
        </p>
      ) : null}
      <SyncBlock play={play} run={run} phaseId={phaseId} settings={settings} disabled={disabled} />
      <p className="inspector__info" data-testid="run-duration">
        Durée de la course : {duration === null ? '?' : formatSeconds(duration)}
      </p>
      {report ? (
        <ul className="inspector__facts" aria-label="Vitesses de la course">
          <li>Longueur : {formatMeters(report.length)}</li>
          <li>Vitesse moyenne : {formatSpeed(report.meanSpeed)}</li>
          <li>Vitesse de pointe : {formatSpeed(report.peakSpeed)}</li>
          {report.segments.map((s) => (
            <li key={s.index} className={s.level ? `inspector__fact--${s.level}` : undefined}>
              {segmentText(s, report)}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
