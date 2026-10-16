// Export session (SPEC 9): builds the jobs from the open play or the library, runs them through
// the export worker (io/exportRun.ts) and keeps the export store up to date. No React here.
// Dependencies are injectable for the tests (inline engine, in-memory folder, weight threshold).
import { GIF_WEIGHT_WARNING_BYTES } from '../config/defaults'
import { expectedFileNames, type ExportJob } from '../export/jobs'
import { EXPORT_TEXT } from '../export/text'
import type { ExportFile } from '../export/types'
import { createWorkerEngine, type ExportEngine } from '../export/worker/engine'
import { downloadBytes } from '../io/download'
import { runExport, type ExistingDecision, type ExportTarget } from '../io/exportRun'
import type { WrittenExport } from '../io/exportsFolder'
import type { PlaySummary } from '../io/LibraryStore'
import { CATEGORY_LABELS } from '../model/labels'
import { allLines } from '../model/phaseTree'
import type { GifExportPrefs, PdfExportPrefs } from '../model/settings'
import type { Id, Play, PlayCategory } from '../model/types'
import { TEXT } from '../ui/strings'
import { useEditorStore } from './editorStore'
import { useExportStore, type ExportKind } from './exportStore'
import { notify, visibleSummaries, type LibraryState } from './libraryState'
import { usePlayerStore } from './playerStore'
import { currentExportTarget, currentStore, saveNow, updateExportPrefs } from './session'
import { currentEngineSettings } from './settingsStore'

export interface ExportSessionDeps {
  engine: () => ExportEngine
  target: () => ExportTarget
  now: () => Date
  download: (file: ExportFile) => void
  /** Weight above which a GIF is reported, with a lighter version offered (SPEC 9.2). */
  heavyThreshold: number
}

let engine: ExportEngine | null = null

let deps: ExportSessionDeps = {
  engine: () => (engine ??= createWorkerEngine()),
  target: currentExportTarget,
  now: () => new Date(),
  download: (file) => {
    downloadBytes(file.fileName, file.bytes, file.mime)
  },
  heavyThreshold: GIF_WEIGHT_WARNING_BYTES,
}

/** Tests: replaces some dependencies. */
export function configureExportSession(patch: Partial<ExportSessionDeps>): void {
  deps = { ...deps, ...patch }
}

let answer: ((decision: ExistingDecision) => void) | null = null
let lastGifJob: Extract<ExportJob, { kind: 'gif' }> | null = null

export function openExportDialog(kind: ExportKind): void {
  if (useExportStore.getState().running) return
  useExportStore.setState({ dialog: kind, outcome: null })
}

export function closeExportDialog(): void {
  useExportStore.setState({ dialog: null })
}

export function closeOutcome(): void {
  useExportStore.setState({ outcome: null })
}

/** « Remplacer », « Garder les deux » or « Annuler » for exports already present (D-065). */
export function answerExisting(decision: ExistingDecision): void {
  const resolve = answer
  answer = null
  useExportStore.setState({ existing: null })
  resolve?.(decision)
}

/** « Annuler » during the encoding; the final writing cannot be cancelled. */
export function cancelExport(): void {
  const running = useExportStore.getState().running
  if (!running || running.saving || running.cancelling) return
  useExportStore.setState({ running: { ...running, cancelling: true } })
  deps.engine().cancel()
}

/** GIFs heavier than the threshold (SPEC 9.2). */
export function heavyFiles(files: readonly WrittenExport[], threshold: number): WrittenExport[] {
  return files.filter((f) => f.size > threshold)
}

async function run(kind: ExportKind, job: ExportJob): Promise<void> {
  useExportStore.setState({
    dialog: null,
    outcome: null,
    running: { kind, progress: null, saving: false, cancelling: false },
  })
  const result = await runExport(job, {
    engine: deps.engine(),
    target: deps.target(),
    now: deps.now,
    confirmExisting: (fileNames) =>
      new Promise<ExistingDecision>((resolve) => {
        answer = resolve
        useExportStore.setState({ existing: fileNames })
      }),
    onProgress: (progress) => {
      const running = useExportStore.getState().running
      if (running) useExportStore.setState({ running: { ...running, progress } })
    },
    onSaving: () => {
      const running = useExportStore.getState().running
      if (running) useExportStore.setState({ running: { ...running, saving: true } })
    },
    download: deps.download,
  })
  useExportStore.setState({ running: null, existing: null })
  switch (result.kind) {
    case 'written': {
      const gif = job.kind === 'gif' ? job : null
      const heavy = gif !== null && heavyFiles(result.files, deps.heavyThreshold).length > 0
      if (gif) lastGifJob = gif
      useExportStore.setState({
        outcome: {
          kind,
          location: result.location,
          files: result.files,
          heavy,
          canLighten: heavy && !gif.options.light,
        },
      })
      return
    }
    case 'cancelled':
      notify(TEXT.exportCancelled)
      return
    case 'error':
      notify(TEXT.exportFailed(result.message), 'error')
  }
}

function gifJob(play: Play, prefs: GifExportPrefs, light: boolean): ExportJob {
  return {
    kind: 'gif',
    play,
    settings: currentEngineSettings(),
    options: { ...prefs, light, layers: usePlayerStore.getState().layers },
  }
}

/** True when the play has several lines (« un GIF par option » makes sense). */
export function hasOptions(play: Play | null): boolean {
  return play !== null && allLines(play).length > 1
}

/** Names of the files a GIF export of the open play would write. */
export function gifFileNames(play: Play, prefs: GifExportPrefs): string[] {
  return expectedFileNames(gifJob(play, prefs, false))
}

export function pdfFileNames(play: Play, prefs: PdfExportPrefs): string[] {
  return expectedFileNames({
    kind: 'pdf',
    plays: [play],
    settings: currentEngineSettings(),
    options: prefs,
    book: null,
  })
}

export async function exportGif(prefs: GifExportPrefs): Promise<void> {
  const play = useEditorStore.getState().play
  if (!play) return
  await updateExportPrefs({ gif: prefs })
  await run('gif', gifJob(play, prefs, false))
}

/** « Version allégée » of the last GIF (D-067): same content, standard size, lower rate. */
export async function exportLightVersion(): Promise<void> {
  if (!lastGifJob) return
  await run('gif', { ...lastGifJob, options: { ...lastGifJob.options, light: true } })
}

export async function exportPdf(prefs: PdfExportPrefs): Promise<void> {
  const play = useEditorStore.getState().play
  if (!play) return
  await updateExportPrefs({ pdf: prefs })
  await run('pdf', {
    kind: 'pdf',
    plays: [play],
    settings: currentEngineSettings(),
    options: prefs,
    book: null,
  })
}

// ---------------------------------------------------------------------------
// Playbook (« cahier de jeu », D-064).

/** Every play of the library in the order of the current sort (search and filter ignored). */
export function bookCandidates(state: Pick<LibraryState, 'summaries' | 'sort'>): PlaySummary[] {
  return visibleSummaries({ ...state, search: '', category: 'all' }).filter((s) => !s.readOnly)
}

/** Plays of a category (quick choice of the dialog). */
export function categoryIds(candidates: readonly PlaySummary[], category: PlayCategory): Id[] {
  return candidates.filter((s) => s.category === category).map((s) => s.id)
}

/** « Mêlée » when the selection is exactly a category, else « Sélection » (D-064). */
export function bookSubtitle(
  candidates: readonly PlaySummary[],
  selected: ReadonlySet<Id>,
): string {
  const chosen = candidates.filter((s) => selected.has(s.id))
  const first = chosen[0]
  if (!first) return EXPORT_TEXT.selection
  const whole = categoryIds(candidates, first.category)
  return chosen.every((s) => s.category === first.category) && whole.length === chosen.length
    ? CATEGORY_LABELS[first.category]
    : EXPORT_TEXT.selection
}

export interface BookRequest {
  title: string
  /** Selected plays, in the order of the library. */
  ids: Id[]
  subtitle: string
}

export async function exportBook(request: BookRequest, prefs: PdfExportPrefs): Promise<void> {
  const store = currentStore()
  if (!store || request.ids.length === 0) return
  await saveNow()
  await updateExportPrefs({ pdf: prefs })
  const plays: Play[] = []
  for (const id of request.ids) plays.push(await store.get(id))
  await run('book', {
    kind: 'pdf',
    plays,
    settings: currentEngineSettings(),
    options: prefs,
    book: { title: request.title, subtitle: request.subtitle },
  })
}
