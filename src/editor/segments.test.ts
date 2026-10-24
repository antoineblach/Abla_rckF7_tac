// Editing of lot 3 bis (D-106, D-107, D-110, D-114): segment speeds kept by every move, « Finit
// lancée », release mode laid by the tools, segment under the pointer, speed shortcuts.
import { describe, expect, it } from 'vitest'
import { createCaches } from '../engine/caches'
import { ballObtainedAt, phaseSchematic } from '../engine/evaluate'
import { defaultSettings, engineSettingsOf } from '../model/settings'
import type { Action, Id, Play, RunAction } from '../model/types'
import {
  P,
  run,
  sequentialIds,
  setPiecesPlay,
  sevenVsSevenWithOptions,
  uuid,
} from '../test/builders'
import {
  addKick,
  addPass,
  addRun,
  markProlongedRun,
  moveWaypoint,
  setRunSync,
  setSegmentSpeed,
  updateKick,
  updatePass,
  updateRun,
  updateRunSync,
  type CommandContext,
} from './commands'
import { hitTest, segmentAt } from './hitTest'
import {
  actionsSelection,
  EMPTY_SELECTION,
  pruneSelection,
  segmentSelection,
  selectedSegment,
  waypointSelection,
} from './selection'
import { shortcutFor, type KeyInput } from './shortcuts'
import { mirrorPlay, translatePlay } from './transform'

const settings = engineSettingsOf(defaultSettings())
const ctx = (): CommandContext => ({ ids: sequentialIds(700), settings, caches: createCaches() })

function actionOf(play: Play, id: Id): Action {
  const action = play.phases.flatMap((p) => p.actions).find((a) => a.id === id)
  if (!action) throw new Error(`no action ${id}`)
  return action
}

function runOf(play: Play, id: Id): RunAction {
  const action = actionOf(play, id)
  if (action.type !== 'run') throw new Error(`not a run ${id}`)
  return action
}

const RUN_A4 = uuid(200)
const RUN_A5 = uuid(201)

describe('segment speeds (D-114)', () => {
  it('sets a named pace, a typed speed, or back to the pace of the run', () => {
    let play = sevenVsSevenWithOptions()
    play = setSegmentSpeed(play, RUN_A4, 1, 'sprint')
    expect(runOf(play, RUN_A4).waypoints[1]).toEqual({ x: 46, y: 40, speed: 'sprint' })
    play = setSegmentSpeed(play, RUN_A4, 0, 6.5)
    expect(runOf(play, RUN_A4).waypoints[0]?.speed).toBe(6.5)
    play = setSegmentSpeed(play, RUN_A4, 1, null)
    expect(runOf(play, RUN_A4).waypoints[1]).toEqual({ x: 46, y: 40 })
  })

  it('refuses a speed that is not positive, a missing segment, and changes nothing twice', () => {
    const play = setSegmentSpeed(sevenVsSevenWithOptions(), RUN_A4, 1, 'walk')
    expect(setSegmentSpeed(play, RUN_A4, 1, 0)).toBe(play)
    expect(setSegmentSpeed(play, RUN_A4, 1, Number.NaN)).toBe(play)
    expect(setSegmentSpeed(play, RUN_A4, 2, 'jog')).toBe(play)
    expect(setSegmentSpeed(play, RUN_A4, 1, 'walk')).toBe(play)
    expect(setSegmentSpeed(play, RUN_A4, 0, null)).toBe(play)
  })

  it('keeps the speed when a point is dragged, the play moved or flipped', () => {
    const play = setSegmentSpeed(sevenVsSevenWithOptions(), RUN_A4, 1, 'sprint')
    expect(runOf(moveWaypoint(play, RUN_A4, 1, { x: 50, y: 41 }), RUN_A4).waypoints[1]).toEqual({
      x: 50,
      y: 41,
      speed: 'sprint',
    })
    expect(runOf(translatePlay(play, { x: 2, y: 1 }), RUN_A4).waypoints[1]).toEqual({
      x: 48,
      y: 41,
      speed: 'sprint',
    })
    expect(runOf(mirrorPlay(play), RUN_A4).waypoints[1]).toEqual({
      x: 46,
      y: 30,
      speed: 'sprint',
    })
  })
})

describe('run settings (D-106, D-107)', () => {
  it('sets and clears « Finit lancée »', () => {
    let play = updateRun(sevenVsSevenWithOptions(), RUN_A4, { endsAtSpeed: true })
    expect(runOf(play, RUN_A4).endsAtSpeed).toBe(true)
    play = updateRun(play, RUN_A4, { endsAtSpeed: false })
    expect('endsAtSpeed' in runOf(play, RUN_A4)).toBe(false)
  })

  it('makes the imposed duration and the adjusted speed exclusive', () => {
    const linked = setRunSync(sevenVsSevenWithOptions(), RUN_A5, {
      target: { actionId: RUN_A4, event: 'runEnd' },
      adjust: 'speed',
    })
    expect(linked.refused).toBeNull()
    // An imposed duration removes the link with an adjusted speed...
    const timed = updateRun(linked.play, RUN_A5, { durationOverride: 4 })
    expect(runOf(timed, RUN_A5)).toMatchObject({ durationOverride: 4 })
    expect(runOf(timed, RUN_A5).sync).toBeUndefined()
    // ... but keeps a « Départ différé » link.
    const delayed = updateRunSync(linked.play, RUN_A5, { adjust: 'delay' })
    expect(runOf(updateRun(delayed, RUN_A5, { durationOverride: 4 }), RUN_A5).sync).toBeDefined()
    // An adjusted speed removes the imposed duration.
    const both = updateRun(delayed, RUN_A5, { durationOverride: 4 })
    const adjusted = updateRunSync(both, RUN_A5, { adjust: 'speed' })
    expect(runOf(adjusted, RUN_A5).durationOverride).toBeUndefined()
    const relinked = setRunSync(both, RUN_A5, {
      target: { actionId: RUN_A4, event: 'runEnd' },
      adjust: 'speed',
    })
    expect(runOf(relinked.play, RUN_A5).durationOverride).toBeUndefined()
  })

  it('refuses a pace that does not exist', () => {
    const play = sevenVsSevenWithOptions()
    expect(runOf(updateRun(play, RUN_A4, { pace: 'fly' as 'jog' }), RUN_A4).pace).toBe('jog')
  })
})

describe('release laid by the pass and kick tools (D-110, D-119)', () => {
  it('fixed instant from the carrier at the start, on receipt for a receiver', () => {
    const play = sevenVsSevenWithOptions()
    const carrier = addPass(play, P.t1, P.A(4), P.A(3), ctx())
    expect(actionOf(carrier.play, carrier.actionId ?? '')).toMatchObject({ delay: 0 })
    expect('release' in actionOf(carrier.play, carrier.actionId ?? '')).toBe(false)
    const receiver = addKick(play, P.t1, P.A(5), { point: { x: 70, y: 40 } }, ctx())
    expect(actionOf(receiver.play, receiver.actionId ?? '')).toMatchObject({
      delay: 0,
      release: 'onReceipt',
    })
    // Without any ball in the phase, on receipt too: it waits for a pass to come.
    const later = addPass(play, P.t1, P.A(1), P.A(2), ctx())
    expect(actionOf(later.play, later.actionId ?? '')).toMatchObject({ release: 'onReceipt' })
  })

  it('fixed instant of the pickup for a player who picks the ball up from the ground', () => {
    const play = setPiecesPlay()
    const c = ctx()
    const obtained = ballObtainedAt(play, P.t1, P.A(4), c.settings, c.caches)
    expect(obtained).not.toBeNull()
    const added = addPass(play, P.t1, P.A(4), P.A(2), c)
    const pass = actionOf(added.play, added.actionId ?? '')
    expect(pass).toMatchObject({ delay: obtained })
    expect('release' in pass).toBe(false)
  })

  it('sets and clears the release mode of a pass and of a kick', () => {
    let play = updatePass(sevenVsSevenWithOptions(), uuid(202), { release: 'onReceipt' })
    expect(actionOf(play, uuid(202))).toMatchObject({ release: 'onReceipt' })
    play = updatePass(play, uuid(202), { release: null })
    expect('release' in actionOf(play, uuid(202))).toBe(false)
    const kicked = addKick(play, P.t1, P.A(4), { point: { x: 80, y: 30 } }, ctx())
    const id = kicked.actionId ?? ''
    play = updateKick(kicked.play, id, { release: 'onReceipt' })
    expect(actionOf(play, id)).toMatchObject({ release: 'onReceipt' })
    play = updateKick(play, id, { release: null })
    expect('release' in actionOf(play, id)).toBe(false)
  })
})

describe('« Finit lancée » laid by the run tool (D-106)', () => {
  it('flags the run of the previous phase when every option prolongs it', () => {
    // T2 is the only option after T1: a run of A5 in T2, delay 0, prolongs her run of T1.
    const added = addRun(sevenVsSevenWithOptions(), P.t2, P.A(5), [{ x: 55, y: 50 }], ctx())
    expect(runOf(markProlongedRun(added.play, P.t2, P.A(5)), RUN_A5).endsAtSpeed).toBe(true)
  })

  it('waits for every option, and ignores a run that does not start at once', () => {
    const play = sevenVsSevenWithOptions()
    // T3 a has a run of A6, T3 b none: her run of T2 is not prolonged everywhere.
    expect(markProlongedRun(play, P.t3a, P.A(6))).toBe(play)
    const both = addRun(play, P.t3b, P.A(6), [{ x: 50, y: 62 }], ctx())
    expect(runOf(markProlongedRun(both.play, P.t3b, P.A(6)), uuid(210)).endsAtSpeed).toBe(true)
    const delayed = updateRun(both.play, both.actionId ?? '', { delay: 0.5 })
    expect(markProlongedRun(delayed, P.t3b, P.A(6))).toBe(delayed)
    // Root phase, or no run in the previous phase: nothing to flag.
    expect(markProlongedRun(play, P.t1, P.A(4))).toBe(play)
    const lone = addRun(play, P.t2, P.A(1), [{ x: 45, y: 5 }], ctx())
    expect(markProlongedRun(lone.play, P.t2, P.A(1))).toBe(lone.play)
  })
})

describe('segment under the pointer and selection (D-114)', () => {
  it('gives the segment of the run line under the pointer', () => {
    const play = sevenVsSevenWithOptions()
    const schematic = phaseSchematic(play, P.t1, settings, createCaches())
    const line = schematic?.runs.find((r) => r.actionId === RUN_A4)
    if (!schematic || !line) throw new Error('no run')
    expect(line.segmentEnds).toHaveLength(2)
    const early = line.points[8]
    const late = line.points[line.points.length - 8]
    if (!early || !late) throw new Error('no points')
    expect(segmentAt(line, early)).toBe(0)
    expect(segmentAt(line, late)).toBe(1)
    const tol = { token: 0.1, handle: 0.1, line: 0.5 }
    expect(hitTest(schematic, late, tol)).toEqual({ kind: 'run', actionId: RUN_A4, segment: 1 })
  })

  it('counts the segments of a duplicate point (zero length) without shifting the others', () => {
    const play = sevenVsSevenWithOptions()
    const doubled = {
      ...play,
      phases: play.phases.map((p) =>
        p.id === P.t1
          ? {
              ...p,
              actions: [
                run(uuid(200), P.A(4), [
                  { x: 44, y: 36 },
                  { x: 44, y: 36 },
                  { x: 46, y: 40 },
                ]),
              ],
            }
          : p,
      ),
    }
    const line = phaseSchematic(doubled, P.t1, settings, createCaches())?.runs[0]
    if (!line) throw new Error('no run')
    expect(line.segmentEnds[0]).toBe(line.segmentEnds[1])
    const late = line.points[line.points.length - 4]
    if (!late) throw new Error('no point')
    expect(segmentAt(line, late)).toBe(2)
  })

  it('designates the clicked segment, else the segment arriving at the selected point', () => {
    expect(selectedSegment(EMPTY_SELECTION)).toBeNull()
    expect(selectedSegment(actionsSelection([RUN_A4]))).toBeNull()
    expect(selectedSegment(waypointSelection(RUN_A4, 1))).toEqual({ actionId: RUN_A4, index: 1 })
    const segment = segmentSelection(RUN_A4, 0)
    expect(segment.actions).toEqual([RUN_A4])
    expect(selectedSegment(segment)).toEqual({ actionId: RUN_A4, index: 0 })
    expect(pruneSelection(segment, new Set(), new Set()).segment).toBeNull()
    expect(pruneSelection(segment, new Set(), new Set([RUN_A4]))).toBe(segment)
  })
})

describe('speed shortcuts 1, 2, 3 and 0 (D-114)', () => {
  const press = (input: Partial<KeyInput>) =>
    shortcutFor({ key: '', ctrl: false, shift: false, alt: false, ...input }, 0.1, 1)

  it('maps the digits of the top row and of the keypad, whatever the layout', () => {
    expect(press({ key: '1' })).toEqual({ kind: 'speed', speed: 'walk' })
    expect(press({ key: '2' })).toEqual({ kind: 'speed', speed: 'jog' })
    expect(press({ key: '3' })).toEqual({ kind: 'speed', speed: 'sprint' })
    expect(press({ key: '0' })).toEqual({ kind: 'speed', speed: null })
    // AZERTY without Shift: « & » and « à » on the keys 1 and 0.
    expect(press({ key: '&', code: 'Digit1' })).toEqual({ kind: 'speed', speed: 'walk' })
    expect(press({ key: 'à', code: 'Digit0' })).toEqual({ kind: 'speed', speed: null })
    expect(press({ key: '3', code: 'Numpad3' })).toEqual({ kind: 'speed', speed: 'sprint' })
  })

  it('leaves the other digits and Ctrl or Alt combinations alone', () => {
    expect(press({ key: '4' })).toBeNull()
    expect(press({ key: '1', ctrl: true })).toBeNull()
    expect(press({ key: '1', alt: true })).toBeNull()
  })
})
