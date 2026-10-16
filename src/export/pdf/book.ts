// Playbook (« cahier de jeu », SPEC 9.3, D-064): title page, contents with page numbers and
// internal links, every play on a new page, page number at the foot of every page except the
// title page, a bookmark per play. Laid out in two passes: the plays first, then the contents,
// whose length depends only on the number of plays.
import { PDF_LAYOUT, PDF_TEXT } from '../../config/defaults'
import type { PdfLayout } from '../../model/settings'
import { EXPORT_TEXT, exportText } from '../text'
import {
  ellipsize,
  lineHeight,
  MUTED_COLOR,
  TEXT_COLOR,
  wrapLines,
  type Measure,
  type PageItem,
  type PageSpec,
} from './layout'

export interface BookEntry {
  name: string
  category: string
  /** Pages of the play, laid out with the footer space of a playbook. */
  pages: PageSpec[]
}

export interface BookTitle {
  title: string
  /** Category label or « Sélection ». */
  subtitle: string
  /** Most recent modification date of the plays, already formatted (D-064). */
  date: string
}

export interface BookLayout {
  pages: PageSpec[]
  /** Bookmarks: one per play, on its first page (1-based). */
  outline: { title: string; page: number }[]
}

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

/** « 14 octobre 2026 », « 1er mars 2026 », from the date part of an ISO 8601 date (UTC). */
export function frenchDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return iso
  const day = Number(match[3])
  return `${day === 1 ? '1er' : String(day)} ${MONTHS[Number(match[2]) - 1] ?? ''} ${match[1]}`
}

/** Most recent of ISO 8601 dates (they compare as strings when written by the tool). */
export function latestDate(dates: readonly string[]): string {
  return dates.reduce((latest, d) => (d > latest ? d : latest), '')
}

/** Room kept at the bottom of a phone page of a playbook for its page number. */
export function phoneFooterSpace(): number {
  return lineHeight(PDF_TEXT.phone.footer) + 2
}

function centred(
  text: string,
  x: number,
  y: number,
  size: number,
  bold: boolean,
  color = TEXT_COLOR,
): PageItem {
  return { kind: 'text', text, x, y, size, bold, color, align: 'center' }
}

function titlePage(book: BookTitle, count: number, layout: PdfLayout, measure: Measure): PageSpec {
  const sizes = PDF_TEXT[layout]
  const width = layout === 'print' ? PDF_LAYOUT.print.width : PDF_LAYOUT.phoneWidth
  const margin = layout === 'print' ? PDF_LAYOUT.margin : PDF_LAYOUT.phoneMargin
  const contentW = width - 2 * margin
  const titleLines = wrapLines(exportText(book.title), contentW, sizes.bookTitle, true, measure, 3)
  const lines: { text: string; size: number; bold: boolean; color: string; after: number }[] = [
    ...titleLines.map((text, i) => ({
      text,
      size: sizes.bookTitle,
      bold: true,
      color: TEXT_COLOR,
      after: i === titleLines.length - 1 ? 4 : 0,
    })),
    {
      text: exportText(book.subtitle),
      size: sizes.bookSubtitle,
      bold: false,
      color: TEXT_COLOR,
      after: 2,
    },
    {
      text: EXPORT_TEXT.playCount(count),
      size: sizes.subtitle,
      bold: false,
      color: MUTED_COLOR,
      after: 0,
    },
    { text: book.date, size: sizes.subtitle, bold: false, color: MUTED_COLOR, after: 0 },
  ].filter((l) => l.text !== '')
  const blockHeight = lines.reduce((sum, l) => sum + lineHeight(l.size) + l.after, 0)
  const height = layout === 'print' ? PDF_LAYOUT.print.height : blockHeight + 2 * 20
  let y = (height - blockHeight) / 2
  const items: PageItem[] = []
  for (const line of lines) {
    items.push(
      centred(
        ellipsize(line.text, contentW, line.size, line.bold, measure),
        width / 2,
        y,
        line.size,
        line.bold,
        line.color,
      ),
    )
    y += lineHeight(line.size) + line.after
  }
  return { width, height, items }
}

interface ContentsLine {
  height: number
  place: (y: number, page: number) => PageItem[]
}

function contentsLines(
  entries: readonly BookEntry[],
  layout: PdfLayout,
  measure: Measure,
): ContentsLine[] {
  const sizes = PDF_TEXT[layout]
  const size = layout === 'print' ? sizes.subtitle : sizes.body
  const width = layout === 'print' ? PDF_LAYOUT.print.width : PDF_LAYOUT.phoneWidth
  const m = layout === 'print' ? PDF_LAYOUT.margin : PDF_LAYOUT.phoneMargin
  const contentW = width - 2 * m
  const step = lineHeight(size)
  return entries.map((entry) => {
    const name = exportText(entry.name)
    const category = exportText(entry.category)
    if (layout === 'print') {
      // Name, category and page number on one line.
      const height = step + 1.6
      return {
        height,
        place: (y, page) => [
          {
            kind: 'text',
            text: ellipsize(name, contentW * 0.55, size, true, measure),
            x: m,
            y,
            size,
            bold: true,
            color: TEXT_COLOR,
            align: 'left',
          },
          {
            kind: 'text',
            text: ellipsize(category, contentW * 0.3, size, false, measure),
            x: m + contentW * 0.6,
            y,
            size,
            bold: false,
            color: MUTED_COLOR,
            align: 'left',
          },
          {
            kind: 'text',
            text: String(page),
            x: width - m,
            y,
            size,
            bold: true,
            color: TEXT_COLOR,
            align: 'right',
          },
          { kind: 'link', x: m, y, w: contentW, h: step, page },
        ],
      }
    }
    // Phone: name (two lines at most) with the page number, category underneath.
    const nameLines = wrapLines(name, contentW - 14, size, true, measure, 2)
    const height = step * (nameLines.length + 1) + 3
    return {
      height,
      place: (y, page) => [
        ...nameLines.map((text, i): PageItem => ({
          kind: 'text',
          text,
          x: m,
          y: y + i * step,
          size,
          bold: true,
          color: TEXT_COLOR,
          align: 'left',
        })),
        {
          kind: 'text',
          text: String(page),
          x: width - m,
          y,
          size,
          bold: true,
          color: TEXT_COLOR,
          align: 'right',
        },
        {
          kind: 'text',
          text: ellipsize(category, contentW, size, false, measure),
          x: m,
          y: y + nameLines.length * step,
          size,
          bold: false,
          color: MUTED_COLOR,
          align: 'left',
        },
        { kind: 'link', x: m, y, w: contentW, h: step * (nameLines.length + 1), page },
      ],
    }
  })
}

/** Splits the contents into pages: the lines, the heading on each page, the pages' heights. */
function paginateContents(
  lines: readonly ContentsLine[],
  layout: PdfLayout,
): { lines: number[]; height: number }[] {
  const sizes = PDF_TEXT[layout]
  const m = layout === 'print' ? PDF_LAYOUT.margin : PDF_LAYOUT.phoneMargin
  const headingHeight = lineHeight(sizes.title) + 4
  const footer = layout === 'print' ? 0 : phoneFooterSpace()
  const limit =
    (layout === 'print' ? PDF_LAYOUT.print.height : PDF_LAYOUT.phoneMaxHeight) - m - footer
  const pages: { lines: number[]; height: number }[] = []
  let current: number[] = []
  let y = m + headingHeight
  lines.forEach((line, i) => {
    if (current.length > 0 && y + line.height > limit) {
      pages.push({ lines: current, height: y })
      current = []
      y = m + headingHeight
    }
    current.push(i)
    y += line.height
  })
  pages.push({ lines: current, height: y })
  return pages.map((p) => ({
    lines: p.lines,
    height: layout === 'print' ? PDF_LAYOUT.print.height : p.height + m + footer,
  }))
}

export function layoutBook(
  entries: readonly BookEntry[],
  book: BookTitle,
  layout: PdfLayout,
  measure: Measure,
): BookLayout {
  const sizes = PDF_TEXT[layout]
  const width = layout === 'print' ? PDF_LAYOUT.print.width : PDF_LAYOUT.phoneWidth
  const m = layout === 'print' ? PDF_LAYOUT.margin : PDF_LAYOUT.phoneMargin
  const lines = contentsLines(entries, layout, measure)
  const contentsPages = paginateContents(lines, layout)
  // Pass 2: first page of every play, now that the contents length is known.
  const starts: number[] = []
  let next = 1 + contentsPages.length + 1
  for (const entry of entries) {
    starts.push(next)
    next += entry.pages.length
  }
  const pages: PageSpec[] = [titlePage(book, entries.length, layout, measure)]
  contentsPages.forEach((contents, index) => {
    const heading =
      index === 0 ? EXPORT_TEXT.contents : `${EXPORT_TEXT.contents} ${EXPORT_TEXT.continued}`
    const items: PageItem[] = [
      {
        kind: 'text',
        text: heading,
        x: m,
        y: m,
        size: sizes.title,
        bold: true,
        color: TEXT_COLOR,
        align: 'left',
      },
    ]
    let y = m + lineHeight(sizes.title) + 4
    for (const i of contents.lines) {
      const line = lines[i]
      if (!line) continue
      items.push(...line.place(y, starts[i] ?? 1))
      y += line.height
    }
    pages.push({ width, height: contents.height, items })
  })
  for (const entry of entries)
    pages.push(...entry.pages.map((p) => ({ ...p, items: [...p.items] })))
  // Page numbers at the foot of every page but the title page.
  pages.forEach((page, i) => {
    if (i === 0) return
    page.items.push({
      kind: 'text',
      text: String(i + 1),
      x: page.width / 2,
      y:
        page.height -
        (layout === 'print' ? PDF_LAYOUT.margin / 2 + 1 : 2) -
        lineHeight(sizes.footer),
      size: sizes.footer,
      bold: false,
      color: MUTED_COLOR,
      align: 'center',
    })
  })
  return {
    pages,
    outline: entries.map((entry, i) => ({ title: exportText(entry.name), page: starts[i] ?? 1 })),
  }
}
