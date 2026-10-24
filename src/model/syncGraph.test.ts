import { describe, expect, it } from 'vitest'
import {
  basePlay,
  breakdown,
  kick,
  P,
  pass,
  phase,
  realisticRunsPlay,
  run,
  uuid,
} from '../test/builders'
import { analyseSyncs, createsCycle, syncProblem } from './syncGraph'
import type { Action, Phase, RunAction, RunSync } from './types'
import { validatePlay } from './validate'

const link = (actionId: string, extra: Partial<RunSync> = {}): RunSync => ({
  target: { actionId, event: 'runEnd' },
  adjust: 'delay',
  ...extra,
})

const one = (actions: Action[]): Phase => phase(uuid(9000), null, actions)

function runOf(p: Phase, id: string): RunAction {
  const found = p.actions.find((a) => a.id === id)
  if (found?.type !== 'run') throw new Error(`no run ${id}`)
  return found
}

describe('link problems (SPEC 4.3, D-108)', () => {
  const target = run(uuid(1), P.A(1), [
    { x: 1, y: 1 },
    { x: 2, y: 2 },
  ])
  const p = one([
    target,
    pass(uuid(2), P.A(1), P.A(2), 0),
    breakdown(uuid(3), P.A(1), P.A(2), P.A(3), 1),
    run(uuid(4), P.A(4), [{ x: 3, y: 3 }]),
  ])
  const mine = runOf(p, uuid(4))
  const problem = (sync: RunSync) => syncProblem(p, mine, sync)

  it('accepts every compatible target', () => {
    expect(problem(link(uuid(1)))).toBeNull()
    expect(
      problem({ ...link(uuid(1)), target: { actionId: uuid(1), event: 'runPoint', index: 1 } }),
    ).toBeNull()
    expect(
      problem({ ...link(uuid(2)), target: { actionId: uuid(2), event: 'release' } }),
    ).toBeNull()
    expect(
      problem({ ...link(uuid(2)), target: { actionId: uuid(2), event: 'arrival' } }),
    ).toBeNull()
    expect(
      problem({ ...link(uuid(3)), target: { actionId: uuid(3), event: 'formation' } }),
    ).toBeNull()
    expect(syncProblem(p, mine)).toBeNull()
  })

  it('reports a deleted target, an incompatible event, missing points and the run itself', () => {
    expect(problem(link(uuid(99)))).toBe('missing')
    expect(problem(link(uuid(4)))).toBe('self')
    expect(problem(link(uuid(2)))).toBe('event')
    expect(problem({ ...link(uuid(1)), target: { actionId: uuid(1), event: 'release' } })).toBe(
      'event',
    )
    expect(problem({ ...link(uuid(1)), target: { actionId: uuid(3), event: 'arrival' } })).toBe(
      'event',
    )
    expect(problem({ ...link(uuid(2)), target: { actionId: uuid(2), event: 'formation' } })).toBe(
      'event',
    )
    expect(
      problem({ ...link(uuid(1)), target: { actionId: uuid(1), event: 'runPoint', index: 2 } }),
    ).toBe('index')
    expect(problem(link(uuid(1), { at: 1 }))).toBe('at')
  })

  it('reports a target of another phase as deleted', () => {
    const play = basePlay({
      phases: [
        phase(uuid(1), null, [run(uuid(10), P.A(1), [{ x: 1, y: 1 }])]),
        phase(uuid(2), uuid(1), [
          run(uuid(20), P.A(2), [{ x: 2, y: 2 }], { sync: link(uuid(10)) }),
        ]),
      ],
    })
    expect(validatePlay(play).filter((i) => i.code.startsWith('sync'))).toEqual([
      {
        code: 'syncTargetMissing',
        severity: 'error',
        target: { kind: 'action', id: uuid(20), phaseId: uuid(2) },
      },
    ])
  })
})

describe('order and cycles of the links (SPEC 5.8, D-108, D-110)', () => {
  it('orders a chain of links, targets first', () => {
    const p = one([
      run(uuid(3), P.A(3), [{ x: 3, y: 3 }], { sync: link(uuid(2)) }),
      run(uuid(2), P.A(2), [{ x: 2, y: 2 }], { sync: link(uuid(1)) }),
      run(uuid(1), P.A(1), [{ x: 1, y: 1 }]),
      run(uuid(4), P.A(4), [{ x: 4, y: 4 }], { sync: link(uuid(1)) }),
    ])
    const analysis = analyseSyncs(p)
    expect(analysis.order).toEqual([uuid(2), uuid(3), uuid(4)])
    expect(analysis.cyclic.size).toBe(0)
  })

  it('finds a cycle of two runs', () => {
    const p = one([
      run(uuid(1), P.A(1), [{ x: 1, y: 1 }], { sync: link(uuid(2)) }),
      run(uuid(2), P.A(2), [{ x: 2, y: 2 }], { sync: link(uuid(1)) }),
      run(uuid(3), P.A(3), [{ x: 3, y: 3 }], { sync: link(uuid(1)) }),
    ])
    const analysis = analyseSyncs(p)
    expect([...analysis.cyclic].sort()).toEqual([uuid(1), uuid(2)])
    // A run depending on a cycle is not in it: it is ordered, the engine ignores its target.
    expect(analysis.order).toEqual([uuid(3)])
  })

  it('accepts a receiver meeting the arrival of the pass she receives (D-108)', () => {
    const p = one([
      pass(uuid(1), P.A(1), P.A(2), 0.5),
      run(uuid(2), P.A(2), [{ x: 2, y: 2 }], {
        sync: { target: { actionId: uuid(1), event: 'arrival' }, adjust: 'speed' },
      }),
      run(uuid(3), P.A(1), [{ x: 1, y: 1 }]),
    ])
    expect(analyseSyncs(p)).toEqual({ order: [uuid(2)], cyclic: new Set(), problems: new Map() })
    // The passer meeting the arrival of her own pass is a true cycle (her position at release).
    const passerLink: RunSync = { target: { actionId: uuid(1), event: 'arrival' }, adjust: 'delay' }
    expect(createsCycle(p, uuid(3), passerLink)).toBe(true)
    // ... and so is the passer waiting for the receiver who meets the pass.
    expect(createsCycle(p, uuid(3), link(uuid(2)))).toBe(true)
  })

  it('goes through releases on receipt (D-110)', () => {
    // A1 passes to A2; A2 passes on receipt to A3; A1's run waits for the arrival at A3.
    const p = one([
      run(uuid(10), P.A(1), [{ x: 1, y: 1 }]),
      pass(uuid(1), P.A(1), P.A(2), 0.5),
      pass(uuid(2), P.A(2), P.A(3), 0, { release: 'onReceipt' }),
    ])
    const onArrival: RunSync = { target: { actionId: uuid(2), event: 'arrival' }, adjust: 'delay' }
    expect(createsCycle(p, uuid(10), onArrival)).toBe(true)
    const onKick = one([
      run(uuid(10), P.A(1), [{ x: 1, y: 1 }]),
      kick(uuid(1), P.A(4), { receiverId: P.A(2) }, 0.5),
      pass(uuid(2), P.A(2), P.A(1), 0, { release: 'onReceipt' }),
      breakdown(uuid(3), P.A(5), P.A(6), P.A(2), 0),
    ])
    // The arrival of a kick depends on nothing but its release: no cycle.
    expect(createsCycle(onKick, uuid(10), onArrival)).toBe(false)
  })

  it('accepts a loop of releases on receipt without any link', () => {
    // C passes to A, A passes to B on receipt, B gives back to A on receipt (loop play).
    const p = one([
      pass(uuid(1), P.A(3), P.A(1), 0),
      pass(uuid(2), P.A(1), P.A(2), 0, { release: 'onReceipt' }),
      pass(uuid(3), P.A(2), P.A(1), 0, { release: 'onReceipt' }),
      run(uuid(4), P.A(4), [{ x: 4, y: 4 }], {
        sync: { target: { actionId: uuid(3), event: 'arrival' }, adjust: 'delay' },
      }),
    ])
    const analysis = analyseSyncs(p)
    expect(analysis.cyclic.size).toBe(0)
    expect(analysis.order).toEqual([uuid(4)])
    expect(validatePlay(basePlay({ phases: [p] })).some((i) => i.code === 'syncCycle')).toBe(false)
  })

  it('reports problems and cycles in the validation', () => {
    const p = one([
      run(uuid(1), P.A(1), [{ x: 1, y: 1 }], { sync: link(uuid(2)) }),
      run(uuid(2), P.A(2), [{ x: 2, y: 2 }], { sync: link(uuid(1)) }),
      run(uuid(3), P.A(3), [{ x: 3, y: 3 }], { sync: link(uuid(3)) }),
    ])
    const codes = validatePlay(basePlay({ phases: [p] }))
      .filter((i) => i.code.startsWith('sync'))
      .map((i) => [i.code, i.target.kind === 'action' ? i.target.id : '', i.params?.reason])
    expect(codes).toEqual([
      ['syncTargetInvalid', uuid(3), 'self'],
      ['syncCycle', uuid(1), undefined],
      ['syncCycle', uuid(2), undefined],
    ])
  })

  it('finds no problem in the lot 3 bis builder', () => {
    const play = realisticRunsPlay()
    expect(validatePlay(play).filter((i) => i.code.startsWith('sync'))).toEqual([])
    for (const p of play.phases) expect(analyseSyncs(p).cyclic.size).toBe(0)
  })
})
