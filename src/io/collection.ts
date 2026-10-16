// A collection of JSON files in one directory of the chosen folder (SPEC 8.2 to 8.5): the plays
// of combinaisons/ and the placement presets of modeles/ (lot 3, D-092). Extracted from the play
// index of FolderStore (lot 1). Rules: a file is never deleted (removing = moving to _corbeille/),
// an invalid file is never modified nor moved, a write never overwrites a version changed by the
// other computer.
import { contentHash } from '../model/canonical'
import type { IdFactory } from '../model/ids'
import type { Id } from '../model/types'
import { TRASH_DIR, isScannedPlayFile } from './fileNames'
import { tryGetFile, writeTextFile, type FsDirectoryHandle } from './fs/types'
import {
  ConflictError,
  NotFoundInLibraryError,
  ReadOnlyError,
  type DuplicateResolution,
  type LibraryIssue,
  type PutOptions,
  type VersionToken,
} from './LibraryStore'
import type { ReadError } from './readPlay'
import { serialize } from './serialize'
import { moveToTrash } from './trash'

export interface StoredItem {
  id: Id
  name: string
  updatedAt: string
}

export type ItemRead<T> = { ok: true; item: T } | { ok: false; error: ReadError }

export class InvalidStoredFileError extends Error {
  constructor(readonly fileName: string) {
    super(`The stored file is invalid and is never overwritten: ${fileName}`)
    this.name = 'InvalidStoredFileError'
  }
}

/** Read cache persisted between sessions (SPEC 3.5): avoids rereading unchanged files. */
export type ReadCacheData = Record<string, { lastModified: number; size: number; text: string }>

export interface CollectionSpec<T extends StoredItem> {
  /** Directory under the chosen folder. */
  dir: string
  /** Prefix of the keys of the read cache ('' for the plays, kept from lot 1). */
  cachePrefix: string
  fileName(item: T): string
  read(text: string): ItemRead<T>
  /** « Garder les deux »: copy with a new id (D-022). */
  keepBoth(item: T, newId: Id, now: Date): T
}

export interface CollectionOptions {
  now: () => Date
  ids: IdFactory
  cache?: ReadCacheData
}

export type CollectionChange =
  { kind: 'added' | 'modified' | 'removed'; id: Id; fileName: string } | { kind: 'issues' }

interface FileEntry<T> {
  fileName: string
  lastModified: number
  size: number
  text: string
  result: ItemRead<T>
}

type OkEntry<T> = FileEntry<T> & { result: { ok: true; item: T } }

export class FileCollection<T extends StoredItem> {
  private readonly entries = new Map<string, FileEntry<T>>()
  private lastIssuesKey = ''

  constructor(
    private readonly root: FsDirectoryHandle,
    private readonly spec: CollectionSpec<T>,
    private readonly options: CollectionOptions,
  ) {}

  private dir(): Promise<FsDirectoryHandle> {
    return this.root.getDirectoryHandle(this.spec.dir, { create: true })
  }

  private trashDir(): Promise<FsDirectoryHandle> {
    return this.root.getDirectoryHandle(TRASH_DIR, { create: true })
  }

  private okEntries(): OkEntry<T>[] {
    return [...this.entries.values()]
      .filter((e): e is OkEntry<T> => e.result.ok)
      .sort((a, b) => a.fileName.localeCompare(b.fileName))
  }

  private entriesFor(id: Id): OkEntry<T>[] {
    return this.okEntries().filter((e) => e.result.item.id === id)
  }

  private issuesKey(): string {
    return JSON.stringify(this.issues())
  }

  /** Invalid files and files carrying the same id (Drive conflict copies). */
  issues(): LibraryIssue[] {
    const issues: LibraryIssue[] = []
    for (const entry of [...this.entries.values()].sort((a, b) =>
      a.fileName.localeCompare(b.fileName),
    )) {
      if (!entry.result.ok)
        issues.push({ kind: 'invalid', fileName: entry.fileName, error: entry.result.error })
    }
    const byId = new Map<Id, string[]>()
    for (const entry of this.okEntries()) {
      const names = byId.get(entry.result.item.id) ?? []
      names.push(entry.fileName)
      byId.set(entry.result.item.id, names)
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
  async scan(): Promise<CollectionChange[]> {
    const dir = await this.dir()
    const seen = new Set<string>()
    const found: CollectionChange[] = []
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== 'file' || !isScannedPlayFile(name)) continue
      seen.add(name)
      const file = await handle.getFile()
      const old = this.entries.get(name)
      if (old && old.lastModified === file.lastModified && old.size === file.size) continue
      const cached = old ? undefined : this.options.cache?.[`${this.spec.cachePrefix}${name}`]
      const text =
        cached && cached.lastModified === file.lastModified && cached.size === file.size
          ? cached.text
          : await file.text()
      const result = this.spec.read(text)
      this.entries.set(name, {
        fileName: name,
        lastModified: file.lastModified,
        size: file.size,
        text,
        result,
      })
      const oldItem = old?.result.ok ? old.result.item : null
      const newItem = result.ok ? result.item : null
      if (oldItem && (!newItem || newItem.id !== oldItem.id)) {
        found.push({ kind: 'removed', id: oldItem.id, fileName: name })
      }
      if (newItem && (!oldItem || newItem.id !== oldItem.id)) {
        found.push({ kind: 'added', id: newItem.id, fileName: name })
      } else if (newItem && oldItem && contentHash(newItem) !== contentHash(oldItem)) {
        found.push({ kind: 'modified', id: newItem.id, fileName: name })
      }
    }
    for (const [name, entry] of [...this.entries]) {
      if (seen.has(name)) continue
      this.entries.delete(name)
      if (entry.result.ok) found.push({ kind: 'removed', id: entry.result.item.id, fileName: name })
    }
    const issuesKey = this.issuesKey()
    if (issuesKey !== this.lastIssuesKey) {
      found.push({ kind: 'issues' })
      this.lastIssuesKey = issuesKey
    }
    return found
  }

  /** Valid items in file name order; read only while another file carries the same id. */
  items(): { item: T; fileName: string; readOnly: boolean }[] {
    const counts = new Map<Id, number>()
    for (const e of this.okEntries())
      counts.set(e.result.item.id, (counts.get(e.result.item.id) ?? 0) + 1)
    return this.okEntries().map((e) => ({
      item: e.result.item,
      fileName: e.fileName,
      readOnly: (counts.get(e.result.item.id) ?? 0) > 1,
    }))
  }

  get(id: Id): Promise<T> {
    const entry = this.entriesFor(id)[0]
    if (!entry) return Promise.reject(new NotFoundInLibraryError(id))
    return Promise.resolve(structuredClone(entry.result.item))
  }

  /** Item stored in a given file (to open one side of a duplicate). */
  getFile(fileName: string): Promise<T> {
    const entry = this.entries.get(fileName)
    if (!entry?.result.ok) return Promise.reject(new Error(`No valid item in ${fileName}`))
    return Promise.resolve(structuredClone(entry.result.item))
  }

  versionOf(id: Id): VersionToken | null {
    const entry = this.entriesFor(id)[0]
    return entry ? { lastModified: entry.lastModified, size: entry.size } : null
  }

  private async moveToTrash(fileName: string): Promise<void> {
    await moveToTrash(await this.dir(), fileName, await this.trashDir(), this.options.now())
    this.entries.delete(fileName)
  }

  private async write(item: T): Promise<{ fileName: string; version: VersionToken }> {
    const dir = await this.dir()
    const fileName = this.spec.fileName(item)
    const existing = this.entries.get(fileName)
    if (existing && !existing.result.ok) throw new InvalidStoredFileError(fileName)
    const text = serialize(item)
    const handle = await writeTextFile(dir, fileName, text)
    const file = await handle.getFile()
    this.entries.set(fileName, {
      fileName,
      lastModified: file.lastModified,
      size: file.size,
      text,
      result: this.spec.read(text),
    })
    this.lastIssuesKey = this.issuesKey()
    return { fileName, version: { lastModified: file.lastModified, size: file.size } }
  }

  async put(
    item: T,
    options: PutOptions = {},
  ): Promise<{ item: T; fileName: string; version: VersionToken }> {
    const existing = this.entriesFor(item.id)
    if (existing.length > 1) throw new ReadOnlyError(item.id)
    const current = existing[0]
    if (options.expected !== undefined) await this.checkUnchanged(item, current, options.expected)
    const saved: T = { ...item, updatedAt: this.options.now().toISOString() }
    if (current && options.archivePrevious) await this.moveToTrash(current.fileName)
    const { fileName, version } = await this.write(saved)
    // Renaming (DECISIONS Q5 / D-005): the new file is written, then the old one goes to the trash.
    if (current && !options.archivePrevious && current.fileName !== fileName) {
      await this.moveToTrash(current.fileName)
    }
    this.lastIssuesKey = this.issuesKey()
    return { item: saved, fileName, version }
  }

  /** Optimistic concurrency: refuses to write over a version changed on the other computer. */
  private async checkUnchanged(
    item: T,
    current: FileEntry<T> | undefined,
    expected: VersionToken | null,
  ): Promise<void> {
    if (!current) {
      if (expected !== null) throw new ConflictError<T>(null, null)
      return
    }
    const handle = await tryGetFile(await this.dir(), current.fileName)
    if (!handle) throw new ConflictError<T>(null, null)
    const file = await handle.getFile()
    if (expected && file.lastModified === expected.lastModified && file.size === expected.size)
      return
    const result = this.spec.read(await file.text())
    if (!result.ok) throw new InvalidStoredFileError(current.fileName)
    // Confirmed by the content: same updatedAt as the version the caller started from.
    if (result.item.updatedAt === item.updatedAt) return
    throw new ConflictError<T>(result.item, {
      lastModified: file.lastModified,
      size: file.size,
    })
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
        const copy = this.spec.keepBoth(entry.result.item, this.options.ids(), this.options.now())
        await this.write(copy)
        await this.moveToTrash(entry.fileName)
      }
    }
    this.lastIssuesKey = this.issuesKey()
  }

  /** Adds the content of the read cache of this collection to `data`. */
  exportCache(data: ReadCacheData): void {
    for (const entry of this.entries.values()) {
      data[`${this.spec.cachePrefix}${entry.fileName}`] = {
        lastModified: entry.lastModified,
        size: entry.size,
        text: entry.text,
      }
    }
  }
}
