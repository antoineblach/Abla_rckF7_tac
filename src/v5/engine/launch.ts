// Runs ending at speed (SPEC 5.2, D-139): the rule reads in the model, without flag. A run ends at
// speed if and only if the next run of the player in the line is glued to its end, without gap. A
// run of the trunk prolonged by part of the options ends at speed in every line (D-139 Q1). Pure.
import { pathToBranch } from '../model/branches'
import type { Issue } from '../model/issues'
import { branchLabelOf } from '../model/labels'
import type { GlueAnalysis } from '../model/syncGraph'
import type { Id, Play } from '../model/types'
import type { RunMotion } from './motion'

const NO_GAP = 1e-9

/**
 * By run, the run it may prolong: the same player, its left edge glued to the end of that run,
 * without gap. An edge left out by the analysis (invalid, cycle) prolongs nothing.
 */
export function prolongedRuns(play: Play, analysis: GlueAnalysis): Map<Id, Id> {
  const result = new Map<Id, Id>()
  for (const edge of analysis.order) {
    if (edge.kind !== 'start' || edge.glue.event !== 'end') continue
    if ((edge.glue.offset ?? 0) > NO_GAP) continue
    const next = play.actions.find((action) => action.id === edge.ownerId)
    const previous = play.actions.find((action) => action.id === edge.glue.targetId)
    if (next?.type !== 'run' || previous?.type !== 'run') continue
    if (next.entityId === previous.entityId) result.set(next.id, previous.id)
  }
  return result
}

/**
 * A run at speed not prolonged in this line stops short at its end, with a warning naming the first
 * option of the line away from the runs that prolong it (D-139 Q1). `prolongedBy` gives them.
 */
export function notContinuedIssues(
  play: Play,
  line: readonly Id[],
  motions: readonly RunMotion[],
  prolongedBy: ReadonlyMap<Id, readonly Id[]>,
): Issue[] {
  const issues: Issue[] = []
  for (const motion of motions) {
    if (motion.source !== 'run' || !motion.endsAtSpeed || motion.until !== null) continue
    const followers = prolongedBy.get(motion.actionId) ?? []
    if (motions.some((m) => m.launch !== null && followers.includes(m.actionId))) continue
    const onTheirPaths = new Set<Id>()
    for (const id of followers) {
      const branchId = play.actions.find((action) => action.id === id)?.branchId
      if (branchId !== undefined) for (const b of pathToBranch(play, branchId)) onTheirPaths.add(b)
    }
    const below = line.slice(line.indexOf(motion.branchId) + 1)
    const option = below.find((id) => !onTheirPaths.has(id))
    if (option === undefined) continue
    issues.push({
      code: 'runNotContinued',
      severity: 'warning',
      target: { kind: 'action', id: motion.actionId, branchId: motion.branchId },
      params: { option: branchLabelOf(play, option) },
      key: option,
    })
  }
  return issues
}
