// The editor, the synchronisation controller and the folder together, with the simulated
// behaviours of Drive (correction after the lot 3 acceptance, D-097, D-098): a version written by
// the page is never taken for an external change, whatever Drive does with its date or content.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playFileName } from '../io/fileNames'
import { FolderStore } from '../io/FolderStore'
import { IdbStore } from '../io/IdbStore'
import type { LibraryStore } from '../io/LibraryStore'
import { serialize } from '../io/serialize'
import { SyncController, type ExternalChange } from '../io/sync'
import type { Play } from '../model/types'
import { sequentialIds, sevenVsSevenWithOptions } from '../test/builders'
import { driveGivesBack, driveTouchesDate, fileVersions } from '../test/driveSim'
import { createMemoryFs, type MemoryFs } from '../test/memoryFs'
import { createMemoryKv } from '../test/memoryKv'
import {
  applyEdit,
  beginGesture,
  cancelGesture,
  endGesture,
  markSaved,
  openPlay,
  previewGesture,
  reloadPlay,
  setEditorChangeListener,
  undoEdit,
  useEditorStore,
} from './editorStore'
import { onGestureEnd, openPlayForSync } from './syncBridge'

let clock = 0
/** Each save gets its own updatedAt, as in real use. */
const now = (): Date => new Date((clock += 1000))

const current = (): Play => {
  const play = useEditorStore.getState().play
  if (!play) throw new Error('no play')
  return play
}

const edit = (notes: string): void => {
  applyEdit((p) => ({ ...p, notes }))
}

const notesIn = (text: string | undefined): unknown =>
  (JSON.parse(text ?? '{}') as { notes?: unknown }).notes

interface Env {
  store: LibraryStore
  sync: SyncController
  events: ExternalChange[]
}

let unsubscribe: () => void = () => undefined

/** The open play saved in `store`, the controller wired as in session.ts. */
async function connect(store: LibraryStore): Promise<Env> {
  const { play, version } = await store.put(sevenVsSevenWithOptions())
  openPlay(play, version, false)
  const events: ExternalChange[] = []
  const sync = new SyncController(store, {
    getOpen: openPlayForSync,
    saved: (result, savedFrom) => {
      markSaved(result, savedFrom)
    },
    externalChange: (change) => {
      events.push(change)
      if (change.kind === 'reloaded') reloadPlay(change.play, change.version)
    },
    libraryChanged: () => undefined,
    error: (error: unknown) => {
      throw error
    },
  })
  setEditorChangeListener(() => {
    sync.notifyLocalChange()
  })
  unsubscribe = onGestureEnd(() => void sync.gestureEnded())
  return { store, sync, events }
}

let fs: MemoryFs
let path: string

async function folderEnv(): Promise<Env> {
  fs = createMemoryFs()
  const env = await connect(await FolderStore.open(fs.root, { now, ids: sequentialIds() }))
  path = `combinaisons/${playFileName(current())}`
  return env
}

beforeEach(() => {
  clock = Date.UTC(2026, 9, 23, 12)
})

afterEach(() => {
  unsubscribe()
  vi.useRealTimers()
})

describe('no automatic save during a gesture (D-099)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('a gesture longer than the save delay: nothing written before its end', async () => {
    const env = await folderEnv()
    const writes = fs.writeCount
    edit('a')
    await vi.advanceTimersByTimeAsync(1000)
    beginGesture()
    for (let s = 1; s <= 5; s++) {
      previewGesture((start) => ({ ...start, notes: `g${String(s)}` }))
      await vi.advanceTimersByTimeAsync(1000)
    }
    expect(fs.writeCount).toBe(writes)
    endGesture()
    await vi.advanceTimersByTimeAsync(0)
    expect(fs.writeCount).toBe(writes + 1)
    expect(notesIn(fs.read(path))).toBe('g5')
    await vi.advanceTimersByTimeAsync(5000)
    expect(fs.writeCount).toBe(writes + 1)
    expect(useEditorStore.getState().dirty).toBe(false)
    expect(env.events).toEqual([])
  })

  it('a cancelled gesture (Escape) saves the changes made before it, and only those', async () => {
    const env = await folderEnv()
    const writes = fs.writeCount
    edit('a')
    await vi.advanceTimersByTimeAsync(1000)
    beginGesture()
    previewGesture((start) => ({ ...start, notes: 'g' }))
    await vi.advanceTimersByTimeAsync(3000)
    expect(fs.writeCount).toBe(writes)
    cancelGesture()
    await vi.advanceTimersByTimeAsync(0)
    expect(fs.writeCount).toBe(writes + 1)
    expect(notesIn(fs.read(path))).toBe('a')
    expect(env.events).toEqual([])
  })

  it('a cancelled gesture without unsaved changes writes nothing', async () => {
    await folderEnv()
    const writes = fs.writeCount
    beginGesture()
    previewGesture((start) => ({ ...start, notes: 'g' }))
    await vi.advanceTimersByTimeAsync(3000)
    cancelGesture()
    await vi.advanceTimersByTimeAsync(3000)
    expect(fs.writeCount).toBe(writes)
  })
})

describe('a version written by the page is never a conflict (D-097)', () => {
  it('undo after a save, date changed by Drive, then save: no conflict', async () => {
    const env = await folderEnv()
    edit('a')
    await env.sync.saveNow()
    edit('b')
    await env.sync.saveNow()
    undoEdit()
    undoEdit()
    driveTouchesDate(fs, path)
    await env.sync.saveNow()
    expect(env.events).toEqual([])
    expect(notesIn(fs.read(path))).toBe('')
    expect(useEditorStore.getState().dirty).toBe(false)
  })

  it('a gesture begun before a save, date changed by Drive, then save: no conflict', async () => {
    const env = await folderEnv()
    edit('a')
    beginGesture()
    previewGesture((start) => ({ ...start, notes: 'g1' }))
    // Ctrl+S during the gesture: the start of the gesture keeps the previous version.
    await env.sync.saveNow()
    previewGesture((start) => ({ ...start, notes: 'g2' }))
    endGesture()
    driveTouchesDate(fs, path)
    await env.sync.saveNow()
    expect(env.events).toEqual([])
    expect(notesIn(fs.read(path))).toBe('g2')
  })

  it('a date changed without content change: neither dialog nor reload', async () => {
    const env = await folderEnv()
    edit('a')
    await env.sync.saveNow()
    driveTouchesDate(fs, path)
    await env.sync.onFocus()
    expect(env.events).toEqual([])
    edit('b')
    driveTouchesDate(fs, path)
    await env.sync.onFocus()
    expect(env.events).toEqual([])
    expect(useEditorStore.getState()).toMatchObject({ dirty: true, play: { notes: 'b' } })
    await env.sync.saveNow()
    expect(env.events).toEqual([])
    expect(notesIn(fs.read(path))).toBe('b')
  })
})

describe('Drive gives back a version written earlier by the page (D-098)', () => {
  it('without a change in progress: no reload, the last version is written back', async () => {
    const env = await folderEnv()
    const versions = fileVersions(fs, path)
    edit('a')
    await env.sync.saveNow()
    const v1 = versions.keep()
    edit('b')
    await env.sync.saveNow()
    const v2 = versions.keep()
    driveGivesBack(fs, path, v1)
    await env.sync.onFocus()
    expect(env.events).toEqual([])
    expect(useEditorStore.getState()).toMatchObject({ dirty: false, play: { notes: 'b' } })
    expect(fs.read(path)).toBe(v2)
  })

  it('with a change in progress: no dialog, the change is kept, then saved', async () => {
    const env = await folderEnv()
    const versions = fileVersions(fs, path)
    edit('a')
    await env.sync.saveNow()
    const v1 = versions.keep()
    edit('b')
    await env.sync.saveNow()
    const v2 = versions.keep()
    edit('c')
    driveGivesBack(fs, path, v1)
    await env.sync.onFocus()
    expect(env.events).toEqual([])
    expect(useEditorStore.getState()).toMatchObject({ dirty: true, play: { notes: 'c' } })
    expect(fs.read(path)).toBe(v2)
    await env.sync.saveNow()
    expect(env.events).toEqual([])
    expect(notesIn(fs.read(path))).toBe('c')
  })

  it('seen only when writing: the write goes on', async () => {
    const env = await folderEnv()
    const versions = fileVersions(fs, path)
    edit('a')
    await env.sync.saveNow()
    const v1 = versions.keep()
    edit('b')
    await env.sync.saveNow()
    edit('c')
    driveGivesBack(fs, path, v1)
    await env.sync.saveNow()
    expect(env.events).toEqual([])
    expect(notesIn(fs.read(path))).toBe('c')
  })

  it('after a version of the other computer was reloaded, that version is written back (Q1)', async () => {
    const env = await folderEnv()
    const versions = fileVersions(fs, path)
    edit('a')
    await env.sync.saveNow()
    const v1 = versions.keep()
    const remote = serialize({ ...current(), notes: 'PC 2', updatedAt: '2030-01-01T10:00:00.000Z' })
    fs.writeExternal(path, remote)
    await env.sync.onFocus()
    expect(env.events.map((e) => e.kind)).toEqual(['reloaded'])
    driveGivesBack(fs, path, v1)
    await env.sync.onFocus()
    expect(env.events.map((e) => e.kind)).toEqual(['reloaded'])
    expect(current().notes).toBe('PC 2')
    expect(fs.read(path)).toBe(remote)
  })
})

describe('a real change by another instance (SPEC 8.4)', () => {
  const remoteText = () =>
    serialize({ ...current(), notes: 'PC 2', updatedAt: '2030-01-01T10:00:00.000Z' })

  it('reloads silently without a change in progress', async () => {
    const env = await folderEnv()
    edit('a')
    await env.sync.saveNow()
    fs.writeExternal(path, remoteText())
    await env.sync.onFocus()
    expect(env.events.map((e) => e.kind)).toEqual(['reloaded'])
    expect(current().notes).toBe('PC 2')
  })

  it('asks with a change in progress, and the save refuses to overwrite it', async () => {
    const env = await folderEnv()
    edit('a')
    await env.sync.saveNow()
    edit('b')
    const remote = remoteText()
    fs.writeExternal(path, remote)
    await env.sync.onFocus()
    expect(env.events.map((e) => e.kind)).toEqual(['conflict'])
    await env.sync.saveNow()
    expect(env.events.map((e) => e.kind)).toEqual(['conflict', 'conflict'])
    expect(fs.read(path)).toBe(remote)
  })

  it('is still a conflict after an undo and a date changed by Drive', async () => {
    const env = await folderEnv()
    edit('a')
    await env.sync.saveNow()
    undoEdit()
    driveTouchesDate(fs, path)
    const remote = remoteText()
    fs.writeExternal(path, remote)
    await env.sync.saveNow()
    expect(env.events.map((e) => e.kind)).toEqual(['conflict'])
    expect(fs.read(path)).toBe(remote)
  })
})

describe('browser library (SPEC 8.6, D-097)', () => {
  it('undo past a save, then save: no conflict; another tab is still detected', async () => {
    const kv = createMemoryKv()
    const env = await connect(await IdbStore.open(kv, now))
    edit('a')
    await env.sync.saveNow()
    edit('b')
    await env.sync.saveNow()
    undoEdit()
    await env.sync.saveNow()
    expect(env.events).toEqual([])
    expect((await env.store.get(current().id)).notes).toBe('a')
    const other = await IdbStore.open(kv, now)
    await other.put({ ...current(), notes: 'autre onglet' })
    edit('moi')
    await env.sync.saveNow()
    expect(env.events.map((e) => e.kind)).toEqual(['conflict'])
  })
})
