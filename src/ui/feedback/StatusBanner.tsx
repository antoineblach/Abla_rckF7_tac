import { dismissToast, useLibraryState } from '../../state/libraryState'
import { chooseFolder, reauthorizeFolder } from '../../state/session'
import { TEXT } from '../strings'

/** Permanent banners of the degraded mode and of the folder permission (SPEC 8.2, 8.6, D-021). */
export function StatusBanner() {
  const status = useLibraryState((s) => s.status)
  const folderSupported = useLibraryState((s) => s.folderSupported)
  const folderName = useLibraryState((s) => s.folderName)
  if (status === 'needsPermission') {
    return (
      <div className="banner banner--warning" role="alert">
        {TEXT.needsPermission} {folderName ? `(${folderName})` : ''}
        <button type="button" onClick={() => void reauthorizeFolder()}>
          {TEXT.reauthorize}
        </button>
      </div>
    )
  }
  if (status !== 'browser') return null
  if (!folderSupported) {
    return (
      <div className="banner" role="status" data-testid="degraded-banner">
        {TEXT.degradedFirefox}
      </div>
    )
  }
  return (
    <div className="banner" role="status" data-testid="degraded-banner">
      {TEXT.noFolderChrome}
      <button type="button" onClick={() => void chooseFolder()}>
        {TEXT.chooseFolder}
      </button>
    </div>
  )
}

export function Toasts() {
  const toasts = useLibraryState((s) => s.toasts)
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.kind}`} role="status">
          <span>{toast.message}</span>
          <button
            type="button"
            aria-label="Fermer la notification"
            onClick={() => {
              dismissToast(toast.id)
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
