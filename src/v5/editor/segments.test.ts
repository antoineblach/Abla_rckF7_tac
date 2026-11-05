// Editing of the speeds (D-114, D-133): segment speeds kept by every move, segment under the pointer,
// speed shortcuts.
import { describe, expect, it } from 'vitest'
import {
  actionsSelection,
  EMPTY_SELECTION,
  pruneSelection,
  segmentSelection,
  selectedSegment,
  waypointSelection,
} from '../../editor/selection'
import { shortcutFor, type KeyInput } from '../../editor/shortcuts'
import { defaultSettings, engineSettingsOf } from '../../model/settings'
import { createCaches } from '../engine/caches'
import { windowSchematic } from '../engine/evaluate'
import type { Id, Play, RunAction } from '../model/types'
import { P, run, sevenVsSevenWithOptions, uuid } from '../test/builders'
import { moveWaypoint, setSegmentSpeed, updateRun } from './commands'
import { hitTest, segmentAt } from './hitTest'
import { mirrorPlay, translatePlay } from './transform'

const settings = engineSettingsOf(defaultSettings())
const LINE = [P.root, P.optA]

function runOf(play: Play, id: Id): RunAction {
  const action = play.actions.find((candidate) => candidate.id === id)
  if (action?.type !== 'run') throw new Error(`not a run ${id}`)
  return action
}

const RUN_A4 = uuid(200)

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

describe('typed run pace (D-133)', () => {
  it('sets a speed in m/s as the pace of the run, then a named pace again', () => {
    let play = updateRun(sevenVsSevenWithOptions(), RUN_A4, { pace: 4.5 })
    expect(runOf(play, RUN_A4).pace).toBe(4.5)
    play = updateRun(play, RUN_A4, { pace: 'walk' })
    expect(runOf(play, RUN_A4).pace).toBe('walk')
  })

  it('refuses a speed that is not positive or finite, and changes nothing twice', () => {
    const play = updateRun(sevenVsSevenWithOptions(), RUN_A4, { pace: 4.5 })
    for (const pace of [0, -1, Number.NaN, Infinity, 4.5]) {
      expect(updateRun(play, RUN_A4, { pace })).toBe(play)
    }
    expect(updateRun(play, uuid(999), { pace: 3 })).toBe(play)
    // Another field applies, the invalid pace is ignored.
    const timed = updateRun(play, RUN_A4, { pace: 0, durationOverride: 2 })
    expect(runOf(timed, RUN_A4)).toMatchObject({ pace: 4.5, durationOverride: 2 })
  })

  it('refuses a pace that does not exist', () => {
    const play = sevenVsSevenWithOptions()
    expect(runOf(updateRun(play, RUN_A4, { pace: 'fly' as 'jog' }), RUN_A4).pace).toBe('jog')
  })
})

describe('segment under the pointer and selection (D-114)', () => {
  it('gives the segment of the run line under the pointer', () => {
    const play = sevenVsSevenWithOptions()
    const schematic = windowSchematic(play, LINE, 0, settings, createCaches())
    const line = schematic.runs.find((r) => r.actionId === RUN_A4)
    if (!line) throw new Error('no run')
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
    const doubled: Play = {
      ...play,
      actions: [
        run(uuid(200), P.A(4), [
          { x: 44, y: 36 },
          { x: 44, y: 36 },
          { x: 46, y: 40 },
        ]),
      ],
      sequences: [],
    }
    const line = windowSchematic(doubled, LINE, 0, settings, createCaches()).runs[0]
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
