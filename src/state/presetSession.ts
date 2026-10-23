// Placement presets in the library (SPEC 10.1, D-087 to D-092, D-096): save from the starting
// placement, apply, rename, duplicate, update, remove, new play from a preset. An action on a
// preset changed on the other computer since it was read is refused, with a message, and the list
// is read again (D-092); a version written by this page is never changed elsewhere (D-098).
// Connects io and editor/ to the stores; no React here.
import { keepBothCopy } from '../io/conflicts'
import {
  ConflictError,
  ReadOnlyError,
  type DuplicateResolution,
  type LibraryStore,
  type PresetEntry,
  type VersionToken,
} from '../io/LibraryStore'
import { shortHash, type SyncLog } from '../io/syncLog'
import { presetToSave, type SavePresetRequest } from '../editor/placementMode'
import { createPlayForPreset } from '../editor/placements'
import type { OpenSideChoice } from '../editor/presets'
import { contentHash } from '../model/canonical'
import { randomIds, type IdFactory } from '../model/ids'
import type { PlacementPreset } from '../model/preset'
import { TEXT } from '../ui/strings'
import { setPresetAnchorHandler, startPlacement } from './editorActions'
import { openPlay, setNotice, useEditorStore } from './editorStore'
import { closeDialog, notify, pushDialog, type LibraryDialog } from './libraryState'
import { currentStore, currentSyncLog, loadLibraryFrom, rescanNow, saveNow } from './session'

export interface PresetSessionDeps {
  store(): LibraryStore | null
  /** Reads the storage again (rescan of the synchronisation). */
  rescan(): Promise<void>
  /** Saves the open play (before another one is opened, and a new one at once). */
  savePlay(): Promise<void>
  /** Synchronisation log of the page (D-100). */
  log(): SyncLog | null
  now(): Date
  ids: IdFactory
}

const DEFAULT_DEPS: PresetSessionDeps = {
  store: currentStore,
  rescan: rescanNow,
  savePlay: saveNow,
  log: currentSyncLog,
  now: () => new Date(),
  ids: randomIds,
}

let deps = DEFAULT_DEPS

/** Injection for the tests (in-memory folder, fixed dates, sequential ids). */
export function configurePresetSession(next: Partial<PresetSessionDeps>): void {
  deps = { ...DEFAULT_DEPS, ...next }
}

/** An action refused on a preset changed elsewhere, or vanished (D-092), noted in the log. */
function refused(entry: PresetEntry, stored: PlacementPreset | null, detail: string): void {
  deps.log()?.add('refused', {
    collection: 'presets',
    fileName: entry.fileName,
    updatedAt: stored?.updatedAt ?? null,
    hash: stored ? contentHash(stored) : null,
    origin: stored ? 'external' : null,
    detail,
  })
  notify(TEXT.presetChanged, 'error')
}

function failed(error: unknown): void {
  if (error instanceof ConflictError) {
    // The store noted the refused write in the log.
    notify(TEXT.presetChanged, 'error')
  } else if (error instanceof ReadOnlyError) {
    notify(TEXT.presetReadOnly, 'error')
  } else {
    console.error(error)
    notify(`${TEXT.presetError} ${error instanceof Error ? error.message : ''}`, 'error')
  }
}

async function reload(store: LibraryStore): Promise<void> {
  await loadLibraryFrom(store)
}

/**
 * The preset as stored now, after a rescan, with its version; null (and a message) when it changed
 * elsewhere or vanished since `entry` was read, or when it is read only and `write` is asked
 * (D-092, D-022). A version written by this page never counts as changed elsewhere (D-098): the
 * action goes on with the stored version.
 */
async function fresh(
  entry: PresetEntry,
  write: boolean,
): Promise<{ store: LibraryStore; entry: PresetEntry; version: VersionToken | null } | null> {
  const store = deps.store()
  if (!store) return null
  await deps.rescan()
  await reload(store)
  const current = (await store.listPresets()).find(
    (e) => e.preset.id === entry.preset.id && e.fileName === entry.fileName,
  )
  // Both hashes are those of items read back from their files (D-097).
  const shown = contentHash(entry.preset)
  if (!current) {
    refused(entry, null, 'modèle retiré depuis sa lecture : action refusée')
    return null
  }
  const hash = contentHash(current.preset)
  if (hash !== shown && !store.isOwnWrite('presets', current.preset.id, hash)) {
    refused(
      entry,
      current.preset,
      `modèle changé ailleurs depuis sa lecture (lu ${shortHash(shown)}) : action refusée`,
    )
    return null
  }
  if (write && current.readOnly) {
    notify(TEXT.presetReadOnly, 'error')
    return null
  }
  return { store, entry: current, version: store.presetVersionOf(current.preset.id) }
}

/** « Appliquer »: placement mode with ghost tokens, on the open play (SPEC 10.1, D-088). */
export async function startApplyPreset(entry: PresetEntry): Promise<void> {
  const { play, readOnly } = useEditorStore.getState()
  if (!play) return
  if (readOnly) {
    setNotice('readOnly')
    return
  }
  const found = await fresh(entry, false)
  if (!found) return
  startPlacement({ kind: 'applyPreset', preset: found.entry.preset, openSide: 'auto' })
}

/** « Mettre à jour »: the save dialog, keeping the id, the name and the type (SPEC 10.1). */
export async function openUpdatePresetDialog(entry: PresetEntry): Promise<void> {
  const found = await fresh(entry, true)
  if (found)
    pushDialog({ kind: 'savePreset', update: { entry: found.entry, version: found.version } })
}

/** Choices of the save dialog (SPEC 10.1, D-089). */
export interface SavePresetForm {
  request: SavePresetRequest
  openSide: OpenSideChoice
}

/** Closes the dialog, then waits for the anchor click (D-096). */
export function startSavePreset(dialog: LibraryDialog, form: SavePresetForm): void {
  closeDialog(dialog)
  if (dialog.kind !== 'savePreset') return
  const update = dialog.update
  setPresetAnchorHandler((request, content) => {
    void finishSavePreset(request, content, update)
  })
  startPlacement({ kind: 'savePreset', request: form.request, openSide: form.openSide })
}

async function finishSavePreset(
  request: SavePresetRequest,
  content: Pick<PlacementPreset, 'positions' | 'ball'>,
  update: { entry: PresetEntry; version: VersionToken | null } | null,
): Promise<void> {
  const store = deps.store()
  if (!store) return
  const preset = presetToSave(
    request,
    content,
    update?.entry.preset ?? null,
    deps.ids(),
    deps.now(),
  )
  try {
    // An update is refused when the preset changed elsewhere since it was read (D-092).
    await store.putPreset(preset, update ? { expected: update.version } : {})
    notify(update ? TEXT.presetUpdated(preset.name) : TEXT.presetSaved(preset.name))
  } catch (error) {
    failed(error)
    await deps.rescan()
  }
  await reload(store)
}

export async function renamePreset(entry: PresetEntry, name: string): Promise<void> {
  if (name === entry.preset.name) return
  const found = await fresh(entry, true)
  if (!found) return
  try {
    await found.store.putPreset({ ...found.entry.preset, name }, { expected: found.version })
    notify(TEXT.presetRenamed)
  } catch (error) {
    failed(error)
    await deps.rescan()
  }
  await reload(found.store)
}

/** « Dupliquer »: a copy with a new id and « (copie) » (D-022, D-092). */
export async function duplicatePreset(entry: PresetEntry): Promise<void> {
  const found = await fresh(entry, true)
  if (!found) return
  try {
    await found.store.putPreset(keepBothCopy(found.entry.preset, deps.ids(), deps.now()))
    notify(TEXT.presetDuplicated)
  } catch (error) {
    failed(error)
  }
  await reload(found.store)
}

/** « Supprimer »: to the trash, after confirmation (SPEC 8.5, 10.1). */
export async function removePreset(entry: PresetEntry): Promise<void> {
  const found = await fresh(entry, true)
  if (!found) return
  try {
    await found.store.removePreset(found.entry.preset.id)
    notify(TEXT.presetDeleted)
  } catch (error) {
    failed(error)
  }
  await reload(found.store)
}

/** Copy of conflict made by the synchronisation (SPEC 8.4, D-022, D-092). */
export async function resolvePresetDuplicate(
  id: string,
  resolution: DuplicateResolution,
): Promise<void> {
  const store = deps.store()
  if (!store) return
  try {
    await store.resolvePresetDuplicate(id, resolution)
  } catch (error) {
    failed(error)
  }
  await reload(store)
}

/**
 * « Nouvelle combinaison » from a preset (D-091): a play without players, with a ball when the
 * preset has one, then the anchor of the preset.
 */
export async function createPlayFromPreset(entry: PresetEntry): Promise<void> {
  const found = await fresh(entry, false)
  if (!found) return
  await deps.savePlay()
  const play = createPlayForPreset(found.entry.preset.ball !== null, deps.ids, deps.now())
  openPlay(play, null, false, true)
  await deps.savePlay()
  startPlacement({ kind: 'applyPreset', preset: found.entry.preset, openSide: 'auto' })
}
