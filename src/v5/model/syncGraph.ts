// Glues between edges (SPEC 4.3, 5.8). Pure; shared by the validation, the engine and the commands.
import { findBranch, isBranchPoint, pathToBranch } from './branches'
import type { GlueRef, Id, Play } from './types'

/** Why a glue cannot apply. */
export type GlueProblem =
  /** No action, sequence or branch with this id (« cible supprimée »). */
  | 'missing'
  /** The glue targets its own block. */
  | 'self'
  /** The target is neither in the branch of the edge nor in one of its ancestors. */
  | 'line'
  /** The event does not exist for this target. */
  | 'event'
  /** The waypoint of the target run does not exist. */
  | 'point'

/**
 * Problem of a glue, or null when usable. `ownerId` is the block of the edge (action, sequence or
 * branch), `edgeBranchId` the branch that holds the edge: its `branchId`, or the branch itself for
 * a branch point.
 */
export function glueProblem(
  play: Play,
  ownerId: Id,
  edgeBranchId: Id,
  glue: GlueRef,
): GlueProblem | null {
  if (glue.targetId === ownerId) return 'self'
  const line = pathToBranch(play, edgeBranchId)
  const action = play.actions.find((candidate) => candidate.id === glue.targetId)
  const block = action ?? play.sequences.find((candidate) => candidate.id === glue.targetId)
  if (block) {
    if (!line.includes(block.branchId)) return 'line'
    if (typeof glue.event === 'string') return null
    if (action?.type !== 'run') return 'event'
    return glue.event.point < action.waypoints.length ? null : 'point'
  }
  const branch = findBranch(play, glue.targetId)
  if (!branch) return 'missing'
  if (!line.includes(branch.id)) return 'line'
  return glue.event === 'end' && isBranchPoint(play, branch.id) ? null : 'event'
}
