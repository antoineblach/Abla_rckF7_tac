import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { contentHash } from '../model/canonical'
import { defaultSettings } from '../model/settings'
import type { Play } from '../model/types'
import { basePlay, sequentialIds, sevenVsSevenWithOptions, uuid } from '../test/builders'
import { createMemoryFs, type MemoryFs } from '../test/memoryFs'
import { playFileName } from './fileNames'
import { FolderStore, InvalidStoredFileError } from './FolderStore'
import { ConflictError, ReadOnlyError } from './LibraryStore'
import { readPlayText } from './readPlay'
import { serialize } from './serialize'
import { SyncLog } from './syncLog'

const NOW = new Date(2026, 9, 14, 15, 30, 5)
const v0Text = readFileSync(new URL('../test/fixtures/play-v0.json', import.meta.url), 'utf8')
const v1Text = readFileSync(
  new URL('../test/fixtures/play-v1-7v7-options.json', import.meta.url),
  'utf8',
)

let fs: MemoryFs
const open = () => FolderStore.open(fs.root, { now: () => NOW, ids: sequentialIds(5000) })
const playPath = (play: Pick<Play, 'name' | 'id'>) => `combinaisons/${playFileName(play)}`

beforeEach(() => {
  fs = createMemoryFs()
})

describe('folder structure (SPEC 8.2)', () => {
  it('creates combinaisons/, modeles/, exports/, _corbeille/ and reglages.json on first use, and nothing else', async () => {
    await open()
    expect(fs.list()).toEqual(['_corbeille', 'combinaisons', 'exports', 'modeles', 'reglages.json'])
    expect(JSON.parse(fs.read('reglages.json') ?? '')).toEqual(defaultSettings())
  })

  it('never overwrites existing settings', async () => {
    fs.writeExternal('reglages.json', serialize({ ...defaultSettings(), passSpeed: 10 }))
    const store = await open()
    expect((await store.getSettings()).settings.passSpeed).toBe(10)
  })
})

describe('round trip (SPEC 4.4)', () => {
  it('writes a play and reads it back identical, with a stable indented JSON', async () => {
    const store = await open()
    const play = sevenVsSevenWithOptions()
    const { play: saved, fileName } = await store.put(play)
    expect(fileName).toBe(`croisee-au-centre--${play.id}.combi.json`)
    expect(saved.updatedAt).toBe(NOW.toISOString())
    const text = fs.read(`combinaisons/${fileName}`) ?? ''
    expect(text.startsWith('{\n  "attackingTeam": "A",')).toBe(true)
    expect(text.endsWith('}\n')).toBe(true)
    const reopened = await open()
    expect(await reopened.get(play.id)).toEqual(saved)
    expect(await reopened.list()).toEqual([
      {
        id: play.id,
        name: 'Croisée au centre',
        category: 'phasePlay',
        updatedAt: saved.updatedAt,
        fileName,
        readOnly: false,
      },
    ])
  })
})

describe('invalid files (CLAUDE.md rule 9, D-024)', () => {
  it('reports an invalid file and never modifies nor moves it', async () => {
    const path = 'combinaisons/abime--x.combi.json'
    fs.writeExternal(path, '{ "schemaVersion": 1, "name": ')
    const before = fs.stat(path)
    const store = await open()
    const issues = await store.issues()
    expect(issues).toEqual([
      {
        kind: 'invalid',
        fileName: 'abime--x.combi.json',
        error: expect.objectContaining({ code: 'json' }) as unknown,
      },
    ])
    expect(await store.list()).toEqual([])
    await store.changesSince(0)
    await store.put(sevenVsSevenWithOptions())
    expect(fs.stat(path)).toEqual(before)
    expect(fs.read(path)).toBe('{ "schemaVersion": 1, "name": ')
    expect(fs.list('_corbeille')).toEqual([])
  })

  it('never overwrites a file written by a newer version of the application', async () => {
    const play = sevenVsSevenWithOptions()
    const future = serialize({ ...play, schemaVersion: 4 })
    fs.writeExternal(playPath(play), future)
    const store = await open()
    expect((await store.issues())[0]).toMatchObject({
      kind: 'invalid',
      error: { code: 'futureVersion', version: 4 },
    })
    await expect(store.put(play)).rejects.toBeInstanceOf(InvalidStoredFileError)
    expect(fs.read(playPath(play))).toBe(future)
  })

  it('rejects a file with an unknown key without touching it', async () => {
    const play = sevenVsSevenWithOptions()
    const text = serialize({ ...play, extra: true })
    fs.writeExternal(playPath(play), text)
    const store = await open()
    expect((await store.issues())[0]?.kind).toBe('invalid')
    expect(fs.read(playPath(play))).toBe(text)
  })

  it('ignores files that are not JSON, such as Chrome .crswap swap files', async () => {
    fs.writeExternal('combinaisons/a--b.combi.json.crswap', 'partial')
    fs.writeExternal('combinaisons/notes.txt', 'hello')
    const store = await open()
    expect(await store.issues()).toEqual([])
    expect(await store.list()).toEqual([])
  })
})

describe('migration on read (SPEC 4.5)', () => {
  it('reads a version 0 file migrated in memory, file untouched until the next save', async () => {
    fs.writeExternal(
      'combinaisons/ancienne-version--00000000-0000-4000-8000-000000009999.combi.json',
      v0Text,
    )
    const store = await open()
    const play = await store.get('00000000-0000-4000-8000-000000009999')
    expect(play.schemaVersion).toBe(3)
    expect(play.attackingTeam).toBe('B')
    expect(
      fs.read('combinaisons/ancienne-version--00000000-0000-4000-8000-000000009999.combi.json'),
    ).toBe(v0Text)
    // Saving writes the current version in place.
    await store.put(play, { expected: store.versionOf(play.id) })
    const written = JSON.parse(
      fs.read('combinaisons/ancienne-version--00000000-0000-4000-8000-000000009999.combi.json') ??
        '{}',
    ) as { schemaVersion: number }
    expect(written.schemaVersion).toBe(3)
  })

  it('reads a file of lots 1 and 2 (version 1) unchanged, rewritten in version 3 on save', async () => {
    const path = playPath(sevenVsSevenWithOptions())
    fs.writeExternal(path, v1Text)
    const store = await open()
    const play = await store.get(sevenVsSevenWithOptions().id)
    expect(play).toEqual(sevenVsSevenWithOptions())
    expect(fs.read(path)).toBe(v1Text)
    await store.put(play, { expected: store.versionOf(play.id) })
    const written = JSON.parse(fs.read(path) ?? '{}') as Play
    expect(written.schemaVersion).toBe(3)
    expect({ ...written, updatedAt: play.updatedAt }).toEqual(play)
  })
})

describe('conflict copies (SPEC 8.4, D-022)', () => {
  it('detects two files carrying the same id and makes them read only', async () => {
    const play = sevenVsSevenWithOptions()
    fs.writeExternal(playPath(play), serialize(play))
    fs.writeExternal(
      `combinaisons/croisee-au-centre--${play.id} (1).combi.json`,
      serialize({ ...play, name: 'Autre' }),
    )
    const store = await open()
    expect(await store.issues()).toEqual([
      {
        kind: 'duplicate',
        id: play.id,
        fileNames: [
          `croisee-au-centre--${play.id} (1).combi.json`,
          `croisee-au-centre--${play.id}.combi.json`,
        ],
      },
    ])
    expect((await store.list()).every((s) => s.readOnly)).toBe(true)
    await expect(store.put(play)).rejects.toBeInstanceOf(ReadOnlyError)
    await expect(store.remove(play.id)).rejects.toBeInstanceOf(ReadOnlyError)
  })

  it('« Garder les deux »: new id and « (copie) » for one of them, nothing deleted', async () => {
    const play = sevenVsSevenWithOptions()
    fs.writeExternal(playPath(play), serialize(play))
    fs.writeExternal(
      `combinaisons/copie--${play.id}.combi.json`,
      serialize({ ...play, name: 'Autre' }),
    )
    const store = await open()
    await store.resolveDuplicate(play.id, { kind: 'keepBoth' })
    expect(await store.issues()).toEqual([])
    const names = (await store.list()).map((s) => s.name).sort()
    expect(names).toEqual(['Autre', 'Croisée au centre (copie)'])
    expect(fs.list('_corbeille')).toHaveLength(1)
    const copy = (await store.list()).find((s) => s.name.endsWith('(copie)'))
    expect(copy?.id).toBe(uuid(5000))
  })

  it('« Choisir celle-ci »: the other file goes to the trash', async () => {
    const play = sevenVsSevenWithOptions()
    fs.writeExternal(playPath(play), serialize(play))
    fs.writeExternal(
      `combinaisons/copie--${play.id}.combi.json`,
      serialize({ ...play, notes: 'B' }),
    )
    const store = await open()
    await store.resolveDuplicate(play.id, {
      kind: 'choose',
      fileName: `copie--${play.id}.combi.json`,
    })
    expect((await store.get(play.id)).notes).toBe('B')
    expect(fs.list('_corbeille')).toEqual([
      `2026-10-14_15-30-05--croisee-au-centre--${play.id}.combi.json`,
    ])
  })
})

describe('external changes (SPEC 8.3)', () => {
  it('detects a change by date and size, confirmed by the content', async () => {
    const store = await open()
    const { play } = await store.put(sevenVsSevenWithOptions())
    const stamp = store.stamp
    expect(await store.changesSince(stamp)).toEqual([])
    // Date changed only (synchronisation touching the file): no change.
    fs.touch(playPath(play))
    expect(await store.changesSince(stamp)).toEqual([])
    // Content changed on the other computer.
    fs.writeExternal(
      playPath(play),
      serialize({ ...play, notes: 'PC 2', updatedAt: '2026-10-14T16:00:00.000Z' }),
    )
    const changes = await store.changesSince(stamp)
    expect(changes).toEqual([
      {
        kind: 'modified',
        collection: 'plays',
        id: play.id,
        fileName: playFileName(play),
        stamp: stamp + 1,
      },
    ])
    expect((await store.get(play.id)).notes).toBe('PC 2')
  })

  it('detects plays added and removed on the other computer', async () => {
    const store = await open()
    const other = basePlay({ id: uuid(77), name: 'Arrivée' })
    fs.writeExternal(playPath(other), serialize(other))
    const added = await store.changesSince(0)
    expect(added.map((c) => c.kind)).toEqual(['added'])
    fs.writeExternal(playPath(other), 'broken')
    const broken = await store.changesSince(store.stamp)
    expect(broken.map((c) => c.kind)).toEqual(['removed', 'issues'])
  })

  it('refuses to overwrite a version changed since it was read (optimistic concurrency)', async () => {
    const store = await open()
    const { play, version } = await store.put(sevenVsSevenWithOptions())
    const remote = { ...play, notes: 'PC 2', updatedAt: '2026-10-14T16:00:00.000Z' }
    fs.writeExternal(playPath(play), serialize(remote))
    const error = await store
      .put({ ...play, notes: 'PC 1' }, { expected: version })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ConflictError)
    expect((error as ConflictError).current?.notes).toBe('PC 2')
    expect(JSON.parse(fs.read(playPath(play)) ?? '{}')).toMatchObject({ notes: 'PC 2' })
    // « Garder la mienne »: no expected version.
    await store.put({ ...play, notes: 'PC 1' })
    expect(JSON.parse(fs.read(playPath(play)) ?? '{}')).toMatchObject({ notes: 'PC 1' })
  })

  it('writes when only the date changed and the content is the same version', async () => {
    const store = await open()
    const { play, version } = await store.put(sevenVsSevenWithOptions())
    fs.touch(playPath(play))
    await expect(store.put({ ...play, notes: 'ok' }, { expected: version })).resolves.toBeDefined()
  })
})

describe('concurrency by the content hash (D-097)', () => {
  let clock = 0
  const later = () => new Date((clock += 1000))
  const openLater = (log?: SyncLog) =>
    FolderStore.open(fs.root, { now: later, ids: sequentialIds(5000), ...(log ? { log } : {}) })

  beforeEach(() => {
    clock = Date.UTC(2026, 9, 23, 12)
  })

  it('accepts a play whose updatedAt is older than the file, when the file is the starting version', async () => {
    const store = await openLater()
    const first = await store.put(sevenVsSevenWithOptions())
    const second = await store.put({ ...first.play, notes: 'b' }, { expected: first.version })
    fs.touch(playPath(first.play))
    // Undo: the play in memory carries the updatedAt of the first save.
    await expect(
      store.put({ ...first.play, notes: 'annulé' }, { expected: second.version }),
    ).resolves.toBeDefined()
    expect(JSON.parse(fs.read(playPath(first.play)) ?? '{}')).toMatchObject({ notes: 'annulé' })
  })

  it('accepts a file holding an older version written by this page', async () => {
    const store = await openLater()
    const first = await store.put(sevenVsSevenWithOptions())
    const v1 = fs.read(playPath(first.play)) ?? ''
    const second = await store.put({ ...first.play, notes: 'b' }, { expected: first.version })
    fs.writeExternal(playPath(first.play), v1)
    await store.put({ ...second.play, notes: 'c' }, { expected: second.version })
    expect(JSON.parse(fs.read(playPath(first.play)) ?? '{}')).toMatchObject({ notes: 'c' })
  })

  it('refuses a content never written by this page, with its version and hash', async () => {
    const store = await openLater()
    const { play, version } = await store.put(sevenVsSevenWithOptions())
    const remote = serialize({ ...play, notes: 'PC 2', updatedAt: '2030-01-01T00:00:00.000Z' })
    fs.writeExternal(playPath(play), remote)
    const error = await store
      .put({ ...play, notes: 'PC 1' }, { expected: version })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ConflictError)
    const read = readPlayText(remote)
    expect((error as ConflictError).currentVersion).toEqual({
      ...fs.stat(playPath(play)),
      contentHash: read.ok ? contentHash(read.play) : '',
    })
    expect(fs.read(playPath(play))).toBe(remote)
  })

  it('never writes over a file that became invalid', async () => {
    const store = await openLater()
    const { play, version } = await store.put(sevenVsSevenWithOptions())
    fs.writeExternal(playPath(play), '{ broken')
    await expect(store.put(play, { expected: version })).rejects.toBeInstanceOf(
      InvalidStoredFileError,
    )
    expect(fs.read(playPath(play))).toBe('{ broken')
  })
})

describe('Drive gives back an older version written by the page (D-098)', () => {
  let clock = 0
  const later = () => new Date((clock += 1000))
  let log: SyncLog
  const openLater = () => FolderStore.open(fs.root, { now: later, ids: sequentialIds(5000), log })

  beforeEach(() => {
    clock = Date.UTC(2026, 9, 23, 12)
    log = new SyncLog(later)
  })

  async function twoVersions(store: FolderStore) {
    const first = await store.put(sevenVsSevenWithOptions())
    const v1 = fs.read(playPath(first.play)) ?? ''
    const second = await store.put({ ...first.play, notes: 'b' }, { expected: first.version })
    const v2 = fs.read(playPath(first.play)) ?? ''
    return { play: second.play, v1, v2 }
  }

  it('writes back the exact text of the last version, without reporting a change', async () => {
    const store = await openLater()
    const { play, v1, v2 } = await twoVersions(store)
    const stamp = store.stamp
    fs.writeExternal(playPath(play), v1)
    expect(await store.changesSince(stamp)).toEqual([])
    expect(fs.read(playPath(play))).toBe(v2)
    expect((await store.get(play.id)).notes).toBe('b')
    expect(log.entries().map((e) => e.kind)).toContain('rollback')
    const read = readPlayText(v1)
    expect(read.ok && store.isOwnWrite('plays', play.id, contentHash(read.play))).toBe(true)
  })

  it('writes nothing back while a conflict copy carries the same id', async () => {
    const store = await openLater()
    const { play, v1, v2 } = await twoVersions(store)
    const copy = playPath(play).replace('.combi.json', ' (1).combi.json')
    fs.writeExternal(copy, v2)
    await store.changesSince(store.stamp)
    fs.writeExternal(playPath(play), v1)
    await store.changesSince(store.stamp)
    expect(fs.read(playPath(play))).toBe(v1)
    expect(fs.read(copy)).toBe(v2)
  })

  it('writes nothing back in another file than the reference', async () => {
    const store = await openLater()
    const { play, v1, v2 } = await twoVersions(store)
    const other = playPath(play).replace('.combi.json', ' (1).combi.json')
    fs.writeExternal(other, v1)
    const changes = await store.changesSince(store.stamp)
    expect(changes.map((c) => c.kind)).toEqual(['added', 'issues'])
    expect(fs.read(other)).toBe(v1)
    expect(fs.read(playPath(play))).toBe(v2)
  })

  it('reports a content never written by the page, which becomes the reference (Q1)', async () => {
    const store = await openLater()
    const { play, v2 } = await twoVersions(store)
    const remote = serialize({ ...play, notes: 'PC 2', updatedAt: '2030-01-01T00:00:00.000Z' })
    fs.writeExternal(playPath(play), remote)
    expect((await store.changesSince(store.stamp)).map((c) => c.kind)).toEqual(['modified'])
    fs.writeExternal(playPath(play), v2)
    expect(await store.changesSince(store.stamp)).toEqual([])
    expect(fs.read(playPath(play))).toBe(remote)
  })
})

describe('one content hash everywhere (D-097)', () => {
  const v2Text = readFileSync(
    new URL('../test/fixtures/play-v2-lot3.json', import.meta.url),
    'utf8',
  )
  const readBack = (path: string) => {
    const result = readPlayText(fs.read(path) ?? '')
    if (!result.ok) throw new Error('unreadable')
    return contentHash(result.play)
  }

  it.each([
    ['fixture v1', v1Text],
    ['fixture v2', v2Text],
    [
      'coordinates that are not integers',
      serialize({
        ...sevenVsSevenWithOptions(),
        setup: {
          ...sevenVsSevenWithOptions().setup,
          positions: {
            ...sevenVsSevenWithOptions().setup.positions,
            [uuid(1)]: { x: 40.123456789, y: 1 / 3 },
            [uuid(2)]: { x: 0.1 + 0.2, y: 15.000000000000002 },
          },
        },
      }),
    ],
  ])('%s: the hash recorded at the write is the hash of the file read back', async (_, text) => {
    const parsed = readPlayText(text)
    if (!parsed.ok) throw new Error('unreadable fixture')
    const path = playPath(parsed.play)
    fs.writeExternal(path, text)
    const store = await open()
    expect(store.versionOf(parsed.play.id)?.contentHash).toBe(readBack(path))
    const { version } = await store.put(parsed.play, {
      expected: store.versionOf(parsed.play.id),
    })
    expect(version?.contentHash).toBe(readBack(path))
    expect((await open()).versionOf(parsed.play.id)?.contentHash).toBe(version?.contentHash)
  })
})

describe('trash (SPEC 8.5, CLAUDE.md rule 9)', () => {
  it('moves a removed play to _corbeille/ with a timestamp, content identical', async () => {
    const store = await open()
    const { play, fileName } = await store.put(sevenVsSevenWithOptions())
    const content = fs.read(`combinaisons/${fileName}`)
    await store.remove(play.id)
    expect(fs.list('combinaisons')).toEqual([])
    expect(fs.list('_corbeille')).toEqual([`2026-10-14_15-30-05--${fileName}`])
    expect(fs.read(`_corbeille/2026-10-14_15-30-05--${fileName}`)).toBe(content)
    expect(await store.list()).toEqual([])
  })

  it('keeps both versions when the same file is trashed twice in the same second', async () => {
    const store = await open()
    const { play } = await store.put(sevenVsSevenWithOptions())
    await store.remove(play.id)
    await store.put(play)
    await store.remove(play.id)
    expect(fs.list('_corbeille')).toHaveLength(2)
  })

  it('leaves the original in place when the copy to the trash fails', async () => {
    const store = await open()
    const { play, fileName } = await store.put(sevenVsSevenWithOptions())
    fs.failNextWrites(1)
    await expect(store.remove(play.id)).rejects.toThrow()
    expect(fs.exists(`combinaisons/${fileName}`)).toBe(true)
  })
})

describe('renaming (SPEC 8.3, D-005)', () => {
  it('writes the new file, then moves the old one to the trash', async () => {
    const store = await open()
    const { play, fileName, version } = await store.put(sevenVsSevenWithOptions())
    const renamed = await store.put({ ...play, name: 'Sautée à droite' }, { expected: version })
    expect(renamed.fileName).toBe(`sautee-a-droite--${play.id}.combi.json`)
    expect(fs.list('combinaisons')).toEqual([renamed.fileName])
    expect(fs.list('_corbeille')).toEqual([`2026-10-14_15-30-05--${fileName}`])
    expect(await store.issues()).toEqual([])
  })

  it('« Remplacer » at import moves the previous version to the trash first', async () => {
    const store = await open()
    const { play } = await store.put(sevenVsSevenWithOptions())
    await store.put({ ...play, notes: 'importée' }, { archivePrevious: true })
    expect(fs.list('_corbeille')).toHaveLength(1)
    expect((await store.get(play.id)).notes).toBe('importée')
  })
})

describe('read cache (SPEC 3.5)', () => {
  it('reuses cached texts for unchanged files', async () => {
    const store = await open()
    const { play } = await store.put(sevenVsSevenWithOptions())
    const cache = store.exportCache()
    const reopened = await FolderStore.open(fs.root, {
      now: () => NOW,
      ids: sequentialIds(),
      cache,
    })
    expect(await reopened.get(play.id)).toEqual(play)
  })
})

describe('settings (SPEC 4.4)', () => {
  it('round trips and never overwrites an invalid settings file', async () => {
    const store = await open()
    await store.putSettings({ ...defaultSettings(), theme: 'highContrast' })
    expect((await store.getSettings()).settings.theme).toBe('highContrast')
    fs.writeExternal('reglages.json', '{ broken')
    const result = await store.getSettings()
    expect(result.ok).toBe(false)
    await expect(store.putSettings(defaultSettings())).rejects.toBeInstanceOf(
      InvalidStoredFileError,
    )
    expect(fs.read('reglages.json')).toBe('{ broken')
  })

  it('reads a version 1 file migrated, without rewriting it on reading (D-068)', async () => {
    const v1 = readFileSync(new URL('../test/fixtures/reglages-v1.json', import.meta.url), 'utf8')
    fs.writeExternal('reglages.json', v1)
    const store = await open()
    const result = await store.getSettings()
    expect(result.ok).toBe(true)
    expect(result.settings.schemaVersion).toBe(3)
    expect(result.settings.passSpeed).toBe(11)
    expect(result.settings.export).toEqual(defaultSettings().export)
    expect(fs.read('reglages.json')).toBe(v1)
    await store.putSettings(result.settings)
    expect(JSON.parse(fs.read('reglages.json') ?? '')).toEqual(result.settings)
  })

  it('never rewrites a settings file of a newer version (D-024)', async () => {
    const future = serialize({ ...defaultSettings(), schemaVersion: 4, defense: {} })
    fs.writeExternal('reglages.json', future)
    const store = await open()
    const result = await store.getSettings()
    expect(result).toMatchObject({ ok: false, future: true })
    expect(result.settings).toEqual(defaultSettings())
    await expect(store.putSettings(defaultSettings())).rejects.toBeInstanceOf(
      InvalidStoredFileError,
    )
    expect(fs.read('reglages.json')).toBe(future)
  })
})
