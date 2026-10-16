// Legibility of the exports on a 6 inch phone (SPEC 9.2, D-061): when the image (or the PDF
// page) fills the width of the screen, its smallest text is at least LEGIBILITY.minTextMm high.
// Landscape images are read with the phone turned (D-061).
import { LEGIBILITY } from '../config/defaults'
import type { ExportOrientation } from '../model/settings'

/** Width of the phone screen across which an image of this orientation is read, in mm. */
export function phoneScreenWidthMm(orientation: ExportOrientation): number {
  return orientation === 'landscape' ? LEGIBILITY.phoneLongSideMm : LEGIBILITY.phoneWidthMm
}

/** Smallest legible text size, in the units of `width`, for an image read across `screenMm`. */
export function minTextSize(width: number, screenMm: number): number {
  return (width * LEGIBILITY.minTextMm) / screenMm
}

/**
 * Pixel ratio that brings the smallest text of a theme (CSS pixels at scale 1) to the minimal
 * legible size; never below 1, so that exports are never smaller than the screen sizes.
 */
export function legiblePixelRatio(
  width: number,
  screenMm: number,
  smallestFontCss: number,
): number {
  return Math.max(1, minTextSize(width, screenMm) / smallestFontCss)
}
