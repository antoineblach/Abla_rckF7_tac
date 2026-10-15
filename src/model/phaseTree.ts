// Phase tree helpers (SPEC 5.1, 6.4). Every function tolerates invalid trees
// (missing parents, cycles): it never loops and never throws.
import type { Id, Phase, Play } from './types'

/** Children of a phase (or roots for null), in creation order (array order). */
export function childrenOf(play: Play, parentId: Id | null): Phase[] {
  return play.phases.filter((phase) => phase.parentId === parentId)
}

export function findPhase(play: Play, phaseId: Id): Phase | undefined {
  return play.phases.find((phase) => phase.id === phaseId)
}

/** The root phase: the first phase without parent. */
export function rootPhase(play: Play): Phase | undefined {
  return play.phases.find((phase) => phase.parentId === null)
}

/** Ids from the root to the phase, both included; empty if the phase is unknown or unreachable. */
export function pathToPhase(play: Play, phaseId: Id): Id[] {
  const path: Id[] = []
  const seen = new Set<Id>()
  let current = findPhase(play, phaseId)
  while (current) {
    if (seen.has(current.id)) return []
    seen.add(current.id)
    path.push(current.id)
    if (current.parentId === null) return path.reverse()
    current = findPhase(play, current.parentId)
  }
  return []
}

/** Depth from the root, starting at 1 (« Temps n », SPEC 6.4). 0 if unreachable. */
export function phaseDepth(play: Play, phaseId: Id): number {
  return pathToPhase(play, phaseId).length
}

/** The child followed by default: the only child, or the sibling marked isDefault. */
export function defaultChild(play: Play, phaseId: Id): Phase | undefined {
  const children = childrenOf(play, phaseId)
  if (children.length <= 1) return children[0]
  return children.find((child) => child.isDefault) ?? children[0]
}

/** A phase whose children are options (at least two children). */
export function isBranchPoint(play: Play, phaseId: Id): boolean {
  return childrenOf(play, phaseId).length >= 2
}

/** Extends a path (root to some phase) with default children down to a leaf. */
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

/** The default line through a phase: root to phase, then default children to a leaf. */
export function defaultLineThrough(play: Play, phaseId: Id): Id[] {
  const path = pathToPhase(play, phaseId)
  return path.length === 0 ? [] : extendWithDefaults(play, path)
}

/** The default line of the play (from the root). */
export function defaultLine(play: Play): Id[] {
  const root = rootPhase(play)
  return root ? extendWithDefaults(play, [root.id]) : []
}

/** All lines: every path from the root to a leaf (SPEC 5.1), depth first, in creation order. */
export function allLines(play: Play): Id[][] {
  const root = rootPhase(play)
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

/** A line is valid when it starts at the root and each phase is a child of the previous one. */
export function isValidLine(play: Play, line: readonly Id[]): boolean {
  const root = rootPhase(play)
  if (!root || line[0] !== root.id) return false
  for (let i = 1; i < line.length; i++) {
    const phase = findPhase(play, line[i] ?? '')
    if (!phase || phase.parentId !== line[i - 1]) return false
  }
  return true
}

/** All descendants of a phase (not included). */
export function descendantsOf(play: Play, phaseId: Id): Id[] {
  const result: Id[] = []
  const stack = [phaseId]
  const seen = new Set<Id>([phaseId])
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

export interface PhaseLabelParts {
  /** « Temps n » (n = depth from the root, from 1). */
  depth: number
  /** Option letter among siblings (A, B, C...) when the phase has siblings, else null. */
  option: string | null
  /** Label typed by the user, null when the label is computed. */
  custom: string | null
}

/** Letter of the n-th option (0 -> A). */
export function optionLetter(index: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  return index < letters.length ? (letters[index] ?? '?') : `${index + 1}`
}

/** Components of the displayed label of a phase (SPEC 6.4, DECISIONS Q12). */
export function phaseLabelParts(play: Play, phaseId: Id): PhaseLabelParts {
  const phase = findPhase(play, phaseId)
  const depth = phaseDepth(play, phaseId)
  if (!phase) return { depth, option: null, custom: null }
  const siblings = childrenOf(play, phase.parentId)
  const option =
    phase.parentId !== null && siblings.length >= 2
      ? optionLetter(siblings.findIndex((sibling) => sibling.id === phase.id))
      : null
  const custom = phase.label.trim() === '' ? null : phase.label
  return { depth, option, custom }
}
