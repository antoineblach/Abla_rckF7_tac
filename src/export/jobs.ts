// An export job: what the page asks the export worker to produce (SPEC 9). Plain data, sent by
// structured clone. Its file names are known before encoding, so that existing exports are
// checked before the wait (D-065).
import type { EvalCaches } from '../engine/caches'
import { leafLetters, gifFileName, pdfFileName, type GifLines } from './names'
import type { EngineSettings } from '../model/settings'
import type { Play } from '../model/types'
import { gifExport } from './gif/encode'
import { gifTargets } from './gif/timeline'
import type { PdfFonts } from './pdf/pdfCtx'
import { pdfExport } from './pdf/write'
import { EXPORT_TEXT } from './text'
import type {
  BookOptions,
  ExportFile,
  ExportProgress,
  GifOptions,
  PdfOptions,
  SurfaceFactory,
} from './types'

export type ExportJob =
  | { kind: 'gif'; play: Play; settings: EngineSettings; options: GifOptions }
  | {
      kind: 'pdf'
      plays: Play[]
      settings: EngineSettings
      options: PdfOptions
      /** null: the PDF of one play, without title page nor contents (D-064). */
      book: BookOptions | null
    }

/** Names of the files a job writes, in order. */
export function expectedFileNames(job: ExportJob): string[] {
  if (job.kind === 'gif') {
    return gifTargets(job.play, job.options.lines).map((target) => {
      const lines: GifLines =
        target.kind === 'leaf'
          ? { kind: 'leaf', letters: leafLetters(job.play, target.lines[0] ?? []) }
          : { kind: target.kind }
      return gifFileName(job.play.name, { ...job.options, lines })
    })
  }
  const title = job.book
    ? job.book.title.trim() === ''
      ? EXPORT_TEXT.defaultBookTitle
      : job.book.title
    : (job.plays[0]?.name ?? '')
  return [pdfFileName(title, { ...job.options, book: job.book !== null })]
}

/** Resources a job needs where it runs (worker or tests). */
export interface ExportResources {
  createSurface: SurfaceFactory
  pdfFonts: PdfFonts | null
}

/** The steps of a job: one per image or page, the files at the end. */
export function jobSteps(
  job: ExportJob,
  resources: ExportResources,
  caches: EvalCaches,
): Generator<ExportProgress, ExportFile[]> {
  if (job.kind === 'gif') {
    return gifExport(job.play, job.options, job.settings, caches, resources.createSurface)
  }
  if (!resources.pdfFonts) throw new Error('The PDF font is not loaded')
  return pdfExport(job.plays, job.options, job.book, resources.pdfFonts, job.settings, caches)
}
