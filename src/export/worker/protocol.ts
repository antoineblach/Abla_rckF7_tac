// Messages between the page and the export worker (plan of lot 2, section 3). The bytes of the
// produced files are transferred, not copied.
import type { ExportJob } from '../jobs'
import type { ExportProgress } from '../types'

export type ToWorker =
  { type: 'start'; jobId: number; job: ExportJob } | { type: 'cancel'; jobId: number }

export interface TransferredFile {
  fileName: string
  mime: string
  bytes: ArrayBuffer
}

export type FromWorker =
  | ({ type: 'progress'; jobId: number } & ExportProgress)
  | { type: 'done'; jobId: number; files: TransferredFile[] }
  | { type: 'cancelled'; jobId: number }
  | { type: 'error'; jobId: number; message: string }

const STAGES = new Set(['fonts', 'palette', 'frames', 'pages'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJob(value: unknown): value is ExportJob {
  if (!isRecord(value) || !isRecord(value.settings) || !isRecord(value.options)) return false
  if (value.kind === 'gif') return isRecord(value.play)
  return (
    value.kind === 'pdf' &&
    Array.isArray(value.plays) &&
    (value.book === null || isRecord(value.book))
  )
}

export function isToWorker(value: unknown): value is ToWorker {
  if (!isRecord(value) || typeof value.jobId !== 'number') return false
  if (value.type === 'cancel') return true
  return value.type === 'start' && isJob(value.job)
}

function isTransferredFile(value: unknown): value is TransferredFile {
  return (
    isRecord(value) &&
    typeof value.fileName === 'string' &&
    typeof value.mime === 'string' &&
    value.bytes instanceof ArrayBuffer
  )
}

export function isFromWorker(value: unknown): value is FromWorker {
  if (!isRecord(value) || typeof value.jobId !== 'number') return false
  switch (value.type) {
    case 'progress':
      return (
        typeof value.stage === 'string' &&
        STAGES.has(value.stage) &&
        typeof value.done === 'number' &&
        typeof value.total === 'number'
      )
    case 'done':
      return Array.isArray(value.files) && value.files.every(isTransferredFile)
    case 'cancelled':
      return true
    case 'error':
      return typeof value.message === 'string'
    default:
      return false
  }
}
