// Storage of placement presets (SPEC 4.4, 8.1, 10.1, D-092): same rules as the plays, in
// modeles/ of the folder or in IndexedDB.
import { describe, expect, it } from 'vitest'
import { lineoutPreset, preset, sequentialIds, uuid } from '../test/builders'
import { createMemoryFs } from '../test/memoryFs'
import { createMemoryKv } from '../test/memoryKv'
import { presetFileName } from './fileNames'
import { FolderStore, InvalidStoredFileError } from './FolderStore'
import { IdbStore } from './IdbStore'
import { ConflictError, ReadOnlyError } from './LibraryStore'
import { serialize } from './serialize'

const NOW = new Date(2026, 9, 16, 10, 20, 30)
const STAMP = NOW.toISOString()

function setup() {
  const fs = createMemoryFs()
  const open = (cache?: Parameters<typeof FolderStore.open>[1]['cache']) =>
    FolderStore.open(fs.root, { now: () => NOW, ids: sequentialIds(5000), cache })
  return { fs, open }
}

const path = (p: { name: string; id: string }) => `modeles/${presetFileName(p)}`

describe('presets in the folder (modeles/)', () => {
  it('round-trips a preset through its file, sorted keys and 2-space indentation', async () => {
    const { fs, open } = setup()
    const store = await open()
    const { preset: saved, version } = await store.putPreset(lineoutPreset())
    expect(saved).toEqual({ ...lineoutPreset(), updatedAt: STAMP })
    expect(version).not.toBeNull()
    expect(fs.read(path(saved))).toBe(serialize(saved))
    expect(path(saved)).toBe(`modeles/touche-a-4--${uuid(8000)}.preset.json`)
    const reopened = await open()
    expect(await reopened.getPreset(saved.id)).toEqual(saved)
    expect(await reopened.listPresets()).toEqual([
      { preset: saved, fileName: presetFileName(saved), readOnly: false },
    ])
    // Plays are not mixed with presets.
    expect(await reopened.list()).toEqual([])
  })

  it('renames by writing the new file, then moving the old one to the trash', async () => {
    const { fs, open } = setup()
    const store = await open()
    const { preset: saved } = await store.putPreset(lineoutPreset())
    await store.putPreset(
      { ...saved, name: 'Touche longue' },
      { expected: store.presetVersionOf(saved.id) },
    )
    expect(fs.list('modeles')).toEqual([`touche-longue--${uuid(8000)}.preset.json`])
    expect(fs.list('_corbeille')).toEqual([
      `2026-10-16_10-20-30--touche-a-4--${uuid(8000)}.preset.json`,
    ])
  })

  it('removes by moving to the trash, never deleting', async () => {
    const { fs, open } = setup()
    const store = await open()
    const { preset: saved } = await store.putPreset(lineoutPreset())
    const text = fs.read(path(saved))
    await store.removePreset(saved.id)
    expect(fs.list('modeles')).toEqual([])
    const [trashed] = fs.list('_corbeille')
    expect(fs.read(`_corbeille/${trashed ?? ''}`)).toBe(text)
    expect(await store.listPresets()).toEqual([])
  })

  it('signals an invalid or newer file, never modifies nor moves it', async () => {
    const { fs, open } = setup()
    const broken = `modeles/touche-a-4--${uuid(8000)}.preset.json`
    fs.writeExternal(broken, '{ "schemaVersion": 1, ')
    const future = `modeles/futur--${uuid(8001)}.preset.json`
    const futureText = serialize({ ...preset({ id: uuid(8001), name: 'Futur' }), schemaVersion: 2 })
    fs.writeExternal(future, futureText)
    const store = await open()
    expect(await store.presetIssues()).toMatchObject([
      {
        kind: 'invalid',
        fileName: `futur--${uuid(8001)}.preset.json`,
        error: { code: 'futureVersion' },
      },
      {
        kind: 'invalid',
        fileName: `touche-a-4--${uuid(8000)}.preset.json`,
        error: { code: 'json' },
      },
    ])
    expect(await store.issues()).toEqual([])
    await expect(store.putPreset(lineoutPreset())).rejects.toBeInstanceOf(InvalidStoredFileError)
    expect(fs.read(broken)).toBe('{ "schemaVersion": 1, ')
    expect(fs.read(future)).toBe(futureText)
  })

  it('detects a change from the other computer, and refuses to overwrite it', async () => {
    const { fs, open } = setup()
    const store = await open()
    const { preset: saved } = await store.putPreset(lineoutPreset())
    const version = store.presetVersionOf(saved.id)
    const stamp = store.stamp
    fs.writeExternal(
      path(saved),
      serialize({
        ...saved,
        name: 'Touche à 4',
        updatedAt: '2026-10-16T11:00:00.000Z',
        positions: [],
      }),
    )
    const changes = await store.changesSince(stamp)
    expect(changes).toEqual([
      {
        kind: 'modified',
        collection: 'presets',
        id: saved.id,
        fileName: presetFileName(saved),
        stamp: stamp + 1,
      },
    ])
    expect((await store.getPreset(saved.id)).positions).toEqual([])
    await expect(
      store.putPreset({ ...saved, name: 'Mienne' }, { expected: version }),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('writes back the last version when Drive gives back an older one written by the page (D-098)', async () => {
    const { fs, open } = setup()
    const store = await open()
    const { preset: saved } = await store.putPreset(lineoutPreset())
    const v1 = fs.read(path(saved)) ?? ''
    const second = await store.putPreset(
      { ...saved, positions: [] },
      { expected: store.presetVersionOf(saved.id) },
    )
    const v2 = fs.read(path(saved)) ?? ''
    fs.writeExternal(path(saved), v1)
    // Seen when writing: a version of the page is not a change from elsewhere.
    await store.putPreset(
      { ...second.preset, positions: saved.positions.slice(0, 1) },
      { expected: second.version },
    )
    const v3 = fs.read(path(saved)) ?? ''
    fs.writeExternal(path(saved), v2)
    // Seen by a rescan: the last version is written back, and nothing is reported.
    expect(await store.changesSince(store.stamp)).toEqual([])
    expect(fs.read(path(saved))).toBe(v3)
  })

  it('makes conflict copies read only; « Garder les deux » and « Choisir celle-ci »', async () => {
    const { fs, open } = setup()
    const a = lineoutPreset()
    fs.writeExternal(path(a), serialize(a))
    fs.writeExternal(
      `modeles/touche-a-4--${a.id} (1).preset.json`,
      serialize({ ...a, name: 'Autre' }),
    )
    const store = await open()
    expect(await store.presetIssues()).toMatchObject([{ kind: 'duplicate', id: a.id }])
    expect((await store.listPresets()).every((e) => e.readOnly)).toBe(true)
    await expect(store.removePreset(a.id)).rejects.toBeInstanceOf(ReadOnlyError)
    await store.resolvePresetDuplicate(a.id, { kind: 'keepBoth' })
    const names = (await store.listPresets()).map((e) => e.preset.name).sort()
    expect(names).toEqual(['Autre', 'Touche à 4 (copie)'])
    expect(await store.presetIssues()).toEqual([])

    const second = setup()
    second.fs.writeExternal(path(a), serialize(a))
    const copyName = `touche-a-4--${a.id} (1).preset.json`
    second.fs.writeExternal(`modeles/${copyName}`, serialize({ ...a, name: 'Autre' }))
    const other = await second.open()
    await other.resolvePresetDuplicate(a.id, { kind: 'choose', fileName: copyName })
    expect(second.fs.list('modeles')).toEqual([copyName])
    expect(second.fs.list('_corbeille')).toHaveLength(1)
  })

  it('keeps presets in the read cache under their directory', async () => {
    const { open } = setup()
    const store = await open()
    await store.putPreset(lineoutPreset())
    const cache = store.exportCache()
    expect(Object.keys(cache)).toEqual([`modeles/${presetFileName(lineoutPreset())}`])
    const cached = await open(cache)
    expect(await cached.listPresets()).toHaveLength(1)
  })
})

describe('presets in the browser library (IndexedDB)', () => {
  it('stores, lists, reads and removes presets to the trash', async () => {
    const kv = createMemoryKv()
    const store = await IdbStore.open(kv, () => NOW)
    const { preset: saved } = await store.putPreset(lineoutPreset())
    expect((await store.listPresets()).map((e) => e.preset)).toEqual([saved])
    const reopened = await IdbStore.open(kv, () => NOW)
    expect(await reopened.getPreset(saved.id)).toEqual(saved)
    expect(await reopened.allPresets()).toEqual([saved])
    expect(await reopened.list()).toEqual([])
    await reopened.removePreset(saved.id)
    expect(await reopened.listPresets()).toEqual([])
    const keys = await kv.keys()
    expect(keys.some((k) => k === `abla-rck7:trash:${STAMP}:preset:${saved.id}`)).toBe(true)
  })

  it('signals changes of another tab in the presets collection, and conflicts', async () => {
    const kv = createMemoryKv()
    const store = await IdbStore.open(kv, () => NOW)
    const { preset: saved } = await store.putPreset(lineoutPreset())
    const version = store.presetVersionOf(saved.id)
    const other = await IdbStore.open(kv, () => new Date(2026, 9, 16, 11))
    await other.putPreset({ ...saved, name: 'Ailleurs' })
    const changes = await store.changesSince(store.stamp)
    expect(changes.map((c) => [c.kind, c.collection])).toEqual([['modified', 'presets']])
    await expect(
      store.putPreset({ ...saved, name: 'Mienne' }, { expected: version }),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('signals an invalid entry and never overwrites it', async () => {
    const kv = createMemoryKv()
    await kv.set(`abla-rck7:preset:${uuid(8000)}`, '{ broken')
    const store = await IdbStore.open(kv, () => NOW)
    expect(await store.presetIssues()).toMatchObject([{ kind: 'invalid', error: { code: 'json' } }])
    await expect(store.putPreset(lineoutPreset())).rejects.toThrow()
    expect(await kv.get(`abla-rck7:preset:${uuid(8000)}`)).toBe('{ broken')
  })
})
