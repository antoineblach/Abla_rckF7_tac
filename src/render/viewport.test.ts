import { describe, expect, it } from 'vitest'
import type { Team } from '../model/types'
import {
  createViewport,
  frameForView,
  ORIENTATIONS,
  panFrame,
  toMeters,
  toPx,
  visibleBounds,
  zoomFrame,
  type Orientation,
} from './viewport'

const field = { length: 100, width: 70, inGoal: 10 }
const frame = { min: { x: -10, y: 0 }, max: { x: 110, y: 70 } }
const make = (orientation: Orientation, team: Team, rotate180 = false) =>
  createViewport({
    widthPx: orientation === 'portrait' ? 540 : orientation === 'square' ? 720 : 960,
    heightPx: orientation === 'portrait' ? 960 : orientation === 'square' ? 720 : 540,
    pixelRatio: 1,
    frame,
    orientation,
    attackingTeam: team,
    rotate180,
  })

describe('viewport (SPEC 3.3.4, DECISIONS Q6)', () => {
  it('converts metres to pixels and back in every orientation, with and without 180°', () => {
    for (const orientation of ORIENTATIONS) {
      for (const team of ['A', 'B'] as const) {
        for (const rotate180 of [false, true]) {
          const viewport = make(orientation, team, rotate180)
          for (const p of [
            { x: 0, y: 0 },
            { x: 37.5, y: 12.25 },
            { x: 110, y: 70 },
          ]) {
            const back = toMeters(viewport, toPx(viewport, p))
            expect(back.x).toBeCloseTo(p.x, 9)
            expect(back.y).toBeCloseTo(p.y, 9)
          }
        }
      }
    }
  })

  it('keeps the field fixed in landscape, x to the right, even when B attacks', () => {
    for (const team of ['A', 'B'] as const) {
      const viewport = make('landscape', team)
      expect(toPx(viewport, { x: 100, y: 35 }).x).toBeGreaterThan(toPx(viewport, { x: 0, y: 35 }).x)
      // Left touchline (y = 0) at the top of the image.
      expect(toPx(viewport, { x: 50, y: 0 }).y).toBeLessThan(toPx(viewport, { x: 50, y: 70 }).y)
    }
  })

  it('puts the attack towards the top in portrait and square, for A and for B', () => {
    for (const orientation of ['portrait', 'square'] as const) {
      const a = make(orientation, 'A')
      expect(toPx(a, { x: 100, y: 35 }).y).toBeLessThan(toPx(a, { x: 0, y: 35 }).y)
      const b = make(orientation, 'B')
      expect(toPx(b, { x: 0, y: 35 }).y).toBeLessThan(toPx(b, { x: 100, y: 35 }).y)
    }
  })

  it('rotates by 180° on demand (lot 2): landscape attacking to the right when B attacks', () => {
    const viewport = make('landscape', 'B', true)
    expect(toPx(viewport, { x: 0, y: 35 }).x).toBeGreaterThan(toPx(viewport, { x: 100, y: 35 }).x)
  })

  it('fits the frame inside the canvas, centred', () => {
    const viewport = make('landscape', 'A')
    expect(viewport.scale).toBeCloseTo(Math.min(960 / 120, 540 / 70), 9)
    const visible = visibleBounds(viewport)
    expect(visible.min.x).toBeLessThanOrEqual(-10 + 1e-9)
    expect(visible.max.x).toBeGreaterThanOrEqual(110 - 1e-9)
    expect(visible.min.y).toBeLessThanOrEqual(1e-9)
    expect(visible.max.y).toBeGreaterThanOrEqual(70 - 1e-9)
    const center = toPx(viewport, { x: 50, y: 35 })
    expect(center.x).toBeCloseTo(480, 9)
    expect(center.y).toBeCloseTo(270, 9)
  })

  it('computes the frames of the saved views (DECISIONS Q18)', () => {
    expect(frameForView({ kind: 'full' }, field, 'A')).toEqual({
      min: { x: -12, y: -2 },
      max: { x: 112, y: 72 },
    })
    const attackA = frameForView({ kind: 'half', side: 'attack' }, field, 'A')
    expect(attackA.min.x).toBe(48)
    expect(attackA.max.x).toBe(112)
    const attackB = frameForView({ kind: 'half', side: 'attack' }, field, 'B')
    expect(attackB.min.x).toBe(-12)
    expect(attackB.max.x).toBe(52)
    expect(
      frameForView({ kind: 'frame', min: { x: 30, y: 40 }, max: { x: 10, y: 20 } }, field, 'A'),
    ).toEqual({
      min: { x: 10, y: 20 },
      max: { x: 30, y: 40 },
    })
  })

  it('zooms around a point and pans', () => {
    const zoomed = zoomFrame({ min: { x: 0, y: 0 }, max: { x: 100, y: 50 } }, { x: 50, y: 25 }, 2)
    expect(zoomed).toEqual({ min: { x: 25, y: 12.5 }, max: { x: 75, y: 37.5 } })
    expect(panFrame(zoomed, { x: 5, y: -2.5 })).toEqual({
      min: { x: 30, y: 10 },
      max: { x: 80, y: 35 },
    })
  })
})
