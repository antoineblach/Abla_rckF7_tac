// Writing of the PDFs with jsPDF (SPEC 9.3, D-064, D-071): pages computed beforehand, written one
// by one (a generator: the worker yields and can cancel between two pages). Texts through the
// text API of jsPDF; thumbnails through its 2D context. Deterministic: the creation date is the
// most recent modification date of the plays, the file identifier a hash of the content.
import type { Bounds } from '../../engine/bounds'
import type { EvalCaches } from '../../engine/caches'
import { canonicalJson, hashString } from '../../model/canonical'
import { CATEGORY_LABELS } from '../../model/labels'
import { allLines } from '../../model/phaseTree'
import type { EngineSettings, PdfLayout } from '../../model/settings'
import type { Play } from '../../model/types'
import { THEMES, type Theme } from '../../render/themes'
import { linesFrame } from '../framing'
import { pdfFileName } from '../names'
import { EXPORT_TEXT } from '../text'
import type { BookOptions, ExportFile, ExportProgress, PdfOptions } from '../types'
import { frenchDate, latestDate, layoutBook, phoneFooterSpace } from './book'
import {
  layoutPlayPhone,
  layoutPlayPrint,
  lineHeight,
  PT_TO_MM,
  THUMB_FRAME_COLOR,
  type PageSpec,
} from './layout'
import { createPdfDoc, PDF_FONT, pdfContext, pdfMeasure, type PdfFonts } from './pdfCtx'
import { drawThumbnail, thumbMmPerPx } from './thumbnail'

export interface PdfDocument {
  pages: PageSpec[]
  outline: { title: string; page: number }[]
  plays: Play[]
  /** Framing of each play (index of `PageItem.play`). */
  frames: Bounds[]
  theme: Theme
  layout: PdfLayout
  title: string
  /** ISO 8601. */
  creationDate: string
  /** 32 hexadecimal characters. */
  fileId: string
}

/** PDF date (« D:20261014120000+00'00' ») of an ISO 8601 date, in UTC. */
export function pdfDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(iso)
  return m ? `D:${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}+00'00'` : "D:20000101000000+00'00'"
}

/** Identifier of the file: a hash of everything it shows (same content, same identifier). */
export function pdfFileId(content: unknown): string {
  const text = canonicalJson(content)
  return `${hashString(text, 1)}${hashString(text, 2)}${hashString(text, 3)}`
    .slice(0, 32)
    .toUpperCase()
}

/** Writes the pages; yields the number of pages written. */
export function* writePdf(
  spec: PdfDocument,
  fonts: PdfFonts,
  settings: EngineSettings,
  caches: EvalCaches,
): Generator<number, Uint8Array> {
  const first = spec.pages[0] ?? { width: 100, height: 100, items: [] }
  const doc = createPdfDoc(fonts, first.width, first.height)
  doc.setCreationDate(pdfDate(spec.creationDate))
  doc.setFileId(spec.fileId)
  doc.setDocumentProperties({ title: spec.title, creator: 'Abla_rckF7_tac' })
  const ctx = pdfContext(doc)
  const mmPerPx = thumbMmPerPx(spec.layout, spec.theme)
  for (const [index, page] of spec.pages.entries()) {
    if (index > 0) {
      doc.addPage([page.width, page.height], page.width > page.height ? 'landscape' : 'portrait')
    }
    for (const item of page.items) {
      if (item.kind !== 'thumb') continue
      const play = spec.plays[item.play]
      const frame = spec.frames[item.play]
      if (!play || !frame) continue
      drawThumbnail(ctx, play, item.phaseId, item, frame, spec.theme, mmPerPx, settings, caches)
      doc.setDrawColor(THUMB_FRAME_COLOR)
      doc.setLineWidth(0.2)
      doc.setLineDashPattern([], 0)
      doc.rect(item.x, item.y, item.w, item.h, 'S')
    }
    for (const item of page.items) {
      if (item.kind !== 'text' || item.text === '') continue
      doc.setFont(PDF_FONT, item.bold ? 'bold' : 'normal')
      doc.setFontSize(item.size)
      doc.setTextColor(item.color)
      // Centred in its line box.
      const top = item.y + (lineHeight(item.size) - item.size * PT_TO_MM) / 2
      doc.text(item.text, item.x, top, { align: item.align, baseline: 'top' })
    }
    yield index + 1
  }
  // Links and bookmarks, once every target page exists.
  for (const [index, page] of spec.pages.entries()) {
    const links = page.items.filter((item) => item.kind === 'link')
    if (links.length === 0) continue
    doc.setPage(index + 1)
    for (const link of links) doc.link(link.x, link.y, link.w, link.h, { pageNumber: link.page })
  }
  for (const entry of spec.outline) doc.outline.add(null, entry.title, { pageNumber: entry.page })
  return new Uint8Array(doc.output('arraybuffer'))
}

/** The PDF of one play, or a playbook of several (SPEC 9.3, D-062 to D-064). */
export function* pdfExport(
  plays: readonly Play[],
  options: PdfOptions,
  book: BookOptions | null,
  fonts: PdfFonts,
  settings: EngineSettings,
  caches: EvalCaches,
): Generator<ExportProgress, ExportFile[]> {
  const measure = pdfMeasure(fonts)
  const theme = THEMES[options.color === 'bw' ? 'printBw' : 'printColor']
  const frames = plays.map((play) => linesFrame(play, allLines(play), settings, caches))
  const footer = book ? phoneFooterSpace() : 0
  const playPages = plays.map((play, i) => {
    const frame = frames[i] as Bounds
    return options.layout === 'print'
      ? layoutPlayPrint(play, i, frame, measure).pages
      : layoutPlayPhone(play, i, frame, measure, footer).pages
  })
  const creationDate = latestDate(plays.map((p) => p.updatedAt))
  const title = book
    ? book.title.trim() === ''
      ? EXPORT_TEXT.defaultBookTitle
      : book.title
    : (plays[0]?.name ?? '')
  const laidOut = book
    ? layoutBook(
        plays.map((play, i) => ({
          name: play.name,
          category: CATEGORY_LABELS[play.category],
          pages: playPages[i] ?? [],
        })),
        {
          title,
          subtitle: book.subtitle,
          date: frenchDate(creationDate),
        },
        options.layout,
        measure,
      )
    : { pages: playPages[0] ?? [], outline: [] }
  const spec: PdfDocument = {
    pages: laidOut.pages,
    outline: laidOut.outline,
    plays: [...plays],
    frames,
    theme,
    layout: options.layout,
    title,
    creationDate,
    fileId: pdfFileId({ plays, options, book }),
  }
  const total = spec.pages.length
  const steps = writePdf(spec, fonts, settings, caches)
  let step = steps.next()
  while (step.done !== true) {
    yield { stage: 'pages', done: step.value, total }
    step = steps.next()
  }
  return [
    {
      fileName: pdfFileName(title, {
        layout: options.layout,
        color: options.color,
        book: book !== null,
      }),
      mime: 'application/pdf',
      bytes: step.value,
    },
  ]
}
