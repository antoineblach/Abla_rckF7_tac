// Conflict decisions (SPEC 8.4, DECISIONS Q22 / D-022). Pure functions.
import type { Id, Play } from '../model/types'

export const COPY_SUFFIX = ' (copie)'

/**
 * « Garder les deux »: a copy with a new id and « (copie) » appended to the name; a play or a
 * placement preset (D-092).
 */
export function keepBothCopy<
  T extends { id: Id; name: string; createdAt: string; updatedAt: string },
>(item: T, newId: Id, now: Date): T {
  const stamp = now.toISOString()
  return {
    ...structuredClone(item),
    id: newId,
    name: `${item.name}${COPY_SUFFIX}`,
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
