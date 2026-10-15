import { useEffect } from 'react'
import { handleKey } from '../../state/editorActions'

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/** Shortcuts of SPEC 6.2; ignored while typing in a field, except Ctrl+S. */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ctrl = event.ctrlKey || event.metaKey
      const saving = ctrl && event.key.toLowerCase() === 's'
      if (isTyping(event.target) && !saving) return
      if (isDialogOpen()) return
      if (handleKey({ key: event.key, ctrl, shift: event.shiftKey, alt: event.altKey })) {
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
