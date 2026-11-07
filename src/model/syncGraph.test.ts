import { describe, expect, it } from 'vitest'
import {
  P,
  ball,
  basePlay,
  branch,
  breakdown,
  friseFixturePlay,
  kick,
  pass,
  player,
  realisticRunsPlay,
  run,
  sequence,
  uuid,
} from '../test/builders'
import {
  analyseGlues,
  createsCycle,
  edgeKey,
  glueEdges,
  meetsOwnPass,
  type GlueEdge,
} from './syncGraph'
import type { Action, Id, Play } from './types'
import { validatePlay } from './validate'

const A = (n: number): Id => uuid(n)

function play(actions: Action[], extra: Partial<Play> = {}): Play {
  const positions: Record<Id, { x: number; y: number }> = {}
  for (let n = 1; n <= 4; n++) positions[A(n)] = { x: 40, y: 35 - 5 * n }
  return basePlay({
    entities: [...[1, 2, 3, 4].map((n) => player(A(n), 'A', n)), ball(uuid(90))],
    setup: { positions, ballCarrierId: A(1), ballPosition: null },
    actions,
    ...extra,
  })
}

const end = (targetId: Id) => ({ targetId, event: 'end' as const })
const slides = (targetId: Id) => ({ ...end(targetId), keep: 'duration' as const })
const stretches = (targetId: Id) => ({ ...end(targetId), keep: 'start' as const })
const keys = (edges: readonly GlueEdge[]) => edges.map(edgeKey)
const key = (ownerId: Id, kind: GlueEdge['kind']) => edgeKey({ ownerId, kind })

describe('order of the glued edges (SPEC 4.3, 5.8)', () => {
  it('puts the targets first, whatever the order of the array', () => {
    const p = play([
      run(uuid(12), A(3), [{ x: 45, y: 20 }], { endGlue: slides(uuid(11)) }),
      run(uuid(11), A(2), [{ x: 50, y: 25 }], { endGlue: slides(uuid(10)) }),
      run(uuid(10), A(1), [{ x: 75, y: 30 }]),
    ])
    expect(keys(analyseGlues(p).order)).toEqual([key(uuid(11), 'end'), key(uuid(12), 'end')])
  })

  it('covers every edge: branch points and sequences included', () => {
    const p = play(
      [
        run(uuid(10), A(1), [{ x: 75, y: 30 }]),
        run(uuid(20), A(2), [{ x: 50, y: 25 }], {
          branchId: P.optA,
          start: 8,
          startGlue: end(P.root),
        }),
      ],
      {
        branches: [
          branch(P.root, null, { branchAt: 8, branchAtGlue: end(uuid(10)) }),
          branch(P.optA, P.root, { isDefault: true }),
          branch(P.optB, P.root),
        ],
        sequences: [
          sequence(uuid(30), 0, 8, { endGlue: stretches(P.root) }),
          sequence(uuid(31), 8, 12, { startGlue: end(uuid(30)) }),
        ],
      },
    )
    const order = keys(analyseGlues(p).order)
    expect(order).toHaveLength(4)
    const rank = (k: string) => order.indexOf(k)
    expect(rank(key(P.root, 'branchAt'))).toBeLessThan(rank(key(uuid(20), 'start')))
    expect(rank(key(P.root, 'branchAt'))).toBeLessThan(rank(key(uuid(30), 'end')))
    expect(rank(key(uuid(30), 'end'))).toBeLessThan(rank(key(uuid(31), 'start')))
  })

  it('takes a left edge before the right edge of the same block', () => {
    const p = play([
      run(uuid(10), A(1), [{ x: 75, y: 30 }]),
      run(uuid(11), A(2), [{ x: 50, y: 25 }], {
        endGlue: slides(uuid(10)),
        startGlue: { targetId: uuid(10), event: 'start' },
      }),
    ])
    expect(keys(analyseGlues(p).order)).toEqual([key(uuid(11), 'start'), key(uuid(11), 'end')])
  })

  it('takes the run before on the same player first, when the graph leaves it free', () => {
    const p = play([
      run(uuid(20), A(1), [{ x: 90, y: 30 }], { start: 9, endGlue: slides(uuid(30)) }),
      run(uuid(21), A(1), [{ x: 80, y: 30 }], { start: 1, endGlue: slides(uuid(30)) }),
      run(uuid(30), A(2), [{ x: 90, y: 25 }]),
    ])
    expect(keys(analyseGlues(p).order)).toEqual([key(uuid(21), 'end'), key(uuid(20), 'end')])
  })

  it('leaves out an edge that cannot apply, without a cycle', () => {
    const p = play([run(uuid(11), A(2), [{ x: 50, y: 25 }], { endGlue: slides(uuid(99)) })])
    expect(analyseGlues(p)).toMatchObject({ order: [], cyclic: [] })
  })

  it('resolves the realistic scene and the fixture without any cycle', () => {
    for (const p of [realisticRunsPlay(), friseFixturePlay()]) {
      const analysis = analyseGlues(p)
      expect(analysis.cyclic).toEqual([])
      expect(analysis.order).toHaveLength(glueEdges(p).length)
    }
  })
})

describe('cycles of glues (SPEC 4.3, 5.8, D-152)', () => {
  it('finds two runs glued to each other, reported by the validation', () => {
    const p = play([
      run(uuid(10), A(1), [{ x: 50, y: 30 }], { start: 0.3, endGlue: slides(uuid(11)) }),
      run(uuid(11), A(2), [{ x: 50, y: 25 }], { start: 0.6, endGlue: slides(uuid(10)) }),
    ])
    const analysis = analyseGlues(p)
    expect(keys(analysis.cyclic)).toEqual([key(uuid(10), 'end'), key(uuid(11), 'end')])
    expect(analysis.order).toEqual([])
    expect(validatePlay(p).filter((i) => i.code === 'glueCycle')).toHaveLength(2)
  })

  it('finds a pass glued to the end of a run itself glued to the arrival of this pass', () => {
    const p = play([
      run(uuid(10), A(2), [{ x: 50, y: 25 }], { startGlue: end(uuid(20)) }),
      pass(uuid(20), A(1), A(3), 1, { startGlue: end(uuid(10)) }),
    ])
    expect(keys(analyseGlues(p).cyclic).sort()).toEqual(
      [key(uuid(10), 'start'), key(uuid(20), 'start')].sort(),
    )
  })

  it('finds a cycle through a sequence and a branch point', () => {
    const p = play([], {
      branches: [
        branch(P.root, null, { branchAt: 5, branchAtGlue: end(uuid(30)) }),
        branch(P.optA, P.root, { isDefault: true }),
        branch(P.optB, P.root),
      ],
      sequences: [sequence(uuid(30), 0, 5, { endGlue: stretches(P.root) })],
    })
    expect(keys(analyseGlues(p).cyclic).sort()).toEqual(
      [key(P.root, 'branchAt'), key(uuid(30), 'end')].sort(),
    )
  })

  it('finds a receiver glued to her pass when the passer is glued to her', () => {
    const p = play([
      pass(uuid(20), A(1), A(2), 3),
      run(uuid(10), A(1), [{ x: 50, y: 30 }], { endGlue: stretches(uuid(11)) }),
      run(uuid(11), A(2), [{ x: 34, y: 18 }], { endGlue: slides(uuid(20)) }),
    ])
    expect(keys(analyseGlues(p).cyclic).sort()).toEqual(
      [key(uuid(10), 'end'), key(uuid(11), 'end')].sort(),
    )
  })

  it('sees no cycle when she runs after a reception and goes on with a glued run (D-152)', () => {
    const p = play([
      pass(uuid(20), A(1), A(2), 1),
      run(uuid(11), A(2), [{ x: 50, y: 25 }], { startGlue: end(uuid(20)) }),
      run(uuid(12), A(2), [{ x: 60, y: 25 }], { startGlue: end(uuid(11)) }),
    ])
    const analysis = analyseGlues(p)
    expect(analysis.cyclic).toEqual([])
    expect(analysis.arrivalDependents.get(uuid(20))).toEqual(new Set([uuid(11), uuid(12)]))
  })

  it('sees no cycle when a passer starts again at the arrival of her own pass (D-152)', () => {
    const p = play([
      run(uuid(10), A(1), [{ x: 50, y: 30 }]),
      pass(uuid(20), A(1), A(2), 1),
      run(uuid(11), A(1), [{ x: 60, y: 30 }], { start: 3, startGlue: end(uuid(20)) }),
    ])
    const analysis = analyseGlues(p)
    expect(analysis.cyclic).toEqual([])
    expect(analysis.arrivalDependents.get(uuid(20))).toEqual(new Set([uuid(11)]))
  })

  it('lets a receiver meet her pass, then a glued run go on: her run depends on the release', () => {
    const p = play([
      pass(uuid(20), A(1), A(2), 1),
      run(uuid(11), A(2), [{ x: 34, y: 18 }], { endGlue: slides(uuid(20)) }),
      run(uuid(12), A(2), [{ x: 60, y: 25 }], { startGlue: end(uuid(11)) }),
    ])
    const analysis = analyseGlues(p)
    expect(analysis.cyclic).toEqual([])
    // The arrival reads her run: the ball arrives at her point.
    expect(analysis.arrivalDependents.get(uuid(20))).toEqual(new Set())
    const [edge] = glueEdges(p).filter((e) => e.ownerId === uuid(11))
    expect(edge && meetsOwnPass(p, edge)).toBe(true)
  })

  it('never takes a run of an option into the arrival of a pass of the trunk', () => {
    // In the trunk, the release is glued to the end of the run of her option: invalid by itself; here
    // the option run is glued to the arrival, the trunk does not depend on it.
    const p = play(
      [
        pass(uuid(20), A(1), A(2), 1),
        run(uuid(11), A(2), [{ x: 50, y: 25 }], { branchId: P.optA, endGlue: slides(uuid(30)) }),
        run(uuid(30), A(3), [{ x: 50, y: 20 }], { branchId: P.optA, start: 5 }),
      ],
      {
        branches: [
          branch(P.root, null, { branchAt: 4 }),
          branch(P.optA, P.root, { isDefault: true }),
          branch(P.optB, P.root),
        ],
      },
    )
    expect(analyseGlues(p).cyclic).toEqual([])
  })

  it('keeps a kick out of the runs of its receiver: its arrival depends on its release', () => {
    const p = play([
      kick(uuid(20), A(1), { receiverId: A(2) }, 1, {
        startGlue: { targetId: uuid(11), event: 'start' },
      }),
      run(uuid(11), A(2), [{ x: 50, y: 25 }], { endGlue: slides(uuid(20)) }),
    ])
    // The run ends with the arrival, the release follows the start of the run: a real loop.
    expect(analyseGlues(p).cyclic).toHaveLength(2)
    const free = play([
      kick(uuid(20), A(1), { receiverId: A(2) }, 1),
      run(uuid(11), A(2), [{ x: 50, y: 25 }], { endGlue: slides(uuid(20)) }),
    ])
    expect(analyseGlues(free).cyclic).toEqual([])
  })

  it('is told by a breakdown glued to the end of a run of its player that nothing loops', () => {
    const p = play([
      run(uuid(10), A(1), [{ x: 50, y: 30 }], { endGlue: slides(uuid(30)) }),
      run(uuid(30), A(4), [{ x: 50, y: 15 }]),
      breakdown(uuid(20), A(1), A(2), A(3), 3, { startGlue: end(uuid(10)) }),
    ])
    expect(analyseGlues(p).cyclic).toEqual([])
    expect(keys(analyseGlues(p).order)).toEqual([key(uuid(10), 'end'), key(uuid(20), 'start')])
  })
})

describe('glue that would close a cycle, refused when laid (SPEC 5.8)', () => {
  const p = play([
    run(uuid(10), A(1), [{ x: 50, y: 30 }]),
    run(uuid(11), A(2), [{ x: 50, y: 25 }], { endGlue: slides(uuid(10)) }),
  ])
  const edge = (ownerId: Id, kind: 'start' | 'end', targetId: Id): GlueEdge => ({
    kind,
    ownerId,
    branchId: P.root,
    glue: end(targetId),
    keep: kind === 'end' ? 'duration' : null,
  })

  it('tells a cycle from a chain', () => {
    expect(createsCycle(p, edge(uuid(10), 'end', uuid(11)))).toBe(true)
    expect(createsCycle(p, edge(uuid(10), 'start', uuid(11)))).toBe(true)
    expect(
      createsCycle(
        play([...p.actions, pass(uuid(20), A(3), A(4), 1)]),
        edge(uuid(10), 'end', uuid(20)),
      ),
    ).toBe(false)
  })

  it('replaces the glue the edge already has', () => {
    expect(createsCycle(p, edge(uuid(11), 'end', uuid(10)))).toBe(false)
  })

  it('does not refuse what D-152 allows', () => {
    const q = play([
      pass(uuid(20), A(1), A(2), 1),
      run(uuid(11), A(2), [{ x: 50, y: 25 }], { startGlue: end(uuid(20)) }),
      run(uuid(12), A(2), [{ x: 60, y: 25 }]),
    ])
    expect(createsCycle(q, edge(uuid(12), 'start', uuid(11)))).toBe(false)
    expect(createsCycle(q, edge(uuid(20), 'start', uuid(11)))).toBe(true)
  })
})
