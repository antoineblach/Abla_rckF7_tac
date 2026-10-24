import { cancelSyncPick } from '../../state/editorActions'
import { useEditorStore } from '../../state/editorStore'
import { syncPickPrompt } from '../../state/selectors'
import { TEXT } from '../strings'

/** Banner of « Caler sur… », over the field (D-050, D-109): what to click, Escape to cancel. */
export function SyncBanner() {
  const pick = useEditorStore((s) => s.syncPick)
  const play = useEditorStore((s) => s.play)
  if (!pick || !play) return null
  return (
    <div className="banner placement-banner" role="status" data-testid="sync-banner">
      <span>{TEXT.syncPick(syncPickPrompt(play, pick))}</span>
      <span className="placement-banner__hint">{TEXT.placementEscape}</span>
      <button type="button" onClick={cancelSyncPick}>
        Annuler
      </button>
    </div>
  )
}
