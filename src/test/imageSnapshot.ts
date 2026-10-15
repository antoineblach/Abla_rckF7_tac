// Reference images for render tests (@napi-rs/canvas + pixelmatch). Never imported by the app.
// A missing reference is written locally and fails on the CI. UPDATE_SNAPSHOTS=1 rewrites them.
import { createCanvas, GlobalFonts, loadImage, type Canvas } from '@napi-rs/canvas'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pixelmatch from 'pixelmatch'
import type { Ctx2D } from '../render/ctx2d'

const SNAPSHOT_DIR = fileURLToPath(new URL('./image-snapshots/', import.meta.url))
const DIFF_DIR = fileURLToPath(new URL('./image-snapshots/__diff__/', import.meta.url))
const FONT_DIR = fileURLToPath(new URL('../../public/fonts/', import.meta.url))

/** Share of pixels allowed to differ (antialiasing differences between Windows and Linux). */
const MAX_DIFF_RATIO = 0.005

let fontsRegistered = false

export function registerFonts(): void {
  if (fontsRegistered) return
  GlobalFonts.registerFromPath(
    `${FONT_DIR}AtkinsonHyperlegible-Regular.ttf`,
    'Atkinson Hyperlegible',
  )
  GlobalFonts.registerFromPath(`${FONT_DIR}AtkinsonHyperlegible-Bold.ttf`, 'Atkinson Hyperlegible')
  fontsRegistered = true
}

export function createTestCanvas(width: number, height: number): { canvas: Canvas; ctx: Ctx2D } {
  registerFonts()
  const canvas = createCanvas(width, height)
  const ctx: Ctx2D = canvas.getContext('2d')
  return { canvas, ctx }
}

export interface ImageComparison {
  pass: boolean
  diffRatio: number
  message: string
}

export async function compareWithSnapshot(canvas: Canvas, name: string): Promise<ImageComparison> {
  const file = `${SNAPSHOT_DIR}${name}.png`
  const png = await canvas.encode('png')
  const update = process.env.UPDATE_SNAPSHOTS === '1'
  if (update || !existsSync(file)) {
    if (process.env.CI && !update) {
      return { pass: false, diffRatio: 1, message: `Missing reference image ${name}.png` }
    }
    mkdirSync(SNAPSHOT_DIR, { recursive: true })
    writeFileSync(file, png)
    return { pass: true, diffRatio: 0, message: `Reference image ${name}.png written` }
  }
  const { width, height } = canvas
  const reference = await loadImage(readFileSync(file))
  if (reference.width !== width || reference.height !== height) {
    return { pass: false, diffRatio: 1, message: `Size changed for ${name}.png` }
  }
  const refCanvas = createCanvas(width, height)
  const refCtx = refCanvas.getContext('2d')
  refCtx.drawImage(reference, 0, 0)
  const expected = refCtx.getImageData(0, 0, width, height).data
  const actual = canvas.getContext('2d').getImageData(0, 0, width, height).data
  const diffCanvas = createCanvas(width, height)
  const diffCtx = diffCanvas.getContext('2d')
  const diff = diffCtx.createImageData(width, height)
  const mismatched = pixelmatch(actual, expected, diff.data, width, height, { threshold: 0.1 })
  const diffRatio = mismatched / (width * height)
  if (diffRatio > MAX_DIFF_RATIO) {
    diffCtx.putImageData(diff, 0, 0)
    mkdirSync(DIFF_DIR, { recursive: true })
    writeFileSync(`${DIFF_DIR}${name}.diff.png`, await diffCanvas.encode('png'))
    writeFileSync(`${DIFF_DIR}${name}.actual.png`, png)
    return {
      pass: false,
      diffRatio,
      message: `${name}: ${(diffRatio * 100).toFixed(2)} % of pixels differ (see __diff__)`,
    }
  }
  return { pass: true, diffRatio, message: 'ok' }
}
