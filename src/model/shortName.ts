// Short name of a file (SPEC 4.4, DECISIONS Q23 / D-023): shared by plays and exports.
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
