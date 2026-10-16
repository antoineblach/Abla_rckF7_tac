import { useState } from 'react'
import type { GifExportPrefs } from '../../model/settings'
import { useEditorStore } from '../../state/editorStore'
import { closeExportDialog, exportGif, gifFileNames, hasOptions } from '../../state/exportSession'
import { useSettingsStore } from '../../state/settingsStore'
import { CheckboxField, SelectField } from '../common/fields'
import { Modal } from '../common/Modal'

/** « Exporter GIF » (SPEC 9.2): orientation, options, speed, quality, theme, optimisation. */
export function GifExportDialog() {
  const play = useEditorStore((s) => s.play)
  const saved = useSettingsStore((s) => s.settings.export.gif)
  const [prefs, setPrefs] = useState<GifExportPrefs>(saved)
  if (!play) return null
  const set = (patch: Partial<GifExportPrefs>) => {
    setPrefs({ ...prefs, ...patch })
  }
  const options = hasOptions(play)
  const names = gifFileNames(play, prefs)
  return (
    <Modal title="Exporter en GIF" onClose={closeExportDialog} testId="gif-export-dialog">
      <div className="export-form">
        <SelectField
          label="Orientation"
          value={prefs.orientation}
          options={[
            { value: 'portrait', label: 'Portrait (attaque vers le haut)' },
            { value: 'landscape', label: 'Paysage (attaque vers la droite)' },
            { value: 'square', label: 'Carré' },
          ]}
          onChange={(orientation) => {
            set({ orientation })
          }}
        />
        <SelectField
          label="Options"
          value={prefs.lines}
          disabled={!options}
          options={[
            { value: 'chained', label: 'Un GIF enchaîné' },
            { value: 'perLeaf', label: 'Un GIF par option' },
          ]}
          onChange={(lines) => {
            set({ lines })
          }}
        />
        <SelectField
          label="Vitesse"
          value={prefs.speed}
          options={[
            { value: 'both', label: 'Ralenti puis vitesse réelle' },
            { value: 'slow', label: 'Ralenti seul' },
            { value: 'real', label: 'Vitesse réelle seule' },
          ]}
          onChange={(speed) => {
            set({ speed })
          }}
        />
        <SelectField
          label="Qualité"
          value={prefs.quality}
          options={[
            { value: 'standard', label: 'Standard' },
            { value: 'high', label: 'Haute qualité' },
          ]}
          onChange={(quality) => {
            set({ quality })
          }}
        />
        <SelectField
          label="Thème"
          value={prefs.theme}
          options={[
            { value: 'highContrast', label: 'Contraste fort' },
            { value: 'screen', label: 'Écran' },
            { value: 'printBw', label: 'Impression N&B' },
          ]}
          onChange={(theme) => {
            set({ theme })
          }}
        />
        <CheckboxField
          label="Alléger le fichier (pixels inchangés transparents)"
          checked={prefs.optimizeUnchanged}
          onChange={(optimizeUnchanged) => {
            set({ optimizeUnchanged })
          }}
        />
        <p className="export-form__files" data-testid="export-file-names">
          {names.length > 1 ? `${names.length} fichiers : ` : 'Fichier : '}
          {names.join(', ')}
        </p>
      </div>
      <div className="modal__actions">
        <button type="button" className="button--primary" onClick={() => void exportGif(prefs)}>
          Exporter
        </button>
        <button type="button" onClick={closeExportDialog}>
          Annuler
        </button>
      </div>
    </Modal>
  )
}
