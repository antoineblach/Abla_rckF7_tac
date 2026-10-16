// One image of a GIF (SPEC 9.1, 9.2, D-060): the scene drawn by evaluate and render, under the
// header and the instruction banner, or a card. A single layout (size, scale, framing) serves the
// whole GIF, so that the field never moves.
import { GIF_FORMATS, GIF_LIGHT_FPS } from '../../config/defaults'
import type { EvalCaches } from '../../engine/caches'
import { evaluate } from '../../engine/evaluate'
import { phaseLabelOf } from '../../model/labels'
import { findPhase } from '../../model/phaseTree'
import type { EngineSettings, ExportOrientation, GifQuality } from '../../model/settings'
import type { Play } from '../../model/types'
import { dressingHeightPx, drawCard, drawDressing, smallestTextCss } from '../../render/captions'
import type { Ctx2D } from '../../render/ctx2d'
import type { Layers } from '../../render/layers'
import { bannerLines } from '../../render/primitives'
import { render } from '../../render/render'
import { THEMES, type Theme } from '../../render/themes'
import { createViewport, type Viewport } from '../../render/viewport'
import { linesFrame } from '../framing'
import { legiblePixelRatio, phoneScreenWidthMm } from '../legibility'
import { EXPORT_TEXT, exportText } from '../text'
import type { GifOptions } from '../types'
import type { GifItem, GifTarget } from './timeline'

export interface GifFormat {
  width: number
  height: number
  fps: number
}

/** Size and frame rate (SPEC 9.2); the « version allégée » is standard at a lower rate (D-067). */
export function gifFormat(options: {
  orientation: ExportOrientation
  quality: GifQuality
  light: boolean
}): GifFormat {
  const format = GIF_FORMATS[options.light ? 'standard' : options.quality]
  const size = format[options.orientation]
  return {
    width: size.width,
    height: size.height,
    fps: options.light ? GIF_LIGHT_FPS : format.fps,
  }
}

export interface GifLayout {
  format: GifFormat
  theme: Theme
  /** Fixed framing of the whole GIF, under the header and the banner. */
  viewport: Viewport
  /** Lines kept for the instruction banner: the most any instruction of the GIF needs. */
  bannerLines: number
}

/** Layout of a GIF; `ctx` measures the instructions with the export font. */
export function gifLayout(
  ctx: Ctx2D,
  play: Play,
  target: GifTarget,
  options: Pick<GifOptions, 'orientation' | 'quality' | 'light' | 'theme'>,
  settings: EngineSettings,
  caches: EvalCaches,
): GifLayout {
  const format = gifFormat(options)
  const theme = THEMES[options.theme]
  const pixelRatio = legiblePixelRatio(
    format.width,
    phoneScreenWidthMm(options.orientation),
    smallestTextCss(theme),
  )
  const frame = { widthPx: format.width, heightPx: format.height, pixelRatio }
  const phaseIds = [...new Set(target.lines.flat())]
  const lines = Math.max(
    0,
    ...phaseIds.map(
      (id) =>
        bannerLines(ctx, frame, theme, exportText(findPhase(play, id)?.instruction ?? '')).length,
    ),
  )
  const viewport = createViewport({
    widthPx: format.width,
    heightPx: format.height,
    pixelRatio,
    frame: linesFrame(play, target.lines, settings, caches),
    orientation: options.orientation,
    attackingTeam: play.attackingTeam,
    // Landscape GIFs always attack to the right (SPEC 9.2, D-006).
    rotate180: options.orientation === 'landscape' && play.attackingTeam === 'B',
    insets: { top: dressingHeightPx(frame, theme, lines), right: 0, bottom: 0, left: 0 },
  })
  return { format, theme, viewport, bannerLines: lines }
}

/** Draws one image of the plan. */
export function drawGifItem(
  ctx: Ctx2D,
  play: Play,
  item: GifItem,
  layout: GifLayout,
  layers: Layers,
  settings: EngineSettings,
  caches: EvalCaches,
): void {
  const { viewport, theme } = layout
  if (item.kind === 'card') {
    drawCard(ctx, viewport, theme, exportText(item.title), exportText(item.subtitle))
    return
  }
  const state = evaluate(play, item.line, item.t, settings, caches)
  render(ctx, state, viewport, theme, { ...layers, instruction: false })
  drawDressing(
    ctx,
    viewport,
    theme,
    exportText(state.phaseId === null ? '' : phaseLabelOf(play, state.phaseId)),
    item.speed < 1 ? EXPORT_TEXT.slow : EXPORT_TEXT.real,
    exportText(state.instruction),
    layout.bannerLines,
  )
}
