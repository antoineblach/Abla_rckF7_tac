// GIF export through the whole path (SPEC 9.2): evaluate, render and captions on @napi-rs/canvas,
// palette and gifenc, then the produced bytes read back by omggif.
import { describe, expect, it } from 'vitest'
import { expandBounds, lineBounds, unionBounds, type Bounds } from '../../engine/bounds'
import { createCaches } from '../../engine/caches'
import { compileLine } from '../../engine/timeline'
import { allLines } from '../../model/phaseTree'
import {
  defaultSettings,
  engineSettingsOf,
  type ExportOrientation,
  type GifLinesMode,
} from '../../model/settings'
import { attackDirection, type Play } from '../../model/types'
import { dressingHeightPx } from '../../render/captions'
import { DEFAULT_LAYERS } from '../../render/layers'
import { directionPx, toPx } from '../../render/viewport'
import {
  canvasFromPixels,
  loadOptionsFixture,
  napiSurface,
  twoBranchPointsPlay,
} from '../../test/exportFixtures'
import { composeGif, inspectGif } from '../../test/gifInspect'
import { compareWithSnapshot } from '../../test/imageSnapshot'
import { createRecordingContext, paintEvents } from '../../test/recordingCtx'
import { minTextSize, phoneScreenWidthMm } from '../legibility'
import type { ExportFile, ExportProgress, GifOptions } from '../types'
import { gifExport } from './encode'
import { drawGifItem, gifFormat, gifFrameBounds, gifLayout } from './frame'
import { gifTargets, gifTimeline, type GifTarget } from './timeline'

const settings = engineSettingsOf(defaultSettings())
const fixture = loadOptionsFixture()

const targetOf = (play: Play, mode: GifLinesMode, index = 0): GifTarget => {
  const target = gifTargets(play, mode)[index]
  if (!target) throw new Error('no GIF target')
  return target
}

const OPTIONS: GifOptions = {
  orientation: 'portrait',
  lines: 'chained',
  speed: 'real',
  quality: 'standard',
  theme: 'highContrast',
  optimizeUnchanged: true,
  light: false,
  layers: DEFAULT_LAYERS,
}

function runExport(options: GifOptions, play = fixture) {
  const progress: ExportProgress[] = []
  const steps = gifExport(play, options, settings, createCaches(), napiSurface)
  let step = steps.next()
  while (step.done !== true) {
    progress.push(step.value)
    step = steps.next()
  }
  return { files: step.value, progress }
}

const onlyFile = (files: ExportFile[]): ExportFile => {
  expect(files).toHaveLength(1)
  return files[0] as ExportFile
}

describe('GIF layout (SPEC 9.2, D-060, D-061)', () => {
  it('frames every exported line plus 5 m, once for the whole GIF, under the dressing', () => {
    const caches = createCaches()
    let union: Bounds | null = null
    for (const line of allLines(fixture)) {
      union = unionBounds(union, lineBounds(compileLine(fixture, line, settings, caches)))
    }
    expect(gifFrameBounds(fixture, allLines(fixture), settings, caches)).toEqual(
      expandBounds(union as Bounds, 5),
    )
    const target = targetOf(fixture, 'chained', 0)
    const { ctx } = createRecordingContext()
    const layout = gifLayout(ctx, fixture, target, OPTIONS, settings, caches)
    const frame = gifFrameBounds(fixture, target.lines, settings, caches)
    const top = dressingHeightPx(layout.viewport, layout.theme, layout.bannerLines)
    expect(layout.bannerLines).toBe(1)
    for (const corner of [frame.min, frame.max, { x: frame.min.x, y: frame.max.y }]) {
      const p = toPx(layout.viewport, corner)
      expect(p.y).toBeGreaterThanOrEqual(top - 1e-6)
      expect(p.y).toBeLessThanOrEqual(960 + 1e-6)
    }
  })

  it('attacks upwards in portrait and square, to the right in landscape, for A and for B', () => {
    for (const team of ['A', 'B'] as const) {
      const play = { ...fixture, attackingTeam: team }
      for (const orientation of ['portrait', 'square', 'landscape'] as ExportOrientation[]) {
        const { ctx } = createRecordingContext()
        const layout = gifLayout(
          ctx,
          play,
          targetOf(play, 'chained', 0),
          { ...OPTIONS, orientation },
          settings,
          createCaches(),
        )
        const dir = directionPx(layout.viewport, { x: attackDirection(team), y: 0 })
        const expected = orientation === 'landscape' ? { x: 1, y: 0 } : { x: 0, y: -1 }
        expect(dir.x, `${orientation} ${team}`).toBeCloseTo(expected.x, 9)
        expect(dir.y, `${orientation} ${team}`).toBeCloseTo(expected.y, 9)
      }
    }
  })

  it('never writes a text below the legible size, in every format, quality and theme', () => {
    for (const quality of ['standard', 'high'] as const) {
      for (const orientation of ['portrait', 'landscape', 'square'] as const) {
        for (const theme of ['highContrast', 'screen', 'printBw'] as const) {
          const options = { ...OPTIONS, quality, orientation, theme }
          const target = targetOf(fixture, 'chained', 0)
          const caches = createCaches()
          const items = gifTimeline(fixture, target, 'both', 12, settings, caches)
          const recording = createRecordingContext()
          const layout = gifLayout(recording.ctx, fixture, target, options, settings, caches)
          for (const item of [
            items[0],
            items.find((i) => i.kind === 'scene'),
            items[items.length - 1],
          ]) {
            if (item)
              drawGifItem(recording.ctx, fixture, item, layout, DEFAULT_LAYERS, settings, caches)
          }
          const min = minTextSize(gifFormat(options).width, phoneScreenWidthMm(orientation))
          const sizes = paintEvents(recording.calls)
            .filter((e) => e.kind === 'fillText')
            .map((e) => Number(/(\d+(?:\.\d+)?)px/.exec(String(e.font))?.[1]))
          expect(sizes.length).toBeGreaterThan(0)
          for (const size of sizes) {
            expect(size, `${quality} ${orientation} ${theme}`).toBeGreaterThanOrEqual(min - 1e-9)
          }
        }
      }
    }
  })

  it('shows the phase label, the speed badge and the instruction even without the banner layer', () => {
    const caches = createCaches()
    const target = targetOf(fixture, 'chained', 0)
    const items = gifTimeline(fixture, target, 'both', 12, settings, caches)
    const lastSlowB = items.findLastIndex((i) => i.kind === 'scene' && i.speed === 0.5)
    const recording = createRecordingContext()
    const layout = gifLayout(recording.ctx, fixture, target, OPTIONS, settings, caches)
    const item = items[lastSlowB]
    if (!item) throw new Error('no scene')
    drawGifItem(
      recording.ctx,
      fixture,
      item,
      layout,
      { ...DEFAULT_LAYERS, instruction: false },
      settings,
      caches,
    )
    const texts = paintEvents(recording.calls)
      .filter((e) => e.kind === 'fillText')
      .map((e) => e.args[0])
    expect(texts).toContain('Temps 3, option B')
    expect(texts).toContain('Ralenti')
    expect(texts).toContain('Retour intérieur')
  })

  it('makes the light version standard at 8 images/s (D-067)', () => {
    expect(gifFormat({ orientation: 'portrait', quality: 'high', light: true })).toEqual({
      width: 540,
      height: 960,
      fps: 8,
    })
    expect(gifFormat({ orientation: 'landscape', quality: 'high', light: false })).toEqual({
      width: 1280,
      height: 720,
      fps: 15,
    })
    expect(gifFormat({ orientation: 'square', quality: 'standard', light: false })).toEqual({
      width: 720,
      height: 720,
      fps: 12,
    })
  })
})

describe('GIF encoding (SPEC 9.2, D-069, D-071)', () => {
  it('produces the same bytes for two successive exports', () => {
    const first = onlyFile(runExport(OPTIONS).files)
    const second = onlyFile(runExport(OPTIONS).files)
    expect(first.fileName).toBe('croisee-au-centre--portrait-enchaine-reel.gif')
    expect(first.mime).toBe('image/gif')
    expect(Buffer.compare(Buffer.from(first.bytes), Buffer.from(second.bytes))).toBe(0)
  })

  it('writes the planned images and delays, an infinite loop, dispose 1 and transparency', () => {
    const { files, progress } = runExport(OPTIONS)
    const file = onlyFile(files)
    expect(new TextDecoder().decode(file.bytes.slice(0, 6))).toBe('GIF89a')
    const items = gifTimeline(
      fixture,
      targetOf(fixture, 'chained', 0),
      'real',
      12,
      settings,
      createCaches(),
    )
    const info = inspectGif(file.bytes)
    expect([info.width, info.height]).toEqual([540, 960])
    expect(info.loopCount).toBe(0)
    expect(info.frames.map((f) => f.delayCs)).toEqual(items.map((i) => i.delayCs))
    expect(info.frames[info.frames.length - 1]?.delayCs).toBe(200)
    for (const [i, frame] of info.frames.entries()) {
      expect(frame.disposal).toBe(1)
      if (i === 0) expect(frame.transparentIndex).toBeNull()
      else expect(frame.transparentIndex).not.toBeNull()
    }
    // Progress: palette samples then every image, done up to the total.
    expect(progress[0]?.stage).toBe('palette')
    expect(progress[progress.length - 1]).toEqual({
      stage: 'frames',
      done: progress[progress.length - 1]?.total,
      total: progress.length,
    })
  })

  it('shows the same pixels with and without the unchanged-pixel optimisation, lighter with it', () => {
    const optimised = onlyFile(runExport(OPTIONS).files).bytes
    const full = onlyFile(runExport({ ...OPTIONS, optimizeUnchanged: false }).files).bytes
    const count = inspectGif(full).frames.length
    for (const frame of [Math.floor(count / 2), count - 1]) {
      expect(
        Buffer.compare(
          Buffer.from(composeGif(optimised, frame)),
          Buffer.from(composeGif(full, frame)),
        ),
      ).toBe(0)
    }
    for (const frame of inspectGif(full).frames) expect(frame.transparentIndex).toBeNull()
    expect(optimised.length).toBeLessThan(full.length / 2)
  })

  it('makes one file per leaf, named by its options, all in the same job (D-065, D-066)', () => {
    const { files } = runExport({ ...OPTIONS, lines: 'perLeaf' })
    expect(files.map((f) => f.fileName)).toEqual([
      'croisee-au-centre--portrait-option-a-reel.gif',
      'croisee-au-centre--portrait-option-b-reel.gif',
    ])
    const play = twoBranchPointsPlay()
    expect(
      runExport({ ...OPTIONS, lines: 'perLeaf', theme: 'printBw' }, play).files.map(
        (f) => f.fileName,
      ),
    ).toEqual([
      'double-option--portrait-option-a-a-reel.gif',
      'double-option--portrait-option-a-b-reel.gif',
      'double-option--portrait-option-b-reel.gif',
    ])
  })
})

describe('GIF reference images (SPEC 9.2, D-062)', () => {
  for (const theme of ['highContrast', 'printBw'] as const) {
    it(`decodes an image of option B in theme ${theme}`, async () => {
      const options = { ...OPTIONS, theme }
      const file = onlyFile(runExport(options).files)
      const items = gifTimeline(
        fixture,
        targetOf(fixture, 'chained', 0),
        'real',
        12,
        settings,
        createCaches(),
      )
      // The middle of option B (last line), at real speed.
      const sceneIndexes = items.flatMap((item, i) => (item.kind === 'scene' ? [i] : []))
      const lastCard = items.findLastIndex((i) => i.kind === 'card')
      const optionB = sceneIndexes.filter((i) => i > lastCard)
      const index = optionB[Math.floor(optionB.length / 2)] ?? 0
      const pixels = composeGif(file.bytes, index)
      const canvas = canvasFromPixels(pixels, 540, 960)
      const result = await compareWithSnapshot(canvas, `gif-frame-${theme}`)
      expect(result.pass, result.message).toBe(true)
    })
  }
})
