// Library state (Zustand): storage mode, list, issues, filters, dialogs and notifications.
import { create } from 'zustand'
import type { ImportCandidate } from '../io/packFiles'
import type { LibraryIssue, PlaySummary, VersionToken } from '../io/LibraryStore'
import type { Play, PlayCategory } from '../model/types'

/**
 * starting: reading the storage; folder: folder mode; browser: degraded mode (Firefox, or
 * Chrome without folder); needsPermission: folder known, permission to ask again (SPEC 8.2).
 */
export type StorageStatus = 'starting' | 'folder' | 'browser' | 'needsPermission'

export interface Toast {
  id: number
  kind: 'info' | 'error'
  message: string
}

export type LibraryDialog =
  | { kind: 'conflict'; stored: Play; version: VersionToken | null }
  | { kind: 'removedExternally' }
  | { kind: 'draft'; draft: Play }
  | { kind: 'import'; candidate: ImportCandidate; existingUpdatedAt: string }
  | { kind: 'copyBrowserPlays'; count: number }
  | { kind: 'confirmDelete'; id: string; name: string }
  | { kind: 'confirmDeletePhase'; phaseId: string; label: string; descendants: number }
  | { kind: 'newPlay' }

export interface LibraryState {
  status: StorageStatus
  folderSupported: boolean
  folderName: string | null
  summaries: PlaySummary[]
  issues: LibraryIssue[]
  search: string
  category: PlayCategory | 'all'
  sort: 'name' | 'date'
  dialogs: LibraryDialog[]
  toasts: Toast[]
}

export const useLibraryState = create<LibraryState>(() => ({
  status: 'starting',
  folderSupported: false,
  folderName: null,
  summaries: [],
  issues: [],
  search: '',
  category: 'all',
  sort: 'date',
  dialogs: [],
  toasts: [],
}))

let nextToastId = 1
const TOAST_DURATION_MS = 6000

export function notify(message: string, kind: Toast['kind'] = 'info'): void {
  const toast = { id: nextToastId++, kind, message }
  useLibraryState.setState((s) => ({ toasts: [...s.toasts, toast].slice(-4) }))
  setTimeout(() => {
    dismissToast(toast.id)
  }, TOAST_DURATION_MS)
}

export function dismissToast(id: number): void {
  useLibraryState.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}

export function pushDialog(dialog: LibraryDialog): void {
  useLibraryState.setState((s) => ({ dialogs: [...s.dialogs, dialog] }))
}

export function closeDialog(dialog: LibraryDialog): void {
  useLibraryState.setState((s) => ({ dialogs: s.dialogs.filter((d) => d !== dialog) }))
}

/** Filtered and sorted list (SPEC 8.7): search by name, filter by category, sort by name or date. */
export function visibleSummaries(
  state: Pick<LibraryState, 'summaries' | 'search' | 'category' | 'sort'>,
): PlaySummary[] {
  const needle = normalize(state.search)
  return state.summaries
    .filter(
      (s) =>
        (state.category === 'all' || s.category === state.category) &&
        normalize(s.name).includes(needle),
    )
    .sort((a, b) =>
      state.sort === 'name'
        ? a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
        : b.updatedAt.localeCompare(a.updatedAt),
    )
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
}
