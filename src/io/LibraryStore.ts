// Library storage interface (SPEC 8.1), extended for lot 1 (DECISIONS Q20 / D-020).
// Two implementations: FolderStore (main, Chrome) and IdbStore (degraded mode).
import { defaultSettings, type Settings, type SettingsReadResult } from '../model/settings'
import type { Id, Play, PlayCategory } from '../model/types'
import type { ReadError } from './readPlay'

export interface PlaySummary {
  id: Id
  name: string
  category: PlayCategory
  updatedAt: string
  /** File name in folder mode, null in the browser library. */
  fileName: string | null
  /** True while another file carries the same id (DECISIONS Q22 / D-022). */
  readOnly: boolean
}

/** Version of a stored play, used for optimistic concurrency. */
export interface VersionToken {
  lastModified: number
  size: number
}

export type LibraryIssue =
  | { kind: 'invalid'; fileName: string; error: ReadError }
  | { kind: 'duplicate'; id: Id; fileNames: string[] }

export type Change =
  | { kind: 'added' | 'modified' | 'removed'; id: Id; fileName: string | null; stamp: number }
  | { kind: 'issues'; stamp: number }

export interface PutOptions {
  /**
   * Version known by the caller. If the stored play changed since (other computer), the write
   * is refused with a ConflictError. Undefined: no check (« Garder la mienne »).
   */
  expected?: VersionToken | null
  /** Move the previous version to the trash before writing (import « Remplacer », D-022). */
  archivePrevious?: boolean
}

export interface PutResult {
  /** The play as written (updatedAt set at save time). */
  play: Play
  fileName: string | null
  version: VersionToken | null
}

export type DuplicateResolution = { kind: 'keepBoth' } | { kind: 'choose'; fileName: string }

/**
 * Settings read from storage. When they are invalid or of a newer version (`future`), defaults
 * are used and the stored settings are never rewritten.
 */
export type SettingsResult =
  | { ok: true; settings: Settings }
  | { ok: false; settings: Settings; message: string; future?: boolean }

/** Settings result of validated and migrated content (SPEC 4.4, D-068). */
export function settingsResult(read: SettingsReadResult): SettingsResult {
  return read.ok
    ? { ok: true, settings: read.settings }
    : { ok: false, settings: defaultSettings(), message: read.message, future: read.future }
}

export class ConflictError extends Error {
  constructor(
    /** Version currently stored, null when it was removed. */
    readonly current: Play | null,
    readonly currentVersion: VersionToken | null,
  ) {
    super('The stored play changed since it was read')
    this.name = 'ConflictError'
  }
}

export class ReadOnlyError extends Error {
  constructor(readonly id: Id) {
    super('Several files carry this id: resolve the duplicate first')
    this.name = 'ReadOnlyError'
  }
}

export class NotFoundInLibraryError extends Error {
  constructor(readonly id: Id) {
    super(`Play not found: ${id}`)
    this.name = 'NotFoundInLibraryError'
  }
}

export interface LibraryStore {
  readonly kind: 'folder' | 'browser'
  list(): Promise<PlaySummary[]>
  get(id: Id): Promise<Play>
  put(play: Play, options?: PutOptions): Promise<PutResult>
  /** Moves the play to the trash; never deletes (SPEC 8.5). */
  remove(id: Id): Promise<void>
  /** Rescans the storage and returns the changes recorded after `stamp`. */
  changesSince(stamp: number): Promise<Change[]>
  readonly stamp: number
  issues(): Promise<LibraryIssue[]>
  resolveDuplicate(id: Id, resolution: DuplicateResolution): Promise<void>
  /** Version of the stored play, as known after the last read or write. */
  versionOf(id: Id): VersionToken | null
  getSettings(): Promise<SettingsResult>
  putSettings(settings: Settings): Promise<void>
}
