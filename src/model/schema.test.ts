import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { canonicalJson } from './canonical'
import {
  accelPlay,
  basePlay,
  branch,
  breakdown,
  fourVsTwoNoBall,
  friseFixturePlay,
  kick,
  P,
  pass,
  realisticRunsPlay,
  ROOT_BRANCH,
  run,
  sequence,
  setPiecesPlay,
  setPiecesScene,
  sevenVsSevenWithOptions,
  speedsPlay,
  uuid,
} from '../test/builders'
import { playSchemaV5 } from './schema'
import type { GlueRef, Timed } from './types'

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url), 'utf8'))

const withActions = (actions: unknown[]): unknown => ({ ...basePlay(), actions })
const withSequences = (sequences: unknown[]): unknown => ({ ...basePlay(), sequences })
const withBranches = (branches: unknown[]): unknown => ({ ...basePlay(), branches })

const accepted = (play: unknown): boolean => playSchemaV5.safeParse(play).success

describe('schema v5', () => {
  it('accepts valid plays, kicks, breakdowns, glues, branches and sequences included', () => {
    for (const play of [
      basePlay(),
      sevenVsSevenWithOptions(),
      fourVsTwoNoBall(),
      setPiecesPlay(),
      setPiecesScene(),
      realisticRunsPlay(),
      friseFixturePlay(),
      speedsPlay(),
      accelPlay(),
    ]) {
      expect(accepted(play)).toBe(true)
    }
  })

  it('accepts the frozen v5 fixture, identical to the builder', () => {
    const data = fixture('play-v5-frise.json')
    expect(accepted(data)).toBe(true)
    expect(canonicalJson(data)).toBe(canonicalJson(friseFixturePlay()))
  })

  it('covers in the fixture every event, every edge and both `keep`', () => {
    const play = friseFixturePlay()
    const kindOf = (id: string): string => {
      if (play.branches.some((b) => b.id === id)) return 'branch'
      if (play.sequences.some((s) => s.id === id)) return 'sequence'
      return play.actions.find((a) => a.id === id)?.type ?? 'missing'
    }
    const events = new Set<string>()
    const edges = new Set<string>()
    const keeps = new Set<string>()
    const visit = (edge: string, glue: GlueRef | undefined): void => {
      if (!glue) return
      edges.add(edge)
      const event = typeof glue.event === 'string' ? glue.event : 'point'
      events.add(`${kindOf(glue.targetId)}:${event}`)
    }
    const visitBlock = (kind: string, block: Timed): void => {
      visit(`${kind}:start`, block.startGlue)
      visit(`${kind}:end`, block.endGlue)
      if (block.endGlue) keeps.add(block.endGlue.keep)
    }
    for (const action of play.actions) visitBlock(action.type, action)
    for (const block of play.sequences) visitBlock('sequence', block)
    for (const b of play.branches) visit('branch:branchAt', b.branchAtGlue)
    expect([...events].sort()).toEqual(
      [
        'branch:end',
        'breakdown:end',
        'breakdown:start',
        'kick:end',
        'kick:start',
        'pass:end',
        'pass:start',
        'run:end',
        'run:point',
        'run:start',
        'sequence:end',
        'sequence:start',
      ].sort(),
    )
    expect([...edges].sort()).toEqual(
      [
        'branch:branchAt',
        'breakdown:end',
        'breakdown:start',
        'kick:end',
        'kick:start',
        'pass:end',
        'pass:start',
        'run:end',
        'run:start',
        'sequence:end',
        'sequence:start',
      ].sort(),
    )
    expect([...keeps].sort()).toEqual(['duration', 'start'])
  })

  it('keeps the realistic runs at 18 actions: the 16 of v4, plus two cut rendez-vous', () => {
    expect(realisticRunsPlay().actions).toHaveLength(18)
  })

  it('accepts a typed run pace in m/s and rejects a null, negative or unknown one (D-133)', () => {
    const plain = run(uuid(1), P.A(1), [{ x: 1, y: 1 }])
    expect(accepted(withActions([{ ...plain, pace: 4.5 }]))).toBe(true)
    for (const pace of [0, -2, Infinity, 'gallop', '4.5']) {
      expect(accepted(withActions([{ ...plain, pace }]))).toBe(false)
    }
  })

  it('accepts segment speeds and rejects malformed ones (D-114)', () => {
    const plain = run(uuid(1), P.A(1), [
      { x: 1, y: 1, speed: 'walk' },
      { x: 2, y: 2, speed: 6.5 },
    ])
    expect(accepted(withActions([plain]))).toBe(true)
    for (const waypoints of [
      [{ x: 1, y: 1, speed: 0 }],
      [{ x: 1, y: 1, speed: 'gallop' }],
      [{ x: 1, y: 1, pace: 'walk' }],
      [],
    ]) {
      expect(accepted(withActions([{ ...plain, waypoints }]))).toBe(false)
    }
  })

  it('accepts a glue on every event, with an offset, on both edges (SPEC 4.1)', () => {
    const plain = run(uuid(1), P.A(1), [{ x: 1, y: 1 }])
    for (const event of ['start', 'end', { point: 0 }, { point: 3 }]) {
      const glue = { targetId: uuid(2), event, offset: 0.4 }
      expect(accepted(withActions([{ ...plain, startGlue: glue }]))).toBe(true)
      for (const keep of ['start', 'duration']) {
        expect(accepted(withActions([{ ...plain, endGlue: { ...glue, keep } }]))).toBe(true)
      }
    }
  })

  it('rejects malformed glues', () => {
    const plain = run(uuid(1), P.A(1), [{ x: 1, y: 1 }])
    const glue = { targetId: uuid(2), event: 'end' }
    const startGlues: unknown[] = [
      { targetId: uuid(2) },
      { event: 'end' },
      { ...glue, targetId: 'cible' },
      { ...glue, event: 'middle' },
      { ...glue, event: { point: -1 } },
      { ...glue, event: { point: 0.5 } },
      { ...glue, event: { point: 0, extra: 1 } },
      { ...glue, event: {} },
      { ...glue, offset: -0.1 },
      { ...glue, keep: 'start' },
    ]
    for (const startGlue of startGlues) {
      expect(accepted(withActions([{ ...plain, startGlue }]))).toBe(false)
    }
    for (const endGlue of [glue, { ...glue, keep: 'both' }, { ...glue, keep: 'start', extra: 1 }]) {
      expect(accepted(withActions([{ ...plain, endGlue }]))).toBe(false)
    }
  })

  it('rejects a negative instant on an action, a sequence and a branch point', () => {
    expect(accepted(withActions([run(uuid(1), P.A(1), [{ x: 1, y: 1 }], { start: -1 })]))).toBe(
      false,
    )
    expect(accepted(withActions([pass(uuid(1), P.A(1), P.A(2), -0.5)]))).toBe(false)
    expect(accepted(withSequences([sequence(uuid(1), -1, 2)]))).toBe(false)
    expect(accepted(withSequences([sequence(uuid(1), 0, -2)]))).toBe(false)
    expect(accepted(withBranches([branch(ROOT_BRANCH, null, { branchAt: -1 })]))).toBe(false)
  })

  it('requires a branch and an instant on every action and sequence', () => {
    const { branchId: _branch, ...withoutBranch } = run(uuid(1), P.A(1), [{ x: 1, y: 1 }])
    const { start: _start, ...withoutStart } = pass(uuid(2), P.A(1), P.A(2), 0)
    expect(accepted(withActions([withoutBranch]))).toBe(false)
    expect(accepted(withActions([withoutStart]))).toBe(false)
    const { end: _end, ...withoutEnd } = sequence(uuid(3), 0, 1)
    expect(accepted(withSequences([withoutEnd]))).toBe(false)
  })

  it('rejects a glue of the wrong kind on a branch point', () => {
    const root = branch(ROOT_BRANCH, null, { branchAt: 1 })
    const glue = { targetId: uuid(2), event: 'end' }
    expect(accepted(withBranches([{ ...root, branchAtGlue: glue }]))).toBe(true)
    expect(accepted(withBranches([{ ...root, branchAtGlue: { ...glue, keep: 'start' } }]))).toBe(
      false,
    )
  })

  it('rejects the fields of version 4 (D-139)', () => {
    const plain = run(uuid(1), P.A(1), [{ x: 1, y: 1 }])
    const invalid: unknown[] = [
      { ...plain, delay: 0 },
      { ...plain, endsAtSpeed: true },
      { ...plain, sync: { target: { actionId: uuid(2), event: 'runEnd' }, adjust: 'delay' } },
      { ...pass(uuid(3), P.A(1), P.A(2), 0), release: 'onReceipt' },
      { ...kick(uuid(4), P.A(1), { point: { x: 1, y: 1 } }, 0), delay: 0 },
    ]
    for (const action of invalid) expect(accepted(withActions([action]))).toBe(false)
    expect(accepted({ ...basePlay(), phases: [] })).toBe(false)
    expect(accepted(withBranches([{ ...branch(ROOT_BRANCH, null), instruction: '' }]))).toBe(false)
    expect(accepted(withBranches([{ ...branch(ROOT_BRANCH, null), actions: [] }]))).toBe(false)
  })

  it('reports the path of an error', () => {
    const play = sevenVsSevenWithOptions()
    const result = playSchemaV5.safeParse({
      ...play,
      actions: [{ ...play.actions[0], pace: 'gallop' }],
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path.join('.')).toBe('actions.0.pace')
  })

  it('rejects unknown keys (DECISIONS Q24)', () => {
    expect(accepted({ ...basePlay(), extra: true })).toBe(false)
    const ruck = { ...breakdown(uuid(1), P.A(1), P.A(2), P.A(3), 0), tacklerId: P.B(1) }
    expect(accepted(withActions([ruck]))).toBe(false)
    expect(accepted(withSequences([{ ...sequence(uuid(2), 0, 1), color: '#ffffff' }]))).toBe(false)
  })

  it('rejects malformed kicks and breakdowns', () => {
    const toReceiver = kick(uuid(1), P.A(1), { receiverId: P.A(2) }, 0)
    const ruck = breakdown(uuid(2), P.A(1), P.A(2), P.A(3), 0)
    const invalid: unknown[] = [
      { ...toReceiver, target: { receiverId: P.A(2), point: { x: 1, y: 1 } } },
      { ...toReceiver, target: {} },
      { ...toReceiver, flightTime: 0 },
      { ...toReceiver, kind: 'grubber' },
      { ...ruck, duration: 0 },
      { ...ruck, contest: 'tackler' },
    ]
    for (const action of invalid) expect(accepted(withActions([action]))).toBe(false)
  })

  it('rejects types of lots 4 and 5 (DECISIONS Q4)', () => {
    const groupRun = {
      id: uuid(1),
      branchId: ROOT_BRANCH,
      start: 0,
      type: 'groupRun',
      entityIds: [uuid(2)],
      waypoints: [{ x: 1, y: 1 }],
      pace: 'jog',
    }
    expect(accepted(withActions([groupRun]))).toBe(false)
    const play = basePlay()
    expect(accepted({ ...play, defenseSettings: { system: '7' } })).toBe(false)
    const cone = {
      id: uuid(3),
      kind: 'equipment',
      type: 'cone',
      color: '#ffffff',
      position: { x: 0, y: 0 },
    }
    expect(accepted({ ...play, entities: [cone] })).toBe(false)
  })

  it('rejects non-UUID identifiers and infinite numbers', () => {
    expect(accepted({ ...basePlay(), id: 'a/b' })).toBe(false)
    const field = { length: Infinity, width: 70, inGoal: 10, view: { kind: 'full' } }
    expect(accepted({ ...basePlay(), field })).toBe(false)
    expect(accepted(withSequences([sequence(uuid(1), 0, Infinity)]))).toBe(false)
  })
})
