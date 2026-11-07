// Inspector section of a run (SPEC 6.5, lot 3 bis: D-106 to D-109, D-114, D-117; lot 3bis-1:
// D-130, D-132, D-133; frise: D-143): pace and segment speed (list, slider, field in km/h), start and
// glues, imposed duration and its factors, « Finit lancée », lengths, speeds and accelerations.
// Display only: the logic is in editor/commands and state/.
import { setSegmentSpeed, updateRun } from '../../editor/commands'
import { selectedSegment, type Selection } from '../../editor/selection'
import type { Settings } from '../../model/settings'
import { speedOf } from '../../model/speed'
import { PACES, type Id, type Pace, type Play, type RunAction } from '../../model/types'
import { applyEdit } from '../../state/editorStore'
import { actionReportOf, playerName, runDuration } from '../../state/selectors'
import { CheckboxField, NumberField, SelectField } from '../common/fields'
import { SpeedSlider } from '../common/SpeedSlider'
import {
  durationFactorsText,
  launchText,
  segmentLevel,
  segmentText,
  speedValueLabel,
} from '../describe'
import { formatMeters, formatSeconds, formatSpeed, kmhToMps, mpsToKmh } from '../format'
import { PACE_LABELS } from '../strings'
import { BlockFields } from './BlockFields'

type SegmentChoice = 'run' | Pace | 'custom'

type PaceChoice = Pace | 'custom'

/** Typed speed field, in km/h (1 to 45 km/h, D-117, D-133). */
function TypedSpeedField({
  label,
  speed,
  disabled,
  onCommit,
}: {
  label: string
  speed: number
  disabled: boolean
  onCommit: (mps: number) => void
}) {
  return (
    <NumberField
      label={label}
      unit="km/h"
      min={1}
      max={45}
      step={0.1}
      value={Math.round(mpsToKmh(speed) * 10) / 10}
      disabled={disabled}
      onCommit={(kmh) => {
        onCommit(kmhToMps(kmh))
      }}
    />
  )
}

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
          { value: 'run', label: `Allure de la course (${speedValueLabel(run.pace)})` },
          ...PACES.map((p) => ({ value: p, label: PACE_LABELS[p] })),
          { value: 'custom', label: 'Vitesse saisie' },
        ]}
        onChange={(value) => {
          if (value === 'run') set(null)
          else if (value === 'custom') set(target ?? speedOf(run.pace, settings.paces))
          else set(value)
        }}
      />
      {speed !== undefined ? (
        <SpeedSlider
          label="Curseur du segment"
          value={speed}
          paces={settings.paces}
          speedAlert={settings.speedAlert}
          disabled={disabled}
          onCommit={set}
        />
      ) : null}
      {typeof speed === 'number' ? (
        <TypedSpeedField label="Vitesse saisie" speed={speed} disabled={disabled} onCommit={set} />
      ) : null}
    </div>
  )
}

export function RunInspector({
  play,
  run,
  line,
  settings,
  selection,
  disabled,
}: {
  play: Play
  run: RunAction
  line: readonly Id[]
  settings: Settings
  selection: Selection
  disabled: boolean
}) {
  const duration = runDuration(play, line, run.id, settings)
  const found = actionReportOf(play, line, run.id, settings)
  const report = found?.kind === 'run' ? found : null
  const segment = selectedSegment(selection)
  const segmentIndex = segment?.actionId === run.id ? segment.index : null
  const launch = report ? launchText(report) : null
  const factors = report ? durationFactorsText(report) : null
  return (
    <section className="inspector__section" aria-label="Course">
      <h3>Course de {playerName(play, run.entityId)}</h3>
      <BlockFields play={play} action={run} report={found} disabled={disabled} />
      <SelectField<PaceChoice>
        label="Allure"
        value={typeof run.pace === 'number' ? 'custom' : run.pace}
        disabled={disabled}
        options={[
          ...PACES.map((p) => ({
            value: p,
            label: `${PACE_LABELS[p]} : ${formatSpeed(settings.paces[p])}`,
          })),
          { value: 'custom', label: 'Vitesse saisie' },
        ]}
        onChange={(choice) =>
          applyEdit((p) =>
            updateRun(p, run.id, {
              pace: choice === 'custom' ? speedOf(run.pace, settings.paces) : choice,
            }),
          )
        }
      />
      <SpeedSlider
        label="Curseur de l’allure"
        value={run.pace}
        paces={settings.paces}
        speedAlert={settings.speedAlert}
        disabled={disabled}
        onCommit={(pace) => applyEdit((p) => updateRun(p, run.id, { pace }))}
      />
      {typeof run.pace === 'number' ? (
        <TypedSpeedField
          label="Allure saisie"
          speed={run.pace}
          disabled={disabled}
          onCommit={(pace) => applyEdit((p) => updateRun(p, run.id, { pace }))}
        />
      ) : null}
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
      {factors ? (
        <p className="inspector__info" data-testid="run-factors">
          {factors}
        </p>
      ) : null}
      {launch ? (
        <p className="inspector__info" data-testid="run-launch">
          {launch}
        </p>
      ) : null}
      <p className="inspector__info" data-testid="run-duration">
        Durée de la course : {duration === null ? '?' : formatSeconds(duration)}
      </p>
      {report ? (
        <ul className="inspector__facts" aria-label="Vitesses de la course">
          <li>Longueur : {formatMeters(report.length)}</li>
          <li>Vitesse moyenne : {formatSpeed(report.meanSpeed)}</li>
          <li>Vitesse de pointe : {formatSpeed(report.peakSpeed)}</li>
          {report.segments.map((s) => {
            const level = segmentLevel(s)
            return (
              <li key={s.index} className={level ? `inspector__fact--${level}` : undefined}>
                {segmentText(s, report)}
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
