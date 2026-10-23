// Library storage interface (SPEC 8.1), extended for lot 1 (DECISIONS Q20 / D-020) and for the
// placement presets of lot 3, which go through the same layer (SPEC 8.1, D-092).
// Two implementations: FolderStore (main, Chrome) and IdbStore (degraded mode).
import type { PlacementPreset } from '../model/preset'
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

/**
 * Version of a stored play or preset, used for optimistic concurrency. Kept in memory only (editor,
 * dialogs), never written.
 */
export interface VersionToken {
  lastModified: number
  size: number
  /**
   * Content hash of the item read back from the stored text (D-097): the base of the concurrency.
   * A different date or size never proves a conflict.
   */
  contentHash: string
}

export type LibraryIssue =
  | { kind: 'invalid'; fileName: string; error: ReadError }
  | { kind: 'duplicate'; id: Id; fileNames: string[] }

/** Collection of a change: the plays of combinaisons/ or the presets of modeles/ (lot 3). */
export type Collection = 'plays' | 'presets'

export type Change =
  | {
      kind: 'added' | 'modified' | 'removed'
      collection: Collection
      id: Id
      fileName: string | null
      stamp: number
    }
  | { kind: 'issues'; collection: Collection; stamp: number }

/** A stored placement preset with its file (SPEC 10.1). */
export interface PresetEntry {
  preset: PlacementPreset
  /** File name in folder mode, null in the browser library. */
  fileName: string | null
  /** True while another file carries the same id (D-022, D-092). */
  readOnly: boolean
}

export interface PutOptions {
  /**
   * Version known by the caller. If the stored play changed since (other computer: a content that
   * is neither this version nor a version written by this page, D-097, D-098), the write is
   * refused with a ConflictError. Undefined: no check (« Garder la mienne »).
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

export class ConflictError<T = Play> extends Error {
  constructor(
    /** Version currently stored, null when it was removed. */
    readonly current: T | null,
    readonly currentVersion: VersionToken | null,
  ) {
    super('The stored item changed since it was read')
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
  /**
   * True when `hash` is one of the last versions of this play or preset written by this page: such
   * a content is never an external change (D-098).
   */
  isOwnWrite(collection: Collection, id: Id, hash: string): boolean
  getSettings(): Promise<SettingsResult>
  putSettings(settings: Settings): Promise<void>
  // Placement presets (lot 3, SPEC 10.1, D-092).
  listPresets(): Promise<PresetEntry[]>
  getPreset(id: Id): Promise<PlacementPreset>
  /**
   * Writes a preset (updatedAt set at save time); renaming writes the new file then moves the
   * old one to the trash. With `expected`, refused by a ConflictError when it changed elsewhere.
   */
  putPreset(
    preset: PlacementPreset,
    options?: { expected?: VersionToken | null },
  ): Promise<{ preset: PlacementPreset; version: VersionToken | null }>
  /** Moves the preset to the trash; never deletes (SPEC 8.5). */
  removePreset(id: Id): Promise<void>
  presetIssues(): Promise<LibraryIssue[]>
  resolvePresetDuplicate(id: Id, resolution: DuplicateResolution): Promise<void>
  presetVersionOf(id: Id): VersionToken | null
}
