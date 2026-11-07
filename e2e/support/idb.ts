import type { Page } from '@playwright/test'

// The key-value store of the application in IndexedDB (src/io/kv.ts): database « abla-rck7 »,
// object store « kv », keys prefixed with « abla-rck7: ».

/** Writes an entry as an earlier version of the tool would have left it. */
export function writeKv(page: Page, key: string, text: string): Promise<void> {
  return page.evaluate(
    ([name, value]) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('abla-rck7')
        request.onupgradeneeded = () => {
          request.result.createObjectStore('kv')
        }
        request.onerror = () => {
          reject(request.error ?? new Error('indexedDB.open'))
        }
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction('kv', 'readwrite')
          transaction.objectStore('kv').put(value, name)
          transaction.oncomplete = () => {
            db.close()
            resolve()
          }
          transaction.onerror = () => {
            reject(transaction.error ?? new Error('transaction'))
          }
        }
      }),
    [key, text] as const,
  )
}

/** Reads an entry, null when it is absent. */
export function readKv(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    (name) =>
      new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open('abla-rck7')
        request.onerror = () => {
          reject(request.error ?? new Error('indexedDB.open'))
        }
        request.onsuccess = () => {
          const db = request.result
          const get = db.transaction('kv', 'readonly').objectStore('kv').get(name)
          get.onsuccess = () => {
            db.close()
            resolve(get.result ?? null)
          }
          get.onerror = () => {
            reject(get.error ?? new Error('get'))
          }
        }
      }),
    key,
  )
}
