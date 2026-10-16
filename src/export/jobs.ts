// An export job: what the page asks the export worker to produce (SPEC 9). Plain data, sent by
// structured clone. Its file names are known before encoding, so that existing exports are
// checked before the wait (D-065). Light module: the page imports it, while the encoders (gifenc,
// jsPDF) are imported by jobSteps.ts, in the worker only.
import type { EngineSettings } from '../model/settings'
import type { Play } from '../model/types'
import { gifTargets } from './gif/timeline'
import { gifFileName, leafLetters, pdfFileName, type GifLines } from './names'
import { EXPORT_TEXT } from './text'
import type { BookOptions, GifOptions, PdfOptions } from './types'

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
