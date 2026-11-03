// Rendering of lot 3 bis (D-108, D-112, D-113, D-115): segments at the sprint pace or faster drawn
// thicker in the 4 themes, orange and red speed badges on their layer (editor always, exports
// never), synchronisation link and hover halo in the editor overlay. Lot 3bis-1 (D-132): diamond
// badges of the accelerations and brakings, on the same layer.
import { describe, expect, it } from 'vitest'
import { createCaches } from '../engine/caches'
import { evaluate, phaseSchematic, type PhaseSchematic } from '../engine/evaluate'
import { timeAtDistance } from '../engine/profile'
import type { SceneState } from '../engine/sceneState'
import { compileLine } from '../engine/timeline'
import { EMPTY_SELECTION, type Selection } from '../editor/selection'
import { defaultSettings, engineSettingsOf } from '../model/settings'
import type { Id } from '../model/types'
import { buildOverlay } from '../state/overlay'
import { ACCELS, accelPlay, SPEEDS, speedsPlay, uuid } from '../test/builders'
import { compareWithSnapshot, createTestCanvas } from '../test/imageSnapshot'
import { createRecordingContext, paintEvents, type PaintEvent } from '../test/recordingCtx'
import type { Ctx2D } from './ctx2d'
import { DEFAULT_LAYERS } from './layers'
import { EMPTY_OVERLAY, renderOverlay } from './overlay'
import { render } from './render'
import { drawSchematic, renderSchematic } from './renderSchematic'
import { RENDER_THEME_IDS, THEMES, type Theme } from './themes'
import { createViewport, sizePx, type Viewport } from './viewport'

const settings = engineSettingsOf(defaultSettings())
const { T1, RUN_FAST, RUN_WARNING, RUN_LINKED, PASS } = SPEEDS

const play = speedsPlay()

function viewport(widthPx = 480, heightPx = 270): Viewport {
  return createViewport({
    widthPx,
    heightPx,
    pixelRatio: 1,
    frame: { min: { x: 32, y: 12 }, max: { x: 100, y: 48 } },
    orientation: 'landscape',
    attackingTeam: 'A',
  })
}

function schematic(): PhaseSchematic {
  const s = phaseSchematic(play, T1, settings, createCaches())
  if (!s) throw new Error('no schematic')
  return s
}

function endScene(): SceneState {
  const end = compileLine(play, [T1], settings, createCaches()).duration
  return evaluate(play, [T1], end, settings, createCaches())
}

const strokeWidths = (events: PaintEvent[]): number[] =>
  events.filter((e) => e.kind === 'stroke').map((e) => e.lineWidth)

/** Discs painted in a badge colour of the theme. */
function badgeFills(events: PaintEvent[], theme: Theme): { warning: number; danger: number } {
  const fills = events.filter((e) => e.kind === 'fill')
  return {
    warning: fills.filter((e) => e.color === theme.speedWarningFill).length,
    danger: fills.filter((e) => e.color === theme.speedDangerFill).length,
  }
}

function record(draw: (ctx: Ctx2D) => void): PaintEvent[] {
  const recording = createRecordingContext()
  draw(recording.ctx)
  return paintEvents(recording.calls)
}

const selecting = (actions: Id[]): Selection => ({ ...EMPTY_SELECTION, actions })

function overlayFor(selection: Selection, hoveredActionId: Id | null = null) {
  return buildOverlay({
    play,
    schematic: schematic(),
    selection,
    tool: 'select',
    runDraft: null,
    passFromId: null,
    kickFromId: null,
    placement: null,
    cursor: null,
    selectionBox: null,
    hoveredActionId,
  })
}

describe('fast segments (D-115)', () => {
  it('draws the segments at the sprint pace or faster wider, in the 4 themes', () => {
    const v = viewport()
    for (const themeId of RENDER_THEME_IDS) {
      const theme = THEMES[themeId]
      expect(theme.fastRunWidth, themeId).toBeGreaterThan(theme.runWidth)
      for (const events of [
        record((ctx) => {
          drawSchematic(ctx, schematic(), v, theme)
        }),
        record((ctx) => {
          render(ctx, endScene(), v, theme, DEFAULT_LAYERS)
        }),
      ]) {
        const widths = strokeWidths(events)
        expect(widths, themeId).toContain(sizePx(v, theme.fastRunWidth))
        expect(widths, themeId).toContain(sizePx(v, theme.runWidth))
      }
    }
  })

  it('keeps the slow part of a run at the run width before the sprint is reached', () => {
    const v = viewport()
    const theme = THEMES.screen
    // 1 s after the start, A1 is still walking: nothing of her run is fast yet.
    const early = evaluate(play, [T1], 1, settings, createCaches())
    const trace = early.traces.find((tr) => tr.actionId === RUN_FAST)
    expect(trace?.parts.map((p) => p.fast)).toEqual([false])
    const widths = strokeWidths(
      record((ctx) => {
        render(ctx, early, v, theme, DEFAULT_LAYERS)
      }),
    )
    expect(widths).toContain(sizePx(v, theme.runWidth))
  })
})

describe('speed badges (D-112)', () => {
  it('draws an orange and a red badge in the player when the layer is on, none when off', () => {
    const v = viewport()
    for (const themeId of RENDER_THEME_IDS) {
      const theme = THEMES[themeId]
      const scene = endScene()
      expect(scene.speedBadges.map((b) => [b.actionId, b.level])).toEqual([
        [RUN_FAST, 'danger'],
        [RUN_WARNING, 'warning'],
      ])
      const on = record((ctx) => {
        render(ctx, scene, v, theme, DEFAULT_LAYERS)
      })
      const off = record((ctx) => {
        render(ctx, scene, v, theme, { ...DEFAULT_LAYERS, speedAlert: false })
      })
      if (theme.speedWarningFill !== theme.speedDangerFill) {
        const counts = badgeFills(on, theme)
        expect(counts.danger, themeId).toBeGreaterThanOrEqual(1)
        expect(counts.warning, themeId).toBeGreaterThanOrEqual(1)
      }
      const bangs = (events: PaintEvent[]) =>
        events.filter((e) => e.kind === 'fillText' && e.args[0] === '!').length
      expect(bangs(on) - bangs(off), themeId).toBe(2)
    }
  })

  it('distinguishes the two levels in every theme, N&B included', () => {
    for (const themeId of RENDER_THEME_IDS) {
      const theme = THEMES[themeId]
      expect(theme.speedWarningFill, themeId).not.toBe(theme.speedDangerFill)
    }
  })

  it('shows the badges in the editor only: never in renderSchematic without options', () => {
    const v = viewport()
    const theme = THEMES.screen
    const editor = record((ctx) => {
      drawSchematic(ctx, schematic(), v, theme, { forwardPass: true, speedBadges: true })
    })
    expect(badgeFills(editor, theme)).toEqual({ warning: 1, danger: 1 })
    // Library thumbnails and the PDF call renderSchematic without options.
    const thumbnail = record((ctx) => {
      renderSchematic(ctx, play, [T1], T1, v, theme, settings, createCaches())
    })
    expect(badgeFills(thumbnail, theme)).toEqual({ warning: 0, danger: 0 })
  })
})

describe('acceleration and braking badges (D-132)', () => {
  const accel = accelPlay()
  const { RUN_RED, RUN_ORANGE } = ACCELS

  function accelViewport(): Viewport {
    // About 11 px/m, the scale of the editor on a full HD screen.
    return createViewport({
      widthPx: 480,
      heightPx: 270,
      pixelRatio: 1,
      frame: { min: { x: 34, y: 18 }, max: { x: 66, y: 42 } },
      orientation: 'landscape',
      attackingTeam: 'A',
    })
  }

  function accelSchematic(): PhaseSchematic {
    const s = phaseSchematic(accel, ACCELS.T1, settings, createCaches())
    if (!s) throw new Error('no schematic')
    return s
  }

  /**
   * Diamonds painted in a badge colour (top and bottom corners on one vertical: neither an arrow
   * head nor a rectangle of the field), bars of their signs, upright bars.
   */
  function diamonds(events: PaintEvent[], v: Viewport, theme: Theme) {
    const fills = [theme.speedWarningFill, theme.speedDangerFill]
    const texts = [theme.speedWarningText, theme.speedDangerText]
    const isIn = (colors: string[], color: unknown) => typeof color === 'string' && colors.includes(color)
    const isDiamond = (path: PaintEvent['path']) =>
      path.length === 5 &&
      path[0]?.args[0] === path[2]?.args[0] &&
      path[1]?.args[1] === path[3]?.args[1]
    const shapes = events.filter(
      (e) => e.kind === 'fill' && isIn(fills, e.color) && isDiamond(e.path),
    )
    const bars = events.filter(
      (e) =>
        e.kind === 'stroke' &&
        isIn(texts, e.color) &&
        e.path.length === 2 &&
        Math.abs(e.lineWidth - sizePx(v, theme.tokenStrokeWidth * 1.5)) < 1e-3,
    )
    const upright = bars.filter((e) => e.path[0]?.args[0] === e.path[1]?.args[0])
    return { diamonds: shapes.length, bars: bars.length, upright: upright.length }
  }

  it('draws orange and red diamonds « + » and « − » on the layer of the player, none when off', () => {
    const v = accelViewport()
    const end = compileLine(accel, [ACCELS.T1], settings, createCaches()).duration
    const scene = evaluate(accel, [ACCELS.T1], end, settings, createCaches())
    expect(scene.speedBadges.map((b) => [b.actionId, b.kind, b.level])).toEqual([
      [RUN_RED, 'speed', 'danger'],
      [RUN_RED, 'accel', 'danger'],
      [RUN_RED, 'brake', 'danger'],
      [RUN_ORANGE, 'speed', 'danger'],
      [RUN_ORANGE, 'accel', 'warning'],
      [RUN_ORANGE, 'brake', 'warning'],
    ])
    for (const themeId of RENDER_THEME_IDS) {
      const theme = THEMES[themeId]
      const on = record((ctx) => {
        render(ctx, scene, v, theme, DEFAULT_LAYERS)
      })
      const off = record((ctx) => {
        render(ctx, scene, v, theme, { ...DEFAULT_LAYERS, speedAlert: false })
      })
      // Four diamonds: four « − » bars, two of them crossed into a « + ».
      expect(diamonds(on, v, theme), themeId).toEqual({ diamonds: 4, bars: 6, upright: 2 })
      expect(diamonds(off, v, theme), themeId).toEqual({ diamonds: 0, bars: 0, upright: 0 })
    }
  })

  it('shows a badge in the player once the player reaches its point', () => {
    const motion = compileLine(accel, [ACCELS.T1], settings, createCaches()).phases[0]?.motions[0]
    if (!motion) throw new Error('no motion')
    const kinds = (t: number) =>
      evaluate(accel, [ACCELS.T1], t, settings, createCaches())
        .speedBadges.filter((b) => b.actionId === RUN_RED)
        .map((b) => b.kind)
    const reached = (kind: 'accel' | 'brake') => {
      const alert = motion.accelAlerts.find((a) => a.kind === kind)
      if (!alert) throw new Error(`no ${kind} alert`)
      return motion.start + timeAtDistance(motion.profile, alert.badgeAt)
    }
    expect(kinds(reached('accel') - 0.01)).toEqual(['speed'])
    expect(kinds(reached('accel') + 0.01)).toEqual(['speed', 'accel'])
    expect(kinds(reached('brake') - 0.01)).toEqual(['speed', 'accel'])
    expect(kinds(reached('brake') + 0.01)).toEqual(['speed', 'accel', 'brake'])
  })

  it('shows them in the editor only: never in renderSchematic without options', () => {
    const v = accelViewport()
    const theme = THEMES.screen
    const editor = record((ctx) => {
      drawSchematic(ctx, accelSchematic(), v, theme, { forwardPass: true, speedBadges: true })
    })
    expect(diamonds(editor, v, theme)).toEqual({ diamonds: 4, bars: 6, upright: 2 })
    const thumbnail = record((ctx) => {
      renderSchematic(ctx, accel, [ACCELS.T1], ACCELS.T1, v, theme, settings, createCaches())
    })
    expect(diamonds(thumbnail, v, theme)).toEqual({ diamonds: 0, bars: 0, upright: 0 })
  })

  it('editor: diamonds clear of the tokens, in the two screen themes (reference images)', async () => {
    for (const themeId of ['screen', 'highContrast'] as const) {
      const { canvas, ctx } = createTestCanvas(480, 270)
      drawSchematic(ctx, accelSchematic(), accelViewport(), THEMES[themeId], {
        forwardPass: true,
        speedBadges: true,
      })
      const result = await compareWithSnapshot(canvas, `editor-accel-${themeId}-landscape`)
      expect(result.pass, result.message).toBe(true)
    }
  })
})

describe('editor overlay: links and hover (D-108, D-113)', () => {
  it('draws a link when the linked run or its target is selected, and only then', () => {
    const link = schematic().syncLinks[0]
    if (!link?.to) throw new Error('no link')
    expect(overlayFor(selecting([RUN_LINKED])).syncLinks).toEqual([
      { from: link.from, to: link.to },
    ])
    expect(overlayFor(selecting([RUN_WARNING])).syncLinks).toHaveLength(1)
    expect(overlayFor(selecting([RUN_FAST])).syncLinks).toEqual([])
    expect(overlayFor(EMPTY_SELECTION).syncLinks).toEqual([])
  })

  it('halos the hovered action: the curve of a run, the segment of a pass', () => {
    expect(overlayFor(EMPTY_SELECTION).hover).toBeNull()
    const run = overlayFor(EMPTY_SELECTION, RUN_FAST).hover
    expect(run?.paths).toHaveLength(1)
    expect(run?.paths[0]?.at(-1)).toEqual({ x: 95, y: 30 })
    const passHover = overlayFor(EMPTY_SELECTION, PASS).hover
    const passPath = schematic().passes[0]
    expect(passHover?.paths).toEqual([[passPath?.from, passPath?.to]])
    expect(overlayFor(EMPTY_SELECTION, uuid(4242)).hover).toBeNull()
  })

  it('draws the link thin and dashed, the halo dashed, in the selection colour', () => {
    const v = viewport()
    for (const themeId of ['screen', 'highContrast'] as const) {
      const theme = THEMES[themeId]
      const events = record((ctx) => {
        renderOverlay(ctx, v, theme, {
          ...EMPTY_OVERLAY,
          syncLinks: [{ from: { x: 40, y: 20 }, to: { x: 60, y: 20 } }],
          hover: {
            paths: [
              [
                { x: 40, y: 30 },
                { x: 60, y: 30 },
              ],
            ],
            points: [{ x: 50, y: 40 }],
          },
        })
      })
      const strokes = events.filter((e) => e.kind === 'stroke')
      expect(strokes).toHaveLength(3)
      for (const stroke of strokes) {
        expect(stroke.color).toBe(theme.selection)
        expect(stroke.dash.length).toBeGreaterThan(0)
      }
      const [halo, ring, link] = strokes
      expect(link?.lineWidth).toBeLessThan(sizePx(v, theme.runWidth))
      expect(halo?.lineWidth).toBeGreaterThan(sizePx(v, theme.runWidth))
      expect(ring?.path.some((c) => c.name === 'arc')).toBe(true)
    }
  })

  it('resets the dash after a dashed ring', () => {
    const recording = createRecordingContext()
    renderOverlay(recording.ctx, viewport(), THEMES.screen, {
      ...EMPTY_OVERLAY,
      hover: { paths: [], points: [{ x: 50, y: 40 }] },
      selectedPlayers: [{ x: 40, y: 30 }],
    })
    const events = paintEvents(recording.calls).filter((e) => e.kind === 'stroke')
    expect(events[0]?.dash.length).toBeGreaterThan(0)
    expect(events[1]?.dash).toEqual([])
  })
})

describe('lot 3 bis: reference images', () => {
  it('editor: fast segments, badges, link of the selected run and halo of a hovered pass', async () => {
    const { canvas, ctx } = createTestCanvas(480, 270)
    const v = viewport()
    drawSchematic(ctx, schematic(), v, THEMES.screen, { forwardPass: true, speedBadges: true })
    renderOverlay(ctx, v, THEMES.screen, overlayFor(selecting([RUN_LINKED]), PASS))
    const result = await compareWithSnapshot(canvas, 'editor-speeds-screen-landscape')
    expect(result.pass, result.message).toBe(true)
  })

  it('export theme N&B: fast segments wider, no badge', async () => {
    const { canvas, ctx } = createTestCanvas(480, 270)
    render(ctx, endScene(), viewport(), THEMES.printBw, { ...DEFAULT_LAYERS, speedAlert: false })
    const result = await compareWithSnapshot(canvas, 'scene-speeds-printBw-landscape')
    expect(result.pass, result.message).toBe(true)
  })
})
