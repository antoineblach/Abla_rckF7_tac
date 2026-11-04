// Branch tree helpers (SPEC 4.1, 5.1). Every function tolerates invalid trees (missing parents,
// cycles): it never loops and never throws. A line is a path from the root to a leaf.
import type { Branch, Id, Play } from './types'

/** Children of a branch (or roots for null), in creation order (array order). */
export function childrenOf(play: Play, parentId: Id | null): Branch[] {
  return play.branches.filter((branch) => branch.parentId === parentId)
}

export function findBranch(play: Play, branchId: Id): Branch | undefined {
  return play.branches.find((branch) => branch.id === branchId)
}

/** The root branch: the first branch without parent. */
export function rootBranch(play: Play): Branch | undefined {
  return play.branches.find((branch) => branch.parentId === null)
}

/** Ids from the root to the branch, both included; empty if the branch is unknown or unreachable. */
export function pathToBranch(play: Play, branchId: Id): Id[] {
  const path: Id[] = []
  const seen = new Set<Id>()
  let current = findBranch(play, branchId)
  while (current) {
    if (seen.has(current.id)) return []
    seen.add(current.id)
    path.push(current.id)
    if (current.parentId === null) return path.reverse()
    current = findBranch(play, current.parentId)
  }
  return []
}

/** The child followed by default: the only child, or the sibling marked isDefault. */
export function defaultChild(play: Play, branchId: Id): Branch | undefined {
  const children = childrenOf(play, branchId)
  if (children.length <= 1) return children[0]
  return children.find((child) => child.isDefault) ?? children[0]
}

/** A branch that divides into options (at least two children). */
export function isBranchPoint(play: Play, branchId: Id): boolean {
  return childrenOf(play, branchId).length >= 2
}

/** Branches that divide, in array order. */
export function branchPoints(play: Play): Id[] {
  return play.branches.filter((branch) => isBranchPoint(play, branch.id)).map((branch) => branch.id)
}

/** Extends a path (root to some branch) with default children down to a leaf. */
export function extendWithDefaults(play: Play, path: readonly Id[]): Id[] {
  const result = [...path]
  const seen = new Set(result)
  let last = result[result.length - 1]
  while (last !== undefined) {
    const next = defaultChild(play, last)
    if (!next || seen.has(next.id)) break
    result.push(next.id)
    seen.add(next.id)
    last = next.id
  }
  return result
}

/** The default line through a branch: root to branch, then default children to a leaf. */
export function defaultLineThrough(play: Play, branchId: Id): Id[] {
  const path = pathToBranch(play, branchId)
  return path.length === 0 ? [] : extendWithDefaults(play, path)
}

/** The default line of the play (from the root). */
export function defaultLine(play: Play): Id[] {
  const root = rootBranch(play)
  return root ? extendWithDefaults(play, [root.id]) : []
}

/** All lines: every path from the root to a leaf (SPEC 5.1), depth first, in creation order. */
export function allLines(play: Play): Id[][] {
  const root = rootBranch(play)
  if (!root) return []
  const lines: Id[][] = []
  const walk = (path: Id[]): void => {
    const last = path[path.length - 1]
    if (last === undefined) return
    const children = childrenOf(play, last).filter((child) => !path.includes(child.id))
    if (children.length === 0) {
      lines.push(path)
      return
    }
    for (const child of children) walk([...path, child.id])
  }
  walk([root.id])
  return lines
}

/** A line is valid when it starts at the root and each branch is a child of the previous one. */
export function isValidLine(play: Play, line: readonly Id[]): boolean {
  const root = rootBranch(play)
  if (!root || line[0] !== root.id) return false
  for (let i = 1; i < line.length; i++) {
    const branch = findBranch(play, line[i] ?? '')
    if (!branch || branch.parentId !== line[i - 1]) return false
  }
  return true
}

/** All descendants of a branch (not included). */
export function descendantsOf(play: Play, branchId: Id): Id[] {
  const result: Id[] = []
  const stack = [branchId]
  const seen = new Set<Id>([branchId])
  while (stack.length > 0) {
    const current = stack.pop()
    if (current === undefined) break
    for (const child of childrenOf(play, current)) {
      if (seen.has(child.id)) continue
      seen.add(child.id)
      result.push(child.id)
      stack.push(child.id)
    }
  }
  return result
}

export interface BranchLabelParts {
  /** Option letter among siblings (A, B, C...) when the branch has siblings, else null. */
  option: string | null
  /** Label typed by the user, null when the label is computed. */
  custom: string | null
}

/** Letter of the n-th option (0 -> A). */
export function optionLetter(index: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  return index < letters.length ? (letters[index] ?? '?') : `${index + 1}`
}

/** Components of the displayed label of a branch (SPEC 6.5, D-012). */
export function branchLabelParts(play: Play, branchId: Id): BranchLabelParts {
  const branch = findBranch(play, branchId)
  if (!branch) return { option: null, custom: null }
  const siblings = childrenOf(play, branch.parentId)
  const option =
    branch.parentId !== null && siblings.length >= 2
      ? optionLetter(siblings.findIndex((sibling) => sibling.id === branch.id))
      : null
  const custom = branch.label.trim() === '' ? null : branch.label
  return { option, custom }
}
