// Reads the GIFs produced by the exports (omggif): images, delays, loop, composed pixels.
// Never imported by the application.
import { GifReader } from 'omggif'

export interface GifFrameInfo {
  delayCs: number
  disposal: number
  transparentIndex: number | null
}

export interface GifInfo {
  width: number
  height: number
  frames: GifFrameInfo[]
  /** 0: infinite loop (NETSCAPE2.0). */
  loopCount: number | null
}

export function inspectGif(bytes: Uint8Array): GifInfo {
  const reader = new GifReader(bytes)
  const frames: GifFrameInfo[] = []
  for (let i = 0; i < reader.numFrames(); i++) {
    const info = reader.frameInfo(i)
    frames.push({
      delayCs: info.delay,
      disposal: info.disposal,
      transparentIndex: info.transparent_index,
    })
  }
  return { width: reader.width, height: reader.height, frames, loopCount: reader.loopCount() }
}

/** RGBA pixels shown after image `upTo` (images 0..upTo composed, disposal 1: kept). */
export function composeGif(bytes: Uint8Array, upTo: number): Uint8Array {
  const reader = new GifReader(bytes)
  const pixels = new Uint8Array(reader.width * reader.height * 4)
  for (let i = 0; i <= upTo; i++) reader.decodeAndBlitFrameRGBA(i, pixels)
  return pixels
}
