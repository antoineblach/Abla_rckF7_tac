// Session controller: start-up, storage choice (folder or browser), synchronisation, conflicts,
// import and export (SPEC 8). Connects io to the stores; no React here.
import { keepBothCopy } from '../io/conflicts'
import { clearDraft, draftDiffers, loadDraft, saveDraft } from '../io/draft'
import { downloadText } from '../io/download'
import type { ExportTarget } from '../io/exportRun'
import {
  asFsDirectory,
  folderPermission,
  isFolderAccessSupported,
  loadFolderHandle,
  pickFolder,
  requestFolderPermission,
  saveFolderHandle,
} from '../io/folderAccess'
import { FolderStore } from '../io/FolderStore'
import { IdbStore } from '../io/IdbStore'
import { createIdbKeyValueStore, type KeyValueStore } from '../io/kv'
import type { DuplicateResolution, LibraryStore } from '../io/LibraryStore'
import {
  applyImport,
  packExportFile,
  parseImportText,
  planImport,
  playExportFile,
  type ImportDecision,
} from '../io/packFiles'
import { loadReadCache, saveReadCache } from '../io/readCache'
import { SyncController, type ExternalChange } from '../io/sync'
import { SyncLog } from '../io/syncLog'
import { createNewPlay, type StartingPlacement } from '../editor/placements'
import { randomIds } from '../model/ids'
import type { ExportPrefs, Settings } from '../model/settings'
import type { Id, Play } from '../model/types'
import { TEXT } from '../ui/strings'
import {
  closePlay,
  markSaved,
  openPlay,
  reloadPlay,
  setEditorChangeListener,
  useEditorStore,
} from './editorStore'
import { setSaveRequest } from './editorActions'
import {
  closeDialog,
  notify,
  pushDialog,
  useLibraryState,
  type LibraryDialog,
} from './libraryState'
import { showPhaseInPlayer, syncLineWithPlay } from './playerStore'
import { useSettingsStore } from './settingsStore'
import { onGestureEnd, openPlayForSync } from './syncBridge'

const now = (): Date => new Date()

/** Synchronisation log of the page, kept in memory only (D-100). */
const syncLog = new SyncLog(now)

let kv: KeyValueStore | null = null
let store: LibraryStore | null = null
let sync: SyncController | null = null
let folderHandle: FileSystemDirectoryHandle | null = null
let draftTimer: ReturnType<typeof setTimeout> | null = null
let cacheTimer: ReturnType<typeof setTimeout> | null = null
let listenersAttached = false

function getKv(): KeyValueStore {
  kv ??= createIdbKeyValueStore()
  return kv
}

export function currentStore(): LibraryStore | null {
  return store
}

export function currentSyncLog(): SyncLog {
  return syncLog
}

/** Where the exports go: exports/ of the chosen folder, else a download (SPEC 9.1). */
export function currentExportTarget(): ExportTarget {
  return store instanceof FolderStore
    ? { kind: 'folder', root: store.rootHandle }
    : { kind: 'download' }
}

function reportError(error: unknown): void {
  console.error(error)
  notify(`${TEXT.saveError} ${error instanceof Error ? error.message : ''}`, 'error')
}

/** Reads the plays and the placement presets of a store into the library state. */
export async function loadLibraryFrom(target: LibraryStore): Promise<void> {
  useLibraryState.setState({
    summaries: await target.list(),
    issues: await target.issues(),
    presets: await target.listPresets(),
    presetIssues: await target.presetIssues(),
  })
}

export async function refreshLibrary(): Promise<void> {
  if (store) await loadLibraryFrom(store)
}

/** Full rescan now, serialised with the saves (SPEC 8.3): before acting on a preset (D-092). */
export function rescanNow(): Promise<void> {
  return sync?.rescan() ?? Promise.resolve()
}

function scheduleDraft(): void {
  if (draftTimer !== null) clearTimeout(draftTimer)
  draftTimer = setTimeout(() => {
    const { play, pendingCreation } = useEditorStore.getState()
    // A new play waiting for its placement leaves nothing behind, not even a draft (D-101).
    if (play && !pendingCreation) void saveDraft(getKv(), play).catch(() => undefined)
  }, 500)
}

function scheduleCacheSave(): void {
  if (!(store instanceof FolderStore)) return
  const folder = store
  if (cacheTimer !== null) clearTimeout(cacheTimer)
  cacheTimer = setTimeout(() => {
    void saveReadCache(getKv(), folder.exportCache()).catch(() => undefined)
  }, 1000)
}

function onExternalChange(change: ExternalChange): void {
  switch (change.kind) {
    case 'reloaded':
      reloadPlay(change.play, change.version)
      notify(TEXT.reloaded)
      return
    case 'conflict': {
      const existing = useLibraryState.getState().dialogs.find((d) => d.kind === 'conflict')
      if (existing) closeDialog(existing)
      pushDialog({ kind: 'conflict', stored: change.stored, version: change.version })
      return
    }
    case 'removed':
      if (!useLibraryState.getState().dialogs.some((d) => d.kind === 'removedExternally')) {
        pushDialog({ kind: 'removedExternally' })
      }
  }
}

async function activateStore(next: LibraryStore): Promise<void> {
  sync?.stop()
  store = next
  sync = new SyncController(
    next,
    {
      getOpen: openPlayForSync,
      saved: (result, savedFrom) => {
        markSaved(result, savedFrom)
        void clearDraft(getKv()).catch(() => undefined)
        void refreshLibrary()
        scheduleCacheSave()
      },
      externalChange: onExternalChange,
      libraryChanged: () => {
        void refreshLibrary()
        scheduleCacheSave()
      },
      error: reportError,
    },
    { isVisible: () => document.visibilityState === 'visible', log: syncLog },
  )
  sync.start()
  const settings = await next.getSettings()
  useSettingsStore.setState({ settings: settings.settings, writable: settings.ok })
  if (!settings.ok) notify(settings.future ? TEXT.futureSettings : TEXT.invalidSettings, 'error')
  await refreshLibrary()
  scheduleCacheSave()
}

function attachListeners(): void {
  if (listenersAttached) return
  listenersAttached = true
  window.addEventListener('focus', () => void sync?.onFocus())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sync?.onFocus()
  })
  setEditorChangeListener(() => {
    sync?.notifyLocalChange()
    scheduleDraft()
  })
  setSaveRequest(() => void sync?.saveNow())
  // The automatic save held back by a gesture leaves at its end (D-099).
  onGestureEnd(() => void sync?.gestureEnded())
  useEditorStore.subscribe((state, previous) => {
    if (state.selectedPhaseId !== previous.selectedPhaseId && state.selectedPhaseId) {
      showPhaseInPlayer(state.selectedPhaseId)
    } else if (state.play !== previous.play && state.play) {
      syncLineWithPlay()
    }
  })
}

async function openFolder(handle: FileSystemDirectoryHandle): Promise<void> {
  folderHandle = handle
  const cache = await loadReadCache(getKv()).catch(() => undefined)
  const folder = await FolderStore.open(asFsDirectory(handle), {
    now,
    ids: randomIds,
    log: syncLog,
    ...(cache ? { cache } : {}),
  })
  useLibraryState.setState({ status: 'folder', folderName: handle.name })
  await activateStore(folder)
}

async function openBrowser(): Promise<void> {
  useLibraryState.setState({ status: 'browser', folderName: null })
  await activateStore(await IdbStore.open(getKv(), now, syncLog))
}

async function offerDraft(): Promise<void> {
  const draft = await loadDraft(getKv()).catch(() => null)
  if (!draft || !store) return
  const stored = await store.get(draft.id).catch(() => null)
  if (draftDiffers(draft, stored)) pushDialog({ kind: 'draft', draft })
  else await clearDraft(getKv())
}

/** Start-up (SPEC 8.2, 8.6). */
let started = false

export async function startSession(): Promise<void> {
  if (started) return
  started = true
  attachListeners()
  const supported = isFolderAccessSupported()
  useLibraryState.setState({ folderSupported: supported })
  try {
    if (supported) {
      const handle = await loadFolderHandle(getKv())
      if (handle) {
        folderHandle = handle
        if ((await folderPermission(handle)) === 'granted') {
          await openFolder(handle)
        } else {
          useLibraryState.setState({ status: 'needsPermission', folderName: handle.name })
          return
        }
      } else {
        await openBrowser()
      }
    } else {
      await openBrowser()
    }
    await offerDraft()
  } catch (error) {
    reportError(error)
    if (!store) await openBrowser()
  }
}

/** « Choisir un dossier » (user gesture). */
export async function chooseFolder(): Promise<void> {
  const previous = store
  let handle: FileSystemDirectoryHandle
  try {
    handle = await pickFolder()
  } catch {
    return // Picker cancelled.
  }
  await saveFolderHandle(getKv(), handle)
  await openFolder(handle)
  if (previous instanceof IdbStore) {
    const count = (await previous.allPlays()).length
    const presets = (await previous.allPresets()).length
    if (count > 0 || presets > 0) pushDialog({ kind: 'copyBrowserPlays', count, presets })
  }
}

/** « Réautoriser le dossier » (user gesture, SPEC 8.2). */
export async function reauthorizeFolder(): Promise<void> {
  if (!folderHandle) return
  if ((await requestFolderPermission(folderHandle)) === 'granted') {
    await openFolder(folderHandle)
    await offerDraft()
  }
}

/**
 * Copies the plays and the placement presets of the browser library into the folder just chosen
 * (D-021, D-092).
 */
export async function copyBrowserPlays(dialog: LibraryDialog, accept: boolean): Promise<void> {
  closeDialog(dialog)
  if (!accept || !store) return
  const browser = await IdbStore.open(getKv(), now)
  const plays = await browser.allPlays()
  const existing = new Set((await store.list()).map((s) => s.id))
  let copied = 0
  for (const play of plays) {
    if (existing.has(play.id)) continue
    await store.put(play)
    copied++
  }
  const presets = await browser.allPresets()
  const existingPresets = new Set((await store.listPresets()).map((e) => e.preset.id))
  let copiedPresets = 0
  for (const preset of presets) {
    if (existingPresets.has(preset.id)) continue
    await store.putPreset(preset)
    copiedPresets++
  }
  await refreshLibrary()
  notify(TEXT.copied(copied, copiedPresets))
}

export async function openFromLibrary(id: Id, fileName: string | null = null): Promise<void> {
  if (!store) return
  await sync?.saveNow()
  const summary = useLibraryState
    .getState()
    .summaries.find((s) => s.id === id && (fileName === null || s.fileName === fileName))
  const play =
    store instanceof FolderStore && fileName ? await store.getFile(fileName) : await store.get(id)
  openPlay(play, store.versionOf(id), summary?.readOnly ?? false)
}

export async function createPlay(placement: StartingPlacement): Promise<void> {
  await sync?.saveNow()
  const play = createNewPlay(placement, randomIds, now())
  openPlay(play, null, false, true)
  await sync?.saveNow()
}

export async function duplicateInLibrary(id: Id): Promise<void> {
  if (!store) return
  const play = await store.get(id)
  await store.put(keepBothCopy(play, randomIds(), now()))
  await refreshLibrary()
}

/** Removing goes to the trash, after confirmation (SPEC 8.5, 8.7). */
export async function confirmDelete(id: Id): Promise<void> {
  if (!store) return
  await store.remove(id)
  if (useEditorStore.getState().play?.id === id) closePlay()
  await refreshLibrary()
  notify(TEXT.deleted)
}

export async function exportPlay(id: Id): Promise<void> {
  if (!store) return
  await sync?.saveNow()
  const file = playExportFile(await store.get(id))
  downloadText(file.fileName, file.text)
}

export async function exportLibrary(): Promise<void> {
  if (!store) return
  await sync?.saveNow()
  const summaries = await store.list()
  const plays: Play[] = []
  for (const s of summaries) if (!s.readOnly) plays.push(await store.get(s.id))
  const file = packExportFile(plays, 'bibliotheque')
  downloadText(file.fileName, file.text)
}

/** Import of .combi.json and .combipack.json files (SPEC 8.4, 8.6). */
export async function importFiles(files: readonly File[]): Promise<void> {
  if (!store) return
  const existing = new Map((await store.list()).map((s) => [s.id, s.updatedAt]))
  let imported = 0
  let failures = 0
  for (const file of files) {
    const parsed = parseImportText(await file.text())
    failures += parsed.failures.length
    for (const candidate of planImport(parsed.plays, new Set(existing.keys()))) {
      if (candidate.existingId === null) {
        await applyImport(store, candidate, null, randomIds, now)
        imported++
      } else {
        pushDialog({
          kind: 'import',
          candidate,
          existingUpdatedAt: existing.get(candidate.existingId) ?? '',
        })
      }
    }
  }
  await refreshLibrary()
  if (imported > 0) notify(TEXT.imported(imported))
  if (failures > 0) notify(TEXT.importFailed(failures), 'error')
}

export async function resolveImport(
  dialog: LibraryDialog,
  decision: ImportDecision | null,
): Promise<void> {
  closeDialog(dialog)
  if (dialog.kind !== 'import' || !store || decision === null) return
  await applyImport(store, dialog.candidate, decision, randomIds, now)
  const open = useEditorStore.getState()
  if (decision === 'replace' && open.play?.id === dialog.candidate.play.id) {
    reloadPlay(await store.get(dialog.candidate.play.id), store.versionOf(dialog.candidate.play.id))
  }
  await refreshLibrary()
  notify(TEXT.imported(1))
}

/** External change during a local change (SPEC 8.4): folder, mine, or both. */
export async function resolveConflict(
  dialog: LibraryDialog,
  choice: 'folder' | 'mine' | 'both',
): Promise<void> {
  closeDialog(dialog)
  if (dialog.kind !== 'conflict' || !store) return
  const open = useEditorStore.getState()
  if (!open.play) return
  if (choice === 'folder') {
    reloadPlay(dialog.stored, dialog.version)
  } else if (choice === 'mine') {
    const result = await store.put(open.play)
    markSaved(result, open.play)
  } else {
    const copy = keepBothCopy(open.play, randomIds(), now())
    const result = await store.put(copy)
    openPlay(result.play, result.version, false)
  }
  await clearDraft(getKv()).catch(() => undefined)
  await refreshLibrary()
}

export async function resolveRemoved(dialog: LibraryDialog, keep: boolean): Promise<void> {
  closeDialog(dialog)
  if (!store) return
  const open = useEditorStore.getState()
  if (keep && open.play) {
    const result = await store.put(open.play)
    markSaved(result, open.play)
  } else {
    closePlay()
  }
  await refreshLibrary()
}

export async function resolveDuplicate(id: Id, resolution: DuplicateResolution): Promise<void> {
  if (!store) return
  await store.resolveDuplicate(id, resolution)
  if (useEditorStore.getState().play?.id === id) closePlay()
  await refreshLibrary()
}

export async function resolveDraft(dialog: LibraryDialog, restore: boolean): Promise<void> {
  closeDialog(dialog)
  if (dialog.kind !== 'draft') return
  if (restore && store) {
    openPlay(dialog.draft, store.versionOf(dialog.draft.id), false, true)
    await sync?.saveNow()
  } else {
    await clearDraft(getKv())
  }
}

export function saveNow(): Promise<void> {
  return sync?.saveNow() ?? Promise.resolve()
}

/** « Copier le journal de synchronisation » (D-100): to the clipboard, nothing in the folder. */
export async function copySyncLog(): Promise<void> {
  try {
    await navigator.clipboard.writeText(syncLog.toText())
    notify(TEXT.syncLogCopied)
  } catch {
    notify(TEXT.syncLogNotCopied, 'error')
  }
}

export async function updateSettings(settings: Settings): Promise<void> {
  if (!store || !useSettingsStore.getState().writable) return
  useSettingsStore.setState({ settings })
  await store.putSettings(settings)
}

/** Export preferences of reglages.json (D-068), written only when they change. */
export async function updateExportPrefs(patch: Partial<ExportPrefs>): Promise<void> {
  const current = useSettingsStore.getState().settings
  const next: Settings = { ...current, export: { ...current.export, ...patch } }
  if (JSON.stringify(next.export) === JSON.stringify(current.export)) return
  await updateSettings(next).catch(reportError)
}
