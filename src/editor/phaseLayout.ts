// Layout of the phase tree (SPEC 6.4): horizontal trunk; options stacked below their branch point.
import { childrenOf, rootPhase } from '../model/phaseTree'
import type { Id, Play } from '../model/types'

export interface PhaseNodeLayout {
  id: Id
  parentId: Id | null
  /** Column = depth - 1. */
  column: number
  row: number
}

export interface PhaseTreeLayout {
  nodes: PhaseNodeLayout[]
  columns: number
  rows: number
}

export function layoutPhaseTree(play: Play): PhaseTreeLayout {
  const nodes: PhaseNodeLayout[] = []
  const seen = new Set<Id>()
  let rows = 0
  const place = (id: Id, parentId: Id | null, column: number, row: number): void => {
    if (seen.has(id)) return
    seen.add(id)
    nodes.push({ id, parentId, column, row })
    rows = Math.max(rows, row + 1)
    childrenOf(play, id).forEach((child, index) => {
      // The first child continues the row; the other options start below everything placed so far.
      place(child.id, id, column + 1, index === 0 ? row : rows)
    })
  }
  const root = rootPhase(play)
  if (root) place(root.id, null, 0, 0)
  const columns = nodes.reduce((max, n) => Math.max(max, n.column + 1), 0)
  return { nodes, columns, rows }
}
