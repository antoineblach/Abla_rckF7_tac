// Key-value storage in IndexedDB (SPEC 3.5). Every key is prefixed with « abla-rck7: » because
// IndexedDB is shared by every page of the github.io origin.
import { createStore, del, get, keys, set } from 'idb-keyval'

export const KEY_PREFIX = 'abla-rck7:'

export const kvKey = (name: string): string => `${KEY_PREFIX}${name}`

export interface KeyValueStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  del(key: string): Promise<void>
  keys(): Promise<string[]>
}

export function createIdbKeyValueStore(): KeyValueStore {
  const store = createStore('abla-rck7', 'kv')
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
    keys: async () => (await keys(store)).filter((k): k is string => typeof k === 'string'),
  }
}
