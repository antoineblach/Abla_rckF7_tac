import { placementPreview } from '../../editor/placementMode'
import type { OpenSideChoice } from '../../editor/presets'
import { useInteractionStore } from '../../state/editorActions'
import { setPlacement, setPlacementOpenSide, useEditorStore } from '../../state/editorStore'
import { OPEN_SIDE_LABELS, TEXT } from '../strings'

const OPEN_SIDES: readonly OpenSideChoice[] = ['auto', 'left', 'right']

/**
 * Banner of a placement, over the field (D-050, D-088, D-096): what to click, the open side
 * (never for a lineout), a refused anchor, Escape to cancel.
 */
export function PlacementBanner() {
  const placement = useEditorStore((s) => s.placement)
  const play = useEditorStore((s) => s.play)
  const cursor = useInteractionStore((s) => s.cursor)
  if (!placement || !play) return null
  const refused = placementPreview(placement, play, cursor).refused
  let message: string
  let type: string | null = null
  if (placement.kind === 'movePlay') {
    message = placement.from ? TEXT.placementMoveEnd : TEXT.placementMoveStart
  } else if (placement.kind === 'applyPreset') {
    message = TEXT.placementApply(placement.preset.name)
    type = placement.preset.type
  } else {
    message = `${TEXT.placementSave(placement.request.name)} ${TEXT.placementAxes}`
    type = placement.request.type
  }
  const openSide = placement.kind === 'movePlay' ? null : placement.openSide
  return (
    <div className="banner placement-banner" role="status" data-testid="placement-banner">
      {refused ? (
        // In place of the instruction: the banner stays on one line over the field.
        <strong className="placement-banner__refused">{TEXT.placementRefused}</strong>
      ) : (
        <span>{message}</span>
      )}
      {openSide !== null && type !== 'lineout' ? (
        <span className="placement-banner__sides" role="group" aria-label="Côté ouvert">
          Côté ouvert :
          {OPEN_SIDES.map((side) => (
            <button
              key={side}
              type="button"
              className={side === openSide ? 'tool tool--active' : 'tool'}
              aria-pressed={side === openSide}
              onClick={() => {
                setPlacementOpenSide(side)
              }}
            >
              {OPEN_SIDE_LABELS[side]}
            </button>
          ))}
        </span>
      ) : null}
      <span className="placement-banner__hint">{TEXT.placementEscape}</span>
      <button
        type="button"
        onClick={() => {
          setPlacement(null)
        }}
      >
        Annuler
      </button>
    </div>
  )
}
