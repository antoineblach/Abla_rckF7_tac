// Settings of reglages.json (SPEC 4.4) and the engine caches shared by the application.
import { create } from 'zustand'
import { createCaches } from '../engine/caches'
import {
  defaultSettings,
  engineSettingsOf,
  type EngineSettings,
  type Settings,
} from '../model/settings'

export interface SettingsState {
  settings: Settings
  /** False when reglages.json is invalid: it is then never overwritten. */
  writable: boolean
}

export const useSettingsStore = create<SettingsState>(() => ({
  settings: defaultSettings(),
  writable: true,
}))

/** Engine caches of the application (indexed by content hashes, SPEC 3.3.1). */
export const appCaches = createCaches()

export function currentEngineSettings(): EngineSettings {
  return engineSettingsOf(useSettingsStore.getState().settings)
}
