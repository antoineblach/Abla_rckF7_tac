// Browser library in IndexedDB: degraded mode (Firefox, or no folder chosen) (SPEC 8.6).
// Same rules as the folder: removing moves to a trash, an invalid entry is never modified,
// settings and trash live in IndexedDB too (DECISIONS Q21 / D-021).
import { contentHash } from '../model/canonical'
import { defaultSettings, settingsSchema, type Settings } from '../model/settings'
import type { Id, Play } from '../model/types'
import { kvKey, type KeyValueStore } from './kv'
import {
  ConflictError,
  NotFoundInLibraryError,
  type Change,
  type DuplicateResolution,
  type LibraryIssue,
  type LibraryStore,
  type PlaySummary,
  type PutOptions,
  type PutResult,
  type SettingsResult,
  type VersionToken,
} from './LibraryStore'
import { readPlayText, type ReadPlayResult } from './readPlay'
import { serialize } from './serialize'

const PLAY_PREFIX = kvKey('play:')
const TRASH_PREFIX = kvKey('trash:')
const SETTINGS_KEY = kvKey('settings')

interface Entry {
  key: string
  text: string
  result: ReadPlayResult
}

const versionOfText = (play: Play, text: string): VersionToken => ({
  lastModified: Date.parse(play.updatedAt) || 0,
  size: text.length,
})

export class IdbStore implements LibraryStore {
  readonly kind = 'browser'
  private entries = new Map<string, Entry>()
  private readonly log: Change[] = []
  private currentStamp = 0
  private lastIssuesKey = ''

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

  private okEntries(): (Entry & { result: { ok: true; play: Play } })[] {
    return [...this.entries.values()]
      .filter((e): e is Entry & { result: { ok: true; play: Play } } => e.result.ok)
      .sort((a, b) => a.key.localeCompare(b.key))
  }

  private entryFor(id: Id) {
    return this.okEntries().find((e) => e.result.play.id === id)
  }

  /** Detects changes made by another tab of the same browser. */
  private async scan(): Promise<void> {
    const next = new Map<string, Entry>()
    for (const key of await this.kv.keys()) {
      if (!key.startsWith(PLAY_PREFIX)) continue
      const value = await this.kv.get(key)
      const text = typeof value === 'string' ? value : JSON.stringify(value)
      const old = this.entries.get(key)
      next.set(key, old?.text === text ? old : { key, text, result: readPlayText(text) })
    }
    const found: ({ kind: 'added' | 'modified' | 'removed'; id: Id } | { kind: 'issues' })[] = []
    for (const [key, entry] of next) {
      const old = this.entries.get(key)
      if (!entry.result.ok) continue
      if (!old?.result.ok) found.push({ kind: 'added', id: entry.result.play.id })
      else if (contentHash(old.result.play) !== contentHash(entry.result.play)) {
        found.push({ kind: 'modified', id: entry.result.play.id })
      }
    }
    for (const [key, old] of this.entries) {
      if (!next.has(key) && old.result.ok) found.push({ kind: 'removed', id: old.result.play.id })
    }
    this.entries = next
    const issuesKey = JSON.stringify(this.computeIssues())
    if (issuesKey !== this.lastIssuesKey) {
      found.push({ kind: 'issues' })
      this.lastIssuesKey = issuesKey
    }
    if (found.length === 0) return
    this.currentStamp++
    this.log.push(
      ...found.map((change): Change =>
        change.kind === 'issues'
          ? { kind: 'issues', stamp: this.currentStamp }
          : { ...change, fileName: null, stamp: this.currentStamp },
      ),
    )
  }

  async changesSince(stamp: number): Promise<Change[]> {
    await this.scan()
    return this.log.filter((c) => c.stamp > stamp)
  }

  list(): Promise<PlaySummary[]> {
    return Promise.resolve(
      this.okEntries().map((e) => ({
        id: e.result.play.id,
        name: e.result.play.name,
        category: e.result.play.category,
        updatedAt: e.result.play.updatedAt,
        fileName: null,
        readOnly: false,
      })),
    )
  }

  get(id: Id): Promise<Play> {
    const entry = this.entryFor(id)
    if (!entry) return Promise.reject(new NotFoundInLibraryError(id))
    return Promise.resolve(structuredClone(entry.result.play))
  }

  versionOf(id: Id): VersionToken | null {
    const entry = this.entryFor(id)
    return entry ? versionOfText(entry.result.play, entry.text) : null
  }

  private computeIssues(): LibraryIssue[] {
    return [...this.entries.values()]
      .filter((e) => !e.result.ok)
      .map((e) => ({
        kind: 'invalid' as const,
        fileName: e.key.slice(PLAY_PREFIX.length),
        error: e.result.ok ? { code: 'notAnObject' as const } : e.result.error,
      }))
  }

  issues(): Promise<LibraryIssue[]> {
    return Promise.resolve(this.computeIssues())
  }

  private async moveToTrash(entry: Entry): Promise<void> {
    const id = entry.key.slice(PLAY_PREFIX.length)
    await this.kv.set(`${TRASH_PREFIX}${this.now().toISOString()}:${id}`, entry.text)
    await this.kv.del(entry.key)
    this.entries.delete(entry.key)
  }

  async put(play: Play, options: PutOptions = {}): Promise<PutResult> {
    const key = `${PLAY_PREFIX}${play.id}`
    const current = this.entries.get(key)
    if (current && !current.result.ok) throw new Error(`Invalid stored entry: ${play.id}`)
    if (options.expected !== undefined) {
      if (!current && options.expected !== null) throw new ConflictError(null, null)
      if (current?.result.ok && current.result.play.updatedAt !== play.updatedAt) {
        throw new ConflictError(
          current.result.play,
          versionOfText(current.result.play, current.text),
        )
      }
    }
    if (current && options.archivePrevious) await this.moveToTrash(current)
    const saved: Play = { ...play, updatedAt: this.now().toISOString() }
    const text = serialize(saved)
    await this.kv.set(key, text)
    this.entries.set(key, { key, text, result: readPlayText(text) })
    return { play: saved, fileName: null, version: versionOfText(saved, text) }
  }

  async remove(id: Id): Promise<void> {
    const entry = this.entryFor(id)
    if (!entry) throw new NotFoundInLibraryError(id)
    await this.moveToTrash(entry)
  }

  resolveDuplicate(_id: Id, _resolution: DuplicateResolution): Promise<void> {
    // Keys are play ids: duplicates cannot exist in the browser library.
    return Promise.resolve()
  }

  async getSettings(): Promise<SettingsResult> {
    const value = await this.kv.get(SETTINGS_KEY)
    if (value === undefined) return { ok: true, settings: defaultSettings() }
    const result = settingsSchema.safeParse(typeof value === 'string' ? JSON.parse(value) : value)
    if (!result.success)
      return {
        ok: false,
        settings: defaultSettings(),
        message: result.error.issues[0]?.message ?? '',
      }
    return { ok: true, settings: result.data }
  }

  async putSettings(settings: Settings): Promise<void> {
    await this.kv.set(SETTINGS_KEY, serialize(settings))
  }

  /** Every play, for the copy to a folder chosen later (DECISIONS Q21 / D-021). */
  async allPlays(): Promise<Play[]> {
    await this.scan()
    return this.okEntries().map((e) => structuredClone(e.result.play))
  }
}
