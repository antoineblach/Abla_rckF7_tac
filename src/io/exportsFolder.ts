// Writing the exports in exports/ of the folder (SPEC 8.2, 9.1, D-065). An existing export is
// never overwritten without a decision: « Remplacer » first moves it to _corbeille/ (verified
// copy), « Garder les deux » numbers the new one (« -2 », « -3 »...). Every file of an export is
// written at the end, all or nothing: after a failure, the files already written by this export go
// to the trash, and the empty file the failed write created (it did not exist before) is removed.
import { numberedFileName } from '../export/names'
import { EXPORTS_DIR, TRASH_DIR } from './fileNames'
import { isNotFound, tryGetFile, type FsDirectoryHandle } from './fs/types'
import { moveToTrash } from './trash'

/** Decision about exports already present: never an overwrite without it. */
export type ExistingChoice = 'replace' | 'keepBoth'

export class ExportExistsError extends Error {
  constructor(readonly fileNames: string[]) {
    super(`Exports already present: ${fileNames.join(', ')}`)
    this.name = 'ExportExistsError'
  }
}

export interface FileToWrite {
  fileName: string
  bytes: Uint8Array
}

export interface WrittenExport {
  /** Name actually written (numbered on « Garder les deux »). */
  fileName: string
  size: number
  /** The previous file of the same name went to the trash. */
  replaced: boolean
}

async function exportsDir(root: FsDirectoryHandle, create: boolean) {
  try {
    return await root.getDirectoryHandle(EXPORTS_DIR, { create })
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

/** Names among `fileNames` already present in exports/. */
export async function existingExports(
  root: FsDirectoryHandle,
  fileNames: readonly string[],
): Promise<string[]> {
  const dir = await exportsDir(root, false)
  if (!dir) return []
  const present: string[] = []
  for (const name of fileNames) if (await tryGetFile(dir, name)) present.push(name)
  return present
}

/** First free name « name-2.ext », « name-3.ext »... (D-065). */
export async function freeNumberedName(dir: FsDirectoryHandle, fileName: string): Promise<string> {
  for (let n = 2; ; n++) {
    const candidate = numberedFileName(fileName, n)
    if (!(await tryGetFile(dir, candidate))) return candidate
  }
}

/**
 * Writes a file that does not exist yet; on failure, removes the empty file the attempt created
 * (D-065): it never held any data.
 */
async function writeNewFile(
  dir: FsDirectoryHandle,
  name: string,
  bytes: Uint8Array,
): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true })
  try {
    const writable = await handle.createWritable()
    try {
      await writable.write(bytes.slice())
      await writable.close()
    } catch (error) {
      await writable.abort().catch(() => undefined)
      throw error
    }
  } catch (error) {
    const file = await handle.getFile().catch(() => null)
    if (file?.size === 0) await dir.removeEntry(name).catch(() => undefined)
    throw error
  }
}

/**
 * Writes every file of an export. `decisions` gives the choice made for each name already present;
 * a present name without a decision throws ExportExistsError before anything is written.
 */
export async function writeExports(
  root: FsDirectoryHandle,
  files: readonly FileToWrite[],
  decisions: ReadonlyMap<string, ExistingChoice>,
  now: Date,
): Promise<WrittenExport[]> {
  const dir = await root.getDirectoryHandle(EXPORTS_DIR, { create: true })
  const undecided = (
    await existingExports(
      root,
      files.map((f) => f.fileName),
    )
  ).filter((name) => !decisions.has(name))
  if (undecided.length > 0) throw new ExportExistsError(undecided)
  const trash = await root.getDirectoryHandle(TRASH_DIR, { create: true })
  const written: WrittenExport[] = []
  try {
    for (const file of files) {
      let name = file.fileName
      let replaced = false
      if (await tryGetFile(dir, name)) {
        if (decisions.get(name) === 'replace') {
          await moveToTrash(dir, name, trash, now)
          replaced = true
        } else {
          name = await freeNumberedName(dir, name)
        }
      }
      await writeNewFile(dir, name, file.bytes)
      written.push({ fileName: name, size: file.bytes.length, replaced })
    }
  } catch (error) {
    // All or nothing: what this export wrote goes to the trash, never a definitive deletion.
    for (const done of written) {
      await moveToTrash(dir, done.fileName, trash, now).catch(() => undefined)
    }
    throw error
  }
  return written
}
