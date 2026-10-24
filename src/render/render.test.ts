import { describe, expect, it } from 'vitest'
import { lineBounds } from '../engine/bounds'
import { createCaches } from '../engine/caches'
import { evaluate } from '../engine/evaluate'
import { compileLine } from '../engine/timeline'
import { defaultSettings, engineSettingsOf } from '../model/settings'
import type { Play } from '../model/types'
import { ball, basePlay, pass, phase, player, run, uuid } from '../test/builders'
import { compareWithSnapshot, createTestCanvas } from '../test/imageSnapshot'
import { createRecordingContext } from '../test/recordingCtx'
import type { Ctx2D } from './ctx2d'
import { DEFAULT_LAYERS, type Layers } from './layers'
import { EMPTY_OVERLAY, renderOverlay } from './overlay'
import { drawGainLine, render } from './render'
import { renderSchematic } from './renderSchematic'
import { mixColors, readableTextColor, THEMES } from './themes'
import { createViewport, ORIENTATIONS, toPx, type Orientation } from './viewport'

const settings = engineSettingsOf(defaultSettings())
const A1 = uuid(1)
const A2 = uuid(2)
const B1 = uuid(11)
const T1 = uuid(100)
const T2 = uuid(101)
const LINE = [T1, T2]

/** Simple scene: a run, a pass to a running receiver, a defender; two phases. */
function simpleScene(): Play {
  return basePlay({
    entities: [player(A1, 'A', 1), player(A2, 'A', 2), player(B1, 'B', 1), ball(uuid(20))],
    setup: {
      positions: { [A1]: { x: 40, y: 30 }, [A2]: { x: 38, y: 40 }, [B1]: { x: 52, y: 33 } },
      ballCarrierId: A1,
      ballPosition: null,
    },
    phases: [
      phase(T1, null, [
        run(uuid(200), A1, [{ x: 48, y: 28 }], { pace: 'jog' }),
        run(
          uuid(201),
          A2,
          [
            { x: 43, y: 41 },
            { x: 47, y: 43 },
          ],
          { pace: 'sprint' },
        ),
        run(uuid(202), B1, [{ x: 49, y: 34 }], { pace: 'walk' }),
        pass(uuid(203), A1, A2, 1.2),
      ]),
      phase(T2, T1, [run(uuid(210), A2, [{ x: 56, y: 45 }], { pace: 'sprint' })], {
        instruction: 'Fixer puis passer',
      }),
    ],
  })
}

const sizes: Record<Orientation, [number, number]> = {
  landscape: [480, 270],
  portrait: [270, 480],
  square: [360, 360],
}

function drawScene(
  ctx: Ctx2D,
  orientation: Orientation,
  themeId: 'screen' | 'highContrast',
  layers: Layers = DEFAULT_LAYERS,
) {
  const play = simpleScene()
  const caches = createCaches()
  const compiled = compileLine(play, LINE, settings, caches)
  const bounds = lineBounds(compiled)
  if (!bounds) throw new Error('empty scene')
  const t2 = compiled.phases[1]
  const t = ((t2?.start ?? 0) + (t2?.end ?? 0)) / 2
  const state = evaluate(play, LINE, t, settings, caches)
  const [widthPx, heightPx] = sizes[orientation]
  const viewport = createViewport({
    widthPx,
    heightPx,
    pixelRatio: 1,
    frame: {
      min: { x: bounds.min.x - 5, y: bounds.min.y - 5 },
      max: { x: bounds.max.x + 5, y: bounds.max.y + 5 },
    },
    orientation,
    attackingTeam: play.attackingTeam,
  })
  render(ctx, state, viewport, THEMES[themeId], layers)
  return { play, viewport, caches }
}

describe('render: reference images (SPEC 3.3, 13)', () => {
  for (const themeId of ['screen', 'highContrast'] as const) {
    for (const orientation of ORIENTATIONS) {
      it(`simple scene, theme ${themeId}, ${orientation}`, async () => {
        const [w, h] = sizes[orientation]
        const { canvas, ctx } = createTestCanvas(w, h)
        drawScene(ctx, orientation, themeId)
        const result = await compareWithSnapshot(canvas, `scene-${themeId}-${orientation}`)
        expect(result.pass, result.message).toBe(true)
      })
    }
  }

  it('schematic of a phase, theme screen, landscape', async () => {
    const { canvas, ctx } = createTestCanvas(480, 270)
    const play = simpleScene()
    const viewport = createViewport({
      widthPx: 480,
      heightPx: 270,
      pixelRatio: 1,
      frame: { min: { x: 32, y: 22 }, max: { x: 62, y: 50 } },
      orientation: 'landscape',
      attackingTeam: 'A',
    })
    renderSchematic(ctx, play, LINE, T2, viewport, THEMES.screen, settings, createCaches())
    const result = await compareWithSnapshot(canvas, 'schematic-screen-landscape')
    expect(result.pass, result.message).toBe(true)
  })
})

describe('render: flat colours and determinism (SPEC 3.3.3, 3.3.6)', () => {
  it('never uses gradients, patterns, shadows or filters, whatever the theme and layers', () => {
    for (const themeId of ['screen', 'highContrast'] as const) {
      for (const orientation of ORIENTATIONS) {
        const recording = createRecordingContext()
        // The recording context throws on any method outside the allowed list.
        expect(() => drawScene(recording.ctx, orientation, themeId)).not.toThrow()
        for (const forbidden of [
          'shadowBlur',
          'shadowColor',
          'shadowOffsetX',
          'filter',
          'globalAlpha',
          'globalCompositeOperation',
        ]) {
          expect(recording.writtenProperties.has(forbidden)).toBe(false)
        }
        for (const call of recording.calls.filter(
          (c) => c.kind === 'set' && /Style$/.test(c.name),
        )) {
          expect(typeof call.args[0]).toBe('string')
        }
      }
    }
  })

  it('draws every stroke at least 3 px wide in high contrast at scale 1 (SPEC 13.2)', () => {
    const recording = createRecordingContext()
    drawScene(recording.ctx, 'landscape', 'highContrast')
    const strokes = recording.calls.filter((c) => c.name === 'stroke')
    expect(strokes.length).toBeGreaterThan(0)
    for (const stroke of strokes) expect(stroke.lineWidth).toBeGreaterThanOrEqual(3)
  })

  it('produces the same drawing calls for the same inputs', () => {
    const first = createRecordingContext()
    const second = createRecordingContext()
    drawScene(first.ctx, 'portrait', 'screen')
    drawScene(second.ctx, 'portrait', 'screen')
    expect(JSON.stringify(second.calls)).toBe(JSON.stringify(first.calls))
  })

  it('switches layers independently', () => {
    const count = (layers: Layers) => {
      const recording = createRecordingContext()
      drawScene(recording.ctx, 'landscape', 'screen', layers)
      return recording.calls.length
    }
    const off: Layers = {
      traces: false,
      instruction: false,
      gainLine: false,
      forwardPass: false,
      speedAlert: false,
    }
    const all = count(DEFAULT_LAYERS)
    const none = count(off)
    const onlyTraces = count({ ...off, traces: true })
    const onlyInstruction = count({ ...off, instruction: true })
    const onlyGain = count({ ...off, gainLine: true })
    expect(onlyTraces).toBeGreaterThan(none)
    expect(onlyInstruction).toBeGreaterThan(none)
    expect(onlyGain).toBeGreaterThan(none)
    expect(all - none).toBe(onlyTraces - none + (onlyInstruction - none) + (onlyGain - none))
  })

  it('draws the editor overlay with allowed calls only', () => {
    const recording = createRecordingContext()
    const viewport = createViewport({
      widthPx: 400,
      heightPx: 300,
      pixelRatio: 2,
      frame: { min: { x: 0, y: 0 }, max: { x: 40, y: 30 } },
      orientation: 'landscape',
      attackingTeam: 'A',
    })
    renderOverlay(recording.ctx, viewport, THEMES.highContrast, {
      ...EMPTY_OVERLAY,
      selectedPlayers: [{ x: 10, y: 10 }],
      handles: [{ x: 12, y: 12 }],
      preview: [
        { x: 1, y: 1 },
        { x: 5, y: 5 },
      ],
      selectionBox: { min: { x: 2, y: 2 }, max: { x: 8, y: 6 } },
    })
    expect(recording.calls.filter((c) => c.name === 'stroke').length).toBeGreaterThanOrEqual(4)
  })
})

describe('render: attack direction (SPEC 5.6, DECISIONS Q6)', () => {
  it('points the gain line arrows to the right or left in landscape, upwards in portrait and square', () => {
    const cases: [Orientation, 'A' | 'B', 'right' | 'left' | 'up'][] = [
      ['landscape', 'A', 'right'],
      ['landscape', 'B', 'left'],
      ['portrait', 'A', 'up'],
      ['portrait', 'B', 'up'],
      ['square', 'A', 'up'],
      ['square', 'B', 'up'],
    ]
    for (const [orientation, team, expected] of cases) {
      const [widthPx, heightPx] = sizes[orientation]
      const viewport = createViewport({
        widthPx,
        heightPx,
        pixelRatio: 1,
        frame: { min: { x: -10, y: 0 }, max: { x: 110, y: 70 } },
        orientation,
        attackingTeam: team,
      })
      const { ctx, calls } = createRecordingContext()
      drawGainLine(ctx, viewport, THEMES.screen, 50, { width: 70 }, team)
      const start = toPx(viewport, { x: 50, y: 70 * 0.12 })
      const near = (args: unknown[], p: { x: number; y: number }) =>
        Math.abs((args[0] as number) - p.x) < 0.01 && Math.abs((args[1] as number) - p.y) < 0.01
      const from = calls.findIndex((c) => c.name === 'moveTo' && near(c.args, start))
      const tip = calls.slice(from + 1).find((c) => c.name === 'lineTo')
      expect(from, `${orientation} ${team}`).toBeGreaterThanOrEqual(0)
      const dx = (tip?.args[0] as number) - start.x
      const dy = (tip?.args[1] as number) - start.y
      const direction =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy < 0 ? 'up' : 'down'
      expect(direction, `${orientation} ${team}`).toBe(expected)
    }
  })
})

describe('theme helpers', () => {
  it('mixes flat colours and picks a readable text colour', () => {
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(readableTextColor('#0072B2')).toBe('#ffffff')
    expect(readableTextColor('#E69F00')).toBe('#000000')
  })
})

// Compile-time check: the browser contexts satisfy Ctx2D (SPEC 3.3.2).
export const acceptsCanvas = (c: CanvasRenderingContext2D): Ctx2D => c
export const acceptsOffscreen = (c: OffscreenCanvasRenderingContext2D): Ctx2D => c
