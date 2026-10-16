// Page layout of the PDFs (SPEC 9.3, D-063), in millimetres. Pure: text widths come from a
// measuring function (the embedded font, through jsPDF), so that every page is computed before
// anything is written.
//
// « Impression » (A4 landscape): header (title, category, notes); a row for the trunk up to the
// first branch point included; then a row per option, titled by its condition, in tree order,
// full width; label and instruction under each thumbnail; a long row wraps; thumbnails from
// 90 mm down to 60 mm so that the play fits on one page, else continued on the next pages with
// the title reminded; a row is never split between two pages.
// « Téléphone »: pages 100 mm wide, as high as their content, one thumbnail per line.
import { PDF_LAYOUT, PDF_TEXT } from '../../config/defaults'
import type { Bounds } from '../../engine/bounds'
import {
  CATEGORY_LABELS,
  optionTitle,
  optionTitlesNeedPhase,
  phaseLabelOf,
} from '../../model/labels'
import { childrenOf, findPhase, rootPhase } from '../../model/phaseTree'
import type { Id, Play } from '../../model/types'
import { EXPORT_TEXT, exportText } from '../text'

export const PT_TO_MM = 25.4 / 72
const LINE_FACTOR = 1.25

export const TEXT_COLOR = '#000000'
export const MUTED_COLOR = '#555555'
/** Thin frame around the thumbnails. */
export const THUMB_FRAME_COLOR = '#9e9e9e'

/** Width in millimetres of a text in the embedded font. */
export type Measure = (text: string, sizePt: number, bold: boolean) => number

export function lineHeight(sizePt: number): number {
  return sizePt * PT_TO_MM * LINE_FACTOR
}

export type PageItem =
  | {
      kind: 'text'
      text: string
      /** Left, centre or right edge, depending on `align`. */
      x: number
      /** Top of the line box. */
      y: number
      size: number
      bold: boolean
      color: string
      align: 'left' | 'center' | 'right'
    }
  | { kind: 'thumb'; play: number; phaseId: Id; x: number; y: number; w: number; h: number }
  /** Internal link to a page (1-based), playbook contents (D-064). */
  | { kind: 'link'; x: number; y: number; w: number; h: number; page: number }

export interface PageSpec {
  width: number
  height: number
  items: PageItem[]
}

/** Shortens a text with an ellipsis until it fits `width`. */
export function ellipsize(
  text: string,
  width: number,
  size: number,
  bold: boolean,
  measure: Measure,
): string {
  if (measure(text, size, bold) <= width) return text
  let kept = text
  while (kept.length > 0 && measure(`${kept}…`, size, bold) > width) kept = kept.slice(0, -1)
  return `${kept.trimEnd()}…`
}

/**
 * Splits a text into lines of at most `width`, on spaces and line breaks (a no-break space keeps
 * its words together); beyond `maxLines`, the last line ends with an ellipsis.
 */
export function wrapLines(
  text: string,
  width: number,
  size: number,
  bold: boolean,
  measure: Measure,
  maxLines = Number.POSITIVE_INFINITY,
): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let current = ''
    for (const word of paragraph.split(/[ \t]+/)) {
      if (word === '') continue
      const candidate = current === '' ? word : `${current} ${word}`
      if (current === '' || measure(candidate, size, bold) <= width) current = candidate
      else {
        lines.push(current)
        current = word
      }
    }
    if (current !== '') lines.push(current)
  }
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = ellipsize(`${kept[maxLines - 1] ?? ''}…`, width, size, bold, measure)
  return kept
}

// ---------------------------------------------------------------------------
// Rows of thumbnails.

export interface ThumbSpec {
  phaseId: Id
  label: string
  instruction: string
}

export interface RowSpec {
  /** null for the trunk; « Option A : <condition> » for an option. */
  title: string | null
  thumbs: ThumbSpec[]
}

/** The trunk up to the first branch point included, then a row per option, in tree order. */
export function playRows(play: Play): RowSpec[] {
  const root = rootPhase(play)
  if (!root) return []
  const withPhase = optionTitlesNeedPhase(play)
  const seen = new Set<Id>()
  const rows: RowSpec[] = []
  const thumb = (id: Id): ThumbSpec => ({
    phaseId: id,
    label: exportText(phaseLabelOf(play, id)),
    instruction: exportText(findPhase(play, id)?.instruction ?? ''),
  })
  const walk = (startId: Id, title: string | null): void => {
    const thumbs: ThumbSpec[] = []
    let current: Id | undefined = startId
    let children: ReturnType<typeof childrenOf> = []
    while (current !== undefined && !seen.has(current)) {
      seen.add(current)
      thumbs.push(thumb(current))
      children = childrenOf(play, current)
      current = children.length === 1 ? children[0]?.id : undefined
    }
    rows.push({ title, thumbs })
    if (children.length >= 2) {
      for (const child of children) {
        if (!seen.has(child.id)) walk(child.id, exportText(optionTitle(play, child.id, withPhase)))
      }
    }
  }
  walk(root.id, null)
  return rows
}

/** Height / width of the thumbnails of a play: attack upwards, x along the height (D-063). */
export function thumbRatio(frame: Bounds): number {
  const dx = frame.max.x - frame.min.x
  const dy = Math.max(1e-6, frame.max.y - frame.min.y)
  return Math.min(PDF_LAYOUT.thumbRatio.max, Math.max(PDF_LAYOUT.thumbRatio.min, dx / dy))
}

// ---------------------------------------------------------------------------
// Blocks: pieces of a page of known height, placed at a vertical position.

interface Block {
  height: number
  place: (y: number) => PageItem[]
}

interface TextStyle {
  size: number
  bold: boolean
  color: string
}

/** Lines of text, left aligned at `x`. */
function textBlock(lines: readonly string[], x: number, style: TextStyle, after = 0): Block {
  const step = lineHeight(style.size)
  return {
    height: lines.length * step + (lines.length > 0 ? after : 0),
    place: (y) =>
      lines.map((text, i) => ({
        kind: 'text' as const,
        text,
        x,
        y: y + i * step,
        size: style.size,
        bold: style.bold,
        color: style.color,
        align: 'left' as const,
      })),
  }
}

function stack(blocks: readonly Block[]): Block {
  return {
    height: blocks.reduce((sum, b) => sum + b.height, 0),
    place: (y) => {
      const items: PageItem[] = []
      let cursor = y
      for (const block of blocks) {
        items.push(...block.place(cursor))
        cursor += block.height
      }
      return items
    },
  }
}

type Sizes = (typeof PDF_TEXT)['print'] | (typeof PDF_TEXT)['phone']

/** Title, category and notes of a play (SPEC 9.3). */
function playHeader(play: Play, x: number, width: number, sizes: Sizes, measure: Measure): Block {
  const title = exportText(play.name)
  const notes = exportText(play.notes)
  return stack([
    textBlock(wrapLines(title, width, sizes.title, true, measure, 2), x, {
      size: sizes.title,
      bold: true,
      color: TEXT_COLOR,
    }),
    textBlock([CATEGORY_LABELS[play.category]], x, {
      size: sizes.subtitle,
      bold: false,
      color: MUTED_COLOR,
    }),
    textBlock(
      wrapLines(notes, width, sizes.body, false, measure),
      x,
      { size: sizes.body, bold: false, color: TEXT_COLOR },
      1,
    ),
    { height: 3, place: () => [] },
  ])
}

/** Reminder of the title on a continuation page. */
function continuationHeader(
  play: Play,
  x: number,
  width: number,
  sizes: Sizes,
  measure: Measure,
): Block {
  const text = ellipsize(
    `${exportText(play.name)} ${EXPORT_TEXT.continued}`,
    width,
    sizes.rowTitle,
    true,
    measure,
  )
  return stack([
    textBlock([text], x, { size: sizes.rowTitle, bold: true, color: MUTED_COLOR }),
    { height: 3, place: () => [] },
  ])
}

/** A line of thumbnails with their label and instruction underneath. */
function thumbLine(
  playIndex: number,
  thumbs: readonly ThumbSpec[],
  x: number,
  w: number,
  h: number,
  gap: number,
  sizes: Sizes,
  measure: Measure,
): Block {
  const captions = thumbs.map((t) =>
    wrapLines(t.instruction, w, sizes.body, false, measure, PDF_LAYOUT.instructionMaxLines),
  )
  const captionLines = Math.max(0, ...captions.map((c) => c.length))
  const step = lineHeight(sizes.body)
  const captionGap = 1.5
  return {
    height: h + captionGap + step * (1 + captionLines),
    place: (y) =>
      thumbs.flatMap((t, i) => {
        const left = x + i * (w + gap)
        const label = ellipsize(t.label, w, sizes.body, true, measure)
        return [
          { kind: 'thumb' as const, play: playIndex, phaseId: t.phaseId, x: left, y, w, h },
          ...textBlock([label], left, { size: sizes.body, bold: true, color: TEXT_COLOR }).place(
            y + h + captionGap,
          ),
          ...textBlock(captions[i] ?? [], left, {
            size: sizes.body,
            bold: false,
            color: TEXT_COLOR,
          }).place(y + h + captionGap + step),
        ]
      }),
  }
}

/** Row title then its lines of thumbnails; `perLine` thumbnails at most per line. */
function rowBlocks(
  playIndex: number,
  row: RowSpec,
  x: number,
  w: number,
  h: number,
  perLine: number,
  sizes: Sizes,
  measure: Measure,
): Block[] {
  const gap = PDF_LAYOUT.thumbGap
  const lines: Block[] = []
  for (let i = 0; i < row.thumbs.length; i += perLine) {
    lines.push(thumbLine(playIndex, row.thumbs.slice(i, i + perLine), x, w, h, gap, sizes, measure))
  }
  const spaced = lines.map((line, i) =>
    i < lines.length - 1 ? { height: line.height + 4, place: line.place } : line,
  )
  if (row.title === null) return spaced
  const title = textBlock(
    [ellipsize(row.title, perLine * (w + gap), sizes.rowTitle, true, measure)],
    x,
    {
      size: sizes.rowTitle,
      bold: true,
      color: TEXT_COLOR,
    },
    1,
  )
  // The title stays with the first line of its row.
  const [first, ...rest] = spaced
  return first ? [stack([title, first]), ...rest] : [title]
}

// ---------------------------------------------------------------------------
// One play.

export interface PlayLayout {
  pages: PageSpec[]
  /** Thumbnail width chosen (90 mm down to 60 mm in print). */
  thumbWidth: number
}

const ROW_GAP = 5

/** « Impression » layout of a play (A4 landscape). */
export function layoutPlayPrint(
  play: Play,
  playIndex: number,
  frame: Bounds,
  measure: Measure,
): PlayLayout {
  const { width: W, height: H } = PDF_LAYOUT.print
  const m = PDF_LAYOUT.margin
  const contentW = W - 2 * m
  const bottom = H - m
  const sizes = PDF_TEXT.print
  const ratio = thumbRatio(frame)
  const rows = playRows(play)
  const header = playHeader(play, m, contentW, sizes, measure)
  const rowsAt = (w: number) => {
    const perLine = Math.max(
      1,
      Math.floor((contentW + PDF_LAYOUT.thumbGap) / (w + PDF_LAYOUT.thumbGap)),
    )
    return rows.map((row) => rowBlocks(playIndex, row, m, w, w * ratio, perLine, sizes, measure))
  }
  const heightOf = (blocks: Block[][]) =>
    blocks.reduce((sum, row) => sum + row.reduce((s, b) => s + b.height, 0), 0) +
    ROW_GAP * Math.max(0, blocks.length - 1)
  // Largest width, by steps of 1 mm, that holds the play on one page.
  let w: number = PDF_LAYOUT.thumbMin
  for (let candidate: number = PDF_LAYOUT.thumbMax; candidate >= PDF_LAYOUT.thumbMin; candidate--) {
    if (m + header.height + heightOf(rowsAt(candidate)) <= bottom) {
      w = candidate
      break
    }
  }
  const pages: PageSpec[] = []
  let page: PageSpec = { width: W, height: H, items: header.place(m) }
  let y = m + header.height
  let fresh = true
  const newPage = () => {
    pages.push(page)
    const reminder = continuationHeader(play, m, contentW, sizes, measure)
    page = { width: W, height: H, items: reminder.place(m) }
    y = m + reminder.height
    fresh = true
  }
  for (const row of rowsAt(w)) {
    const rowHeight = row.reduce((s, b) => s + b.height, 0)
    const gap = fresh ? 0 : ROW_GAP
    if (!fresh && y + gap + rowHeight > bottom) newPage()
    else y += gap
    // A row never splits, unless it is higher than a whole page: then between two lines.
    for (const block of row) {
      if (!fresh && y + block.height > bottom) newPage()
      page.items.push(...block.place(y))
      y += block.height
      fresh = false
    }
  }
  pages.push(page)
  return { pages, thumbWidth: w }
}

/** « Téléphone » layout of a play: 100 mm wide pages, as high as their content (D-063). */
export function layoutPlayPhone(
  play: Play,
  playIndex: number,
  frame: Bounds,
  measure: Measure,
  footerSpace = 0,
): PlayLayout {
  const W = PDF_LAYOUT.phoneWidth
  const m = PDF_LAYOUT.phoneMargin
  const contentW = W - 2 * m
  const sizes = PDF_TEXT.phone
  const w = contentW
  const blocks = playRows(play).flatMap((row) =>
    rowBlocks(playIndex, row, m, w, w * thumbRatio(frame), 1, sizes, measure).map((b, i, all) =>
      i === all.length - 1
        ? { height: b.height + ROW_GAP + 2, place: b.place }
        : { height: b.height + 2, place: b.place },
    ),
  )
  const header = playHeader(play, m, contentW, sizes, measure)
  const limit = PDF_LAYOUT.phoneMaxHeight - m - footerSpace
  const pages: PageSpec[] = []
  let items = header.place(m)
  let y = m + header.height
  let fresh = true
  for (const block of blocks) {
    if (!fresh && y + block.height > limit) {
      pages.push({ width: W, height: y + m + footerSpace, items })
      const reminder = continuationHeader(play, m, contentW, sizes, measure)
      items = reminder.place(m)
      y = m + reminder.height
    }
    items.push(...block.place(y))
    y += block.height
    fresh = false
  }
  pages.push({ width: W, height: y + m + footerSpace, items })
  return { pages, thumbWidth: w }
}
