import { describe, expect, it } from 'vitest'
import {
  P,
  ball,
  basePlay,
  branch,
  breakdown,
  fourVsTwoNoBall,
  friseFixturePlay,
  kick,
  pass,
  player,
  realisticRunsPlay,
  run,
  sequence,
  setPiecesPlay,
  sevenVsSevenWithOptions,
  uuid,
} from '../test/builders'
import type { Issue, IssueCode } from './issues'
import type { Action, Branch, GlueRef, Play, Sequence } from './types'
import { validatePlay } from './validate'

const codes = (play: Play): IssueCode[] => validatePlay(play).map((issue: Issue) => issue.code)
const errors = (play: Play): Issue[] =>
  validatePlay(play).filter((issue) => issue.severity === 'error')

/** Issue codes with their target id. */
const targets = (play: Play): string[] =>
  validatePlay(play).map(
    (issue) => `${issue.code}:${issue.target.kind === 'play' ? '' : issue.target.id}`,
  )

const withActions = (...actions: Action[]): Play => ({
  ...sevenVsSevenWithOptions(),
  actions,
  sequences: [],
})

/** The 7 v 7 scenario, its branch point at 6.335 s, with only these actions and sequences. */
const scene = (actions: Action[], sequences: Sequence[] = []): Play => ({
  ...sevenVsSevenWithOptions(),
  actions,
  sequences,
})

const nestedBranches: Branch[] = [
  branch(P.root, null, { branchAt: 2 }),
  branch(P.optA, P.root, { isDefault: true }),
  branch(P.optB, P.root, { branchAt: 5 }),
  branch(P.optB1, P.optB, { isDefault: true }),
  branch(P.optB2, P.optB),
]

describe('business validation (SPEC 4.3)', () => {
  it('accepts the reference plays', () => {
    expect(validatePlay(sevenVsSevenWithOptions())).toEqual([])
    expect(validatePlay(fourVsTwoNoBall())).toEqual([])
    expect(validatePlay(setPiecesPlay())).toEqual([])
    expect(validatePlay(realisticRunsPlay())).toEqual([])
    expect(validatePlay(friseFixturePlay())).toEqual([])
  })

  it('checks the actors of kicks and breakdowns (lot 3)', () => {
    expect(targets(withActions(kick(uuid(501), P.A(4), { receiverId: P.A(4) }, 0)))).toEqual([
      `kickSelfTarget:${uuid(501)}`,
    ])
    expect(targets(withActions(kick(uuid(501), P.A(4), { receiverId: P.ball }, 0)))).toEqual([
      `actorNotPlayer:${uuid(501)}`,
    ])
    expect(targets(withActions(kick(uuid(501), uuid(77), { point: { x: 1, y: 1 } }, 0)))).toEqual([
      `missingEntity:${uuid(501)}`,
    ])
    expect(targets(withActions(breakdown(uuid(502), P.A(4), P.A(4), P.A(3), 0)))).toEqual([
      `breakdownDuplicate:${uuid(502)}`,
    ])
    expect(targets(withActions(breakdown(uuid(502), P.A(4), P.B(5), P.A(3), 0)))).toEqual([
      `breakdownTeam:${uuid(502)}`,
    ])
    expect(errors(withActions(breakdown(uuid(502), P.A(4), P.A(5), P.A(3), 0)))).toEqual([])
  })

  it('accepts any number of players per team, zero included', () => {
    expect(errors(basePlay())).toEqual([])
    const onlyB = basePlay({
      entities: [player(uuid(1), 'B', 1)],
      setup: { positions: { [uuid(1)]: { x: 1, y: 1 } }, ballCarrierId: null, ballPosition: null },
    })
    expect(errors(onlyB)).toEqual([])
  })

  it('requires unique identifiers in the whole play', () => {
    const play = sevenVsSevenWithOptions()
    expect(codes({ ...play, branches: [...play.branches, branch(P.A(1), P.optA)] })).toContain(
      'duplicateId',
    )
    expect(codes({ ...play, actions: [pass(P.root, P.A(4), P.A(5), 0)] })).toContain('duplicateId')
    expect(codes({ ...play, sequences: [sequence(uuid(200), 0, 1)] })).toContain('duplicateId')
  })

  it('allows at most one ball', () => {
    const play = sevenVsSevenWithOptions()
    expect(codes({ ...play, entities: [...play.entities, ball(uuid(21))] })).toContain(
      'multipleBalls',
    )
  })

  it('requires exactly one root', () => {
    expect(codes(basePlay({ branches: [] }))).toContain('noRoot')
    expect(codes(basePlay({ branches: [branch(uuid(1), null), branch(uuid(2), null)] }))).toContain(
      'multipleRoots',
    )
  })

  it('requires existing parents and no cycle', () => {
    const missing = basePlay({ branches: [branch(uuid(1), null), branch(uuid(2), uuid(3))] })
    expect(codes(missing)).toContain('missingParent')
    const cyclic = basePlay({
      branches: [branch(uuid(1), null), branch(uuid(2), uuid(3)), branch(uuid(3), uuid(2))],
    })
    expect(codes(cyclic)).toContain('cycle')
  })

  it('requires at least two options per branch point, exactly one default', () => {
    const play = sevenVsSevenWithOptions()
    const none = { ...play, branches: play.branches.map((b) => ({ ...b, isDefault: false })) }
    expect(codes(none).filter((c) => c === 'defaultCount')).toHaveLength(2)
    const both = {
      ...play,
      branches: play.branches.map((b) => ({ ...b, isDefault: b.parentId === P.root })),
    }
    expect(codes(both)).toContain('defaultCount')
    const single = { ...play, branches: play.branches.filter((b) => b.id !== P.optB), actions: [] }
    expect(targets({ ...single, sequences: [] })).toEqual([`tooFewOptions:${P.root}`])
  })

  it('requires branchAt if and only if the branch has children', () => {
    const play = scene([])
    const withoutAt = {
      ...play,
      branches: [branch(P.root, null), ...play.branches.slice(1)],
    }
    expect(targets(withoutAt)).toEqual([`branchAtMissing:${P.root}`])
    const gluedOnly = {
      ...play,
      branches: [
        branch(P.root, null, { branchAtGlue: { targetId: uuid(200), event: 'end' } }),
        ...play.branches.slice(1),
      ],
    }
    expect(codes(gluedOnly)).toContain('branchAtMissing')
    expect(targets(basePlay({ branches: [branch(P.root, null, { branchAt: 2 })] }))).toEqual([
      `branchAtUnexpected:${P.root}`,
    ])
    const leafGlue = basePlay({
      branches: [branch(P.root, null, { branchAtGlue: { targetId: uuid(200), event: 'end' } })],
    })
    expect(codes(leafGlue)).toContain('branchAtUnexpected')
  })

  it('requires branchAt strictly increasing along a line', () => {
    const play = basePlay({ branches: nestedBranches })
    expect(validatePlay(play)).toEqual([])
    for (const branchAt of [2, 1]) {
      const decreasing = {
        ...play,
        branches: play.branches.map((b) => (b.id === P.optB ? { ...b, branchAt } : b)),
      }
      expect(targets(decreasing)).toEqual([`branchAtNotIncreasing:${P.optB}`])
    }
  })

  it('leaves the order of a glued branch point to the engine', () => {
    const play = basePlay({ branches: nestedBranches })
    const glued = {
      ...play,
      branches: play.branches.map((b) =>
        b.id === P.optB
          ? { ...b, branchAt: 1, branchAtGlue: { targetId: P.root, event: 'end' as const } }
          : b,
      ),
    }
    expect(codes(glued)).not.toContain('branchAtNotIncreasing')
  })

  it('requires actions to reference existing entities; runs target players only', () => {
    const ghost = withActions(
      run(uuid(500), uuid(777), [{ x: 1, y: 1 }]),
      pass(uuid(501), P.A(4), uuid(778), 0),
    )
    expect(codes(ghost).filter((c) => c === 'missingEntity')).toHaveLength(2)
    expect(codes(withActions(run(uuid(500), P.ball, [{ x: 1, y: 1 }])))).toContain(
      'runTargetNotPlayer',
    )
    expect(codes(withActions(pass(uuid(501), P.ball, P.A(4), 0)))).toContain(
      'passEndpointNotPlayer',
    )
  })

  it('requires actions and sequences to reference an existing branch', () => {
    const play = scene(
      [pass(uuid(501), P.A(4), P.A(5), 0, { branchId: uuid(777) })],
      [sequence(uuid(502), 0, 1, { branchId: uuid(778) })],
    )
    expect(targets(play)).toEqual([`missingBranch:${uuid(501)}`, `missingBranch:${uuid(502)}`])
  })

  it('signals an action of an option that starts before the branch point (D-139)', () => {
    const early = pass(uuid(501), P.A(4), P.A(5), 6, { branchId: P.optA })
    const issues = validatePlay(scene([early]))
    expect(issues).toEqual([
      {
        code: 'startsBeforeBranch',
        severity: 'warning',
        target: { kind: 'action', id: uuid(501), branchId: P.optA },
        params: { branchAt: 6.335 },
      },
    ])
    const atBranchPoint = pass(uuid(501), P.A(4), P.A(5), 6.335, { branchId: P.optA })
    expect(validatePlay(scene([atBranchPoint]))).toEqual([])
  })

  it('signals an action of the trunk that starts at the branch point or after (D-139)', () => {
    const atBranchPoint = pass(uuid(501), P.A(4), P.A(5), 6.335)
    expect(targets(scene([atBranchPoint]))).toEqual([`startsAfterBranch:${uuid(501)}`])
    const after = pass(uuid(501), P.A(4), P.A(5), 7)
    expect(targets(scene([after]))).toEqual([`startsAfterBranch:${uuid(501)}`])
    const before = pass(uuid(501), P.A(4), P.A(5), 6.3)
    expect(validatePlay(scene([before]))).toEqual([])
    // A nested option has both limits.
    const nested = basePlay({
      entities: sevenVsSevenWithOptions().entities,
      setup: sevenVsSevenWithOptions().setup,
      branches: nestedBranches,
    })
    const inOptB = (start: number): Action =>
      pass(uuid(501), P.A(4), P.A(5), start, { branchId: P.optB })
    expect(codes({ ...nested, actions: [inOptB(1)] })).toEqual(['startsBeforeBranch'])
    expect(codes({ ...nested, actions: [inOptB(3)] })).toEqual([])
    expect(codes({ ...nested, actions: [inOptB(5)] })).toEqual(['startsAfterBranch'])
  })

  it('applies the same limits to a sequence, and signals one that crosses a branch point', () => {
    const before = sequence(uuid(501), 6, 7, { branchId: P.optA })
    expect(targets(scene([], [before]))).toEqual([`startsBeforeBranch:${uuid(501)}`])
    const after = sequence(uuid(501), 7, 8)
    expect(targets(scene([], [after]))).toEqual([`startsAfterBranch:${uuid(501)}`])
    const crossing = sequence(uuid(501), 5, 7)
    expect(targets(scene([], [crossing]))).toEqual([`sequenceCrossesBranch:${uuid(501)}`])
    const endingAt = sequence(uuid(501), 5, 6.335)
    expect(validatePlay(scene([], [endingAt]))).toEqual([])
  })

  it('leaves glued edges and glued branch points to the engine, which reads their real instants', () => {
    const glue: GlueRef = { targetId: uuid(502), event: 'end' }
    const target = pass(uuid(502), P.A(4), P.A(5), 1)
    expect(
      validatePlay(
        scene([target, pass(uuid(501), P.A(4), P.A(5), 1, { branchId: P.optA, startGlue: glue })]),
      ),
    ).toEqual([])
    const play = scene([target, pass(uuid(501), P.A(4), P.A(5), 1, { branchId: P.optA })])
    const gluedPoint = {
      ...play,
      branches: play.branches.map((b) =>
        b.id === P.root
          ? { ...b, branchAtGlue: { targetId: uuid(502), event: 'end' as const } }
          : b,
      ),
    }
    expect(validatePlay(gluedPoint)).toEqual([])
    const crossing = sequence(uuid(503), 5, 7, {
      endGlue: { targetId: uuid(502), event: 'end', keep: 'start' },
    })
    expect(validatePlay(scene([target], [crossing]))).toEqual([])
  })

  it('signals the second of two overlapping sequences of a line (D-139)', () => {
    const first = sequence(uuid(501), 0, 3)
    const second = sequence(uuid(502), 2, 4)
    expect(targets(scene([], [first, second]))).toEqual([`sequenceOverlap:${uuid(502)}`])
    // « Second » is about instants, not about the array.
    expect(targets(scene([], [second, first]))).toEqual([`sequenceOverlap:${uuid(502)}`])
    const touching = sequence(uuid(502), 3, 4)
    expect(validatePlay(scene([], [first, touching]))).toEqual([])
  })

  it('does not see an overlap between two options, but between the trunk and an option', () => {
    const inA = sequence(uuid(501), 7, 9, { branchId: P.optA })
    const inB = sequence(uuid(502), 7, 9, { branchId: P.optB })
    expect(validatePlay(scene([], [inA, inB]))).toEqual([])
    const nested = basePlay({ branches: nestedBranches })
    const inB1 = sequence(uuid(503), 6, 8, { branchId: P.optB1 })
    const inB2 = sequence(uuid(504), 6, 8, { branchId: P.optB2 })
    const inB1Too = sequence(uuid(505), 7, 9, { branchId: P.optB1 })
    expect(targets({ ...nested, sequences: [inB1, inB2, inB1Too] })).toEqual([
      `sequenceOverlap:${uuid(505)}`,
    ])
    const inTrunk = sequence(uuid(506), 1, 3)
    const inOption = sequence(uuid(507), 2.5, 4, { branchId: P.optA })
    expect(targets({ ...nested, sequences: [inTrunk, inOption] })).toEqual([
      `sequenceCrossesBranch:${uuid(506)}`,
      `sequenceOverlap:${uuid(507)}`,
    ])
  })

  it('reports an overlap once, even when several lines share it', () => {
    const nested = basePlay({ branches: nestedBranches })
    const first = sequence(uuid(501), 2, 4, { branchId: P.optB })
    const second = sequence(uuid(502), 3, 4.5, { branchId: P.optB })
    expect(targets({ ...nested, sequences: [first, second] })).toEqual([
      `sequenceOverlap:${uuid(502)}`,
    ])
  })

  it('refuses a sequence that ends before it starts (D-155)', () => {
    for (const end of [1, 0.5]) {
      expect(targets(scene([], [sequence(uuid(501), 1, end)]))).toEqual([
        `sequenceEndBeforeStart:${uuid(501)}`,
      ])
    }
    // Its stored end is only a fallback when the edge is glued.
    const glued = sequence(uuid(501), 1, 1, {
      endGlue: { targetId: uuid(502), event: 'end', keep: 'start' },
    })
    expect(validatePlay(scene([pass(uuid(502), P.A(4), P.A(5), 0)], [glued]))).toEqual([])
  })

  describe('glues (SPEC 4.3, 5.8)', () => {
    const passAt = (id: number, extra: Partial<Action> = {}): Action =>
      ({ ...pass(uuid(id), P.A(4), P.A(5), 1), ...extra }) as Action
    const invalid = (play: Play): unknown[] =>
      validatePlay(play).filter(
        (issue) => issue.code === 'glueTargetInvalid' || issue.code === 'glueTargetMissing',
      )

    it('reports each glue of a cycle on its block, the graph being tested with it', () => {
      const issues = validatePlay(
        scene([
          run(uuid(501), P.A(1), [{ x: 1, y: 1 }], {
            endGlue: { targetId: uuid(502), event: 'end', keep: 'duration' },
          }),
          run(uuid(502), P.A(2), [{ x: 2, y: 2 }], {
            endGlue: { targetId: uuid(501), event: 'end', keep: 'duration' },
          }),
        ]),
      ).filter((issue) => issue.code === 'glueCycle')
      expect(issues.map((issue) => issue.target)).toEqual([
        { kind: 'action', id: uuid(501), branchId: P.root },
        { kind: 'action', id: uuid(502), branchId: P.root },
      ])
      expect(issues.map((issue) => issue.key)).toEqual(['end', 'end'])
    })

    it('accepts the glues of the fixture, without any cycle', () => {
      expect(validatePlay(friseFixturePlay()).map((issue) => issue.code)).not.toContain('glueCycle')
    })

    it('accepts every event of a block of the line', () => {
      const target = run(uuid(502), P.A(4), [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ])
      const ruck = breakdown(uuid(503), P.A(1), P.A(2), P.A(3), 1)
      const block = sequence(uuid(504), 1, 2)
      for (const glue of [
        { targetId: target.id, event: 'start' },
        { targetId: target.id, event: 'end' },
        { targetId: target.id, event: { point: 1 } },
        { targetId: ruck.id, event: 'start' },
        { targetId: ruck.id, event: 'end', offset: 2 },
        { targetId: block.id, event: 'start' },
        { targetId: block.id, event: 'end' },
        { targetId: P.root, event: 'end' },
      ] satisfies GlueRef[]) {
        const glued = passAt(501, { branchId: P.optA, start: 7, startGlue: glue })
        expect(invalid(scene([target, ruck, glued], [block]))).toEqual([])
      }
    })

    it('signals a missing target, on the edge concerned', () => {
      const glue = { targetId: uuid(777), event: 'end' } satisfies GlueRef
      const play = scene([passAt(501, { startGlue: glue, endGlue: { ...glue, keep: 'start' } })])
      expect(validatePlay(play)).toEqual([
        {
          code: 'glueTargetMissing',
          severity: 'error',
          target: { kind: 'action', id: uuid(501), branchId: P.root },
          key: 'start',
        },
        {
          code: 'glueTargetMissing',
          severity: 'error',
          target: { kind: 'action', id: uuid(501), branchId: P.root },
          key: 'end',
        },
      ])
    })

    it('refuses a glue to its own block', () => {
      const play = scene([passAt(501, { startGlue: { targetId: uuid(501), event: 'end' } })])
      expect(validatePlay(play)).toMatchObject([
        { code: 'glueTargetInvalid', params: { reason: 'self' }, key: 'start' },
      ])
      const self = sequence(uuid(502), 1, 2, {
        endGlue: { targetId: uuid(502), event: 'start', keep: 'start' },
      })
      expect(validatePlay(scene([], [self]))).toMatchObject([
        { code: 'glueTargetInvalid', params: { reason: 'self' }, key: 'end' },
      ])
    })

    it('refuses a target out of the line: a sibling option, or an option from the trunk', () => {
      const inA = passAt(502, { branchId: P.optA, start: 7 })
      const fromB = passAt(501, {
        branchId: P.optB,
        start: 7,
        startGlue: { targetId: inA.id, event: 'end' },
      })
      expect(invalid(scene([inA, fromB]))).toMatchObject([{ params: { reason: 'line' } }])
      const fromTrunk = passAt(501, { startGlue: { targetId: inA.id, event: 'end' } })
      expect(invalid(scene([inA, fromTrunk]))).toMatchObject([{ params: { reason: 'line' } }])
    })

    it('accepts a target in the branch of the edge or in an ancestor', () => {
      const nested = basePlay({
        entities: sevenVsSevenWithOptions().entities,
        setup: sevenVsSevenWithOptions().setup,
        branches: nestedBranches,
      })
      const inRoot = passAt(502, { start: 1 })
      const inOptB = passAt(503, { branchId: P.optB, start: 3 })
      const glued = (targetId: string): Action =>
        passAt(501, { branchId: P.optB1, start: 6, startGlue: { targetId, event: 'end' } })
      for (const targetId of [inRoot.id, inOptB.id, P.root, P.optB]) {
        expect(invalid({ ...nested, actions: [inRoot, inOptB, glued(targetId)] })).toEqual([])
      }
    })

    it('refuses an event that does not exist for the target', () => {
      const target = pass(uuid(502), P.A(4), P.A(5), 0)
      const pointOnPass = passAt(501, {
        startGlue: { targetId: target.id, event: { point: 0 } },
      })
      expect(invalid(scene([target, pointOnPass]))).toMatchObject([{ params: { reason: 'event' } }])
      const block = sequence(uuid(503), 0, 1)
      const pointOnSequence = passAt(501, {
        startGlue: { targetId: block.id, event: { point: 0 } },
      })
      expect(invalid(scene([pointOnSequence], [block]))).toMatchObject([
        { params: { reason: 'event' } },
      ])
    })

    it('refuses a waypoint that does not exist', () => {
      const target = run(uuid(502), P.A(4), [{ x: 1, y: 1 }])
      const onPoint = (point: number): Action =>
        passAt(501, { startGlue: { targetId: target.id, event: { point } } })
      expect(invalid(scene([target, onPoint(0)]))).toEqual([])
      expect(invalid(scene([target, onPoint(1)]))).toMatchObject([{ params: { reason: 'point' } }])
    })

    it('accepts a branch as a target only if it divides, with the event end', () => {
      const onStart = passAt(501, {
        branchId: P.optA,
        start: 7,
        startGlue: { targetId: P.root, event: 'start' },
      })
      expect(invalid(scene([onStart]))).toMatchObject([{ params: { reason: 'event' } }])
      const onLeaf = passAt(501, {
        branchId: P.optA,
        start: 7,
        startGlue: { targetId: P.optA, event: 'end' },
      })
      expect(invalid(scene([onLeaf]))).toMatchObject([{ params: { reason: 'event' } }])
      const onSibling = passAt(501, {
        branchId: P.optA,
        start: 7,
        startGlue: { targetId: P.optB, event: 'end' },
      })
      expect(invalid(scene([onSibling]))).toMatchObject([{ params: { reason: 'line' } }])
    })

    it('checks the glue of a branch point: the trunk only, never itself', () => {
      const play = scene([pass(uuid(502), P.A(4), P.A(5), 1)])
      const withGlue = (glue: GlueRef): Play => ({
        ...play,
        branches: play.branches.map((b) => (b.id === P.root ? { ...b, branchAtGlue: glue } : b)),
      })
      expect(validatePlay(withGlue({ targetId: uuid(502), event: 'end' }))).toEqual([])
      expect(validatePlay(withGlue({ targetId: P.root, event: 'end' }))).toEqual([
        {
          code: 'glueTargetInvalid',
          severity: 'error',
          target: { kind: 'branch', id: P.root },
          key: 'branchAt',
          params: { reason: 'self' },
        },
      ])
      const inOption = {
        ...play,
        actions: [pass(uuid(502), P.A(4), P.A(5), 7, { branchId: P.optA })],
      }
      expect(
        validatePlay({
          ...inOption,
          branches: inOption.branches.map((b) =>
            b.id === P.root
              ? { ...b, branchAtGlue: { targetId: uuid(502), event: 'end' as const } }
              : b,
          ),
        }),
      ).toMatchObject([{ code: 'glueTargetInvalid', params: { reason: 'line' } }])
    })

    it('checks the glues of a sequence', () => {
      const glue = { targetId: uuid(777), event: 'start' } satisfies GlueRef
      expect(validatePlay(scene([], [sequence(uuid(501), 1, 2, { startGlue: glue })]))).toEqual([
        {
          code: 'glueTargetMissing',
          severity: 'error',
          target: { kind: 'sequence', id: uuid(501), branchId: P.root },
          key: 'start',
        },
      ])
    })
  })

  it('checks the starting ball carrier and the presence of the ball', () => {
    const play = sevenVsSevenWithOptions()
    expect(codes({ ...play, setup: { ...play.setup, ballCarrierId: uuid(777) } })).toContain(
      'ballCarrierMissing',
    )
    const noBall = { ...play, entities: play.entities.filter((e) => e.kind !== 'ball') }
    expect(codes(noBall)).toContain('ballCarrierWithoutBall')
    expect(codes({ ...play, setup: { ...play.setup, ballCarrierId: null } })).toContain(
      'ballNotPlaced',
    )
  })

  it('requires a starting position for every player', () => {
    const play = sevenVsSevenWithOptions()
    const positions = Object.fromEntries(
      Object.entries(play.setup.positions).filter(([id]) => id !== P.A(2)),
    )
    expect(codes({ ...play, setup: { ...play.setup, positions } })).toContain('positionMissing')
  })

  it('warns about duplicate numbers, out-of-range fields and long instructions', () => {
    const play = sevenVsSevenWithOptions()
    const duplicate = {
      ...play,
      entities: play.entities.map((e) =>
        e.id === P.A(2) && e.kind === 'player' ? { ...e, number: 1 } : e,
      ),
    }
    expect(validatePlay(duplicate).find((i) => i.code === 'duplicateNumber')?.severity).toBe(
      'warning',
    )
    const small = { ...play, field: { ...play.field, length: 80 } }
    expect(validatePlay(small).find((i) => i.code === 'fieldOutOfRange')?.severity).toBe('warning')
    const instruct = (length: number): Play => ({
      ...play,
      sequences: play.sequences.map((s) =>
        s.id === uuid(240) ? { ...s, instruction: 'x'.repeat(length) } : s,
      ),
    })
    expect(validatePlay(instruct(61))).toEqual([
      {
        code: 'instructionTooLong',
        severity: 'warning',
        target: { kind: 'sequence', id: uuid(240), branchId: P.optA },
        params: { length: 61, max: 60 },
      },
    ])
    expect(codes(instruct(60))).not.toContain('instructionTooLong')
  })
})
