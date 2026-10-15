// Conflict decisions (SPEC 8.4, DECISIONS Q22 / D-022). Pure functions.
import type { Id, Play } from '../model/types'

export const COPY_SUFFIX = ' (copie)'

/** « Garder les deux »: a copy with a new id and « (copie) » appended to the name. */
export function keepBothCopy(play: Play, newId: Id, now: Date): Play {
  const stamp = now.toISOString()
  return {
    ...structuredClone(play),
    id: newId,
    name: `${play.name}${COPY_SUFFIX}`,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

export type ExternalChangeDecision = 'ignore' | 'reload' | 'ask'

/**
 * What to do when the stored version of the open play changed:
 * same content, nothing; no local change in progress, silent reload; otherwise, ask.
 */
export function decideExternalChange(
  open: { play: Play; dirty: boolean },
  stored: Play,
): ExternalChangeDecision {
  if (stored.updatedAt === open.play.updatedAt) return 'ignore'
  return open.dirty ? 'ask' : 'reload'
}
