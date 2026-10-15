// Per-computer preferences in localStorage, prefixed « abla-rck7: », not synchronised
// (DECISIONS Q26 / D-026). Storage may be unavailable: every access is guarded.
import { DEFAULT_LAYERS, type Layers } from '../render/layers'
import type { Orientation } from '../render/viewport'
import type { PlaybackSpeed } from '../player/transport'

const PREFS_KEY = 'abla-rck7:prefs'

export interface Prefs {
  layers: Layers
  speed: PlaybackSpeed
  loop: boolean
  pauseBetweenPhases: boolean
  stopAtOptions: boolean
  orientation: Orientation
  libraryCollapsed: boolean
  playSectionCollapsed: boolean
  snap: boolean
}

export const DEFAULT_PREFS: Prefs = {
  layers: DEFAULT_LAYERS,
  speed: 1,
  loop: false,
  pauseBetweenPhases: false,
  stopAtOptions: true,
  orientation: 'landscape',
  libraryCollapsed: false,
  playSectionCollapsed: false,
  snap: false,
}

export function loadPrefs(): Prefs {
  try {
    const raw = globalThis.localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return { ...DEFAULT_PREFS, ...parsed, layers: { ...DEFAULT_PREFS.layers, ...parsed.layers } }
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    globalThis.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Private window or storage disabled: preferences simply are not remembered.
  }
}
