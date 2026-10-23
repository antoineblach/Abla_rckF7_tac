// Placement presets in the library (SPEC 10.1, D-089 to D-092, D-096): save, update, apply,
// rename, duplicate, remove, new play from a preset; an action on a preset changed on the other
// computer is refused with a message. Against the in-memory folder.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Hit } from '../editor/hitTest'
import { wholePlacementIds } from '../editor/placementMode'
import { presetFileName } from '../io/fileNames'
import { FolderStore } from '../io/FolderStore'
import type { PresetEntry } from '../io/LibraryStore'
import { serialize } from '../io/serialize'
import type { PlacementPreset } from '../model/preset'
import { isPlayer, type Play } from '../model/types'
import { lineoutPreset, P, sequentialIds, sevenVsSevenWithOptions, uuid } from '../test/builders'
import { driveGivesBack, driveTouchesDate } from '../test/driveSim'
import { createMemoryFs, type MemoryFs } from '../test/memoryFs'
import { TEXT } from '../ui/strings'
import { editorPointerDown, useInteractionStore } from './editorActions'
import { openPlay, setTool, useEditorStore } from './editorStore'
import { pushDialog, useLibraryState } from './libraryState'
import { usePlayerStore } from './playerStore'
import {
  configurePresetSession,
  createPlayFromPreset,
  duplicatePreset,
  openUpdatePresetDialog,
  removePreset,
  renamePreset,
  resolvePresetDuplicate,
  startApplyPreset,
  startSavePreset,
} from './presetSession'
import { loadLibraryFrom } from './session'

const NOW = new Date(2026, 9, 16, 15, 0, 0)
const STAMP = NOW.toISOString()

let fs: MemoryFs
let folder: FolderStore
let saves = 0

const down = (pos: { x: number; y: number }, hit: Hit = null) => {
  editorPointerDown({ pos, hit, shift: false })
}
const current = (): Play => {
  const play = useEditorStore.getState().play
  if (!play) throw new Error('no play')
  return play
}
const messages = () => useLibraryState.getState().toasts.map((t) => t.message)
const entries = () => useLibraryState.getState().presets
const entry = (index = 0): PresetEntry => {
  const found = entries()[index]
  if (!found) throw new Error('no preset')
  return found
}
const filePath = (p: { name: string; id: string }) => `modeles/${presetFileName(p)}`

async function stored(preset: PlacementPreset): Promise<void> {
  await folder.putPreset(preset)
  await loadLibraryFrom(folder)
}

/** The other computer rewrites the preset (synchronisation by Drive). */
function writtenElsewhere(preset: PlacementPreset, patch: Partial<PlacementPreset>): void {
  fs.writeExternal(
    filePath(preset),
    serialize({ ...preset, ...patch, updatedAt: '2026-10-16T13:30:00.000Z' }),
  )
}

function lastDialog() {
  const dialog = useLibraryState.getState().dialogs.at(-1)
  if (!dialog) throw new Error('no dialog')
  return dialog
}

beforeEach(async () => {
  fs = createMemoryFs()
  folder = await FolderStore.open(fs.root, { now: () => NOW, ids: sequentialIds(5000) })
  saves = 0
  configurePresetSession({
    store: () => folder,
    rescan: async () => {
      await folder.changesSince(0)
    },
    savePlay: () => {
      saves++
      return Promise.resolve()
    },
    now: () => NOW,
    ids: sequentialIds(9000),
  })
  useLibraryState.setState({ toasts: [], dialogs: [], presets: [], presetIssues: [] })
  openPlay(sevenVsSevenWithOptions(), null, false)
  setTool('select')
  usePlayerStore.setState({ mode: 'edit' })
  useInteractionStore.setState({ metersPerPx: 0, cursor: null })
})

describe('saving a preset (SPEC 10.1, D-089)', () => {
  it('writes the whole starting placement in modeles/ once the anchor is clicked', async () => {
    pushDialog({ kind: 'savePreset', update: null })
    startSavePreset(lastDialog(), {
      request: {
        name: 'Ligne à 7',
        type: 'free',
        playerIds: wholePlacementIds(current()),
        includeBall: true,
      },
      openSide: 'right',
    })
    expect(useLibraryState.getState().dialogs).toEqual([])
    expect(useEditorStore.getState().placement?.kind).toBe('savePreset')
    down({ x: 40.2, y: 34.8 })
    await vi.waitFor(() => {
      expect(entries()).toHaveLength(1)
    })
    const saved = entry().preset
    expect(fs.list('modeles')).toEqual([`ligne-a-7--${uuid(9000)}.preset.json`])
    expect(fs.read(filePath(saved))).toBe(serialize(saved))
    expect(saved).toMatchObject({
      id: uuid(9000),
      name: 'Ligne à 7',
      type: 'free',
      createdAt: STAMP,
      updatedAt: STAMP,
      ball: { forward: 0, openSide: 0, carrierRole: 'attack', carrierNumber: 4 },
    })
    expect(saved.positions).toHaveLength(14)
    expect(saved.positions).toContainEqual({
      role: 'defense',
      number: 1,
      forward: 10,
      openSide: -30,
    })
    expect(messages()).toContain(TEXT.presetSaved('Ligne à 7'))
    // The play is not changed by saving a preset.
    expect(useEditorStore.getState().history.past).toEqual([])
  })

  it('then applies it elsewhere, when B attacks: roles follow the attacking team', async () => {
    await stored({
      ...lineoutPreset(),
      positions: [{ role: 'attack', number: 1, forward: -1, openSide: 3 }],
      ball: null,
    })
    openPlay({ ...sevenVsSevenWithOptions(), attackingTeam: 'B' }, null, false)
    await startApplyPreset(entry())
    expect(useEditorStore.getState().placement?.kind).toBe('applyPreset')
    down({ x: 60, y: 66 })
    // B attacks towards -x: 1 m behind the mark is x + 1; towards the field from y = 70.
    const b1 = current().entities.find((e) => isPlayer(e) && e.team === 'B' && e.number === 1)
    expect(b1 && current().setup.positions[b1.id]).toEqual({ x: 61, y: 67 })
    expect(current().category).toBe('lineout')
  })

  it('updates a preset keeping its id, its name and its type (« Mettre à jour »)', async () => {
    await stored(lineoutPreset())
    await openUpdatePresetDialog(entry())
    startSavePreset(lastDialog(), {
      request: { name: 'Touche à 4', type: 'lineout', playerIds: [P.A(1)], includeBall: false },
      openSide: 'auto',
    })
    down({ x: 40, y: 1 })
    await vi.waitFor(() => {
      expect(messages()).toContain(TEXT.presetUpdated('Touche à 4'))
    })
    expect(fs.list('modeles')).toEqual([presetFileName(lineoutPreset())])
    expect(entry().preset).toEqual({
      ...lineoutPreset(),
      positions: [{ role: 'attack', number: 1, forward: 0, openSide: 5 }],
      ball: null,
      updatedAt: STAMP,
    })
  })

  it('refuses the update when the other computer changed the preset meanwhile (D-092)', async () => {
    await stored(lineoutPreset())
    await openUpdatePresetDialog(entry())
    const read = entry().preset
    writtenElsewhere(read, { positions: [] })
    startSavePreset(lastDialog(), {
      request: { name: 'Touche à 4', type: 'lineout', playerIds: [P.A(1)], includeBall: false },
      openSide: 'auto',
    })
    down({ x: 40, y: 1 })
    await vi.waitFor(() => {
      expect(messages()).toContain(TEXT.presetChanged)
    })
    // The version of the other computer is kept, and shown.
    expect(JSON.parse(fs.read(filePath(read)) ?? '{}')).toMatchObject({ positions: [] })
    await vi.waitFor(() => {
      expect(entry().preset.positions).toEqual([])
    })
  })
})

describe('managing presets (SPEC 10.1, D-092)', () => {
  it('renames: new file, old one in the trash', async () => {
    await stored(lineoutPreset())
    await renamePreset(entry(), 'Touche longue')
    expect(fs.list('modeles')).toEqual([`touche-longue--${uuid(8000)}.preset.json`])
    expect(fs.list('_corbeille')).toHaveLength(1)
    expect(entry().preset.name).toBe('Touche longue')
    expect(messages()).toContain(TEXT.presetRenamed)
  })

  it('duplicates with a new id and « (copie) »', async () => {
    await stored(lineoutPreset())
    await duplicatePreset(entry())
    expect(entries().map((e) => e.preset.name)).toEqual(['Touche à 4', 'Touche à 4 (copie)'])
    expect(entries()[1]?.preset.id).toBe(uuid(9000))
    expect(entries()[1]?.preset.positions).toEqual(lineoutPreset().positions)
  })

  it('removes by moving to the trash, never deleting', async () => {
    await stored(lineoutPreset())
    const text = fs.read(filePath(lineoutPreset()))
    await removePreset(entry())
    expect(fs.list('modeles')).toEqual([])
    const [trashed] = fs.list('_corbeille')
    expect(fs.read(`_corbeille/${trashed ?? ''}`)).toBe(text)
    expect(entries()).toEqual([])
    expect(messages()).toContain(TEXT.presetDeleted)
  })

  it('refuses an action on a preset changed elsewhere since it was read, and reads it again', async () => {
    await stored(lineoutPreset())
    const read = entry()
    writtenElsewhere(read.preset, { name: 'Touche à 5' })
    await renamePreset(read, 'Mienne')
    expect(messages()).toEqual([TEXT.presetChanged])
    expect(fs.list('modeles')).toEqual([presetFileName(lineoutPreset())])
    expect(entry().preset.name).toBe('Touche à 5')
    // Applying the stale version is refused too.
    await startApplyPreset(read)
    expect(useEditorStore.getState().placement).toBeNull()
  })

  it('keeps a conflict copy read only until it is resolved (D-022)', async () => {
    const a = lineoutPreset()
    fs.writeExternal(filePath(a), serialize(a))
    fs.writeExternal(
      `modeles/touche-a-4--${a.id} (1).preset.json`,
      serialize({ ...a, name: 'Autre' }),
    )
    await folder.changesSince(0)
    await loadLibraryFrom(folder)
    expect(useLibraryState.getState().presetIssues).toMatchObject([{ kind: 'duplicate', id: a.id }])
    expect(entries().every((e) => e.readOnly)).toBe(true)
    await renamePreset(entry(), 'Mienne')
    expect(messages()).toEqual([TEXT.presetReadOnly])
    // Applying only reads the preset.
    await startApplyPreset(entry())
    expect(useEditorStore.getState().placement?.kind).toBe('applyPreset')
    await resolvePresetDuplicate(a.id, { kind: 'keepBoth' })
    expect(useLibraryState.getState().presetIssues).toEqual([])
    expect(new Set(entries().map((e) => e.preset.id)).size).toBe(2)
  })

  it('does not apply on a read-only play', async () => {
    await stored(lineoutPreset())
    openPlay(sevenVsSevenWithOptions(), null, true)
    await startApplyPreset(entry())
    expect(useEditorStore.getState().placement).toBeNull()
    expect(useEditorStore.getState().notice).toBe('readOnly')
  })
})

describe('versions of a preset written by the page (D-097, D-098)', () => {
  let clock = 0
  const later = () => new Date((clock += 1000))
  const path = () => filePath(lineoutPreset())
  const updateForm = {
    request: {
      name: 'Touche à 4',
      type: 'lineout' as const,
      playerIds: [P.A(1)],
      includeBall: false,
    },
    openSide: 'auto' as const,
  }

  beforeEach(async () => {
    // Each write gets its own updatedAt, as in real use.
    clock = Date.UTC(2026, 9, 23, 12)
    folder = await FolderStore.open(fs.root, { now: later, ids: sequentialIds(5000) })
    configurePresetSession({
      store: () => folder,
      rescan: async () => {
        await folder.changesSince(0)
      },
      savePlay: () => Promise.resolve(),
      now: later,
      ids: sequentialIds(9000),
    })
  })

  it('given back by Drive to an older version of the page: no refusal, last version written back', async () => {
    await stored(lineoutPreset())
    const v1 = fs.read(path()) ?? ''
    await stored({ ...entry().preset, positions: [] })
    const v2 = fs.read(path()) ?? ''
    const shown = entry()
    driveGivesBack(fs, path(), v1)
    await duplicatePreset(shown)
    expect(messages()).toEqual([TEXT.presetDuplicated])
    expect(fs.read(path())).toBe(v2)
    expect(entries().map((e) => e.preset.positions)).toEqual([[], []])
    driveGivesBack(fs, path(), v1)
    await startApplyPreset(entry())
    expect(useEditorStore.getState().placement?.kind).toBe('applyPreset')
    expect(fs.read(path())).toBe(v2)
  })

  it('« Mettre à jour » after a date changed by Drive', async () => {
    await stored(lineoutPreset())
    await openUpdatePresetDialog(entry())
    driveTouchesDate(fs, path())
    startSavePreset(lastDialog(), updateForm)
    down({ x: 40, y: 1 })
    await vi.waitFor(() => {
      expect(messages()).toContain(TEXT.presetUpdated('Touche à 4'))
    })
  })

  it('« Mettre à jour » after Drive gave back an older version of the page', async () => {
    await stored(lineoutPreset())
    const v1 = fs.read(path()) ?? ''
    await stored({ ...entry().preset, positions: [] })
    await openUpdatePresetDialog(entry())
    driveGivesBack(fs, path(), v1)
    startSavePreset(lastDialog(), updateForm)
    down({ x: 40, y: 1 })
    await vi.waitFor(() => {
      expect(messages()).toContain(TEXT.presetUpdated('Touche à 4'))
    })
    expect(entry().preset.positions).toEqual([
      { role: 'attack', number: 1, forward: 0, openSide: 5 },
    ])
  })

  it('a list late on a write of the page: no refusal, the stored version is used', async () => {
    await stored(lineoutPreset())
    const shown = entry()
    await folder.putPreset({ ...shown.preset, positions: [] })
    await renamePreset(shown, 'Touche longue')
    expect(messages()).toEqual([TEXT.presetRenamed])
    expect(entry().preset).toMatchObject({ name: 'Touche longue', positions: [] })
  })
})

describe('new play from a preset (SPEC 6.6, D-091)', () => {
  it('opens a play without players, with a ball, then lays the preset by its anchor', async () => {
    await stored(lineoutPreset())
    const previous = current().id
    await createPlayFromPreset(entry())
    const created = current()
    expect(created.id).not.toBe(previous)
    expect(created.entities).toEqual([{ id: expect.any(String) as string, kind: 'ball' }])
    expect(saves).toBe(2)
    expect(useEditorStore.getState().placement?.kind).toBe('applyPreset')
    down({ x: 50, y: 69 })
    const play = current()
    expect(play.entities.filter(isPlayer)).toHaveLength(7)
    expect(play.category).toBe('lineout')
    const carrier = play.entities.find((e) => e.id === play.setup.ballCarrierId)
    expect(isPlayer(carrier) && `${carrier.team}${String(carrier.number)}`).toBe('A2')
    expect(useEditorStore.getState().history.past).toHaveLength(1)
  })
})
