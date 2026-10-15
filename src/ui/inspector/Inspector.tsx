import { FIELD_LIMITS, INSTRUCTION_RECOMMENDED_LENGTH } from '../../config/defaults'
import {
  addBall,
  deleteActions,
  deletePlayers,
  removeBall,
  setBallCarrier,
  setDefaultOption,
  updateField,
  updatePass,
  updatePhase,
  updatePlayMeta,
  updatePlayer,
  updateRun,
} from '../../editor/commands'
import { EMPTY_SELECTION } from '../../editor/selection'
import type { Issue } from '../../model/issues'
import { findPhase } from '../../model/phaseTree'
import { THEME_IDS, type Settings } from '../../model/settings'
import {
  PACES,
  PLAY_CATEGORIES,
  isPlayer,
  type FieldView,
  type Id,
  type PassAction,
  type Play,
  type RunAction,
} from '../../model/types'
import { commandContext } from '../../state/editorActions'
import { applyEdit, setSelection, useEditorStore } from '../../state/editorStore'
import {
  findAction,
  labelParts,
  phaseDurationAt,
  playIssues,
  runDuration,
  siblingsOf,
} from '../../state/selectors'
import { updateSettings } from '../../state/session'
import { useSettingsStore } from '../../state/settingsStore'
import { useViewStore } from '../../state/viewStore'
import { CheckboxField, CommitTextField, NumberField, SelectField } from '../common/fields'
import { CATEGORY_LABELS, issueMessage, PACE_LABELS, phaseLabel } from '../strings'

const fmt = (seconds: number) => `${seconds.toFixed(1).replace('.', ',')} s`

function IssueList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null
  return (
    <ul className="issues" aria-label="Alertes">
      {issues.map((issue, i) => (
        <li key={i} className={`issue issue--${issue.severity}`}>
          {issueMessage(issue)}
        </li>
      ))}
    </ul>
  )
}

function PlayerInspector({
  play,
  id,
  issues,
  disabled,
}: {
  play: Play
  id: Id
  issues: Issue[]
  disabled: boolean
}) {
  const player = play.entities.find((e) => e.id === id)
  if (!isPlayer(player)) return null
  return (
    <section className="inspector__section" aria-label="Joueuse">
      <h3>
        Joueuse {player.team} {player.number}
      </h3>
      <NumberField
        label="Numéro"
        value={player.number}
        min={0}
        max={999}
        step={1}
        disabled={disabled}
        onCommit={(number) => applyEdit((p) => updatePlayer(p, id, { number: Math.round(number) }))}
      />
      <div className="form-row form-row--inline">
        <label htmlFor="player-color">Couleur</label>
        <input
          id="player-color"
          type="color"
          value={player.color}
          disabled={disabled}
          onChange={(e) => applyEdit((p) => updatePlayer(p, id, { color: e.target.value }))}
        />
      </div>
      <SelectField
        label="Mode défense"
        value={player.defenseMode}
        disabled={disabled}
        options={[
          { value: 'manual', label: 'Manuel' },
          { value: 'auto', label: 'Automatique (lot 4)', disabled: true },
        ]}
        onChange={(defenseMode) => applyEdit((p) => updatePlayer(p, id, { defenseMode }))}
      />
      <CheckboxField
        label="Porteuse du ballon au départ"
        checked={play.setup.ballCarrierId === id}
        disabled={disabled}
        onChange={(checked) =>
          applyEdit((p) => setBallCarrier(p, checked ? id : null, commandContext()))
        }
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          applyEdit((p) => deletePlayers(p, [id]))
          setSelection(EMPTY_SELECTION)
        }}
      >
        Supprimer la joueuse
      </button>
      <IssueList issues={issues.filter((i) => i.target.kind === 'entity' && i.target.id === id)} />
    </section>
  )
}

function RunInspector({
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
  const duration = runDuration(play, phaseId, run.id, settings)
  return (
    <section className="inspector__section" aria-label="Course">
      <h3>Course</h3>
      <SelectField
        label="Allure"
        value={run.pace}
        disabled={disabled}
        options={PACES.map((p) => ({
          value: p,
          label: `${PACE_LABELS[p]} (${settings.paces[p]} m/s)`,
        }))}
        onChange={(pace) => applyEdit((p) => updateRun(p, run.id, { pace }))}
      />
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
      <NumberField
        label="Délai"
        unit="s"
        min={0}
        max={60}
        value={run.delay}
        disabled={disabled}
        onCommit={(delay) => applyEdit((p) => updateRun(p, run.id, { delay }))}
      />
      <p className="inspector__info" data-testid="run-duration">
        Durée de la course : {duration === null ? '?' : fmt(duration)}
      </p>
    </section>
  )
}

function PassInspector({
  pass,
  settings,
  disabled,
}: {
  pass: PassAction
  settings: Settings
  disabled: boolean
}) {
  return (
    <section className="inspector__section" aria-label="Passe">
      <h3>Passe</h3>
      <NumberField
        label="Délai"
        unit="s"
        min={0}
        max={60}
        value={pass.delay}
        disabled={disabled}
        onCommit={(delay) => applyEdit((p) => updatePass(p, pass.id, { delay }))}
      />
      <CheckboxField
        label="Vitesse de passe propre"
        checked={pass.ballSpeed !== undefined}
        disabled={disabled}
        onChange={(checked) =>
          applyEdit((p) =>
            updatePass(p, pass.id, { ballSpeed: checked ? settings.passSpeed : null }),
          )
        }
      />
      {pass.ballSpeed !== undefined ? (
        <NumberField
          label="Vitesse"
          unit="m/s"
          min={1}
          max={40}
          value={pass.ballSpeed}
          disabled={disabled}
          onCommit={(ballSpeed) => applyEdit((p) => updatePass(p, pass.id, { ballSpeed }))}
        />
      ) : (
        <p className="inspector__info">Vitesse des réglages : {settings.passSpeed} m/s</p>
      )}
    </section>
  )
}

function viewKey(view: FieldView): 'full' | 'attack' | 'defense' | 'frame' {
  return view.kind === 'half' ? view.side : view.kind
}

function PlayInspector({ play, disabled }: { play: Play; disabled: boolean }) {
  const visible = useViewStore((s) => s.visible)
  const hasBall = play.entities.some((e) => e.kind === 'ball')
  const view = play.field.view
  return (
    <section className="inspector__section" aria-label="Combinaison">
      <h3>Combinaison</h3>
      <CommitTextField
        label="Nom"
        value={play.name}
        disabled={disabled}
        onCommit={(name) => applyEdit((p) => updatePlayMeta(p, { name }))}
      />
      <SelectField
        label="Catégorie"
        value={play.category}
        disabled={disabled}
        options={PLAY_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
        onChange={(category) => applyEdit((p) => updatePlayMeta(p, { category }))}
      />
      <CommitTextField
        label="Notes"
        multiline
        value={play.notes}
        disabled={disabled}
        onCommit={(notes) => applyEdit((p) => updatePlayMeta(p, { notes }))}
      />
      <SelectField
        label="Équipe qui attaque"
        value={play.attackingTeam}
        disabled={disabled}
        options={[
          { value: 'A', label: 'A (bleu)' },
          { value: 'B', label: 'B (orange)' },
        ]}
        onChange={(attackingTeam) => applyEdit((p) => updatePlayMeta(p, { attackingTeam }))}
      />
      <div className="form-row">
        {hasBall ? (
          <button type="button" disabled={disabled} onClick={() => applyEdit(removeBall)}>
            Retirer le ballon
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => applyEdit((p) => addBall(p, commandContext()))}
          >
            Ajouter le ballon
          </button>
        )}
      </div>
      <h4>Terrain</h4>
      <NumberField
        label="Longueur"
        unit="m"
        step={1}
        min={FIELD_LIMITS.length.min}
        max={FIELD_LIMITS.length.max}
        value={play.field.length}
        disabled={disabled}
        onCommit={(length) => applyEdit((p) => updateField(p, { length }))}
      />
      <NumberField
        label="Largeur"
        unit="m"
        step={1}
        min={FIELD_LIMITS.width.min}
        max={FIELD_LIMITS.width.max}
        value={play.field.width}
        disabled={disabled}
        onCommit={(width) => applyEdit((p) => updateField(p, { width }))}
      />
      <NumberField
        label="En-but"
        unit="m"
        step={1}
        min={FIELD_LIMITS.inGoal.min}
        max={FIELD_LIMITS.inGoal.max}
        value={play.field.inGoal}
        disabled={disabled}
        onCommit={(inGoal) => applyEdit((p) => updateField(p, { inGoal }))}
      />
      <SelectField
        label="Vue enregistrée"
        value={viewKey(view)}
        disabled={disabled}
        options={[
          { value: 'full', label: 'Terrain complet' },
          { value: 'attack', label: 'Demi-terrain attaqué' },
          { value: 'defense', label: 'Demi-terrain défendu' },
          { value: 'frame', label: 'Cadre libre' },
        ]}
        onChange={(key) =>
          applyEdit((p) =>
            updateField(p, {
              view:
                key === 'full'
                  ? { kind: 'full' }
                  : key === 'frame'
                    ? {
                        kind: 'frame',
                        min: visible?.min ?? { x: 0, y: 0 },
                        max: visible?.max ?? { x: p.field.length, y: p.field.width },
                      }
                    : { kind: 'half', side: key },
            }),
          )
        }
      />
      {view.kind === 'frame' ? (
        <>
          <button
            type="button"
            disabled={disabled || !visible}
            onClick={() => {
              if (visible)
                applyEdit((p) =>
                  updateField(p, { view: { kind: 'frame', min: visible.min, max: visible.max } }),
                )
            }}
          >
            Enregistrer la vue actuelle comme cadre
          </button>
          <NumberField
            label="x min"
            unit="m"
            value={round(view.min.x)}
            disabled={disabled}
            onCommit={(x) =>
              applyEdit((p) => updateField(p, { view: { ...view, min: { ...view.min, x } } }))
            }
          />
          <NumberField
            label="y min"
            unit="m"
            value={round(view.min.y)}
            disabled={disabled}
            onCommit={(y) =>
              applyEdit((p) => updateField(p, { view: { ...view, min: { ...view.min, y } } }))
            }
          />
          <NumberField
            label="x max"
            unit="m"
            value={round(view.max.x)}
            disabled={disabled}
            onCommit={(x) =>
              applyEdit((p) => updateField(p, { view: { ...view, max: { ...view.max, x } } }))
            }
          />
          <NumberField
            label="y max"
            unit="m"
            value={round(view.max.y)}
            disabled={disabled}
            onCommit={(y) =>
              applyEdit((p) => updateField(p, { view: { ...view, max: { ...view.max, y } } }))
            }
          />
        </>
      ) : null}
    </section>
  )
}

const round = (v: number) => Math.round(v * 10) / 10

function PhaseInspector({
  play,
  phaseId,
  settings,
  disabled,
}: {
  play: Play
  phaseId: Id
  settings: Settings
  disabled: boolean
}) {
  const phase = findPhase(play, phaseId)
  if (!phase) return null
  const siblings = siblingsOf(play, phaseId)
  const isOption = phase.parentId !== null && siblings.length >= 2
  const parts = labelParts(play, phaseId)
  return (
    <section className="inspector__section" aria-label="Temps">
      <h3>{phaseLabel(parts)}</h3>
      <p className="inspector__info">
        Durée du temps : {fmt(phaseDurationAt(play, phaseId, settings))}
      </p>
      <CommitTextField
        label="Libellé (vide : calculé)"
        value={phase.label}
        disabled={disabled}
        onCommit={(label) => applyEdit((p) => updatePhase(p, phaseId, { label }))}
      />
      {isOption ? (
        <>
          <CommitTextField
            label="Condition de l’option"
            value={phase.condition}
            disabled={disabled}
            onCommit={(condition) => applyEdit((p) => updatePhase(p, phaseId, { condition }))}
          />
          <CheckboxField
            label="Option par défaut"
            checked={phase.isDefault}
            disabled={disabled || phase.isDefault}
            onChange={() => applyEdit((p) => setDefaultOption(p, phaseId))}
          />
        </>
      ) : null}
      <CommitTextField
        label="Consigne"
        multiline
        value={phase.instruction}
        maxLengthHint={INSTRUCTION_RECOMMENDED_LENGTH}
        disabled={disabled}
        onCommit={(instruction) => applyEdit((p) => updatePhase(p, phaseId, { instruction }))}
      />
    </section>
  )
}

function SettingsSection({ settings }: { settings: Settings }) {
  const writable = useSettingsStore((s) => s.writable)
  const save = (next: Settings) => void updateSettings(next)
  return (
    <details className="inspector__section">
      <summary>Réglages (reglages.json)</summary>
      <SelectField
        label="Thème"
        value={settings.theme}
        disabled={!writable}
        options={THEME_IDS.map((t) => ({
          value: t,
          label: t === 'screen' ? 'Écran' : 'Contraste fort',
        }))}
        onChange={(theme) => {
          save({ ...settings, theme })
        }}
      />
      {PACES.map((pace) => (
        <NumberField
          key={pace}
          label={PACE_LABELS[pace]}
          unit="m/s"
          min={0.5}
          max={12}
          value={settings.paces[pace]}
          disabled={!writable}
          onCommit={(value) => {
            save({ ...settings, paces: { ...settings.paces, [pace]: value } })
          }}
        />
      ))}
      <NumberField
        label="Vitesse de passe"
        unit="m/s"
        min={3}
        max={40}
        value={settings.passSpeed}
        disabled={!writable}
        onCommit={(passSpeed) => {
          save({ ...settings, passSpeed })
        }}
      />
    </details>
  )
}

export function Inspector() {
  const play = useEditorStore((s) => s.play)
  const selection = useEditorStore((s) => s.selection)
  const phaseId = useEditorStore((s) => s.selectedPhaseId)
  const readOnly = useEditorStore((s) => s.readOnly)
  const settings = useSettingsStore((s) => s.settings)
  if (!play) {
    return (
      <aside className="inspector" aria-label="Inspecteur">
        <SettingsSection settings={settings} />
      </aside>
    )
  }
  const issues = playIssues(play, settings)
  const single =
    selection.players.length === 1 && selection.actions.length === 0
      ? selection.players[0]
      : undefined
  const actionId =
    selection.actions.length === 1 && selection.players.length === 0
      ? selection.actions[0]
      : undefined
  const found = actionId ? findAction(play, actionId) : null
  return (
    <aside className="inspector" aria-label="Inspecteur">
      {single ? (
        <PlayerInspector play={play} id={single} issues={issues} disabled={readOnly} />
      ) : null}
      {found?.action.type === 'run' ? (
        <RunInspector
          play={play}
          run={found.action}
          phaseId={found.phase.id}
          settings={settings}
          disabled={readOnly}
        />
      ) : null}
      {found?.action.type === 'pass' ? (
        <PassInspector pass={found.action} settings={settings} disabled={readOnly} />
      ) : null}
      {found ? (
        <>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => {
              applyEdit((p) => deleteActions(p, [found.action.id]))
              setSelection(EMPTY_SELECTION)
            }}
          >
            Supprimer l’action
          </button>
          <IssueList
            issues={issues.filter(
              (i) => i.target.kind === 'action' && i.target.id === found.action.id,
            )}
          />
        </>
      ) : null}
      {phaseId ? (
        <PhaseInspector play={play} phaseId={phaseId} settings={settings} disabled={readOnly} />
      ) : null}
      {!single && !found ? <PlayInspector play={play} disabled={readOnly} /> : null}
      <section className="inspector__section" aria-label="Alertes de la combinaison">
        <h3>Alertes</h3>
        {issues.length === 0 ? (
          <p className="inspector__info">Aucune alerte.</p>
        ) : (
          <IssueList issues={issues} />
        )}
      </section>
      <SettingsSection settings={settings} />
    </aside>
  )
}
