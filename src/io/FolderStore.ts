// Library stored in a folder synchronised by Google Drive for desktop (SPEC 8.2 to 8.5).
// Rules: a file is never deleted (removing = moving to _corbeille/), an invalid file is never
// modified nor moved, a write never overwrites a version changed by the other computer.
// Plays (combinaisons/) and placement presets (modeles/, lot 3) are two collections of files
// handled the same way (io/collection.ts, D-092).
import type { IdFactory } from '../model/ids'
import type { PlacementPreset } from '../model/preset'
import { defaultSettings, readSettings, type Settings } from '../model/settings'
import type { Id, Play } from '../model/types'
import {
  FileCollection,
  InvalidStoredFileError,
  type CollectionChange,
  type ReadCacheData,
} from './collection'
import { keepBothCopy } from './conflicts'
import {
  EXPORTS_DIR,
  PLAYS_DIR,
  PRESETS_DIR,
  SETTINGS_FILE,
  TRASH_DIR,
  playFileName,
  presetFileName,
} from './fileNames'
import { tryGetFile, writeTextFile, type FsDirectoryHandle } from './fs/types'
import {
  settingsResult,
  type Change,
  type Collection,
  type DuplicateResolution,
  type LibraryIssue,
  type LibraryStore,
  type PlaySummary,
  type PresetEntry,
  type PutOptions,
  type PutResult,
  type SettingsResult,
  type VersionToken,
} from './LibraryStore'
import { readPlayText } from './readPlay'
import { readPresetText } from './readPreset'
import { parseJson, serialize } from './serialize'

export { InvalidStoredFileError, type ReadCacheData } from './collection'

export interface FolderStoreOptions {
  now: () => Date
  ids: IdFactory
  cache?: ReadCacheData
}

/**
 * Creates the folder structure on first use (SPEC 8.2): exports/ arrives with lot 2, modeles/
 * with lot 3.
 */
export async function ensureFolderStructure(root: FsDirectoryHandle): Promise<void> {
  await root.getDirectoryHandle(PLAYS_DIR, { create: true })
  await root.getDirectoryHandle(PRESETS_DIR, { create: true })
  await root.getDirectoryHandle(EXPORTS_DIR, { create: true })
  await root.getDirectoryHandle(TRASH_DIR, { create: true })
  if (!(await tryGetFile(root, SETTINGS_FILE))) {
    await writeTextFile(root, SETTINGS_FILE, serialize(defaultSettings()))
  }
}

export class FolderStore implements LibraryStore {
  readonly kind = 'folder'
  private readonly log: Change[] = []
  private currentStamp = 0
  private readonly plays: FileCollection<Play>
  private readonly presets: FileCollection<PlacementPreset>

  private constructor(
    private readonly root: FsDirectoryHandle,
    options: FolderStoreOptions,
  ) {
    this.plays = new FileCollection<Play>(
      root,
      {
        dir: PLAYS_DIR,
        cachePrefix: '',
        fileName: playFileName,
        read: (text) => {
          const result = readPlayText(text)
          return result.ok ? { ok: true, item: result.play } : result
        },
        keepBoth: keepBothCopy,
      },
      options,
    )
    this.presets = new FileCollection<PlacementPreset>(
      root,
      {
        dir: PRESETS_DIR,
        cachePrefix: `${PRESETS_DIR}/`,
        fileName: presetFileName,
        read: (text) => {
          const result = readPresetText(text)
          return result.ok ? { ok: true, item: result.preset } : result
        },
        keepBoth: keepBothCopy,
      },
      options,
    )
  }

  /** Opens a folder: creates the structure if needed, then reads everything. */
  static async open(root: FsDirectoryHandle, options: FolderStoreOptions): Promise<FolderStore> {
    await ensureFolderStructure(root)
    const store = new FolderStore(root, options)
    await store.scan()
    store.log.length = 0
    return store
  }

  get stamp(): number {
    return this.currentStamp
  }

  /** The chosen folder: exports are written in its exports/ (SPEC 9.1). */
  get rootHandle(): FsDirectoryHandle {
    return this.root
  }

  /** Full rescan of both collections (SPEC 8.3). */
  private async scan(): Promise<Change[]> {
    const tag = (collection: Collection, changes: CollectionChange[]) =>
      changes.map((change) => ({ ...change, collection }))
    const found = [
      ...tag('plays', await this.plays.scan()),
      ...tag('presets', await this.presets.scan()),
    ]
    if (found.length === 0) return []
    this.currentStamp++
    const stamped: Change[] = found.map((change) => ({ ...change, stamp: this.currentStamp }))
    this.log.push(...stamped)
    if (this.log.length > 500) this.log.splice(0, this.log.length - 500)
    return stamped
  }

  async changesSince(stamp: number): Promise<Change[]> {
    await this.scan()
    return this.log.filter((change) => change.stamp > stamp)
  }

  list(): Promise<PlaySummary[]> {
    return Promise.resolve(
      this.plays.items().map(({ item, fileName, readOnly }) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        updatedAt: item.updatedAt,
        fileName,
        readOnly,
      })),
    )
  }

  get(id: Id): Promise<Play> {
    return this.plays.get(id)
  }

  /** Play stored in a given file (to open one side of a duplicate). */
  getFile(fileName: string): Promise<Play> {
    return this.plays.getFile(fileName)
  }

  versionOf(id: Id): VersionToken | null {
    return this.plays.versionOf(id)
  }

  issues(): Promise<LibraryIssue[]> {
    return Promise.resolve(this.plays.issues())
  }

  async put(play: Play, options: PutOptions = {}): Promise<PutResult> {
    const { item, fileName, version } = await this.plays.put(play, options)
    return { play: item, fileName, version }
  }

  remove(id: Id): Promise<void> {
    return this.plays.remove(id)
  }

  resolveDuplicate(id: Id, resolution: DuplicateResolution): Promise<void> {
    return this.plays.resolveDuplicate(id, resolution)
  }

  // Placement presets (lot 3).

  listPresets(): Promise<PresetEntry[]> {
    return Promise.resolve(
      this.presets.items().map(({ item, fileName, readOnly }) => ({
        preset: structuredClone(item),
        fileName,
        readOnly,
      })),
    )
  }

  getPreset(id: Id): Promise<PlacementPreset> {
    return this.presets.get(id)
  }

  async putPreset(
    preset: PlacementPreset,
    options: { expected?: VersionToken | null } = {},
  ): Promise<{ preset: PlacementPreset; version: VersionToken | null }> {
    const { item, version } = await this.presets.put(preset, options)
    return { preset: item, version }
  }

  removePreset(id: Id): Promise<void> {
    return this.presets.remove(id)
  }

  presetIssues(): Promise<LibraryIssue[]> {
    return Promise.resolve(this.presets.issues())
  }

  resolvePresetDuplicate(id: Id, resolution: DuplicateResolution): Promise<void> {
    return this.presets.resolveDuplicate(id, resolution)
  }

  presetVersionOf(id: Id): VersionToken | null {
    return this.presets.versionOf(id)
  }

  async getSettings(): Promise<SettingsResult> {
    const handle = await tryGetFile(this.root, SETTINGS_FILE)
    if (!handle) return { ok: true, settings: defaultSettings() }
    const parsed = parseJson(await (await handle.getFile()).text())
    if (!parsed.ok) return { ok: false, settings: defaultSettings(), message: parsed.message }
    return settingsResult(readSettings(parsed.value))
  }

  async putSettings(settings: Settings): Promise<void> {
    const current = await this.getSettings()
    if (!current.ok) throw new InvalidStoredFileError(SETTINGS_FILE)
    await writeTextFile(this.root, SETTINGS_FILE, serialize(settings))
  }

  /** Content of the read cache, to persist in IndexedDB. */
  exportCache(): ReadCacheData {
    const data: ReadCacheData = {}
    this.plays.exportCache(data)
    this.presets.exportCache(data)
    return data
  }
}
