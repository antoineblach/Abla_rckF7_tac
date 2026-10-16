// Writing the exports (SPEC 8.2, 9.1, D-043, D-065) against the in-memory folder, and the whole
// export run with the inline engine (the worker handler run in Node).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectedFileNames, type ExportJob } from '../export/jobs'
import type { ExportFile, ExportProgress, GifOptions } from '../export/types'
import { defaultSettings, engineSettingsOf } from '../model/settings'
import { DEFAULT_LAYERS } from '../render/layers'
import { loadOptionsFixture } from '../test/exportFixtures'
import { createInlineEngine } from '../test/inlineEngine'
import { createMemoryFs, type MemoryFs } from '../test/memoryFs'
import { runExport, type ExistingDecision, type ExportRunDeps } from './exportRun'
import { ExportExistsError, existingExports, writeExports } from './exportsFolder'
import { moveToTrash } from './trash'

const NOW = new Date(2026, 9, 15, 21, 30, 5)
const STAMP = '2026-10-15_21-30-05'
const settings = engineSettingsOf(defaultSettings())
const fixture = loadOptionsFixture()

const GIF_OPTIONS: GifOptions = {
  orientation: 'portrait',
  lines: 'chained',
  speed: 'real',
  quality: 'standard',
  theme: 'highContrast',
  optimizeUnchanged: true,
  light: false,
  layers: DEFAULT_LAYERS,
}
const GIF_JOB: ExportJob = { kind: 'gif', play: fixture, settings, options: GIF_OPTIONS }
const GIF_NAME = 'croisee-au-centre--portrait-enchaine-reel.gif'

let fs: MemoryFs
beforeEach(() => {
  fs = createMemoryFs()
})

const bytes = (...values: number[]) => new Uint8Array(values)

function deps(overrides: Partial<ExportRunDeps> = {}): ExportRunDeps {
  return {
    engine: createInlineEngine(),
    target: { kind: 'folder', root: fs.root },
    now: () => NOW,
    confirmExisting: () => Promise.resolve<ExistingDecision>('cancel'),
    onProgress: () => undefined,
    onSaving: () => undefined,
    download: () => undefined,
    ...overrides,
  }
}

describe('trash (SPEC 8.5, D-043)', () => {
  it('moves a binary file by a verified copy, numbering two moves in the same second', async () => {
    fs.writeExternal('exports/a.gif', bytes(71, 73, 70, 0, 255, 128))
    const dir = await fs.root.getDirectoryHandle('exports')
    const trash = await fs.root.getDirectoryHandle('_corbeille', { create: true })
    expect(await moveToTrash(dir, 'a.gif', trash, NOW)).toBe(`${STAMP}--a.gif`)
    expect(fs.readBytes(`_corbeille/${STAMP}--a.gif`)).toEqual(bytes(71, 73, 70, 0, 255, 128))
    expect(fs.exists('exports/a.gif')).toBe(false)
    fs.writeExternal('exports/a.gif', bytes(1))
    expect(await moveToTrash(dir, 'a.gif', trash, NOW)).toBe(`${STAMP}--2-a.gif`)
  })
})

describe('exports/ (SPEC 9.1, D-065)', () => {
  it('writes new exports, creating exports/', async () => {
    const written = await writeExports(
      fs.root,
      [{ fileName: 'x.pdf', bytes: bytes(1, 2, 3) }],
      new Map(),
      NOW,
    )
    expect(written).toEqual([{ fileName: 'x.pdf', size: 3, replaced: false }])
    expect(fs.readBytes('exports/x.pdf')).toEqual(bytes(1, 2, 3))
  })

  it('never overwrites an existing export without a decision', async () => {
    fs.writeExternal('exports/x.pdf', bytes(9))
    const before = fs.writeCount
    await expect(
      writeExports(
        fs.root,
        [
          { fileName: 'y.pdf', bytes: bytes(1) },
          { fileName: 'x.pdf', bytes: bytes(2) },
        ],
        new Map(),
        NOW,
      ),
    ).rejects.toBeInstanceOf(ExportExistsError)
    expect(fs.writeCount).toBe(before)
    expect(fs.list('exports')).toEqual(['x.pdf'])
    expect(await existingExports(fs.root, ['x.pdf', 'y.pdf'])).toEqual(['x.pdf'])
  })

  it('« Remplacer » moves the old export to the trash first', async () => {
    fs.writeExternal('exports/x.pdf', bytes(9, 9))
    const written = await writeExports(
      fs.root,
      [{ fileName: 'x.pdf', bytes: bytes(1) }],
      new Map([['x.pdf', 'replace']]),
      NOW,
    )
    expect(written).toEqual([{ fileName: 'x.pdf', size: 1, replaced: true }])
    expect(fs.readBytes('exports/x.pdf')).toEqual(bytes(1))
    expect(fs.readBytes(`_corbeille/${STAMP}--x.pdf`)).toEqual(bytes(9, 9))
  })

  it('« Garder les deux » numbers the new export', async () => {
    fs.writeExternal('exports/x--portrait.gif', bytes(1))
    fs.writeExternal('exports/x--portrait-2.gif', bytes(2))
    const written = await writeExports(
      fs.root,
      [{ fileName: 'x--portrait.gif', bytes: bytes(3) }],
      new Map([['x--portrait.gif', 'keepBoth']]),
      NOW,
    )
    expect(written.map((w) => w.fileName)).toEqual(['x--portrait-3.gif'])
    expect(fs.list('exports')).toEqual([
      'x--portrait-2.gif',
      'x--portrait-3.gif',
      'x--portrait.gif',
    ])
    expect(fs.list('_corbeille')).toEqual([])
  })

  it('removes the empty file of a failed write, which never held data', async () => {
    fs.failNextWrites(1)
    await expect(
      writeExports(fs.root, [{ fileName: 'x.pdf', bytes: bytes(1) }], new Map(), NOW),
    ).rejects.toThrow('Simulated write failure')
    expect(fs.list('exports')).toEqual([])
    expect(fs.list('_corbeille')).toEqual([])
  })

  it('writes all the files of an export or none of them (« un GIF par option »)', async () => {
    await fs.root.getDirectoryHandle('exports', { create: true })
    const files = [
      { fileName: 'a.gif', bytes: bytes(1) },
      { fileName: 'b.gif', bytes: bytes(2) },
    ]
    // The first file is written, the second fails: the first goes to the trash.
    const original = fs.root.getDirectoryHandle.bind(fs.root)
    let writes = 0
    const spy = vi
      .spyOn(fs.root, 'getDirectoryHandle')
      .mockImplementation(async (name, options) => {
        const dir = await original(name, options)
        if (name !== 'exports') return dir
        return {
          ...dir,
          getFileHandle: async (file: string, opts?: { create?: boolean }) => {
            const handle = await dir.getFileHandle(file, opts)
            if (opts?.create !== true) return handle
            writes++
            if (writes === 2) fs.failNextWrites(1)
            return handle
          },
        }
      })
    await expect(writeExports(fs.root, files, new Map(), NOW)).rejects.toThrow()
    spy.mockRestore()
    expect(fs.list('exports')).toEqual([])
    expect(fs.list('_corbeille')).toEqual([`${STAMP}--a.gif`])
  })
})

describe('export run (SPEC 9.1, D-065)', () => {
  it('encodes in the engine, then writes the file in exports/', async () => {
    const progress: ExportProgress[] = []
    const onSaving = vi.fn()
    const result = await runExport(GIF_JOB, deps({ onProgress: (p) => progress.push(p), onSaving }))
    expect(result).toMatchObject({ kind: 'written', location: 'folder' })
    if (result.kind !== 'written') return
    expect(result.files.map((f) => f.fileName)).toEqual([GIF_NAME])
    expect(expectedFileNames(GIF_JOB)).toEqual([GIF_NAME])
    const written = fs.readBytes(`exports/${GIF_NAME}`)
    expect(new TextDecoder().decode(written?.slice(0, 6))).toBe('GIF89a')
    expect(result.files[0]?.size).toBe(written?.length)
    expect(onSaving).toHaveBeenCalledTimes(1)
    expect(progress.length).toBeGreaterThan(1)
    expect(progress[progress.length - 1]?.done).toBe(progress[progress.length - 1]?.total)
  })

  it('asks before encoding when the export exists; « Annuler » encodes and writes nothing', async () => {
    fs.writeExternal(`exports/${GIF_NAME}`, bytes(1))
    const engine = createInlineEngine()
    const run = vi.spyOn(engine, 'run')
    const confirmExisting = vi.fn(() => Promise.resolve<ExistingDecision>('cancel'))
    const before = fs.writeCount
    expect(await runExport(GIF_JOB, deps({ engine, confirmExisting }))).toEqual({
      kind: 'cancelled',
    })
    expect(confirmExisting).toHaveBeenCalledWith([GIF_NAME])
    expect(run).not.toHaveBeenCalled()
    expect(fs.writeCount).toBe(before)
  })

  it('« Remplacer »: the old export in the trash, the new one identical to a fresh export', async () => {
    const first = await runExport(GIF_JOB, deps())
    expect(first.kind).toBe('written')
    const firstBytes = fs.readBytes(`exports/${GIF_NAME}`)
    const second = await runExport(
      GIF_JOB,
      deps({ confirmExisting: () => Promise.resolve('replace') }),
    )
    expect(second).toMatchObject({
      kind: 'written',
      files: [{ fileName: GIF_NAME, replaced: true }],
    })
    expect(fs.readBytes(`exports/${GIF_NAME}`)).toEqual(firstBytes)
    expect(fs.readBytes(`_corbeille/${STAMP}--${GIF_NAME}`)).toEqual(firstBytes)
  })

  it('asks again at writing for an export that appeared during the encoding', async () => {
    const confirmExisting = vi.fn(() => Promise.resolve<ExistingDecision>('keepBoth'))
    let created = false
    const engine = createInlineEngine({
      onStep: () => {
        if (created) return
        created = true
        fs.writeExternal(`exports/${GIF_NAME}`, bytes(7))
      },
    })
    const result = await runExport(GIF_JOB, deps({ engine, confirmExisting }))
    expect(confirmExisting).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      kind: 'written',
      files: [{ fileName: GIF_NAME.replace('.gif', '-2.gif') }],
    })
    expect(fs.readBytes(`exports/${GIF_NAME}`)).toEqual(bytes(7))
  })

  it('writes no partial file when cancelled during the encoding', async () => {
    let steps = 0
    const engine = createInlineEngine({
      onStep: () => {
        steps++
        if (steps === 5) engine.cancel()
      },
    })
    const before = fs.writeCount
    const result = await runExport(GIF_JOB, deps({ engine }))
    expect(result).toEqual({ kind: 'cancelled' })
    expect(fs.writeCount).toBe(before)
    expect(fs.list('exports')).toEqual([])
    // The engine is ready for the next export.
    expect((await runExport(GIF_JOB, deps({ engine }))).kind).toBe('written')
  })

  it('stops a worker that does not answer the cancellation, and starts a new one', async () => {
    const engine = createInlineEngine({ deaf: true, cancelTimeoutMs: 20 })
    const pending = engine.run(GIF_JOB, () => undefined)
    engine.cancel()
    expect(await pending).toEqual({ kind: 'cancelled' })
  })

  it('downloads the files when no folder is chosen (SPEC 9.1)', async () => {
    const downloads: ExportFile[] = []
    const before = fs.writeCount
    const result = await runExport(
      GIF_JOB,
      deps({ target: { kind: 'download' }, download: (f) => downloads.push(f) }),
    )
    expect(result).toMatchObject({ kind: 'written', location: 'download' })
    expect(downloads.map((f) => [f.fileName, f.mime])).toEqual([[GIF_NAME, 'image/gif']])
    expect(fs.writeCount).toBe(before)
  })

  it('writes every GIF of « un GIF par option » together', async () => {
    const job: ExportJob = { ...GIF_JOB, options: { ...GIF_OPTIONS, lines: 'perLeaf' } }
    const result = await runExport(job, deps())
    expect(result.kind).toBe('written')
    expect(fs.list('exports')).toEqual([
      'croisee-au-centre--portrait-option-a-reel.gif',
      'croisee-au-centre--portrait-option-b-reel.gif',
    ])
    expect(expectedFileNames(job)).toEqual(fs.list('exports'))
  })

  it('reports an engine error without writing', async () => {
    const job = { ...GIF_JOB, play: { ...fixture, phases: 'broken' } } as unknown as ExportJob
    const before = fs.writeCount
    const result = await runExport(job, deps())
    expect(result.kind).toBe('error')
    expect(fs.writeCount).toBe(before)
  })
})
