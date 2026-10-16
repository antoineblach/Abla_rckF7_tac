// Options and results of the exports (SPEC 9, D-058 to D-069). Plain data: they travel from the
// page to the export worker by structured clone.
import type {
  ExportOrientation,
  GifLinesMode,
  GifQuality,
  GifSpeedMode,
  GifThemeId,
  PdfColor,
  PdfLayout,
} from '../model/settings'
import type { Ctx2D } from '../render/ctx2d'
import type { Layers } from '../render/layers'

export interface GifOptions {
  orientation: ExportOrientation
  lines: GifLinesMode
  speed: GifSpeedMode
  quality: GifQuality
  theme: GifThemeId
  /** Unchanged pixels coded as transparent (D-069). */
  optimizeUnchanged: boolean
  /** « Version allégée » (D-067): standard size, lower frame rate. */
  light: boolean
  /** Layers of the player, kept as they are (D-068); the banner is always drawn (D-060). */
  layers: Layers
}

export interface PdfOptions {
  layout: PdfLayout
  color: PdfColor
}

/** Playbook (« cahier de jeu », D-064). */
export interface BookOptions {
  title: string
  /** Category label, or « Sélection » for a hand-made selection. */
  subtitle: string
}

/** A file produced by an export, before it is written. */
export interface ExportFile {
  fileName: string
  mime: string
  bytes: Uint8Array
}

/** Progress of an export: the stage being done and the work done across every file. */
export interface ExportProgress {
  stage: 'fonts' | 'palette' | 'frames' | 'pages'
  done: number
  total: number
}

/** An RGBA surface to draw an image on and read its pixels back. */
export interface PixelSurface {
  readonly width: number
  readonly height: number
  readonly ctx: Ctx2D
  /** RGBA pixels in a new array that owns its whole buffer (gifenc reads the whole buffer). */
  readPixels(): Uint8Array
}

/** Creates the drawing surfaces of a GIF (OffscreenCanvas in the worker, @napi-rs/canvas in tests). */
export type SurfaceFactory = (width: number, height: number) => PixelSurface
