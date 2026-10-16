// Export state (Zustand): dialog shown, running export and its progress, question about exports
// already present, outcome with the sizes (SPEC 9.1, 9.2). The logic is in exportSession.ts.
import { create } from 'zustand'
import type { ExportProgress } from '../export/types'
import type { WrittenExport } from '../io/exportsFolder'

export type ExportKind = 'gif' | 'pdf' | 'book'

export interface RunningExport {
  kind: ExportKind
  progress: ExportProgress | null
  /** Final writing (under a second, not cancellable): « Enregistrement… ». */
  saving: boolean
  cancelling: boolean
}

export interface ExportOutcome {
  kind: ExportKind
  location: 'folder' | 'download'
  files: WrittenExport[]
  /** A GIF above the weight warning (SPEC 9.2). */
  heavy: boolean
  /** The lighter version can be asked: heavy and not already light (D-067). */
  canLighten: boolean
}

export interface ExportState {
  dialog: ExportKind | null
  running: RunningExport | null
  /** Exports already present, waiting for « Remplacer », « Garder les deux » or « Annuler ». */
  existing: string[] | null
  outcome: ExportOutcome | null
}

export const useExportStore = create<ExportState>(() => ({
  dialog: null,
  running: null,
  existing: null,
  outcome: null,
}))
