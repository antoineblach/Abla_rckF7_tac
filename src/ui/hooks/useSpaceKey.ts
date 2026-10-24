import { useEffect } from 'react'
import { spaceEvent } from '../../state/editorActions'
import { isTypingTarget } from './typing'

const isSpace = (event: KeyboardEvent) => event.key === ' ' || event.code === 'Space'

function isDialogOpen(): boolean {
  return document.querySelector('[role="dialog"]') !== null
}

/**
 * Space bar (SPEC 6.2, D-116): a short press plays or pauses, held with a drag pans the field.
 * The default action is prevented at the press and at the release, so that a focused button,
 * checkbox or summary is never activated (D-056). Ignored in text fields, lists, the time slider
 * and while a dialog is open.
 */
export function useSpaceKey(): void {
  useEffect(() => {
    const ignored = (event: KeyboardEvent) => isTypingTarget(event.target) || isDialogOpen()
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSpace(event) || ignored(event)) return
      event.preventDefault()
      spaceEvent({ kind: 'press', t: event.timeStamp, repeat: event.repeat })
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (!isSpace(event)) return
      if (ignored(event)) {
        spaceEvent({ kind: 'reset' })
        return
      }
      event.preventDefault()
      spaceEvent({ kind: 'release', t: event.timeStamp })
    }
    const onBlur = () => {
      spaceEvent({ kind: 'reset' })
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
}
