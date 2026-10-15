// Recording 2D context for tests: logs every method call and property write, and fails on any
// method the renderer must not use (gradients, patterns, images...). Never imported by the app.
import type { Ctx2D } from '../render/ctx2d'

export interface RecordedCall {
  kind: 'call' | 'set'
  name: string
  args: unknown[]
  /** lineWidth at the time of a stroke() call. */
  lineWidth?: number
}

const ALLOWED_METHODS = new Set([
  'save',
  'restore',
  'beginPath',
  'closePath',
  'moveTo',
  'lineTo',
  'arc',
  'rect',
  'fill',
  'stroke',
  'fillRect',
  'fillText',
  'measureText',
  'setLineDash',
  'translate',
  'rotate',
  'scale',
])

export interface RecordingContext {
  ctx: Ctx2D
  calls: RecordedCall[]
  /** Property names written at least once. */
  writtenProperties: Set<string>
}

const round = (value: unknown): unknown =>
  typeof value === 'number' ? Math.round(value * 1000) / 1000 : value

export function createRecordingContext(): RecordingContext {
  const calls: RecordedCall[] = []
  const writtenProperties = new Set<string>()
  const state: Record<string, unknown> = { lineWidth: 1 }
  const target: Record<string, unknown> = {}
  const proxy = new Proxy(target, {
    get(_t, name) {
      if (typeof name !== 'string') return undefined
      if (ALLOWED_METHODS.has(name)) {
        return (...args: unknown[]) => {
          const call: RecordedCall = { kind: 'call', name, args: args.map(round) }
          if (name === 'stroke') call.lineWidth = state.lineWidth as number
          calls.push(call)
          if (name === 'measureText') {
            const text = typeof args[0] === 'string' ? args[0] : ''
            return { width: text.length * 7 }
          }
          return undefined
        }
      }
      if (name in state) return state[name]
      throw new Error(`Forbidden or unknown context member: ${name}`)
    },
    set(_t, name, value) {
      if (typeof name !== 'string') return false
      writtenProperties.add(name)
      state[name] = value
      calls.push({ kind: 'set', name, args: [round(value)] })
      return true
    },
  })
  return { ctx: proxy as unknown as Ctx2D, calls, writtenProperties }
}
