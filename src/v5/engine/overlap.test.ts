import { describe, expect, it } from 'vitest'
import { defaultSettings, engineSettingsOf, type EngineSettings } from '../../model/settings'
import type { Issue } from '../model/issues'
import type { Action, Branch, Id, Play, Sequence } from '../model/types'
import {
  P,
  ball,
  basePlay,
  branch,
  breakdown,
  pass,
  player,
  run,
  sequence,
  uuid,
} from '../test/builders'
import { lineReport } from './actionReport'
import { createCaches } from './caches'
import { evaluate } from './evaluate'
import { motionEnd } from './motion'
import { compileLine, type CompiledLine } from './timeline'

const settings: EngineSettings = engineSettingsOf(defaultSettings())
const A1 = uuid(1)
const A2 = uuid(2)
const A3 = uuid(3)
const A4 = uuid(4)
const LINE_A = [P.root, P.optA]

function scene(extra: { actions?: Action[]; sequences?: Sequence[]; branches?: Branch[] }): Play {
  return basePlay({
    entities: [
      player(A1, 'A', 1),
      player(A2, 'A', 2),
      player(A3, 'A', 3),
      player(A4, 'A', 4),
      ball(uuid(20)),
    ],
    setup: {
      positions: {
        [A1]: { x: 40, y: 30 },
        [A2]: { x: 40, y: 33 },
        [A3]: { x: 38, y: 36 },
        [A4]: { x: 37, y: 40 },
      },
      ballCarrierId: A1,
      ballPosition: null,
    },
    ...extra,
  })
}

const options = (branchAt: number): Branch[] => [
  branch(P.root, null, { branchAt }),
  branch(P.optA, P.root, { isDefault: true }),
  branch(P.optB, P.root),
]

const compile = (play: Play, line: Id[] = [P.root]) =>
  compileLine(play, line, settings, createCaches())
const motionOf = (compiled: CompiledLine, id: Id) => {
  const found = compiled.motions.find((m) => m.source === 'run' && m.actionId === id)
  if (!found) throw new Error(`no motion ${id}`)
  return found
}
const issuesOf = (compiled: CompiledLine, code: Issue['code']) =>
  compiled.issues.filter((i) => i.code === code)
const delayOf = (compiled: CompiledLine, id: Id) =>
  issuesOf(compiled, 'runStartDelayed').find(
    (i) => i.target.kind === 'action' && i.target.id === id,
  )?.params?.delay

describe('overlapping runs of a player (SPEC 5.3, 4.3, D-013, D-139)', () => {
  const first = run(uuid(30), A2, [{ x: 60, y: 33 }])
  const second = run(uuid(31), A2, [{ x: 60, y: 60 }], { start: 1 })

  it('starts the second at the end of the first, with the delay in the alert', () => {
    const compiled = compile(scene({ actions: [first, second] }))
    const a = motionOf(compiled, first.id)
    const b = motionOf(compiled, second.id)
    expect(a.until).toBeNull()
    expect(b.planned).toBe(1)
    expect(b.start).toBe(motionEnd(a))
    expect(delayOf(compiled, second.id)).toBeCloseTo(motionEnd(a) - 1, 9)
    expect(issuesOf(compiled, 'runStartDelayed')[0]).toMatchObject({
      severity: 'warning',
      target: { kind: 'action', id: second.id, branchId: P.root },
    })
    expect(compiled.blocks[second.id]).toEqual({ start: b.start, end: motionEnd(b) })
    expect(compiled.duration).toBe(motionEnd(b))
    // Its start point is where the first one ended (SPEC 5.2), its waypoints are those drawn.
    expect(b.spline.points[0]).toEqual({ x: 60, y: 33 })
    expect(b.waypoints).toEqual([{ x: 60, y: 60 }])
  })

  it('reads the start order, not the order of the array', () => {
    const compiled = compile(scene({ actions: [second, first] }))
    expect(motionOf(compiled, first.id).start).toBe(0)
    expect(motionOf(compiled, second.id).start).toBe(motionEnd(motionOf(compiled, first.id)))
  })

  it('breaks a tie on the start by the order of the array', () => {
    const together = run(uuid(32), A2, [{ x: 20, y: 33 }])
    const compiled = compile(scene({ actions: [together, first] }))
    expect(motionOf(compiled, together.id).start).toBe(0)
    expect(motionOf(compiled, first.id).start).toBe(motionEnd(motionOf(compiled, together.id)))
  })

  it('chains the delays of several runs', () => {
    const third = run(uuid(33), A2, [{ x: 30, y: 60 }], { start: 2 })
    const compiled = compile(scene({ actions: [first, second, third] }))
    const b = motionOf(compiled, second.id)
    expect(motionOf(compiled, third.id).start).toBe(motionEnd(b))
    expect(issuesOf(compiled, 'runStartDelayed')).toHaveLength(2)
  })

  it('does not delay a run at the exact end of the previous one, nor after it', () => {
    const end = motionEnd(motionOf(compile(scene({ actions: [first] })), first.id))
    const exact = compile(scene({ actions: [first, { ...second, start: end }] }))
    expect(motionOf(exact, second.id).start).toBe(end)
    expect(issuesOf(exact, 'runStartDelayed')).toEqual([])
    const later = compile(scene({ actions: [first, { ...second, start: end + 1 }] }))
    expect(motionOf(later, second.id).start).toBe(end + 1)
    // The player waits where she stopped.
    expect(
      evaluate(
        scene({ actions: [first, { ...second, start: end + 1 }] }),
        [P.root],
        end + 0.5,
        settings,
        createCaches(),
      ).players.find((p) => p.id === A2)?.pos,
    ).toEqual({ x: 60, y: 33 })
  })

  it('is on the line: a run of the trunk is not delayed by an option it does not see', () => {
    const inOption = run(uuid(34), A2, [{ x: 60, y: 60 }], { branchId: P.optA, start: 1 })
    const compiled = compile(scene({ branches: options(1), actions: [first, inOption] }), LINE_A)
    expect(motionOf(compiled, first.id).start).toBe(0)
    // Posted in an option during a run of the trunk: it does not cut it (D-139).
    expect(motionOf(compiled, first.id).until).toBeNull()
    expect(motionOf(compiled, inOption.id).start).toBe(motionEnd(motionOf(compiled, first.id)))
    expect(delayOf(compiled, inOption.id)).toBeGreaterThan(0)
    const other = compile(scene({ branches: options(1), actions: [first, inOption] }), [
      P.root,
      P.optB,
    ])
    expect(other.motions.map((m) => m.actionId)).toEqual([first.id])
    expect(issuesOf(other, 'runStartDelayed')).toEqual([])
  })

  it('reports the delay in the report of the line', () => {
    const report = lineReport(
      scene({ actions: [first, second] }),
      [P.root],
      settings,
      createCaches(),
    )
    const row = report.rows.find((r) => r.actionId === second.id)
    if (row?.kind !== 'run') throw new Error('not a run')
    expect(row.delay).toBeGreaterThan(0)
    expect(row.start).toBe(1 + row.delay)
  })
})

describe('run of a participant in a breakdown (SPEC 5.3, 4.3, 10.3)', () => {
  // A1 carries the ball; ruck at 1 s, ball out at 4 s (relayer A3, support A2).
  const ruck = breakdown(uuid(40), A1, A2, A3, 1)

  it.each([
    ['tackled', A1],
    ['support', A2],
    ['relayer', A3],
  ])('delays a run of the %s that starts during the breakdown to the ball out', (_, id) => {
    const late = run(uuid(41), id, [{ x: 20, y: 20 }], { start: 2 })
    const compiled = compile(scene({ actions: [ruck, late] }))
    const motion = motionOf(compiled, late.id)
    expect(motion.start).toBe(4)
    expect(delayOf(compiled, late.id)).toBe(2)
    expect(issuesOf(compiled, 'runCutByBreakdown')).toEqual([])
    expect(compiled.blocks[late.id]?.start).toBe(4)
  })

  it('treats a run that starts at the formation like one during the breakdown', () => {
    const atFormation = run(uuid(41), A2, [{ x: 20, y: 20 }], { start: 1 })
    const compiled = compile(scene({ actions: [ruck, atFormation] }))
    expect(motionOf(compiled, atFormation.id).start).toBe(4)
    expect(delayOf(compiled, atFormation.id)).toBe(3)
    // Same result with the action first in the array.
    expect(motionOf(compile(scene({ actions: [atFormation, ruck] })), atFormation.id).start).toBe(4)
  })

  it('does not delay a run that starts at the ball out or later', () => {
    const after = run(uuid(41), A2, [{ x: 20, y: 20 }], { start: 4 })
    const compiled = compile(scene({ actions: [ruck, after] }))
    expect(motionOf(compiled, after.id).start).toBe(4)
    expect(issuesOf(compiled, 'runStartDelayed')).toEqual([])
  })

  it('starts the delayed run from where the participant stood', () => {
    const support = run(uuid(42), A2, [{ x: 46, y: 33 }])
    const late = run(uuid(41), A2, [{ x: 20, y: 20 }], { start: 2 })
    const compiled = compile(scene({ actions: [support, ruck, late] }))
    const cut = motionOf(compiled, support.id)
    expect(cut.until).toBe(1)
    expect(issuesOf(compiled, 'runCutByBreakdown')).toHaveLength(1)
    const frozen = evaluate(
      scene({ actions: [support, ruck, late] }),
      [P.root],
      3,
      settings,
      createCaches(),
    )
    const pos = frozen.players.find((p) => p.id === A2)?.pos
    expect(motionOf(compiled, late.id).spline.points[0]).toEqual(pos)
  })

  it('starts the relayer from the relay position after the ball out', () => {
    const late = run(uuid(41), A3, [{ x: 20, y: 20 }], { start: 2 })
    const compiled = compile(scene({ actions: [ruck, late] }))
    expect(motionOf(compiled, late.id).spline.points[0]).toEqual({ x: 39, y: 30 })
  })

  it('does not delay a player who is not in the breakdown', () => {
    const free = run(uuid(41), A4, [{ x: 20, y: 20 }], { start: 2 })
    const compiled = compile(scene({ actions: [ruck, free] }))
    expect(motionOf(compiled, free.id).start).toBe(2)
    expect(issuesOf(compiled, 'runStartDelayed')).toEqual([])
  })

  it('does not hold anyone in an ignored breakdown', () => {
    const notCarrier = breakdown(uuid(40), A2, A1, A3, 1)
    const late = run(uuid(41), A1, [{ x: 20, y: 20 }], { start: 2 })
    const compiled = compile(scene({ actions: [notCarrier, late] }))
    expect(compiled.breakdowns[0]?.applied).toBe(false)
    expect(motionOf(compiled, late.id).start).toBe(2)
  })
})

describe('blocks outside their branch (SPEC 4.3, D-156)', () => {
  it('starts an action of an option at the branch point, signalled', () => {
    const early = run(uuid(30), A2, [{ x: 60, y: 33 }], { branchId: P.optA, start: 1 })
    const compiled = compile(scene({ branches: options(2), actions: [early] }), LINE_A)
    expect(motionOf(compiled, early.id).start).toBe(2)
    expect(motionOf(compiled, early.id).planned).toBe(2)
    expect(compiled.issues).toEqual([
      {
        code: 'startsBeforeBranch',
        severity: 'warning',
        target: { kind: 'action', id: early.id, branchId: P.optA },
        params: { branchAt: 2 },
      },
    ])
  })

  it('applies to a release and to a formation too', () => {
    const early = pass(uuid(30), A1, A2, 1, { branchId: P.optA })
    const compiled = compile(scene({ branches: options(2), actions: [early] }), LINE_A)
    expect(compiled.passes[0]?.releaseT).toBe(2)
    expect(compiled.passes[0]?.plannedT).toBe(2)
    expect(issuesOf(compiled, 'startsBeforeBranch')).toHaveLength(1)
    const ruck = breakdown(uuid(31), A1, A2, A3, 1, { branchId: P.optA })
    const formed = compile(scene({ branches: options(2), actions: [ruck] }), LINE_A)
    expect(formed.breakdowns[0]?.start).toBe(2)
  })

  it('keeps an action of the trunk at or after the branch point common, signalled', () => {
    const late = run(uuid(30), A2, [{ x: 60, y: 33 }], { start: 2 })
    const play = scene({ branches: options(2), actions: [late] })
    for (const line of [LINE_A, [P.root, P.optB]]) {
      const compiled = compile(play, line)
      expect(motionOf(compiled, late.id).start).toBe(2)
      expect(compiled.issues).toEqual([
        {
          code: 'startsAfterBranch',
          severity: 'warning',
          target: { kind: 'action', id: late.id, branchId: P.root },
          params: { branchAt: 2 },
        },
      ])
    }
  })

  it('accepts an action of an option exactly at the branch point', () => {
    const onTime = run(uuid(30), A2, [{ x: 60, y: 33 }], { branchId: P.optA, start: 2 })
    expect(compile(scene({ branches: options(2), actions: [onTime] }), LINE_A).issues).toEqual([])
  })

  it('signals a branch point not after the previous one and keeps the options after both (D-158)', () => {
    const nested = [
      branch(P.root, null, { branchAt: 5 }),
      branch(P.optA, P.root, { isDefault: true, branchAt: 3 }),
      branch(P.optB, P.root),
      branch(P.optB1, P.optA, { isDefault: true }),
      branch(P.optB2, P.optA),
    ]
    const leaf = run(uuid(30), A2, [{ x: 60, y: 33 }], { branchId: P.optB1, start: 4 })
    const compiled = compile(scene({ branches: nested, actions: [leaf] }), [
      P.root,
      P.optA,
      P.optB1,
    ])
    expect(issuesOf(compiled, 'branchAtNotIncreasing').map((i) => i.target)).toEqual([
      { kind: 'branch', id: P.optA },
    ])
    expect(compiled.branches.map((b) => [b.start, b.branchAt])).toEqual([
      [0, 5],
      [5, 5],
      [5, null],
    ])
    expect(motionOf(compiled, leaf.id).start).toBe(5)
  })

  it('ignores the actions of the other options and a line that goes wrong', () => {
    const inB = run(uuid(30), A2, [{ x: 60, y: 33 }], { branchId: P.optB, start: 3 })
    const play = scene({ branches: options(2), actions: [inB] })
    expect(compile(play, LINE_A).motions).toEqual([])
    expect(compile(play, [P.root, uuid(4242)]).line).toEqual([P.root])
    expect(compile(play, [P.optA]).line).toEqual([])
  })
})

describe('sequences of a line (SPEC 4.3, D-139, D-155)', () => {
  it('cuts a sequence at the branch point it crosses, signalled', () => {
    const crossing = sequence(uuid(50), 1, 4)
    const compiled = compile(scene({ branches: options(2), sequences: [crossing] }), LINE_A)
    expect(compiled.sequences).toMatchObject([{ id: crossing.id, start: 1, end: 2 }])
    expect(compiled.blocks[crossing.id]).toEqual({ start: 1, end: 2 })
    expect(compiled.issues).toEqual([
      {
        code: 'sequenceCrossesBranch',
        severity: 'warning',
        target: { kind: 'sequence', id: crossing.id, branchId: P.root },
        params: { branchAt: 2 },
      },
    ])
  })

  it('starts a sequence of an option at the branch point, signalled', () => {
    const early = sequence(uuid(50), 1, 4, { branchId: P.optA })
    const compiled = compile(scene({ branches: options(2), sequences: [early] }), LINE_A)
    expect(compiled.sequences).toMatchObject([{ start: 2, end: 4 }])
    expect(issuesOf(compiled, 'startsBeforeBranch')).toHaveLength(1)
    // Entirely before it: nothing is left.
    const gone = sequence(uuid(51), 0.5, 1.5, { branchId: P.optA })
    expect(compile(scene({ branches: options(2), sequences: [gone] }), LINE_A).sequences).toEqual(
      [],
    )
  })

  it('starts the second of two overlapping sequences at the end of the first, signalled', () => {
    const a = sequence(uuid(50), 0, 3)
    const b = sequence(uuid(51), 2, 5)
    const compiled = compile(scene({ sequences: [b, a] }))
    expect(compiled.sequences.map((s) => [s.id, s.start, s.end])).toEqual([
      [a.id, 0, 3],
      [b.id, 3, 5],
    ])
    expect(issuesOf(compiled, 'sequenceOverlap').map((i) => i.target)).toEqual([
      { kind: 'sequence', id: b.id, branchId: P.root },
    ])
  })

  it('drops a sequence entirely covered by the previous one', () => {
    const a = sequence(uuid(50), 0, 5)
    const b = sequence(uuid(51), 1, 2)
    const compiled = compile(scene({ sequences: [a, b] }))
    expect(compiled.sequences.map((s) => s.id)).toEqual([a.id])
    expect(issuesOf(compiled, 'sequenceOverlap')).toHaveLength(1)
    expect(compiled.blocks[b.id]).toBeUndefined()
  })

  it('reads an overlap on each line separately', () => {
    const trunk = sequence(uuid(50), 3, 5)
    const inA = sequence(uuid(51), 4, 6, { branchId: P.optA })
    const play = scene({ branches: options(2), sequences: [trunk, inA] })
    expect(issuesOf(compile(play, LINE_A), 'sequenceOverlap')).toHaveLength(1)
    expect(issuesOf(compile(play, [P.root, P.optB]), 'sequenceOverlap')).toEqual([])
  })

  it('ignores a sequence whose end is not after its start (D-155)', () => {
    const compiled = compile(
      scene({ sequences: [sequence(uuid(50), 3, 3), sequence(uuid(51), 3, 1)] }),
    )
    expect(compiled.sequences).toEqual([])
    expect(compiled.intervals).toEqual([])
  })

  it('gives its typed or computed label and its instruction', () => {
    const typed = sequence(uuid(50), 0, 1, { label: 'Lancement', instruction: 'On fixe' })
    const computed = sequence(uuid(51), 1, 2)
    expect(compile(scene({ sequences: [typed, computed] })).sequences).toMatchObject([
      { label: 'Lancement', instruction: 'On fixe' },
      { label: 'Séquence 2', instruction: '' },
    ])
  })
})
