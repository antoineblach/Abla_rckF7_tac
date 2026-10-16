// Export file names: <nom-court>--<variante>.<ext> (SPEC 9.1, D-066). Two different variants
// never share a name; an existing file gets a numbered suffix only on « Garder les deux » (D-065).
import { childrenOf, isBranchPoint } from '../model/phaseTree'
import type {
  ExportOrientation,
  GifQuality,
  GifSpeedMode,
  PdfColor,
  PdfLayout,
} from '../model/settings'
import { shortName } from '../model/shortName'
import type { Id, Play } from '../model/types'

const ORIENTATION_SLUG: Record<ExportOrientation, string> = {
  portrait: 'portrait',
  landscape: 'paysage',
  square: 'carre',
}

const SPEED_SLUG: Record<GifSpeedMode, string> = { both: '', slow: '-ralenti', real: '-reel' }

/** Lines of a GIF: the only line of the play, every line chained, or one leaf. */
export type GifLines =
  { kind: 'single' } | { kind: 'chained' } | { kind: 'leaf'; letters: readonly string[] }

export interface GifNameOptions {
  orientation: ExportOrientation
  quality: GifQuality
  lines: GifLines
  speed: GifSpeedMode
  /** « Version allégée » (D-067): its own name, so that it never replaces the full GIF (D-074). */
  light?: boolean
}

/** Letters of the options chosen along a line, from the root (« -option-a-b »). */
export function leafLetters(play: Play, line: readonly Id[]): string[] {
  const letters: string[] = []
  for (let i = 1; i < line.length; i++) {
    const parent = line[i - 1]
    const id = line[i]
    if (parent === undefined || id === undefined || !isBranchPoint(play, parent)) continue
    const index = childrenOf(play, parent).findIndex((child) => child.id === id)
    letters.push(String.fromCharCode(97 + Math.max(0, index)))
  }
  return letters
}

export function gifVariant(options: GifNameOptions): string {
  const lines =
    options.lines.kind === 'chained'
      ? '-enchaine'
      : options.lines.kind === 'leaf' && options.lines.letters.length > 0
        ? `-option-${options.lines.letters.join('-')}`
        : ''
  const quality = options.quality === 'high' && options.light !== true ? '-hd' : ''
  const light = options.light === true ? '-allege' : ''
  return `${ORIENTATION_SLUG[options.orientation]}${quality}${lines}${SPEED_SLUG[options.speed]}${light}`
}

export function gifFileName(playName: string, options: GifNameOptions): string {
  return `${shortName(playName)}--${gifVariant(options)}.gif`
}

export interface PdfNameOptions {
  layout: PdfLayout
  color: PdfColor
  /** Playbook (cahier de jeu): the name is the short name of its title. */
  book: boolean
}

export function pdfVariant(options: PdfNameOptions): string {
  const layout = options.layout === 'print' ? 'impression' : 'telephone'
  return `${options.book ? 'cahier-' : ''}${layout}${options.color === 'bw' ? '-nb' : ''}`
}

export function pdfFileName(name: string, options: PdfNameOptions): string {
  return `${shortName(name)}--${pdfVariant(options)}.pdf`
}

/** « Garder les deux »: `name--variant.gif` becomes `name--variant-2.gif` (D-065). */
export function numberedFileName(fileName: string, n: number): string {
  const dot = fileName.lastIndexOf('.')
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName
  const extension = dot > 0 ? fileName.slice(dot) : ''
  return `${stem}-${n}${extension}`
}
