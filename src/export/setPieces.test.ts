// Exports of lot 3 (SPEC 9.2, 9.3, 10.4, D-084, D-086): a GIF image with a kick in flight, a N&B
// PDF with a kick in long dashes read back from the file, never the forward pass badge, whatever
// the layer of the player.
import { describe, expect, it } from 'vitest'
import { createCaches } from '../engine/caches'
import { evaluate, phaseSchematic } from '../engine/evaluate'
import { compileLine } from '../engine/timeline'
import { allLines } from '../model/phaseTree'
import { defaultSettings, engineSettingsOf } from '../model/settings'
import type { Id } from '../model/types'
import { DEFAULT_LAYERS } from '../render/layers'
import { render } from '../render/render'
import { THEMES } from '../render/themes'
import { P, setPiecesPlay } from '../test/builders'
import { canvasFromPixels, loadPdfFonts, napiSurface } from '../test/exportFixtures'
import { composeGif } from '../test/gifInspect'
import { compareWithSnapshot } from '../test/imageSnapshot'
import { openPdf, pageDashes, rasterize } from '../test/pdfInspect'
import { createRecordingContext, paintEvents, type RecordingContext } from '../test/recordingCtx'
import { linesFrame } from './framing'
import { gifExport } from './gif/encode'
import { drawGifItem, gifLayout } from './gif/frame'
import { gifTargets, gifTimeline, type GifItem } from './gif/timeline'
import { createPdfDoc, pdfContext } from './pdf/pdfCtx'
import { drawThumbnail, thumbMmPerPx } from './pdf/thumbnail'
import { thumbRatio } from './pdf/layout'
import { pdfExport } from './pdf/write'
import type { ExportFile, GifOptions, PdfOptions } from './types'

/** Real encodings: several seconds on the CI runner, slower than a desktop computer. */
const ENCODING_TIMEOUT_MS = 60_000

const settings = engineSettingsOf(defaultSettings())
const play = setPiecesPlay()
const fonts = loadPdfFonts()
const [LINE_A] = allLines(play) as [Id[], Id[]]

/** The forward pass layer of the player is on: the export must ignore it (D-086). */
const OPTIONS: GifOptions = {
  orientation: 'portrait',
  lines: 'perLeaf',
  speed: 'real',
  quality: 'standard',
  theme: 'highContrast',
  optimizeUnchanged: true,
  light: false,
  layers: { ...DEFAULT_LAYERS, forwardPass: true },
}

function drain<T>(steps: Generator<unknown, T>): T {
  let step = steps.next()
  while (step.done !== true) step = steps.next()
  return step.value
}

const gifFiles = (options: GifOptions): ExportFile[] =>
  drain(gifExport(play, options, settings, createCaches(), napiSurface))

function pdfFile(options: PdfOptions): ExportFile {
  const [file] = drain(pdfExport([play], options, null, fonts, settings, createCaches()))
  if (!file) throw new Error('no PDF')
  return file
}

/** Instants of the line A: forward pass in flight, kick at its apex. */
function instants() {
  const compiled = compileLine(play, LINE_A, settings, createCaches())
  const t2 = compiled.phases[1]?.start ?? NaN
  const t3 = compiled.phases[2]?.start ?? NaN
  return { forward: t2 + 0.4, kickApex: t3 + 0.5 + 3.5 / 2 }
}

/** The scene image of option A closest to `t`, and its index in the GIF. */
function sceneNear(t: number): { item: Extract<GifItem, { kind: 'scene' }>; index: number } {
  const target = gifTargets(play, 'perLeaf')[0]
  if (!target) throw new Error('no GIF target')
  const items = gifTimeline(play, target, 'real', 12, settings, createCaches())
  let best: { item: Extract<GifItem, { kind: 'scene' }>; index: number } | null = null
  for (const [index, item] of items.entries()) {
    if (item.kind !== 'scene') continue
    if (!best || Math.abs(item.t - t) < Math.abs(best.item.t - t)) best = { item, index }
  }
  if (!best) throw new Error('no scene image')
  return best
}

const texts = (recording: RecordingContext): unknown[] =>
  paintEvents(recording.calls)
    .filter((e) => e.kind === 'fillText')
    .map((e) => e.args[0])

describe(
  'GIF of a play with a ruck and kicks (SPEC 9.2, 10.4)',
  { timeout: ENCODING_TIMEOUT_MS },
  () => {
    it('decodes an image with the kicked ball at its apex, shadow and long dashes', async () => {
      const [file] = gifFiles(OPTIONS)
      if (!file) throw new Error('no GIF')
      expect(file.fileName).toBe('ruck-puis-jeu-au-pied--portrait-option-a-reel.gif')
      const { item, index } = sceneNear(instants().kickApex)
      const state = evaluate(play, item.line, item.t, settings, createCaches())
      expect(state.ball?.kind).toBe('inFlight')
      const canvas = canvasFromPixels(composeGif(file.bytes, index), 540, 960)
      const result = await compareWithSnapshot(canvas, 'gif-frame-kick-highContrast')
      expect(result.pass, result.message).toBe(true)
    })

    it('never draws the forward pass badge, even with the layer of the player on (D-086)', () => {
      const { item } = sceneNear(instants().forward)
      const state = evaluate(play, item.line, item.t, settings, createCaches())
      expect(state.passTraces.some((p) => p.forward)).toBe(true)
      // The same scene in the player shows the badge.
      const surface = napiSurface(540, 960)
      const target = gifTargets(play, 'perLeaf')[0]
      if (!target) throw new Error('no GIF target')
      const layout = gifLayout(surface.ctx, play, target, OPTIONS, settings, createCaches())
      const player = createRecordingContext()
      render(player.ctx, state, layout.viewport, layout.theme, DEFAULT_LAYERS)
      expect(texts(player)).toContain('!')
      const gif = createRecordingContext()
      drawGifItem(gif.ctx, play, item, layout, OPTIONS.layers, settings, createCaches())
      expect(texts(gif)).not.toContain('!')
      // Whole files: the layer changes nothing.
      const on = gifFiles(OPTIONS)
      const off = gifFiles({ ...OPTIONS, layers: { ...DEFAULT_LAYERS, forwardPass: false } })
      expect(on.map((f) => Buffer.from(f.bytes).toString('base64'))).toEqual(
        off.map((f) => Buffer.from(f.bytes).toString('base64')),
      )
    })
  },
)

describe(
  'PDF of a play with a ruck and kicks (SPEC 9.3, 10.4)',
  { timeout: ENCODING_TIMEOUT_MS },
  () => {
    it('writes the kicks in long dashes, distinct from the dotted passes, in black and white', async () => {
      const doc = await openPdf(pdfFile({ layout: 'print', color: 'bw' }).bytes)
      const dashes = await pageDashes(doc, 1)
      const ratio = (d: number[]) => (d[0] ?? 0) / (d[1] ?? 1)
      const [kickDash, kickGap] = THEMES.printBw.kickDash
      const [passDash, passGap] = THEMES.printBw.passDash
      const kicks = dashes.filter(
        (d) => Math.abs(ratio(d) - (kickDash ?? 0) / (kickGap ?? 1)) < 1e-3,
      )
      const passes = dashes.filter(
        (d) => Math.abs(ratio(d) - (passDash ?? 0) / (passGap ?? 1)) < 1e-3,
      )
      expect(kicks.length).toBeGreaterThan(0)
      expect(passes.length).toBeGreaterThan(0)
      // Long dashes: each dash is longer than its gap, unlike the dots of a pass.
      for (const d of kicks) expect(d[0] ?? 0).toBeGreaterThan(d[1] ?? 0)
    })

    it('never writes the forward pass badge, though phase 2 has a forward pass (D-086)', async () => {
      const schematic = phaseSchematic(play, P.t2, settings, createCaches())
      expect(schematic?.passes.some((p) => p.forward)).toBe(true)
      for (const options of [
        { layout: 'print', color: 'bw' },
        { layout: 'phone', color: 'color' },
      ] as const) {
        const doc = await openPdf(pdfFile(options).bytes)
        for (let page = 1; page <= doc.numPages; page++) {
          const content = await (await doc.getPage(page)).getTextContent()
          const items = content.items.map((item) => ('str' in item ? item.str.trim() : ''))
          expect(items).not.toContain('!')
        }
      }
    })

    it('rasterises the N&B thumbnail of the long kick (reference image)', async () => {
      const frame = linesFrame(play, allLines(play), settings, createCaches())
      const w = 90
      const h = w * thumbRatio(frame)
      const doc = createPdfDoc(fonts, w, h)
      const theme = THEMES.printBw
      drawThumbnail(
        pdfContext(doc),
        play,
        P.t3a,
        { x: 0, y: 0, w, h },
        frame,
        theme,
        thumbMmPerPx('print', theme),
        settings,
        createCaches(),
      )
      const bytes = new Uint8Array(doc.output('arraybuffer'))
      const canvas = await rasterize(await openPdf(bytes), 1, 6)
      const result = await compareWithSnapshot(canvas, 'pdf-thumbnail-kick-printBw')
      expect(result.pass, result.message).toBe(true)
    })
  },
)
