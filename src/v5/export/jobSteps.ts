// Running an export job, step by step (worker, and tests in Node). Imports the encoders (gifenc,
// jsPDF): never imported by the page, so that they stay in the worker chunk.
import type { EvalCaches } from '../engine/caches'
import { gifExport } from './gif/encode'
import type { ExportJob } from './jobs'
import type { PdfFonts } from './pdf/pdfCtx'
import { pdfExport } from './pdf/write'
import type { ExportFile, ExportProgress, SurfaceFactory } from './types'

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
