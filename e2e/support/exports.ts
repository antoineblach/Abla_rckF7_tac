// Export helpers of the end-to-end tests: dialogs, result, and the produced files read in Node
// (omggif for the GIFs, pdf.js for the PDFs).
import { expect, type Locator, type Page } from '@playwright/test'
import { GifReader } from 'omggif'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

/** Opens « Exporter GIF » or « Exporter PDF », lets `choose` set the options, then exports. */
export async function exportFromToolbar(
  page: Page,
  button: 'Exporter GIF' | 'Exporter PDF',
  choose: (dialog: Locator) => Promise<void> = () => Promise.resolve(),
): Promise<void> {
  await page.getByRole('button', { name: button }).click()
  const dialog = page.getByRole('dialog')
  await choose(dialog)
  await dialog.getByRole('button', { name: 'Exporter', exact: true }).click()
}

/** The « Export terminé » window: names and sizes shown. */
export async function exportResult(
  page: Page,
  timeout = 60_000,
): Promise<{ names: string[]; sizes: string[] }> {
  const result = page.getByTestId('export-result')
  await expect(result).toBeVisible({ timeout })
  const names = await result.getByTestId('export-file-name').allTextContents()
  const sizes = await result.getByTestId('export-file-size').allTextContents()
  return { names, sizes }
}

export async function closeResult(page: Page): Promise<void> {
  await page.getByTestId('export-result').getByRole('button', { name: 'Fermer' }).click()
}

export interface GifSummary {
  width: number
  height: number
  frames: number
  delays: number[]
  loop: number | null
}

export function readGif(bytes: Buffer): GifSummary {
  expect(bytes.subarray(0, 6).toString('latin1')).toBe('GIF89a')
  const reader = new GifReader(new Uint8Array(bytes))
  const delays: number[] = []
  for (let i = 0; i < reader.numFrames(); i++) delays.push(reader.frameInfo(i).delay)
  return {
    width: reader.width,
    height: reader.height,
    frames: reader.numFrames(),
    delays,
    loop: reader.loopCount(),
  }
}

export interface PdfSummary {
  pages: number
  texts: string[]
  /** Destination page (1-based) of every link, per page. */
  links: (number | null)[][]
  outline: { title: string; page: number | null }[]
  /** Width and height of the first page, in millimetres. */
  firstPageMm: [number, number]
}

export async function readPdf(bytes: Buffer): Promise<PdfSummary> {
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  const doc = await getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    verbosity: 0,
  }).promise
  const pageOf = async (dest: unknown): Promise<number | null> => {
    const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest
    if (!Array.isArray(explicit)) return null
    const ref: unknown = explicit[0]
    if (ref === null || typeof ref !== 'object') return null
    return (await doc.getPageIndex(ref as Parameters<typeof doc.getPageIndex>[0])) + 1
  }
  const texts: string[] = []
  const links: (number | null)[][] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()
    texts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
    const annotations = (await page.getAnnotations()) as { subtype?: string; dest?: unknown }[]
    const pageLinks: (number | null)[] = []
    for (const a of annotations) if (a.subtype === 'Link') pageLinks.push(await pageOf(a.dest))
    links.push(pageLinks)
  }
  // pdf.js answers null, not [], for a PDF without bookmarks (its types say otherwise).
  const outline = await Promise.all(
    (((await doc.getOutline()) as Awaited<ReturnType<typeof doc.getOutline>> | null) ?? []).map(
      async (node) => ({
        title: node.title,
        page: await pageOf(node.dest),
      }),
    ),
  )
  const viewport = (await doc.getPage(1)).getViewport({ scale: 1 })
  return {
    pages: doc.numPages,
    texts,
    links,
    outline,
    firstPageMm: [(viewport.width * 25.4) / 72, (viewport.height * 25.4) / 72],
  }
}

/** Starts collecting the long tasks of the main thread (PerformanceObserver, Chromium). */
export async function watchLongTasks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const scope = window as unknown as { longTasks: number[] }
    scope.longTasks = []
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) scope.longTasks.push(entry.duration)
    }).observe({ type: 'longtask' })
  })
}

export function longTasks(page: Page): Promise<number[]> {
  return page.evaluate(() => (window as unknown as { longTasks: number[] }).longTasks)
}
