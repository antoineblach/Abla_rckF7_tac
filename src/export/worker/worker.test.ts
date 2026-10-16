// Protocol of the export worker (plan of lot 2, section 3): type guards, the handler run inline
// giving the same bytes as the export core, progress and one job at a time.
import { describe, expect, it } from 'vitest'
import { defaultSettings, engineSettingsOf } from '../../model/settings'
import { DEFAULT_LAYERS } from '../../render/layers'
import { bookPlays, loadOptionsFixture } from '../../test/exportFixtures'
import { createInlineEngine, runJobDirectly } from '../../test/inlineEngine'
import type { ExportJob } from '../jobs'
import type { ExportProgress } from '../types'
import { isFromWorker, isToWorker } from './protocol'

const settings = engineSettingsOf(defaultSettings())
const fixture = loadOptionsFixture()

const GIF_JOB: ExportJob = {
  kind: 'gif',
  play: fixture,
  settings,
  options: {
    orientation: 'square',
    lines: 'chained',
    speed: 'real',
    quality: 'standard',
    theme: 'printBw',
    optimizeUnchanged: true,
    light: true,
    layers: DEFAULT_LAYERS,
  },
}

const PDF_JOB: ExportJob = {
  kind: 'pdf',
  plays: bookPlays(),
  settings,
  options: { layout: 'print', color: 'bw' },
  book: { title: 'Cahier de jeu', subtitle: 'Sélection' },
}

describe('worker protocol', () => {
  it('accepts well-formed messages only', () => {
    expect(isToWorker({ type: 'start', jobId: 1, job: GIF_JOB })).toBe(true)
    expect(isToWorker({ type: 'start', jobId: 1, job: PDF_JOB })).toBe(true)
    expect(isToWorker({ type: 'cancel', jobId: 3 })).toBe(true)
    expect(isToWorker({ type: 'start', jobId: '1', job: GIF_JOB })).toBe(false)
    expect(isToWorker({ type: 'start', jobId: 1, job: { kind: 'video' } })).toBe(false)
    expect(isToWorker(null)).toBe(false)
    expect(isFromWorker({ type: 'progress', jobId: 1, stage: 'frames', done: 2, total: 9 })).toBe(
      true,
    )
    expect(isFromWorker({ type: 'progress', jobId: 1, stage: 'other', done: 2, total: 9 })).toBe(
      false,
    )
    expect(
      isFromWorker({
        type: 'done',
        jobId: 1,
        files: [{ fileName: 'a.gif', mime: 'image/gif', bytes: new ArrayBuffer(4) }],
      }),
    ).toBe(true)
    expect(isFromWorker({ type: 'done', jobId: 1, files: [{ fileName: 'a.gif' }] })).toBe(false)
    expect(isFromWorker({ type: 'cancelled', jobId: 1 })).toBe(true)
    expect(isFromWorker({ type: 'error', jobId: 1, message: 'x' })).toBe(true)
    expect(isFromWorker({ type: 'error', jobId: 1 })).toBe(false)
  })

  it('gives through the messages the same bytes as the export core, for a GIF and a PDF', async () => {
    for (const job of [GIF_JOB, PDF_JOB]) {
      const direct = runJobDirectly(job)
      const progress: ExportProgress[] = []
      const result = await createInlineEngine().run(job, (p) => progress.push(p))
      expect(result.kind).toBe('done')
      if (result.kind !== 'done') continue
      expect(result.files.map((f) => f.fileName)).toEqual(direct.files.map((f) => f.fileName))
      for (const [i, file] of result.files.entries()) {
        const expected = direct.files[i]?.bytes ?? new Uint8Array(0)
        expect(Buffer.compare(Buffer.from(file.bytes), Buffer.from(expected))).toBe(0)
      }
      expect(progress[0]).toEqual({ stage: 'fonts', done: 0, total: 1 })
      const last = progress[progress.length - 1]
      expect(last?.done).toBe(last?.total)
      // Throttled: fewer messages than steps for the GIF (at most one per 50 ms, plus the last).
      if (job.kind === 'gif') expect(progress.length).toBeLessThan(direct.progress.length)
    }
  })

  it('runs one job at a time', async () => {
    const engine = createInlineEngine()
    const first = engine.run(GIF_JOB, () => undefined)
    expect(await engine.run(GIF_JOB, () => undefined)).toMatchObject({ kind: 'error' })
    expect((await first).kind).toBe('done')
  })
})
