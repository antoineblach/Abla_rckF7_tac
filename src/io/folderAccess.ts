// Access to the folder chosen with showDirectoryPicker (Chrome) and kept in IndexedDB (SPEC 8.2).
import { wrapDirectory } from './fs/nativeFs'
import type { FsDirectoryHandle } from './fs/types'
import { kvKey, type KeyValueStore } from './kv'

const HANDLE_KEY = kvKey('folderHandle')

export type FolderPermission = 'granted' | 'prompt' | 'denied'

export function isFolderAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

export async function pickFolder(): Promise<FileSystemDirectoryHandle> {
  if (!window.showDirectoryPicker) throw new Error('showDirectoryPicker is not available')
  return window.showDirectoryPicker({ id: 'abla-rck7', mode: 'readwrite' })
}

export async function saveFolderHandle(
  kv: KeyValueStore,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  await kv.set(HANDLE_KEY, handle)
}

export async function loadFolderHandle(
  kv: KeyValueStore,
): Promise<FileSystemDirectoryHandle | null> {
  const value = await kv.get(HANDLE_KEY)
  return value instanceof FileSystemDirectoryHandle ? value : null
}

export async function forgetFolderHandle(kv: KeyValueStore): Promise<void> {
  await kv.del(HANDLE_KEY)
}

/** Current permission; « Autoriser à chaque visite » keeps it granted between visits (SPEC 8.2). */
export async function folderPermission(
  handle: FileSystemDirectoryHandle,
): Promise<FolderPermission> {
  if (!handle.queryPermission) return 'granted'
  return handle.queryPermission({ mode: 'readwrite' })
}

/** Must be called from a user gesture (button « Réautoriser le dossier »). */
export async function requestFolderPermission(
  handle: FileSystemDirectoryHandle,
): Promise<FolderPermission> {
  if (!handle.requestPermission) return 'granted'
  return handle.requestPermission({ mode: 'readwrite' })
}

export function asFsDirectory(handle: FileSystemDirectoryHandle): FsDirectoryHandle {
  return wrapDirectory(handle)
}
