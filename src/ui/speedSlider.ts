// Logic of the speed slider of the inspector (D-133): range in km/h, pace markers, snapping while
// dragging, value kept on release or at an arrow key, orange and red zones. Pure; the component
// (common/SpeedSlider.tsx) only displays it.
import { SPEED_SLIDER } from '../config/defaults'
import type { SpeedAlertSettings } from '../model/settings'
import { PACES, type Pace, type SpeedValue } from '../model/types'
import { kmhToMps, mpsToKmh } from './format'

export interface SliderRange {
  /** Bounds of the track, in km/h. */
  min: number
  max: number
}

export interface PaceMarker {
  pace: Pace
  kmh: number
}

/** A position of the slider: a speed in km/h, on a pace marker or not. */
export interface SliderValue {
  kmh: number
  pace: Pace | null
}

/** Below this gap in km/h, an arrow-key value equals a marker (half a step). */
const KEY_EQUAL_KMH = SPEED_SLIDER.stepKmh / 2

/** From 1 km/h to the red threshold plus 5 km/h, rounded to the step (Q8). */
export function sliderRange(speedAlert: SpeedAlertSettings): SliderRange {
  const max = mpsToKmh(speedAlert.danger) + SPEED_SLIDER.aboveDangerKmh
  return {
    min: SPEED_SLIDER.minKmh,
    max: Math.round(max / SPEED_SLIDER.stepKmh) * SPEED_SLIDER.stepKmh,
  }
}

/** Walk, jog and sprint at the paces of the settings. */
export function paceMarkers(paces: Record<Pace, number>): PaceMarker[] {
  return PACES.map((pace) => ({ pace, kmh: mpsToKmh(paces[pace]) }))
}

function nearestMarker(kmh: number, markers: readonly PaceMarker[], within: number) {
  let best: PaceMarker | null = null
  for (const marker of markers) {
    const gap = Math.abs(marker.kmh - kmh)
    if (gap <= within && (!best || gap < Math.abs(best.kmh - kmh))) best = marker
  }
  return best
}

/** While dragging: a speed within 0,5 km/h of a marker snaps to it. */
export function dragValue(kmh: number, markers: readonly PaceMarker[]): SliderValue {
  const marker = nearestMarker(kmh, markers, SPEED_SLIDER.snapKmh)
  return marker ? { kmh: marker.kmh, pace: marker.pace } : { kmh, pace: null }
}

/** At an arrow key (step 0,1 km/h): only a value equal to a marker gives its pace. */
export function keyValue(kmh: number, markers: readonly PaceMarker[]): SliderValue {
  const marker = nearestMarker(kmh, markers, KEY_EQUAL_KMH)
  return marker ? { kmh: marker.kmh, pace: marker.pace } : { kmh, pace: null }
}

/** Value stored on release: the named pace on a marker (it follows the settings), else m/s. */
export function storedValue(value: SliderValue): SpeedValue {
  return value.pace ?? kmhToMps(value.kmh)
}

/** Position of the slider for a stored value, on its marker for a named pace. */
export function sliderValueOf(value: SpeedValue, paces: Record<Pace, number>): SliderValue {
  return typeof value === 'number'
    ? { kmh: mpsToKmh(value), pace: null }
    : { kmh: mpsToKmh(paces[value]), pace: value }
}

/** Fraction of the track of a speed in km/h, clamped to the track. */
export function trackFraction(kmh: number, range: SliderRange): number {
  if (range.max <= range.min) return 0
  return Math.min(1, Math.max(0, (kmh - range.min) / (range.max - range.min)))
}

/** Orange zone (orange to red threshold) and red zone (beyond), as fractions of the track. */
export function alertZones(speedAlert: SpeedAlertSettings, range: SliderRange) {
  const warning = trackFraction(mpsToKmh(speedAlert.warning), range)
  const danger = trackFraction(mpsToKmh(speedAlert.danger), range)
  return {
    warning: { from: warning, to: danger },
    danger: { from: danger, to: 1 },
  }
}
