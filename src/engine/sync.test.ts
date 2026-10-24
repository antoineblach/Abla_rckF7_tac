import { describe, expect, it } from 'vitest'
import { validatePlay } from '../model/validate'
import { defaultSettings, engineSettingsOf, type EngineSettings } from '../model/settings'
import type { Action, Id, Play, RunSync } from '../model/types'
import { basePlay, ball, breakdown, kick, pass, phase, player, run, uuid } from '../test/builders'
import { createCaches } from './caches'
import {
  compileLine,
  motionEnd,
  motionPosition,
  waypointTime,
  type CompiledLine,
  type CompiledPhase,
  type RunMotion,
} from './timeline'
import { distance } from './vec'

const settings: EngineSettings = engineSettingsOf(defaultSettings())
const A = (n: number): Id => uuid(n)
const T1 = uuid(100)
const T2 = uuid(101)

/** A1 carries the ball at (40, 30); A2 to A5 line up every 5 m towards y = 10. */
function play(t1: Action[], t2: Action[] | null = null): Play {
  const positions: Record<Id, { x: number; y: number }> = {}
  for (let n = 1; n <= 5; n++) positions[A(n)] = { x: 40, y: 35 - 5 * n }
  return basePlay({
    entities: [1, 2, 3, 4, 5].map((n) => player(A(n), 'A', n)).concat([]),
    setup: { positions, ballCarrierId: A(1), ballPosition: null },
    phases: t2 === null ? [phase(T1, null, t1)] : [phase(T1, null, t1), phase(T2, T1, t2)],
  })
}

const withBall = (p: Play): Play => ({ ...p, entities: [...p.entities, ball(uuid(90))] })

const compile = (p: Play, line: Id[] = [T1]): CompiledLine =>
  compileLine(withBall(p), line, settings, createCaches())

function motion(compiled: CompiledLine, id: Id): RunMotion {
  for (const p of compiled.phases) {
    const found = p.motions.find((m) => m.actionId === id)
    if (found) return found
  }
  throw new Error(`no motion ${id}`)
}

const first = (compiled: CompiledLine): CompiledPhase => {
  const p = compiled.phases[0]
  if (!p) throw new Error('no phase')
  return p
}
const codes = (compiled: CompiledLine) => compiled.issues.map((i) => i.code)

const onEnd = (actionId: Id, extra: Partial<RunSync> = {}): RunSync => ({
  target: { actionId, event: 'runEnd' },
  adjust: 'delay',
  ...extra,
})

describe('links: delayed start (SPEC 5.8, D-108)', () => {
  it('ends together with the target run', () => {
    const p = play([
      run(uuid(10), A(1), [{ x: 70, y: 30 }], { pace: 'sprint' }),
      run(uuid(11), A(2), [{ x: 50, y: 25 }], { sync: onEnd(uuid(10)), delay: 7 }),
    ])
    const c = compile(p)
    const target = motion(c, uuid(10))
    const linked = motion(c, uuid(11))
    expect(motionEnd(linked)).toBeCloseTo(motionEnd(target), 9)
    // The stored delay is ignored; the computed one is kept with the motion.
    expect(linked.start).toBeCloseTo(motionEnd(target) - linked.duration, 9)
    expect(linked.sync).toMatchObject({ adjust: 'delay', status: 'ok', factor: 1 })
    expect(linked.sync?.delay).toBeCloseTo(linked.start, 12)
    expect(linked.sync?.targetPoint).toEqual({ x: 70, y: 30 })
    expect(linked.sync?.meetPoint).toEqual({ x: 50, y: 25 })
    expect(codes(c)).toEqual([])
  })

  it('meets at a rendez-vous point of the run, on a point of the target', () => {
    const p = play([
      run(uuid(10), A(1), [
        { x: 55, y: 30 },
        { x: 70, y: 30 },
      ]),
      run(
        uuid(11),
        A(2),
        [
          { x: 48, y: 25 },
          { x: 60, y: 25 },
        ],
        {
          sync: {
            target: { actionId: uuid(10), event: 'runPoint', index: 0 },
            at: 0,
            adjust: 'delay',
          },
        },
      ),
    ])
    const c = compile(p)
    const target = motion(c, uuid(10))
    const linked = motion(c, uuid(11))
    const meet = linked.start + waypointTime(linked, 0)
    expect(meet).toBeCloseTo(target.start + waypointTime(target, 0), 9)
    expect(distance(motionPosition(linked, meet), { x: 48, y: 25 })).toBeLessThan(1e-9)
  })

  it('follows the target when it changes', () => {
    const make = (x: number) =>
      play([
        run(uuid(10), A(1), [{ x, y: 30 }]),
        run(uuid(11), A(2), [{ x: 45, y: 25 }], { sync: onEnd(uuid(10)) }),
      ])
    for (const x of [55, 65, 80]) {
      const c = compile(make(x))
      expect(motionEnd(motion(c, uuid(11)))).toBeCloseTo(motionEnd(motion(c, uuid(10))), 9)
    }
  })

  it('chains links in the order of their dependencies', () => {
    const p = play([
      run(uuid(12), A(3), [{ x: 45, y: 20 }], { sync: onEnd(uuid(11)) }),
      run(uuid(11), A(2), [{ x: 50, y: 25 }], { sync: onEnd(uuid(10)) }),
      run(uuid(10), A(1), [{ x: 75, y: 30 }]),
    ])
    const c = compile(p)
    const end = motionEnd(motion(c, uuid(10)))
    expect(motionEnd(motion(c, uuid(11)))).toBeCloseTo(end, 9)
    expect(motionEnd(motion(c, uuid(12)))).toBeCloseTo(end, 9)
  })

  it('starts at once and arrives late when it is too far, with a warning', () => {
    const p = play([
      run(uuid(10), A(1), [{ x: 45, y: 30 }]),
      run(uuid(11), A(2), [{ x: 80, y: 25 }], { sync: onEnd(uuid(10)) }),
    ])
    const c = compile(p)
    const linked = motion(c, uuid(11))
    expect(linked.start).toBe(0)
    expect(linked.sync?.status).toBe('late')
    const issue = c.issues.find((i) => i.code === 'syncLate')
    expect(issue?.params?.late).toBeCloseTo(motionEnd(linked) - motionEnd(motion(c, uuid(10))), 9)
  })
})

describe('links and runs ending at speed (SPEC 5.2, D-106)', () => {
  const launched = run(uuid(10), A(1), [{ x: 60, y: 30 }], { pace: 'sprint', endsAtSpeed: true })
  const linkedPlay = (targetX: number) =>
    play(
      [launched],
      [
        run(uuid(30), A(2), [{ x: targetX, y: 25 }]),
        run(uuid(31), A(1), [{ x: 75, y: 30 }], { pace: 'sprint', sync: onEnd(uuid(30)) }),
      ],
    )

  it('prolongs the run at speed when the delayed start comes out at 0 or less', () => {
    const c = compile(linkedPlay(42), [T1, T2])
    const goOn = motion(c, uuid(31))
    expect(goOn.prolongs).toBe(true)
    expect(goOn.start).toBe(c.phases[1]?.start)
    expect(goOn.sync?.status).toBe('late')
    expect(codes(c)).toEqual(['syncLate'])
  })

  it('starts from rest, and the run before stops short, when she has to wait', () => {
    const c = compile(linkedPlay(80), [T1, T2])
    const goOn = motion(c, uuid(31))
    expect(goOn.prolongs).toBe(false)
    expect(goOn.start).toBeGreaterThan(c.phases[1]?.start ?? Infinity)
    expect(motionEnd(goOn)).toBeCloseTo(motionEnd(motion(c, uuid(30))), 9)
    expect(codes(c)).toEqual(['runNotContinued'])
  })
})

describe('links: adjusted speed (SPEC 5.8, D-108)', () => {
  it('meets the target by a common factor before the rendez-vous, later segments unchanged', () => {
    const p = play([
      run(uuid(10), A(1), [{ x: 75, y: 30 }], { pace: 'sprint' }),
      run(
        uuid(11),
        A(2),
        [
          { x: 50, y: 25 },
          { x: 60, y: 25, speed: 'walk' },
        ],
        {
          delay: 1,
          sync: {
            target: { actionId: uuid(10), event: 'runEnd' },
            at: 0,
            adjust: 'speed',
          },
        },
      ),
    ])
    const c = compile(p)
    const linked = motion(c, uuid(11))
    expect(linked.start).toBe(1)
    expect(linked.start + waypointTime(linked, 0)).toBeCloseTo(motionEnd(motion(c, uuid(10))), 9)
    expect(linked.sync?.factor).toBeLessThan(1)
    expect(linked.targets[0]).toBeCloseTo(4 * (linked.sync?.factor ?? NaN), 12)
    expect(linked.targets[1]).toBe(2)
    expect(codes(c)).toEqual([])
  })

  it('caps the speed at the red threshold, with a warning', () => {
    const p = play([
      run(uuid(10), A(1), [{ x: 45, y: 30 }]),
      run(uuid(11), A(2), [{ x: 80, y: 25 }], {
        sync: { target: { actionId: uuid(10), event: 'runEnd' }, adjust: 'speed' },
      }),
    ])
    const c = compile(p)
    const linked = motion(c, uuid(11))
    expect(linked.sync?.status).toBe('capped')
    expect(linked.targets[0]).toBeCloseTo(settings.speedAlert.danger, 12)
    const issue = c.issues.find((i) => i.code === 'syncSpeedCapped')
    expect(issue?.params?.needed).toBeGreaterThan(settings.speedAlert.danger)
  })

  it('replaces an imposed duration (D-107)', () => {
    const p = play([
      run(uuid(10), A(1), [{ x: 70, y: 30 }]),
      run(uuid(11), A(2), [{ x: 55, y: 25 }], {
        durationOverride: 2,
        sync: { target: { actionId: uuid(10), event: 'runEnd' }, adjust: 'speed' },
      }),
    ])
    const c = compile(p)
    expect(motionEnd(motion(c, uuid(11)))).toBeCloseTo(motionEnd(motion(c, uuid(10))), 9)
    expect(codes(c)).toEqual([])
  })
})

describe('links: the five targets (SPEC 5.8)', () => {
  const link = (actionId: Id, event: 'release' | 'arrival' | 'formation'): RunSync => ({
    target: { actionId, event },
    adjust: 'delay',
  })

  it('meets the release and the arrival of a pass, a kick and a formation', () => {
    const p = play([
      run(uuid(10), A(1), [{ x: 46, y: 30 }]),
      pass(uuid(20), A(1), A(2), 2.5),
      kick(uuid(21), A(2), { point: { x: 50, y: 20 } }, 3.5),
      run(uuid(11), A(3), [{ x: 44, y: 20 }], { sync: link(uuid(20), 'release') }),
      run(uuid(12), A(4), [{ x: 44, y: 15 }], { sync: link(uuid(20), 'arrival') }),
      run(uuid(13), A(5), [{ x: 49, y: 19 }], { sync: link(uuid(21), 'arrival') }),
    ])
    const c = compile(p)
    const phase1 = first(c)
    const thePass = phase1.passes[0]
    const theKick = phase1.kicks[0]
    expect(motionEnd(motion(c, uuid(11)))).toBeCloseTo(thePass?.releaseT ?? NaN, 9)
    expect(motionEnd(motion(c, uuid(12)))).toBeCloseTo(thePass?.arrivalT ?? NaN, 9)
    expect(motionEnd(motion(c, uuid(13)))).toBeCloseTo(theKick?.arrivalT ?? NaN, 9)
    expect(motion(c, uuid(13)).sync?.targetPoint).toEqual({ x: 50, y: 20 })
    expect(codes(c)).toEqual([])
  })

  it('meets the formation of a breakdown', () => {
    const p = play([
      run(uuid(10), A(1), [{ x: 46, y: 30 }]),
      breakdown(uuid(20), A(1), A(2), A(3), 5),
      run(uuid(11), A(4), [{ x: 44, y: 22 }], { sync: link(uuid(20), 'formation') }),
    ])
    const c = compile(p)
    expect(motionEnd(motion(c, uuid(11)))).toBeCloseTo(5, 9)
    expect(motion(c, uuid(11)).sync?.targetPoint).toEqual(first(c).breakdowns[0]?.pos)
  })

  it('lets a receiver meet the pass she receives at her rendez-vous (D-108)', () => {
    const p = play([
      pass(uuid(20), A(1), A(2), 3),
      run(uuid(11), A(2), [{ x: 34, y: 18 }], {
        pace: 'sprint',
        sync: { target: { actionId: uuid(20), event: 'arrival' }, adjust: 'delay' },
      }),
    ])
    const c = compile(p)
    const thePass = first(c).passes[0]
    const linked = motion(c, uuid(11))
    expect(validatePlay(withBall(p)).filter((i) => i.code.startsWith('sync'))).toEqual([])
    // The ball arrives where and when she reaches her point.
    expect(motionEnd(linked)).toBeCloseTo(thePass?.arrivalT ?? NaN, 6)
    expect(distance(thePass?.to ?? { x: 0, y: 0 }, { x: 34, y: 18 })).toBeLessThan(1e-6)
    expect(codes(c)).toEqual([])
  })
})

describe('links that cannot apply (SPEC 5.8, D-108)', () => {
  it('ignores a deleted target: stored delay and speeds, reported by the validation', () => {
    const p = play([run(uuid(11), A(2), [{ x: 50, y: 25 }], { delay: 1.2, sync: onEnd(uuid(99)) })])
    const c = compile(p)
    expect(motion(c, uuid(11)).start).toBe(1.2)
    expect(motion(c, uuid(11)).sync).toBeNull()
    expect(validatePlay(withBall(p)).map((i) => i.code)).toContain('syncTargetMissing')
  })

  it('ignores a target never reached: a pass without the ball', () => {
    const p = play([
      pass(uuid(20), A(3), A(2), 1),
      run(uuid(11), A(4), [{ x: 45, y: 15 }], {
        delay: 0.4,
        sync: { target: { actionId: uuid(20), event: 'release' }, adjust: 'delay' },
      }),
    ])
    const c = compile(p)
    expect(motion(c, uuid(11)).start).toBe(0.4)
    expect(motion(c, uuid(11)).sync?.status).toBe('unreached')
    expect(c.issues.map((i) => [i.code, i.params?.reason])).toContainEqual([
      'syncTargetInvalid',
      'unreached',
    ])
  })

  it('ignores the links of a cycle (file edited by hand)', () => {
    const p = play([
      run(uuid(10), A(1), [{ x: 50, y: 30 }], { delay: 0.3, sync: onEnd(uuid(11)) }),
      run(uuid(11), A(2), [{ x: 50, y: 25 }], { delay: 0.6, sync: onEnd(uuid(10)) }),
    ])
    const c = compile(p)
    expect(motion(c, uuid(10)).start).toBe(0.3)
    expect(motion(c, uuid(11)).start).toBe(0.6)
    expect(validatePlay(withBall(p)).filter((i) => i.code === 'syncCycle')).toHaveLength(2)
  })
})

describe('releases (SPEC 5.4, D-110)', () => {
  it('releases on receipt, after the control time', () => {
    const p = play([
      pass(uuid(20), A(1), A(2), 0.5),
      pass(uuid(21), A(2), A(3), 0.2, { release: 'onReceipt' }),
      kick(uuid(22), A(3), { point: { x: 70, y: 20 } }, 0, { release: 'onReceipt' }),
    ])
    const c = compile(p)
    const [p1, p2] = first(c).passes
    expect(p2?.releaseT).toBeCloseTo((p1?.arrivalT ?? NaN) + 0.2, 12)
    expect(p2).toMatchObject({ applied: true, releaseMode: 'onReceipt', plannedT: null })
    expect(p1).toMatchObject({ releaseMode: 'fixed', plannedT: 0.5 })
    expect(first(c).kicks[0]?.releaseT).toBeCloseTo(p2?.arrivalT ?? NaN, 12)
    expect(codes(c)).toEqual([])
  })

  it('takes the receptions of a player in order', () => {
    // A1 passes to A2, who gives back on receipt; A1 passes again on receipt, twice.
    const p = play([
      pass(uuid(20), A(1), A(2), 0),
      pass(uuid(21), A(2), A(1), 0, { release: 'onReceipt' }),
      pass(uuid(22), A(1), A(2), 0.1, { release: 'onReceipt' }),
      pass(uuid(23), A(2), A(3), 0, { release: 'onReceipt' }),
    ])
    const c = compile(p)
    const passes = first(c).passes
    expect(passes.map((x) => x.applied)).toEqual([true, true, true, true])
    for (let i = 1; i < passes.length; i++) {
      const delay = i === 2 ? 0.1 : 0
      expect(passes[i]?.releaseT).toBeCloseTo((passes[i - 1]?.arrivalT ?? NaN) + delay, 12)
    }
    expect(first(c).end).toBeCloseTo(passes[3]?.arrivalT ?? NaN, 12)
  })

  it('releases on receipt at the exit of a breakdown she relays', () => {
    const p = play([
      run(uuid(10), A(1), [{ x: 45, y: 30 }]),
      breakdown(uuid(20), A(1), A(2), A(3), 3),
      pass(uuid(21), A(3), A(4), 0.3, { release: 'onReceipt' }),
    ])
    const c = compile(p)
    expect(first(c).passes[0]?.releaseT).toBeCloseTo(6.3, 12)
    expect(first(c).passes[0]?.applied).toBe(true)
  })

  it('reports a release on receipt that never comes, without playing it', () => {
    const p = play([pass(uuid(21), A(2), A(3), 0.3, { release: 'onReceipt' })])
    const c = compile(p)
    expect(codes(c)).toEqual(['passerWithoutBall'])
    expect(first(c).passes[0]?.applied).toBe(false)
    expect(first(c).ball.map((s) => s.kind)).toEqual(['carried'])
  })

  it('waits for a reception due within 0.5 s for a fixed release only', () => {
    const arrival = first(compile(play([pass(uuid(20), A(1), A(2), 0.5)]))).passes[0]?.arrivalT
    if (arrival === undefined) throw new Error('no pass')
    const at = (delay: number) =>
      compile(play([pass(uuid(20), A(1), A(2), 0.5), pass(uuid(21), A(2), A(3), delay)]))
    const soon = at(arrival - 0.3)
    expect(codes(soon)).toEqual([])
    expect(first(soon).passes[1]).toMatchObject({ applied: true, plannedT: arrival - 0.3 })
    expect(first(soon).passes[1]?.releaseT).toBe(arrival)
    const early = at(arrival - 0.6)
    expect(codes(early)).toEqual(['passerWithoutBall'])
  })
})
