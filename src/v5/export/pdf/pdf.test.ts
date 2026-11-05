// PDF export (SPEC 9.3, D-062 to D-064, D-071): layout computed with the embedded font, files
// written by jsPDF and read back by pdf.js.
import { describe, expect, it } from 'vitest'
import { createCaches } from '../../engine/caches'
import { allLines } from '../../model/branches'
import { defaultSettings, engineSettingsOf } from '../../../model/settings'
import type { Play } from '../../model/types'
import { THEMES } from '../../../render/themes'
import { basePlay, branch, ROOT_BRANCH, sevenVsSevenWithOptions, uuid } from '../../test/builders'
import {
  bookPlays,
  loadPdfFonts,
  threeOptionsPlay,
  twoBranchPointsPlay,
  TWO_POINTS,
} from '../../test/exportFixtures'
import { compareWithSnapshot } from '../../../test/imageSnapshot'
import {
  openPdf,
  pageLinks,
  pageSizeMm,
  pageText,
  pdfOutline,
  rasterize,
} from '../../../test/pdfInspect'
import { linesFrame } from '../framing'
import { LEGIBILITY } from '../../../config/defaults'
import type { BookOptions, ExportProgress, PdfOptions } from '../types'
import { frenchDate } from './book'
import {
  layoutPlayPhone,
  layoutPlayPrint,
  playRows,
  PT_TO_MM,
  thumbRatio,
  type PageItem,
  type PageSpec,
} from './layout'
import { createPdfDoc, pdfContext, pdfMeasure } from './pdfCtx'
import { drawThumbnail, thumbMmPerPx } from './thumbnail'
import { pdfExport } from './write'

/** Real encodings: several seconds on the CI runner, slower than a desktop computer. */
const ENCODING_TIMEOUT_MS = 60_000

const settings = engineSettingsOf(defaultSettings())
const fonts = loadPdfFonts()
const measure = pdfMeasure(fonts)
const fixture = sevenVsSevenWithOptions()
const PRINT: PdfOptions = { layout: 'print', color: 'color' }

const frameOf = (play: Play) => linesFrame(play, allLines(play), settings, createCaches())

function runPdf(plays: Play[], options: PdfOptions, book: BookOptions | null = null) {
  const progress: ExportProgress[] = []
  const steps = pdfExport(plays, options, book, fonts, settings, createCaches())
  let step = steps.next()
  while (step.done !== true) {
    progress.push(step.value)
    step = steps.next()
  }
  const [file] = step.value
  if (!file) throw new Error('no PDF')
  return { file, progress }
}

type Thumb = Extract<PageItem, { kind: 'thumb' }>
type Text = Extract<PageItem, { kind: 'text' }>
const thumbsOf = (page: PageSpec): Thumb[] =>
  page.items.filter((i): i is Thumb => i.kind === 'thumb')
const textsOf = (page: PageSpec): Text[] => page.items.filter((i): i is Text => i.kind === 'text')
const firstPage = (pages: PageSpec[]): PageSpec => {
  const page = pages[0]
  if (!page) throw new Error('no page')
  return page
}

/** A play of `count` lines: as many options at one branch point. */
function linesPlay(count: number, name: string, id = uuid(8000)): Play {
  const options = Array.from({ length: count }, (_, i) =>
    branch(uuid(700 + i), ROOT_BRANCH, { condition: `Cas ${i + 1}`, isDefault: i === 0 }),
  )
  return basePlay({
    id,
    name,
    branches: [branch(ROOT_BRANCH, null, { branchAt: 1 }), ...options],
  })
}

describe('PDF rows (frise-1, SPEC 9.3, D-063)', () => {
  it('makes a single row, one thumbnail per line, the options of the line as its legend', () => {
    expect(playRows(fixture)).toEqual([
      {
        title: null,
        thumbs: allLines(fixture).map((line, i) => ({
          line,
          label: ['Option A : Défense en retrait', 'Option B : Défense montée'][i],
          instruction: '',
        })),
      },
    ])
    const { root, large, tight, deep, rising } = TWO_POINTS
    const [row] = playRows(twoBranchPointsPlay())
    expect(row?.thumbs.map((t) => [t.line, t.label])).toEqual([
      [[root, large, deep], 'Option A : Large ; Option A'],
      [[root, large, rising], 'Option A : Large ; Option B : Montée'],
      [[root, tight], 'Option B : Serré'],
    ])
  })

  it('gives no legend to the only line of a play', () => {
    expect(playRows(basePlay())[0]?.thumbs[0]?.label).toBe('')
  })

  it('bounds the height / width ratio of the thumbnails between 0.45 and 1', () => {
    expect(thumbRatio({ min: { x: 0, y: 0 }, max: { x: 10, y: 100 } })).toBe(0.45)
    expect(thumbRatio({ min: { x: 0, y: 0 }, max: { x: 100, y: 10 } })).toBe(1)
    expect(thumbRatio({ min: { x: 0, y: 0 }, max: { x: 35, y: 70 } })).toBe(0.5)
  })
})

describe('PDF print layout (SPEC 9.3, D-063)', () => {
  it('holds the fixture on one A4 landscape page, the options of the line under each thumbnail', () => {
    const frame = frameOf(fixture)
    const { pages, thumbWidth } = layoutPlayPrint(fixture, 0, frame, measure)
    expect(pages).toHaveLength(1)
    expect(thumbWidth).toBe(90)
    const page = firstPage(pages)
    expect([page.width, page.height]).toEqual([297, 210])
    const thumbs = thumbsOf(page)
    expect(thumbs).toHaveLength(2)
    for (const thumb of thumbs) {
      expect(thumb.w).toBe(90)
      expect(thumb.h).toBeCloseTo(90 * thumbRatio(frame), 9)
      expect(thumb.x).toBeGreaterThanOrEqual(10)
      expect(thumb.x + thumb.w).toBeLessThanOrEqual(287 + 1e-9)
      expect(thumb.y + thumb.h).toBeLessThanOrEqual(200)
      const label = textsOf(page).find(
        (t) => t.x === thumb.x && t.y > thumb.y + thumb.h && t.y < thumb.y + thumb.h + 3,
      )
      expect(label?.bold).toBe(true)
    }
    const texts = textsOf(page).map((t) => t.text)
    for (const expected of [
      'Croisée au centre',
      'Ruck / jeu courant',
      'Option A : Défense en retrait',
      'Option B : Défense montée',
    ]) {
      expect(texts).toContain(expected)
    }
    expect(thumbs[0]?.x).toBe(10)
  })

  it('wraps a long legend under its thumbnail, never over the next line of thumbnails', () => {
    const play: Play = {
      ...linesPlay(7, 'Longues conditions'),
      branches: [
        branch(ROOT_BRANCH, null, { branchAt: 1 }),
        ...Array.from({ length: 7 }, (_, i) =>
          branch(uuid(700 + i), ROOT_BRANCH, {
            condition: 'Une condition assez longue pour tenir sur plusieurs lignes',
            isDefault: i === 0,
          }),
        ),
      ],
    }
    const { pages } = layoutPlayPrint(play, 0, frameOf(play), measure)
    const page = firstPage(pages)
    const thumbs = thumbsOf(page)
    const rowsY = [...new Set(thumbs.map((t) => t.y))]
    expect(rowsY.length).toBeGreaterThan(1)
    const first = thumbs[0]
    if (!first) throw new Error('no thumbnail')
    const legend = textsOf(page).filter(
      (t) => t.x === first.x && t.y > first.y && t.y < (rowsY[1] ?? 0),
    )
    expect(legend.length).toBeGreaterThan(1)
    for (const text of legend) expect(text.bold).toBe(true)
  })

  it('wraps a long row and reduces the thumbnails to keep the play on one page', () => {
    const play = linesPlay(7, 'Longue combinaison')
    const { pages, thumbWidth } = layoutPlayPrint(play, 0, frameOf(play), measure)
    expect(pages).toHaveLength(1)
    expect(thumbWidth).toBeLessThan(90)
    expect(thumbWidth).toBeGreaterThanOrEqual(60)
    const thumbs = thumbsOf(firstPage(pages))
    expect(thumbs).toHaveLength(7)
    expect(new Set(thumbs.map((t) => t.y)).size).toBeGreaterThan(1)
  })

  it('continues on new pages at 60 mm, with the title, between two lines of thumbnails', () => {
    const play = linesPlay(20, 'Vingt options')
    const { pages, thumbWidth } = layoutPlayPrint(play, 0, frameOf(play), measure)
    expect(thumbWidth).toBe(60)
    expect(pages.length).toBeGreaterThan(1)
    for (const page of pages.slice(1)) {
      expect(textsOf(page)[0]?.text).toBe('Vingt options (suite)')
    }
    expect(pages.flatMap(thumbsOf)).toHaveLength(allLines(play).length)
    for (const page of pages) {
      for (const thumb of thumbsOf(page)) expect(thumb.y + thumb.h).toBeLessThanOrEqual(200)
    }
  })
})

describe('PDF phone layout (SPEC 9.3, D-061, D-063)', () => {
  it('stacks the thumbnails in one column on 100 mm pages as high as their content', () => {
    const { pages } = layoutPlayPhone(fixture, 0, frameOf(fixture), measure)
    expect(pages).toHaveLength(1)
    const page = firstPage(pages)
    expect(page.width).toBe(100)
    const thumbs = thumbsOf(page)
    expect(thumbs.map((t) => t.line)).toEqual(allLines(fixture))
    for (const thumb of thumbs) {
      expect([thumb.x, thumb.w]).toEqual([5, 90])
    }
    const ys = thumbs.map((t) => t.y)
    expect([...ys].sort((a, b) => a - b)).toEqual(ys)
    const bottom = Math.max(...page.items.map((i) => i.y))
    expect(page.height).toBeGreaterThan(bottom)
    expect(page.height).toBeLessThan(bottom + 20)
  })

  it('writes every text, token numbers included, at the legible size on a phone', () => {
    const minPt = (LEGIBILITY.minTextMm * 100) / LEGIBILITY.phoneWidthMm / PT_TO_MM
    const { pages } = layoutPlayPhone(threeOptionsPlay(), 0, frameOf(threeOptionsPlay()), measure)
    for (const text of pages.flatMap(textsOf)) expect(text.size).toBeGreaterThanOrEqual(minPt)
    for (const theme of [THEMES.printColor, THEMES.printBw]) {
      // The jsPDF context floors the size in points (D-071).
      const tokenPt = Math.floor((theme.tokenFontSize * thumbMmPerPx('phone', theme)) / PT_TO_MM)
      expect(tokenPt).toBeGreaterThanOrEqual(minPt)
    }
  })
})

describe('PDF files (SPEC 9.3, D-064, D-071)', { timeout: ENCODING_TIMEOUT_MS }, () => {
  it('writes the same vector PDF twice, with its texts and the embedded font', async () => {
    const first = runPdf([fixture], PRINT)
    const second = runPdf([fixture], PRINT)
    expect(first.file.fileName).toBe('croisee-au-centre--impression.pdf')
    expect(first.file.mime).toBe('application/pdf')
    expect(Buffer.compare(Buffer.from(first.file.bytes), Buffer.from(second.file.bytes))).toBe(0)
    expect(first.progress.map((p) => p.done)).toEqual([1])
    const raw = Buffer.from(first.file.bytes).toString('latin1')
    expect(raw).not.toContain('/Subtype /Image')
    expect(raw).toContain('/FontFile2')
    expect(raw).toContain('/ToUnicode')
    const doc = await openPdf(first.file.bytes)
    expect(doc.numPages).toBe(1)
    const [w, h] = await pageSizeMm(doc, 1)
    expect(w).toBeCloseTo(297, 1)
    expect(h).toBeCloseTo(210, 1)
    const text = await pageText(doc, 1)
    for (const expected of [
      'Croisée au centre',
      'Option B : Défense montée',
      'Option A : Défense en retrait',
    ]) {
      expect(text).toContain(expected)
    }
  })

  it('keeps accents, the typographic apostrophe and guillemets in the text (SPEC 9.3)', async () => {
    const { file } = runPdf([threeOptionsPlay()], PRINT)
    const doc = await openPdf(file.bytes)
    expect(doc.numPages).toBe(1)
    const text = await pageText(doc, 1)
    for (const expected of [
      'Trois options « au large »',
      'l’option dépend de la « défense »',
      'Œil',
      'Option C : Défense glissée',
    ]) {
      expect(text).toContain(expected)
    }
  })

  it('writes the phone layout in black and white', async () => {
    const { file } = runPdf([fixture], { layout: 'phone', color: 'bw' })
    expect(file.fileName).toBe('croisee-au-centre--telephone-nb.pdf')
    const doc = await openPdf(file.bytes)
    const [w, h] = await pageSizeMm(doc, 1)
    expect(w).toBeCloseTo(100, 1)
    expect(h).toBeGreaterThan(100)
  })

  it('makes a playbook of five plays: title page, contents, links, page numbers, bookmarks', async () => {
    const plays = bookPlays()
    const book = { title: 'Cahier de jeu', subtitle: 'Sélection' }
    const { file } = runPdf(plays, PRINT, book)
    expect(file.fileName).toBe('cahier-de-jeu--cahier-impression.pdf')
    const playPages = plays.map(
      (play, i) => layoutPlayPrint(play, i, frameOf(play), measure).pages.length,
    )
    const doc = await openPdf(file.bytes)
    expect(doc.numPages).toBe(1 + 1 + playPages.reduce((a, b) => a + b, 0))
    const starts: number[] = []
    let next = 3
    for (const count of playPages) {
      starts.push(next)
      next += count
    }
    const title = await pageText(doc, 1)
    for (const expected of ['Cahier de jeu', 'Sélection', '5 combinaisons', '15 octobre 2026']) {
      expect(title).toContain(expected)
    }
    const contents = await pageText(doc, 2)
    expect(contents).toContain('Sommaire')
    const links = await pageLinks(doc, 2)
    expect(links.map((l) => l.page)).toEqual(starts)
    for (const [i, play] of plays.entries()) {
      expect(contents).toContain(play.name.slice(0, 12))
      expect(contents).toContain(String(starts[i]))
      expect(await pageText(doc, starts[i] ?? 0)).toContain(play.name)
    }
    for (let page = 2; page <= doc.numPages; page++) {
      expect((await pageText(doc, page)).split(' ')).toContain(String(page))
    }
    expect(await pdfOutline(doc)).toEqual(plays.map((p, i) => ({ title: p.name, page: starts[i] })))
  })

  it('makes a phone playbook with the same links', async () => {
    const plays = bookPlays()
    const { file } = runPdf(
      plays,
      { layout: 'phone', color: 'bw' },
      {
        title: 'Mêlées',
        subtitle: 'Mêlée',
      },
    )
    expect(file.fileName).toBe('melees--cahier-telephone-nb.pdf')
    const doc = await openPdf(file.bytes)
    expect((await pageLinks(doc, 2)).map((l) => l.page)).toEqual(
      (await pdfOutline(doc)).map((o) => o.page),
    )
    expect(doc.numPages).toBeGreaterThanOrEqual(2 + plays.length)
  })

  it('formats the playbook date in French', () => {
    expect(frenchDate('2026-10-15T18:45:00.000Z')).toBe('15 octobre 2026')
    expect(frenchDate('2026-03-01T08:00:00.000Z')).toBe('1er mars 2026')
  })
})

describe('PDF thumbnail reference images (D-062, D-071)', { timeout: ENCODING_TIMEOUT_MS }, () => {
  for (const themeId of ['highContrast', 'printColor', 'printBw'] as const) {
    it(`rasterises a vector thumbnail of option B in theme ${themeId}`, async () => {
      const frame = frameOf(fixture)
      const line = allLines(fixture)[1] ?? []
      const w = 90
      const h = w * thumbRatio(frame)
      const doc = createPdfDoc(fonts, w, h)
      const theme = THEMES[themeId]
      drawThumbnail(
        pdfContext(doc),
        fixture,
        line,
        { x: 0, y: 0, w, h },
        frame,
        theme,
        thumbMmPerPx('print', theme),
        settings,
        createCaches(),
      )
      const bytes = new Uint8Array(doc.output('arraybuffer'))
      const canvas = await rasterize(await openPdf(bytes), 1, 6)
      const result = await compareWithSnapshot(canvas, `v5-pdf-thumbnail-${themeId}`)
      expect(result.pass, result.message).toBe(true)
    })
  }
})
