import { describe, expect, it } from 'vitest'
import {
  P,
  basePlay,
  branch,
  friseFixturePlay,
  sevenVsSevenWithOptions,
  uuid,
} from '../test/builders'
import {
  allLines,
  branchLabelParts,
  branchPoints,
  defaultLine,
  defaultLineThrough,
  descendantsOf,
  isBranchPoint,
  isValidLine,
  optionLetter,
  pathToBranch,
} from './branches'

describe('branch tree', () => {
  const play = sevenVsSevenWithOptions()
  const nested = friseFixturePlay()

  it('lists every line from the root to a leaf', () => {
    expect(allLines(play)).toEqual([
      [P.root, P.optA],
      [P.root, P.optB],
    ])
    expect(allLines(nested)).toEqual([
      [P.root, P.optA],
      [P.root, P.optB, P.optB1],
      [P.root, P.optB, P.optB2],
    ])
    expect(allLines(basePlay())).toEqual([[P.root]])
  })

  it('follows the default option', () => {
    expect(defaultLine(play)).toEqual([P.root, P.optA])
    expect(defaultLineThrough(play, P.optB)).toEqual([P.root, P.optB])
    expect(defaultLineThrough(play, P.root)).toEqual([P.root, P.optA])
    expect(defaultLineThrough(nested, P.optB)).toEqual([P.root, P.optB, P.optB1])
  })

  it('computes paths, branch points and descendants', () => {
    expect(pathToBranch(nested, P.optB2)).toEqual([P.root, P.optB, P.optB2])
    expect(isBranchPoint(play, P.root)).toBe(true)
    expect(isBranchPoint(play, P.optA)).toBe(false)
    expect(branchPoints(nested)).toEqual([P.root, P.optB])
    expect(descendantsOf(nested, P.optB).sort()).toEqual([P.optB1, P.optB2].sort())
    expect(isValidLine(nested, [P.root, P.optB, P.optB2])).toBe(true)
    expect(isValidLine(nested, [P.root, P.optB2])).toBe(false)
    expect(isValidLine(nested, [P.optB, P.optB2])).toBe(false)
  })

  it('computes the letters of the options (D-012)', () => {
    expect(branchLabelParts(play, P.root)).toEqual({ option: null, custom: null })
    expect(branchLabelParts(play, P.optA)).toEqual({ option: 'A', custom: null })
    expect(branchLabelParts(play, P.optB)).toEqual({ option: 'B', custom: null })
    expect(branchLabelParts(play, uuid(4242))).toEqual({ option: null, custom: null })
    expect(optionLetter(25)).toBe('Z')
    expect(optionLetter(26)).toBe('27')
  })

  it('recomputes letters after a deletion and keeps typed labels', () => {
    const edited = { ...play, branches: play.branches.filter((b) => b.id !== P.optA) }
    expect(branchLabelParts(edited, P.optB).option).toBeNull()
    const renamed = {
      ...play,
      branches: play.branches.map((b) => (b.id === P.optB ? { ...b, label: 'Retour' } : b)),
    }
    expect(branchLabelParts(renamed, P.optB)).toEqual({ option: 'B', custom: 'Retour' })
  })

  it('never loops on a cycle', () => {
    const a = uuid(1)
    const b = uuid(2)
    const cyclic = basePlay({ branches: [branch(a, b), branch(b, a)] })
    expect(allLines(cyclic)).toEqual([])
    expect(pathToBranch(cyclic, a)).toEqual([])
    expect(descendantsOf(cyclic, a).length).toBe(1)
    expect(defaultLine(cyclic)).toEqual([])
  })
})
