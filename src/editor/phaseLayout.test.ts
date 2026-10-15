import { describe, expect, it } from 'vitest'
import { P, phase, sevenVsSevenWithOptions, uuid } from '../test/builders'
import { layoutPhaseTree } from './phaseLayout'

describe('phase tree layout (SPEC 6.4)', () => {
  it('lays the trunk horizontally and stacks options below their branch point', () => {
    const layout = layoutPhaseTree(sevenVsSevenWithOptions())
    expect(layout.nodes.map((n) => [n.id, n.column, n.row])).toEqual([
      [P.t1, 0, 0],
      [P.t2, 1, 0],
      [P.t3a, 2, 0],
      [P.t3b, 2, 1],
    ])
    expect(layout).toMatchObject({ columns: 3, rows: 2 })
  })

  it('places nested options below the subtree of the previous option', () => {
    const play = sevenVsSevenWithOptions()
    play.phases.push(phase(uuid(500), P.t3a, []), phase(uuid(501), P.t3a, []))
    const layout = layoutPhaseTree(play)
    const row = (id: string) => layout.nodes.find((n) => n.id === id)?.row
    expect([row(uuid(500)), row(uuid(501)), row(P.t3b)]).toEqual([0, 1, 2])
  })
})
