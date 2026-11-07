// Edges of a block in the inspector (SPEC 6.5, 5.8, D-143): « Départ », what an edge is glued to,
// « Décoller », gap and what the block does when the target moves. Display only: the logic is in
// editor/commands and ui/describe.
import { removeGlue, setKeep, setOffset, setStart, startIsGlued } from '../../editor/commands'
import type { ActionReport } from '../../engine/actionReport'
import type { Action, GlueKeep, Play } from '../../model/types'
import { commandContext } from '../../state/editorActions'
import { applyEdit } from '../../state/editorStore'
import { NumberField, SelectField } from '../common/fields'
import { glueFactorsText, glueTargetText, glueText } from '../describe'
import { formatSeconds } from '../format'

const KEEP_OPTIONS: readonly { value: GlueKeep; label: string }[] = [
  { value: 'duration', label: 'Le bloc glisse' },
  { value: 'start', label: 'Le bloc s’étire' },
]

const roundToHundredth = (seconds: number) => Math.round(seconds * 100) / 100

export function BlockFields({
  play,
  action,
  report,
  disabled,
}: {
  play: Play
  action: Action
  report: ActionReport | null
  disabled: boolean
}) {
  const { startGlue, endGlue } = action
  const released = action.type === 'pass' || action.type === 'kick'
  const factors = report?.kind === 'run' ? glueFactorsText(report) : null
  return (
    <>
      {startIsGlued(action) ? (
        <p className="inspector__info" data-testid="block-start-computed">
          Départ calculé : {report ? formatSeconds(report.start) : '?'}
        </p>
      ) : (
        <NumberField
          label="Départ"
          unit="s"
          min={0}
          step={0.01}
          value={roundToHundredth(action.start)}
          disabled={disabled}
          onCommit={(start) => applyEdit((p) => setStart(p, action.id, start))}
        />
      )}
      {startGlue ? (
        <div className="inspector__block" role="group" aria-label="Départ collé">
          <p className="inspector__info" data-testid="start-glue">
            Départ collé à :{' '}
            {report?.startGlue ? glueText(play, report.startGlue) : glueTargetText(play, startGlue)}
          </p>
          <NumberField
            label={released ? 'Temps de contrôle' : 'Écart'}
            unit="s"
            min={0}
            step={0.01}
            value={roundToHundredth(startGlue.offset ?? 0)}
            disabled={disabled}
            onCommit={(offset) => applyEdit((p) => setOffset(p, action.id, 'start', offset))}
          />
          <button
            type="button"
            disabled={disabled}
            aria-label="Décoller le départ"
            onClick={() => applyEdit((p) => removeGlue(p, action.id, 'start', commandContext()))}
          >
            Décoller
          </button>
        </div>
      ) : null}
      {endGlue ? (
        <div className="inspector__block" role="group" aria-label="Fin collée">
          <p className="inspector__info" data-testid="end-glue">
            Fin collée à :{' '}
            {report?.endGlue ? glueText(play, report.endGlue) : glueTargetText(play, endGlue)}
          </p>
          {factors ? (
            <p className="inspector__info" data-testid="glue-factors">
              {factors}
            </p>
          ) : null}
          <SelectField<GlueKeep>
            label="Quand la cible se déplace"
            value={endGlue.keep}
            disabled={disabled || startGlue !== undefined}
            options={KEEP_OPTIONS}
            onChange={(keep) => applyEdit((p) => setKeep(p, action.id, keep))}
          />
          <NumberField
            label="Écart de la fin"
            unit="s"
            min={0}
            step={0.01}
            value={roundToHundredth(endGlue.offset ?? 0)}
            disabled={disabled}
            onCommit={(offset) => applyEdit((p) => setOffset(p, action.id, 'end', offset))}
          />
          <button
            type="button"
            disabled={disabled}
            aria-label="Décoller la fin"
            onClick={() => applyEdit((p) => removeGlue(p, action.id, 'end', commandContext()))}
          >
            Décoller
          </button>
        </div>
      ) : null}
    </>
  )
}
