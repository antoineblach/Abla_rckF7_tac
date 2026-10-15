import { describe, expect, it } from 'vitest'
import { cutIntoDashes, fieldMarkings, transverseLines } from './geometry'

describe('field geometry (SPEC 13.1)', () => {
  it('places the lines of a standard 100 x 70 field', () => {
    expect(transverseLines({ length: 100, width: 70, inGoal: 10 })).toEqual({
      goal: [0, 100],
      line5: [5, 95],
      line22: [22, 78],
      line10: [40, 60],
      halfway: [50],
    })
    const markings = fieldMarkings({ length: 100, width: 70, inGoal: 10 })
    expect(markings.surface).toEqual({ min: { x: -10, y: 0 }, max: { x: 110, y: 70 } })
    expect(markings.solid).toHaveLength(13)
    expect(markings.halfwayMark).toEqual({ a: { x: 49.75, y: 35 }, b: { x: 50.25, y: 35 } })
    expect(markings.posts.map((p) => p.y)).toEqual([32.2, 37.8, 32.2, 37.8])
  })

  it('keeps every line at its distance on a reduced field (Law 1.3, DECISIONS Q1)', () => {
    const field = { length: 94, width: 68, inGoal: 6 }
    expect(transverseLines(field)).toEqual({
      goal: [0, 94],
      line5: [5, 89],
      line22: [22, 72],
      line10: [37, 57],
      halfway: [47],
    })
    const dashedY = new Set(
      fieldMarkings(field)
        .dashes.filter((d) => d.a.y === d.b.y)
        .map((d) => d.a.y),
    )
    expect([...dashedY].sort((a, b) => a - b)).toEqual([5, 15, 53, 63])
  })

  it('cuts dashed lines into 5 m dashes separated by 5 m (DECISIONS Q2)', () => {
    const dashes = cutIntoDashes({ a: { x: 0, y: 0 }, b: { x: 0, y: 23 } }, 5, 5)
    expect(dashes.map((d) => [d.a.y, d.b.y])).toEqual([
      [0, 5],
      [10, 15],
      [20, 23],
    ])
  })
})
