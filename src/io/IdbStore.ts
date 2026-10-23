// Browser library in IndexedDB: degraded mode (Firefox, or no folder chosen) (SPEC 8.6).
// Same rules as the folder: removing moves to a trash, an invalid entry is never modified,
// settings and trash live in IndexedDB too (DECISIONS Q21 / D-021). Placement presets of lot 3
// are kept the same way, under their own keys (D-092).
import { contentHash } from '../model/canonical'
import type { PlacementPreset } from '../model/preset'
import { defaultSettings, readSettings, type Settings } from '../model/settings'
import type { Id, Play } from '../model/types'
import { kvKey, type KeyValueStore } from './kv'
import {
  ConflictError,
  NotFoundInLibraryError,
  type Change,
  type Collection,
  type DuplicateResolution,
  type LibraryIssue,
  type LibraryStore,
  type PlaySummary,
  type PresetEntry,
  type PutOptions,
  type PutResult,
  settingsResult,
  type SettingsResult,
  type VersionToken,
} from './LibraryStore'
import { OwnWrites } from './ownWrites'
import type { ReadError } from './readPlay'
import { readPlayText } from './readPlay'
import { readPresetText } from './readPreset'
import { parseJson, serialize } from './serialize'
import { shortHash, type SyncEventInput, type SyncEventKind, type SyncLog } from './syncLog'

const PLAY_PREFIX = kvKey('play:')
const PRESET_PREFIX = kvKey('preset:')
const TRASH_PREFIX = kvKey('trash:')
const SETTINGS_KEY = kvKey('settings')

interface Stored {
  id: Id
  updatedAt: string
}

type EntryRead<T> = { ok: true; item: T } | { ok: false; error: ReadError }

interface Entry<T> {
  key: string
  text: string
  result: EntryRead<T>
  /** Content hash of the item read from `text` (D-097); null for an invalid entry. */
  hash: string | null
}

type OkEntry<T> = Entry<T> & { result: { ok: true; item: T }; hash: string }

const isOk = <T>(entry: Entry<T>): entry is OkEntry<T> => entry.result.ok

/** Version of an entry: (updatedAt, length of the text), and the content hash (D-043, D-097). */
const versionOf = <T extends Stored>(entry: OkEntry<T>): VersionToken => ({
  lastModified: Date.parse(entry.result.item.updatedAt) || 0,
  size: entry.text.length,
  contentHash: entry.hash,
})

/** Text of a stored value (a string since lot 1; an object if written by hand). */
const textOf = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value)

const readPlay = (text: string): EntryRead<Play> => {
  const result = readPlayText(text)
  return result.ok ? { ok: true, item: result.play } : result
}

const readPreset = (text: string): EntryRead<PlacementPreset> => {
  const result = readPresetText(text)
  return result.ok ? { ok: true, item: result.preset } : result
}

/** Entries of one kind (plays or presets) under one key prefix. */
class EntrySet<T extends Stored> {
  entries = new Map<string, Entry<T>>()
  lastIssuesKey = ''
  /** Versions written by this page (D-098). */
  readonly own = new OwnWrites()

  constructor(
    readonly prefix: string,
    readonly collection: Collection,
    readonly read: (text: string) => EntryRead<T>,
  ) {}

  /** The one way to read a stored text: read and migrate, then hash the item obtained (D-097). */
  entry(key: string, text: string): Entry<T> {
    const result = this.read(text)
    return { key, text, result, hash: result.ok ? contentHash(result.item) : null }
  }

  ok(): OkEntry<T>[] {
    return [...this.entries.values()]
      .filter((e) => isOk(e))
      .sort((a, b) => a.key.localeCompare(b.key))
  }

  find(id: Id): OkEntry<T> | undefined {
    return this.ok().find((e) => e.result.item.id === id)
  }

  issues(): LibraryIssue[] {
    return [...this.entries.values()]
      .filter((e) => !e.result.ok)
      .map((e) => ({
        kind: 'invalid' as const,
        fileName: e.key.slice(this.prefix.length),
        error: e.result.ok ? { code: 'notAnObject' as const } : e.result.error,
      }))
  }

  /** Detects changes made by another tab of the same browser. */
  async scan(
    kv: KeyValueStore,
    keys: readonly string[],
  ): Promise<({ kind: 'added' | 'modified' | 'removed'; id: Id } | { kind: 'issues' })[]> {
    const next = new Map<string, Entry<T>>()
    for (const key of keys) {
      if (!key.startsWith(this.prefix)) continue
      const text = textOf(await kv.get(key))
      const old = this.entries.get(key)
      next.set(key, old?.text === text ? old : this.entry(key, text))
    }
    const found: ({ kind: 'added' | 'modified' | 'removed'; id: Id } | { kind: 'issues' })[] = []
    for (const [key, entry] of next) {
      const old = this.entries.get(key)
      if (!isOk(entry)) continue
      if (!old?.result.ok) found.push({ kind: 'added', id: entry.result.item.id })
      else if (old.hash !== entry.hash) found.push({ kind: 'modified', id: entry.result.item.id })
    }
    for (const [key, old] of this.entries) {
      if (!next.has(key) && old.result.ok) found.push({ kind: 'removed', id: old.result.item.id })
    }
    this.entries = next
    const issuesKey = JSON.stringify(this.issues())
    if (issuesKey !== this.lastIssuesKey) {
      found.push({ kind: 'issues' })
      this.lastIssuesKey = issuesKey
    }
    return found
  }
}

export class IdbStore implements LibraryStore {
  readonly kind = 'browser'
  private readonly plays = new EntrySet<Play>(PLAY_PREFIX, 'plays', readPlay)
  private readonly presets = new EntrySet<PlacementPreset>(PRESET_PREFIX, 'presets', readPreset)
  private readonly log: Change[] = []
  private currentStamp = 0

  private constructor(
    private readonly kv: KeyValueStore,
    private readonly now: () => Date,
    private readonly syncLog: SyncLog | undefined,
  ) {}

  /** `log`: synchronisation log of the page (D-100). */
  static async open(kv: KeyValueStore, now: () => Date, log?: SyncLog): Promise<IdbStore> {
    const store = new IdbStore(kv, now, log)
    await store.scan()
    store.log.length = 0
    return store
  }

  get stamp(): number {
    return this.currentStamp
  }

  private async scan(): Promise<void> {
    const keys = await this.kv.keys()
    const found: Change[] = []
    for (const set of [this.plays, this.presets] as const) {
      for (const change of await set.scan(this.kv, keys)) {
        found.push(
          change.kind === 'issues'
            ? { kind: 'issues', collection: set.collection, stamp: 0 }
            : { ...change, collection: set.collection, fileName: null, stamp: 0 },
        )
      }
    }
    if (found.length === 0) return
    this.currentStamp++
    this.log.push(...found.map((change) => ({ ...change, stamp: this.currentStamp })))
  }

  async changesSince(stamp: number): Promise<Change[]> {
    await this.scan()
    return this.log.filter((c) => c.stamp > stamp)
  }

  list(): Promise<PlaySummary[]> {
    return Promise.resolve(
      this.plays.ok().map((e) => ({
        id: e.result.item.id,
        name: e.result.item.name,
        category: e.result.item.category,
        updatedAt: e.result.item.updatedAt,
        fileName: null,
        readOnly: false,
      })),
    )
  }

  get(id: Id): Promise<Play> {
    const entry = this.plays.find(id)
    if (!entry) return Promise.reject(new NotFoundInLibraryError(id))
    return Promise.resolve(structuredClone(entry.result.item))
  }

  versionOf(id: Id): VersionToken | null {
    const entry = this.plays.find(id)
    return entry ? versionOf(entry) : null
  }

  isOwnWrite(collection: Collection, id: Id, hash: string): boolean {
    return (collection === 'plays' ? this.plays : this.presets).own.isOwn(id, hash)
  }

  issues(): Promise<LibraryIssue[]> {
    return Promise.resolve(this.plays.issues())
  }

  private async moveToTrash<T extends Stored>(set: EntrySet<T>, entry: Entry<T>): Promise<void> {
    // Trash keys of plays are unchanged since lot 1; presets are marked as such.
    const id = entry.key.slice(set.prefix.length)
    const name = set.collection === 'plays' ? id : `preset:${id}`
    await this.kv.set(`${TRASH_PREFIX}${this.now().toISOString()}:${name}`, entry.text)
    await this.kv.del(entry.key)
    set.entries.delete(entry.key)
  }

  private logEntry<T extends Stored>(
    kind: SyncEventKind,
    set: EntrySet<T>,
    entry: OkEntry<T>,
    input: SyncEventInput,
  ): void {
    this.syncLog?.add(kind, {
      collection: set.collection,
      fileName: entry.key.slice(set.prefix.length),
      size: entry.text.length,
      updatedAt: entry.result.item.updatedAt,
      hash: entry.hash,
      ...input,
    })
  }

  /**
   * Optimistic concurrency (D-097): the entry is read again just before writing; its content must
   * be the version the caller started from, or a version written by this page (D-098).
   */
  private checkUnchanged<T extends Stored>(
    set: EntrySet<T>,
    stored: Entry<T> | null,
    expected: VersionToken | null,
  ): void {
    if (!stored) {
      if (expected !== null) throw new ConflictError<T>(null, null)
      return
    }
    if (!isOk(stored)) throw new Error(`Invalid stored entry: ${stored.key}`)
    const id = stored.result.item.id
    if (expected && stored.hash === expected.contentHash) return
    if (set.own.isOwn(id, stored.hash)) {
      this.logEntry('check', set, stored, {
        origin: 'page',
        detail: 'version écrite par cette page : écriture acceptée',
      })
      return
    }
    this.logEntry('check', set, stored, {
      origin: 'external',
      detail: `contenu jamais écrit par cette page (départ ${expected ? shortHash(expected.contentHash) : 'aucun'}) : écriture refusée`,
    })
    throw new ConflictError<T>(stored.result.item, versionOf(stored))
  }

  /** Writes an item with optimistic concurrency on its content (D-097). */
  private async write<T extends Stored>(
    set: EntrySet<T>,
    item: T,
    options: PutOptions,
  ): Promise<{ item: T; entry: OkEntry<T> }> {
    const key = `${set.prefix}${item.id}`
    const value = await this.kv.get(key)
    const stored = value === undefined ? null : set.entry(key, textOf(value))
    if (stored && !stored.result.ok) throw new Error(`Invalid stored entry: ${item.id}`)
    if (options.expected !== undefined) this.checkUnchanged(set, stored, options.expected)
    if (stored && options.archivePrevious) await this.moveToTrash(set, stored)
    const saved: T = { ...item, updatedAt: this.now().toISOString() }
    const text = serialize(saved)
    await this.kv.set(key, text)
    const entry = set.entry(key, text)
    set.entries.set(key, entry)
    if (!isOk(entry)) throw new Error(`The written entry cannot be read back: ${item.id}`)
    set.own.written(item.id, { hash: entry.hash, text, fileName: null })
    this.logEntry('write', set, entry, { origin: 'page' })
    return { item: saved, entry }
  }

  async put(play: Play, options: PutOptions = {}): Promise<PutResult> {
    const { item, entry } = await this.write(this.plays, play, options)
    return { play: item, fileName: null, version: versionOf(entry) }
  }

  async remove(id: Id): Promise<void> {
    const entry = this.plays.find(id)
    if (!entry) throw new NotFoundInLibraryError(id)
    await this.moveToTrash(this.plays, entry)
  }

  resolveDuplicate(_id: Id, _resolution: DuplicateResolution): Promise<void> {
    // Keys are ids: duplicates cannot exist in the browser library.
    return Promise.resolve()
  }

  // Placement presets (lot 3).

  listPresets(): Promise<PresetEntry[]> {
    return Promise.resolve(
      this.presets
        .ok()
        .map((e) => ({ preset: structuredClone(e.result.item), fileName: null, readOnly: false })),
    )
  }

  getPreset(id: Id): Promise<PlacementPreset> {
    const entry = this.presets.find(id)
    if (!entry) return Promise.reject(new NotFoundInLibraryError(id))
    return Promise.resolve(structuredClone(entry.result.item))
  }

  async putPreset(
    preset: PlacementPreset,
    options: { expected?: VersionToken | null } = {},
  ): Promise<{ preset: PlacementPreset; version: VersionToken | null }> {
    const { item, entry } = await this.write(this.presets, preset, options)
    return { preset: item, version: versionOf(entry) }
  }

  async removePreset(id: Id): Promise<void> {
    const entry = this.presets.find(id)
    if (!entry) throw new NotFoundInLibraryError(id)
    await this.moveToTrash(this.presets, entry)
  }

  presetIssues(): Promise<LibraryIssue[]> {
    return Promise.resolve(this.presets.issues())
  }

  resolvePresetDuplicate(_id: Id, _resolution: DuplicateResolution): Promise<void> {
    return Promise.resolve()
  }

  presetVersionOf(id: Id): VersionToken | null {
    const entry = this.presets.find(id)
    return entry ? versionOf(entry) : null
  }

  async getSettings(): Promise<SettingsResult> {
    const value = await this.kv.get(SETTINGS_KEY)
    if (value === undefined) return { ok: true, settings: defaultSettings() }
    if (typeof value !== 'string') return settingsResult(readSettings(value))
    const parsed = parseJson(value)
    if (!parsed.ok) return { ok: false, settings: defaultSettings(), message: parsed.message }
    return settingsResult(readSettings(parsed.value))
  }

  async putSettings(settings: Settings): Promise<void> {
    // Invalid or newer settings are never overwritten (SPEC 4.4, D-024).
    if (!(await this.getSettings()).ok) throw new Error('Stored settings are never overwritten')
    await this.kv.set(SETTINGS_KEY, serialize(settings))
  }

  /** Every play, for the copy to a folder chosen later (DECISIONS Q21 / D-021). */
  async allPlays(): Promise<Play[]> {
    await this.scan()
    return this.plays.ok().map((e) => structuredClone(e.result.item))
  }

  /** Every preset, copied with the plays to a folder chosen later (D-092). */
  async allPresets(): Promise<PlacementPreset[]> {
    await this.scan()
    return this.presets.ok().map((e) => structuredClone(e.result.item))
  }
}
