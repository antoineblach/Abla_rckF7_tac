// The export engine seen from the page (plan of lot 2, section 3): one worker, created on the first
// export and reused. One job at a time. « Annuler » posts `cancel`; without an answer within
// EXPORT_CANCEL_TIMEOUT_MS the worker is terminated and recreated for the next export. Once a
// cancellation is asked, a late result is dropped: a cancelled export never writes a file.
// Two implementations of the port: the browser worker, and the handler run inline in tests.
import { EXPORT_CANCEL_TIMEOUT_MS } from '../../config/defaults'
import type { ExportJob } from '../jobs'
import type { ExportFile, ExportProgress } from '../types'
import { isFromWorker, type ToWorker } from './protocol'

export type EngineResult =
  { kind: 'done'; files: ExportFile[] } | { kind: 'cancelled' } | { kind: 'error'; message: string }

export interface ExportEngine {
  run(job: ExportJob, onProgress: (progress: ExportProgress) => void): Promise<EngineResult>
  /** Asks the running job to stop; its result becomes « cancelled ». */
  cancel(): void
}

/** A message channel to a worker (or to the handler run inline). */
export interface WorkerPort {
  post(message: ToWorker): void
  onMessage: ((message: unknown) => void) | null
  onError: ((message: string) => void) | null
  terminate(): void
}

export interface EngineTimers {
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

interface RunningJob {
  jobId: number
  resolve: (result: EngineResult) => void
  onProgress: (progress: ExportProgress) => void
  cancelling: boolean
  timeout: unknown
}

export class ExportEngineClient implements ExportEngine {
  private port: WorkerPort | null = null
  private nextJobId = 1
  private current: RunningJob | null = null

  constructor(
    private readonly createPort: () => WorkerPort,
    private readonly timers: EngineTimers,
    private readonly cancelTimeoutMs: number = EXPORT_CANCEL_TIMEOUT_MS,
  ) {}

  run(job: ExportJob, onProgress: (progress: ExportProgress) => void): Promise<EngineResult> {
    if (this.current) {
      return Promise.resolve({ kind: 'error', message: 'An export is already running' })
    }
    const port = this.ensurePort()
    const jobId = this.nextJobId++
    return new Promise((resolve) => {
      this.current = { jobId, resolve, onProgress, cancelling: false, timeout: null }
      port.post({ type: 'start', jobId, job })
    })
  }

  cancel(): void {
    const current = this.current
    if (!current || current.cancelling) return
    current.cancelling = true
    this.port?.post({ type: 'cancel', jobId: current.jobId })
    current.timeout = this.timers.setTimeout(() => {
      // No answer: the worker is stopped, and recreated for the next export.
      this.dropPort()
      this.finish({ kind: 'cancelled' })
    }, this.cancelTimeoutMs)
  }

  private dropPort(): void {
    this.port?.terminate()
    this.port = null
  }

  private finish(result: EngineResult): void {
    const current = this.current
    if (!current) return
    if (current.timeout !== null) this.timers.clearTimeout(current.timeout)
    this.current = null
    current.resolve(current.cancelling ? { kind: 'cancelled' } : result)
  }

  private ensurePort(): WorkerPort {
    if (this.port) return this.port
    const port = this.createPort()
    port.onMessage = (message) => {
      this.receive(message)
    }
    port.onError = (message) => {
      if (this.port === port) this.dropPort()
      this.finish({ kind: 'error', message })
    }
    this.port = port
    return port
  }

  private receive(message: unknown): void {
    if (!isFromWorker(message)) return
    const current = this.current
    if (!current || message.jobId !== current.jobId) return
    switch (message.type) {
      case 'progress':
        if (!current.cancelling) {
          current.onProgress({ stage: message.stage, done: message.done, total: message.total })
        }
        return
      case 'done':
        this.finish({
          kind: 'done',
          files: message.files.map((f) => ({
            fileName: f.fileName,
            mime: f.mime,
            bytes: new Uint8Array(f.bytes),
          })),
        })
        return
      case 'cancelled':
        this.finish({ kind: 'cancelled' })
        return
      case 'error':
        this.finish({ kind: 'error', message: message.message })
        return
    }
  }
}

/** The engine of the application: the module worker built by Vite. */
export function createWorkerEngine(): ExportEngine {
  return new ExportEngineClient(
    () => {
      const worker = new Worker(new URL('./exportWorker.ts', import.meta.url), { type: 'module' })
      const port: WorkerPort = {
        post: (message) => {
          worker.postMessage(message)
        },
        onMessage: null,
        onError: null,
        terminate: () => {
          worker.terminate()
        },
      }
      worker.onmessage = (event: MessageEvent<unknown>) => {
        port.onMessage?.(event.data)
      }
      worker.onerror = (event) => {
        event.preventDefault()
        port.onError?.(event.message || 'Export worker error')
      }
      return port
    },
    {
      setTimeout: (callback, ms) => window.setTimeout(callback, ms),
      clearTimeout: (handle) => {
        window.clearTimeout(handle as number)
      },
    },
  )
}
