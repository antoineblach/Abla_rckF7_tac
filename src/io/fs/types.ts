// Subset of the File System Access API used by the application (SPEC 8.2, 8.3).
// The native handles are wrapped by nativeFs.ts; tests use an in-memory implementation.

export interface FsFileSnapshot {
  readonly lastModified: number
  readonly size: number
  text(): Promise<string>
}

export interface FsWritable {
  write(data: string): Promise<void>
  /** The content becomes visible only when the stream is closed (SPEC 8.3). */
  close(): Promise<void>
  abort(): Promise<void>
}

export interface FsFileHandle {
  readonly kind: 'file'
  readonly name: string
  getFile(): Promise<FsFileSnapshot>
  createWritable(): Promise<FsWritable>
}

export interface FsDirectoryHandle {
  readonly kind: 'directory'
  readonly name: string
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FsDirectoryHandle>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FsFileHandle>
  removeEntry(name: string): Promise<void>
  entries(): AsyncIterable<[string, FsFileHandle | FsDirectoryHandle]>
}

export function isNotFound(error: unknown): boolean {
  return (
    error instanceof Error && (error.name === 'NotFoundError' || error.name === 'TypeMismatchError')
  )
}

/** Reads a file of a directory, or null when it does not exist. */
export async function tryGetFile(
  dir: FsDirectoryHandle,
  name: string,
): Promise<FsFileHandle | null> {
  try {
    return await dir.getFileHandle(name)
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

/** Writes a whole text file through a writable stream, closed only on success. */
export async function writeTextFile(
  dir: FsDirectoryHandle,
  name: string,
  text: string,
): Promise<FsFileHandle> {
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  try {
    await writable.write(text)
    await writable.close()
  } catch (error) {
    await writable.abort().catch(() => undefined)
    throw error
  }
  return handle
}
