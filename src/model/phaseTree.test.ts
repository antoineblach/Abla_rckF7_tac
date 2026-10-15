import { describe, expect, it } from 'vitest'
import { P, basePlay, phase, sevenVsSevenWithOptions, uuid } from '../test/builders'
import {
  allLines,
  defaultLine,
  defaultLineThrough,
  descendantsOf,
  isBranchPoint,
  isValidLine,
  pathToPhase,
  phaseLabelParts,
} from './phaseTree'

describe('phase tree', () => {
  const play = sevenVsSevenWithOptions()

  it('lists every line from the root to a leaf', () => {
    expect(allLines(play)).toEqual([
      [P.t1, P.t2, P.t3a],
      [P.t1, P.t2, P.t3b],
    ])
  })

  it('follows the default option', () => {
    expect(defaultLine(play)).toEqual([P.t1, P.t2, P.t3a])
    expect(defaultLineThrough(play, P.t3b)).toEqual([P.t1, P.t2, P.t3b])
    expect(defaultLineThrough(play, P.t1)).toEqual([P.t1, P.t2, P.t3a])
  })

  it('computes paths, branch points and descendants', () => {
    expect(pathToPhase(play, P.t3b)).toEqual([P.t1, P.t2, P.t3b])
    expect(isBranchPoint(play, P.t2)).toBe(true)
    expect(isBranchPoint(play, P.t1)).toBe(false)
    expect(descendantsOf(play, P.t2).sort()).toEqual([P.t3a, P.t3b].sort())
    expect(isValidLine(play, [P.t1, P.t2, P.t3b])).toBe(true)
    expect(isValidLine(play, [P.t1, P.t3b])).toBe(false)
  })

  it('computes labels « Temps n » and « Temps n, option X » (SPEC 6.4)', () => {
    expect(phaseLabelParts(play, P.t1)).toEqual({ depth: 1, option: null, custom: null })
    expect(phaseLabelParts(play, P.t2)).toEqual({ depth: 2, option: null, custom: null })
    expect(phaseLabelParts(play, P.t3a)).toEqual({ depth: 3, option: 'A', custom: null })
    expect(phaseLabelParts(play, P.t3b)).toEqual({ depth: 3, option: 'B', custom: null })
  })

  it('recomputes letters after a deletion and keeps typed labels', () => {
    const edited = { ...play, phases: play.phases.filter((p) => p.id !== P.t3a) }
    expect(phaseLabelParts(edited, P.t3b).option).toBeNull()
    const renamed = {
      ...play,
      phases: play.phases.map((p) => (p.id === P.t2 ? { ...p, label: 'Fixation' } : p)),
    }
    expect(phaseLabelParts(renamed, P.t2).custom).toBe('Fixation')
  })

  it('never loops on a cycle', () => {
    const a = uuid(1)
    const b = uuid(2)
    const cyclic = basePlay({ phases: [phase(a, b, []), phase(b, a, [])] })
    expect(allLines(cyclic)).toEqual([])
    expect(pathToPhase(cyclic, a)).toEqual([])
    expect(descendantsOf(cyclic, a).length).toBe(1)
  })
})
