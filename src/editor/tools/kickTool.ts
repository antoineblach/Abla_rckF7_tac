// Kick tool (SPEC 10.4, D-093): click on the kicker, then on a receiver or on a point of the
// field; clicking the kicker again cancels.
import type { Id, KickTarget, Vec2 } from '../../model/types'
import type { Hit } from '../hitTest'

export interface KickToolResult {
  kickerId: Id | null
  commit: { kickerId: Id; target: KickTarget } | null
}

export function kickToolClick(kickerId: Id | null, hit: Hit, pos: Vec2): KickToolResult {
  if (kickerId === null) {
    return hit?.kind === 'player'
      ? { kickerId: hit.id, commit: null }
      : { kickerId: null, commit: null }
  }
  if (hit?.kind === 'player') {
    if (hit.id === kickerId) return { kickerId: null, commit: null }
    return { kickerId: null, commit: { kickerId, target: { receiverId: hit.id } } }
  }
  return { kickerId: null, commit: { kickerId, target: { point: { x: pos.x, y: pos.y } } } }
}
