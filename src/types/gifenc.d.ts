// Type declarations of gifenc 1.0.3 (the package ships none), limited to the API used by the
// GIF export (SPEC 9.2). SOURCE: https://github.com/mattdesl/gifenc (README, API section).
declare module 'gifenc' {
  export type GifColor = [number, number, number] | [number, number, number, number]
  export type GifPalette = GifColor[]
  export type GifPixelFormat = 'rgb565' | 'rgb444' | 'rgba4444'

  export interface QuantizeOptions {
    format?: GifPixelFormat
    oneBitAlpha?: boolean | number
    clearAlpha?: boolean
    clearAlphaThreshold?: number
    clearAlphaColor?: number
  }

  /** Reduced palette of at most `maxColors` colours. Reads the whole buffer of `rgba`. */
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: QuantizeOptions,
  ): GifPalette

  /** Index of the nearest palette colour for every pixel. Reads the whole buffer of `rgba`. */
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: GifPixelFormat,
  ): Uint8Array

  export interface WriteFrameOptions {
    palette?: GifPalette
    first?: boolean
    transparent?: boolean
    transparentIndex?: number
    /** Milliseconds, written in hundredths of a second (rounded). */
    delay?: number
    /** -1 once, 0 forever, n repetitions. Written with the first frame only. */
    repeat?: number
    colorDepth?: number
    /** -1: default (2 when transparent, which clears the frame); 1: keep the previous frame. */
    dispose?: number
  }

  export interface GifEncoderStream {
    writeFrame(index: Uint8Array, width: number, height: number, options?: WriteFrameOptions): void
    finish(): void
    /** Copy of the bytes written so far. */
    bytes(): Uint8Array
    bytesView(): Uint8Array
    reset(): void
  }

  export function GIFEncoder(options?: {
    auto?: boolean
    initialCapacity?: number
  }): GifEncoderStream
}
