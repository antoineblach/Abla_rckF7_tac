// Export themes of lot 2 (SPEC 9.3, 13.2, D-062): drawing conventions checked on the recorded
// drawing calls, flat colours for every theme, ball drawn without transformation (D-071).
import { describe, expect, it } from 'vitest'
import { TEAM_COLORS } from '../config/defaults'
import { lineBounds } from '../engine/bounds'
import { createCaches } from '../engine/caches'
import { evaluate } from '../engine/evaluate'
import { compileLine } from '../engine/timeline'
import { defaultSettings, engineSettingsOf } from '../model/settings'
import type { Play, Vec2 } from '../model/types'
import { P, sevenVsSevenWithOptions } from '../test/builders'
import { createRecordingContext, paintEvents, type PaintEvent } from '../test/recordingCtx'
import { drawCard, drawDressing } from './captions'
import { DEFAULT_LAYERS } from './layers'
import { drawBall } from './primitives'
import { render } from './render'
import { renderSchematic } from './renderSchematic'
import { mixColors, RENDER_THEME_IDS, THEMES, type RenderThemeId } from './themes'
import { createViewport, toPx, type Viewport } from './viewport'

const settings = engineSettingsOf(defaultSettings())
const LINE = [P.t1, P.t2, P.t3a]
const PIXEL_RATIO = 1.5

/** The acceptance scenario, with a custom colour on A1 (the N&B theme must ignore it). */
function scenario(): Play {
  const play = sevenVsSevenWithOptions()
  return {
    ...play,
    entities: play.entities.map((e) =>
      e.kind === 'player' && e.id === P.A(1) ? { ...e, color: '#cc79a7' } : e,
    ),
  }
}

function viewportFor(play: Play): Viewport {
  const caches = createCaches()
  const bounds = lineBounds(compileLine(play, LINE, settings, caches))
  if (!bounds) throw new Error('empty play')
  return createViewport({
    widthPx: 540,
    heightPx: 960,
    pixelRatio: PIXEL_RATIO,
    frame: {
      min: { x: bounds.min.x - 5, y: bounds.min.y - 5 },
      max: { x: bounds.max.x + 5, y: bounds.max.y + 5 },
    },
    orientation: 'portrait',
    attackingTeam: play.attackingTeam,
  })
}

/** Scene in the middle of phase 2 (phase 1 traces faded) and schematic of phase 2. */
function drawAll(themeId: RenderThemeId) {
  const play = scenario()
  const caches = createCaches()
  const viewport = viewportFor(play)
  const compiled = compileLine(play, LINE, settings, caches)
  const t2 = compiled.phases[1]
  const t = ((t2?.start ?? 0) + (t2?.end ?? 0)) / 2
  const scene = createRecordingContext()
  const state = evaluate(play, LINE, t, settings, caches)
  render(scene.ctx, state, viewport, THEMES[themeId], DEFAULT_LAYERS)
  const schematic = createRecordingContext()
  renderSchematic(schematic.ctx, play, LINE, P.t2, viewport, THEMES[themeId], settings, caches)
  return { play, viewport, state, scene, schematic }
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.01

/** Fill or stroke of the token disc centred on `centerPx`. */
function tokenEvents(events: PaintEvent[], centerPx: Vec2, radius: number): PaintEvent[] {
  return events.filter((e) =>
    e.path.some(
      (c) =>
        c.name === 'arc' &&
        near(c.args[0] as number, centerPx.x) &&
        near(c.args[1] as number, centerPx.y) &&
        near(c.args[2] as number, radius),
    ),
  )
}

const isGrey = (color: unknown): boolean =>
  typeof color === 'string' && /^#([0-9a-f]{2})\1\1$/i.test(color)

describe('« Impression N&B » theme (SPEC 9.3, D-062)', () => {
  it('uses greys only (r = g = b)', () => {
    const { scene, schematic } = drawAll('printBw')
    for (const recording of [scene, schematic]) {
      const colors = recording.calls
        .filter((c) => c.kind === 'set' && /Style$/.test(c.name))
        .map((c) => c.args[0])
      expect(colors.length).toBeGreaterThan(0)
      for (const color of colors) expect(isGrey(color), String(color)).toBe(true)
    }
  })

  it('draws team A filled black with a white number, team B hollow, whatever the colours', () => {
    const { play, viewport, state, scene, schematic } = drawAll('printBw')
    const theme = THEMES.printBw
    const radius = theme.tokenRadius * PIXEL_RATIO
    for (const [recording, positions] of [
      [scene, state.players],
      [schematic, null],
    ] as const) {
      const events = paintEvents(recording.calls)
      const players =
        positions ??
        play.entities.flatMap((e) =>
          e.kind === 'player' && e.team === 'B'
            ? [{ id: e.id, team: e.team, number: e.number, pos: play.setup.positions[e.id] }]
            : [],
        )
      expect(players.length).toBeGreaterThan(0)
      for (const p of players) {
        if (!p.pos) continue
        const center = toPx(viewport, p.pos)
        const disc = tokenEvents(events, center, radius)
        const fill = disc.find((e) => e.kind === 'fill')
        const stroke = disc.find((e) => e.kind === 'stroke')
        expect(fill?.color, `fill of ${p.team}${p.number}`).toBe(
          p.team === 'A' ? '#000000' : '#ffffff',
        )
        expect(stroke?.color).toBe('#000000')
        const number = events.find(
          (e) =>
            e.kind === 'fillText' &&
            e.args[0] === String(p.number) &&
            near(e.args[1] as number, center.x) &&
            near(e.args[2] as number, center.y + 0.5 * PIXEL_RATIO),
        )
        expect(number?.color).toBe(p.team === 'A' ? '#ffffff' : '#000000')
      }
    }
  })

  it('draws runs as solid black lines and passes as dotted lines; previous phases light grey', () => {
    const { scene, schematic } = drawAll('printBw')
    const theme = THEMES.printBw
    const lineWidth = theme.runWidth * PIXEL_RATIO
    for (const recording of [scene, schematic]) {
      const strokes = paintEvents(recording.calls).filter(
        (e) => e.kind === 'stroke' && near(e.lineWidth, lineWidth),
      )
      const runs = strokes.filter((e) => e.dash.length === 0)
      const passes = strokes.filter((e) => e.dash.length > 0)
      expect(runs.length).toBeGreaterThan(0)
      expect(passes.length).toBeGreaterThan(0)
      expect(runs.some((e) => e.color === '#000000')).toBe(true)
      expect(passes.some((e) => e.color === '#000000')).toBe(true)
      for (const pass of passes) expect(pass.dash).toEqual([0.1 * PIXEL_RATIO, 6 * PIXEL_RATIO])
    }
    const faded = mixColors('#000000', '#ffffff', theme.fadeTowardsGrass)
    const sceneStrokes = paintEvents(scene.calls).filter((e) => e.kind === 'stroke')
    expect(sceneStrokes.some((e) => e.color === faded && e.dash.length === 0)).toBe(true)
    expect(Number.parseInt(faded.slice(1, 3), 16)).toBeGreaterThanOrEqual(0xa0)
  })

  it('draws a white field with grey lines and a thin black dashed gain line', () => {
    const { scene } = drawAll('printBw')
    const events = paintEvents(scene.calls)
    expect(events.find((e) => e.kind === 'fillRect')?.color).toBe('#ffffff')
    const gain = events.filter((e) => e.kind === 'stroke' && e.color === THEMES.printBw.gainLine)
    expect(gain.some((e) => e.dash.length > 0 && e.lineWidth <= 1.5 * PIXEL_RATIO)).toBe(true)
  })
})

describe('« Impression couleur » theme (D-062)', () => {
  it('keeps the team colours on a white field, with black passes', () => {
    const { scene } = drawAll('printColor')
    const events = paintEvents(scene.calls)
    expect(events.find((e) => e.kind === 'fillRect')?.color).toBe('#ffffff')
    const fills = new Set(events.filter((e) => e.kind === 'fill').map((e) => e.color))
    expect(fills.has(TEAM_COLORS.A)).toBe(true)
    expect(fills.has(TEAM_COLORS.B)).toBe(true)
    expect(fills.has('#cc79a7')).toBe(true)
    const passes = events.filter(
      (e) => e.kind === 'stroke' && e.dash.length > 0 && e.color === '#000000',
    )
    expect(passes.length).toBeGreaterThan(0)
  })
})

describe('flat colours for every theme (SPEC 3.3.3)', () => {
  it('never uses gradients, patterns, shadows or filters, captions included', () => {
    for (const themeId of RENDER_THEME_IDS) {
      const { scene, schematic } = drawAll(themeId)
      const captions = createRecordingContext()
      const frame = { widthPx: 540, heightPx: 960, pixelRatio: PIXEL_RATIO }
      drawCard(
        captions.ctx,
        frame,
        THEMES[themeId],
        'Croisée au centre',
        'Option B : Défense montée',
      )
      drawDressing(captions.ctx, frame, THEMES[themeId], 'Temps 3, option B', 'Ralenti', 'Fixer', 2)
      for (const recording of [scene, schematic, captions]) {
        for (const forbidden of ['shadowBlur', 'shadowColor', 'filter', 'globalAlpha']) {
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
})

describe('ball (D-071)', () => {
  it('is built from four Bézier curves in device pixels, without transformation', () => {
    const recording = createRecordingContext()
    const viewport = createViewport({
      widthPx: 200,
      heightPx: 200,
      pixelRatio: 2,
      frame: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
      orientation: 'landscape',
      attackingTeam: 'A',
    })
    drawBall(recording.ctx, viewport, THEMES.highContrast, { x: 100, y: 80 }, { x: 0.6, y: 0.8 })
    const names = recording.calls.filter((c) => c.kind === 'call').map((c) => c.name)
    expect(names.filter((n) => n === 'bezierCurveTo')).toHaveLength(4)
    for (const forbidden of ['save', 'restore', 'translate', 'rotate', 'scale', 'arc']) {
      expect(names).not.toContain(forbidden)
    }
    // The long axis follows the direction: its end points are ballLength / 2 from the centre.
    const half = (THEMES.highContrast.ballLength * 2) / 2
    const start = recording.calls.find((c) => c.name === 'moveTo')
    expect(start?.args[0]).toBeCloseTo(100 + 0.6 * half, 2)
    expect(start?.args[1]).toBeCloseTo(80 + 0.8 * half, 2)
  })
})
