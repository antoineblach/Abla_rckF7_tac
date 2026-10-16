import { useEffect, useMemo, useRef } from 'react'
import { createCaches } from '../../engine/caches'
import { presetThumbnail } from '../../editor/presets'
import type { LibraryIssue, PresetEntry } from '../../io/LibraryStore'
import { PRESET_TYPE_LABELS } from '../../model/labels'
import { rootPhase } from '../../model/phaseTree'
import type { PlacementPreset } from '../../model/preset'
import { engineSettingsOf } from '../../model/settings'
import { renderSchematic } from '../../render/renderSchematic'
import { THEMES } from '../../render/themes'
import { createViewport } from '../../render/viewport'
import { useEditorStore } from '../../state/editorStore'
import { pushDialog, sortedPresets, useLibraryState } from '../../state/libraryState'
import {
  duplicatePreset,
  openUpdatePresetDialog,
  resolvePresetDuplicate,
  startApplyPreset,
} from '../../state/presetSession'
import { useSettingsStore } from '../../state/settingsStore'
import { readErrorMessage } from '../strings'

const THUMB_W = 128
const THUMB_H = 72
const thumbCaches = createCaches()

/** Thumbnail: the preset laid on a default field (SPEC 10.1). */
function PresetThumbnail({ preset }: { preset: PlacementPreset }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const settings = useSettingsStore((s) => s.settings)
  const thumbnail = useMemo(() => presetThumbnail(preset), [preset])
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    const root = rootPhase(thumbnail.play)
    if (!ctx || !root) return
    const viewport = createViewport({
      widthPx: THUMB_W * dpr,
      heightPx: THUMB_H * dpr,
      pixelRatio: dpr * 0.45,
      frame: thumbnail.frame,
      orientation: 'landscape',
      attackingTeam: thumbnail.play.attackingTeam,
    })
    renderSchematic(
      ctx,
      thumbnail.play,
      [root.id],
      root.id,
      viewport,
      THEMES.screen,
      engineSettingsOf(settings),
      thumbCaches,
    )
  }, [thumbnail, settings, dpr])
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

function PresetIssueItem({ issue }: { issue: LibraryIssue }) {
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
      Copie de conflit : {issue.fileNames.length} fichiers portent le même modèle.
      <div className="library__issue-actions">
        <button
          type="button"
          onClick={() => void resolvePresetDuplicate(issue.id, { kind: 'keepBoth' })}
        >
          Garder les deux
        </button>
        {issue.fileNames.map((fileName) => (
          <button
            key={fileName}
            type="button"
            title={fileName}
            onClick={() => void resolvePresetDuplicate(issue.id, { kind: 'choose', fileName })}
          >
            Choisir celui-ci : {fileName}
          </button>
        ))}
      </div>
    </li>
  )
}

function PresetItem({
  entry,
  hasPlay,
  canApply,
}: {
  entry: PresetEntry
  hasPlay: boolean
  canApply: boolean
}) {
  const { preset, readOnly } = entry
  return (
    <li className="library__item" aria-label={`Modèle ${preset.name}`}>
      <div className="library__open">
        <PresetThumbnail preset={preset} />
        <span className="library__name">{preset.name}</span>
        <span className="library__meta">
          {PRESET_TYPE_LABELS[preset.type]} · {preset.positions.length} joueuse
          {preset.positions.length > 1 ? 's' : ''}
          {readOnly ? ' · lecture seule' : ''}
        </span>
      </div>
      <div className="library__item-actions library__item-actions--wrap">
        <button
          type="button"
          className="button--primary"
          disabled={!canApply}
          onClick={() => void startApplyPreset(entry)}
        >
          Appliquer
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => {
            pushDialog({ kind: 'renamePreset', entry })
          }}
        >
          Renommer
        </button>
        <button type="button" disabled={readOnly} onClick={() => void duplicatePreset(entry)}>
          Dupliquer
        </button>
        <button
          type="button"
          disabled={readOnly || !hasPlay}
          title="Refaire l’enregistrement depuis le placement de départ courant"
          onClick={() => void openUpdatePresetDialog(entry)}
        >
          Mettre à jour
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => {
            pushDialog({ kind: 'confirmDeletePreset', entry })
          }}
        >
          Supprimer
        </button>
      </div>
    </li>
  )
}

/** « Modèles » tab of the library (SPEC 10.1, D-096). */
export function PresetPanel() {
  const presets = useLibraryState((s) => s.presets)
  const issues = useLibraryState((s) => s.presetIssues)
  const status = useLibraryState((s) => s.status)
  const hasPlay = useEditorStore((s) => s.play !== null)
  const readOnlyPlay = useEditorStore((s) => s.readOnly)
  const sorted = sortedPresets(presets)
  return (
    <>
      <div className="library__actions">
        <button
          type="button"
          className="button--primary"
          disabled={!hasPlay}
          title="Depuis le placement de départ de la combinaison ouverte"
          onClick={() => {
            pushDialog({ kind: 'savePreset', update: null })
          }}
        >
          Enregistrer un modèle…
        </button>
      </div>
      {issues.length > 0 ? (
        <ul className="library__issues" aria-label="Modèles à vérifier">
          {issues.map((issue) => (
            <PresetIssueItem
              key={issue.kind === 'invalid' ? issue.fileName : issue.id}
              issue={issue}
            />
          ))}
        </ul>
      ) : null}
      <ul className="library__list" aria-label="Modèles de placement">
        {sorted.map((entry) => (
          <PresetItem
            key={`${entry.preset.id}:${entry.fileName ?? ''}`}
            entry={entry}
            hasPlay={hasPlay}
            canApply={hasPlay && !readOnlyPlay}
          />
        ))}
        {sorted.length === 0 && status !== 'starting' ? (
          <li className="library__empty">Aucun modèle de placement.</li>
        ) : null}
      </ul>
    </>
  )
}
