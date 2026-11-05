// Pass tool (SPEC 6.2): click on the passer, then on the receiver.
import type { Id } from '../../model/types'
import type { Hit } from '../hitTest'

export interface PassToolResult {
  fromId: Id | null
  commit: { fromId: Id; toId: Id } | null
}

export function passToolClick(fromId: Id | null, hit: Hit): PassToolResult {
  if (hit?.kind !== 'player') return { fromId: null, commit: null }
  if (fromId === null) return { fromId: hit.id, commit: null }
  if (hit.id === fromId) return { fromId: null, commit: null }
  return { fromId: null, commit: { fromId, toId: hit.id } }
}
