// Rendering of the set pieces of lot 3 (SPEC 10.3 to 10.5, 13.3, D-084 to D-086): kicks in long
// dashes with a ground shadow and a growing ball, ring and label of a ruck or a maul, ignored part
// of a cut run, forward pass badge on its layer.
import { describe, expect, it } from 'vitest'
import { KICK_APEX_SCALE } from '../config/defaults'
import { lineBounds } from '../engine/bounds'
import { createCaches } from '../engine/caches'
import { evaluate, phaseSchematic } from '../engine/evaluate'
import type { SceneState } from '../engine/sceneState'
import { compileLine } from '../engine/timeline'
import { allLines } from '../model/phaseTree'
import { defaultSettings, engineSettingsOf } from '../model/settings'
import type { Id } from '../model/types'
import { P, setPiecesPlay, uuid } from '../test/builders'
import { compareWithSnapshot, createTestCanvas } from '../test/imageSnapshot'
import { createRecordingContext, paintEvents, type RecordingContext } from '../test/recordingCtx'
import type { Ctx2D } from './ctx2d'
import { DEFAULT_LAYERS, type Layers } from './layers'
import { render } from './render'
import { drawSchematic, renderSchematic } from './renderSchematic'
import { RENDER_THEME_IDS, THEMES, type RenderThemeId } from './themes'
import { createViewport, sizePx, toPx, type Orientation, type Viewport } from './viewport'

const settings = engineSettingsOf(defaultSettings())
const play = setPiecesPlay()
const [LINE_A, LINE_B] = allLines(play) as [Id[], Id[]]
const T4 = uuid(104)

function viewportFor(
  widthPx: number,
  heightPx: number,
  orientation: Orientation,
  pixelRatio = 1,
): Viewport {
  const bounds = lineBounds(compileLine(play, LINE_A, settings, createCaches()))
  if (!bounds) throw new Error('empty play')
  return createViewport({
    widthPx,
    heightPx,
    pixelRatio,
    frame: {
      min: { x: bounds.min.x - 5, y: bounds.min.y - 5 },
      max: { x: bounds.max.x + 5, y: bounds.max.y + 5 },
    },
    orientation,
    attackingTeam: play.attackingTeam,
  })
}

/** Instants of the line A: ruck in progress, kick at its apex, forward pass in flight. */
function instants() {
  const compiled = compileLine(play, LINE_A, settings, createCaches())
  const t2 = compiled.phases[1]?.start ?? NaN
  const t3 = compiled.phases[2]?.start ?? NaN
  return { ruck: 3, forward: t2 + 0.4, kickApex: t3 + 0.5 + 3.5 / 2 }
}

function sceneAt(t: number, line: Id[] = LINE_A): SceneState {
  return evaluate(play, line, t, settings, createCaches())
}

function drawScene(
  ctx: Ctx2D,
  t: number,
  themeId: RenderThemeId,
  viewport: Viewport,
  layers: Layers = DEFAULT_LAYERS,
) {
  const state = sceneAt(t)
  render(ctx, state, viewport, THEMES[themeId], layers)
  return state
}

function drawPhase(
  ctx: Ctx2D,
  phaseId: Id,
  themeId: RenderThemeId,
  viewport: Viewport,
  forwardPass = false,
): void {
  const schematic = phaseSchematic(play, phaseId, settings, createCaches())
  if (!schematic) throw new Error('no schematic')
  drawSchematic(ctx, schematic, viewport, THEMES[themeId], { forwardPass })
}

const texts = (recording: RecordingContext): unknown[] =>
  paintEvents(recording.calls)
    .filter((e) => e.kind === 'fillText')
    .map((e) => e.args[0])

describe('set pieces: reference images (SPEC 10, 13.3, D-084)', () => {
  const cases: [string, number, number, Orientation, (ctx: Ctx2D, v: Viewport) => void][] = [
    [
      'scene-ruck-highContrast-portrait',
      270,
      480,
      'portrait',
      (ctx, v) => drawScene(ctx, instants().ruck, 'highContrast', v),
    ],
    [
      'scene-kick-highContrast-portrait',
      270,
      480,
      'portrait',
      (ctx, v) => drawScene(ctx, instants().kickApex, 'highContrast', v),
    ],
    [
      'schematic-ruck-printBw-portrait',
      270,
      480,
      'portrait',
      (ctx, v) => {
        drawPhase(ctx, P.t1, 'printBw', v)
      },
    ],
    [
      'schematic-kick-screen-landscape',
      480,
      270,
      'landscape',
      (ctx, v) => {
        drawPhase(ctx, P.t3a, 'screen', v)
      },
    ],
    [
      'schematic-forward-screen-landscape',
      480,
      270,
      'landscape',
      (ctx, v) => {
        drawPhase(ctx, P.t2, 'screen', v, true)
      },
    ],
  ]
  for (const [name, w, h, orientation, draw] of cases) {
    it(name, async () => {
      const { canvas, ctx } = createTestCanvas(w, h)
      draw(ctx, viewportFor(w, h, orientation))
      const result = await compareWithSnapshot(canvas, name)
      expect(result.pass, result.message).toBe(true)
    })
  }
})

describe('set pieces: drawing conventions', () => {
  const PR = 1.5
  const viewport = viewportFor(540, 960, 'portrait', PR)

  it('draws kicks in long dashes of the ball colour in every theme, scene and schematic', () => {
    for (const themeId of RENDER_THEME_IDS) {
      const theme = THEMES[themeId]
      const scene = createRecordingContext()
      drawScene(scene.ctx, instants().kickApex, themeId, viewport)
      const schematic = createRecordingContext()
      drawPhase(schematic.ctx, P.t3a, themeId, viewport)
      for (const recording of [scene, schematic]) {
        const kicks = paintEvents(recording.calls).filter(
          (e) =>
            e.kind === 'stroke' &&
            e.dash.length === 2 &&
            Math.abs((e.dash[0] ?? 0) - (theme.kickDash[0] ?? NaN) * PR) < 1e-6,
        )
        expect(kicks.length, themeId).toBeGreaterThan(0)
        for (const k of kicks) {
          expect(k.dash).toEqual(theme.kickDash.map((d) => d * PR))
          expect(k.lineWidth).toBeCloseTo(theme.kickWidth * PR, 9)
          expect(k.color).toBe(theme.passColor)
        }
      }
    }
  })

  it('grows the kicked ball up to its apex and drops its shadow on the ground', () => {
    const theme = THEMES.highContrast
    const recording = createRecordingContext()
    const state = drawScene(recording.ctx, instants().kickApex, 'highContrast', viewport)
    const ball = state.ball
    if (ball?.kind !== 'inFlight') throw new Error('ball not in flight')
    expect(ball.lift).toBeCloseTo(1, 9)
    const center = toPx(viewport, ball.pos)
    const from = toPx(viewport, ball.from)
    const to = toPx(viewport, ball.to)
    const len = Math.hypot(to.x - from.x, to.y - from.y)
    const u = { x: (to.x - from.x) / len, y: (to.y - from.y) / len }
    const half = sizePx(viewport, theme.ballLength) / 2
    const events = paintEvents(recording.calls)
    const startOf = (e: (typeof events)[number]) => e.path.find((c) => c.name === 'moveTo')?.args
    const ballFill = events.find(
      (e) =>
        e.kind === 'fill' &&
        e.color === theme.ballFill &&
        Math.abs((startOf(e)?.[0] as number) - (center.x + u.x * half * KICK_APEX_SCALE)) < 0.01,
    )
    const shadow = events.find((e) => e.kind === 'fill' && e.color === theme.kickShadow)
    if (!ballFill || !shadow) throw new Error('ball or shadow missing')
    // Shadow of the ball's ground size, offset towards the bottom right by the full offset.
    const offset = sizePx(viewport, theme.kickShadowOffset)
    expect(startOf(shadow)?.[0]).toBeCloseTo(center.x + offset + u.x * half, 2)
    expect(startOf(shadow)?.[1]).toBeCloseTo(center.y + offset + u.y * half, 2)
    // The shadow lies under the ball: drawn first.
    expect(events.indexOf(shadow)).toBeLessThan(events.indexOf(ballFill))
  })

  it('draws the ring and the label of a ruck in progress, the ball behind the tackled player', () => {
    const theme = THEMES.screen
    const recording = createRecordingContext()
    const state = drawScene(recording.ctx, instants().ruck, 'screen', viewport)
    expect(state.breakdowns).toHaveLength(1)
    const center = toPx(viewport, state.breakdowns[0]?.pos ?? { x: 0, y: 0 })
    const events = paintEvents(recording.calls)
    const ring = events.find(
      (e) =>
        e.kind === 'stroke' &&
        e.color === theme.breakdownColor &&
        e.path.some(
          (c) =>
            c.name === 'arc' &&
            Math.abs((c.args[0] as number) - center.x) < 0.01 &&
            Math.abs((c.args[2] as number) - sizePx(viewport, theme.tokenRadius) * 2) < 0.01,
        ),
    )
    expect(ring?.lineWidth).toBeCloseTo(theme.breakdownWidth * PR, 9)
    expect(texts(recording)).toContain('Ruck')
    expect(state.ball?.kind).toBe('inBreakdown')
    // No ring once the ball is out.
    const after = createRecordingContext()
    drawScene(after.ctx, 4.6, 'screen', viewport)
    expect(texts(after)).not.toContain('Ruck')
  })

  it('marks the breakdowns of a phase at rest, a maul by its label, ancestors as ghosts', () => {
    const maul = createRecordingContext()
    drawPhase(maul.ctx, P.t3b, 'screen', viewport)
    expect(texts(maul)).toContain('Maul')
    const ghosts = paintEvents(maul.calls).filter(
      (e) =>
        e.kind === 'stroke' &&
        e.color === THEMES.screen.ghost &&
        e.path.some((c) => c.name === 'arc'),
    )
    expect(ghosts.length).toBeGreaterThan(0)
  })

  it('draws the ignored part of a run cut by a breakdown in the error colour', () => {
    const theme = THEMES.screen
    const recording = createRecordingContext()
    drawPhase(recording.ctx, P.t3b, 'screen', viewport)
    const ignored = paintEvents(recording.calls).filter(
      (e) => e.kind === 'stroke' && e.color === theme.error && e.dash.length === 0,
    )
    expect(ignored.length).toBeGreaterThan(0)
    expect(ignored[0]?.lineWidth).toBeCloseTo(theme.ghostWidth * PR, 9)
  })

  it('shows the forward pass badge on its layer in the player, always in the editor only', () => {
    const t = instants().forward
    const withBadge = createRecordingContext()
    drawScene(withBadge.ctx, t, 'screen', viewport, DEFAULT_LAYERS)
    expect(texts(withBadge)).toContain('!')
    const without = createRecordingContext()
    drawScene(without.ctx, t, 'screen', viewport, { ...DEFAULT_LAYERS, forwardPass: false })
    expect(texts(without)).not.toContain('!')
    // Independent of the traces layer.
    const noTraces = createRecordingContext()
    drawScene(noTraces.ctx, t, 'screen', viewport, { ...DEFAULT_LAYERS, traces: false })
    expect(texts(noTraces)).toContain('!')
    // Schematic: shown by the editor, not by default (PDF and thumbnails, D-086).
    const editor = createRecordingContext()
    drawPhase(editor.ctx, P.t2, 'screen', viewport, true)
    expect(texts(editor)).toContain('!')
    const pdf = createRecordingContext()
    renderSchematic(
      pdf.ctx,
      play,
      LINE_A,
      P.t2,
      viewport,
      THEMES.printColor,
      settings,
      createCaches(),
    )
    expect(texts(pdf)).not.toContain('!')
  })

  it('stays in flat colours, greys only in N&B, strokes of 3 px at least in high contrast', () => {
    const t = instants()
    const draws: ((ctx: Ctx2D, themeId: RenderThemeId) => void)[] = [
      (ctx, id) => drawScene(ctx, t.ruck, id, viewport),
      (ctx, id) => drawScene(ctx, t.kickApex, id, viewport),
      (ctx, id) => drawScene(ctx, t.forward, id, viewport),
      (ctx, id) => drawScene(ctx, 1e9, id, viewport),
      (ctx, id) => {
        drawPhase(ctx, P.t1, id, viewport, true)
      },
      (ctx, id) => {
        drawPhase(ctx, P.t3b, id, viewport, true)
      },
      (ctx, id) => {
        drawPhase(ctx, T4, id, viewport, true)
      },
    ]
    for (const themeId of RENDER_THEME_IDS) {
      for (const draw of draws) {
        const recording = createRecordingContext()
        expect(() => {
          draw(recording.ctx, themeId)
        }).not.toThrow()
        for (const forbidden of ['shadowBlur', 'shadowColor', 'filter', 'globalAlpha']) {
          expect(recording.writtenProperties.has(forbidden)).toBe(false)
        }
        const colors = recording.calls
          .filter((c) => c.kind === 'set' && /Style$/.test(c.name))
          .map((c) => c.args[0])
        for (const color of colors) expect(typeof color).toBe('string')
        if (themeId === 'printBw') {
          for (const color of colors) {
            expect(/^#([0-9a-f]{2})\1\1$/i.test(String(color)), String(color)).toBe(true)
          }
        }
        if (themeId === 'highContrast') {
          for (const stroke of recording.calls.filter((c) => c.name === 'stroke')) {
            expect(stroke.lineWidth).toBeGreaterThanOrEqual(3 * PR)
          }
        }
      }
    }
    // Option B ends with a restart caught by B7: the trace ends with an arrow at her edge.
    expect(sceneAt(1e9, LINE_B).kickTraces.at(-1)?.completed).toBe(true)
  })
})
