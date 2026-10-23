// A collection of JSON files in one directory of the chosen folder (SPEC 8.2 to 8.5): the plays
// of combinaisons/ and the placement presets of modeles/ (lot 3, D-092). Extracted from the play
// index of FolderStore (lot 1). Rules: a file is never deleted (removing = moving to _corbeille/),
// an invalid file is never modified nor moved, a write never overwrites a version changed by the
// other computer. Every content hash is the hash of the item read back from the stored text
// (D-097); a version written by this page is never an external change (D-098).
import { contentHash } from '../model/canonical'
import type { IdFactory } from '../model/ids'
import type { Id } from '../model/types'
import { TRASH_DIR, isScannedPlayFile } from './fileNames'
import { tryGetFile, writeTextFile, type FsDirectoryHandle } from './fs/types'
import {
  ConflictError,
  NotFoundInLibraryError,
  ReadOnlyError,
  type Collection,
  type DuplicateResolution,
  type LibraryIssue,
  type PutOptions,
  type VersionToken,
} from './LibraryStore'
import { OwnWrites, type ReferenceVersion } from './ownWrites'
import type { ReadError } from './readPlay'
import { serialize } from './serialize'
import {
  localTime,
  shortHash,
  type SyncEventInput,
  type SyncEventKind,
  type SyncLog,
} from './syncLog'
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
  /** Name of the collection in the changes, the versions written by the page and the log. */
  collection: Collection
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
  /** Synchronisation log of the page (D-100). */
  log?: SyncLog
}

export type CollectionChange =
  { kind: 'added' | 'modified' | 'removed'; id: Id; fileName: string } | { kind: 'issues' }

interface FileEntry<T> {
  fileName: string
  lastModified: number
  size: number
  text: string
  result: ItemRead<T>
  /** Content hash of the item read from `text` (D-097); null for an invalid file. */
  hash: string | null
}

type OkEntry<T> = FileEntry<T> & { result: { ok: true; item: T }; hash: string }

const isOk = <T>(entry: FileEntry<T>): entry is OkEntry<T> => entry.result.ok

const tokenOf = <T>(entry: OkEntry<T>): VersionToken => ({
  lastModified: entry.lastModified,
  size: entry.size,
  contentHash: entry.hash,
})

interface Rollback<T> {
  entry: OkEntry<T>
  old: FileEntry<T> | undefined
  target: ReferenceVersion
}

export class FileCollection<T extends StoredItem> {
  private readonly entries = new Map<string, FileEntry<T>>()
  private lastIssuesKey = ''
  /** Versions written by this page and reference of each id (D-098). */
  private readonly own = new OwnWrites()
  private scanned = false

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

  /** The one way to read a stored text: read and migrate, then hash the item obtained (D-097). */
  private entry(
    fileName: string,
    file: { lastModified: number; size: number },
    text: string,
  ): FileEntry<T> {
    const result = this.spec.read(text)
    return {
      fileName,
      lastModified: file.lastModified,
      size: file.size,
      text,
      result,
      hash: result.ok ? contentHash(result.item) : null,
    }
  }

  private log(kind: SyncEventKind, entry: FileEntry<T> | null, input: SyncEventInput = {}): void {
    this.options.log?.add(kind, {
      collection: this.spec.collection,
      ...(entry
        ? {
            fileName: entry.fileName,
            lastModified: entry.lastModified,
            size: entry.size,
            updatedAt: entry.result.ok ? entry.result.item.updatedAt : null,
            hash: entry.hash,
          }
        : {}),
      ...input,
    })
  }

  private originOf(entry: OkEntry<T>): 'page' | 'external' {
    return this.own.isOwn(entry.result.item.id, entry.hash) ? 'page' : 'external'
  }

  private okEntries(): OkEntry<T>[] {
    return [...this.entries.values()]
      .filter((e) => isOk(e))
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

  /** Change of one file between two reads. */
  private changeOf(
    fileName: string,
    old: FileEntry<T> | undefined,
    entry: FileEntry<T>,
  ): CollectionChange[] {
    const changes: CollectionChange[] = []
    const oldItem = old?.result.ok ? old.result.item : null
    const newItem = entry.result.ok ? entry.result.item : null
    if (oldItem && (!newItem || newItem.id !== oldItem.id)) {
      changes.push({ kind: 'removed', id: oldItem.id, fileName })
    }
    if (newItem && (!oldItem || newItem.id !== oldItem.id)) {
      changes.push({ kind: 'added', id: newItem.id, fileName })
    } else if (newItem && old && entry.hash !== old.hash) {
      changes.push({ kind: 'modified', id: newItem.id, fileName })
    }
    return changes
  }

  private readDetail(old: FileEntry<T> | undefined, entry: FileEntry<T>): string {
    if (!entry.result.ok) return 'fichier invalide'
    if (!old) return 'nouveau fichier'
    return old.hash === entry.hash ? 'contenu identique' : 'contenu changé'
  }

  /**
   * Full rescan (SPEC 8.3): a change is detected by modification date and size, then confirmed
   * by the content. A content written earlier by this page is never an external change; when it
   * is not the reference, the reference is written back (D-098).
   */
  async scan(): Promise<CollectionChange[]> {
    const dir = await this.dir()
    // The first scan (opening of the folder) is summed up in one line of the log.
    const quiet = !this.scanned
    this.scanned = true
    const seen = new Set<string>()
    const found: CollectionChange[] = []
    const rollbacks: Rollback<T>[] = []
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
      const entry = this.entry(name, file, text)
      this.entries.set(name, entry)
      if (isOk(entry)) {
        const id = entry.result.item.id
        const target = this.own.rollbackTarget(id, entry.hash, name)
        if (target) {
          rollbacks.push({ entry, old, target })
          continue
        }
        if (!this.own.isOwn(id, entry.hash)) {
          this.own.readFromOutside(id, { hash: entry.hash, text, fileName: name })
        }
      }
      found.push(...this.changeOf(name, old, entry))
      if (!quiet) {
        this.log('read', entry, {
          origin: isOk(entry) ? this.originOf(entry) : null,
          detail: this.readDetail(old, entry),
        })
      }
    }
    for (const [name, entry] of [...this.entries]) {
      if (seen.has(name)) continue
      this.entries.delete(name)
      if (entry.result.ok) found.push({ kind: 'removed', id: entry.result.item.id, fileName: name })
      this.log('read', entry, { detail: 'fichier disparu' })
    }
    for (const rollback of rollbacks) found.push(...(await this.undoRollback(dir, rollback)))
    const issuesKey = this.issuesKey()
    if (issuesKey !== this.lastIssuesKey) {
      found.push({ kind: 'issues' })
      this.lastIssuesKey = issuesKey
    }
    if (quiet) {
      this.log('open', null, { detail: `${String(this.entries.size)} fichiers lus` })
    }
    return found
  }

  /**
   * A file went back to an older version written by this page (synchronisation): the reference is
   * written back, identical, unless a conflict copy exists or the file changed again (D-098).
   */
  private async undoRollback(
    dir: FsDirectoryHandle,
    rollback: Rollback<T>,
  ): Promise<CollectionChange[]> {
    const { entry, old, target } = rollback
    const fileName = entry.fileName
    if (this.entriesFor(entry.result.item.id).length > 1) {
      this.log('read', entry, {
        origin: 'page',
        detail: 'version antérieure de cette page, copie de conflit présente : rien n’est réécrit',
      })
      return this.changeOf(fileName, old, entry)
    }
    // Read again just before writing: a newer change is left to the next rescan.
    const handle = await tryGetFile(dir, fileName)
    const again = handle ? await handle.getFile() : null
    if (!again || again.lastModified !== entry.lastModified || again.size !== entry.size) {
      this.log('read', entry, {
        origin: 'page',
        detail: 'version antérieure de cette page, fichier changé depuis : rien n’est réécrit',
      })
      return this.changeOf(fileName, old, entry)
    }
    this.log('rollback', entry, {
      origin: 'page',
      detail: `version antérieure de cette page : référence ${shortHash(target.hash)} réécrite`,
    })
    const written = await this.writeText(fileName, target.text)
    return this.changeOf(fileName, old, written)
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
    return entry ? tokenOf(entry) : null
  }

  /** One of the last versions of this item written by this page (D-098). */
  isOwnWrite(id: Id, hash: string): boolean {
    return this.own.isOwn(id, hash)
  }

  private async moveToTrash(fileName: string): Promise<void> {
    await moveToTrash(await this.dir(), fileName, await this.trashDir(), this.options.now())
    this.entries.delete(fileName)
  }

  /** Writes a text and reads it back: the entry, the page versions and the log follow it. */
  private async writeText(fileName: string, text: string): Promise<OkEntry<T>> {
    const handle = await writeTextFile(await this.dir(), fileName, text)
    const entry = this.entry(fileName, await handle.getFile(), text)
    this.entries.set(fileName, entry)
    if (!isOk(entry)) throw new Error(`The written file cannot be read back: ${fileName}`)
    this.own.written(entry.result.item.id, { hash: entry.hash, text, fileName })
    this.log('write', entry, { origin: 'page' })
    return entry
  }

  private async write(item: T): Promise<{ fileName: string; version: VersionToken }> {
    const fileName = this.spec.fileName(item)
    const existing = this.entries.get(fileName)
    if (existing && !existing.result.ok) throw new InvalidStoredFileError(fileName)
    const entry = await this.writeText(fileName, serialize(item))
    this.lastIssuesKey = this.issuesKey()
    return { fileName, version: tokenOf(entry) }
  }

  async put(
    item: T,
    options: PutOptions = {},
  ): Promise<{ item: T; fileName: string; version: VersionToken }> {
    const existing = this.entriesFor(item.id)
    if (existing.length > 1) throw new ReadOnlyError(item.id)
    const current = existing[0]
    if (options.expected !== undefined)
      await this.checkUnchanged(item.id, current, options.expected)
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

  /**
   * Optimistic concurrency (D-097): the same date and size as the version the caller started from
   * suffice; otherwise the file is read again, and its content must be that version or a version
   * written by this page (D-098). A different date or size never proves a conflict.
   */
  private async checkUnchanged(
    id: Id,
    current: OkEntry<T> | undefined,
    expected: VersionToken | null,
  ): Promise<void> {
    if (!current) {
      if (expected !== null) throw new ConflictError<T>(null, null)
      return
    }
    const handle = await tryGetFile(await this.dir(), current.fileName)
    if (!handle) {
      this.log('check', current, { detail: 'fichier disparu : écriture refusée' })
      throw new ConflictError<T>(null, null)
    }
    const file = await handle.getFile()
    const base = expected
      ? `départ ${shortHash(expected.contentHash)} du ${localTime(expected.lastModified)}, ${String(expected.size)} octets`
      : 'aucune version de départ'
    if (expected && file.lastModified === expected.lastModified && file.size === expected.size) {
      this.log('check', current, { detail: 'date et taille inchangées : écriture acceptée' })
      return
    }
    const entry = this.entry(current.fileName, file, await file.text())
    if (!isOk(entry)) {
      this.log('check', entry, { detail: 'fichier invalide : écriture refusée' })
      throw new InvalidStoredFileError(current.fileName)
    }
    if (expected && entry.hash === expected.contentHash) {
      this.log('check', entry, {
        origin: this.originOf(entry),
        detail: `date ou taille changée, même contenu que la version de départ (${base}) : écriture acceptée`,
      })
      return
    }
    if (this.own.isOwn(id, entry.hash)) {
      this.log('check', entry, {
        origin: 'page',
        detail: `version écrite par cette page (${base}) : écriture acceptée`,
      })
      return
    }
    this.log('check', entry, {
      origin: 'external',
      detail: `contenu jamais écrit par cette page (${base}) : écriture refusée`,
    })
    throw new ConflictError<T>(entry.result.item, tokenOf(entry))
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
