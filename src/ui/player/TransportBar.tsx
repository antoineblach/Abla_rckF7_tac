import type { RefObject } from 'react'
import { childrenOf } from '../../model/branches'
import { optionTitle } from '../../model/labels'
import type { Id, Play } from '../../model/types'
import { hasPassedBranchPoint, PLAYBACK_SPEEDS, type PlaybackSpeed } from '../../player/transport'
import { ORIENTATIONS, type Orientation } from '../../render/viewport'
import { adjustViewTo } from '../../state/editorActions'
import { useEditorStore } from '../../state/editorStore'
import {
  backToBranchPointInPlayer,
  chooseOptionInPlayer,
  nextEdgeInPlayer,
  playPause,
  previousEdgeInPlayer,
  seekPlayer,
  setLayer,
  setOrientation,
  setSpeed,
  setTransportFlag,
  showLineInPlayer,
  timingOf,
  usePlayerStore,
} from '../../state/playerStore'
import { intervalLabelAt, lineChoices } from '../../state/selectors'
import { useSettingsStore } from '../../state/settingsStore'
import { CheckboxField } from '../common/fields'

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
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className="button--primary"
          onClick={() => {
            chooseOptionInPlayer(option.id)
          }}
        >
          {optionTitle(play, option.id)}
        </button>
      ))}
    </div>
  )
}

/** Liste « Ligne » (D-142): the line read, shown and edited, hidden when there is only one. */
function LineChooser({ play, line }: { play: Play; line: readonly Id[] }) {
  const choices = lineChoices(play)
  if (choices.length < 2) return null
  const shown = line.join()
  return (
    <label>
      Ligne{' '}
      <select
        aria-label="Ligne"
        value={String(choices.findIndex((choice) => choice.line.join() === shown))}
        onChange={(e) => {
          const choice = choices[Number(e.target.value)]
          if (choice) showLineInPlayer(choice.line)
        }}
      >
        {choices.map((choice, index) => (
          <option key={choice.line.join()} value={String(index)}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function TransportBar({ stageRef }: { stageRef: RefObject<HTMLElement | null> }) {
  const play = useEditorStore((s) => s.play)
  const transport = usePlayerStore((s) => s.transport)
  const layers = usePlayerStore((s) => s.layers)
  const orientation = usePlayerStore((s) => s.orientation)
  const settings = useSettingsStore((s) => s.settings)
  if (!play) return null
  const timing = timingOf(play, transport.line)

  return (
    <div className="transport" aria-label="Lecture">
      <div className="transport__main">
        <button type="button" onClick={previousEdgeInPlayer} title="Bord de bloc précédent">
          Bord précédent
        </button>
        <button
          type="button"
          className="button--primary transport__play"
          onClick={playPause}
          title="Lecture / pause (L)"
        >
          {transport.playing ? 'Pause' : 'Lecture'}
        </button>
        <button type="button" onClick={nextEdgeInPlayer} title="Bord de bloc suivant">
          Bord suivant
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
        <LineChooser play={play} line={transport.line} />
        <span className="transport__interval" role="status" data-testid="current-interval">
          {intervalLabelAt(play, transport.line, transport.t, settings)}
        </span>
        {hasPassedBranchPoint(timing, transport.t) && !transport.waitingAt ? (
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
        <CheckboxField
          label="En-avant"
          checked={layers.forwardPass}
          onChange={(v) => {
            setLayer('forwardPass', v)
          }}
        />
        <CheckboxField
          label="Vitesses"
          title="Vitesses et accélérations"
          checked={layers.speedAlert}
          onChange={(v) => {
            setLayer('speedAlert', v)
          }}
        />
      </div>
    </div>
  )
}
