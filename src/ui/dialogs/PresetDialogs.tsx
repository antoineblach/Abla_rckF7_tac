import { useId, useState } from 'react'
import {
  defaultIncludeBall,
  defaultPresetType,
  wholePlacementIds,
} from '../../editor/placementMode'
import type { OpenSideChoice } from '../../editor/presets'
import { PRESET_TYPE_LABELS } from '../../model/labels'
import { PRESET_TYPES, type PresetType } from '../../model/preset'
import { useEditorStore } from '../../state/editorStore'
import { closeDialog, type LibraryDialog } from '../../state/libraryState'
import { removePreset, renamePreset, startSavePreset } from '../../state/presetSession'
import { CheckboxField, SelectField } from '../common/fields'
import { Modal } from '../common/Modal'
import { OPEN_SIDE_LABELS } from '../strings'

type SaveDialog = Extract<LibraryDialog, { kind: 'savePreset' }>

const OPEN_SIDES: readonly OpenSideChoice[] = ['auto', 'left', 'right']

/**
 * « Enregistrer un modèle… » and « Mettre à jour » (SPEC 10.1, D-089): name, type, content, ball
 * and open side, then the anchor is clicked on the field.
 */
function SavePresetDialog({ dialog }: { dialog: SaveDialog }) {
  const play = useEditorStore((s) => s.play)
  const selection = useEditorStore((s) => s.selection)
  const nameId = useId()
  const existing = dialog.update?.entry.preset ?? null
  const selected = play ? selection.players.filter((id) => play.setup.positions[id]) : []
  const [name, setName] = useState(existing?.name ?? '')
  const [type, setType] = useState<PresetType>(
    existing?.type ?? (play ? defaultPresetType(play.category) : 'free'),
  )
  const [whole, setWhole] = useState(selected.length === 0)
  const playerIds = play ? (whole ? wholePlacementIds(play) : selected) : []
  const [includeBall, setIncludeBall] = useState(
    play ? defaultIncludeBall(play, playerIds, whole) : false,
  )
  const [openSide, setOpenSide] = useState<OpenSideChoice>('auto')
  const close = () => {
    closeDialog(dialog)
  }
  if (!play) return null
  const hasBall = play.entities.some((e) => e.kind === 'ball')
  const chooseContent = (nextWhole: boolean) => {
    setWhole(nextWhole)
    const ids = nextWhole ? wholePlacementIds(play) : selected
    setIncludeBall(defaultIncludeBall(play, ids, nextWhole))
  }
  const ready = playerIds.length > 0 && name.trim() !== ''
  return (
    <Modal
      title={existing ? `Mettre à jour « ${existing.name} »` : 'Enregistrer un modèle'}
      onClose={close}
      testId="save-preset-dialog"
    >
      <div className="export-form">
        <div className="form-row">
          <label htmlFor={nameId}>Nom</label>
          <input
            id={nameId}
            type="text"
            value={name}
            disabled={existing !== null}
            onChange={(e) => {
              setName(e.target.value)
            }}
          />
        </div>
        <SelectField
          label="Type"
          value={type}
          disabled={existing !== null}
          options={PRESET_TYPES.map((t) => ({ value: t, label: PRESET_TYPE_LABELS[t] }))}
          onChange={setType}
        />
        <fieldset className="form-fieldset">
          <legend>Contenu</legend>
          <label className="checkbox">
            <input
              type="radio"
              name="preset-content"
              checked={whole}
              onChange={() => {
                chooseContent(true)
              }}
            />
            Placement de départ entier
          </label>
          <label className="checkbox">
            <input
              type="radio"
              name="preset-content"
              checked={!whole}
              disabled={selected.length === 0}
              onChange={() => {
                chooseContent(false)
              }}
            />
            Sélection ({selected.length} joueuse{selected.length > 1 ? 's' : ''})
          </label>
        </fieldset>
        <CheckboxField
          label="Inclure le ballon"
          checked={includeBall}
          disabled={!hasBall}
          onChange={setIncludeBall}
        />
        {type === 'lineout' ? (
          <p className="inspector__info">Côté ouvert : vers l’intérieur du terrain.</p>
        ) : (
          <SelectField
            label="Côté ouvert"
            value={openSide}
            options={OPEN_SIDES.map((s) => ({ value: s, label: OPEN_SIDE_LABELS[s] }))}
            onChange={setOpenSide}
          />
        )}
      </div>
      <div className="modal__actions">
        <button
          type="button"
          className="button--primary"
          disabled={!ready}
          onClick={() => {
            startSavePreset(dialog, {
              request: { name: name.trim(), type, playerIds, includeBall },
              openSide,
            })
          }}
        >
          Cliquer le point d’ancrage
        </button>
        <button type="button" onClick={close}>
          Annuler
        </button>
      </div>
    </Modal>
  )
}

function RenamePresetDialog({
  dialog,
}: {
  dialog: Extract<LibraryDialog, { kind: 'renamePreset' }>
}) {
  const [name, setName] = useState(dialog.entry.preset.name)
  const nameId = useId()
  const close = () => {
    closeDialog(dialog)
  }
  const submit = () => {
    close()
    void renamePreset(dialog.entry, name.trim())
  }
  return (
    <Modal title="Renommer le modèle" onClose={close}>
      <div className="form-row">
        <label htmlFor={nameId}>Nom</label>
        <input
          id={nameId}
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim() !== '') submit()
          }}
        />
      </div>
      <div className="modal__actions">
        <button
          type="button"
          className="button--primary"
          disabled={name.trim() === ''}
          onClick={submit}
        >
          Renommer
        </button>
        <button type="button" onClick={close}>
          Annuler
        </button>
      </div>
    </Modal>
  )
}

function ConfirmDeletePresetDialog({
  dialog,
}: {
  dialog: Extract<LibraryDialog, { kind: 'confirmDeletePreset' }>
}) {
  const close = () => {
    closeDialog(dialog)
  }
  return (
    <Modal title="Supprimer le modèle" onClose={close}>
      <p>
        Déplacer le modèle « {dialog.entry.preset.name} » dans la corbeille ? Rien n’est effacé
        définitivement.
      </p>
      <div className="modal__actions">
        <button
          type="button"
          className="button--danger"
          onClick={() => {
            close()
            void removePreset(dialog.entry)
          }}
        >
          Déplacer dans la corbeille
        </button>
        <button type="button" onClick={close}>
          Annuler
        </button>
      </div>
    </Modal>
  )
}

/** Dialogs of the placement presets (lot 3); null for the other dialogs. */
export function PresetDialogView({ dialog }: { dialog: LibraryDialog }) {
  switch (dialog.kind) {
    case 'savePreset':
      return <SavePresetDialog dialog={dialog} />
    case 'renamePreset':
      return <RenamePresetDialog dialog={dialog} />
    case 'confirmDeletePreset':
      return <ConfirmDeletePresetDialog dialog={dialog} />
    default:
      return null
  }
}
