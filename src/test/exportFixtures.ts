// Fixtures and surfaces of the export tests. Never imported by the application.
import { createCanvas } from '@napi-rs/canvas'
import { readFileSync } from 'node:fs'
import type { Ctx2D } from '../render/ctx2d'
import { registerFonts } from './imageSnapshot'
import type { PdfFonts } from '../export/pdf/pdfCtx'
import type { PixelSurface } from '../export/types'
import type { Play } from '../model/types'
import {
  basePlay,
  branch,
  fourVsTwoNoBall,
  P,
  player,
  ROOT_BRANCH,
  run,
  sequence,
  sevenVsSevenWithOptions,
  uuid,
} from './builders'

/** The embedded font, as the worker fetches it from public/fonts/. */
export function loadPdfFonts(): PdfFonts {
  const read = (weight: string) =>
    new Uint8Array(
      readFileSync(
        new URL(`../../public/fonts/AtkinsonHyperlegible-${weight}.ttf`, import.meta.url),
      ),
    )
  return { regular: read('Regular'), bold: read('Bold') }
}

/** The acceptance scenario with a third option, and French typography in its texts. */
export function threeOptionsPlay(): Play {
  const play = sevenVsSevenWithOptions()
  const optC = { branchId: uuid(104) }
  return {
    ...play,
    id: uuid(9001),
    name: 'Trois options « au large »',
    notes: 'l’option dépend de la « défense » adverse, décidée à l’embranchement. Œil sur la 6.',
    updatedAt: '2026-10-12T08:00:00.000Z',
    branches: [...play.branches, branch(optC.branchId, P.root, { condition: 'Défense glissée' })],
    actions: [
      ...play.actions,
      run(uuid(240), P.A(7), [{ x: 52, y: 68 }], { ...optC, pace: 'sprint', start: 6.335 }),
    ],
    sequences: [
      ...play.sequences,
      sequence(uuid(242), 6.335, 8.5, { ...optC, instruction: 'Jeu au large' }),
    ],
  }
}

/** Five plays of a playbook, one of them with three options (plan of lot 2, section 7). */
export function bookPlays(): Play[] {
  return [
    sevenVsSevenWithOptions(),
    threeOptionsPlay(),
    { ...twoBranchPointsPlay(), id: uuid(9002), updatedAt: '2026-10-13T09:30:00.000Z' },
    { ...fourVsTwoNoBall(), id: uuid(9003), updatedAt: '2026-10-11T10:00:00.000Z' },
    {
      ...sevenVsSevenWithOptions(),
      id: uuid(9004),
      name: 'Croisée côté fermé',
      category: 'scrum',
      updatedAt: '2026-10-15T18:45:00.000Z',
    },
  ]
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

/** Branches of `twoBranchPointsPlay`. */
export const TWO_POINTS = {
  root: ROOT_BRANCH,
  large: uuid(101),
  tight: uuid(102),
  deep: uuid(103),
  rising: uuid(104),
} as const

/**
 * Two branch points, three lines: options A and B at the end of the first run, then options A and B
 * at the end of the run of option A. One player runs in every branch; each run starts at the branch
 * point it comes from.
 */
export function twoBranchPointsPlay(): Play {
  const { root, large, tight, deep, rising } = TWO_POINTS
  const a1 = uuid(1)
  const first = uuid(200)
  const second = uuid(201)
  return basePlay({
    name: 'Double option',
    entities: [player(a1, 'A', 1)],
    setup: { positions: { [a1]: { x: 40, y: 35 } }, ballCarrierId: null, ballPosition: null },
    branches: [
      branch(root, null, { branchAt: 1, branchAtGlue: { targetId: first, event: 'end' } }),
      branch(large, root, {
        isDefault: true,
        condition: 'Large',
        branchAt: 2,
        branchAtGlue: { targetId: second, event: 'end' },
      }),
      branch(tight, root, { condition: 'Serré' }),
      branch(deep, large, { isDefault: true }),
      branch(rising, large, { condition: 'Montée' }),
    ],
    actions: [
      run(first, a1, [{ x: 44, y: 35 }]),
      run(second, a1, [{ x: 48, y: 35 }], {
        branchId: large,
        start: 1,
        startGlue: { targetId: root, event: 'end' },
      }),
      run(uuid(202), a1, [{ x: 44, y: 39 }], {
        branchId: tight,
        start: 1,
        startGlue: { targetId: root, event: 'end' },
      }),
      run(uuid(203), a1, [{ x: 52, y: 35 }], {
        branchId: deep,
        start: 2,
        startGlue: { targetId: large, event: 'end' },
      }),
      run(uuid(204), a1, [{ x: 48, y: 39 }], {
        branchId: rising,
        start: 2,
        startGlue: { targetId: large, event: 'end' },
      }),
    ],
    sequences: [sequence(uuid(300), 0, 1, { instruction: 'Fixer' })],
  })
}
