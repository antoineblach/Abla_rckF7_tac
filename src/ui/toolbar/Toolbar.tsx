import { TOOL_IDS } from '../../editor/tools/types'
import { redoEdit, setSnap, setTool, undoEdit, useEditorStore } from '../../state/editorStore'
import { useLibraryState } from '../../state/libraryState'
import { chooseFolder, saveNow } from '../../state/session'
import { TEXT, TOOL_LABELS } from '../strings'

export function Toolbar() {
  const tool = useEditorStore((s) => s.tool)
  const snap = useEditorStore((s) => s.snap)
  const play = useEditorStore((s) => s.play)
  const dirty = useEditorStore((s) => s.dirty)
  const readOnly = useEditorStore((s) => s.readOnly)
  const canUndo = useEditorStore((s) => s.history.past.length > 0)
  const canRedo = useEditorStore((s) => s.history.future.length > 0)
  const status = useLibraryState((s) => s.status)
  const folderName = useLibraryState((s) => s.folderName)
  const folderSupported = useLibraryState((s) => s.folderSupported)

  return (
    <header className="toolbar">
      <h1 className="toolbar__title">{TEXT.appTitle}</h1>
      <div className="toolbar__group" role="toolbar" aria-label="Outils">
        {TOOL_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={tool === id ? 'tool tool--active' : 'tool'}
            aria-pressed={tool === id}
            disabled={!play}
            title={`${TOOL_LABELS[id].label} (${TOOL_LABELS[id].key})`}
            onClick={() => {
              setTool(id)
            }}
          >
            {TOOL_LABELS[id].label} <kbd>{TOOL_LABELS[id].key}</kbd>
          </button>
        ))}
        <button
          type="button"
          className={snap ? 'tool tool--active' : 'tool'}
          aria-pressed={snap}
          disabled={!play}
          title="Aimantation sur une grille de 1 m"
          onClick={() => {
            setSnap(!snap)
          }}
        >
          Grille 1 m
        </button>
      </div>
      <div className="toolbar__group">
        <button type="button" disabled={!canUndo} onClick={undoEdit} title="Annuler (Ctrl+Z)">
          Annuler
        </button>
        <button type="button" disabled={!canRedo} onClick={redoEdit} title="Rétablir (Ctrl+Y)">
          Rétablir
        </button>
        <button
          type="button"
          disabled={!play || readOnly}
          onClick={() => void saveNow()}
          title="Enregistrer (Ctrl+S)"
        >
          Enregistrer
        </button>
        <span className="toolbar__status" role="status" data-testid="save-status">
          {!play
            ? ''
            : readOnly
              ? 'Lecture seule'
              : dirty
                ? 'Modifications en cours'
                : 'Enregistré'}
        </span>
      </div>
      <div className="toolbar__group toolbar__storage">
        {status === 'folder' ? (
          <span title="Dossier synchronisé">Dossier : {folderName}</span>
        ) : null}
        {folderSupported ? (
          <button type="button" onClick={() => void chooseFolder()}>
            {status === 'folder' ? 'Changer de dossier' : TEXT.chooseFolder}
          </button>
        ) : null}
      </div>
    </header>
  )
}
