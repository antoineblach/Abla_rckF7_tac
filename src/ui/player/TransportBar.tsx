import type { RefObject } from 'react'
import { childrenOf, isBranchPoint } from '../../model/phaseTree'
import { PLAYBACK_SPEEDS, phaseIndexAtTime, type PlaybackSpeed } from '../../player/transport'
import { ORIENTATIONS, type Orientation } from '../../render/viewport'
import { adjustViewTo } from '../../state/editorActions'
import { useEditorStore } from '../../state/editorStore'
import {
  backToBranchPointInPlayer,
  chooseOptionInPlayer,
  nextPhaseInPlayer,
  playPause,
  previousPhaseInPlayer,
  seekPlayer,
  setLayer,
  setOrientation,
  setSpeed,
  setTransportFlag,
  timingOf,
  usePlayerStore,
} from '../../state/playerStore'
import { labelParts } from '../../state/selectors'
import { CheckboxField } from '../common/fields'
import { phaseLabel } from '../strings'

const ORIENTATION_LABELS: Record<Orientation, string> = {
  landscape: 'Paysage',
  portrait: 'Portrait',
  square: 'Carré',
}
const fmt = (s: number) => `${s.toFixed(1).replace('.', ',')} s`

/** Buttons of the branch point (SPEC 7): one per option, labelled by its condition. */
export function OptionChooser() {
  const play = useEditorStore((s) => s.play)
  const waitingAt = usePlayerStore((s) => s.transport.waitingAt)
  if (!play || !waitingAt) return null
  const options = childrenOf(play, waitingAt)
  return (
    <div className="option-chooser" role="group" aria-label="Point d’option">
      <span>Point d’option :</span>
      {options.map((option) => {
        const parts = labelParts(play, option.id)
        return (
          <button
            key={option.id}
            type="button"
            className="button--primary"
            onClick={() => {
              chooseOptionInPlayer(option.id)
            }}
          >
            Option {parts.option ?? ''} : {option.condition || phaseLabel(parts)}
          </button>
        )
      })}
    </div>
  )
}

export function TransportBar({ stageRef }: { stageRef: RefObject<HTMLElement | null> }) {
  const play = useEditorStore((s) => s.play)
  const transport = usePlayerStore((s) => s.transport)
  const layers = usePlayerStore((s) => s.layers)
  const orientation = usePlayerStore((s) => s.orientation)
  const mode = usePlayerStore((s) => s.mode)
  const selectedPhaseId = useEditorStore((s) => s.selectedPhaseId)
  if (!play) return null
  const timing = timingOf(play, transport.line)
  const index = phaseIndexAtTime(timing, transport.t)
  // In edit mode, the phase being edited (empty phases share their start instant with others).
  const currentId = mode === 'edit' && selectedPhaseId ? selectedPhaseId : timing.phaseIds[index]
  const passedBranch = timing.phaseIds.some(
    (id, i) =>
      i < timing.phaseIds.length - 1 &&
      isBranchPoint(play, id) &&
      (timing.ends[i] ?? 0) <= transport.t,
  )

  return (
    <div className="transport" aria-label="Lecture">
      <div className="transport__main">
        <button type="button" onClick={previousPhaseInPlayer} title="Temps précédent">
          Temps précédent
        </button>
        <button
          type="button"
          className="button--primary transport__play"
          onClick={playPause}
          title="Lecture / pause (L)"
        >
          {transport.playing ? 'Pause' : 'Lecture'}
        </button>
        <button type="button" onClick={nextPhaseInPlayer} title="Temps suivant">
          Temps suivant
        </button>
        <input
          type="range"
          className="transport__slider"
          aria-label="Curseur temporel"
          min={0}
          max={Math.max(timing.duration, 0.01)}
          step={0.01}
          value={transport.t}
          onChange={(e) => {
            seekPlayer(Number(e.target.value))
          }}
        />
        <span className="transport__time" data-testid="transport-time">
          {fmt(transport.t)} / {fmt(timing.duration)}
        </span>
        <span className="transport__phase" role="status" data-testid="current-phase">
          {currentId ? phaseLabel(labelParts(play, currentId)) : ''}
          {mode === 'edit' ? ' (édition)' : ''}
        </span>
        {passedBranch && mode === 'play' ? (
          <button type="button" onClick={backToBranchPointInPlayer}>
            Revenir au point d’option
          </button>
        ) : null}
      </div>
      <div className="transport__options">
        <button
          type="button"
          onClick={() => {
            adjustViewTo('saved')
          }}
          title="Recadrer sur la vue enregistrée (F)"
        >
          Ajuster <kbd>F</kbd>
        </button>
        <button
          type="button"
          onClick={() => {
            adjustViewTo('useful')
          }}
          title="Recadrer sur toutes les positions de la ligne lue"
        >
          Zone utile
        </button>
        <label>
          Orientation{' '}
          <select
            aria-label="Orientation"
            value={orientation}
            onChange={(e) => {
              const value = ORIENTATIONS.find((o) => o === e.target.value)
              if (value) setOrientation(value)
            }}
          >
            {ORIENTATIONS.map((o) => (
              <option key={o} value={o}>
                {ORIENTATION_LABELS[o]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            const stage = stageRef.current
            if (!stage) return
            if (document.fullscreenElement) void document.exitFullscreen()
            else void stage.requestFullscreen()
          }}
        >
          Plein écran
        </button>
        <span className="transport__sep" />
        <label>
          Vitesse{' '}
          <select
            value={transport.speed}
            aria-label="Vitesse"
            onChange={(e) => {
              setSpeed(Number(e.target.value) as PlaybackSpeed)
            }}
          >
            {PLAYBACK_SPEEDS.map((s) => (
              <option key={s} value={s}>
                {String(s).replace('.', ',')}x
              </option>
            ))}
          </select>
        </label>
        <CheckboxField
          label="Boucle"
          checked={transport.loop}
          onChange={(v) => {
            setTransportFlag('loop', v)
          }}
        />
        <CheckboxField
          label="Pause entre les temps"
          checked={transport.pauseBetweenPhases}
          onChange={(v) => {
            setTransportFlag('pauseBetweenPhases', v)
          }}
        />
        <CheckboxField
          label="S’arrêter aux options"
          checked={transport.stopAtOptions}
          onChange={(v) => {
            setTransportFlag('stopAtOptions', v)
          }}
        />
        <span className="transport__sep" />
        <CheckboxField
          label="Traces"
          checked={layers.traces}
          onChange={(v) => {
            setLayer('traces', v)
          }}
        />
        <CheckboxField
          label="Consigne"
          checked={layers.instruction}
          onChange={(v) => {
            setLayer('instruction', v)
          }}
        />
        <CheckboxField
          label="Ligne d’avantage"
          checked={layers.gainLine}
          onChange={(v) => {
            setLayer('gainLine', v)
          }}
        />
      </div>
    </div>
  )
}
