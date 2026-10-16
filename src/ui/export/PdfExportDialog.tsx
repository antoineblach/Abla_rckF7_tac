import { useState } from 'react'
import type { PdfExportPrefs } from '../../model/settings'
import { useEditorStore } from '../../state/editorStore'
import { closeExportDialog, exportPdf, pdfFileNames } from '../../state/exportSession'
import { useSettingsStore } from '../../state/settingsStore'
import { SelectField } from '../common/fields'
import { Modal } from '../common/Modal'

/** Layout and colour of a PDF (SPEC 9.3, D-062). */
export function PdfOptionsFields(props: {
  prefs: PdfExportPrefs
  onChange: (prefs: PdfExportPrefs) => void
}) {
  return (
    <>
      <SelectField
        label="Mise en page"
        value={props.prefs.layout}
        options={[
          { value: 'print', label: 'Impression (A4 paysage)' },
          { value: 'phone', label: 'Téléphone (lecture en défilant)' },
        ]}
        onChange={(layout) => {
          props.onChange({ ...props.prefs, layout })
        }}
      />
      <SelectField
        label="Couleurs"
        value={props.prefs.color}
        options={[
          { value: 'color', label: 'Couleur' },
          { value: 'bw', label: 'Noir et blanc' },
        ]}
        onChange={(color) => {
          props.onChange({ ...props.prefs, color })
        }}
      />
    </>
  )
}

/** « Exporter PDF » of the open play (SPEC 9.3). */
export function PdfExportDialog() {
  const play = useEditorStore((s) => s.play)
  const saved = useSettingsStore((s) => s.settings.export.pdf)
  const [prefs, setPrefs] = useState<PdfExportPrefs>(saved)
  if (!play) return null
  return (
    <Modal title="Exporter en PDF" onClose={closeExportDialog} testId="pdf-export-dialog">
      <div className="export-form">
        <PdfOptionsFields prefs={prefs} onChange={setPrefs} />
        <p className="export-form__files" data-testid="export-file-names">
          Fichier : {pdfFileNames(play, prefs).join(', ')}
        </p>
      </div>
      <div className="modal__actions">
        <button type="button" className="button--primary" onClick={() => void exportPdf(prefs)}>
          Exporter
        </button>
        <button type="button" onClick={closeExportDialog}>
          Annuler
        </button>
      </div>
    </Modal>
  )
}
