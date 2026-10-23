// What the synchronisation controller sees of the editor (SPEC 8.3): the open play, the version it
// started from (D-097), the gestures in progress (D-099) and a new play waiting for its placement
// (D-101). Used by the session and its tests.
import type { OpenPlay } from '../io/sync'
import { useEditorStore } from './editorStore'

export function openPlayForSync(): OpenPlay | null {
  const s = useEditorStore.getState()
  return s.play
    ? {
        play: s.play,
        version: s.version,
        dirty: s.dirty,
        readOnly: s.readOnly,
        gesture: s.gestureStart !== null,
        awaitingPlacement: s.pendingCreation !== null,
      }
    : null
}

/** Calls `listener` each time a gesture ends: finished, cancelled, or dropped by a reload. */
export function onGestureEnd(listener: () => void): () => void {
  return useEditorStore.subscribe((state, previous) => {
    if (previous.gestureStart !== null && state.gestureStart === null) listener()
  })
}
