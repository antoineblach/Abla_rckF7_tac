// Speed slider of the inspector (D-133): a native range in km/h, with the pace markers and the
// orange and red zones as flat elements under the track. Display only: the logic is in
// ui/speedSlider.ts. One undo step per gesture: the value is committed on release (native
// « change » event) or at each arrow key, never while dragging.
import { useEffect, useRef, useState } from 'react'
import { SPEED_SLIDER } from '../../config/defaults'
import type { SpeedAlertSettings } from '../../model/settings'
import type { Pace, SpeedValue } from '../../model/types'
import { formatSpeed, kmhToMps } from '../format'
import {
  alertZones,
  dragValue,
  keyValue,
  paceMarkers,
  sliderRange,
  sliderValueOf,
  storedValue,
  trackFraction,
  type SliderValue,
} from '../speedSlider'
import { PACE_LABELS } from '../strings'

/** Position on the track of a fraction, the thumb width taken into account (see global.css). */
const at = (fraction: number) =>
  `calc(var(--speed-thumb) / 2 + (100% - var(--speed-thumb)) * ${String(fraction)})`

export function SpeedSlider({
  label,
  value,
  paces,
  speedAlert,
  disabled,
  onCommit,
}: {
  label: string
  value: SpeedValue
  paces: Record<Pace, number>
  speedAlert: SpeedAlertSettings
  disabled: boolean
  onCommit: (value: SpeedValue) => void
}) {
  const range = sliderRange(speedAlert)
  const markers = paceMarkers(paces)
  const zones = alertZones(speedAlert, range)
  const [draft, setDraft] = useState<SliderValue | null>(null)
  // Written and read in the handlers only: the draft as the native listener sees it.
  const draftRef = useRef<SliderValue | null>(null)
  const dragging = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const setBoth = (next: SliderValue | null) => {
    draftRef.current = next
    setDraft(next)
  }

  useEffect(() => {
    const element = input.current
    if (!element) return
    const onChange = () => {
      const raw = Number(element.value)
      const next = draftRef.current ?? (dragging.current ? dragValue : keyValue)(raw, markers)
      dragging.current = false
      draftRef.current = null
      setDraft(null)
      onCommit(storedValue(next))
    }
    element.addEventListener('change', onChange)
    return () => {
      element.removeEventListener('change', onChange)
    }
  }, [markers, onCommit])

  const shown = draft ?? sliderValueOf(value, paces)
  const text = `${formatSpeed(kmhToMps(shown.kmh))}${shown.pace ? `, ${PACE_LABELS[shown.pace]}` : ''}`
  return (
    <div className="speed-slider">
      <div className="speed-slider__track">
        <span
          className="speed-slider__zone speed-slider__zone--warning"
          aria-hidden="true"
          style={{ left: at(zones.warning.from), right: `calc(100% - ${at(zones.warning.to)})` }}
        />
        <span
          className="speed-slider__zone speed-slider__zone--danger"
          aria-hidden="true"
          style={{ left: at(zones.danger.from), right: `calc(100% - ${at(zones.danger.to)})` }}
        />
        {markers.map((marker) => (
          <span
            key={marker.pace}
            className="speed-slider__marker"
            data-testid={`speed-marker-${marker.pace}`}
            aria-hidden="true"
            title={PACE_LABELS[marker.pace]}
            style={{ left: at(trackFraction(marker.kmh, range)) }}
          >
            <span className="speed-slider__marker-label">{PACE_LABELS[marker.pace]}</span>
          </span>
        ))}
        <input
          ref={input}
          type="range"
          className="speed-slider__input"
          aria-label={label}
          aria-valuetext={text}
          min={range.min}
          max={range.max}
          step={SPEED_SLIDER.stepKmh}
          value={Math.min(range.max, Math.max(range.min, shown.kmh))}
          disabled={disabled}
          onPointerDown={() => {
            dragging.current = true
          }}
          onKeyDown={() => {
            dragging.current = false
          }}
          onChange={(e) => {
            // Kept as a draft so that React does not restore the former value before « change ».
            const raw = Number(e.target.value)
            setBoth((dragging.current ? dragValue : keyValue)(raw, markers))
          }}
          onBlur={() => {
            dragging.current = false
            setBoth(null)
          }}
        />
      </div>
      <output className="speed-slider__value" data-testid="speed-slider-value">
        {text}
      </output>
    </div>
  )
}
