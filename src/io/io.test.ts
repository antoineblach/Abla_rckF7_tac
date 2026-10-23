import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../model/settings'
import type { Play } from '../model/types'
import { basePlay, sequentialIds, sevenVsSevenWithOptions, uuid } from '../test/builders'
import { createMemoryFs } from '../test/memoryFs'
import { createMemoryKv } from '../test/memoryKv'
import { decideExternalChange, keepBothCopy } from './conflicts'
import { clearDraft, draftDiffers, loadDraft, saveDraft } from './draft'
import { isScannedPlayFile, playFileName, shortName, trashFileName } from './fileNames'
import { FolderStore } from './FolderStore'
import { IdbStore } from './IdbStore'
import { kvKey } from './kv'
import { ConflictError } from './LibraryStore'
import {
  applyImport,
  packExportFile,
  parseImportText,
  planImport,
  playExportFile,
} from './packFiles'
import { serialize } from './serialize'
import { SyncController, type ExternalChange, type OpenPlay } from './sync'

const NOW = new Date(2026, 9, 14, 9, 5, 7)

describe('file names (SPEC 4.4, D-023)', () => {
  it('builds the short name: lower case, no accents, dashes, 40 characters at most', () => {
    expect(shortName('Croisée au centre')).toBe('croisee-au-centre')
    expect(shortName("L'œil du cœur : « test » / 2")).toBe('l-oeil-du-coeur-test-2')
    expect(shortName('  ---  ')).toBe('sans-nom')
    expect(shortName('')).toBe('sans-nom')
    expect(shortName('a'.repeat(39) + ' b c')).toBe('a'.repeat(39))
    expect(shortName('Ça*marche?<>|"\\:')).toBe('ca-marche')
    expect(shortName('x'.repeat(50)).length).toBe(40)
  })

  it('names play files, trash files and scanned files', () => {
    expect(playFileName({ name: 'Été', id: uuid(1) })).toBe(`ete--${uuid(1)}.combi.json`)
    expect(trashFileName('a.combi.json', NOW)).toBe('2026-10-14_09-05-07--a.combi.json')
    expect(isScannedPlayFile('x.combi.json')).toBe(true)
    expect(isScannedPlayFile('x (1).combi.json')).toBe(true)
    expect(isScannedPlayFile('x.combi.json.crswap')).toBe(false)
    expect(isScannedPlayFile('X.JSON')).toBe(true)
  })
})

describe('browser library, degraded mode (SPEC 8.6)', () => {
  it('round trips, lists and moves removed plays to a trash', async () => {
    const kv = createMemoryKv()
    const store = await IdbStore.open(kv, () => NOW)
    const { play } = await store.put(sevenVsSevenWithOptions())
    const reopened = await IdbStore.open(kv, () => NOW)
    expect(await reopened.get(play.id)).toEqual(play)
    expect((await reopened.list()).map((s) => s.name)).toEqual(['Croisée au centre'])
    await reopened.remove(play.id)
    expect(await reopened.list()).toEqual([])
    const keys = [...kv.dump().keys()]
    expect(keys.some((k) => k.startsWith('abla-rck7:trash:'))).toBe(true)
    expect(keys.every((k) => k.startsWith('abla-rck7:'))).toBe(true)
  })

  it('reports an invalid entry without modifying it', async () => {
    const kv = createMemoryKv()
    await kv.set(`abla-rck7:play:${uuid(1)}`, '{ broken')
    const store = await IdbStore.open(kv, () => NOW)
    expect((await store.issues())[0]?.kind).toBe('invalid')
    expect(await kv.get(`abla-rck7:play:${uuid(1)}`)).toBe('{ broken')
  })

  it('detects changes made by another tab and refuses to overwrite them', async () => {
    const kv = createMemoryKv()
    const store = await IdbStore.open(kv, () => NOW)
    const { play, version } = await store.put(sevenVsSevenWithOptions())
    const other = await IdbStore.open(kv, () => new Date(2026, 9, 14, 10))
    await other.put({ ...play, notes: 'autre onglet' })
    const changes = await store.changesSince(store.stamp)
    expect(changes.map((c) => c.kind)).toEqual(['modified'])
    await expect(
      store.put({ ...play, notes: 'moi' }, { expected: version }),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('keeps settings in IndexedDB (D-021)', async () => {
    const store = await IdbStore.open(createMemoryKv(), () => NOW)
    expect((await store.getSettings()).settings).toEqual(defaultSettings())
    await store.putSettings({ ...defaultSettings(), passSpeed: 9 })
    expect((await store.getSettings()).settings.passSpeed).toBe(9)
  })

  it('migrates version 1 settings and never rewrites invalid or newer ones (D-024, D-068)', async () => {
    const kv = createMemoryKv()
    const store = await IdbStore.open(kv, () => NOW)
    await kv.set(
      kvKey('settings'),
      '{"paces":{"jog":4,"sprint":7,"walk":2},"passSpeed":10,"schemaVersion":1,"theme":"screen"}',
    )
    const migrated = await store.getSettings()
    expect(migrated.ok).toBe(true)
    expect(migrated.settings.passSpeed).toBe(10)
    expect(migrated.settings.export).toEqual(defaultSettings().export)
    const future = JSON.stringify({ ...defaultSettings(), schemaVersion: 3 })
    await kv.set(kvKey('settings'), future)
    expect(await store.getSettings()).toMatchObject({ ok: false, future: true })
    await expect(store.putSettings(defaultSettings())).rejects.toThrow()
    expect(await kv.get(kvKey('settings'))).toBe(future)
  })
})

describe('import and export (SPEC 4.4, 8.4, 8.7)', () => {
  it('exports a play and a pack, and imports them back', () => {
    const play = sevenVsSevenWithOptions()
    const other = basePlay({ id: uuid(42), name: 'Autre' })
    const single = playExportFile(play)
    expect(single.fileName).toBe(playFileName(play))
    expect(parseImportText(single.text)).toEqual({ plays: [play], failures: [] })
    const pack = packExportFile([play, other], 'Cahier de jeu')
    expect(pack.fileName).toBe('cahier-de-jeu.combipack.json')
    expect(parseImportText(pack.text).plays).toEqual([play, other])
  })

  it('imports the valid plays of a pack and reports the invalid ones', () => {
    const text = JSON.stringify([sevenVsSevenWithOptions(), { schemaVersion: 1 }])
    const result = parseImportText(text)
    expect(result.plays).toHaveLength(1)
    expect(result.failures).toEqual([
      { index: 1, error: expect.objectContaining({ code: 'invalid' }) as unknown },
    ])
    expect(parseImportText('nope').failures[0]?.error.code).toBe('json')
  })

  it('offers « Remplacer » or « Garder les deux » for an id already present', async () => {
    const fs = createMemoryFs()
    const store = await FolderStore.open(fs.root, { now: () => NOW, ids: sequentialIds(7000) })
    const { play } = await store.put(sevenVsSevenWithOptions())
    const imported: Play = { ...play, notes: 'importée' }
    const [candidate] = planImport([imported], new Set([play.id]))
    expect(candidate?.existingId).toBe(play.id)
    if (!candidate) return
    await applyImport(store, candidate, 'keepBoth', sequentialIds(8000), () => NOW)
    expect((await store.list()).map((s) => s.name).sort()).toEqual([
      'Croisée au centre',
      'Croisée au centre (copie)',
    ])
    await applyImport(store, candidate, 'replace', sequentialIds(9000), () => NOW)
    expect((await store.get(play.id)).notes).toBe('importée')
    expect(fs.list('_corbeille')).toHaveLength(1)
  })
})

describe('conflicts (SPEC 8.4)', () => {
  it('keeps both with a new id and « (copie) »', () => {
    const play = sevenVsSevenWithOptions()
    const copy = keepBothCopy(play, uuid(5), NOW)
    expect(copy.id).toBe(uuid(5))
    expect(copy.name).toBe('Croisée au centre (copie)')
    expect(copy.phases).toEqual(play.phases)
  })

  it('reloads silently a content never written by the page without local change, asks otherwise', () => {
    // [base, dirty, stored hash, written by the page] -> decision (D-097, D-098).
    const table = [
      ['h1', false, 'x', false, 'reload'],
      ['h1', true, 'x', false, 'ask'],
      [null, false, 'x', false, 'reload'],
      [null, true, 'x', false, 'ask'],
      ['h1', true, 'h1', false, 'ignore'],
      ['h1', false, 'h1', false, 'ignore'],
      ['h1', true, 'h0', true, 'ignore'],
      ['h1', false, 'h0', true, 'ignore'],
      [null, true, 'h0', true, 'ignore'],
    ] as const
    for (const [baseHash, dirty, hash, own, decision] of table) {
      expect(decideExternalChange({ baseHash, dirty }, { hash, own })).toBe(decision)
    }
  })
})

describe('draft (SPEC 3.5, D-025)', () => {
  it('is saved, loaded, compared and cleared', async () => {
    const kv = createMemoryKv()
    const play = sevenVsSevenWithOptions()
    expect(await loadDraft(kv)).toBeNull()
    await saveDraft(kv, { ...play, notes: 'brouillon' })
    const draft = await loadDraft(kv)
    expect(draft?.notes).toBe('brouillon')
    if (!draft) return
    expect(draftDiffers(draft, play)).toBe(true)
    expect(draftDiffers({ ...play, updatedAt: 'x' }, play)).toBe(false)
    expect(draftDiffers(draft, null)).toBe(true)
    await clearDraft(kv)
    expect(await loadDraft(kv)).toBeNull()
  })
})

describe('synchronisation controller (SPEC 8.3, 8.4)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function setup() {
    const fs = createMemoryFs()
    const store = await FolderStore.open(fs.root, { now: () => NOW, ids: sequentialIds() })
    const { play, version } = await store.put(sevenVsSevenWithOptions())
    let open: OpenPlay = {
      play,
      version,
      dirty: false,
      readOnly: false,
      gesture: false,
      awaitingPlacement: false,
    }
    const events: ExternalChange[] = []
    const saves: Play[] = []
    let visible = true
    const sync = new SyncController(
      store,
      {
        getOpen: () => open,
        saved: (result) => {
          saves.push(result.play)
          open = {
            play: result.play,
            version: result.version,
            dirty: false,
            readOnly: false,
            gesture: false,
            awaitingPlacement: false,
          }
        },
        externalChange: (change) => events.push(change),
        libraryChanged: () => undefined,
        error: (error: unknown) => {
          throw error
        },
      },
      { isVisible: () => visible },
    )
    return {
      fs,
      store,
      sync,
      events,
      saves,
      edit(notes: string) {
        open = { ...open, play: { ...open.play, notes }, dirty: true }
        sync.notifyLocalChange()
      },
      setVisible(v: boolean) {
        visible = v
      },
      get open() {
        return open
      },
    }
  }

  it('saves 2 s after the last change, not before', async () => {
    const env = await setup()
    env.edit('a')
    await vi.advanceTimersByTimeAsync(1500)
    env.edit('ab')
    await vi.advanceTimersByTimeAsync(1500)
    expect(env.saves).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(600)
    expect(env.saves.map((p) => p.notes)).toEqual(['ab'])
    expect(env.open.dirty).toBe(false)
  })

  it('saves at once on Ctrl+S', async () => {
    const env = await setup()
    env.edit('vite')
    await env.sync.saveNow()
    expect(env.saves.map((p) => p.notes)).toEqual(['vite'])
  })

  it('reloads silently on focus when the file changed and nothing is pending', async () => {
    const env = await setup()
    const remote = { ...env.open.play, notes: 'PC 2', updatedAt: '2026-10-14T20:00:00.000Z' }
    env.fs.writeExternal(`combinaisons/${playFileName(remote)}`, serialize(remote))
    await env.sync.onFocus()
    expect(env.events).toEqual([
      { kind: 'reloaded', play: remote, version: env.store.versionOf(remote.id) },
    ])
  })

  it('asks when a newer version arrives during an unsaved local change', async () => {
    const env = await setup()
    env.edit('PC 1')
    const remote = { ...env.open.play, notes: 'PC 2', updatedAt: '2026-10-14T20:00:00.000Z' }
    env.fs.writeExternal(`combinaisons/${playFileName(remote)}`, serialize(remote))
    await env.sync.onFocus()
    expect(env.events[0]?.kind).toBe('conflict')
    // The automatic save then refuses to overwrite the other version.
    await vi.advanceTimersByTimeAsync(2100)
    expect(env.saves).toHaveLength(0)
    expect(env.events[1]?.kind).toBe('conflict')
  })

  it('rescans every 30 s while the window is visible only', async () => {
    const env = await setup()
    const spy = vi.spyOn(env.store, 'changesSince')
    env.sync.start()
    await vi.advanceTimersByTimeAsync(30_100)
    expect(spy).toHaveBeenCalledTimes(1)
    env.setVisible(false)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(spy).toHaveBeenCalledTimes(1)
    env.setVisible(true)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(spy).toHaveBeenCalledTimes(2)
    env.sync.stop()
  })

  it('reports the removal of the open play by the other computer', async () => {
    const env = await setup()
    env.fs.writeExternal(`combinaisons/${playFileName(env.open.play)}`, 'broken')
    await env.sync.onFocus()
    expect(env.events).toEqual([{ kind: 'removed' }])
  })
})
