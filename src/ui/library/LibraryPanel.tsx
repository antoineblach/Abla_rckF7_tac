import { useEffect, useRef, useState } from 'react'
import { createCaches } from '../../engine/caches'
import type { LibraryIssue, PlaySummary } from '../../io/LibraryStore'
import { rootPhase } from '../../model/phaseTree'
import { engineSettingsOf } from '../../model/settings'
import { PLAY_CATEGORIES, type Play, type PlayCategory } from '../../model/types'
import { renderSchematic } from '../../render/renderSchematic'
import { THEMES } from '../../render/themes'
import { createViewport, frameForView } from '../../render/viewport'
import { useEditorStore } from '../../state/editorStore'
import { pushDialog, useLibraryState, visibleSummaries } from '../../state/libraryState'
import { setLibraryCollapsed, usePanelsStore } from '../../state/panelsStore'
import {
  currentStore,
  duplicateInLibrary,
  exportLibrary,
  exportPlay,
  importFiles,
  openFromLibrary,
  resolveDuplicate,
} from '../../state/session'
import { useSettingsStore } from '../../state/settingsStore'
import { CATEGORY_LABELS, readErrorMessage } from '../strings'

const THUMB_W = 128
const THUMB_H = 72
const thumbCaches = createCaches()

/** Thumbnail: schematic of the first phase (SPEC 8.7). */
function Thumbnail({ summary }: { summary: PlaySummary }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const settings = useSettingsStore((s) => s.settings)
  useEffect(() => {
    let cancelled = false
    const store = currentStore()
    if (!store) return
    void store.get(summary.id).then((play: Play) => {
      const canvas = ref.current
      const ctx = canvas?.getContext('2d')
      const root = rootPhase(play)
      if (cancelled || !ctx || !root) return
      const dpr = window.devicePixelRatio || 1
      const viewport = createViewport({
        widthPx: THUMB_W * dpr,
        heightPx: THUMB_H * dpr,
        pixelRatio: dpr * 0.45,
        frame: frameForView(play.field.view, play.field, play.attackingTeam),
        orientation: 'landscape',
        attackingTeam: play.attackingTeam,
      })
      renderSchematic(
        ctx,
        play,
        [root.id],
        root.id,
        viewport,
        THEMES.screen,
        engineSettingsOf(settings),
        thumbCaches,
      )
    })
    return () => {
      cancelled = true
    }
  }, [summary.id, summary.updatedAt, settings])
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  return (
    <canvas
      ref={ref}
      className="library__thumb"
      width={THUMB_W * dpr}
      height={THUMB_H * dpr}
      style={{ width: THUMB_W, height: THUMB_H }}
      aria-hidden="true"
    />
  )
}

function IssueItem({ issue }: { issue: LibraryIssue }) {
  if (issue.kind === 'invalid') {
    return (
      <li className="library__issue">
        <strong>{issue.fileName}</strong> : {readErrorMessage(issue.error)} Le fichier n’est ni
        modifié ni déplacé.
      </li>
    )
  }
  return (
    <li className="library__issue">
      Copie de conflit : {issue.fileNames.length} fichiers portent la même combinaison.
      <div className="library__issue-actions">
        <button type="button" onClick={() => void resolveDuplicate(issue.id, { kind: 'keepBoth' })}>
          Garder les deux
        </button>
        {issue.fileNames.map((fileName) => (
          <button
            key={fileName}
            type="button"
            title={fileName}
            onClick={() => void resolveDuplicate(issue.id, { kind: 'choose', fileName })}
          >
            Choisir celle-ci : {fileName}
          </button>
        ))}
      </div>
    </li>
  )
}

export function LibraryPanel() {
  const state = useLibraryState()
  const collapsed = usePanelsStore((s) => s.libraryCollapsed)
  const openId = useEditorStore((s) => s.play?.id ?? null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const summaries = visibleSummaries(state)

  if (collapsed) {
    return (
      <aside className="library library--collapsed" aria-label="Bibliothèque">
        <button
          type="button"
          aria-label="Déplier la bibliothèque"
          onClick={() => {
            setLibraryCollapsed(false)
          }}
        >
          »
        </button>
      </aside>
    )
  }

  return (
    <aside className="library" aria-label="Bibliothèque">
      <div className="library__header">
        <h2>Bibliothèque</h2>
        <button
          type="button"
          aria-label="Replier la bibliothèque"
          onClick={() => {
            setLibraryCollapsed(true)
          }}
        >
          «
        </button>
      </div>
      <div className="library__actions">
        <button
          type="button"
          className="button--primary"
          disabled={state.status === 'starting' || state.status === 'needsPermission'}
          onClick={() => {
            pushDialog({ kind: 'newPlay' })
          }}
        >
          Nouvelle combinaison
        </button>
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
          Importer
        </button>
        <button type="button" onClick={() => void exportLibrary()}>
          Exporter tout
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          multiple
          hidden
          data-testid="import-input"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            setBusy(true)
            void importFiles(files).finally(() => {
              setBusy(false)
            })
          }}
        />
      </div>
      <div className="library__filters">
        <input
          type="search"
          placeholder="Rechercher par nom"
          aria-label="Rechercher par nom"
          value={state.search}
          onChange={(e) => {
            useLibraryState.setState({ search: e.target.value })
          }}
        />
        <select
          aria-label="Filtrer par catégorie"
          value={state.category}
          onChange={(e) => {
            useLibraryState.setState({ category: e.target.value as PlayCategory | 'all' })
          }}
        >
          <option value="all">Toutes les catégories</option>
          {PLAY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          aria-label="Trier"
          value={state.sort}
          onChange={(e) => {
            useLibraryState.setState({ sort: e.target.value === 'name' ? 'name' : 'date' })
          }}
        >
          <option value="date">Plus récentes</option>
          <option value="name">Par nom</option>
        </select>
      </div>
      {state.issues.length > 0 ? (
        <ul className="library__issues" aria-label="Fichiers à vérifier">
          {state.issues.map((issue) => (
            <IssueItem key={issue.kind === 'invalid' ? issue.fileName : issue.id} issue={issue} />
          ))}
        </ul>
      ) : null}
      <ul className="library__list">
        {summaries.map((summary) => (
          <li
            key={`${summary.id}:${summary.fileName ?? ''}`}
            className={
              summary.id === openId ? 'library__item library__item--open' : 'library__item'
            }
          >
            <button
              type="button"
              className="library__open"
              onClick={() => void openFromLibrary(summary.id, summary.fileName)}
              aria-label={`Ouvrir ${summary.name}`}
            >
              <Thumbnail summary={summary} />
              <span className="library__name">{summary.name}</span>
              <span className="library__meta">
                {CATEGORY_LABELS[summary.category]} ·{' '}
                {new Date(summary.updatedAt).toLocaleString('fr-FR')}
                {summary.readOnly ? ' · lecture seule' : ''}
              </span>
            </button>
            <div className="library__item-actions">
              <button
                type="button"
                onClick={() => void duplicateInLibrary(summary.id)}
                disabled={summary.readOnly}
              >
                Dupliquer
              </button>
              <button
                type="button"
                onClick={() => void exportPlay(summary.id)}
                disabled={summary.readOnly}
              >
                Exporter
              </button>
              <button
                type="button"
                disabled={summary.readOnly}
                onClick={() => {
                  pushDialog({ kind: 'confirmDelete', id: summary.id, name: summary.name })
                }}
              >
                Supprimer
              </button>
            </div>
          </li>
        ))}
        {summaries.length === 0 && state.status !== 'starting' ? (
          <li className="library__empty">Aucune combinaison.</li>
        ) : null}
      </ul>
    </aside>
  )
}
