import { deletePhase } from '../../editor/commands'
import { applyEdit, selectPhase, useEditorStore } from '../../state/editorStore'
import { closeDialog, useLibraryState, type LibraryDialog } from '../../state/libraryState'
import {
  confirmDelete,
  copyBrowserPlays,
  createPlay,
  resolveConflict,
  resolveDraft,
  resolveImport,
  resolveRemoved,
} from '../../state/session'
import { Modal } from '../common/Modal'

const date = (iso: string) => (iso ? new Date(iso).toLocaleString('fr-FR') : 'inconnue')

function DialogView({ dialog }: { dialog: LibraryDialog }) {
  const close = () => {
    closeDialog(dialog)
  }
  switch (dialog.kind) {
    case 'newPlay':
      return (
        <Modal title="Nouvelle combinaison" onClose={close}>
          <p>Placement de départ :</p>
          <div className="modal__actions">
            <button
              type="button"
              className="button--primary"
              onClick={() => {
                close()
                void createPlay('sevenVsSeven')
              }}
            >
              7 contre 7 en ligne
            </button>
            <button
              type="button"
              onClick={() => {
                close()
                void createPlay('teamA')
              }}
            >
              Équipe A seule en ligne
            </button>
            <button type="button" onClick={close}>
              Annuler
            </button>
          </div>
        </Modal>
      )
    case 'confirmDelete':
      return (
        <Modal title="Supprimer la combinaison" onClose={close}>
          <p>Déplacer « {dialog.name} » dans la corbeille ? Rien n’est effacé définitivement.</p>
          <div className="modal__actions">
            <button
              type="button"
              className="button--danger"
              onClick={() => {
                close()
                void confirmDelete(dialog.id)
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
    case 'confirmDeletePhase':
      return (
        <Modal title="Supprimer le temps" onClose={close}>
          <p>
            Supprimer « {dialog.label} »
            {dialog.descendants > 0 ? ` et ses ${dialog.descendants} temps suivants` : ''} ? Ctrl+Z
            annule.
          </p>
          <div className="modal__actions">
            <button
              type="button"
              className="button--danger"
              onClick={() => {
                close()
                const play = useEditorStore.getState().play
                const parentId = play?.phases.find((p) => p.id === dialog.phaseId)?.parentId ?? null
                applyEdit((p) => deletePhase(p, dialog.phaseId))
                if (parentId) selectPhase(parentId)
              }}
            >
              Supprimer
            </button>
            <button type="button" onClick={close}>
              Annuler
            </button>
          </div>
        </Modal>
      )
    case 'conflict':
      return (
        <Modal title="Version plus récente dans le dossier">
          <p>
            La combinaison a été modifiée sur l’autre ordinateur (version du{' '}
            {date(dialog.stored.updatedAt)}) pendant vos modifications non enregistrées.
          </p>
          <div className="modal__actions">
            <button type="button" onClick={() => void resolveConflict(dialog, 'folder')}>
              Garder la version du dossier
            </button>
            <button type="button" onClick={() => void resolveConflict(dialog, 'mine')}>
              Garder la mienne
            </button>
            <button
              type="button"
              className="button--primary"
              onClick={() => void resolveConflict(dialog, 'both')}
            >
              Garder les deux
            </button>
          </div>
        </Modal>
      )
    case 'removedExternally':
      return (
        <Modal title="Combinaison retirée du dossier">
          <p>
            Le fichier de cette combinaison a disparu ou est devenu illisible depuis l’autre
            ordinateur.
          </p>
          <div className="modal__actions">
            <button
              type="button"
              className="button--primary"
              onClick={() => void resolveRemoved(dialog, true)}
            >
              Garder ma version
            </button>
            <button type="button" onClick={() => void resolveRemoved(dialog, false)}>
              Fermer
            </button>
          </div>
        </Modal>
      )
    case 'draft':
      return (
        <Modal title="Brouillon retrouvé">
          <p>Des modifications non enregistrées de « {dialog.draft.name} » ont été retrouvées.</p>
          <div className="modal__actions">
            <button
              type="button"
              className="button--primary"
              onClick={() => void resolveDraft(dialog, true)}
            >
              Restaurer le brouillon
            </button>
            <button type="button" onClick={() => void resolveDraft(dialog, false)}>
              Ignorer
            </button>
          </div>
        </Modal>
      )
    case 'import':
      return (
        <Modal title="Combinaison déjà présente">
          <p>
            « {dialog.candidate.play.name} » est déjà dans la bibliothèque. Version de la
            bibliothèque : {date(dialog.existingUpdatedAt)}. Version importée :{' '}
            {date(dialog.candidate.play.updatedAt)}.
          </p>
          <div className="modal__actions">
            <button type="button" onClick={() => void resolveImport(dialog, 'replace')}>
              Remplacer
            </button>
            <button
              type="button"
              className="button--primary"
              onClick={() => void resolveImport(dialog, 'keepBoth')}
            >
              Garder les deux
            </button>
            <button type="button" onClick={() => void resolveImport(dialog, null)}>
              Ignorer
            </button>
          </div>
        </Modal>
      )
    case 'copyBrowserPlays':
      return (
        <Modal title="Combinaisons du navigateur">
          <p>
            {dialog.count} combinaison{dialog.count > 1 ? 's' : ''} enregistrée
            {dialog.count > 1 ? 's' : ''} dans ce navigateur. Les copier dans le dossier choisi ?
          </p>
          <div className="modal__actions">
            <button
              type="button"
              className="button--primary"
              onClick={() => void copyBrowserPlays(dialog, true)}
            >
              Copier dans le dossier
            </button>
            <button type="button" onClick={() => void copyBrowserPlays(dialog, false)}>
              Ne pas copier
            </button>
          </div>
        </Modal>
      )
  }
}

export function Dialogs() {
  const dialogs = useLibraryState((s) => s.dialogs)
  const top = dialogs[0]
  return top ? <DialogView dialog={top} /> : null
}
