// Inspector sections of lot 3: kick, breakdown and ball at the start (SPEC 10.3, 10.4, D-078,
// D-083). Display only: the logic is in editor/commands and state/selectors.
import { KICK_FLIGHT_TIME } from '../../config/defaults'
import { setBallOnGround, updateBreakdown, updateKick } from '../../editor/commands'
import { BREAKDOWN_KIND_LABELS, CONTEST_LABELS, KICK_KIND_LABELS } from '../../model/labels'
import type { Settings } from '../../model/settings'
import {
  BREAKDOWN_KINDS,
  KICK_KINDS,
  isPlayer,
  isReceiverTarget,
  type BreakdownAction,
  type Id,
  type KickAction,
  type Play,
} from '../../model/types'
import { commandContext } from '../../state/editorActions'
import { applyEdit } from '../../state/editorStore'
import { actionReportOf, kickLanding, playerName, teammatesOf } from '../../state/selectors'
import { CheckboxField, NumberField, SelectField } from '../common/fields'
import { ReleaseFields } from './ReleaseFields'

const POINT = 'point'
const fmt = (seconds: number) => `${seconds.toFixed(1).replace('.', ',')} s`

export function KickInspector({
  play,
  kick,
  phaseId,
  settings,
  disabled,
}: {
  play: Play
  kick: KickAction
  phaseId: Id
  settings: Settings
  disabled: boolean
}) {
  const target = isReceiverTarget(kick.target) ? kick.target.receiverId : POINT
  const receivers = play.entities.filter((e) => isPlayer(e) && e.id !== kick.kickerId)
  const report = actionReportOf(play, phaseId, kick.id, settings)
  return (
    <section className="inspector__section" aria-label="Jeu au pied">
      <h3>Jeu au pied de {playerName(play, kick.kickerId)}</h3>
      <SelectField
        label="Type"
        value={kick.kind}
        disabled={disabled}
        options={KICK_KINDS.map((k) => ({ value: k, label: KICK_KIND_LABELS[k] }))}
        onChange={(kind) => applyEdit((p) => updateKick(p, kick.id, { kind }))}
      />
      <SelectField
        label="Cible"
        value={target}
        disabled={disabled}
        options={[
          { value: POINT, label: 'Point du terrain' },
          ...receivers.map((e) => ({ value: e.id, label: playerName(play, e.id) })),
        ]}
        onChange={(value) => {
          if (value === POINT) {
            const landing = kickLanding(play, phaseId, kick.id, settings)
            if (landing) applyEdit((p) => updateKick(p, kick.id, { target: { point: landing } }))
          } else {
            applyEdit((p) => updateKick(p, kick.id, { target: { receiverId: value } }))
          }
        }}
      />
      {isReceiverTarget(kick.target) ? null : (
        <>
          <NumberField
            label="x visé"
            unit="m"
            value={Math.round(kick.target.point.x * 10) / 10}
            disabled={disabled}
            onCommit={(x) =>
              applyEdit((p) =>
                isReceiverTarget(kick.target)
                  ? p
                  : updateKick(p, kick.id, { target: { point: { ...kick.target.point, x } } }),
              )
            }
          />
          <NumberField
            label="y visé"
            unit="m"
            value={Math.round(kick.target.point.y * 10) / 10}
            disabled={disabled}
            onCommit={(y) =>
              applyEdit((p) =>
                isReceiverTarget(kick.target)
                  ? p
                  : updateKick(p, kick.id, { target: { point: { ...kick.target.point, y } } }),
              )
            }
          />
        </>
      )}
      <ReleaseFields
        release={kick.release}
        delay={kick.delay}
        report={report?.kind === 'kick' ? report : null}
        disabled={disabled}
        onRelease={(release) => applyEdit((p) => updateKick(p, kick.id, { release }))}
        onDelay={(delay) => applyEdit((p) => updateKick(p, kick.id, { delay }))}
      />
      <CheckboxField
        label="Temps de vol propre"
        checked={kick.flightTime !== undefined}
        disabled={disabled}
        onChange={(checked) =>
          applyEdit((p) =>
            updateKick(p, kick.id, { flightTime: checked ? KICK_FLIGHT_TIME[kick.kind] : null }),
          )
        }
      />
      {kick.flightTime !== undefined ? (
        <NumberField
          label="Temps de vol"
          unit="s"
          min={0.3}
          max={8}
          value={kick.flightTime}
          disabled={disabled}
          onCommit={(flightTime) => applyEdit((p) => updateKick(p, kick.id, { flightTime }))}
        />
      ) : (
        <p className="inspector__info">
          Temps de vol par défaut : {fmt(KICK_FLIGHT_TIME[kick.kind])}
        </p>
      )}
    </section>
  )
}

export function BreakdownInspector({
  play,
  breakdown,
  disabled,
}: {
  play: Play
  breakdown: BreakdownAction
  disabled: boolean
}) {
  const mates = teammatesOf(play, breakdown.tackledId).map((e) => ({
    value: e.id,
    label: playerName(play, e.id),
  }))
  return (
    <section className="inspector__section" aria-label="Regroupement">
      <h3>Regroupement sur {playerName(play, breakdown.tackledId)}</h3>
      <SelectField
        label="Type"
        value={breakdown.kind}
        disabled={disabled}
        options={BREAKDOWN_KINDS.map((k) => ({ value: k, label: BREAKDOWN_KIND_LABELS[k] }))}
        onChange={(kind) => applyEdit((p) => updateBreakdown(p, breakdown.id, { kind }))}
      />
      <SelectField
        label="Soutien"
        value={breakdown.supportId}
        disabled={disabled}
        options={mates}
        onChange={(supportId) => applyEdit((p) => updateBreakdown(p, breakdown.id, { supportId }))}
      />
      <SelectField
        label="Relayeur"
        value={breakdown.relayerId}
        disabled={disabled}
        options={mates}
        onChange={(relayerId) => applyEdit((p) => updateBreakdown(p, breakdown.id, { relayerId }))}
      />
      <NumberField
        label="Formation"
        unit="s"
        min={0}
        max={60}
        step={0.01}
        value={Math.round(breakdown.delay * 100) / 100}
        disabled={disabled}
        onCommit={(delay) => applyEdit((p) => updateBreakdown(p, breakdown.id, { delay }))}
      />
      <NumberField
        label="Durée"
        unit="s"
        min={0.5}
        max={20}
        value={breakdown.duration}
        disabled={disabled}
        onCommit={(duration) => applyEdit((p) => updateBreakdown(p, breakdown.id, { duration }))}
      />
      <SelectField
        label="Défense au regroupement"
        value={breakdown.contest ?? 'default'}
        disabled={disabled}
        options={(['default', 'guard', 'jackal'] as const).map((c) => ({
          value: c,
          label: CONTEST_LABELS[c],
        }))}
        onChange={(value) =>
          applyEdit((p) =>
            updateBreakdown(p, breakdown.id, { contest: value === 'default' ? null : value }),
          )
        }
      />
    </section>
  )
}

/** Ball at the start: carried by a player, or on the ground (D-083). */
export function BallAtStart({ play, disabled }: { play: Play; disabled: boolean }) {
  const { ballCarrierId, ballPosition } = play.setup
  const carrierPos = ballCarrierId === null ? undefined : play.setup.positions[ballCarrierId]
  return (
    <div className="form-row">
      {ballCarrierId !== null ? (
        <p className="inspector__info">Porteuse au départ : {playerName(play, ballCarrierId)}</p>
      ) : ballPosition ? (
        <p className="inspector__info">
          Ballon au sol au départ ({Math.round(ballPosition.x)} m, {Math.round(ballPosition.y)} m),
          ramassé par la première joueuse à moins de 1 m.
        </p>
      ) : (
        <p className="inspector__info">Ballon sans porteuse ni position.</p>
      )}
      {carrierPos ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => applyEdit((p) => setBallOnGround(p, carrierPos, commandContext()))}
        >
          Poser le ballon au sol
        </button>
      ) : null}
    </div>
  )
}
