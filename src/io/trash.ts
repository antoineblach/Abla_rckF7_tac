// Moving a file to _corbeille/ (SPEC 8.5, D-043): the file is copied byte for byte, the copy is
// read back and compared, and only then is the original removed. Never a definitive deletion
// (CLAUDE.md rule 9). Used by the library and by the exports (D-065).
import { trashFileName } from './fileNames'
import {
  readBytes,
  sameBytes,
  tryGetFile,
  writeWholeFile,
  type FsDirectoryHandle,
} from './fs/types'

/** Moves `fileName` of `dir` into `trash`; returns the name of the copy in the trash. */
export async function moveToTrash(
  dir: FsDirectoryHandle,
  fileName: string,
  trash: FsDirectoryHandle,
  now: Date,
): Promise<string> {
  const bytes = await readBytes(await dir.getFileHandle(fileName))
  let target = trashFileName(fileName, now)
  // Two files trashed in the same second: « 2-<name> », « 3-<name> »... (D-043).
  for (let n = 2; await tryGetFile(trash, target); n++) {
    target = trashFileName(`${n}-${fileName}`, now)
  }
  // A fresh array that owns its buffer, as the File System Access API expects.
  await writeWholeFile(trash, target, bytes.slice())
  const check = await readBytes(await trash.getFileHandle(target))
  if (!sameBytes(check, bytes)) throw new Error(`Copy to the trash failed for ${fileName}`)
  await dir.removeEntry(fileName)
  return target
}
