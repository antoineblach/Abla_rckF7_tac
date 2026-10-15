// Manual import and export of .combi.json and .combipack.json files (SPEC 4.4, 8.6, 8.7).
import type { IdFactory } from '../model/ids'
import type { Id, Play } from '../model/types'
import { keepBothCopy } from './conflicts'
import { PACK_EXTENSION, playFileName, shortName } from './fileNames'
import type { LibraryStore, PutResult } from './LibraryStore'
import { readPlayData, type ReadError } from './readPlay'
import { parseJson, serialize } from './serialize'

export interface ExportFile {
  fileName: string
  text: string
}

export function playExportFile(play: Play): ExportFile {
  return { fileName: playFileName(play), text: serialize(play) }
}

/** A pack is an array of plays. */
export function packExportFile(plays: readonly Play[], name: string): ExportFile {
  return { fileName: `${shortName(name)}${PACK_EXTENSION}`, text: serialize(plays) }
}

export interface ImportFailure {
  /** Position in a pack, null for a single play file. */
  index: number | null
  error: ReadError
}

export interface ParsedImport {
  plays: Play[]
  failures: ImportFailure[]
}

/** Reads a .combi.json (one play) or a .combipack.json (array of plays); each play is migrated. */
export function parseImportText(text: string): ParsedImport {
  const parsed = parseJson(text)
  if (!parsed.ok) {
    return {
      plays: [],
      failures: [{ index: null, error: { code: 'json', message: parsed.message } }],
    }
  }
  const isPack = Array.isArray(parsed.value)
  const items: unknown[] = Array.isArray(parsed.value) ? parsed.value : [parsed.value]
  const plays: Play[] = []
  const failures: ImportFailure[] = []
  items.forEach((item, i) => {
    const result = readPlayData(item)
    if (result.ok) plays.push(result.play)
    else failures.push({ index: isPack ? i : null, error: result.error })
  })
  return { plays, failures }
}

export type ImportDecision = 'replace' | 'keepBoth'

export interface ImportCandidate {
  play: Play
  /** Library play with the same id, if any (choice « Remplacer » or « Garder les deux »). */
  existingId: Id | null
}

export function planImport(
  plays: readonly Play[],
  existingIds: ReadonlySet<Id>,
): ImportCandidate[] {
  return plays.map((play) => ({ play, existingId: existingIds.has(play.id) ? play.id : null }))
}

/** Writes an imported play. « Remplacer » moves the previous version to the trash first (D-022). */
export async function applyImport(
  store: LibraryStore,
  candidate: ImportCandidate,
  decision: ImportDecision | null,
  ids: IdFactory,
  now: () => Date,
): Promise<PutResult> {
  if (candidate.existingId === null) return store.put(candidate.play)
  if (decision === 'replace') return store.put(candidate.play, { archivePrevious: true })
  return store.put(keepBothCopy(candidate.play, ids(), now()))
}
