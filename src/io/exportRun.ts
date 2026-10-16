// Running an export (SPEC 9.1, D-065): existing exports checked before the encoding (no surprise
// after the wait), encoding by the engine (worker) with progress and cancellation, then writing
// in exports/ (existence checked again) or downloading. Only this module writes, and only after
// the engine is done: a cancelled export never leaves a file. The final write (under a second)
// cannot be cancelled: `onSaving` lets the interface show « Enregistrement… ».
import type { ExportJob } from '../export/jobs'
import { expectedFileNames } from '../export/jobs'
import type { ExportFile, ExportProgress } from '../export/types'
import type { ExportEngine } from '../export/worker/engine'
import {
  ExportExistsError,
  existingExports,
  writeExports,
  type ExistingChoice,
  type WrittenExport,
} from './exportsFolder'
import type { FsDirectoryHandle } from './fs/types'

export type ExportTarget = { kind: 'folder'; root: FsDirectoryHandle } | { kind: 'download' }

export type ExistingDecision = ExistingChoice | 'cancel'

export interface ExportRunDeps {
  engine: ExportEngine
  target: ExportTarget
  now: () => Date
  /** « Remplacer », « Garder les deux » or « Annuler », for exports already present. */
  confirmExisting: (fileNames: string[]) => Promise<ExistingDecision>
  onProgress: (progress: ExportProgress) => void
  onSaving: () => void
  download: (file: ExportFile) => void
}

export type ExportRunResult =
  | { kind: 'written'; location: 'folder' | 'download'; files: WrittenExport[] }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string }

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))

export async function runExport(job: ExportJob, deps: ExportRunDeps): Promise<ExportRunResult> {
  const decisions = new Map<string, ExistingChoice>()
  const decide = async (names: string[]): Promise<boolean> => {
    const decision = await deps.confirmExisting(names)
    if (decision === 'cancel') return false
    for (const name of names) decisions.set(name, decision)
    return true
  }
  if (deps.target.kind === 'folder') {
    try {
      const present = await existingExports(deps.target.root, expectedFileNames(job))
      if (present.length > 0 && !(await decide(present))) return { kind: 'cancelled' }
    } catch (error) {
      return { kind: 'error', message: message(error) }
    }
  }
  const result = await deps.engine.run(job, deps.onProgress)
  if (result.kind !== 'done') return result
  deps.onSaving()
  if (deps.target.kind === 'download') {
    for (const file of result.files) deps.download(file)
    return {
      kind: 'written',
      location: 'download',
      files: result.files.map((f) => ({
        fileName: f.fileName,
        size: f.bytes.length,
        replaced: false,
      })),
    }
  }
  const root = deps.target.root
  // Checked again at writing: a file that appeared meanwhile is never overwritten silently.
  for (;;) {
    try {
      const files = await writeExports(root, result.files, decisions, deps.now())
      return { kind: 'written', location: 'folder', files }
    } catch (error) {
      if (!(error instanceof ExportExistsError)) return { kind: 'error', message: message(error) }
      if (!(await decide(error.fileNames))) return { kind: 'cancelled' }
    }
  }
}
