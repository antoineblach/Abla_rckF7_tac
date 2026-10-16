// Library stored in a folder synchronised by Google Drive for desktop (SPEC 8.2 to 8.5).
// Rules: a file is never deleted (removing = moving to _corbeille/), an invalid file is never
// modified nor moved, a write never overwrites a version changed by the other computer.
import { contentHash } from '../model/canonical'
import type { IdFactory } from '../model/ids'
import { defaultSettings, readSettings, type Settings } from '../model/settings'
import type { Id, Play } from '../model/types'
import { keepBothCopy } from './conflicts'
import {
  PLAYS_DIR,
  SETTINGS_FILE,
  TRASH_DIR,
  isScannedPlayFile,
  playFileName,
  trashFileName,
} from './fileNames'
import { tryGetFile, writeTextFile, type FsDirectoryHandle } from './fs/types'
import {
  ConflictError,
  NotFoundInLibraryError,
  ReadOnlyError,
  type Change,
  type DuplicateResolution,
  type LibraryIssue,
  type LibraryStore,
  type PlaySummary,
  type PutOptions,
  type PutResult,
  settingsResult,
  type SettingsResult,
  type VersionToken,
} from './LibraryStore'
import { readPlayText, type ReadPlayResult } from './readPlay'
import { parseJson, serialize } from './serialize'

type ChangeWithoutStamp =
  { kind: 'added' | 'modified' | 'removed'; id: Id; fileName: string | null } | { kind: 'issues' }

export class InvalidStoredFileError extends Error {
  constructor(readonly fileName: string) {
    super(`The stored file is invalid and is never overwritten: ${fileName}`)
    this.name = 'InvalidStoredFileError'
  }
}

interface FileEntry {
  fileName: string
  lastModified: number
  size: number
  text: string
  result: ReadPlayResult
}

/** Read cache persisted between sessions (SPEC 3.5): avoids rereading unchanged files. */
export type ReadCacheData = Record<string, { lastModified: number; size: number; text: string }>

export interface FolderStoreOptions {
  now: () => Date
  ids: IdFactory
  cache?: ReadCacheData
}

/** Creates the folder structure on first use (SPEC 8.2): lot 1 creates only these entries. */
export async function ensureFolderStructure(root: FsDirectoryHandle): Promise<void> {
  await root.getDirectoryHandle(PLAYS_DIR, { create: true })
  await root.getDirectoryHandle(TRASH_DIR, { create: true })
  if (!(await tryGetFile(root, SETTINGS_FILE))) {
    await writeTextFile(root, SETTINGS_FILE, serialize(defaultSettings()))
  }
}

export class FolderStore implements LibraryStore {
  readonly kind = 'folder'
  private readonly entries = new Map<string, FileEntry>()
  private readonly log: Change[] = []
  private currentStamp = 0
  private lastIssuesKey = ''

  private constructor(
    private readonly root: FsDirectoryHandle,
    private readonly options: FolderStoreOptions,
  ) {}

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

  private playsDir(): Promise<FsDirectoryHandle> {
    return this.root.getDirectoryHandle(PLAYS_DIR, { create: true })
  }

  private trashDir(): Promise<FsDirectoryHandle> {
    return this.root.getDirectoryHandle(TRASH_DIR, { create: true })
  }

  private okEntries(): (FileEntry & { result: { ok: true; play: Play } })[] {
    return [...this.entries.values()]
      .filter((e): e is FileEntry & { result: { ok: true; play: Play } } => e.result.ok)
      .sort((a, b) => a.fileName.localeCompare(b.fileName))
  }

  private entriesFor(id: Id) {
    return this.okEntries().filter((e) => e.result.play.id === id)
  }

  private issuesKey(): string {
    return JSON.stringify(this.computeIssues())
  }

  private computeIssues(): LibraryIssue[] {
    const issues: LibraryIssue[] = []
    for (const entry of [...this.entries.values()].sort((a, b) =>
      a.fileName.localeCompare(b.fileName),
    )) {
      if (!entry.result.ok)
        issues.push({ kind: 'invalid', fileName: entry.fileName, error: entry.result.error })
    }
    const byId = new Map<Id, string[]>()
    for (const entry of this.okEntries()) {
      const names = byId.get(entry.result.play.id) ?? []
      names.push(entry.fileName)
      byId.set(entry.result.play.id, names)
    }
    for (const [id, fileNames] of byId) {
      if (fileNames.length > 1) issues.push({ kind: 'duplicate', id, fileNames })
    }
    return issues
  }

  /**
   * Full rescan (SPEC 8.3): a change is detected by modification date and size, then confirmed
   * by the content.
   */
  private async scan(): Promise<Change[]> {
    const dir = await this.playsDir()
    const seen = new Set<string>()
    const found: ChangeWithoutStamp[] = []
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== 'file' || !isScannedPlayFile(name)) continue
      seen.add(name)
      const file = await handle.getFile()
      const old = this.entries.get(name)
      if (old && old.lastModified === file.lastModified && old.size === file.size) continue
      const cached = old ? undefined : this.options.cache?.[name]
      const text =
        cached && cached.lastModified === file.lastModified && cached.size === file.size
          ? cached.text
          : await file.text()
      const result = readPlayText(text)
      this.entries.set(name, {
        fileName: name,
        lastModified: file.lastModified,
        size: file.size,
        text,
        result,
      })
      const oldPlay = old?.result.ok ? old.result.play : null
      const newPlay = result.ok ? result.play : null
      if (oldPlay && (!newPlay || newPlay.id !== oldPlay.id)) {
        found.push({ kind: 'removed', id: oldPlay.id, fileName: name })
      }
      if (newPlay && (!oldPlay || newPlay.id !== oldPlay.id)) {
        found.push({ kind: 'added', id: newPlay.id, fileName: name })
      } else if (newPlay && oldPlay && contentHash(newPlay) !== contentHash(oldPlay)) {
        found.push({ kind: 'modified', id: newPlay.id, fileName: name })
      }
    }
    for (const [name, entry] of [...this.entries]) {
      if (seen.has(name)) continue
      this.entries.delete(name)
      if (entry.result.ok) found.push({ kind: 'removed', id: entry.result.play.id, fileName: name })
    }
    const issuesKey = this.issuesKey()
    if (issuesKey !== this.lastIssuesKey) {
      found.push({ kind: 'issues' })
      this.lastIssuesKey = issuesKey
    }
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
    const counts = new Map<Id, number>()
    for (const e of this.okEntries())
      counts.set(e.result.play.id, (counts.get(e.result.play.id) ?? 0) + 1)
    return Promise.resolve(
      this.okEntries().map((e) => ({
        id: e.result.play.id,
        name: e.result.play.name,
        category: e.result.play.category,
        updatedAt: e.result.play.updatedAt,
        fileName: e.fileName,
        readOnly: (counts.get(e.result.play.id) ?? 0) > 1,
      })),
    )
  }

  get(id: Id): Promise<Play> {
    const entry = this.entriesFor(id)[0]
    if (!entry) return Promise.reject(new NotFoundInLibraryError(id))
    return Promise.resolve(structuredClone(entry.result.play))
  }

  /** Play stored in a given file (to open one side of a duplicate). */
  getFile(fileName: string): Promise<Play> {
    const entry = this.entries.get(fileName)
    if (!entry?.result.ok) return Promise.reject(new Error(`No valid play in ${fileName}`))
    return Promise.resolve(structuredClone(entry.result.play))
  }

  versionOf(id: Id): VersionToken | null {
    const entry = this.entriesFor(id)[0]
    return entry ? { lastModified: entry.lastModified, size: entry.size } : null
  }

  issues(): Promise<LibraryIssue[]> {
    return Promise.resolve(this.computeIssues())
  }

  private async moveToTrash(fileName: string): Promise<void> {
    const dir = await this.playsDir()
    const trash = await this.trashDir()
    const handle = await dir.getFileHandle(fileName)
    const text = await (await handle.getFile()).text()
    let target = trashFileName(fileName, this.options.now())
    for (let n = 2; await tryGetFile(trash, target); n++) {
      target = trashFileName(`${n}-${fileName}`, this.options.now())
    }
    await writeTextFile(trash, target, text)
    const check = await (await (await trash.getFileHandle(target)).getFile()).text()
    if (check !== text) throw new Error(`Copy to the trash failed for ${fileName}`)
    await dir.removeEntry(fileName)
    this.entries.delete(fileName)
  }

  private async writePlay(play: Play): Promise<{ fileName: string; version: VersionToken }> {
    const dir = await this.playsDir()
    const fileName = playFileName(play)
    const existing = this.entries.get(fileName)
    if (existing && !existing.result.ok) throw new InvalidStoredFileError(fileName)
    const text = serialize(play)
    const handle = await writeTextFile(dir, fileName, text)
    const file = await handle.getFile()
    this.entries.set(fileName, {
      fileName,
      lastModified: file.lastModified,
      size: file.size,
      text,
      result: readPlayText(text),
    })
    this.lastIssuesKey = this.issuesKey()
    return { fileName, version: { lastModified: file.lastModified, size: file.size } }
  }

  async put(play: Play, options: PutOptions = {}): Promise<PutResult> {
    const existing = this.entriesFor(play.id)
    if (existing.length > 1) throw new ReadOnlyError(play.id)
    const current = existing[0]
    if (options.expected !== undefined) await this.checkUnchanged(play, current, options.expected)
    const saved: Play = { ...play, updatedAt: this.options.now().toISOString() }
    if (current && options.archivePrevious) await this.moveToTrash(current.fileName)
    const { fileName, version } = await this.writePlay(saved)
    // Renaming (DECISIONS Q5 / D-005): the new file is written, then the old one goes to the trash.
    if (current && !options.archivePrevious && current.fileName !== fileName) {
      await this.moveToTrash(current.fileName)
    }
    this.lastIssuesKey = this.issuesKey()
    return { play: saved, fileName, version }
  }

  /** Optimistic concurrency: refuses to write over a version changed on the other computer. */
  private async checkUnchanged(
    play: Play,
    current: FileEntry | undefined,
    expected: VersionToken | null,
  ): Promise<void> {
    if (!current) {
      if (expected !== null) throw new ConflictError(null, null)
      return
    }
    const handle = await tryGetFile(await this.playsDir(), current.fileName)
    if (!handle) throw new ConflictError(null, null)
    const file = await handle.getFile()
    if (expected && file.lastModified === expected.lastModified && file.size === expected.size)
      return
    const result = readPlayText(await file.text())
    if (!result.ok) throw new InvalidStoredFileError(current.fileName)
    // Confirmed by the content: same updatedAt as the version the caller started from.
    if (result.play.updatedAt === play.updatedAt) return
    throw new ConflictError(result.play, { lastModified: file.lastModified, size: file.size })
  }

  async remove(id: Id): Promise<void> {
    const existing = this.entriesFor(id)
    if (existing.length > 1) throw new ReadOnlyError(id)
    const entry = existing[0]
    if (!entry) throw new NotFoundInLibraryError(id)
    await this.moveToTrash(entry.fileName)
    this.lastIssuesKey = this.issuesKey()
  }

  async resolveDuplicate(id: Id, resolution: DuplicateResolution): Promise<void> {
    const entries = this.entriesFor(id)
    if (entries.length < 2) return
    if (resolution.kind === 'choose') {
      for (const entry of entries) {
        if (entry.fileName !== resolution.fileName) await this.moveToTrash(entry.fileName)
      }
    } else {
      // The first file keeps the id; every other one gets a new id and « (copie) » (D-022).
      for (const entry of entries.slice(1)) {
        const copy = keepBothCopy(entry.result.play, this.options.ids(), this.options.now())
        await this.writePlay(copy)
        await this.moveToTrash(entry.fileName)
      }
    }
    this.lastIssuesKey = this.issuesKey()
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
    for (const entry of this.entries.values()) {
      data[entry.fileName] = {
        lastModified: entry.lastModified,
        size: entry.size,
        text: entry.text,
      }
    }
    return data
  }
}
