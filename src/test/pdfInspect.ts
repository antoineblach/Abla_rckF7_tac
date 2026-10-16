// Reads the PDFs produced by the exports (pdf.js): pages, text, links and their destination,
// bookmarks, and a page rasterised by @napi-rs/canvas. Never imported by the application.
import { createCanvas, type Canvas } from '@napi-rs/canvas'
import { getDocument, OPS, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'

export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  // pdf.js takes ownership of the array it reads: give it a copy.
  return getDocument({ data: bytes.slice(), disableFontFace: true, verbosity: 0 }).promise
}

/** Text of a page (1-based), its items separated by spaces. */
export async function pageText(doc: PDFDocumentProxy, page: number): Promise<string> {
  const content = await (await doc.getPage(page)).getTextContent()
  return content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
}

/** Dash patterns set on a page (setDash operators), in the units of the page content. */
export async function pageDashes(doc: PDFDocumentProxy, page: number): Promise<number[][]> {
  const operators = await (await doc.getPage(page)).getOperatorList()
  const dashes: number[][] = []
  for (const [i, fn] of operators.fnArray.entries()) {
    if (fn !== OPS.setDash) continue
    const args = operators.argsArray[i] as [number[], number] | undefined
    if (args) dashes.push([...args[0]])
  }
  return dashes
}

/** Width and height of a page, in millimetres. */
export async function pageSizeMm(doc: PDFDocumentProxy, page: number): Promise<[number, number]> {
  const viewport = (await doc.getPage(page)).getViewport({ scale: 1 })
  return [(viewport.width * 25.4) / 72, (viewport.height * 25.4) / 72]
}

async function destinationPage(doc: PDFDocumentProxy, dest: unknown): Promise<number | null> {
  const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest
  if (!Array.isArray(explicit)) return null
  const ref: unknown = explicit[0]
  if (typeof ref === 'number') return ref + 1
  if (ref === null || typeof ref !== 'object') return null
  return (await doc.getPageIndex(ref as Parameters<PDFDocumentProxy['getPageIndex']>[0])) + 1
}

export interface PdfLink {
  /** [x1, y1, x2, y2] in points, origin at the bottom left. */
  rect: number[]
  /** Destination page, 1-based. */
  page: number | null
}

/** Internal links of a page. */
export async function pageLinks(doc: PDFDocumentProxy, page: number): Promise<PdfLink[]> {
  const annotations = (await (await doc.getPage(page)).getAnnotations()) as {
    subtype?: string
    rect?: number[]
    dest?: unknown
  }[]
  const links: PdfLink[] = []
  for (const annotation of annotations) {
    if (annotation.subtype !== 'Link') continue
    links.push({ rect: annotation.rect ?? [], page: await destinationPage(doc, annotation.dest) })
  }
  return links
}

/** Bookmarks: title and destination page. */
export async function pdfOutline(
  doc: PDFDocumentProxy,
): Promise<{ title: string; page: number | null }[]> {
  // pdf.js answers null, not [], for a PDF without bookmarks (its types say otherwise).
  const outline =
    ((await doc.getOutline()) as Awaited<ReturnType<typeof doc.getOutline>> | null) ?? []
  return Promise.all(
    outline.map(async (node) => ({
      title: node.title,
      page: await destinationPage(doc, node.dest),
    })),
  )
}

/** A page rasterised at `pxPerMm`, cropped to a rectangle in millimetres when given. */
export async function rasterize(
  doc: PDFDocumentProxy,
  page: number,
  pxPerMm: number,
  crop?: { x: number; y: number; w: number; h: number },
): Promise<Canvas> {
  const pdfPage = await doc.getPage(page)
  const viewport = pdfPage.getViewport({ scale: (pxPerMm * 25.4) / 72 })
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height))
  // @napi-rs/canvas implements what pdf.js uses of a canvas (pdf.js relies on it in Node).
  await pdfPage.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise
  if (!crop) return canvas
  const out = createCanvas(Math.round(crop.w * pxPerMm), Math.round(crop.h * pxPerMm))
  out
    .getContext('2d')
    .drawImage(canvas, -Math.round(crop.x * pxPerMm), -Math.round(crop.y * pxPerMm))
  return out
}
