// Exports of lot 3 bis (D-112, D-115): segments at the sprint pace or faster drawn thicker in the GIF
// and the PDF; speed badges never exported, even with the « Vitesses » layer of the player on.
import { describe, expect, it } from 'vitest'
import { lineBounds } from '../engine/bounds'
import { createCaches } from '../engine/caches'
import { evaluate } from '../engine/evaluate'
import { compileLine } from '../engine/timeline'
import { defaultSettings, engineSettingsOf } from '../model/settings'
import { DEFAULT_LAYERS } from '../render/layers'
import { render } from '../render/render'
import { THEMES, type Theme } from '../render/themes'
import { sizePx } from '../render/viewport'
import { SPEEDS, speedsPlay } from '../test/builders'
import { loadPdfFonts, napiSurface } from '../test/exportFixtures'
import { compareWithSnapshot } from '../test/imageSnapshot'
import { openPdf, rasterize } from '../test/pdfInspect'
import { createRecordingContext, paintEvents, type PaintEvent } from '../test/recordingCtx'
import { linesFrame } from './framing'
import { gifExport } from './gif/encode'
import { drawGifItem, gifLayout } from './gif/frame'
import { gifTargets, gifTimeline } from './gif/timeline'
import { thumbRatio } from './pdf/layout'
import { createPdfDoc, pdfContext } from './pdf/pdfCtx'
import { drawThumbnail, thumbMmPerPx } from './pdf/thumbnail'
import { pdfExport } from './pdf/write'
import type { ExportFile, GifOptions, PdfOptions } from './types'

/** Real encodings: several seconds on the CI runner, slower than a desktop computer. */
const ENCODING_TIMEOUT_MS = 60_000

const settings = engineSettingsOf(defaultSettings())
const play = speedsPlay()

/** The « Vitesses » layer of the player is on: the exports must ignore it (D-112). */
const OPTIONS: GifOptions = {
  orientation: 'landscape',
  lines: 'chained',
  speed: 'real',
  quality: 'standard',
  theme: 'highContrast',
  optimizeUnchanged: true,
  light: false,
  layers: { ...DEFAULT_LAYERS, speedAlert: true },
}

const bangs = (events: PaintEvent[]): number =>
  events.filter((e) => e.kind === 'fillText' && e.args[0] === '!').length

/** Stroke widths contain `width` (the recording context rounds to the thousandth). */
const hasWidth = (events: PaintEvent[], width: number): boolean =>
  events.some((e) => e.kind === 'stroke' && Math.abs(e.lineWidth - width) < 1e-3)

const badgeFills = (events: PaintEvent[], theme: Theme): number =>
  events.filter(
    (e) =>
      e.kind === 'fill' &&
      (e.color === theme.speedWarningFill || e.color === theme.speedDangerFill),
  ).length

describe('exports: fast segments in, speed badges out (D-112, D-115)', () => {
  it('GIF: the last image draws the fast segments wider and no badge', () => {
    const caches = createCaches()
    const target = gifTargets(play, OPTIONS.lines)[0]
    if (!target) throw new Error('no GIF target')
    const items = gifTimeline(play, target, OPTIONS.speed, 12, settings, caches)
    const item = items.findLast((i) => i.kind === 'scene')
    if (item?.kind !== 'scene') throw new Error('no scene')
    const surface = createRecordingContext()
    const layout = gifLayout(surface.ctx, play, target, OPTIONS, settings, caches)
    // The same scene in the player shows the two badges.
    const state = evaluate(play, item.line, item.t, settings, caches)
    expect(state.speedBadges).toHaveLength(2)
    const player = createRecordingContext()
    render(player.ctx, state, layout.viewport, layout.theme, OPTIONS.layers)
    expect(bangs(paintEvents(player.calls))).toBe(2)
    const gif = createRecordingContext()
    drawGifItem(gif.ctx, play, item, layout, OPTIONS.layers, settings, caches)
    const events = paintEvents(gif.calls)
    expect(bangs(events)).toBe(0)
    expect(badgeFills(events, layout.theme)).toBe(0)
    expect(hasWidth(events, sizePx(layout.viewport, layout.theme.fastRunWidth))).toBe(true)
    expect(hasWidth(events, sizePx(layout.viewport, layout.theme.runWidth))).toBe(true)
  })

  it('PDF: the thumbnail draws the fast segments wider and no badge, in the print themes', () => {
    const bounds = lineBounds(compileLine(play, [SPEEDS.T1], settings, createCaches()))
    if (!bounds) throw new Error('empty play')
    for (const themeId of ['printColor', 'printBw'] as const) {
      const theme = THEMES[themeId]
      const mmPerPx = thumbMmPerPx('print', theme)
      const recording = createRecordingContext()
      drawThumbnail(
        recording.ctx,
        play,
        SPEEDS.T1,
        { x: 10, y: 10, w: 80, h: 50 },
        bounds,
        theme,
        mmPerPx,
        settings,
        createCaches(),
      )
      const events = paintEvents(recording.calls)
      expect(bangs(events), themeId).toBe(0)
      // In N&B, white and black also fill the tokens: the « ! » tells the badges apart.
      if (themeId === 'printColor') expect(badgeFills(events, theme)).toBe(0)
      expect(hasWidth(events, theme.fastRunWidth * mmPerPx), themeId).toBe(true)
      expect(hasWidth(events, theme.runWidth * mmPerPx), themeId).toBe(true)
    }
  })
})

function drain<T>(steps: Generator<unknown, T>): T {
  let step = steps.next()
  while (step.done !== true) step = steps.next()
  return step.value
}

const base64 = (files: ExportFile[]) => files.map((f) => Buffer.from(f.bytes).toString('base64'))

describe('whole export files (D-112, D-115)', { timeout: ENCODING_TIMEOUT_MS }, () => {
  it('GIF: the « Vitesses » layer of the player changes no byte', () => {
    const gif = (speedAlert: boolean) =>
      drain(
        gifExport(
          play,
          { ...OPTIONS, layers: { ...DEFAULT_LAYERS, speedAlert } },
          settings,
          createCaches(),
          napiSurface,
        ),
      )
    expect(base64(gif(true))).toEqual(base64(gif(false)))
  })

  it('PDF: no badge on any page, in both layouts', async () => {
    const fonts = loadPdfFonts()
    for (const options of [
      { layout: 'print', color: 'bw' },
      { layout: 'phone', color: 'color' },
    ] as const satisfies readonly PdfOptions[]) {
      const [file] = drain(pdfExport([play], options, null, fonts, settings, createCaches()))
      if (!file) throw new Error('no PDF')
      const doc = await openPdf(file.bytes)
      for (let page = 1; page <= doc.numPages; page++) {
        const content = await (await doc.getPage(page)).getTextContent()
        const items = content.items.map((item) => ('str' in item ? item.str.trim() : ''))
        expect(items).not.toContain('!')
      }
    }
  })

  it('PDF: the N&B thumbnail draws the fast segments thicker (reference image)', async () => {
    const frame = linesFrame(play, [[SPEEDS.T1]], settings, createCaches())
    const w = 90
    const h = w * thumbRatio(frame)
    const doc = createPdfDoc(loadPdfFonts(), w, h)
    const theme = THEMES.printBw
    drawThumbnail(
      pdfContext(doc),
      play,
      SPEEDS.T1,
      { x: 0, y: 0, w, h },
      frame,
      theme,
      thumbMmPerPx('print', theme),
      settings,
      createCaches(),
    )
    const bytes = new Uint8Array(doc.output('arraybuffer'))
    const canvas = await rasterize(await openPdf(bytes), 1, 6)
    const result = await compareWithSnapshot(canvas, 'pdf-thumbnail-speeds-printBw')
    expect(result.pass, result.message).toBe(true)
  })
})
