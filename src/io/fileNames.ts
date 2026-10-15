// File names (SPEC 4.4, 8.5, DECISIONS Q23).
import type { Play } from '../model/types'

export const PLAYS_DIR = 'combinaisons'
export const TRASH_DIR = '_corbeille'
export const SETTINGS_FILE = 'reglages.json'
export const PLAY_EXTENSION = '.combi.json'
export const PACK_EXTENSION = '.combipack.json'
export const SHORT_NAME_MAX = 40
export const EMPTY_SHORT_NAME = 'sans-nom'

const LIGATURES: Record<string, string> = { œ: 'oe', æ: 'ae', ß: 'ss' }

/** Lower case, no accents, every other character replaced by '-', at most 40 characters. */
export function shortName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[œæß]/g, (c) => LIGATURES[c] ?? c)
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SHORT_NAME_MAX)
    .replace(/-+$/g, '')
  return base === '' ? EMPTY_SHORT_NAME : base
}

export function playFileName(play: Pick<Play, 'name' | 'id'>): string {
  return `${shortName(play.name)}--${play.id}${PLAY_EXTENSION}`
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
