import { useEffect } from 'react'
import { handleKey } from '../../state/editorActions'
import { isTypingTarget } from './typing'

/** Shortcuts of SPEC 6.2; ignored while typing in a field, except Ctrl+S. */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ctrl = event.ctrlKey || event.metaKey
      const saving = ctrl && event.key.toLowerCase() === 's'
      if (isTypingTarget(event.target) && !saving) return
      if (isDialogOpen()) return
      const input = {
        key: event.key,
        code: event.code,
        ctrl,
        shift: event.shiftKey,
        alt: event.altKey,
      }
      if (handleKey(input)) {
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])
}

function isDialogOpen(): boolean {
  return document.querySelector('[role="dialog"]') !== null
}
