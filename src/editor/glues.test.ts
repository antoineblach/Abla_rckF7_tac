// Glues in the editor (SPEC 5.8, 5.3, D-143, D-152): refused when laid, frozen when removed or when
// their target goes, keep and gap, the last gesture wins.
import { describe, expect, it } from 'vitest'
import { BREAKDOWN_DURATION_DEFAULT } from '../config/defaults'
import { defaultSettings, engineSettingsOf } from '../model/settings'
import { createCaches } from '../engine/caches'
import { compileLine } from '../engine/timeline'
import { allLines } from '../model/branches'
import { glueEdges } from '../model/syncGraph'
import type { Action, EndGlue, GlueRef, Id, Play, RunAction } from '../model/types'
import { validatePlay } from '../model/validate'
import {
  P,
  basePlay,
  branch,
  breakdown,
  kick,
  pass,
  player,
  realisticRunsPlay,
  run,
  sequence,
  sequentialIds,
  sevenVsSevenWithOptions,
  uuid,
} from '../test/builders'
import { expectGluesOnTarget } from '../test/glueChecks'
import {
  deleteActions,
  deletePlayers,
  deleteWaypoint,
  moveWaypoint,
  removeGlue,
  setGlue,
  setKeep,
  setOffset,
  setSegmentSpeed,
  setStart,
  updateRun,
  type CommandContext,
} from './commands'

const settings = engineSettingsOf(defaultSettings())
const ctx = (): CommandContext => ({ ids: sequentialIds(700), settings, caches: createCaches() })

const RUN_A4 = uuid(200)
const RUN_A5 = uuid(201)
const PASS_A4_A5 = uuid(202)
const RUN_OPTION_A = uuid(220)

const toEnd = (targetId: Id): GlueRef => ({ targetId, event: 'end' })
const slideTo = (targetId: Id): EndGlue => ({ targetId, event: 'end', keep: 'duration' })
const stretchTo = (targetId: Id): EndGlue => ({ targetId, event: 'end', keep: 'start' })

function actionOf(play: Play, id: Id): Action {
  const action = play.actions.find((candidate) => candidate.id === id)
  if (!action) throw new Error(`no action ${id}`)
  return action
}

function runOf(play: Play, id: Id): RunAction {
  const action = actionOf(play, id)
  if (action.type !== 'run') throw new Error(`not a run ${id}`)
  return action
}

/** Actual spans of the blocks of every line. */
function spans(play: Play, c: CommandContext) {
  return allLines(play).map((line) => compileLine(play, line, c.settings, c.caches).blocks)
}

/** The blocks have not moved. */
function expectSameSpans(after: Play, before: Play, c: CommandContext): void {
  const was = spans(before, c)
  spans(after, c).forEach((line, index) => {
    for (const [id, span] of Object.entries(line)) {
      expect(span.start, `start of ${id}`).toBeCloseTo(was[index]?.[id]?.start ?? NaN, 6)
      expect(span.end, `end of ${id}`).toBeCloseTo(was[index]?.[id]?.end ?? NaN, 6)
    }
  })
}

const A = uuid(1)
const B = uuid(2)
const C = uuid(3)
const RUN_LONG = uuid(300)
const RUN_SHORT = uuid(301)

/** A runs 30 m from 0 s; B runs 5 m from 0.3 s. No ball. */
function twoRuns(extra: Partial<RunAction> = {}): Play {
  return basePlay({
    entities: [player(A, 'A', 1), player(B, 'A', 2), player(C, 'A', 3)],
    setup: {
      positions: {
        [A]: { x: 20, y: 20 },
        [B]: { x: 20, y: 30 },
        [C]: { x: 20, y: 40 },
      },
      ballCarrierId: null,
      ballPosition: null,
    },
    actions: [
      run(RUN_LONG, A, [{ x: 50, y: 20 }]),
      run(RUN_SHORT, B, [{ x: 25, y: 30 }], { start: 0.3, ...extra }),
    ],
  })
}

describe('laying a glue (SPEC 5.8, 4.3)', () => {
  it('glues the left edge of a block on the end of another one', () => {
    const result = setGlue(sevenVsSevenWithOptions(), {
      kind: 'start',
      ownerId: RUN_A5,
      glue: toEnd(RUN_A4),
    })
    expect(result.refused).toBeNull()
    expect(runOf(result.play, RUN_A5).startGlue).toEqual(toEnd(RUN_A4))
  })

  it('refuses its own block, a target out of the line, a target that cannot apply', () => {
    const play = sevenVsSevenWithOptions()
    const left = (ownerId: Id, glue: GlueRef) => setGlue(play, { kind: 'start', ownerId, glue })
    expect(left(RUN_A5, toEnd(RUN_A5)).refused).toBe('self')
    // A block of the trunk never glues to an event of an option.
    expect(left(RUN_A5, toEnd(RUN_OPTION_A)).refused).toBe('line')
    // Nor an option to another option.
    expect(left(uuid(230), toEnd(RUN_OPTION_A)).refused).toBe('line')
    expect(left(RUN_A5, toEnd(uuid(999))).refused).toBe('invalid')
    expect(left(uuid(999), toEnd(RUN_A4)).refused).toBe('invalid')
    expect(left(RUN_A5, { targetId: RUN_A4, event: { point: 2 } }).refused).toBe('invalid')
    expect(left(RUN_A5, { targetId: PASS_A4_A5, event: { point: 0 } }).refused).toBe('invalid')
    // An option can glue to the trunk.
    expect(left(RUN_OPTION_A, toEnd(RUN_A4)).refused).toBeNull()
    expect(left(RUN_A5, toEnd(RUN_A4)).play).not.toBe(play)
    expect(left(RUN_A5, toEnd(RUN_A5)).play).toBe(play)
  })

  it('refuses a cycle and leaves the play as it is', () => {
    const first = setGlue(twoRuns(), { kind: 'start', ownerId: RUN_SHORT, glue: toEnd(RUN_LONG) })
    const loop = setGlue(first.play, { kind: 'start', ownerId: RUN_LONG, glue: toEnd(RUN_SHORT) })
    expect(loop.refused).toBe('cycle')
    expect(loop.play).toBe(first.play)
  })

  it('refuses a real loop through a pass (D-152)', () => {
    const play = sevenVsSevenWithOptions()
    // The release of the pass is glued to the end of a run itself glued to the arrival of the pass.
    const glued = setGlue(play, { kind: 'start', ownerId: RUN_A5, glue: toEnd(PASS_A4_A5) })
    expect(glued.refused).toBeNull()
    const loop = setGlue(glued.play, {
      kind: 'start',
      ownerId: PASS_A4_A5,
      glue: toEnd(RUN_A5),
    })
    expect(loop.refused).toBe('cycle')
  })

  it('has no false cycle after a reception: she may go on, the passer may too (D-152)', () => {
    const play = sevenVsSevenWithOptions()
    const reception = setGlue(play, { kind: 'start', ownerId: RUN_A5, glue: toEnd(PASS_A4_A5) })
    const withNext: Play = {
      ...reception.play,
      actions: [
        ...reception.play.actions,
        run(uuid(320), P.A(5), [{ x: 52, y: 52 }], { start: 4 }),
      ],
    }
    expect(
      setGlue(withNext, { kind: 'start', ownerId: uuid(320), glue: toEnd(RUN_A5) }).refused,
    ).toBeNull()
    const passerRuns: Play = {
      ...play,
      actions: [...play.actions, run(uuid(321), P.A(4), [{ x: 50, y: 42 }], { start: 4 })],
    }
    expect(
      setGlue(passerRuns, { kind: 'start', ownerId: uuid(321), glue: toEnd(PASS_A4_A5) }).refused,
    ).toBeNull()
  })

  it('lets a receiver meet the arrival of the pass she receives', () => {
    const play = sevenVsSevenWithOptions()
    expect(
      setGlue(play, { kind: 'end', ownerId: RUN_A5, glue: slideTo(PASS_A4_A5) }).refused,
    ).toBeNull()
  })

  it('removes the imposed duration when the duration now adapts (SPEC 5.3)', () => {
    const imposed = twoRuns({ durationOverride: 4 })
    const stretched = setGlue(imposed, {
      kind: 'end',
      ownerId: RUN_SHORT,
      glue: stretchTo(RUN_LONG),
    })
    expect(runOf(stretched.play, RUN_SHORT).durationOverride).toBeUndefined()
    const slid = setGlue(imposed, { kind: 'end', ownerId: RUN_SHORT, glue: slideTo(RUN_LONG) })
    expect(runOf(slid.play, RUN_SHORT).durationOverride).toBe(4)
    const both = setGlue(slid.play, {
      kind: 'start',
      ownerId: RUN_SHORT,
      glue: toEnd(RUN_LONG),
    })
    expect(runOf(both.play, RUN_SHORT).durationOverride).toBeUndefined()
  })
})

describe('« Décoller »: the block does not move (SPEC 5.8)', () => {
  it('freezes a left edge at its computed instant', () => {
    const c = ctx()
    const play = setGlue(twoRuns(), {
      kind: 'start',
      ownerId: RUN_SHORT,
      glue: { ...toEnd(RUN_LONG), offset: 0.5 },
    }).play
    const removed = removeGlue(play, RUN_SHORT, 'start', c)
    expect(runOf(removed, RUN_SHORT).startGlue).toBeUndefined()
    expect(runOf(removed, RUN_SHORT).start).toBeGreaterThan(5)
    expectSameSpans(removed, play, c)
  })

  it('leaves a run no longer prolonged to brake: the next one waits for it, with its alert (D-170)', () => {
    const c = ctx()
    const play = setGlue(twoRuns(), {
      kind: 'start',
      ownerId: RUN_SHORT,
      glue: toEnd(RUN_LONG),
    }).play
    const chained: Play = {
      ...play,
      actions: [
        run(RUN_LONG, A, [{ x: 50, y: 20 }]),
        run(RUN_SHORT, A, [{ x: 60, y: 25 }], { start: 1, startGlue: toEnd(RUN_LONG) }),
      ],
    }
    const launched = compileLine(chained, [P.root], c.settings, c.caches)
    const removed = removeGlue(chained, RUN_SHORT, 'start', c)
    expect(runOf(removed, RUN_SHORT).start).toBeCloseTo(launched.blocks[RUN_SHORT]?.start ?? NaN, 9)
    const braking = compileLine(removed, [P.root], c.settings, c.caches)
    expect(braking.blocks[RUN_LONG]?.end).toBeGreaterThan(launched.blocks[RUN_LONG]?.end ?? NaN)
    expect(braking.blocks[RUN_SHORT]?.start).toBeCloseTo(braking.blocks[RUN_LONG]?.end ?? NaN, 9)
    expect(braking.issues.map((issue) => issue.code)).toContain('runStartDelayed')
  })

  it('freezes a right edge that slides at its computed start', () => {
    const c = ctx()
    const play = setGlue(twoRuns(), {
      kind: 'end',
      ownerId: RUN_SHORT,
      glue: slideTo(RUN_LONG),
    }).play
    const removed = removeGlue(play, RUN_SHORT, 'end', c)
    const frozen = runOf(removed, RUN_SHORT)
    expect(frozen.endGlue).toBeUndefined()
    expect(frozen.start).toBeGreaterThan(1)
    expect(frozen.durationOverride).toBeUndefined()
    expectSameSpans(removed, play, c)
  })

  it('freezes a right edge that stretches: the duration is imposed', () => {
    const c = ctx()
    const play = setGlue(twoRuns(), {
      kind: 'end',
      ownerId: RUN_SHORT,
      glue: stretchTo(RUN_LONG),
    }).play
    const removed = removeGlue(play, RUN_SHORT, 'end', c)
    const frozen = runOf(removed, RUN_SHORT)
    expect(frozen.start).toBe(0.3)
    expect(frozen.durationOverride).toBeGreaterThan(1)
    expectSameSpans(removed, play, c)
  })

  it('freezes a run started late at its bound, levers included', () => {
    const c = ctx()
    // The target comes before the natural duration of the run: departure at 0, sped up.
    const base = basePlay({
      entities: [player(A, 'A', 1), player(B, 'A', 2)],
      setup: {
        positions: { [A]: { x: 20, y: 20 }, [B]: { x: 20, y: 30 } },
        ballCarrierId: null,
        ballPosition: null,
      },
      actions: [
        run(RUN_LONG, A, [{ x: 25, y: 20 }]),
        run(RUN_SHORT, B, [{ x: 60, y: 30 }], { endGlue: slideTo(RUN_LONG) }),
      ],
    })
    const removed = removeGlue(base, RUN_SHORT, 'end', c)
    const frozen = runOf(removed, RUN_SHORT)
    expect(frozen.start).toBe(0)
    expect(frozen.durationOverride).toBeDefined()
    expectSameSpans(removed, base, c)
  })

  it('keeps the stored values of an edge that never applied', () => {
    const c = ctx()
    const played = {
      ...twoRuns(),
      actions: [
        ...twoRuns().actions,
        pass(uuid(310), A, B, 2),
        run(uuid(311), C, [{ x: 30, y: 40 }], { start: 1.2, startGlue: toEnd(uuid(310)) }),
      ],
    }
    const removed = removeGlue(played, uuid(311), 'start', c)
    expect(runOf(removed, uuid(311)).start).toBe(1.2)
    expect(runOf(removed, uuid(311)).startGlue).toBeUndefined()
    expect(removeGlue(removed, uuid(311), 'start', c)).toBe(removed)
  })

  it('keeps a block with both edges glued in place, whichever edge goes', () => {
    const c = ctx()
    const play: Play = {
      ...twoRuns(),
      actions: [
        ...twoRuns().actions,
        run(uuid(312), C, [{ x: 30, y: 40 }], {
          startGlue: { ...toEnd(RUN_SHORT), offset: 0.2 },
          endGlue: { ...slideTo(RUN_LONG), offset: 2 },
        }),
      ],
    }
    const noLeft = removeGlue(play, uuid(312), 'start', c)
    expect(runOf(noLeft, uuid(312)).startGlue).toBeUndefined()
    expect(runOf(noLeft, uuid(312)).endGlue?.keep).toBe('start')
    expectSameSpans(noLeft, play, c)
    const noRight = removeGlue(play, uuid(312), 'end', c)
    expect(runOf(noRight, uuid(312)).endGlue).toBeUndefined()
    expect(runOf(noRight, uuid(312)).startGlue).toBeDefined()
    expectSameSpans(noRight, play, c)
  })

  it('freezes the field that adapted on a pass, a kick and a breakdown', () => {
    const c = ctx()
    const carried = basePlay({
      entities: [player(A, 'A', 1), player(B, 'A', 2), player(C, 'A', 3)],
      setup: {
        positions: {
          [A]: { x: 20, y: 20 },
          [B]: { x: 20, y: 30 },
          [C]: { x: 20, y: 40 },
        },
        ballCarrierId: A,
        ballPosition: null,
      },
      actions: [
        run(RUN_LONG, C, [{ x: 40, y: 40 }]),
        pass(uuid(320), A, B, 0.5, { endGlue: stretchTo(RUN_LONG) }),
      ],
    })
    const passFrozen = removeGlue(carried, uuid(320), 'end', c)
    const speed = actionOf(passFrozen, uuid(320))
    expect(speed).toMatchObject({ type: 'pass' })
    expect(speed.type === 'pass' ? speed.ballSpeed : undefined).toBeGreaterThan(0)
    expectSameSpans(passFrozen, carried, c)

    const kicked: Play = {
      ...carried,
      actions: [
        run(RUN_LONG, C, [{ x: 40, y: 40 }]),
        kick(uuid(321), A, { point: { x: 50, y: 30 } }, 0.5, { endGlue: stretchTo(RUN_LONG) }),
      ],
    }
    const kickFrozen = removeGlue(kicked, uuid(321), 'end', c)
    const flight = actionOf(kickFrozen, uuid(321))
    expect(flight.type === 'kick' ? flight.flightTime : undefined).toBeGreaterThan(0)
    expectSameSpans(kickFrozen, kicked, c)

    const fourth = uuid(4)
    const rucked: Play = {
      ...carried,
      entities: [...carried.entities, player(fourth, 'A', 4)],
      setup: {
        ...carried.setup,
        positions: { ...carried.setup.positions, [fourth]: { x: 20, y: 50 } },
      },
      actions: [
        run(RUN_LONG, fourth, [{ x: 40, y: 50 }]),
        breakdown(uuid(322), A, B, C, 0.5, { endGlue: stretchTo(RUN_LONG) }),
      ],
    }
    const ruckFrozen = removeGlue(rucked, uuid(322), 'end', c)
    const ruck = actionOf(ruckFrozen, uuid(322))
    expect(ruck.type === 'breakdown' ? ruck.duration : undefined).not.toBe(
      BREAKDOWN_DURATION_DEFAULT,
    )
    expectSameSpans(ruckFrozen, rucked, c)
  })
})

describe('removing a target freezes the edges glued to it (SPEC 5.8)', () => {
  it('freezes the edges on a deleted action and counts them', () => {
    const c = ctx()
    const play = setGlue(twoRuns(), {
      kind: 'start',
      ownerId: RUN_SHORT,
      glue: toEnd(RUN_LONG),
    }).play
    const instant = compileLine(play, [P.root], c.settings, c.caches).blocks[RUN_SHORT]?.start
    const result = deleteActions(play, [RUN_LONG], c)
    expect(result.frozen).toBe(1)
    expect(runOf(result.play, RUN_SHORT).startGlue).toBeUndefined()
    expect(runOf(result.play, RUN_SHORT).start).toBeCloseTo(instant ?? NaN, 9)
    expect(validatePlay(result.play).filter((i) => i.severity === 'error')).toEqual([])
    expect(deleteActions(play, [uuid(999)], c)).toEqual({ play, frozen: 0 })
  })

  it('does not count an edge that goes with its target', () => {
    const c = ctx()
    const play = setGlue(twoRuns(), {
      kind: 'start',
      ownerId: RUN_SHORT,
      glue: toEnd(RUN_LONG),
    }).play
    expect(deleteActions(play, [RUN_LONG, RUN_SHORT], c).frozen).toBe(0)
  })

  it('freezes the edges on the actions of a deleted player', () => {
    const c = ctx()
    const play = setGlue(twoRuns(), {
      kind: 'start',
      ownerId: RUN_SHORT,
      glue: toEnd(RUN_LONG),
    }).play
    const result = deletePlayers(play, [A], c)
    expect(result.frozen).toBe(1)
    expect(runOf(result.play, RUN_SHORT).startGlue).toBeUndefined()
    expect(result.play.entities.some((e) => e.id === A)).toBe(false)
  })

  it('freezes a sequence and a branch point glued to a deleted action', () => {
    const c = ctx()
    const play = realisticRunsPlay()
    const target = uuid(514)
    const line = [P.root, P.optA]
    const before = compileLine(play, line, c.settings, c.caches)
    const glued: Play = {
      ...play,
      sequences: [
        sequence(uuid(700), 0, 1, {
          endGlue: { targetId: target, event: 'start', keep: 'start' },
        }),
      ],
    }
    const seqEnd = compileLine(glued, line, c.settings, c.caches).sequences.find(
      (s) => s.id === uuid(700),
    )?.end
    const result = deleteActions(glued, [target], c)
    expect(result.frozen).toBeGreaterThanOrEqual(2)
    expect(result.play.branches[0]?.branchAtGlue).toBeUndefined()
    expect(result.play.branches[0]?.branchAt).toBeCloseTo(before.branches[0]?.branchAt ?? NaN, 9)
    const frozen = result.play.sequences.find((s) => s.id === uuid(700))
    expect(frozen?.endGlue).toBeUndefined()
    expect(frozen?.end).toBeCloseTo(seqEnd ?? NaN, 9)
  })

  describe('deleting a waypoint', () => {
    const RUN = uuid(330)

    /** One run of three points; an edge on each of them, and one on its end. */
    function pointTargets(): Play {
      const others = [uuid(4), uuid(5), uuid(6), uuid(7)]
      return basePlay({
        entities: [player(A, 'A', 1), ...others.map((id, i) => player(id, 'A', i + 2))],
        setup: {
          positions: Object.fromEntries(
            [A, ...others].map((id, i) => [id, { x: 20, y: 10 + 5 * i }]),
          ),
          ballCarrierId: null,
          ballPosition: null,
        },
        actions: [
          run(RUN, A, [
            { x: 30, y: 10 },
            { x: 40, y: 12 },
            { x: 50, y: 10 },
          ]),
          run(uuid(331), uuid(4), [{ x: 30, y: 15 }], {
            startGlue: { targetId: RUN, event: { point: 0 } },
          }),
          run(uuid(332), uuid(5), [{ x: 30, y: 20 }], {
            startGlue: { targetId: RUN, event: { point: 1 } },
          }),
          run(uuid(333), uuid(6), [{ x: 30, y: 25 }], {
            startGlue: { targetId: RUN, event: { point: 2 } },
          }),
          run(uuid(334), uuid(7), [{ x: 30, y: 30 }], { startGlue: toEnd(RUN) }),
        ],
      })
    }

    it('freezes the edges on this point, shifts those on the points after it', () => {
      const c = ctx()
      const play = pointTargets()
      const instant = compileLine(play, [P.root], c.settings, c.caches).blocks[uuid(332)]?.start
      const result = deleteWaypoint(play, RUN, 1, c)
      expect(result.frozen).toBe(1)
      expect(runOf(result.play, RUN).waypoints).toHaveLength(2)
      expect(runOf(result.play, uuid(331)).startGlue?.event).toEqual({ point: 0 })
      expect(runOf(result.play, uuid(332)).startGlue).toBeUndefined()
      expect(runOf(result.play, uuid(332)).start).toBeCloseTo(instant ?? NaN, 9)
      expect(runOf(result.play, uuid(333)).startGlue?.event).toEqual({ point: 1 })
      expect(runOf(result.play, uuid(334)).startGlue).toEqual(toEnd(RUN))
      expect(validatePlay(result.play).filter((i) => i.severity === 'error')).toEqual([])
    })

    it('freezes every edge on a run deleted with its last point', () => {
      const c = ctx()
      const single: Play = {
        ...twoRuns(),
        actions: [
          run(RUN_LONG, A, [{ x: 50, y: 20 }]),
          run(RUN_SHORT, B, [{ x: 25, y: 30 }], { startGlue: toEnd(RUN_LONG) }),
          run(uuid(335), C, [{ x: 25, y: 40 }], {
            startGlue: { targetId: RUN_LONG, event: { point: 0 } },
          }),
        ],
      }
      const result = deleteWaypoint(single, RUN_LONG, 0, c)
      expect(result.frozen).toBe(2)
      expect(result.play.actions.some((a) => a.id === RUN_LONG)).toBe(false)
      expect(glueEdges(result.play)).toEqual([])
    })

    it('does nothing for a point that does not exist', () => {
      const play = pointTargets()
      expect(deleteWaypoint(play, RUN, 3, ctx())).toEqual({ play, frozen: 0 })
      expect(deleteWaypoint(play, uuid(999), 0, ctx())).toEqual({ play, frozen: 0 })
    })
  })
})

describe('keep and gap (SPEC 5.8, 6.5)', () => {
  it('changes what the block does when the target moves', () => {
    const play = setGlue(twoRuns({ durationOverride: 4 }), {
      kind: 'end',
      ownerId: RUN_SHORT,
      glue: slideTo(RUN_LONG),
    }).play
    expect(setKeep(play, RUN_SHORT, 'duration')).toBe(play)
    const stretched = setKeep(play, RUN_SHORT, 'start')
    expect(runOf(stretched, RUN_SHORT).endGlue?.keep).toBe('start')
    expect(runOf(stretched, RUN_SHORT).durationOverride).toBeUndefined()
    expect(setKeep(twoRuns(), RUN_SHORT, 'start')).toEqual(twoRuns())
  })

  it('sets the gap, >= 0, 0 being the default', () => {
    const c = ctx()
    const play = setGlue(twoRuns(), {
      kind: 'start',
      ownerId: RUN_SHORT,
      glue: toEnd(RUN_LONG),
    }).play
    const gapped = setOffset(play, RUN_SHORT, 'start', 0.5)
    expect(runOf(gapped, RUN_SHORT).startGlue?.offset).toBe(0.5)
    const naked = compileLine(play, [P.root], c.settings, c.caches).blocks[RUN_SHORT]?.start ?? NaN
    expect(
      compileLine(gapped, [P.root], c.settings, c.caches).blocks[RUN_SHORT]?.start,
    ).toBeCloseTo(naked + 0.5, 6)
    expect(setOffset(gapped, RUN_SHORT, 'start', 0.5)).toBe(gapped)
    const cleared = setOffset(gapped, RUN_SHORT, 'start', -1)
    expect(runOf(cleared, RUN_SHORT).startGlue).toEqual(toEnd(RUN_LONG))
    expect(setOffset(play, RUN_SHORT, 'start', 0)).toBe(play)
    expect(setOffset(play, RUN_SHORT, 'start', Number.NaN)).toBe(play)
    expect(setOffset(play, RUN_SHORT, 'end', 1)).toBe(play)
    const ended = setGlue(twoRuns(), { kind: 'end', ownerId: RUN_SHORT, glue: slideTo(RUN_LONG) })
    expect(runOf(setOffset(ended.play, RUN_SHORT, 'end', 1), RUN_SHORT).endGlue).toEqual({
      ...slideTo(RUN_LONG),
      offset: 1,
    })
  })

  it('does not set an instant that a glue computes (SPEC 6.5)', () => {
    const left = setGlue(twoRuns(), { kind: 'start', ownerId: RUN_SHORT, glue: toEnd(RUN_LONG) })
    expect(setStart(left.play, RUN_SHORT, 9)).toBe(left.play)
    const slid = setGlue(twoRuns(), { kind: 'end', ownerId: RUN_SHORT, glue: slideTo(RUN_LONG) })
    expect(setStart(slid.play, RUN_SHORT, 9)).toBe(slid.play)
    const stretched = setGlue(twoRuns(), {
      kind: 'end',
      ownerId: RUN_SHORT,
      glue: stretchTo(RUN_LONG),
    })
    expect(runOf(setStart(stretched.play, RUN_SHORT, 9), RUN_SHORT).start).toBe(9)
  })
})

describe('the last gesture wins (SPEC 5.3)', () => {
  it('a pace removes the imposed duration, even the same pace', () => {
    const imposed = twoRuns({ durationOverride: 4 })
    const paced = updateRun(imposed, RUN_SHORT, { pace: 'sprint' })
    expect(runOf(paced, RUN_SHORT)).toMatchObject({ pace: 'sprint' })
    expect(runOf(paced, RUN_SHORT).durationOverride).toBeUndefined()
    const same = updateRun(imposed, RUN_SHORT, { pace: 'jog' })
    expect(runOf(same, RUN_SHORT).durationOverride).toBeUndefined()
  })

  it('a pace removes a right edge whose duration adapts, not one that slides', () => {
    const stretched = setGlue(twoRuns(), {
      kind: 'end',
      ownerId: RUN_SHORT,
      glue: stretchTo(RUN_LONG),
    }).play
    expect(runOf(updateRun(stretched, RUN_SHORT, { pace: 'walk' }), RUN_SHORT).endGlue).toBe(
      undefined,
    )
    const slid = setGlue(twoRuns(), {
      kind: 'end',
      ownerId: RUN_SHORT,
      glue: slideTo(RUN_LONG),
    }).play
    expect(runOf(updateRun(slid, RUN_SHORT, { pace: 'walk' }), RUN_SHORT).endGlue).toEqual(
      slideTo(RUN_LONG),
    )
    const both = setGlue(slid, { kind: 'start', ownerId: RUN_SHORT, glue: toEnd(RUN_LONG) }).play
    const decoupled = updateRun(both, RUN_SHORT, { pace: 'walk' })
    expect(runOf(decoupled, RUN_SHORT).endGlue).toBeUndefined()
    expect(runOf(decoupled, RUN_SHORT).startGlue).toBeDefined()
  })

  it('an imposed duration removes a right edge whose duration adapts, not one that slides', () => {
    const stretched = setGlue(twoRuns(), {
      kind: 'end',
      ownerId: RUN_SHORT,
      glue: stretchTo(RUN_LONG),
    }).play
    const imposed = updateRun(stretched, RUN_SHORT, { durationOverride: 2 })
    expect(runOf(imposed, RUN_SHORT).durationOverride).toBe(2)
    expect(runOf(imposed, RUN_SHORT).endGlue).toBeUndefined()
    const slid = setGlue(twoRuns(), {
      kind: 'end',
      ownerId: RUN_SHORT,
      glue: slideTo(RUN_LONG),
    }).play
    const kept = updateRun(slid, RUN_SHORT, { durationOverride: 2 })
    expect(runOf(kept, RUN_SHORT).endGlue).toEqual(slideTo(RUN_LONG))
  })

  it('a segment speed removes neither the one nor the other', () => {
    const imposed = twoRuns({ durationOverride: 4 })
    const stretched = setGlue(twoRuns(), {
      kind: 'end',
      ownerId: RUN_SHORT,
      glue: stretchTo(RUN_LONG),
    }).play
    expect(
      runOf(setSegmentSpeed(imposed, RUN_SHORT, 0, 'sprint'), RUN_SHORT).durationOverride,
    ).toBe(4)
    expect(runOf(setSegmentSpeed(stretched, RUN_SHORT, 0, 'sprint'), RUN_SHORT).endGlue).toEqual(
      stretchTo(RUN_LONG),
    )
  })

  it('records nothing when nothing changes', () => {
    const play = twoRuns()
    expect(updateRun(play, RUN_SHORT, { pace: 'jog' })).toBe(play)
    expect(updateRun(play, RUN_SHORT, { pace: 0 })).toBe(play)
    expect(updateRun(play, RUN_SHORT, { durationOverride: null })).toBe(play)
    expect(updateRun(play, RUN_SHORT, { durationOverride: -1 })).toBe(play)
    expect(updateRun(play, uuid(999), { pace: 'walk' })).toBe(play)
  })
})

describe('a glued edge follows its target (SPEC 5.8)', () => {
  it('follows after a waypoint of the target is moved', () => {
    const c = ctx()
    const play = setGlue(twoRuns(), {
      kind: 'start',
      ownerId: RUN_SHORT,
      glue: toEnd(RUN_LONG),
    }).play
    const moved = moveWaypoint(play, RUN_LONG, 0, { x: 60, y: 20 })
    const before = compileLine(play, [P.root], c.settings, c.caches).blocks[RUN_SHORT]?.start ?? 0
    const after = compileLine(moved, [P.root], c.settings, c.caches)
    expect(after.blocks[RUN_SHORT]?.start).toBeGreaterThan(before)
    expect(after.blocks[RUN_SHORT]?.start).toBeCloseTo(after.blocks[RUN_LONG]?.end ?? NaN, 9)
  })

  it('stays in the trunk for every option', () => {
    const c = ctx()
    const play: Play = {
      ...twoRuns(),
      branches: [
        branch(P.root, null, { branchAt: 9 }),
        branch(P.optA, P.root, { isDefault: true }),
        branch(P.optB, P.root),
      ],
    }
    const glued = setGlue(play, {
      kind: 'start',
      ownerId: RUN_SHORT,
      glue: toEnd(RUN_LONG),
    }).play
    const [one, other] = spans(glued, c)
    expect(one?.[RUN_SHORT]?.start).toBeCloseTo(other?.[RUN_SHORT]?.start ?? NaN, 9)
  })

  it('keeps a chain of three runs when the first one gets longer (D-177)', () => {
    const c = ctx()
    const [R1, R2, R3] = [uuid(310), uuid(311), uuid(312)]
    // Each run laid at the end of the one before, then glued to it: stored starts of the pose.
    let play = basePlay({
      entities: [player(A, 'A', 1)],
      setup: { positions: { [A]: { x: 20, y: 20 } }, ballCarrierId: null, ballPosition: null },
      actions: [run(R1, A, [{ x: 40, y: 20 }], { pace: 'sprint' })],
    })
    const endOf = (id: Id): number =>
      compileLine(play, [P.root], c.settings, c.caches).blocks[id]?.end ?? NaN
    play = {
      ...play,
      actions: [
        ...play.actions,
        run(R2, A, [{ x: 45, y: 22 }], { pace: 'sprint', start: endOf(R1) }),
      ],
    }
    play = {
      ...play,
      actions: [
        ...play.actions,
        run(R3, A, [{ x: 55, y: 32 }], { pace: 'sprint', start: endOf(R2) }),
      ],
    }
    play = setGlue(play, { kind: 'start', ownerId: R2, glue: toEnd(R1) }).play
    play = setGlue(play, { kind: 'start', ownerId: R3, glue: toEnd(R2) }).play
    const stored = runOf(play, R3).start
    const moved = moveWaypoint(play, R1, 0, { x: 80, y: 20 })
    const compiled = compileLine(moved, [P.root], c.settings, c.caches)
    const motionOf = (id: Id) => compiled.motions.find((m) => m.actionId === id)
    expect(compiled.blocks[R2]?.start ?? NaN).toBeGreaterThan(stored)
    expect(compiled.blocks[R2]?.start).toBeCloseTo(compiled.blocks[R1]?.end ?? NaN, 9)
    expect(compiled.blocks[R3]?.start).toBeCloseTo(compiled.blocks[R2]?.end ?? NaN, 9)
    expect(motionOf(R2)?.launch).not.toBeNull()
    expect(motionOf(R3)?.launch).not.toBeNull()
    expect(compiled.issues).toEqual([])
    expectGluesOnTarget(compiled)
  })
})
