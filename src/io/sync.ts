// Synchronisation controller (SPEC 8.3, 8.4): automatic save 2 s after the last change, full
// rescan at start-up, on window focus and every 30 s while the window is visible; external
// changes reload silently or ask, depending on local unsaved changes.
import { AUTOSAVE_DELAY_SECONDS, FOLDER_RESCAN_PERIOD_SECONDS } from '../config/defaults'
import type { Play } from '../model/types'
import { decideExternalChange } from './conflicts'
import {
  ConflictError,
  type Change,
  type LibraryStore,
  type PutResult,
  type VersionToken,
} from './LibraryStore'

export interface OpenPlay {
  play: Play
  /** Version of the stored play this one started from; null for a play never saved. */
  version: VersionToken | null
  dirty: boolean
  readOnly: boolean
}

export type ExternalChange =
  | { kind: 'reloaded'; play: Play; version: VersionToken | null }
  | { kind: 'conflict'; stored: Play; version: VersionToken | null }
  | { kind: 'removed' }

export interface SyncHooks {
  getOpen(): OpenPlay | null
  saved(result: PutResult, savedFrom: Play): void
  externalChange(change: ExternalChange): void
  libraryChanged(changes: Change[]): void
  error(error: unknown): void
}

export interface SyncOptions {
  autosaveDelayMs?: number
  rescanPeriodMs?: number
  isVisible?: () => boolean
}

export class SyncController {
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null
  private rescanTimer: ReturnType<typeof setInterval> | null = null
  private stamp: number
  private busy: Promise<void> = Promise.resolve()
  private readonly autosaveDelayMs: number
  private readonly rescanPeriodMs: number
  private readonly isVisible: () => boolean

  constructor(
    private readonly store: LibraryStore,
    private readonly hooks: SyncHooks,
    options: SyncOptions = {},
  ) {
    this.stamp = store.stamp
    this.autosaveDelayMs = options.autosaveDelayMs ?? AUTOSAVE_DELAY_SECONDS * 1000
    this.rescanPeriodMs = options.rescanPeriodMs ?? FOLDER_RESCAN_PERIOD_SECONDS * 1000
    this.isVisible = options.isVisible ?? (() => true)
  }

  /** Serialises operations: a save and a rescan never run at the same time. */
  private run(task: () => Promise<void>): Promise<void> {
    const next = this.busy.then(task).catch((error: unknown) => {
      this.hooks.error(error)
    })
    this.busy = next
    return next
  }

  start(): void {
    this.stop()
    this.rescanTimer = setInterval(() => {
      if (this.isVisible()) void this.rescan()
    }, this.rescanPeriodMs)
  }

  stop(): void {
    if (this.rescanTimer !== null) clearInterval(this.rescanTimer)
    if (this.autosaveTimer !== null) clearTimeout(this.autosaveTimer)
    this.rescanTimer = null
    this.autosaveTimer = null
  }

  /** To call after every local change of the open play. */
  notifyLocalChange(): void {
    if (this.autosaveTimer !== null) clearTimeout(this.autosaveTimer)
    this.autosaveTimer = setTimeout(() => {
      this.autosaveTimer = null
      void this.saveNow()
    }, this.autosaveDelayMs)
  }

  /** Ctrl+S, or the end of the automatic save delay. */
  saveNow(): Promise<void> {
    if (this.autosaveTimer !== null) {
      clearTimeout(this.autosaveTimer)
      this.autosaveTimer = null
    }
    return this.run(async () => {
      const open = this.hooks.getOpen()
      if (!open?.dirty || open.readOnly) return
      try {
        const result = await this.store.put(open.play, { expected: open.version })
        this.hooks.saved(result, open.play)
      } catch (error) {
        if (error instanceof ConflictError) {
          // A conflict on a play (the default type): put() only stores plays.
          const conflict = error as ConflictError
          this.hooks.externalChange(
            conflict.current
              ? { kind: 'conflict', stored: conflict.current, version: conflict.currentVersion }
              : { kind: 'removed' },
          )
          return
        }
        throw error
      }
    })
  }

  /** Window focus or visibility regained (SPEC 8.3). */
  onFocus(): Promise<void> {
    return this.rescan()
  }

  rescan(): Promise<void> {
    return this.run(async () => {
      const changes = await this.store.changesSince(this.stamp)
      this.stamp = this.store.stamp
      if (changes.length === 0) return
      const open = this.hooks.getOpen()
      if (open) await this.handleOpenPlay(open, changes)
      this.hooks.libraryChanged(changes)
    })
  }

  private async handleOpenPlay(open: OpenPlay, changes: Change[]): Promise<void> {
    const mine = changes.filter(
      (c) => c.kind !== 'issues' && c.collection === 'plays' && c.id === open.play.id,
    )
    if (mine.length === 0) return
    const stored = await this.store.get(open.play.id).catch(() => null)
    if (!stored) {
      if (open.version !== null) this.hooks.externalChange({ kind: 'removed' })
      return
    }
    const version = this.store.versionOf(open.play.id)
    const decision = decideExternalChange(open, stored)
    if (decision === 'reload')
      this.hooks.externalChange({ kind: 'reloaded', play: stored, version })
    else if (decision === 'ask') this.hooks.externalChange({ kind: 'conflict', stored, version })
  }
}
