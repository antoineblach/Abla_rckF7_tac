import { useEffect, useRef } from 'react'
import { setNotice, useEditorStore } from '../state/editorStore'
import { startSession } from '../state/session'
import { Dialogs } from './dialogs/Dialogs'
import { StatusBanner, Toasts } from './feedback/StatusBanner'
import { FieldCanvas } from './field/FieldCanvas'
import { useAnimationLoop } from './hooks/useAnimationLoop'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { Inspector } from './inspector/Inspector'
import { LibraryPanel } from './library/LibraryPanel'
import { PhaseTree } from './phases/PhaseTree'
import { OptionChooser, TransportBar } from './player/TransportBar'
import { NOTICES } from './strings'
import { Toolbar } from './toolbar/Toolbar'

function EditorNotice() {
  const notice = useEditorStore((s) => s.notice)
  if (!notice) return null
  return (
    <div className="notice" role="status">
      {NOTICES[notice]}
      <button
        type="button"
        aria-label="Fermer le message"
        onClick={() => {
          setNotice(null)
        }}
      >
        ×
      </button>
    </div>
  )
}

/** Screen layout (SPEC 6.1): toolbar on top, library on the left, field in the centre,
 * inspector on the right, phase tree and playback controls at the bottom. */
export function App() {
  const stageRef = useRef<HTMLElement>(null)
  useKeyboardShortcuts()
  useAnimationLoop()
  useEffect(() => {
    void startSession()
  }, [])
  return (
    <div className="app">
      <Toolbar />
      <StatusBanner />
      <main className="app__main">
        <LibraryPanel />
        <section className="stage" ref={stageRef} aria-label="Terrain">
          <EditorNotice />
          <FieldCanvas />
          <OptionChooser />
          <TransportBar stageRef={stageRef} />
        </section>
        <Inspector />
      </main>
      <PhaseTree />
      <Dialogs />
      <Toasts />
    </div>
  )
}
