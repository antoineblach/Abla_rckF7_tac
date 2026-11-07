// A play of a version below 5 is refused, never modified nor moved (SPEC 4.4, D-139, D-151): reading,
// folder, browser library, draft, read cache and import. The old plays are written here: fixtures
// and migrations of versions 0 to 4 are gone with the switch to version 5.
import { describe, expect, it } from 'vitest'
import { sequentialIds, sevenVsSevenWithOptions, uuid } from '../test/builders'
import { createMemoryFs } from '../test/memoryFs'
import { createMemoryKv } from '../test/memoryKv'
import { playFileName } from './fileNames'
import { kvKey } from './kv'
import { serialize } from './serialize'
import { invalidFileMessage, readErrorMessage, TEXT } from '../ui/strings'
import { clearDraft, loadDraft, saveDraft } from './draft'
import { FolderStore, InvalidStoredFileError } from './FolderStore'
import { IdbStore } from './IdbStore'
import { applyImport, parseImportText, planImport } from './packFiles'
import { readPlayData, readPlayText } from './readPlay'

const NOW = new Date(2026, 10, 5, 10, 0, 0)
const OLD_ID = uuid(77)

/** A play of version `version`, as version 4 wrote it: phases, no branches. */
function oldPlay(version: number, id = OLD_ID): Record<string, unknown> {
  return {
    schemaVersion: version,
    id,
    name: 'Ancienne',
    category: 'phasePlay',
    phases: [{ id: uuid(1), parentId: null, actions: [] }],
  }
}

const OLD_NAME = playFileName({ name: 'Ancienne', id: OLD_ID })
const OLD_PATH = `combinaisons/${OLD_NAME}`
const OLD_TEXT = serialize(oldPlay(4))

const obsolete = (version: number) => ({ code: 'obsoleteVersion', version })

describe('reading (SPEC 4.4)', () => {
  it.each([0, 1, 2, 3, 4])('refuses a play of version %i', (version) => {
    expect(readPlayData(oldPlay(version))).toEqual({ ok: false, error: obsolete(version) })
  })

  it('refuses it from a text, whatever its content, without migrating anything', () => {
    expect(readPlayText('{"schemaVersion":4}')).toEqual({ ok: false, error: obsolete(4) })
  })

  it('reads version 5, and says a newer one is from a newer tool', () => {
    expect(readPlayData(sevenVsSevenWithOptions()).ok).toBe(true)
    expect(readPlayData({ schemaVersion: 6 })).toEqual({
      ok: false,
      error: { code: 'futureVersion', version: 6 },
    })
  })

  it('gives a clear message, in French', () => {
    const message = readErrorMessage({ code: 'obsoleteVersion', version: 4 })
    expect(message).toMatch(/version antérieure/)
    expect(message).toMatch(/ni modifiée ni déplacée/)
    expect(message).not.toContain('—')
  })

  it('says once, in the library, that the file is left as it is', () => {
    const once = (text: string) => text.split('ni modifi').length - 1
    expect(once(invalidFileMessage({ code: 'obsoleteVersion', version: 4 }))).toBe(1)
    const other = invalidFileMessage({ code: 'json', message: 'Unexpected token' })
    expect(other).toBe('Fichier illisible (JSON invalide). Le fichier n’est ni modifié ni déplacé.')
  })
})

describe('folder (SPEC 4.4, CLAUDE.md rule 9)', () => {
  const open = (fs: ReturnType<typeof createMemoryFs>) =>
    FolderStore.open(fs.root, { now: () => NOW, ids: sequentialIds() })

  it('reports the file, same bytes, neither written nor moved', async () => {
    const fs = createMemoryFs()
    fs.writeExternal(OLD_PATH, OLD_TEXT)
    const store = await open(fs)
    expect(await store.issues()).toEqual([
      { kind: 'invalid', fileName: OLD_NAME, error: obsolete(4) },
    ])
    expect(await store.list()).toEqual([])
    // Another play saved next to it, then a rescan.
    const written = fs.writeCount
    await store.put(sevenVsSevenWithOptions())
    await store.changesSince(0)
    expect(fs.read(OLD_PATH)).toBe(OLD_TEXT)
    expect(fs.list('_corbeille')).toEqual([])
    expect(fs.writeCount).toBe(written + 1)
  })

  it('refuses to write over it under the same name', async () => {
    const fs = createMemoryFs()
    fs.writeExternal(OLD_PATH, OLD_TEXT)
    const store = await open(fs)
    const same = { ...sevenVsSevenWithOptions(), id: OLD_ID, name: 'Ancienne' }
    await expect(store.put(same)).rejects.toBeInstanceOf(InvalidStoredFileError)
    expect(fs.read(OLD_PATH)).toBe(OLD_TEXT)
    expect(fs.list('_corbeille')).toEqual([])
  })

  it('refuses it the same way from the text of the read cache, entry not converted', async () => {
    const fs = createMemoryFs()
    fs.writeExternal(OLD_PATH, OLD_TEXT)
    const first = await open(fs)
    const cache = first.exportCache()
    expect(cache[OLD_NAME]?.text).toBe(OLD_TEXT)
    const store = await FolderStore.open(fs.root, { now: () => NOW, ids: sequentialIds(), cache })
    expect((await store.issues())[0]).toMatchObject({ kind: 'invalid', error: obsolete(4) })
    expect(store.exportCache()[OLD_NAME]?.text).toBe(OLD_TEXT)
    expect(fs.read(OLD_PATH)).toBe(OLD_TEXT)
  })
})

describe('browser library (SPEC 8.6, D-151)', () => {
  const key = kvKey(`play:${OLD_ID}`)

  it('lists the entry as refused, same text', async () => {
    const kv = createMemoryKv()
    await kv.set(key, OLD_TEXT)
    const store = await IdbStore.open(kv, () => NOW)
    expect(await store.issues()).toEqual([
      { kind: 'invalid', fileName: OLD_ID, error: obsolete(4) },
    ])
    expect(await store.list()).toEqual([])
    await store.put(sevenVsSevenWithOptions())
    expect(await kv.get(key)).toBe(OLD_TEXT)
    expect([...kv.dump().keys()].some((k) => k.startsWith(kvKey('trash:')))).toBe(false)
  })

  it('refuses to write over it under the same id', async () => {
    const kv = createMemoryKv()
    await kv.set(key, OLD_TEXT)
    const store = await IdbStore.open(kv, () => NOW)
    await expect(store.put({ ...sevenVsSevenWithOptions(), id: OLD_ID })).rejects.toThrow()
    expect(await kv.get(key)).toBe(OLD_TEXT)
  })
})

describe('draft (D-151)', () => {
  const key = kvKey('draft')

  it('has the status obsolete: not restored, same text', async () => {
    const kv = createMemoryKv()
    await kv.set(key, OLD_TEXT)
    expect(await loadDraft(kv)).toBe('obsolete')
    expect(await kv.get(key)).toBe(OLD_TEXT)
  })

  it('stays null for a draft absent or unreadable', async () => {
    const kv = createMemoryKv()
    expect(await loadDraft(kv)).toBeNull()
    await kv.set(key, '{ broken')
    expect(await loadDraft(kv)).toBeNull()
  })

  it('is replaced by the next draft, as the start-up message announces', async () => {
    expect(TEXT.draftObsolete).toMatch(/remplacé à la prochaine modification/)
    const kv = createMemoryKv()
    await kv.set(key, OLD_TEXT)
    await saveDraft(kv, sevenVsSevenWithOptions())
    const draft = await loadDraft(kv)
    expect(draft).toMatchObject({ schemaVersion: 5 })
    await clearDraft(kv)
    expect(await loadDraft(kv)).toBeNull()
  })
})

describe('import of a pack (SPEC 4.4)', () => {
  it('imports the plays of version 5, the older ones fail and nothing is written for them', async () => {
    const play = sevenVsSevenWithOptions()
    const text = JSON.stringify([oldPlay(4), play, oldPlay(1, uuid(78))])
    const parsed = parseImportText(text)
    expect(parsed.plays).toEqual([play])
    expect(parsed.failures).toEqual([
      { index: 0, error: obsolete(4) },
      { index: 2, error: obsolete(1) },
    ])

    const fs = createMemoryFs()
    const store = await FolderStore.open(fs.root, { now: () => NOW, ids: sequentialIds() })
    for (const candidate of planImport(parsed.plays, new Set())) {
      await applyImport(store, candidate, null, sequentialIds(), () => NOW)
    }
    expect(fs.list('combinaisons')).toEqual([playFileName(play)])
    expect(TEXT.importObsolete(2)).toBe(
      '2 combinaisons d’une version antérieure de l’outil refusées : non importées.',
    )
  })

  it('refuses a single file of an earlier version', () => {
    expect(parseImportText(OLD_TEXT)).toEqual({
      plays: [],
      failures: [{ index: null, error: obsolete(4) }],
    })
  })
})
