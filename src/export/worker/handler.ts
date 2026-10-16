// Message handler of the export worker, independent of the worker global scope so that tests run
// it in Node (the « inline » engine). A job runs step by step: between two steps the handler gives
// the hand back (`yieldNow`) and checks for a cancellation; a cancelled job posts `cancelled` and
// drops its buffers. Progress: at most one message per EXPORT_PROGRESS_INTERVAL_MS, plus the last.
import { EXPORT_PROGRESS_INTERVAL_MS } from '../../config/defaults'
import { createCaches } from '../../engine/caches'
import type { ExportJob } from '../jobs'
import { jobSteps, type ExportResources } from '../jobSteps'
import type { ExportFile } from '../types'
import { isToWorker, type FromWorker, type ToWorker, type TransferredFile } from './protocol'

/** What the handler needs from where it runs. */
export interface WorkerEnvironment {
  /** Drawing surfaces and fonts for a job (fonts loaded once, then reused). */
  resources(job: ExportJob): Promise<ExportResources>
  /** Gives the hand back to the event loop (a message can arrive). */
  yieldNow(): Promise<void>
  /** Milliseconds, only to space progress messages. */
  now(): number
}

export type PostFromWorker = (message: FromWorker, transfer: ArrayBuffer[]) => void

/** Bytes of a file as a whole buffer, ready to be transferred. */
function transferable(file: ExportFile): TransferredFile {
  const { bytes } = file
  const whole =
    bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : bytes.slice()
  return { fileName: file.fileName, mime: file.mime, bytes: whole.buffer as ArrayBuffer }
}

export function createExportHandler(
  env: WorkerEnvironment,
  post: PostFromWorker,
): (message: unknown) => void {
  const cancelled = new Set<number>()

  async function run(jobId: number, job: ExportJob): Promise<void> {
    try {
      post({ type: 'progress', jobId, stage: 'fonts', done: 0, total: 1 }, [])
      const resources = await env.resources(job)
      const steps = jobSteps(job, resources, createCaches())
      let last = Number.NEGATIVE_INFINITY
      for (;;) {
        await env.yieldNow()
        if (cancelled.has(jobId)) {
          cancelled.delete(jobId)
          post({ type: 'cancelled', jobId }, [])
          return
        }
        const step = steps.next()
        if (step.done === true) {
          const files = step.value.map(transferable)
          post(
            { type: 'done', jobId, files },
            files.map((f) => f.bytes),
          )
          return
        }
        const now = env.now()
        if (now - last >= EXPORT_PROGRESS_INTERVAL_MS || step.value.done === step.value.total) {
          last = now
          post({ type: 'progress', jobId, ...step.value }, [])
        }
      }
    } catch (error) {
      cancelled.delete(jobId)
      post(
        { type: 'error', jobId, message: error instanceof Error ? error.message : String(error) },
        [],
      )
    }
  }

  return (message: unknown) => {
    if (!isToWorker(message)) return
    const typed: ToWorker = message
    if (typed.type === 'cancel') cancelled.add(typed.jobId)
    else void run(typed.jobId, typed.job)
  }
}
