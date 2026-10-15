import { describe, expect, it } from 'vitest'
import type { Team } from '../model/types'
import {
  createViewport,
  fitView,
  frameForView,
  ORIENTATIONS,
  panView,
  toMeters,
  toPx,
  viewportFromView,
  visibleBounds,
  zoomView,
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

  it('builds the same viewport from a fitted view as from the frame, at any pixel ratio', () => {
    for (const orientation of ORIENTATIONS) {
      for (const team of ['A', 'B'] as const) {
        for (const rotate180 of [false, true]) {
          const fromFrame = make(orientation, team, rotate180)
          const { widthPx, heightPx } = fromFrame
          const view = fitView(frame, widthPx, heightPx, orientation, team, rotate180)
          const fromView = viewportFromView({
            widthPx: widthPx * 2,
            heightPx: heightPx * 2,
            pixelRatio: 2,
            view,
            orientation,
            attackingTeam: team,
            rotate180,
          })
          expect(fromView.scale).toBeCloseTo(fromFrame.scale * 2, 9)
          expect(fromView.origin.x).toBeCloseTo(fromFrame.origin.x * 2, 9)
          expect(fromView.origin.y).toBeCloseTo(fromFrame.origin.y * 2, 9)
          expect(fromView.ex).toEqual(fromFrame.ex)
        }
      }
    }
  })

  it('keeps the scale and the centre when the canvas is resized (D-048)', () => {
    const view = fitView(frame, 960, 540, 'landscape', 'A')
    for (const [widthPx, heightPx] of [
      [960, 540],
      [700, 540],
      [960, 300],
      [1400, 800],
    ] as const) {
      const viewport = viewportFromView({
        widthPx,
        heightPx,
        pixelRatio: 1,
        view,
        orientation: 'landscape',
        attackingTeam: 'A',
      })
      expect(viewport.scale).toBe(view.scale)
      const centre = toPx(viewport, view.center)
      expect(centre.x).toBeCloseTo(widthPx / 2, 9)
      expect(centre.y).toBeCloseTo(heightPx / 2, 9)
    }
  })

  it('zooms around a point, which stays in place, and pans', () => {
    const view = { center: { x: 50, y: 35 }, scale: 8 }
    const make1 = (v: typeof view) =>
      viewportFromView({
        widthPx: 960,
        heightPx: 540,
        pixelRatio: 1,
        view: v,
        orientation: 'portrait',
        attackingTeam: 'B',
      })
    const at = { x: 70, y: 20 }
    const zoomed = zoomView(view, at, 2)
    expect(zoomed.scale).toBe(16)
    const before = toPx(make1(view), at)
    const after = toPx(make1(zoomed), at)
    expect(after.x).toBeCloseTo(before.x, 9)
    expect(after.y).toBeCloseTo(before.y, 9)
    expect(panView(zoomed, { x: 5, y: -2.5 })).toEqual({
      center: { x: zoomed.center.x + 5, y: zoomed.center.y - 2.5 },
      scale: 16,
    })
  })
})
