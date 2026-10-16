import { useId, useState } from 'react'
import { EXPORT_TEXT } from '../../export/text'
import type { PdfExportPrefs } from '../../model/settings'
import { PLAY_CATEGORIES, type Id, type PlayCategory } from '../../model/types'
import {
  bookCandidates,
  bookSubtitle,
  categoryIds,
  closeExportDialog,
  exportBook,
} from '../../state/exportSession'
import { useLibraryState } from '../../state/libraryState'
import { useSettingsStore } from '../../state/settingsStore'
import { Modal } from '../common/Modal'
import { CATEGORY_LABELS } from '../strings'
import { PdfOptionsFields } from './PdfExportDialog'

/** « Cahier de jeu » (SPEC 9.3, D-064): title, plays in the order of the library, quick choice. */
export function BookDialog() {
  const titleId = useId()
  const quickId = useId()
  const summaries = useLibraryState((s) => s.summaries)
  const sort = useLibraryState((s) => s.sort)
  const candidates = bookCandidates({ summaries, sort })
  const saved = useSettingsStore((s) => s.settings.export.pdf)
  const [prefs, setPrefs] = useState<PdfExportPrefs>(saved)
  const [title, setTitle] = useState<string>(EXPORT_TEXT.defaultBookTitle)
  const [quick, setQuick] = useState<PlayCategory | ''>('')
  const [selected, setSelected] = useState<ReadonlySet<Id>>(
    () => new Set(candidates.map((c) => c.id)),
  )
  const ids = candidates.filter((c) => selected.has(c.id)).map((c) => c.id)
  return (
    <Modal title="Cahier de jeu" onClose={closeExportDialog} testId="book-dialog">
      <div className="export-form">
        <div className="form-row">
          <label htmlFor={titleId}>Titre</label>
          <input
            id={titleId}
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
            }}
          />
        </div>
        <div className="form-row form-row--inline">
          <label htmlFor={quickId}>Choix rapide</label>
          <select
            id={quickId}
            value={quick}
            onChange={(e) => {
              const category = PLAY_CATEGORIES.find((c) => c === e.target.value)
              setQuick(category ?? '')
              if (!category) return
              setSelected(new Set(categoryIds(candidates, category)))
              setTitle(CATEGORY_LABELS[category])
            }}
          >
            <option value="">Une catégorie…</option>
            {PLAY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="book__plays">
          <legend>Combinaisons ({ids.length})</legend>
          {candidates.map((c) => (
            <label key={c.id} className="checkbox">
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={(e) => {
                  const next = new Set(selected)
                  if (e.target.checked) next.add(c.id)
                  else next.delete(c.id)
                  setSelected(next)
                }}
              />
              {c.name} <span className="book__category">{CATEGORY_LABELS[c.category]}</span>
            </label>
          ))}
        </fieldset>
        <PdfOptionsFields prefs={prefs} onChange={setPrefs} />
      </div>
      <div className="modal__actions">
        <button
          type="button"
          className="button--primary"
          disabled={ids.length === 0}
          onClick={() =>
            void exportBook({ title, ids, subtitle: bookSubtitle(candidates, selected) }, prefs)
          }
        >
          Exporter le cahier
        </button>
        <button type="button" onClick={closeExportDialog}>
          Annuler
        </button>
      </div>
    </Modal>
  )
}
