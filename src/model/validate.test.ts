import { describe, expect, it } from 'vitest'
import {
  P,
  ball,
  basePlay,
  breakdown,
  fourVsTwoNoBall,
  kick,
  pass,
  phase,
  player,
  run,
  setPiecesPlay,
  sevenVsSevenWithOptions,
  uuid,
} from '../test/builders'
import type { Issue, IssueCode } from './issues'
import type { Action, Play } from './types'
import { validatePlay } from './validate'

const codes = (play: Play): IssueCode[] => validatePlay(play).map((issue: Issue) => issue.code)
const errors = (play: Play): Issue[] =>
  validatePlay(play).filter((issue) => issue.severity === 'error')

describe('business validation (SPEC 4.3)', () => {
  it('accepts the reference plays', () => {
    expect(validatePlay(sevenVsSevenWithOptions())).toEqual([])
    expect(validatePlay(fourVsTwoNoBall())).toEqual([])
    expect(validatePlay(setPiecesPlay())).toEqual([])
  })

  it('checks the actors of kicks and breakdowns (lot 3)', () => {
    const withActions = (...actions: Action[]): Play => {
      const play = sevenVsSevenWithOptions()
      return { ...play, phases: [phase(P.t1, null, actions)] }
    }
    const target = (play: Play): string[] =>
      validatePlay(play).map((i) => `${i.code}:${i.target.kind === 'action' ? i.target.id : ''}`)
    expect(target(withActions(kick(uuid(501), P.A(4), { receiverId: P.A(4) }, 0)))).toEqual([
      `kickSelfTarget:${uuid(501)}`,
    ])
    expect(target(withActions(kick(uuid(501), P.A(4), { receiverId: P.ball }, 0)))).toEqual([
      `actorNotPlayer:${uuid(501)}`,
    ])
    expect(target(withActions(kick(uuid(501), uuid(77), { point: { x: 1, y: 1 } }, 0)))).toEqual([
      `missingEntity:${uuid(501)}`,
    ])
    expect(target(withActions(breakdown(uuid(502), P.A(4), P.A(4), P.A(3), 0)))).toEqual([
      `breakdownDuplicate:${uuid(502)}`,
    ])
    expect(target(withActions(breakdown(uuid(502), P.A(4), P.B(5), P.A(3), 0)))).toEqual([
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
    const duplicated = { ...play, phases: [...play.phases, phase(P.A(1), P.t2, [])] }
    expect(codes(duplicated)).toContain('duplicateId')
  })

  it('allows at most one ball', () => {
    const play = sevenVsSevenWithOptions()
    expect(codes({ ...play, entities: [...play.entities, ball(uuid(21))] })).toContain(
      'multipleBalls',
    )
  })

  it('requires exactly one root', () => {
    expect(codes(basePlay({ phases: [] }))).toContain('noRoot')
    expect(
      codes(basePlay({ phases: [phase(uuid(1), null, []), phase(uuid(2), null, [])] })),
    ).toContain('multipleRoots')
  })

  it('requires existing parents and no cycle', () => {
    const missing = basePlay({ phases: [phase(uuid(1), null, []), phase(uuid(2), uuid(3), [])] })
    expect(codes(missing)).toContain('missingParent')
    const cyclic = basePlay({
      phases: [phase(uuid(1), null, []), phase(uuid(2), uuid(3), []), phase(uuid(3), uuid(2), [])],
    })
    expect(codes(cyclic)).toContain('cycle')
  })

  it('requires exactly one default among at least two siblings', () => {
    const play = sevenVsSevenWithOptions()
    const none = { ...play, phases: play.phases.map((p) => ({ ...p, isDefault: false })) }
    expect(codes(none).filter((c) => c === 'defaultCount')).toHaveLength(2)
    const both = {
      ...play,
      phases: play.phases.map((p) => ({ ...p, isDefault: p.parentId === P.t2 })),
    }
    expect(codes(both)).toContain('defaultCount')
    // A single child needs no default.
    const single = {
      ...play,
      phases: play.phases.filter((p) => p.id !== P.t3b).map((p) => ({ ...p, isDefault: false })),
    }
    expect(codes(single)).not.toContain('defaultCount')
  })

  it('requires actions to reference existing entities; runs target players only', () => {
    const play = sevenVsSevenWithOptions()
    const ghost = basePlay({
      ...play,
      phases: [
        phase(P.t1, null, [
          run(uuid(500), uuid(777), [{ x: 1, y: 1 }]),
          pass(uuid(501), P.A(4), uuid(778), 0),
        ]),
      ],
    })
    expect(codes(ghost).filter((c) => c === 'missingEntity')).toHaveLength(2)
    const ballRun = basePlay({
      ...play,
      phases: [phase(P.t1, null, [run(uuid(500), P.ball, [{ x: 1, y: 1 }])])],
    })
    expect(codes(ballRun)).toContain('runTargetNotPlayer')
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
    const long = {
      ...play,
      phases: play.phases.map((p) => (p.id === P.t1 ? { ...p, instruction: 'x'.repeat(61) } : p)),
    }
    expect(validatePlay(long).find((i) => i.code === 'instructionTooLong')?.params).toEqual({
      length: 61,
      max: 60,
    })
    const exact = {
      ...play,
      phases: play.phases.map((p) => (p.id === P.t1 ? { ...p, instruction: 'x'.repeat(60) } : p)),
    }
    expect(codes(exact)).not.toContain('instructionTooLong')
  })
})
