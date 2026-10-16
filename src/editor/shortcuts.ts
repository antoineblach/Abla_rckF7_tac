// Keyboard shortcuts (SPEC 6.2; lot 3: J and G, D-093). Pure mapping from a key event to an
// editor command.
import type { ToolId } from './tools/types'

export type ShortcutCommand =
  | { kind: 'tool'; tool: ToolId }
  | { kind: 'delete' }
  | { kind: 'duplicate' }
  | { kind: 'nudge'; dx: number; dy: number }
  | { kind: 'playPause' }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'save' }
  | { kind: 'finish' }
  | { kind: 'cancel' }
  | { kind: 'fit' }

export interface KeyInput {
  key: string
  ctrl: boolean
  shift: boolean
  alt: boolean
}

/** Screen-space nudge: the caller converts it to metres with the viewport orientation. */
export function shortcutFor(
  input: KeyInput,
  nudgeSmall: number,
  nudgeLarge: number,
): ShortcutCommand | null {
  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key
  if (input.alt) return null
  if (input.ctrl) {
    if (key === 'z' && !input.shift) return { kind: 'undo' }
    if (key === 'y' || (key === 'z' && input.shift)) return { kind: 'redo' }
    if (key === 's') return { kind: 'save' }
    if (key === 'd') return { kind: 'duplicate' }
    return null
  }
  const step = input.shift ? nudgeLarge : nudgeSmall
  switch (key) {
    case 'v':
      return { kind: 'tool', tool: 'select' }
    case 'a':
      return { kind: 'tool', tool: 'placeA' }
    case 'b':
      return { kind: 'tool', tool: 'placeB' }
    case 'r':
      return { kind: 'tool', tool: 'run' }
    case 'p':
      return { kind: 'tool', tool: 'pass' }
    case 'j':
      return { kind: 'tool', tool: 'kick' }
    case 'g':
      return { kind: 'tool', tool: 'breakdown' }
    case 'l':
      return { kind: 'playPause' }
    case 'f':
      return { kind: 'fit' }
    case 'Delete':
      return { kind: 'delete' }
    case 'Enter':
      return { kind: 'finish' }
    case 'Escape':
      return { kind: 'cancel' }
    case 'ArrowLeft':
      return { kind: 'nudge', dx: -step, dy: 0 }
    case 'ArrowRight':
      return { kind: 'nudge', dx: step, dy: 0 }
    case 'ArrowUp':
      return { kind: 'nudge', dx: 0, dy: -step }
    case 'ArrowDown':
      return { kind: 'nudge', dx: 0, dy: step }
    default:
      return null
  }
}
