// Synchronisation controller (SPEC 8.3, 8.4): automatic save 2 s after the last change, never
// during a gesture (D-099); full rescan at start-up, on window focus and every 30 s while the
// window is visible; a content never written by this page reloads silently or asks, depending on
// local unsaved changes (D-097, D-098). Every decision goes to the synchronisation log (D-100).
import { AUTOSAVE_DELAY_SECONDS, FOLDER_RESCAN_PERIOD_SECONDS } from '../config/defaults'
import type { Id, Play } from '../model/types'
import { decideExternalChange, type ExternalChangeDecision } from './conflicts'
import {
  ConflictError,
  type Change,
  type LibraryStore,
  type PutResult,
  type VersionToken,
} from './LibraryStore'
import type { SyncLog } from './syncLog'

export interface OpenPlay {
  play: Play
  /** Version of the stored play this one started from (D-097); null for a play never saved. */
  version: VersionToken | null
  dirty: boolean
  readOnly: boolean
  /** A gesture (drag) is in progress: the automatic save waits for its end (D-099). */
  gesture: boolean
  /** New play from a preset whose placement is not validated: never written (D-101). */
  awaitingPlacement: boolean
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
  /** Synchronisation log of the page (D-100). */
  log?: SyncLog
}

const CHANGE_LABELS = { added: 'ajoutée', modified: 'modifiée', removed: 'retirée' } as const

const DECISION_DETAILS: Record<ExternalChangeDecision, string> = {
  ignore: 'rien à faire',
  reload: 'aucune modification en cours : rechargement silencieux',
  ask: 'modifications non enregistrées : dialogue',
}

export class SyncController {
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null
  private rescanTimer: ReturnType<typeof setInterval> | null = null
  private stamp: number
  private busy: Promise<void> = Promise.resolve()
  /** The automatic save came during a gesture: it leaves at the end of the gesture (D-099). */
  private saveAfterGesture = false
  private readonly autosaveDelayMs: number
  private readonly rescanPeriodMs: number
  private readonly isVisible: () => boolean
  private readonly log: SyncLog | undefined

  constructor(
    private readonly store: LibraryStore,
    private readonly hooks: SyncHooks,
    options: SyncOptions = {},
  ) {
    this.stamp = store.stamp
    this.autosaveDelayMs = options.autosaveDelayMs ?? AUTOSAVE_DELAY_SECONDS * 1000
    this.rescanPeriodMs = options.rescanPeriodMs ?? FOLDER_RESCAN_PERIOD_SECONDS * 1000
    this.isVisible = options.isVisible ?? (() => true)
    this.log = options.log
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
    this.saveAfterGesture = false
  }

  /** To call after every local change of the open play. */
  notifyLocalChange(): void {
    if (this.autosaveTimer !== null) clearTimeout(this.autosaveTimer)
    this.autosaveTimer = setTimeout(() => {
      this.autosaveTimer = null
      void this.autosave()
    }, this.autosaveDelayMs)
  }

  /** End of the automatic save delay: never during a gesture (D-099). */
  private autosave(): Promise<void> {
    if (this.hooks.getOpen()?.gesture) {
      this.saveAfterGesture = true
      this.log?.add('deferred', {
        collection: 'plays',
        detail: 'glisser en cours : sauvegarde à la fin du geste',
      })
      return Promise.resolve()
    }
    return this.saveNow()
  }

  /**
   * A gesture ended (finished or cancelled): the automatic save it held back leaves now, if
   * changes are still unsaved (D-099).
   */
  gestureEnded(): Promise<void> {
    if (!this.saveAfterGesture) return Promise.resolve()
    this.saveAfterGesture = false
    return this.saveNow()
  }

  /** Ctrl+S, or the end of the automatic save delay. */
  saveNow(): Promise<void> {
    if (this.autosaveTimer !== null) {
      clearTimeout(this.autosaveTimer)
      this.autosaveTimer = null
    }
    return this.run(async () => {
      const open = this.hooks.getOpen()
      if (!open?.dirty || open.readOnly || open.awaitingPlacement) return
      try {
        const result = await this.store.put(open.play, { expected: open.version })
        this.hooks.saved(result, open.play)
      } catch (error) {
        if (error instanceof ConflictError) {
          // A conflict on a play (the default type): put() only stores plays.
          const conflict = error as ConflictError
          this.log?.add('decision', {
            collection: 'plays',
            lastModified: conflict.currentVersion?.lastModified ?? null,
            size: conflict.currentVersion?.size ?? null,
            hash: conflict.currentVersion?.contentHash ?? null,
            updatedAt: conflict.current?.updatedAt ?? null,
            origin: conflict.current ? 'external' : null,
            detail: conflict.current
              ? 'écriture refusée : dialogue « Version plus récente dans le dossier »'
              : 'écriture refusée, fichier retiré : dialogue',
          })
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
      (c): c is Extract<Change, { id: Id }> =>
        c.kind !== 'issues' && c.collection === 'plays' && c.id === open.play.id,
    )
    if (mine.length === 0) return
    for (const change of mine) {
      this.log?.add('change', {
        collection: 'plays',
        fileName: change.fileName,
        detail: `combinaison ouverte ${CHANGE_LABELS[change.kind]}`,
      })
    }
    const stored = await this.store.get(open.play.id).catch(() => null)
    const version = this.store.versionOf(open.play.id)
    if (!stored || !version) {
      if (open.version !== null) {
        this.log?.add('decision', {
          collection: 'plays',
          detail: 'combinaison ouverte retirée du dossier : dialogue',
        })
        this.hooks.externalChange({ kind: 'removed' })
      }
      return
    }
    const own = this.store.isOwnWrite('plays', open.play.id, version.contentHash)
    const decision = decideExternalChange(
      { baseHash: open.version?.contentHash ?? null, dirty: open.dirty },
      { hash: version.contentHash, own },
    )
    this.log?.add('decision', {
      collection: 'plays',
      lastModified: version.lastModified,
      size: version.size,
      updatedAt: stored.updatedAt,
      hash: version.contentHash,
      origin: own ? 'page' : 'external',
      detail:
        decision === 'ignore' && !own
          ? 'même contenu que la version ouverte : rien à faire'
          : DECISION_DETAILS[decision],
    })
    if (decision === 'reload')
      this.hooks.externalChange({ kind: 'reloaded', play: stored, version })
    else if (decision === 'ask') this.hooks.externalChange({ kind: 'conflict', stored, version })
  }
}
