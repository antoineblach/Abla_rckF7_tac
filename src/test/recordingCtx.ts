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
  'bezierCurveTo',
  'clip',
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

/** A painting operation with the style in force and the path it paints. */
export interface PaintEvent {
  kind: 'fill' | 'stroke' | 'fillRect' | 'fillText'
  /** fillStyle for fills and texts, strokeStyle for strokes. */
  color: unknown
  lineWidth: number
  dash: number[]
  font: unknown
  /** Path calls since the last beginPath (fill and stroke). */
  path: RecordedCall[]
  args: unknown[]
}

interface PaintState {
  fillStyle: unknown
  strokeStyle: unknown
  lineWidth: number
  dash: number[]
  font: unknown
}

const PATH_CALLS = new Set(['moveTo', 'lineTo', 'bezierCurveTo', 'arc', 'rect', 'closePath'])

/** Replays a recording: every fill, stroke, rectangle and text with its style (save/restore aware). */
export function paintEvents(calls: readonly RecordedCall[]): PaintEvent[] {
  let state: PaintState = { fillStyle: null, strokeStyle: null, lineWidth: 1, dash: [], font: null }
  const stack: PaintState[] = []
  let path: RecordedCall[] = []
  const events: PaintEvent[] = []
  for (const call of calls) {
    if (call.kind === 'set') {
      if (call.name === 'fillStyle') state = { ...state, fillStyle: call.args[0] }
      if (call.name === 'strokeStyle') state = { ...state, strokeStyle: call.args[0] }
      if (call.name === 'lineWidth') state = { ...state, lineWidth: call.args[0] as number }
      if (call.name === 'font') state = { ...state, font: call.args[0] }
      continue
    }
    switch (call.name) {
      case 'save':
        stack.push(state)
        break
      case 'restore':
        state = stack.pop() ?? state
        break
      case 'setLineDash':
        state = { ...state, dash: [...(call.args[0] as number[])] }
        break
      case 'beginPath':
        path = []
        break
      case 'fill':
      case 'stroke':
      case 'fillRect':
      case 'fillText': {
        const stroke = call.name === 'stroke'
        events.push({
          kind: call.name,
          color: stroke ? state.strokeStyle : state.fillStyle,
          lineWidth: state.lineWidth,
          dash: state.dash,
          font: state.font,
          path: [...path],
          args: call.args,
        })
        break
      }
      default:
        if (PATH_CALLS.has(call.name)) path.push(call)
    }
  }
  return events
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
