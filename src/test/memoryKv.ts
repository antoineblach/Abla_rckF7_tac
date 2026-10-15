// In-memory key-value store for io tests. Values are cloned like IndexedDB does.
import type { KeyValueStore } from '../io/kv'

export function createMemoryKv(): KeyValueStore & { dump(): Map<string, unknown> } {
  const data = new Map<string, unknown>()
  return {
    get: (key) => Promise.resolve(data.has(key) ? structuredClone(data.get(key)) : undefined),
    set: (key, value) => {
      data.set(key, structuredClone(value))
      return Promise.resolve()
    },
    del: (key) => {
      data.delete(key)
      return Promise.resolve()
    },
    keys: () => Promise.resolve([...data.keys()]),
    dump: () => data,
  }
}
