import { describe, expect, it } from 'vitest'
import { PACE_DEFAULTS, SPEED_ALERT_DEFAULTS } from '../config/defaults'
import {
  alertZones,
  dragValue,
  keyValue,
  paceMarkers,
  sliderRange,
  sliderValueOf,
  storedValue,
  trackFraction,
} from './speedSlider'

const markers = paceMarkers(PACE_DEFAULTS)
// Marche 7,2 km/h, trot 14,4 km/h, sprint 19,8 km/h.

describe('speed slider (D-133)', () => {
  it('runs from 1 km/h to the red threshold plus 5 km/h', () => {
    const range = sliderRange(SPEED_ALERT_DEFAULTS)
    expect(range.min).toBe(1)
    expect(range.max).toBeCloseTo(30, 9)
    expect(sliderRange({ warning: 5, danger: 7 }).max).toBeCloseTo(30.2, 9)
  })

  it('snaps to a marker within 0,5 km/h while dragging, and keeps its named pace on release', () => {
    const near = dragValue(19.4, markers)
    expect(near).toEqual({ kmh: markers[2]?.kmh, pace: 'sprint' })
    expect(storedValue(near)).toBe('sprint')
    expect(dragValue(14.9, markers).pace).toBe('jog')
    expect(dragValue(6.7, markers).pace).toBe('walk')
  })

  it('stores a typed speed in m/s away from the markers', () => {
    const away = dragValue(17, markers)
    expect(away).toEqual({ kmh: 17, pace: null })
    expect(storedValue(away)).toBeCloseTo(17 / 3.6, 12)
    expect(dragValue(19.2, markers).pace).toBeNull()
  })

  it('takes the nearest of two close markers', () => {
    const close = paceMarkers({ walk: 2, jog: 2.1, sprint: 5.5 })
    // 7,2 and 7,56 km/h: 7,45 is closer to the jog.
    expect(dragValue(7.45, close).pace).toBe('jog')
  })

  it('at an arrow key, only a value equal to a marker gives its pace', () => {
    expect(keyValue(19.7, markers)).toEqual({ kmh: 19.7, pace: null })
    expect(keyValue(19.8, markers).pace).toBe('sprint')
    // A marker off the 0,1 km/h step (5,55 m/s = 19,98 km/h) equals the nearest step.
    const offStep = paceMarkers({ walk: 2, jog: 4, sprint: 5.55 })
    expect(keyValue(20, offStep).pace).toBe('sprint')
    expect(keyValue(19.9, offStep).pace).toBeNull()
  })

  it('places a named pace on its marker and a typed speed in km/h', () => {
    expect(sliderValueOf('jog', PACE_DEFAULTS)).toEqual({ kmh: 4 * 3.6, pace: 'jog' })
    expect(sliderValueOf(5, PACE_DEFAULTS)).toEqual({ kmh: 18, pace: null })
  })

  it('clamps the position to the track and lays the orange and red zones', () => {
    const range = sliderRange(SPEED_ALERT_DEFAULTS)
    expect(trackFraction(0, range)).toBe(0)
    expect(trackFraction(45, range)).toBe(1)
    expect(trackFraction(15.5, range)).toBeCloseTo(0.5, 9)
    const zones = alertZones(SPEED_ALERT_DEFAULTS, range)
    expect(zones.warning.from).toBeCloseTo(19 / 29, 9)
    expect(zones.warning.to).toBeCloseTo(24 / 29, 9)
    expect(zones.danger).toEqual({ from: zones.warning.to, to: 1 })
  })
})
