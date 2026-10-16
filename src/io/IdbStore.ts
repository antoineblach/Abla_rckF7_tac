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
import type { ReadError } from './readPlay'
import { readPlayText } from './readPlay'
import { readPresetText } from './readPreset'
import { parseJson, serialize } from './serialize'

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
}

type OkEntry<T> = Entry<T> & { result: { ok: true; item: T } }

const versionOfText = (item: Stored, text: string): VersionToken => ({
  lastModified: Date.parse(item.updatedAt) || 0,
  size: text.length,
})

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

  constructor(
    readonly prefix: string,
    readonly collection: Collection,
    readonly read: (text: string) => EntryRead<T>,
  ) {}

  ok(): OkEntry<T>[] {
    return [...this.entries.values()]
      .filter((e): e is OkEntry<T> => e.result.ok)
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
      const value = await kv.get(key)
      const text = typeof value === 'string' ? value : JSON.stringify(value)
      const old = this.entries.get(key)
      next.set(key, old?.text === text ? old : { key, text, result: this.read(text) })
    }
    const found: ({ kind: 'added' | 'modified' | 'removed'; id: Id } | { kind: 'issues' })[] = []
    for (const [key, entry] of next) {
      const old = this.entries.get(key)
      if (!entry.result.ok) continue
      if (!old?.result.ok) found.push({ kind: 'added', id: entry.result.item.id })
      else if (contentHash(old.result.item) !== contentHash(entry.result.item)) {
        found.push({ kind: 'modified', id: entry.result.item.id })
      }
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
  ) {}

  static async open(kv: KeyValueStore, now: () => Date): Promise<IdbStore> {
    const store = new IdbStore(kv, now)
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
    return entry ? versionOfText(entry.result.item, entry.text) : null
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

  /** Writes an item with optimistic concurrency on its updatedAt (D-043). */
  private async write<T extends Stored>(
    set: EntrySet<T>,
    item: T,
    options: PutOptions,
  ): Promise<{ item: T; text: string }> {
    const key = `${set.prefix}${item.id}`
    const current = set.entries.get(key)
    if (current && !current.result.ok) throw new Error(`Invalid stored entry: ${item.id}`)
    if (options.expected !== undefined) {
      if (!current && options.expected !== null) throw new ConflictError<T>(null, null)
      if (current?.result.ok && current.result.item.updatedAt !== item.updatedAt) {
        throw new ConflictError<T>(
          current.result.item,
          versionOfText(current.result.item, current.text),
        )
      }
    }
    if (current && options.archivePrevious) await this.moveToTrash(set, current)
    const saved: T = { ...item, updatedAt: this.now().toISOString() }
    const text = serialize(saved)
    await this.kv.set(key, text)
    set.entries.set(key, { key, text, result: set.read(text) })
    return { item: saved, text }
  }

  async put(play: Play, options: PutOptions = {}): Promise<PutResult> {
    const { item, text } = await this.write(this.plays, play, options)
    return { play: item, fileName: null, version: versionOfText(item, text) }
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
    const { item, text } = await this.write(this.presets, preset, options)
    return { preset: item, version: versionOfText(item, text) }
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
    return entry ? versionOfText(entry.result.item, entry.text) : null
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
