// Displayed area of the field (SPEC 7, D-019): free zoom and pan in edit mode, starting from
// the saved view; automatic framing or saved view during playback.
import { create } from 'zustand'
import type { Bounds } from '../engine/bounds'
import { compileLine } from '../engine/timeline'
import type { Play } from '../model/types'
import { autoFrame } from '../player/framing'
import { frameForView } from '../render/viewport'
import type { PlayerState } from './playerStore'
import { appCaches, currentEngineSettings } from './settingsStore'

export interface ViewState {
  /** Frame chosen by zoom and pan in edit mode; null: the saved view of the play. */
  editFrame: Bounds | null
  /** Area actually visible, kept for « Enregistrer la vue actuelle comme cadre ». */
  visible: Bounds | null
}

export const useViewStore = create<ViewState>(() => ({ editFrame: null, visible: null }))

export function savedFrame(play: Play): Bounds {
  return frameForView(play.field.view, play.field, play.attackingTeam)
}

/** Frame to display, depending on the mode and the framing choice. */
export function displayFrame(
  play: Play,
  player: Pick<PlayerState, 'mode' | 'framing' | 'transport'>,
  editFrame: Bounds | null,
): Bounds {
  if (player.mode === 'play') {
    if (player.framing === 'auto') {
      const compiled = compileLine(play, player.transport.line, currentEngineSettings(), appCaches)
      return autoFrame(compiled) ?? savedFrame(play)
    }
    return savedFrame(play)
  }
  return editFrame ?? savedFrame(play)
}

export function setEditFrame(frame: Bounds | null): void {
  useViewStore.setState({ editFrame: frame })
}

export function setVisibleArea(visible: Bounds): void {
  useViewStore.setState({ visible })
}
