// GIF encoding (SPEC 9.2, D-069, D-071). A global palette of at most 255 colours is computed on a
// sample of images (no flicker), plus one index reserved for transparency; every image is then
// indexed on it. With the optimisation, a pixel unchanged since the previous image is written
// with the transparent index, and `dispose: 1` keeps the previous image under it. Generators:
// one step per image, so that the worker can yield and be cancelled between two steps. Memory
// stays bounded: only the indices of the previous image are kept.
import { applyPalette, GIFEncoder, quantize, type GifPalette } from 'gifenc'
import { GIF_PALETTE_SAMPLE_FRAMES } from '../../config/defaults'
import type { EvalCaches } from '../../engine/caches'
import type { EngineSettings } from '../../model/settings'
import type { Play } from '../../model/types'
import { gifFileName, leafLetters, type GifLines } from '../names'
import type { ExportFile, ExportProgress, GifOptions, PixelSurface, SurfaceFactory } from '../types'
import { drawGifItem, gifFormat, gifLayout } from './frame'
import { gifTargets, gifTimeline, type GifItem, type GifTarget } from './timeline'

/** Colours of the palette; one more index is reserved for transparency. */
export const GIF_MAX_COLORS = 255

/** Colour stored at the transparent index (never displayed). */
const TRANSPARENT_COLOR: [number, number, number] = [255, 0, 255]

export interface GifStep {
  stage: 'palette' | 'frames'
  done: number
  total: number
}

/** Images sampled for the palette: the first card of each kind and scenes evenly spaced. */
export function paletteSample(
  items: readonly GifItem[],
  sceneCount: number = GIF_PALETTE_SAMPLE_FRAMES,
): number[] {
  const cards: number[] = []
  const kinds = new Set<string>()
  const scenes: number[] = []
  items.forEach((item, i) => {
    if (item.kind === 'scene') scenes.push(i)
    else if (!kinds.has(item.card)) {
      kinds.add(item.card)
      cards.push(i)
    }
  })
  const n = Math.min(sceneCount, scenes.length)
  const picked =
    n <= 1
      ? scenes.slice(0, n)
      : Array.from({ length: n }, (_, k) => scenes[Math.floor((k * (scenes.length - 1)) / (n - 1))])
  return [...new Set([...cards, ...picked.filter((i) => i !== undefined)])].sort((a, b) => a - b)
}

/** Encodes the images of a plan; `draw` paints one image on the surface. */
export function* encodeGif(
  items: readonly GifItem[],
  draw: (item: GifItem) => void,
  surface: PixelSurface,
  optimizeUnchanged: boolean,
): Generator<GifStep, Uint8Array> {
  const { width, height } = surface
  const sample = paletteSample(items)
  const imageSize = width * height * 4
  const sampled = new Uint8Array(imageSize * sample.length)
  for (const [k, index] of sample.entries()) {
    const item = items[index]
    if (item) draw(item)
    sampled.set(surface.readPixels(), k * imageSize)
    yield { stage: 'palette', done: k + 1, total: sample.length }
  }
  const palette = quantize(sampled, GIF_MAX_COLORS)
  const transparentIndex = palette.length
  const globalPalette: GifPalette = [...palette, TRANSPARENT_COLOR]
  const gif = GIFEncoder()
  let previous: Uint8Array | null = null
  for (const [i, item] of items.entries()) {
    draw(item)
    const indices = applyPalette(surface.readPixels(), palette)
    let written = indices
    const transparent = optimizeUnchanged && previous !== null
    if (transparent && previous) {
      written = indices.slice()
      for (let p = 0; p < written.length; p++) {
        if (indices[p] === previous[p]) written[p] = transparentIndex
      }
    }
    gif.writeFrame(written, width, height, {
      palette: i === 0 ? globalPalette : undefined,
      delay: item.delayCs * 10,
      transparent,
      transparentIndex,
      // Keep the previous image under the transparent pixels (the default would clear it).
      dispose: 1,
      repeat: 0,
    })
    previous = indices
    yield { stage: 'frames', done: i + 1, total: items.length }
  }
  gif.finish()
  return gif.bytes()
}

function nameLines(play: Play, target: GifTarget): GifLines {
  if (target.kind === 'chained') return { kind: 'chained' }
  if (target.kind === 'single') return { kind: 'single' }
  return { kind: 'leaf', letters: leafLetters(play, target.lines[0] ?? []) }
}

/**
 * Every GIF file of an export: one, or one per leaf (written together at the end, D-065).
 * Progress counts the sampled and encoded images of every file.
 */
export function* gifExport(
  play: Play,
  options: GifOptions,
  settings: EngineSettings,
  caches: EvalCaches,
  createSurface: SurfaceFactory,
): Generator<ExportProgress, ExportFile[]> {
  const format = gifFormat(options)
  const surface = createSurface(format.width, format.height)
  const plans = gifTargets(play, options.lines).map((target) => ({
    target,
    items: gifTimeline(play, target, options.speed, format.fps, settings, caches),
  }))
  const total = plans.reduce((sum, p) => sum + paletteSample(p.items).length + p.items.length, 0)
  let done = 0
  const files: ExportFile[] = []
  for (const { target, items } of plans) {
    const layout = gifLayout(surface.ctx, play, target, options, settings, caches)
    const steps = encodeGif(
      items,
      (item) => {
        drawGifItem(surface.ctx, play, item, layout, options.layers, settings, caches)
      },
      surface,
      options.optimizeUnchanged,
    )
    let step = steps.next()
    while (step.done !== true) {
      done++
      yield { stage: step.value.stage, done, total }
      step = steps.next()
    }
    files.push({
      fileName: gifFileName(play.name, {
        orientation: options.orientation,
        quality: options.quality,
        lines: nameLines(play, target),
        speed: options.speed,
        light: options.light,
      }),
      mime: 'image/gif',
      bytes: step.value,
    })
  }
  return files
}
