// Adapter from the native File System Access handles (Chrome) to the subset used by io.
import type { FsDirectoryHandle, FsFileHandle } from './types'

export function wrapFile(native: FileSystemFileHandle): FsFileHandle {
  return {
    kind: 'file',
    name: native.name,
    getFile: () => native.getFile(),
    createWritable: async () => {
      const stream = await native.createWritable()
      return {
        write: (data: string) => stream.write(data),
        close: () => stream.close(),
        abort: () => stream.abort(),
      }
    },
  }
}

export function wrapDirectory(native: FileSystemDirectoryHandle): FsDirectoryHandle {
  return {
    kind: 'directory',
    name: native.name,
    getDirectoryHandle: async (name, options) =>
      wrapDirectory(await native.getDirectoryHandle(name, options)),
    getFileHandle: async (name, options) => wrapFile(await native.getFileHandle(name, options)),
    removeEntry: (name) => native.removeEntry(name),
    entries: async function* () {
      for await (const [name, handle] of native.entries()) {
        if (handle.kind === 'file') yield [name, wrapFile(handle)]
        else yield [name, wrapDirectory(handle)]
      }
    },
  }
}
