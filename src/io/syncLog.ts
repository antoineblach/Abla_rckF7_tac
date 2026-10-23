// Synchronisation log (D-100): the last events kept in memory, copied by the user from the
// settings to diagnose an unexpected dialog. Nothing is written in the folder.
import { SYNC_LOG_SIZE } from '../config/defaults'
import type { Collection } from './LibraryStore'

export type SyncEventKind =
  'open' | 'read' | 'write' | 'check' | 'change' | 'decision' | 'rollback' | 'deferred' | 'refused'

export type SyncOrigin = 'page' | 'external'

export interface SyncEvent {
  /** Time of the event, in ms since the epoch. */
  at: number
  kind: SyncEventKind
  collection: Collection | null
  fileName: string | null
  /** Modification date of the file, in ms since the epoch. */
  lastModified: number | null
  size: number | null
  /** As written in the file. */
  updatedAt: string | null
  hash: string | null
  /** Origin held for the content: written by this page, or from outside. */
  origin: SyncOrigin | null
  detail: string
}

export type SyncEventInput = Partial<Omit<SyncEvent, 'at' | 'kind'>>

const KIND_LABELS: Record<SyncEventKind, string> = {
  open: 'ouverture',
  read: 'relecture',
  write: 'écriture',
  check: 'vérification',
  change: 'changement',
  decision: 'décision',
  rollback: 'retour en arrière',
  deferred: 'sauvegarde différée',
  refused: 'refus',
}

const COLLECTION_LABELS: Record<Collection, string> = { plays: 'combinaisons', presets: 'modèles' }
const ORIGIN_LABELS: Record<SyncOrigin, string> = { page: 'cette page', external: 'extérieure' }

const pad = (value: number, length = 2): string => String(value).padStart(length, '0')

/** Local time of the computer, with milliseconds: 2026-10-23 14:02:11.123. */
export function localTime(ms: number): string {
  const d = new Date(ms)
  return (
    `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
  )
}

/** Short form of a content hash in the log. */
export const shortHash = (hash: string): string => hash.slice(0, 8)

const COLUMNS = [
  'heure',
  'événement',
  'collection',
  'fichier',
  'date du fichier',
  'taille',
  'updatedAt',
  'empreinte',
  'origine',
  'détail',
]

export class SyncLog {
  private readonly events: SyncEvent[] = []

  constructor(
    private readonly now: () => Date,
    private readonly capacity = SYNC_LOG_SIZE,
  ) {}

  add(kind: SyncEventKind, input: SyncEventInput = {}): void {
    this.events.push({
      at: this.now().getTime(),
      kind,
      collection: input.collection ?? null,
      fileName: input.fileName ?? null,
      lastModified: input.lastModified ?? null,
      size: input.size ?? null,
      updatedAt: input.updatedAt ?? null,
      hash: input.hash ?? null,
      origin: input.origin ?? null,
      detail: input.detail ?? '',
    })
    if (this.events.length > this.capacity) {
      this.events.splice(0, this.events.length - this.capacity)
    }
  }

  entries(): readonly SyncEvent[] {
    return this.events
  }

  /** Text copied by the user: a header, then one tab-separated line per event, oldest first. */
  toText(): string {
    const dash = (value: string | null): string => (value === null || value === '' ? '-' : value)
    const lines = this.events.map((e) =>
      [
        localTime(e.at),
        KIND_LABELS[e.kind],
        dash(e.collection && COLLECTION_LABELS[e.collection]),
        dash(e.fileName),
        dash(e.lastModified === null ? null : localTime(e.lastModified)),
        dash(e.size === null ? null : String(e.size)),
        dash(e.updatedAt),
        dash(e.hash && shortHash(e.hash)),
        dash(e.origin && ORIGIN_LABELS[e.origin]),
        dash(e.detail),
      ].join('\t'),
    )
    return [
      `Journal de synchronisation : ${String(this.events.length)} événements, du plus ancien au plus récent`,
      COLUMNS.join('\t'),
      ...lines,
      '',
    ].join('\n')
  }
}
