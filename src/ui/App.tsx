import { useEffect, useRef } from 'react'
import { setNotice, useEditorStore } from '../state/editorStore'
import { startSession } from '../state/session'
import { Dialogs } from './dialogs/Dialogs'
import { ExportWindows } from './export/ExportProgress'
import { StatusBanner, Toasts } from './feedback/StatusBanner'
import { FieldCanvas } from './field/FieldCanvas'
import { PlacementBanner } from './field/PlacementBanner'
import { SyncBanner } from './field/SyncBanner'
import { useAnimationLoop } from './hooks/useAnimationLoop'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useSpaceKey } from './hooks/useSpaceKey'
import { Inspector } from './inspector/Inspector'
import { LibraryPanel } from './library/LibraryPanel'
import { ActionList } from './phases/ActionList'
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
 * inspector on the right, playback controls under the field, and at the bottom a band of fixed
 * height shared by the phase tree (2/5) and the actions of the phase (3/5, D-113). Every bar has a
 * fixed size; banners, notices and option buttons float over the field (D-048, D-050). */
export function App() {
  const stageRef = useRef<HTMLElement>(null)
  useKeyboardShortcuts()
  useSpaceKey()
  useAnimationLoop()
  useEffect(() => {
    void startSession()
  }, [])
  return (
    <div className="app">
      <Toolbar />
      <main className="app__main">
        <LibraryPanel />
        <section className="stage" ref={stageRef} aria-label="Terrain">
          <div className="stage__field">
            <FieldCanvas />
            <div className="stage__overlay stage__overlay--top">
              <StatusBanner />
              <PlacementBanner />
              <SyncBanner />
              <EditorNotice />
            </div>
            <div className="stage__overlay stage__overlay--bottom">
              <OptionChooser />
            </div>
          </div>
          <TransportBar stageRef={stageRef} />
        </section>
        <Inspector />
      </main>
      <div className="bottom-band">
        <PhaseTree />
        <ActionList />
      </div>
      <Dialogs />
      <ExportWindows />
      <Toasts />
    </div>
  )
}
