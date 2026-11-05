import { describe, expect, it } from 'vitest'
import { distance } from '../../engine/vec'
import { defaultSettings, engineSettingsOf, type EngineSettings } from '../../model/settings'
import type { Action, EndGlue, GlueRef, Id, Play, Sequence } from '../model/types'
import { validatePlay } from '../model/validate'
import {
  P,
  ball,
  basePlay,
  branch,
  breakdown,
  kick,
  pass,
  player,
  run,
  sequence,
  uuid,
} from '../test/builders'
import { createCaches } from './caches'
import { motionEnd, motionPosition, motionSpeed, waypointTime, type RunMotion } from './motion'
import { compileLine, type CompiledLine } from './timeline'

const settings: EngineSettings = engineSettingsOf(defaultSettings())
const A = (n: number): Id => uuid(n)
const ROOT = [P.root]
const LINE_A = [P.root, P.optA]
const LINE_B = [P.root, P.optB]

/** A1 carries the ball at (40, 30); A2 to A5 line up every 5 m towards y = 10. */
function play(actions: Action[], extra: Partial<Play> = {}): Play {
  const positions: Record<Id, { x: number; y: number }> = {}
  for (let n = 1; n <= 5; n++) positions[A(n)] = { x: 40, y: 35 - 5 * n }
  return basePlay({
    entities: [...[1, 2, 3, 4, 5].map((n) => player(A(n), 'A', n)), ball(uuid(90))],
    setup: { positions, ballCarrierId: A(1), ballPosition: null },
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

function motion(compiled: CompiledLine, id: Id): RunMotion {
  const found = compiled.motions.find((m) => m.source === 'run' && m.actionId === id)
  if (!found) throw new Error(`no motion ${id}`)
  return found
}

const codes = (compiled: CompiledLine) => compiled.issues.map((i) => i.code)
const issueOf = (compiled: CompiledLine, code: string) =>
  compiled.issues.find((i) => i.code === code)
const glueOf = (compiled: CompiledLine, id: Id, kind: 'start' | 'end' | 'branchAt' = 'end') =>
  compiled.glues.find((g) => g.ownerId === id && g.kind === kind)

const onEnd = (targetId: Id, extra: Partial<GlueRef> = {}): GlueRef => ({
  targetId,
  event: 'end',
  ...extra,
})
const slides = (targetId: Id, extra: Partial<EndGlue> = {}): EndGlue => ({
  targetId,
  event: 'end',
  keep: 'duration',
  ...extra,
})
const stretches = (targetId: Id, extra: Partial<EndGlue> = {}): EndGlue => ({
  targetId,
  event: 'end',
  keep: 'start',
  ...extra,
})

describe('right edge, the block slides (SPEC 5.8, keep: duration)', () => {
  it('ends with the target, its start follows, its stored start is a last value', () => {
    const p = play([
      run(uuid(10), A(1), [{ x: 70, y: 30 }], { pace: 'sprint' }),
      run(uuid(11), A(2), [{ x: 50, y: 25 }], { start: 7, endGlue: slides(uuid(10)) }),
    ])
    const c = compile(p)
    const target = motion(c, uuid(10))
    const glued = motion(c, uuid(11))
    expect(motionEnd(glued)).toBeCloseTo(motionEnd(target), 9)
    expect(glued.start).toBeCloseTo(motionEnd(target) - glued.duration, 9)
    expect(glued.factor).toBe(1)
    expect(glueOf(c, uuid(11))).toMatchObject({
      status: 'ok',
      targetId: uuid(10),
      from: { x: 50, y: 25 },
      to: { x: 70, y: 30 },
    })
    expect(glueOf(c, uuid(11))?.targetT).toBeCloseTo(motionEnd(target), 12)
    expect(codes(c)).toEqual([])
  })

  it('ends on a waypoint of the target', () => {
    const p = play([
      run(uuid(10), A(1), [
        { x: 55, y: 30 },
        { x: 70, y: 30 },
      ]),
      run(uuid(11), A(2), [{ x: 48, y: 25 }], {
        endGlue: slides(uuid(10), { event: { point: 0 } }),
      }),
    ])
    const c = compile(p)
    const target = motion(c, uuid(10))
    const glued = motion(c, uuid(11))
    expect(motionEnd(glued)).toBeCloseTo(target.start + waypointTime(target, 0), 9)
    expect(distance(motionPosition(glued, motionEnd(glued)), { x: 48, y: 25 })).toBeLessThan(1e-9)
    expect(glueOf(c, uuid(11))?.to).toEqual({ x: 55, y: 30 })
  })

  it('follows the target when it changes', () => {
    for (const x of [55, 65, 80]) {
      const c = compile(
        play([
          run(uuid(10), A(1), [{ x, y: 30 }]),
          run(uuid(11), A(2), [{ x: 45, y: 25 }], { endGlue: slides(uuid(10)) }),
        ]),
      )
      expect(motionEnd(motion(c, uuid(11)))).toBeCloseTo(motionEnd(motion(c, uuid(10))), 9)
    }
  })

  it('adds the gap of the glue', () => {
    const c = compile(
      play([
        run(uuid(10), A(1), [{ x: 75, y: 30 }]),
        run(uuid(11), A(2), [{ x: 45, y: 25 }], { endGlue: slides(uuid(10), { offset: 0.7 }) }),
      ]),
    )
    expect(motionEnd(motion(c, uuid(11)))).toBeCloseTo(motionEnd(motion(c, uuid(10))) + 0.7, 9)
  })

  it('chains glues in the order of their dependencies', () => {
    const c = compile(
      play([
        run(uuid(12), A(3), [{ x: 45, y: 20 }], { endGlue: slides(uuid(11)) }),
        run(uuid(11), A(2), [{ x: 50, y: 25 }], { endGlue: slides(uuid(10)) }),
        run(uuid(10), A(1), [{ x: 75, y: 30 }]),
      ]),
    )
    const end = motionEnd(motion(c, uuid(10)))
    expect(motionEnd(motion(c, uuid(11)))).toBeCloseTo(end, 9)
    expect(motionEnd(motion(c, uuid(12)))).toBeCloseTo(end, 9)
  })

  it('keeps an imposed duration when it has the time', () => {
    const c = compile(
      play([
        run(uuid(10), A(1), [{ x: 75, y: 30 }]),
        run(uuid(11), A(2), [{ x: 50, y: 25 }], {
          durationOverride: 4,
          endGlue: slides(uuid(10)),
        }),
      ]),
    )
    const glued = motion(c, uuid(11))
    expect(glued.duration).toBeCloseTo(4, 9)
    expect(motionEnd(glued)).toBeCloseTo(motionEnd(motion(c, uuid(10))), 9)
  })

  it('starts at 0 and is sped up to arrive on time when it is too far, with a warning', () => {
    const far = run(uuid(11), A(2), [{ x: 80, y: 25 }])
    const c = compile(
      play([run(uuid(10), A(1), [{ x: 45, y: 30 }]), { ...far, endGlue: slides(uuid(10)) }]),
    )
    const glued = motion(c, uuid(11))
    const end = motionEnd(motion(c, uuid(10)))
    expect(glued.start).toBe(0)
    expect(motionEnd(glued)).toBeCloseTo(end, 9)
    expect(glued.factor).toBeGreaterThan(1)
    expect(glueOf(c, uuid(11))?.status).toBe('late')
    // She should have started that much earlier at her stored speeds (D-131).
    const natural = motion(compile(play([far])), uuid(11))
    expect(issueOf(c, 'glueStartedLate')).toMatchObject({
      severity: 'warning',
      target: { kind: 'action', id: uuid(11), branchId: P.root },
      key: 'end',
    })
    expect(issueOf(c, 'glueStartedLate')?.params?.late).toBeCloseTo(natural.duration - end, 9)
  })

  it('takes the end of the previous run as its bound', () => {
    const c = compile(
      play([
        run(uuid(20), A(2), [{ x: 45, y: 25 }]),
        run(uuid(11), A(2), [{ x: 80, y: 25 }], { start: 4, endGlue: slides(uuid(10)) }),
        run(uuid(10), A(1), [{ x: 70, y: 30 }]),
      ]),
    )
    const glued = motion(c, uuid(11))
    expect(glued.start).toBeCloseTo(motionEnd(motion(c, uuid(20))), 12)
    expect(motionEnd(glued)).toBeCloseTo(motionEnd(motion(c, uuid(10))), 9)
    expect(codes(c)).toContain('glueStartedLate')
    expect(codes(c)).not.toContain('runStartDelayed')
  })

  it('takes the branch point as the bound of an action of an option, the target in the trunk', () => {
    const c = compile(
      play(
        [
          run(uuid(10), A(1), [{ x: 90, y: 30 }]),
          run(uuid(11), A(2), [{ x: 80, y: 25 }], {
            branchId: P.optA,
            start: 2,
            endGlue: slides(uuid(10)),
          }),
        ],
        twoOptions(6),
      ),
      LINE_A,
    )
    const glued = motion(c, uuid(11))
    expect(glued.start).toBe(6)
    expect(motionEnd(glued)).toBeCloseTo(motionEnd(motion(c, uuid(10))), 9)
    expect(codes(c)).toContain('glueStartedLate')
    expect(codes(c)).not.toContain('startsBeforeBranch')
  })

  it('leaves an imposed duration aside when it starts at its bound (D-136)', () => {
    const c = compile(
      play([
        run(uuid(10), A(1), [{ x: 45, y: 30 }]),
        run(
          uuid(11),
          A(2),
          [
            { x: 60, y: 25 },
            { x: 70, y: 25, speed: 'walk' },
          ],
          { durationOverride: 9, endGlue: slides(uuid(10)) },
        ),
      ]),
    )
    const glued = motion(c, uuid(11))
    expect(glueOf(c, uuid(11))?.status).toBe('late')
    expect(glued.duration).toBeCloseTo(motionEnd(motion(c, uuid(10))), 9)
    // The factor is common to all segments, from the stored speeds, not those of the duration.
    expect((glued.targets[0] ?? NaN) / (glued.targets[1] ?? NaN)).toBeCloseTo(
      settings.paces.jog / settings.paces.walk,
      9,
    )
  })

  it('keeps its stored start and speeds when the target is at or before its bound', () => {
    const c = compile(
      play([
        pass(uuid(20), A(1), A(3), 0),
        run(uuid(11), A(2), [{ x: 50, y: 25 }], {
          start: 0.5,
          endGlue: { targetId: uuid(20), event: 'start', keep: 'duration' },
        }),
      ]),
    )
    const glued = motion(c, uuid(11))
    expect(glued.start).toBe(0.5)
    expect(glued.targets).toEqual([settings.paces.jog])
    expect(glueOf(c, uuid(11))).toMatchObject({ status: 'beforeStart', targetT: 0 })
    expect(issueOf(c, 'glueArrivesLate')?.params?.late).toBeCloseTo(motionEnd(glued), 9)
  })
})

describe('right edge, the block stretches (SPEC 5.8, keep: start)', () => {
  it('keeps its start and meets the target by a common factor on every segment', () => {
    const c = compile(
      play([
        run(uuid(10), A(1), [{ x: 110, y: 30 }], { pace: 'sprint' }),
        run(
          uuid(11),
          A(2),
          [
            { x: 50, y: 25 },
            { x: 60, y: 25, speed: 'walk' },
          ],
          { start: 1, endGlue: stretches(uuid(10)) },
        ),
      ]),
    )
    const glued = motion(c, uuid(11))
    expect(glued.start).toBe(1)
    expect(motionEnd(glued)).toBeCloseTo(motionEnd(motion(c, uuid(10))), 9)
    expect(glued.factor).toBeLessThan(1)
    expect((glued.targets[0] ?? NaN) / (glued.targets[1] ?? NaN)).toBeCloseTo(2, 9)
    expect(codes(c)).toEqual([])
  })

  it('meets the target exactly beyond the bounds, the thresholds alone warn (D-129, D-130)', () => {
    const c = compile(
      play([
        run(uuid(10), A(1), [{ x: 45, y: 30 }]),
        run(uuid(11), A(2), [{ x: 80, y: 25 }], { endGlue: stretches(uuid(10)) }),
      ]),
    )
    const glued = motion(c, uuid(11))
    expect(motionEnd(glued)).toBeCloseTo(motionEnd(motion(c, uuid(10))), 9)
    expect(glued.accelFactor).toBeGreaterThan(1)
    expect(glueOf(c, uuid(11))?.status).toBe('ok')
    expect(codes(c)).toEqual(['runSpeedTooHigh', 'runAccelTooHigh', 'runBrakeTooHigh'])
  })

  it('keeps its stored speeds when the target is before its start', () => {
    const c = compile(
      play([
        run(uuid(10), A(1), [{ x: 45, y: 30 }]),
        run(uuid(11), A(2), [{ x: 50, y: 25 }], { start: 9, endGlue: stretches(uuid(10)) }),
      ]),
    )
    const glued = motion(c, uuid(11))
    expect(glued.start).toBe(9)
    expect(glued.targets).toEqual([settings.paces.jog])
    expect(glued.factor).toBe(1)
    expect(glueOf(c, uuid(11))?.status).toBe('beforeStart')
    expect(issueOf(c, 'glueArrivesLate')?.params?.late).toBeCloseTo(
      motionEnd(glued) - motionEnd(motion(c, uuid(10))),
      9,
    )
    expect(codes(c)).toEqual(['glueArrivesLate'])
  })

  it('replaces an imposed duration (SPEC 5.3)', () => {
    const c = compile(
      play([
        run(uuid(10), A(1), [{ x: 70, y: 30 }]),
        run(uuid(11), A(2), [{ x: 55, y: 25 }], {
          durationOverride: 2,
          endGlue: stretches(uuid(10)),
        }),
      ]),
    )
    expect(motionEnd(motion(c, uuid(11)))).toBeCloseTo(motionEnd(motion(c, uuid(10))), 9)
    expect(codes(c)).toEqual([])
  })

  it('gives both edges glued: the start follows, the duration adapts, whatever keep', () => {
    for (const keep of ['start', 'duration'] as const) {
      const c = compile(
        play([
          run(uuid(10), A(1), [{ x: 75, y: 30 }]),
          run(uuid(30), A(3), [{ x: 42, y: 20 }]),
          run(uuid(11), A(2), [{ x: 50, y: 25 }], {
            startGlue: onEnd(uuid(30)),
            endGlue: { ...onEnd(uuid(10)), keep },
          }),
        ]),
      )
      const glued = motion(c, uuid(11))
      expect(glued.start).toBeCloseTo(motionEnd(motion(c, uuid(30))), 12)
      expect(motionEnd(glued)).toBeCloseTo(motionEnd(motion(c, uuid(10))), 9)
      expect(glueOf(c, uuid(11), 'start')?.status).toBe('ok')
      expect(glueOf(c, uuid(11))?.status).toBe('ok')
    }
  })
})

describe('left edge (SPEC 5.4, 5.8)', () => {
  it('starts a run at the event, plus the gap', () => {
    const c = compile(
      play([
        run(uuid(10), A(1), [{ x: 75, y: 30 }]),
        run(uuid(11), A(2), [{ x: 50, y: 25 }], {
          start: 9,
          startGlue: { targetId: uuid(10), event: 'start', offset: 0.4 },
        }),
      ]),
    )
    expect(motion(c, uuid(11)).start).toBeCloseTo(0.4, 12)
    expect(glueOf(c, uuid(11), 'start')).toMatchObject({ status: 'ok', from: { x: 40, y: 25 } })
    expect(glueOf(c, uuid(11), 'start')?.targetT).toBeCloseTo(0.4, 12)
    expect(codes(c)).toEqual([])
  })

  it('releases at the reception, after the control time, whatever its stored instant', () => {
    const c = compile(
      play([
        pass(uuid(20), A(1), A(2), 0.5),
        pass(uuid(21), A(2), A(3), 9, { startGlue: onEnd(uuid(20), { offset: 0.2 }) }),
        kick(uuid(22), A(3), { point: { x: 70, y: 20 } }, 9, { startGlue: onEnd(uuid(21)) }),
      ]),
    )
    const [p1, p2] = c.passes
    expect(p2?.releaseT).toBeCloseTo((p1?.arrivalT ?? NaN) + 0.2, 12)
    expect(p2).toMatchObject({ applied: true })
    expect(c.kicks[0]?.releaseT).toBeCloseTo(p2?.arrivalT ?? NaN, 12)
    expect(c.kicks[0]?.applied).toBe(true)
    expect(codes(c)).toEqual([])
  })

  it('does not simulate a release at its stored instant before it is resolved (D-169)', () => {
    // At its stored 0.5 s, the second pass would be simultaneous with its own target.
    const simultaneous = compile(
      play([
        pass(uuid(21), A(2), A(3), 0.5, { startGlue: onEnd(uuid(20)) }),
        pass(uuid(20), A(1), A(2), 0.5),
      ]),
    )
    expect(simultaneous.passes.map((x) => x.applied)).toEqual([true, true])
    expect(codes(simultaneous)).toEqual([])

    // At its stored 0.5 s, A1 still has the ball: this kick would take it from her own passes.
    const stale = compile(
      play([
        pass(uuid(20), A(1), A(2), 1),
        pass(uuid(21), A(2), A(1), 0, { startGlue: onEnd(uuid(20)) }),
        kick(uuid(22), A(1), { point: { x: 70, y: 20 } }, 0.5, { startGlue: onEnd(uuid(21)) }),
      ]),
    )
    expect(stale.passes.map((x) => x.applied)).toEqual([true, true])
    expect(stale.kicks[0]?.applied).toBe(true)
    expect(stale.kicks[0]?.releaseT).toBeCloseTo(stale.passes[1]?.arrivalT ?? NaN, 12)
    expect(codes(stale)).toEqual([])

    // The same with a kick to resolve, and a right edge that makes a release slide.
    const sliding = compile(
      play([
        run(uuid(30), A(4), [{ x: 60, y: 15 }]),
        kick(uuid(23), A(1), { point: { x: 70, y: 20 } }, 0.5, {
          flightTime: 1,
          endGlue: slides(uuid(30)),
        }),
        pass(uuid(20), A(1), A(2), 1),
        pass(uuid(21), A(2), A(1), 0, { startGlue: onEnd(uuid(20)) }),
      ]),
    )
    expect(sliding.passes.map((x) => x.applied)).toEqual([true, true])
    expect(sliding.kicks[0]?.applied).toBe(true)
    expect(sliding.kicks[0]?.arrivalT).toBeCloseTo(motionEnd(motion(sliding, uuid(30))), 9)
  })

  it('takes the receptions of a player in order', () => {
    // A1 passes to A2, who gives back at the reception; A1 passes again, twice.
    const c = compile(
      play([
        pass(uuid(20), A(1), A(2), 0),
        pass(uuid(21), A(2), A(1), 0, { startGlue: onEnd(uuid(20)) }),
        pass(uuid(22), A(1), A(2), 0.1, { startGlue: onEnd(uuid(21), { offset: 0.1 }) }),
        pass(uuid(23), A(2), A(3), 0, { startGlue: onEnd(uuid(22)) }),
      ]),
    )
    expect(c.passes.map((x) => x.applied)).toEqual([true, true, true, true])
    for (let i = 1; i < c.passes.length; i++) {
      const delay = i === 2 ? 0.1 : 0
      expect(c.passes[i]?.releaseT).toBeCloseTo((c.passes[i - 1]?.arrivalT ?? NaN) + delay, 12)
    }
    expect(c.duration).toBeCloseTo(c.passes[3]?.arrivalT ?? NaN, 12)
  })

  it('releases at the exit of a breakdown she relays', () => {
    const c = compile(
      play([
        run(uuid(10), A(1), [{ x: 45, y: 30 }]),
        breakdown(uuid(20), A(1), A(2), A(3), 3),
        pass(uuid(21), A(3), A(4), 0, { startGlue: onEnd(uuid(20), { offset: 0.3 }) }),
      ]),
    )
    expect(c.passes[0]?.releaseT).toBeCloseTo(6.3, 12)
    expect(c.passes[0]?.applied).toBe(true)
  })

  it('forms a breakdown at the end of a run of the tackled player', () => {
    const c = compile(
      play([
        run(uuid(10), A(1), [{ x: 46, y: 30 }]),
        breakdown(uuid(20), A(1), A(2), A(3), 0, { startGlue: onEnd(uuid(10)) }),
      ]),
    )
    expect(c.breakdowns[0]?.start).toBeCloseTo(motionEnd(motion(c, uuid(10))), 12)
    expect(c.breakdowns[0]?.applied).toBe(true)
    expect(motion(c, uuid(10)).until).toBeNull()
  })

  it('has no tolerance: only a release at its own instant waits for a reception (D-110)', () => {
    const arrival = compile(play([pass(uuid(20), A(1), A(2), 0.5)])).passes[0]?.arrivalT
    if (arrival === undefined) throw new Error('no pass')
    const at = (delay: number) =>
      compile(play([pass(uuid(20), A(1), A(2), 0.5), pass(uuid(21), A(2), A(3), delay)]))
    const soon = at(arrival - 0.3)
    expect(codes(soon)).toEqual([])
    expect(soon.passes[1]).toMatchObject({ applied: true, plannedT: arrival - 0.3 })
    expect(soon.passes[1]?.releaseT).toBe(arrival)
    expect(codes(at(arrival - 0.6))).toEqual(['passerWithoutBall'])
    // Glued before the reception by the event chosen: no wait.
    const early = compile(
      play([
        pass(uuid(20), A(1), A(2), 0.5),
        pass(uuid(21), A(2), A(3), 0, { startGlue: { targetId: uuid(20), event: 'start' } }),
      ]),
    )
    expect(codes(early)).toEqual(['simultaneousPass'])
  })

  it('ignores a release whose target never happens', () => {
    const c = compile(
      play([
        pass(uuid(20), A(3), A(2), 1),
        pass(uuid(21), A(2), A(4), 0.3, { startGlue: onEnd(uuid(20)) }),
      ]),
    )
    expect(c.passes[1]?.applied).toBe(false)
    expect(glueOf(c, uuid(21), 'start')).toMatchObject({ status: 'unreached', targetT: null })
    expect(codes(c)).toEqual(['passerWithoutBall', 'passerWithoutBall', 'glueTargetUnreached'])
    expect(issueOf(c, 'glueTargetUnreached')?.severity).toBe('error')
  })
})

describe('right edge of the other blocks (SPEC 5.8)', () => {
  const target = run(uuid(10), A(4), [{ x: 80, y: 15 }])
  const end = (c: CompiledLine) => motionEnd(motion(c, uuid(10)))

  it('slides a kick: its flight time stays', () => {
    const c = compile(
      play([
        target,
        kick(uuid(20), A(1), { point: { x: 70, y: 30 } }, 1, {
          flightTime: 2,
          endGlue: slides(uuid(10)),
        }),
      ]),
    )
    expect(c.kicks[0]?.arrivalT).toBeCloseTo(end(c), 12)
    expect((c.kicks[0]?.arrivalT ?? 0) - (c.kicks[0]?.releaseT ?? 0)).toBeCloseTo(2, 12)
    expect(codes(c)).toEqual([])
  })

  it('stretches a kick: its release stays, its flight time adapts', () => {
    const c = compile(
      play([
        target,
        kick(uuid(20), A(1), { point: { x: 70, y: 30 } }, 1, {
          flightTime: 2,
          endGlue: stretches(uuid(10)),
        }),
      ]),
    )
    expect(c.kicks[0]?.releaseT).toBe(1)
    expect(c.kicks[0]?.arrivalT).toBeCloseTo(end(c), 12)
  })

  it('slides and stretches a breakdown', () => {
    const slid = compile(
      play([
        target,
        breakdown(uuid(20), A(1), A(2), A(3), 1, { duration: 2, endGlue: slides(uuid(10)) }),
      ]),
    )
    expect(slid.breakdowns[0]?.end).toBeCloseTo(end(slid), 12)
    expect((slid.breakdowns[0]?.end ?? 0) - (slid.breakdowns[0]?.start ?? 0)).toBeCloseTo(2, 12)
    const stretched = compile(
      play([
        target,
        breakdown(uuid(20), A(1), A(2), A(3), 1, { duration: 2, endGlue: stretches(uuid(10)) }),
      ]),
    )
    expect(stretched.breakdowns[0]?.start).toBe(1)
    expect(stretched.breakdowns[0]?.end).toBeCloseTo(end(stretched), 12)
  })

  it('slides a pass by a fixed point on its release: its speed stays', () => {
    const c = compile(
      play([
        target,
        run(uuid(11), A(1), [{ x: 60, y: 30 }]),
        run(uuid(12), A(2), [{ x: 60, y: 25 }]),
        pass(uuid(20), A(1), A(2), 1, { endGlue: slides(uuid(10)) }),
      ]),
    )
    const thrown = c.passes[0]
    expect(thrown?.arrivalT).toBeCloseTo(end(c), 6)
    expect(
      distance(thrown?.from ?? { x: 0, y: 0 }, thrown?.to ?? { x: 0, y: 0 }) /
        ((thrown?.arrivalT ?? 0) - (thrown?.releaseT ?? 0)),
    ).toBeCloseTo(settings.passSpeed, 6)
  })

  it('stretches a pass: its release stays, the speed of the ball adapts', () => {
    const c = compile(
      play([target, pass(uuid(20), A(1), A(2), 2, { endGlue: stretches(uuid(10)) })]),
    )
    expect(c.passes[0]?.releaseT).toBe(2)
    expect(c.passes[0]?.arrivalT).toBeCloseTo(end(c), 6)
  })

  it('signals a ball slower than its receiver (SPEC 5.4)', () => {
    const slow = compile(
      play([
        run(uuid(11), A(2), [{ x: 80, y: 25 }], { pace: 'sprint' }),
        pass(uuid(20), A(1), A(2), 3, { ballSpeed: 3 }),
      ]),
    )
    expect(codes(slow)).toContain('ballSlowerThanReceiver')
    const normal = compile(
      play([
        run(uuid(11), A(2), [{ x: 80, y: 25 }], { pace: 'sprint' }),
        pass(uuid(20), A(1), A(2), 3),
      ]),
    )
    expect(codes(normal)).not.toContain('ballSlowerThanReceiver')
  })

  it('starts at its bound and arrives late without levers (kick, breakdown)', () => {
    const quick = run(uuid(10), A(4), [{ x: 42, y: 15 }])
    const c = compile(
      play([
        quick,
        kick(uuid(20), A(1), { point: { x: 70, y: 30 } }, 1, {
          flightTime: 4,
          endGlue: slides(uuid(10)),
        }),
      ]),
    )
    expect(c.kicks[0]?.releaseT).toBe(0)
    expect(glueOf(c, uuid(20))?.status).toBe('late')
    expect(issueOf(c, 'glueArrivesLate')?.params?.late).toBeCloseTo(4 - end(c), 9)
  })

  it('keeps its stored field when the target is before its start', () => {
    const c = compile(
      play([
        run(uuid(10), A(4), [{ x: 42, y: 15 }]),
        kick(uuid(20), A(1), { point: { x: 70, y: 30 } }, 5, {
          flightTime: 4,
          endGlue: stretches(uuid(10)),
        }),
      ]),
    )
    expect(c.kicks[0]?.arrivalT).toBe(9)
    expect(glueOf(c, uuid(20))?.status).toBe('beforeStart')
    expect(issueOf(c, 'glueArrivesLate')?.params?.late).toBeCloseTo(9 - end(c), 9)
  })
})

describe('sequences and branch points (SPEC 5.8)', () => {
  const span = (c: CompiledLine, id: Id) => c.sequences.find((s) => s.id === id)
  const trunkRun = run(uuid(10), A(1), [{ x: 60, y: 30 }])

  const withSequences = (sequences: Sequence[], actions: Action[] = [trunkRun]) =>
    compile(play(actions, { sequences }))

  it('glues the left edge of a sequence: its end stays (it is an instant)', () => {
    const c = withSequences([sequence(uuid(30), 0, 9, { startGlue: onEnd(uuid(10)) })])
    const end = motionEnd(motion(c, uuid(10)))
    expect(span(c, uuid(30))?.start).toBeCloseTo(end, 12)
    expect(span(c, uuid(30))?.end).toBe(9)
  })

  it('signals a sequence that its glued edge leaves empty, and drops it', () => {
    const c = withSequences([sequence(uuid(30), 0, 1, { startGlue: onEnd(uuid(10)) })])
    expect(span(c, uuid(30))).toBeUndefined()
    expect(codes(c)).toContain('sequenceEndBeforeStart')
  })

  it('stretches and slides a sequence', () => {
    const stretched = withSequences([sequence(uuid(30), 1, 2, { endGlue: stretches(uuid(10)) })])
    const end = motionEnd(motion(stretched, uuid(10)))
    expect(span(stretched, uuid(30))).toMatchObject({ start: 1 })
    expect(span(stretched, uuid(30))?.end).toBeCloseTo(end, 12)
    const slid = withSequences([sequence(uuid(30), 1, 2, { endGlue: slides(uuid(10)) })])
    expect(span(slid, uuid(30))?.end).toBeCloseTo(end, 12)
    expect(span(slid, uuid(30))?.start).toBeCloseTo(end - 1, 12)
    const late = withSequences([sequence(uuid(30), 0, 50, { endGlue: slides(uuid(10)) })])
    expect(span(late, uuid(30))).toMatchObject({ start: 0, end: 50 })
    expect(codes(late)).toContain('glueArrivesLate')
  })

  it('serves as a target, the start and the end of a sequence', () => {
    const c = withSequences(
      [sequence(uuid(30), 2, 4)],
      [
        run(uuid(11), A(2), [{ x: 50, y: 25 }], {
          startGlue: { targetId: uuid(30), event: 'start' },
        }),
        run(uuid(12), A(3), [{ x: 42, y: 20 }], { endGlue: slides(uuid(30)) }),
      ],
    )
    expect(motion(c, uuid(11)).start).toBe(2)
    expect(motionEnd(motion(c, uuid(12)))).toBeCloseTo(4, 12)
    expect(glueOf(c, uuid(11), 'start')?.to).toBeNull()
  })

  it('makes a branch point follow the trunk, and the actions glued to it follow', () => {
    for (const x of [50, 70]) {
      const p = play(
        [
          run(uuid(10), A(1), [{ x, y: 30 }]),
          run(uuid(20), A(2), [{ x: 90, y: 25 }], {
            branchId: P.optA,
            start: 1,
            startGlue: onEnd(P.root, { offset: 0.5 }),
          }),
        ],
        twoOptions(1, onEnd(uuid(10))),
      )
      const c = compile(p, LINE_A)
      const end = motionEnd(motion(c, uuid(10)))
      expect(c.branches[0]?.branchAt).toBeCloseTo(end, 12)
      expect(motion(c, uuid(20)).start).toBeCloseTo(end + 0.5, 12)
      expect(glueOf(c, P.root, 'branchAt')).toMatchObject({
        status: 'ok',
        from: null,
        to: { x, y: 30 },
      })
      expect(codes(c)).toEqual([])
    }
  })

  it('reads the action of an option on its real instants, signalled before its branch point', () => {
    const p = play(
      [
        run(uuid(10), A(1), [{ x: 50, y: 30 }]),
        run(uuid(20), A(2), [{ x: 90, y: 25 }], {
          branchId: P.optA,
          startGlue: onEnd(uuid(10)),
        }),
      ],
      twoOptions(8),
    )
    const c = compile(p, LINE_A)
    expect(motion(c, uuid(20)).start).toBe(8)
    expect(codes(c)).toEqual(['startsBeforeBranch'])
    // Not signalled in the other option.
    expect(codes(compile(p, LINE_B))).toEqual([])
  })

  it('keeps a stored branch point when the target never happens', () => {
    const p = play([pass(uuid(20), A(3), A(2), 1)], twoOptions(5, onEnd(uuid(20))))
    const c = compile(p, LINE_A)
    expect(c.branches[0]?.branchAt).toBe(5)
    expect(glueOf(c, P.root, 'branchAt')?.status).toBe('unreached')
    expect(codes(c)).toContain('glueTargetUnreached')
  })

  it('takes a glued branch point not after the previous one to the previous one (D-158)', () => {
    const p = play([run(uuid(10), A(1), [{ x: 45, y: 30 }])], {
      branches: [
        branch(P.root, null, { branchAt: 8 }),
        branch(P.optA, P.root, { isDefault: true }),
        branch(P.optB, P.root, { branchAt: 1, branchAtGlue: onEnd(uuid(10)) }),
        branch(P.optB1, P.optB, { isDefault: true }),
        branch(P.optB2, P.optB),
      ],
    })
    const c = compile(p, [P.root, P.optB, P.optB1])
    expect(c.branches.map((b) => b.branchAt)).toEqual([8, 8, null])
    expect(codes(c)).toContain('branchAtNotIncreasing')
  })
})

describe('the five events (SPEC 5.8)', () => {
  it('meets the release and the arrival of a pass, of a kick and a formation', () => {
    const c = compile(
      play([
        run(uuid(10), A(1), [{ x: 46, y: 30 }]),
        pass(uuid(20), A(1), A(2), 2.5),
        kick(uuid(21), A(2), { point: { x: 50, y: 20 } }, 3.5),
        run(uuid(11), A(3), [{ x: 44, y: 20 }], {
          endGlue: { targetId: uuid(20), event: 'start', keep: 'duration' },
        }),
        run(uuid(12), A(4), [{ x: 44, y: 15 }], { endGlue: slides(uuid(20)) }),
        run(uuid(13), A(5), [{ x: 49, y: 19 }], { endGlue: slides(uuid(21)) }),
      ]),
    )
    const thePass = c.passes[0]
    const theKick = c.kicks[0]
    expect(motionEnd(motion(c, uuid(11)))).toBeCloseTo(thePass?.releaseT ?? NaN, 9)
    expect(motionEnd(motion(c, uuid(12)))).toBeCloseTo(thePass?.arrivalT ?? NaN, 9)
    expect(motionEnd(motion(c, uuid(13)))).toBeCloseTo(theKick?.arrivalT ?? NaN, 9)
    expect(glueOf(c, uuid(13))?.to).toEqual({ x: 50, y: 20 })
    expect(codes(c)).toEqual([])
  })

  it('meets the formation and the ball out of a breakdown', () => {
    const c = compile(
      play([
        run(uuid(10), A(1), [{ x: 46, y: 30 }]),
        breakdown(uuid(20), A(1), A(2), A(3), 5),
        run(uuid(11), A(4), [{ x: 44, y: 22 }], {
          endGlue: { targetId: uuid(20), event: 'start', keep: 'duration' },
        }),
        run(uuid(12), A(5), [{ x: 44, y: 17 }], { endGlue: slides(uuid(20)) }),
      ]),
    )
    expect(motionEnd(motion(c, uuid(11)))).toBeCloseTo(5, 9)
    expect(motionEnd(motion(c, uuid(12)))).toBeCloseTo(c.breakdowns[0]?.end ?? NaN, 9)
    expect(glueOf(c, uuid(11))?.to).toEqual(c.breakdowns[0]?.pos)
  })

  it('reads the real end of a run cut by a breakdown, and the report of a run', () => {
    const c = compile(
      play([
        run(uuid(10), A(1), [{ x: 90, y: 30 }]),
        breakdown(uuid(20), A(1), A(2), A(3), 3),
        run(uuid(11), A(4), [{ x: 44, y: 22 }], { endGlue: slides(uuid(10)) }),
        run(uuid(12), A(2), [{ x: 60, y: 25 }], { start: 4 }),
        run(uuid(13), A(5), [{ x: 44, y: 17 }], { endGlue: slides(uuid(12)) }),
      ]),
    )
    expect(motionEnd(motion(c, uuid(10)))).toBe(3)
    expect(motionEnd(motion(c, uuid(11)))).toBeCloseTo(3, 9)
    // A2 is held until the ball is out.
    expect(motion(c, uuid(12)).start).toBeCloseTo(c.breakdowns[0]?.end ?? NaN, 12)
    expect(motionEnd(motion(c, uuid(13)))).toBeCloseTo(motionEnd(motion(c, uuid(12))), 9)
  })

  it('never reaches a waypoint after the instant a breakdown cuts the run', () => {
    const c = compile(
      play([
        run(uuid(10), A(1), [
          { x: 42, y: 30 },
          { x: 90, y: 30 },
        ]),
        breakdown(uuid(20), A(1), A(2), A(3), 3),
        run(uuid(11), A(4), [{ x: 44, y: 22 }], {
          endGlue: slides(uuid(10), { event: { point: 1 } }),
        }),
      ]),
    )
    expect(glueOf(c, uuid(11))?.status).toBe('unreached')
    expect(motion(c, uuid(11)).start).toBe(0)
  })

  it('lets a receiver meet the pass she receives at her point (SPEC 5.8)', () => {
    const p = play([
      pass(uuid(20), A(1), A(2), 3),
      run(uuid(11), A(2), [{ x: 34, y: 18 }], { pace: 'sprint', endGlue: slides(uuid(20)) }),
    ])
    const c = compile(p)
    const thrown = c.passes[0]
    const glued = motion(c, uuid(11))
    expect(validatePlay(p).map((i) => i.code)).not.toContain('glueCycle')
    expect(motionEnd(glued)).toBeCloseTo(thrown?.arrivalT ?? NaN, 9)
    expect(distance(thrown?.to ?? { x: 0, y: 0 }, { x: 34, y: 18 })).toBeLessThan(1e-9)
    // At the speed of the ball, on the flight from the passer to her point.
    expect((thrown?.arrivalT ?? 0) - 3).toBeCloseTo(
      distance({ x: 40, y: 30 }, { x: 34, y: 18 }) / settings.passSpeed,
      9,
    )
    expect(codes(c)).toEqual([])
  })

  it('makes the ball land exactly on her point when she goes on at speed', () => {
    // The fixed point of a release alone would leave a gap: she runs fast at her point.
    const c = compile(
      play([
        pass(uuid(20), A(1), A(2), 3),
        run(uuid(11), A(2), [{ x: 60, y: 25 }], {
          pace: 'sprint',
          endGlue: stretches(uuid(20)),
        }),
        run(uuid(12), A(2), [{ x: 90, y: 25 }], { pace: 'sprint', startGlue: onEnd(uuid(11)) }),
      ]),
    )
    const glued = motion(c, uuid(11))
    expect(glued.endsAtSpeed).toBe(true)
    expect(c.passes[0]?.arrivalT).toBeCloseTo(motionEnd(glued), 9)
    expect(distance(c.passes[0]?.to ?? { x: 0, y: 0 }, { x: 60, y: 25 })).toBeLessThan(1e-9)
    expect(motionSpeed(glued, motionEnd(glued) - 1e-6)).toBeGreaterThan(1)
  })

  it('passes at the reception of a receiver glued to it, the next pass after her arrival', () => {
    const c = compile(
      play([
        pass(uuid(20), A(1), A(2), 1),
        run(uuid(11), A(2), [{ x: 45, y: 20 }], { endGlue: stretches(uuid(20)) }),
        pass(uuid(21), A(2), A(3), 0, { startGlue: onEnd(uuid(20), { offset: 0.2 }) }),
      ]),
    )
    expect(c.passes[1]?.applied).toBe(true)
    expect(c.passes[1]?.releaseT).toBeCloseTo(motionEnd(motion(c, uuid(11))) + 0.2, 9)
  })

  it('starts a run of the receiver at the arrival, without changing where the ball lands', () => {
    const glued = compile(
      play([
        pass(uuid(20), A(1), A(2), 1),
        run(uuid(11), A(2), [{ x: 70, y: 25 }], { start: 0, startGlue: onEnd(uuid(20)) }),
      ]),
    )
    const alone = compile(play([pass(uuid(20), A(1), A(2), 1)]))
    expect(glued.passes[0]?.arrivalT).toBeCloseTo(alone.passes[0]?.arrivalT ?? NaN, 12)
    expect(glued.passes[0]?.to).toEqual(alone.passes[0]?.to)
    expect(motion(glued, uuid(11)).start).toBeCloseTo(alone.passes[0]?.arrivalT ?? NaN, 12)
  })
})

describe('glues that cannot apply (SPEC 5.8)', () => {
  it('ignores a deleted target: stored instant and speeds, reported by the validation', () => {
    const p = play([
      run(uuid(11), A(2), [{ x: 50, y: 25 }], { start: 1.2, endGlue: slides(uuid(99)) }),
    ])
    const c = compile(p)
    expect(motion(c, uuid(11)).start).toBe(1.2)
    expect(glueOf(c, uuid(11))).toBeUndefined()
    expect(codes(c)).toEqual([])
    expect(validatePlay(p).map((i) => i.code)).toContain('glueTargetMissing')
  })

  it('ignores a target of another option, reported by the validation', () => {
    const p = play(
      [
        run(uuid(10), A(1), [{ x: 90, y: 30 }], { branchId: P.optB, start: 2 }),
        run(uuid(11), A(2), [{ x: 50, y: 25 }], {
          branchId: P.optA,
          start: 2,
          endGlue: slides(uuid(10)),
        }),
      ],
      twoOptions(1),
    )
    expect(motion(compile(p, LINE_A), uuid(11)).start).toBe(2)
    expect(validatePlay(p).map((i) => i.code)).toContain('glueTargetInvalid')
  })

  it('ignores a target never reached: a pass without the ball', () => {
    const c = compile(
      play([
        pass(uuid(20), A(3), A(2), 1),
        run(uuid(11), A(4), [{ x: 45, y: 15 }], {
          start: 0.4,
          endGlue: { targetId: uuid(20), event: 'start', keep: 'duration' },
        }),
      ]),
    )
    expect(motion(c, uuid(11)).start).toBe(0.4)
    expect(glueOf(c, uuid(11))?.status).toBe('unreached')
    expect(codes(c)).toContain('glueTargetUnreached')
  })

  it('ignores the glues of a cycle (file edited by hand)', () => {
    const p = play([
      run(uuid(10), A(1), [{ x: 50, y: 30 }], { start: 0.3, endGlue: slides(uuid(11)) }),
      run(uuid(11), A(2), [{ x: 50, y: 25 }], { start: 0.6, endGlue: slides(uuid(10)) }),
    ])
    const c = compile(p)
    expect(motion(c, uuid(10)).start).toBe(0.3)
    expect(motion(c, uuid(11)).start).toBe(0.6)
    expect(c.glues).toEqual([])
    expect(validatePlay(p).filter((i) => i.code === 'glueCycle')).toHaveLength(2)
  })
})

describe('real instants read by what follows (SPEC 5.1, 4.3)', () => {
  it('gives the blocks their real span', () => {
    const c = compile(
      play(
        [
          run(uuid(10), A(1), [{ x: 75, y: 30 }]),
          run(uuid(11), A(2), [{ x: 50, y: 25 }], { start: 7, endGlue: slides(uuid(10)) }),
        ],
        { sequences: [sequence(uuid(30), 0, 1, { endGlue: stretches(uuid(10)) })] },
      ),
    )
    const end = motionEnd(motion(c, uuid(10)))
    expect(c.blocks[uuid(11)]?.end).toBeCloseTo(end, 9)
    expect(c.blocks[uuid(30)]?.end).toBeCloseTo(end, 12)
    expect(c.duration).toBeCloseTo(end, 9)
  })

  it('signals a glued action of the trunk at the branch point or after', () => {
    const p = play(
      [
        run(uuid(10), A(1), [{ x: 75, y: 30 }]),
        run(uuid(11), A(2), [{ x: 50, y: 25 }], { startGlue: onEnd(uuid(10)) }),
      ],
      twoOptions(2),
    )
    const c = compile(p, LINE_A)
    expect(codes(c)).toContain('startsAfterBranch')
    expect(validatePlay(p).map((i) => i.code)).not.toContain('startsAfterBranch')
  })
})
