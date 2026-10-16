// Fixtures and surfaces of the export tests. Never imported by the application.
import { createCanvas } from '@napi-rs/canvas'
import { readFileSync } from 'node:fs'
import type { PixelSurface } from '../export/types'
import type { Play } from '../model/types'
import type { Ctx2D } from '../render/ctx2d'
import { basePlay, phase, player, run, uuid } from './builders'
import { registerFonts } from './imageSnapshot'

/** The frozen fixture of lot 1: 7 v 7, trunk of 2 phases, 2 options at phase 3 (read only). */
export function loadOptionsFixture(): Play {
  return JSON.parse(
    readFileSync(new URL('./fixtures/play-v1-7v7-options.json', import.meta.url), 'utf8'),
  ) as Play
}

/** Drawing surface of @napi-rs/canvas with the embedded font, as the worker's OffscreenCanvas. */
export function napiSurface(width: number, height: number): PixelSurface {
  registerFonts()
  const canvas = createCanvas(width, height)
  const native = canvas.getContext('2d')
  const ctx: Ctx2D = native
  return {
    width,
    height,
    ctx,
    readPixels: () => new Uint8Array(native.getImageData(0, 0, width, height).data),
  }
}

/** RGBA pixels as a canvas, to compare a decoded image with a reference image. */
export function canvasFromPixels(pixels: Uint8Array, width: number, height: number) {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(width, height)
  image.data.set(pixels)
  ctx.putImageData(image, 0, 0)
  return canvas
}

/**
 * Two branch points, three lines: options A and B at phase 2, then options A and B at phase 3
 * under 2A. One player runs 4 m at a jog (4 m/s) in every phase: each phase lasts 1 s.
 */
export function twoBranchPointsPlay(): Play {
  const a1 = uuid(1)
  const step = (n: number, to: { x: number; y: number }) => [run(uuid(200 + n), a1, [to])]
  return basePlay({
    name: 'Double option',
    entities: [player(a1, 'A', 1)],
    setup: { positions: { [a1]: { x: 40, y: 35 } }, ballCarrierId: null, ballPosition: null },
    phases: [
      phase(uuid(100), null, step(0, { x: 44, y: 35 }), { instruction: 'Fixer' }),
      phase(uuid(101), uuid(100), step(1, { x: 48, y: 35 }), {
        isDefault: true,
        condition: 'Large',
      }),
      phase(uuid(102), uuid(100), step(2, { x: 44, y: 39 }), { condition: 'Serré' }),
      phase(uuid(103), uuid(101), step(3, { x: 52, y: 35 }), { isDefault: true }),
      phase(uuid(104), uuid(101), step(4, { x: 48, y: 39 }), { condition: 'Montée' }),
    ],
  })
}
