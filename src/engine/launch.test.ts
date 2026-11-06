import { describe, expect, it } from 'vitest'
import { endDirection } from './spline'
import { defaultSettings, engineSettingsOf, type EngineSettings } from '../model/settings'
import type { Action, GlueRef, Id, Play, RunAction } from '../model/types'
import { P, ball, basePlay, branch, breakdown, player, run, uuid } from '../test/builders'
import { straightRun, PROFILE_TOLERANCE } from '../test/profileMath'
import { createCaches } from './caches'
import { evaluate } from './evaluate'
import { motionEnd, motionSpeed, motionVelocity, type RunMotion } from './motion'
import { compileLine, type CompiledLine } from './timeline'

const settings: EngineSettings = engineSettingsOf(defaultSettings())
const { motion: motionSettings } = settings
const { sprint } = settings.paces
const A1 = uuid(1)
const A2 = uuid(2)
const A3 = uuid(3)
const ROOT = [P.root]
const LINE_A = [P.root, P.optA]
const LINE_B = [P.root, P.optB]

function play(actions: Action[], extra: Partial<Play> = {}): Play {
  return basePlay({
    entities: [player(A1, 'A', 1), player(A2, 'A', 2), player(A3, 'A', 3), ball(uuid(90))],
    setup: {
      positions: { [A1]: { x: 40, y: 30 }, [A2]: { x: 40, y: 20 }, [A3]: { x: 40, y: 10 } },
      ballCarrierId: A1,
      ballPosition: null,
    },
    actions,
    ...extra,
  })
}

const twoOptions = (branchAt: number, branchAtGlue?: GlueRef): Partial<Play> => ({
  branches: [
    branch(P.root, null, { branchAt, ...(branchAtGlue ? { branchAtGlue } : {}) }),
    branch(P.optA, P.root, { isDefault: true }),
    branch(P.optB, P.root),
  ],
})

const compile = (p: Play, line: Id[] = ROOT): CompiledLine =>
  compileLine(p, line, settings, createCaches())

function motionOf(compiled: CompiledLine, id: Id): RunMotion {
  const found = compiled.motions.find((m) => m.source === 'run' && m.actionId === id)
  if (!found) throw new Error(`no motion ${id}`)
  return found
}

const codes = (compiled: CompiledLine) => compiled.issues.map((i) => i.code)
const glued = (targetId: Id, offset?: number): GlueRef => ({
  targetId,
  event: 'end',
  ...(offset === undefined ? {} : { offset }),
})

const FIRST = uuid(30)
const NEXT = uuid(31)
const first: RunAction = run(FIRST, A1, [{ x: 60, y: 30 }], { pace: 'sprint' })
const next = (extra: Partial<RunAction> = {}): RunAction =>
  run(NEXT, A1, [{ x: 70, y: 40 }], { pace: 'sprint', start: 3, startGlue: glued(FIRST), ...extra })

describe('run ending at speed (SPEC 5.2)', () => {
  it('ends at speed and goes on at that speed, in its arrival direction, glued without gap', () => {
    const compiled = compile(play([first, next()]))
    const a = motionOf(compiled, FIRST)
    const b = motionOf(compiled, NEXT)
    expect(a.endsAtSpeed).toBe(true)
    expect(
      Math.abs(a.duration - straightRun(20, 5.5, motionSettings, sprint, 0, 5.5)),
    ).toBeLessThan(PROFILE_TOLERANCE)
    const junction = motionEnd(a)
    expect(b.start).toBeCloseTo(junction, 12)
    expect(motionSpeed(a, junction - 1e-9)).toBeCloseTo(5.5, 6)
    expect(motionSpeed(b, junction)).toBeCloseTo(5.5, 6)
    // Same velocity on both sides: speed, and direction (tangent junction) up to the chord of one
    // sample interval.
    const before = motionVelocity(a, junction - 1e-6)
    const after = motionVelocity(b, junction + 1e-6)
    const angle = Math.atan2(after.y, after.x) - Math.atan2(before.y, before.x)
    expect(Math.abs(angle)).toBeLessThan(0.05)
    // Without the junction, the run would turn 45° at once.
    expect(Math.atan2(before.y, before.x)).toBeCloseTo(0, 9)
    expect(b.launch).not.toBeNull()
    expect(b.spline.startDirection).toEqual(endDirection(a.spline))
    // Its waypoints are those drawn; the run before does not change (SPEC 5.2).
    expect(b.waypoints).toEqual([{ x: 70, y: 40 }])
    // Its start speed wins over the braking into the turn: the braking alert tells (D-132).
    expect(codes(compiled)).toEqual(['runBrakeTooHigh'])
  })

  it('does not depend on the next run: only its first flag, read in the model', () => {
    const shape = (x: number) =>
      motionOf(compile(play([first, next({ waypoints: [{ x, y: 40 }] })])), FIRST)
    expect(shape(70).profile).toEqual(shape(90).profile)
  })

  it('brakes to a stop when the next run has a gap: it is a wait', () => {
    const compiled = compile(play([first, next({ startGlue: glued(FIRST, 0.5) })]))
    const a = motionOf(compiled, FIRST)
    const b = motionOf(compiled, NEXT)
    expect(a.endsAtSpeed).toBe(false)
    expect(Math.abs(a.duration - straightRun(20, 5.5, motionSettings, sprint))).toBeLessThan(
      PROFILE_TOLERANCE,
    )
    expect(motionSpeed(a, motionEnd(a))).toBe(0)
    expect(b.launch).toBeNull()
    expect(b.start).toBeCloseTo(motionEnd(a) + 0.5, 12)
    expect(codes(compiled)).toEqual([])
  })

  it('brakes to a stop without a next run glued to its end', () => {
    const compiled = compile(play([first, run(NEXT, A1, [{ x: 70, y: 40 }], { start: 9 })]))
    expect(motionOf(compiled, FIRST).endsAtSpeed).toBe(false)
    expect(motionOf(compiled, NEXT).launch).toBeNull()
  })

  it('is not prolonged by a run of another player glued to its end', () => {
    const compiled = compile(
      play([first, run(NEXT, A2, [{ x: 70, y: 40 }], { startGlue: glued(FIRST) })]),
    )
    expect(motionOf(compiled, FIRST).endsAtSpeed).toBe(false)
    expect(motionOf(compiled, NEXT).launch).toBeNull()
  })

  it('does not prolong a run when the next one, too far, left at its bound without its glue', () => {
    // The next run has only its right edge glued: it starts at its bound, sped up, from rest.
    const target = run(uuid(40), A2, [{ x: 55, y: 20 }], { start: 2 })
    const compiled = compile(
      play([
        first,
        target,
        run(NEXT, A1, [{ x: 90, y: 40 }], {
          pace: 'sprint',
          start: 3,
          endGlue: { targetId: uuid(40), event: 'end', keep: 'duration' },
        }),
      ]),
    )
    const a = motionOf(compiled, FIRST)
    const b = motionOf(compiled, NEXT)
    expect(a.endsAtSpeed).toBe(false)
    expect(b.launch).toBeNull()
    expect(b.start).toBeCloseTo(motionEnd(a), 12)
    expect(motionEnd(b)).toBeCloseTo(motionEnd(motionOf(compiled, uuid(40))), 9)
    expect(codes(compiled)).toContain('glueStartedLate')
  })

  it('keeps its start speed when the next run is sped up, both edges glued (D-130)', () => {
    const target = run(uuid(40), A2, [{ x: 75, y: 20 }])
    const compiled = compile(
      play([
        first,
        target,
        next({ endGlue: { targetId: uuid(40), event: 'end', keep: 'duration' } }),
      ]),
    )
    const a = motionOf(compiled, FIRST)
    const b = motionOf(compiled, NEXT)
    expect(b.launch).not.toBeNull()
    expect(b.start).toBeCloseTo(motionEnd(a), 12)
    expect(motionEnd(b)).toBeCloseTo(motionEnd(motionOf(compiled, uuid(40))), 9)
    expect(motionSpeed(b, b.start)).toBeCloseTo(5.5, 9)
  })

  it('keeps its start speed under an imposed duration beyond the bounds (D-130)', () => {
    const compiled = compile(play([first, next({ durationOverride: 1 })]))
    const b = motionOf(compiled, NEXT)
    expect(b.launch).not.toBeNull()
    expect(b.duration).toBeCloseTo(1, 9)
    expect(b.accelFactor).toBeGreaterThan(1)
    expect(motionSpeed(b, b.start)).toBeCloseTo(5.5, 9)
  })

  it('is never at speed when a breakdown stops it, recompiled with a normal braking', () => {
    const compiled = compile(play([first, next(), breakdown(uuid(50), A1, A2, A3, 2)]))
    const a = motionOf(compiled, FIRST)
    const b = motionOf(compiled, NEXT)
    expect(a.until).toBe(2)
    expect(a.endsAtSpeed).toBe(false)
    expect(b.launch).toBeNull()
    // From rest, at the ball out: the second run waits with its alert.
    expect(b.start).toBeCloseTo(compiled.breakdowns[0]?.end ?? NaN, 12)
    expect(motionSpeed(b, b.start)).toBe(0)
    expect(codes(compiled)).toContain('runCutByBreakdown')
    expect(codes(compiled)).toContain('runStartDelayed')
    expect(codes(compiled)).not.toContain('runNotContinued')
  })
})

describe('run of the trunk and its options (SPEC 5.2, D-139 Q1)', () => {
  const inOption = (branchId: Id, extra: Partial<RunAction> = {}): RunAction =>
    next({ branchId, ...extra })

  it('stops short in an option that does not prolong it, with a warning naming it', () => {
    const p = play(
      [
        first,
        inOption(P.optA),
        run(uuid(32), A1, [{ x: 70, y: 40 }], { branchId: P.optB, start: 5 }),
      ],
      twoOptions(1),
    )
    const prolonged = compile(p, LINE_A)
    const stopped = compile(p, LINE_B)
    expect(codes(prolonged)).toEqual(['runBrakeTooHigh'])
    expect(stopped.issues).toEqual([
      {
        code: 'runNotContinued',
        severity: 'warning',
        target: { kind: 'action', id: FIRST, branchId: P.root },
        params: { option: 'Option B' },
        key: P.optB,
      },
    ])
    // Ending at speed in both lines, the same run; option B starts from rest.
    const a = motionOf(prolonged, FIRST)
    expect(motionOf(stopped, FIRST)).toEqual(a)
    expect(a.endsAtSpeed).toBe(true)
    expect(motionOf(stopped, uuid(32)).launch).toBeNull()
    for (let t = 0; t < 1 - 1e-9; t += 0.05) {
      const at = (line: Id[]) => evaluate(p, line, t, settings, createCaches()).players
      expect(at(LINE_A)).toEqual(at(LINE_B))
    }
  })

  it('brakes once, and for good, when the next run really starts at the branch point after its end', () => {
    // Its end at speed is near 4.7 s; the branch point is at 8 s.
    const p = play([first, inOption(P.optA)], twoOptions(8))
    const c = compile(p, LINE_A)
    const a = motionOf(c, FIRST)
    const b = motionOf(c, NEXT)
    expect(a.endsAtSpeed).toBe(false)
    expect(motionSpeed(a, motionEnd(a))).toBe(0)
    expect(b.start).toBe(8)
    expect(b.launch).toBeNull()
    expect(codes(c)).toEqual(['startsBeforeBranch'])
    expect(codes(compile(p, LINE_B))).toEqual([])
  })

  it('never goes back to speed when its braking makes it end after the branch point', () => {
    const atSpeed = motionEnd(motionOf(compile(play([first, next()])), FIRST))
    const braking = motionEnd(motionOf(compile(play([first])), FIRST))
    expect(braking).toBeGreaterThan(atSpeed)
    const p = play([first, inOption(P.optA)], twoOptions((atSpeed + braking) / 2))
    const c = compile(p, LINE_A)
    const a = motionOf(c, FIRST)
    expect(a.endsAtSpeed).toBe(false)
    expect(motionEnd(a)).toBeCloseTo(braking, 9)
    expect(motionOf(c, NEXT).launch).toBeNull()
    expect(motionOf(c, NEXT).start).toBeCloseTo(braking, 9)
  })

  it('goes on at speed across the branch point when it ends after it', () => {
    const p = play([first, inOption(P.optA)], twoOptions(1))
    const c = compile(p, LINE_A)
    expect(motionOf(c, NEXT).launch).not.toBeNull()
    expect(codes(c)).toEqual(['runBrakeTooHigh'])
  })

  it('follows the branch point glued to its end: the option prolongs it', () => {
    const p = play([first, inOption(P.optA)], twoOptions(0.5, glued(FIRST)))
    const c = compile(p, LINE_A)
    const a = motionOf(c, FIRST)
    expect(c.branches[0]?.branchAt).toBeCloseTo(motionEnd(a), 12)
    expect(a.endsAtSpeed).toBe(true)
    expect(motionOf(c, NEXT).launch).not.toBeNull()
    expect(codes(compile(p, LINE_B))).toEqual(['runNotContinued'])
  })

  it('names the first option of the line away from the runs that prolong it', () => {
    const p = play(
      [
        first,
        inOption(P.optB1),
        // Option B1 starts at 2 s, after the run ends at speed: it does not prolong it.
        inOption(P.optA, { id: uuid(33), start: 3 }),
      ],
      {
        branches: [
          branch(P.root, null, { branchAt: 1 }),
          branch(P.optA, P.root, { isDefault: true }),
          branch(P.optB, P.root, { branchAt: 8 }),
          branch(P.optB1, P.optB, { isDefault: true }),
          branch(P.optB2, P.optB),
        ],
      },
    )
    const a = motionOf(compile(p, LINE_A), FIRST)
    expect(a.endsAtSpeed).toBe(true)
    const nested = compile(p, [P.root, P.optB, P.optB1])
    expect(motionOf(nested, FIRST)).toEqual(a)
    expect(motionOf(nested, NEXT).launch).toBeNull()
    expect(nested.issues.find((i) => i.code === 'runNotContinued')?.params).toEqual({
      option: 'Option B',
    })
  })

  it('stops short without warning on a path that ends before the options', () => {
    const p = play([first, inOption(P.optA)], twoOptions(1))
    expect(codes(compile(p, ROOT))).toEqual([])
    expect(motionOf(compile(p, ROOT), FIRST).endsAtSpeed).toBe(true)
  })
})
