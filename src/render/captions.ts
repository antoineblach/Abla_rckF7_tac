// Export dressing (SPEC 9.2, D-060): cards (title, option, speed) and the header of a GIF image
// (phase label on the left, speed badge on the right), with the instruction banner just under
// it. Pure drawing with the same primitives and flat colours as the scene; the texts come ready
// to print. Sizes are CSS pixels at scale 1, multiplied by the pixel ratio like the theme sizes.
import { CAPTION_SIZES } from '../config/defaults'
import type { Ctx2D } from './ctx2d'
import { bannerHeightPx, drawBanner, wrapText } from './primitives'
import type { Theme } from './themes'
import { sizePx, type ImageFrame } from './viewport'

const LINE_HEIGHT = 1.25

/** Smallest text size of an export image with this theme, in CSS pixels at scale 1 (D-061). */
export function smallestTextCss(theme: Theme): number {
  return Math.min(
    theme.tokenFontSize,
    theme.bannerFontSize,
    CAPTION_SIZES.headerFontSize,
    CAPTION_SIZES.badgeFontSize,
    CAPTION_SIZES.cardSubtitleFontSize,
  )
}

export function headerHeightPx(frame: ImageFrame): number {
  return sizePx(frame, CAPTION_SIZES.headerHeight)
}

/** Height kept above the field: the header and a banner of `bannerLines` lines. */
export function dressingHeightPx(frame: ImageFrame, theme: Theme, bannerLines: number): number {
  return headerHeightPx(frame) + bannerHeightPx(frame, theme, bannerLines)
}

/** Header across the top: phase label on the left, badge (« Ralenti »...) on the right. */
export function drawHeader(
  ctx: Ctx2D,
  frame: ImageFrame,
  theme: Theme,
  label: string,
  badge: string | null,
): void {
  const height = headerHeightPx(frame)
  const margin = sizePx(frame, CAPTION_SIZES.sideMargin)
  // Optical centring of capitals and digits with a middle baseline (as the tokens).
  const textY = height / 2 + sizePx(frame, 0.5)
  ctx.fillStyle = theme.bannerBackground
  ctx.fillRect(0, 0, frame.widthPx, height)
  ctx.textBaseline = 'middle'
  let right = frame.widthPx - margin
  if (badge !== null && badge !== '') {
    ctx.font = `bold ${sizePx(frame, CAPTION_SIZES.badgeFontSize)}px ${theme.font}`
    const badgeWidth = ctx.measureText(badge).width + 2 * sizePx(frame, CAPTION_SIZES.badgePaddingX)
    const badgeHeight = sizePx(frame, CAPTION_SIZES.badgeHeight)
    ctx.fillStyle = theme.badgeBackground
    ctx.fillRect(right - badgeWidth, (height - badgeHeight) / 2, badgeWidth, badgeHeight)
    ctx.fillStyle = theme.badgeText
    ctx.textAlign = 'center'
    ctx.fillText(badge, right - badgeWidth / 2, textY)
    right -= badgeWidth + margin
  }
  ctx.font = `bold ${sizePx(frame, CAPTION_SIZES.headerFontSize)}px ${theme.font}`
  const [line] = wrapText(ctx, label, Math.max(0, right - margin), 1)
  ctx.fillStyle = theme.bannerText
  ctx.textAlign = 'left'
  ctx.fillText(line ?? '', margin, textY)
}

/**
 * Header and instruction banner of a GIF image (D-060). The banner keeps `bannerLines` lines
 * whatever the instruction, so that the framing of the field never moves during the GIF.
 */
export function drawDressing(
  ctx: Ctx2D,
  frame: ImageFrame,
  theme: Theme,
  label: string,
  badge: string | null,
  instruction: string,
  bannerLines: number,
): void {
  drawHeader(ctx, frame, theme, label, badge)
  if (bannerLines > 0) {
    drawBanner(ctx, frame, theme, instruction, headerHeightPx(frame), bannerLines)
  }
}

/** Card filling the image: a title of up to four lines and an optional subtitle (D-058, D-060). */
export function drawCard(
  ctx: Ctx2D,
  frame: ImageFrame,
  theme: Theme,
  title: string,
  subtitle = '',
): void {
  const margin = sizePx(frame, CAPTION_SIZES.sideMargin) * 2
  const width = Math.max(0, frame.widthPx - 2 * margin)
  const titleSize = sizePx(frame, CAPTION_SIZES.cardTitleFontSize)
  const subtitleSize = sizePx(frame, CAPTION_SIZES.cardSubtitleFontSize)
  const titleFont = `bold ${titleSize}px ${theme.font}`
  const subtitleFont = `bold ${subtitleSize}px ${theme.font}`
  ctx.font = titleFont
  const titleLines = wrapText(ctx, title, width, CAPTION_SIZES.cardMaxLines)
  ctx.font = subtitleFont
  const subtitleLines = subtitle.trim() === '' ? [] : wrapText(ctx, subtitle, width, 2)
  const gap = subtitleLines.length > 0 ? titleSize * 0.6 : 0
  const total =
    titleLines.length * titleSize * LINE_HEIGHT +
    gap +
    subtitleLines.length * subtitleSize * LINE_HEIGHT
  let y = (frame.heightPx - total) / 2
  ctx.fillStyle = theme.bannerBackground
  ctx.fillRect(0, 0, frame.widthPx, frame.heightPx)
  ctx.fillStyle = theme.bannerText
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = titleFont
  for (const line of titleLines) {
    ctx.fillText(line, frame.widthPx / 2, y + (titleSize * LINE_HEIGHT) / 2)
    y += titleSize * LINE_HEIGHT
  }
  y += gap
  ctx.font = subtitleFont
  for (const line of subtitleLines) {
    ctx.fillText(line, frame.widthPx / 2, y + (subtitleSize * LINE_HEIGHT) / 2)
    y += subtitleSize * LINE_HEIGHT
  }
}
