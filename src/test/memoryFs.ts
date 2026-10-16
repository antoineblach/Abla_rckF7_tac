// In-memory file system for io tests: same subset as the File System Access API, injectable
// clock, simulation of external changes (the other computer) and of write failures. Contents are
// bytes (text files are stored as UTF-8). Never imported by the application.
import type { FsDirectoryHandle, FsFileHandle, FsFileSnapshot, FsWritable } from '../io/fs/types'

interface MemoryFile {
  kind: 'file'
  bytes: Uint8Array
  lastModified: number
}

interface MemoryDir {
  kind: 'directory'
  children: Map<string, MemoryFile | MemoryDir>
}

function notFound(name: string): Error {
  const error = new Error(`Not found: ${name}`)
  error.name = 'NotFoundError'
  return error
}

function typeMismatch(name: string): Error {
  const error = new Error(`Type mismatch: ${name}`)
  error.name = 'TypeMismatchError'
  return error
}

const encode = (text: string): Uint8Array => new TextEncoder().encode(text)
const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

export interface MemoryFs {
  root: FsDirectoryHandle
  /** Advances the clock used for modification dates. */
  tick(ms?: number): void
  now(): number
  /** Writes a file as another computer would (synchronisation). */
  writeExternal(path: string, content: string | Uint8Array, lastModified?: number): void
  /** Changes the modification date only (a synchronisation client touching a file). */
  touch(path: string, lastModified?: number): void
  read(path: string): string | undefined
  readBytes(path: string): Uint8Array | undefined
  stat(path: string): { lastModified: number; size: number } | undefined
  list(path?: string): string[]
  exists(path: string): boolean
  /** Makes the next N writes fail before commit. */
  failNextWrites(count: number): void
  /** Number of committed writes (all files). */
  readonly writeCount: number
}

export function createMemoryFs(startTime = 1_800_000_000_000): MemoryFs {
  let clock = startTime
  let failures = 0
  let writes = 0
  const rootDir: MemoryDir = { kind: 'directory', children: new Map() }

  function walk(path: string, createDirs: boolean): { dir: MemoryDir; name: string } {
    const parts = path.split('/').filter((p) => p.length > 0)
    const name = parts.pop() ?? ''
    let dir = rootDir
    for (const part of parts) {
      let child = dir.children.get(part)
      if (!child) {
        if (!createDirs) throw notFound(part)
        child = { kind: 'directory', children: new Map() }
        dir.children.set(part, child)
      }
      if (child.kind !== 'directory') throw typeMismatch(part)
      dir = child
    }
    return { dir, name }
  }

  function fileHandle(dir: MemoryDir, name: string): FsFileHandle {
    return {
      kind: 'file',
      name,
      getFile: () => {
        const file = dir.children.get(name)
        if (!file || file.kind !== 'file') return Promise.reject(notFound(name))
        const bytes = file.bytes
        const snapshot: FsFileSnapshot = {
          lastModified: file.lastModified,
          size: bytes.length,
          text: () => Promise.resolve(decode(bytes)),
          arrayBuffer: () => Promise.resolve(bytes.slice().buffer),
        }
        return Promise.resolve(snapshot)
      },
      createWritable: () => {
        const chunks: Uint8Array[] = []
        let open = true
        const writable: FsWritable = {
          write: (data: string | Uint8Array) => {
            if (!open) return Promise.reject(new Error('Stream closed'))
            chunks.push(typeof data === 'string' ? encode(data) : data.slice())
            return Promise.resolve()
          },
          close: () => {
            if (!open) return Promise.reject(new Error('Stream closed'))
            open = false
            if (failures > 0) {
              failures--
              return Promise.reject(new Error('Simulated write failure'))
            }
            clock += 1
            writes++
            dir.children.set(name, { kind: 'file', bytes: concat(chunks), lastModified: clock })
            return Promise.resolve()
          },
          abort: () => {
            open = false
            return Promise.resolve()
          },
        }
        return Promise.resolve(writable)
      },
    }
  }

  function dirHandle(dir: MemoryDir, name: string): FsDirectoryHandle {
    return {
      kind: 'directory',
      name,
      getDirectoryHandle: (child, options) => {
        const existing = dir.children.get(child)
        if (existing?.kind === 'directory') return Promise.resolve(dirHandle(existing, child))
        if (existing) return Promise.reject(typeMismatch(child))
        if (!options?.create) return Promise.reject(notFound(child))
        const created: MemoryDir = { kind: 'directory', children: new Map() }
        dir.children.set(child, created)
        return Promise.resolve(dirHandle(created, child))
      },
      getFileHandle: (child, options) => {
        const existing = dir.children.get(child)
        if (existing?.kind === 'file') return Promise.resolve(fileHandle(dir, child))
        if (existing) return Promise.reject(typeMismatch(child))
        if (!options?.create) return Promise.reject(notFound(child))
        clock += 1
        dir.children.set(child, { kind: 'file', bytes: new Uint8Array(0), lastModified: clock })
        return Promise.resolve(fileHandle(dir, child))
      },
      removeEntry: (child) => {
        if (!dir.children.delete(child)) return Promise.reject(notFound(child))
        return Promise.resolve()
      },
      entries: async function* () {
        await Promise.resolve()
        for (const [childName, child] of [...dir.children.entries()].sort(([a], [b]) =>
          a.localeCompare(b),
        )) {
          yield [
            childName,
            child.kind === 'file' ? fileHandle(dir, childName) : dirHandle(child, childName),
          ]
        }
      },
    }
  }

  function getFile(path: string): MemoryFile | undefined {
    try {
      const { dir, name } = walk(path, false)
      const file = dir.children.get(name)
      return file?.kind === 'file' ? file : undefined
    } catch {
      return undefined
    }
  }

  return {
    root: dirHandle(rootDir, 'Rugby7'),
    tick(ms = 1000) {
      clock += ms
    },
    now: () => clock,
    writeExternal(path, content, lastModified) {
      clock += 1
      const { dir, name } = walk(path, true)
      const bytes = typeof content === 'string' ? encode(content) : content.slice()
      dir.children.set(name, { kind: 'file', bytes, lastModified: lastModified ?? clock })
    },
    touch(path, lastModified) {
      const file = getFile(path)
      if (!file) throw notFound(path)
      clock += 1
      file.lastModified = lastModified ?? clock
    },
    read: (path) => {
      const file = getFile(path)
      return file ? decode(file.bytes) : undefined
    },
    readBytes: (path) => getFile(path)?.bytes.slice(),
    stat(path) {
      const file = getFile(path)
      return file ? { lastModified: file.lastModified, size: file.bytes.length } : undefined
    },
    list(path = '') {
      try {
        const parts = path.split('/').filter((p) => p.length > 0)
        let dir = rootDir
        for (const part of parts) {
          const child = dir.children.get(part)
          if (child?.kind !== 'directory') return []
          dir = child
        }
        return [...dir.children.keys()].sort()
      } catch {
        return []
      }
    },
    exists: (path) => {
      try {
        const { dir, name } = walk(path, false)
        return dir.children.has(name)
      } catch {
        return false
      }
    },
    failNextWrites(count) {
      failures = count
    },
    get writeCount() {
      return writes
    },
  }
}
