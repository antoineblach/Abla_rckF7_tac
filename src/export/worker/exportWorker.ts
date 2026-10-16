// The export worker (module worker built by Vite): loads the embedded font once (for the
// OffscreenCanvas of the GIFs and for jsPDF), then runs the jobs posted by the page through the
// handler. Images are drawn on an OffscreenCanvas read frequently (software rendering: fast and
// deterministic reads).
import type { PdfFonts } from '../pdf/pdfCtx'
import type { PixelSurface } from '../types'
import { createExportHandler, type WorkerEnvironment } from './handler'

/** The members of the dedicated worker scope used here (the project compiles with the DOM lib). */
interface WorkerScope {
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  postMessage(message: unknown, transfer: Transferable[]): void
  fonts: FontFaceSet
}

const scope = self as unknown as WorkerScope

const FONT_FAMILY = 'Atkinson Hyperlegible'
const FONT_FILES = {
  regular: 'AtkinsonHyperlegible-Regular.ttf',
  bold: 'AtkinsonHyperlegible-Bold.ttf',
} as const

let fonts: Promise<PdfFonts> | null = null

async function fetchFont(file: string): Promise<Uint8Array> {
  const response = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`)
  if (!response.ok) throw new Error(`Font ${file}: HTTP ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

async function loadFonts(): Promise<PdfFonts> {
  const [regular, bold] = await Promise.all([
    fetchFont(FONT_FILES.regular),
    fetchFont(FONT_FILES.bold),
  ])
  for (const [bytes, weight] of [
    [regular, 'normal'],
    [bold, 'bold'],
  ] as const) {
    const face = new FontFace(FONT_FAMILY, bytes.slice().buffer, { weight })
    await face.load()
    scope.fonts.add(face)
  }
  return { regular, bold }
}

function surface(width: number, height: number): PixelSurface {
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('No 2D context on OffscreenCanvas')
  return {
    width,
    height,
    ctx,
    // getImageData returns a new array owning its whole buffer.
    readPixels: () => new Uint8Array(ctx.getImageData(0, 0, width, height).data.buffer),
  }
}

// Gives the hand back without the minimum delay of setTimeout.
const channel = new MessageChannel()
const waiting: (() => void)[] = []
channel.port1.onmessage = () => {
  waiting.shift()?.()
}

const env: WorkerEnvironment = {
  resources: async (job) => {
    fonts ??= loadFonts().catch((error: unknown) => {
      fonts = null
      throw error
    })
    const loaded = await fonts
    return { createSurface: surface, pdfFonts: job.kind === 'pdf' ? loaded : null }
  },
  yieldNow: () =>
    new Promise<void>((resolve) => {
      waiting.push(resolve)
      channel.port2.postMessage(null)
    }),
  now: () => performance.now(),
}

const handle = createExportHandler(env, (message, transfer) => {
  scope.postMessage(message, transfer)
})

scope.onmessage = (event) => {
  handle(event.data)
}
