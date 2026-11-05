// A thumbnail of the PDF (SPEC 9.3, D-063, D-071): one line at rest, attack upwards, with the
// framing of its play. Vector drawing on the jsPDF context: no scale(), the
// viewport works directly in millimetres (pixel ratio = millimetres per CSS pixel); the thumbnail
// is placed by translate() and clipped to its rectangle, as a PDF page does not clip.
import { PDF_TEXT } from '../../../config/defaults'
import type { Bounds } from '../../engine/bounds'
import type { EvalCaches } from '../../engine/caches'
import { lineSchematic } from '../../engine/evaluate'
import type { EngineSettings, PdfLayout } from '../../../model/settings'
import type { Id, Play } from '../../model/types'
import type { Ctx2D } from '../../../render/ctx2d'
import { drawSchematic } from '../../render/renderSchematic'
import type { Theme } from '../../../render/themes'
import { createViewport, type Viewport } from '../../../render/viewport'
import { PT_TO_MM } from './layout'

/** Millimetres per CSS pixel: token numbers just above an integer number of points (D-071). */
export function thumbMmPerPx(layout: PdfLayout, theme: Theme): number {
  return (PDF_TEXT[layout].thumbTokenNumber * PT_TO_MM) / theme.tokenFontSize
}

export function thumbViewport(
  w: number,
  h: number,
  frame: Bounds,
  play: Play,
  mmPerPx: number,
): Viewport {
  return createViewport({
    widthPx: w,
    heightPx: h,
    pixelRatio: mmPerPx,
    frame,
    orientation: 'portrait',
    attackingTeam: play.attackingTeam,
  })
}

/** Draws the thumbnail of `line` in the rectangle (x, y, w, h), in millimetres. */
export function drawThumbnail(
  ctx: Ctx2D,
  play: Play,
  line: readonly Id[],
  rect: { x: number; y: number; w: number; h: number },
  frame: Bounds,
  theme: Theme,
  mmPerPx: number,
  settings: EngineSettings,
  caches: EvalCaches,
): void {
  const viewport = thumbViewport(rect.w, rect.h, frame, play, mmPerPx)
  ctx.save()
  ctx.translate(rect.x, rect.y)
  ctx.beginPath()
  ctx.rect(0, 0, rect.w, rect.h)
  ctx.clip()
  drawSchematic(ctx, lineSchematic(play, line, settings, caches), viewport, theme)
  ctx.restore()
}
