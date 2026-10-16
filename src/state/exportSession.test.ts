// Export session (SPEC 9.1, 9.2, D-064 to D-067): the stores, with the inline engine and the
// in-memory folder.
import { beforeEach, describe, expect, it } from 'vitest'
import type { PlaySummary } from '../io/LibraryStore'
import { defaultSettings } from '../model/settings'
import { basePlay, uuid } from '../test/builders'
import { loadOptionsFixture } from '../test/exportFixtures'
import { createInlineEngine } from '../test/inlineEngine'
import { createMemoryFs, type MemoryFs } from '../test/memoryFs'
import { openPlay } from './editorStore'
import {
  answerExisting,
  bookCandidates,
  bookSubtitle,
  cancelExport,
  categoryIds,
  configureExportSession,
  exportGif,
  exportLightVersion,
  gifFileNames,
  hasOptions,
  heavyFiles,
} from './exportSession'
import { useExportStore } from './exportStore'
import { useLibraryState } from './libraryState'

const NOW = new Date(2026, 9, 15, 22, 0, 0)
const fixture = loadOptionsFixture()
const PREFS = { ...defaultSettings().export.gif, speed: 'real' as const }
const NAME = 'croisee-au-centre--portrait-enchaine-reel.gif'

let fs: MemoryFs

beforeEach(() => {
  fs = createMemoryFs()
  configureExportSession({
    engine: () => engine,
    target: () => ({ kind: 'folder', root: fs.root }),
    now: () => NOW,
    heavyThreshold: Number.POSITIVE_INFINITY,
  })
  useExportStore.setState({ dialog: null, running: null, existing: null, outcome: null })
  useLibraryState.setState({ toasts: [] })
  openPlay(fixture, null, false)
})

let engine = createInlineEngine()

describe('export session (SPEC 9.1, 9.2)', () => {
  it('exports the open play and shows the files with their size', async () => {
    engine = createInlineEngine()
    await exportGif(PREFS)
    const { outcome, running } = useExportStore.getState()
    expect(running).toBeNull()
    expect(outcome).toMatchObject({
      kind: 'gif',
      location: 'folder',
      heavy: false,
      canLighten: false,
    })
    expect(outcome?.files.map((f) => f.fileName)).toEqual([NAME])
    expect(outcome?.files[0]?.size).toBe(fs.readBytes(`exports/${NAME}`)?.length)
    expect(gifFileNames(fixture, PREFS)).toEqual([NAME])
  })

  it('asks before replacing an existing export (D-065)', async () => {
    engine = createInlineEngine()
    fs.writeExternal(`exports/${NAME}`, new Uint8Array([1]))
    const pending = exportGif(PREFS)
    await expect.poll(() => useExportStore.getState().existing).toEqual([NAME])
    answerExisting('replace')
    await pending
    expect(useExportStore.getState().outcome?.files[0]).toMatchObject({
      fileName: NAME,
      replaced: true,
    })
    expect(fs.list('_corbeille')).toHaveLength(1)
  })

  it('cancels during the encoding: no file, a notice', async () => {
    engine = createInlineEngine({
      onStep: () => {
        if (useExportStore.getState().running?.progress?.stage === 'frames') cancelExport()
      },
    })
    await exportGif(PREFS)
    expect(useExportStore.getState().outcome).toBeNull()
    expect(fs.list('exports')).toEqual([])
    expect(useLibraryState.getState().toasts.map((t) => t.message)).toContain(
      'Export annulé : aucun fichier écrit.',
    )
  })

  it('offers a lighter version above the weight threshold (D-067)', async () => {
    engine = createInlineEngine()
    configureExportSession({ heavyThreshold: 1000 })
    await exportGif({ ...PREFS, quality: 'high' })
    expect(useExportStore.getState().outcome).toMatchObject({ heavy: true, canLighten: true })
    await exportLightVersion()
    const outcome = useExportStore.getState().outcome
    expect(outcome?.files.map((f) => f.fileName)).toEqual([
      'croisee-au-centre--portrait-enchaine-reel-allege.gif',
    ])
    expect(outcome).toMatchObject({ heavy: true, canLighten: false })
    expect(heavyFiles([{ fileName: 'a', size: 8, replaced: false }], 8)).toEqual([])
    expect(heavyFiles([{ fileName: 'a', size: 9, replaced: false }], 8)).toHaveLength(1)
  })

  it('knows when a play has options', () => {
    expect(hasOptions(fixture)).toBe(true)
    expect(hasOptions(basePlay())).toBe(false)
    expect(hasOptions(null)).toBe(false)
  })
})

describe('playbook selection (D-064)', () => {
  const summary = (
    n: number,
    name: string,
    category: PlaySummary['category'],
    updatedAt: string,
  ) => ({
    id: uuid(n),
    name,
    category,
    updatedAt,
    fileName: null,
    readOnly: false,
  })
  const summaries: PlaySummary[] = [
    summary(1, 'Bravo', 'scrum', '2026-10-01T00:00:00.000Z'),
    summary(2, 'Alpha', 'lineout', '2026-10-03T00:00:00.000Z'),
    summary(3, 'Charlie', 'scrum', '2026-10-02T00:00:00.000Z'),
    { ...summary(4, 'Doublon', 'scrum', '2026-10-04T00:00:00.000Z'), readOnly: true },
  ]

  it('orders the plays as the library sort, without the read-only duplicates', () => {
    expect(bookCandidates({ summaries, sort: 'name' }).map((s) => s.name)).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ])
    expect(bookCandidates({ summaries, sort: 'date' }).map((s) => s.name)).toEqual([
      'Alpha',
      'Charlie',
      'Bravo',
    ])
  })

  it('names the subtitle after a whole category, else « Sélection »', () => {
    const candidates = bookCandidates({ summaries, sort: 'name' })
    const scrum = categoryIds(candidates, 'scrum')
    expect(scrum).toEqual([uuid(1), uuid(3)])
    expect(bookSubtitle(candidates, new Set(scrum))).toBe('Mêlée')
    expect(bookSubtitle(candidates, new Set([uuid(1)]))).toBe('Sélection')
    expect(bookSubtitle(candidates, new Set([uuid(1), uuid(2)]))).toBe('Sélection')
    expect(bookSubtitle(candidates, new Set())).toBe('Sélection')
  })
})
