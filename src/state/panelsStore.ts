// Folded panels (library, « Combinaison » section of the inspector), remembered per computer with
// the other preferences (D-026, D-052).
import { create } from 'zustand'
import { loadPrefs, savePrefs } from './prefs'

export interface PanelsState {
  libraryCollapsed: boolean
  playSectionCollapsed: boolean
}

const prefs = loadPrefs()

export const usePanelsStore = create<PanelsState>(() => ({
  libraryCollapsed: prefs.libraryCollapsed,
  playSectionCollapsed: prefs.playSectionCollapsed,
}))

function setPanel(patch: Partial<PanelsState>): void {
  usePanelsStore.setState(patch)
  savePrefs({ ...loadPrefs(), ...patch })
}

export function setLibraryCollapsed(libraryCollapsed: boolean): void {
  setPanel({ libraryCollapsed })
}

export function setPlaySectionCollapsed(playSectionCollapsed: boolean): void {
  setPanel({ playSectionCollapsed })
}
