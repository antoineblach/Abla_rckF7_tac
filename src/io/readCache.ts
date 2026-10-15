// Read cache of the folder in IndexedDB (SPEC 3.5): file texts keyed by name, date and size.
import type { ReadCacheData } from './FolderStore'
import { kvKey, type KeyValueStore } from './kv'

const CACHE_KEY = kvKey('readCache')

export async function loadReadCache(kv: KeyValueStore): Promise<ReadCacheData | undefined> {
  const value = await kv.get(CACHE_KEY)
  return value && typeof value === 'object' ? (value as ReadCacheData) : undefined
}

export async function saveReadCache(kv: KeyValueStore, data: ReadCacheData): Promise<void> {
  await kv.set(CACHE_KEY, data)
}
