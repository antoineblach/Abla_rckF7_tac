// Displayed area of the field (SPEC 7, D-048, D-049): one view (centre and scale) for editing
// and playback. Resizing the canvas never changes it; only the voluntary actions do (wheel, pan,
// choice of the saved view, orientation, opening a play, « Ajuster », « Zone utile »).
import { create } from 'zustand'
import type { Bounds } from '../engine/bounds'
import { compileLine } from '../engine/timeline'
import type { Id, Play } from '../model/types'
import { autoFrame } from '../player/framing'
import { fitView, frameForView, type Orientation, type ViewTransform } from '../render/viewport'
import { appCaches, currentEngineSettings } from './settingsStore'

export interface CanvasSize {
  /** CSS pixels. */
  width: number
  height: number
}

export interface ViewState {
  /** Current view; null: to fit on the saved view of the play at the next drawing. */
  view: ViewTransform | null
  /** Size of the field canvas, kept to fit a frame on demand. */
  canvasSize: CanvasSize | null
  /** Area actually visible, kept for « Enregistrer la vue actuelle comme cadre ». */
  visible: Bounds | null
}

export const useViewStore = create<ViewState>(() => ({
  view: null,
  canvasSize: null,
  visible: null,
}))

/** « Ajuster »: the saved view of the play; « Zone utile »: the line being played (SPEC 7). */
export type FitTarget = 'saved' | 'useful'

export function savedFrame(play: Play): Bounds {
  return frameForView(play.field.view, play.field, play.attackingTeam)
}

/** Frame of a fit target: the useful area is the bounding box of the line, plus a margin. */
export function frameFor(play: Play, target: FitTarget, line: readonly Id[]): Bounds {
  if (target === 'useful') {
    const compiled = compileLine(play, line, currentEngineSettings(), appCaches)
    return autoFrame(compiled) ?? savedFrame(play)
  }
  return savedFrame(play)
}

export function setView(view: ViewTransform): void {
  useViewStore.setState({ view })
}

/** Back to the saved view at the next drawing (opening a play, orientation). */
export function resetView(): void {
  useViewStore.setState({ view: null })
}

/** The canvas changed size: the view (scale and centre) is kept as it is (D-048). */
export function setCanvasSize(canvasSize: CanvasSize): void {
  const current = useViewStore.getState().canvasSize
  if (current?.width === canvasSize.width && current.height === canvasSize.height) return
  useViewStore.setState({ canvasSize })
}

/** Fits the view on a target, in the current canvas (or at the next drawing if unknown). */
export function adjustView(
  play: Play,
  target: FitTarget,
  orientation: Orientation,
  line: readonly Id[],
): void {
  const size = useViewStore.getState().canvasSize
  if (!size || size.width <= 0 || size.height <= 0) {
    resetView()
    return
  }
  const frame = frameFor(play, target, line)
  setView(fitView(frame, size.width, size.height, orientation, play.attackingTeam))
}

export function setVisibleArea(visible: Bounds): void {
  useViewStore.setState({ visible })
}
