// The « inline » export engine of the tests: the handler of the worker run in Node, behind the
// same client as in the browser. Messages are structured-cloned (and file bytes transferred) as
// between a page and a worker. Never imported by the application.
import { createCaches } from '../engine/caches'
import type { ExportJob } from '../export/jobs'
import { jobSteps } from '../export/jobSteps'
import type { ExportFile, ExportProgress } from '../export/types'
import { ExportEngineClient, type WorkerPort } from '../export/worker/engine'
import { createExportHandler } from '../export/worker/handler'
import { loadPdfFonts, napiSurface } from './exportFixtures'

const nextTurn = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve)
  })

export interface InlineEngineOptions {
  /** Called before each step of a job (to cancel in the middle, for example). */
  onStep?: () => void
  cancelTimeoutMs?: number
  /** The handler ignores every message: simulates a worker that never answers. */
  deaf?: boolean
}

export function createInlinePort(options: InlineEngineOptions = {}): WorkerPort & {
  terminated: boolean
} {
  const fonts = loadPdfFonts()
  const port: WorkerPort & { terminated: boolean } = {
    post: (message) => {
      const copy = structuredClone(message)
      void nextTurn().then(() => {
        if (!port.terminated && options.deaf !== true) handle(copy)
      })
    },
    onMessage: null,
    onError: null,
    terminate: () => {
      port.terminated = true
    },
    terminated: false,
  }
  const handle = createExportHandler(
    {
      resources: (job) =>
        Promise.resolve({
          createSurface: napiSurface,
          pdfFonts: job.kind === 'pdf' ? fonts : null,
        }),
      yieldNow: async () => {
        await nextTurn()
        options.onStep?.()
      },
      now: () => performance.now(),
    },
    (message, transfer) => {
      if (port.terminated) return
      const copy = structuredClone(message, { transfer })
      void nextTurn().then(() => port.onMessage?.(copy))
    },
  )
  return port
}

export function createInlineEngine(options: InlineEngineOptions = {}): ExportEngineClient {
  return new ExportEngineClient(
    () => createInlinePort(options),
    {
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => {
        clearTimeout(handle as ReturnType<typeof setTimeout>)
      },
    },
    options.cancelTimeoutMs,
  )
}

/** Runs a job directly (without messages), as the worker core does. */
export function runJobDirectly(job: ExportJob): {
  files: ExportFile[]
  progress: ExportProgress[]
} {
  const steps = jobSteps(
    job,
    { createSurface: napiSurface, pdfFonts: job.kind === 'pdf' ? loadPdfFonts() : null },
    createCaches(),
  )
  const progress: ExportProgress[] = []
  let step = steps.next()
  while (step.done !== true) {
    progress.push(step.value)
    step = steps.next()
  }
  return { files: step.value, progress }
}
