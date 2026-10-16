import type { ExportProgress } from '../../export/types'
import { useExportStore, type ExportKind } from '../../state/exportStore'
import {
  answerExisting,
  cancelExport,
  closeOutcome,
  exportLightVersion,
} from '../../state/exportSession'
import { Modal } from '../common/Modal'
import { formatSize } from '../strings'
import { BookDialog } from './BookDialog'
import { GifExportDialog } from './GifExportDialog'
import { PdfExportDialog } from './PdfExportDialog'

const KIND_LABELS: Record<ExportKind, string> = {
  gif: 'GIF',
  pdf: 'PDF',
  book: 'cahier de jeu',
}

function stageText(progress: ExportProgress | null): string {
  if (!progress || progress.stage === 'fonts') return 'Préparation…'
  if (progress.stage === 'palette') return 'Calcul des couleurs…'
  const unit = progress.stage === 'frames' ? 'Images' : 'Pages'
  return `${unit} : ${progress.done} / ${progress.total}`
}

/** Encoding in the worker: progress bar and « Annuler »; « Enregistrement… » at the end. */
function Running() {
  const running = useExportStore((s) => s.running)
  if (!running) return null
  const { progress } = running
  const ratio = progress && progress.total > 0 ? progress.done / progress.total : 0
  return (
    <Modal title={`Export du ${KIND_LABELS[running.kind]}`} testId="export-progress">
      <progress
        className="export-progress__bar"
        max={1}
        value={ratio}
        aria-label="Progression de l’export"
      />
      <p role="status" data-testid="export-stage">
        {running.saving
          ? 'Enregistrement…'
          : running.cancelling
            ? 'Annulation…'
            : stageText(progress)}
      </p>
      <div className="modal__actions">
        <button
          type="button"
          disabled={running.saving || running.cancelling}
          onClick={cancelExport}
        >
          Annuler
        </button>
      </div>
    </Modal>
  )
}

/** Export already present (D-065): never overwritten without this answer. */
function Existing() {
  const existing = useExportStore((s) => s.existing)
  if (!existing) return null
  return (
    <Modal
      title="Export déjà présent"
      onClose={() => {
        answerExisting('cancel')
      }}
      testId="export-existing"
    >
      <p>
        {existing.length > 1 ? 'Ces fichiers existent' : 'Ce fichier existe'} déjà dans exports/ :
      </p>
      <ul className="export-files">
        {existing.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <p>« Remplacer » déplace d’abord l’ancien dans la corbeille.</p>
      <div className="modal__actions">
        <button
          type="button"
          onClick={() => {
            answerExisting('replace')
          }}
        >
          Remplacer
        </button>
        <button
          type="button"
          className="button--primary"
          onClick={() => {
            answerExisting('keepBoth')
          }}
        >
          Garder les deux
        </button>
        <button
          type="button"
          onClick={() => {
            answerExisting('cancel')
          }}
        >
          Annuler
        </button>
      </div>
    </Modal>
  )
}

/** Files written and their size (SPEC 9.2), with the lighter version of a heavy GIF. */
function Outcome() {
  const outcome = useExportStore((s) => s.outcome)
  if (!outcome) return null
  return (
    <Modal title="Export terminé" onClose={closeOutcome} testId="export-result">
      <p>
        {outcome.location === 'folder' ? 'Enregistré dans le dossier exports/ :' : 'Téléchargé :'}
      </p>
      <ul className="export-files">
        {outcome.files.map((file) => (
          <li key={file.fileName}>
            <span data-testid="export-file-name">{file.fileName}</span> :{' '}
            <span data-testid="export-file-size">{formatSize(file.size)}</span>
            {file.replaced ? ' (l’ancien est dans la corbeille)' : ''}
          </li>
        ))}
      </ul>
      {outcome.heavy ? (
        <p className="export-warning" role="alert">
          Plus de 8 Mo : WhatsApp risque de l’envoyer comme une vidéo à lancer, ou de le refuser.
          {outcome.canLighten ? ' Une version allégée est possible.' : ''}
        </p>
      ) : null}
      <div className="modal__actions">
        {outcome.canLighten ? (
          <button
            type="button"
            className="button--primary"
            onClick={() => void exportLightVersion()}
          >
            Exporter une version allégée
          </button>
        ) : null}
        <button type="button" onClick={closeOutcome}>
          Fermer
        </button>
      </div>
    </Modal>
  )
}

/** Every window of the exports: one at a time. */
export function ExportWindows() {
  const dialog = useExportStore((s) => s.dialog)
  const running = useExportStore((s) => s.running)
  const existing = useExportStore((s) => s.existing)
  if (existing) return <Existing />
  if (running) return <Running />
  if (dialog === 'gif') return <GifExportDialog />
  if (dialog === 'pdf') return <PdfExportDialog />
  if (dialog === 'book') return <BookDialog />
  return <Outcome />
}
