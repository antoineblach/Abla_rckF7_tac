// File names (SPEC 4.4, 8.5, 9.1, DECISIONS Q23).
import type { PlacementPreset } from '../model/preset'
import { shortName } from '../model/shortName'
import type { Play } from '../model/types'

export { EMPTY_SHORT_NAME, SHORT_NAME_MAX, shortName } from '../model/shortName'

export const PLAYS_DIR = 'combinaisons'
export const PRESETS_DIR = 'modeles'
export const TRASH_DIR = '_corbeille'
export const EXPORTS_DIR = 'exports'
export const SETTINGS_FILE = 'reglages.json'
export const PLAY_EXTENSION = '.combi.json'
export const PRESET_EXTENSION = '.preset.json'
export const PACK_EXTENSION = '.combipack.json'

export function playFileName(play: Pick<Play, 'name' | 'id'>): string {
  return `${shortName(play.name)}--${play.id}${PLAY_EXTENSION}`
}

/** Placement preset (SPEC 4.4): modeles/<nom-court>--<id>.preset.json. */
export function presetFileName(preset: Pick<PlacementPreset, 'name' | 'id'>): string {
  return `${shortName(preset.name)}--${preset.id}${PRESET_EXTENSION}`
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** Trash name with a timestamp first (local time), so that the trash sorts by date. */
export function trashFileName(original: string, date: Date): string {
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(
    date.getHours(),
  )}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  return `${stamp}--${original}`
}

/** Files read by the folder scan: every *.json (Drive conflict copies included), nothing else. */
export function isScannedPlayFile(name: string): boolean {
  return name.toLowerCase().endsWith('.json')
}
