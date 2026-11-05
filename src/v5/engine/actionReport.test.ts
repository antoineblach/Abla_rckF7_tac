import { describe, expect, it } from 'vitest'
import { defaultSettings, engineSettingsOf, type EngineSettings } from '../../model/settings'
import type { Action, Id, Play } from '../model/types'
import {
  P,
  basePlay,
  ball,
  branch,
  breakdown,
  kick,
  pass,
  player,
  realisticRunsPlay,
  run,
  uuid,
} from '../test/builders'
import { lineReport, type ActionReport } from './actionReport'
import { createCaches } from './caches'
import { evaluate, windowSchematic } from './evaluate'

const settings: EngineSettings = engineSettingsOf(defaultSettings())
const A = (n: number): Id => uuid(n)
const LINE = [P.root]

function play(actions: Action[]): Play {
  const positions: Record<Id, { x: number; y: number }> = {}
  for (let n = 1; n <= 4; n++) positions[A(n)] = { x: 40, y: 35 - 5 * n }
  return basePlay({
    entities: [...[1, 2, 3, 4].map((n) => player(A(n), 'A', n)), ball(uuid(90))],
    setup: { positions, ballCarrierId: A(1), ballPosition: null },
    actions,
  })
}

function rowOf(rows: ActionReport[], id: Id): ActionReport {
  const row = rows.find((r) => r.actionId === id)
  if (!row) throw new Error(`no row ${id}`)
  return row
}

describe('glues and runs at speed in the report (SPEC 5.2, 5.8)', () => {
  const fixture = realisticRunsPlay()
  const rows = lineReport(fixture, [P.root, P.optA], settings, createCaches()).rows

  it('reports the runs at speed and those that prolong them', () => {
    expect(rowOf(rows, uuid(500))).toMatchObject({ endsAtSpeed: true, atSpeed: true })
    expect(rowOf(rows, uuid(510))).toMatchObject({ prolongs: true, endsAtSpeed: false })
    // Stopped by the ruck: she does not go on at speed.
    expect(rowOf(rows, uuid(520))).toMatchObject({ atSpeed: false })
  })

  it('reports the glues of each edge, with their result', () => {
    expect(rowOf(rows, uuid(512))).toMatchObject({
      startGlue: null,
      endGlue: { status: 'ok', targetId: uuid(511), kind: 'end' },
    })
    expect(rowOf(rows, uuid(513))).toMatchObject({ startGlue: { status: 'ok' }, endGlue: null })
    expect(rowOf(rows, uuid(521))).toMatchObject({ startGlue: null, endGlue: null })
    expect(rowOf(rows, uuid(522))).toMatchObject({ endGlue: { status: 'late' } })
  })
})

describe('glue lines of the window (SPEC 5.8)', () => {
  const p = play([
    run(uuid(10), A(1), [{ x: 70, y: 30 }]),
    run(uuid(11), A(2), [{ x: 50, y: 25 }], {
      endGlue: { targetId: uuid(10), event: 'end', keep: 'duration' },
    }),
  ])

  it('gives the point of the edge and the point of the target', () => {
    const links = windowSchematic(p, LINE, 0, settings, createCaches()).glueLinks
    expect(links).toEqual([
      {
        ownerId: uuid(11),
        targetId: uuid(10),
        kind: 'end',
        from: { x: 50, y: 25 },
        to: { x: 70, y: 30 },
        status: 'ok',
      },
    ])
  })

  it('leaves out a block outside the window, and an edge without a point', () => {
    const withBranchPoint = play([
      run(uuid(10), A(1), [{ x: 70, y: 30 }]),
      run(uuid(11), A(2), [{ x: 50, y: 25 }], {
        branchId: P.optA,
        start: 9,
        startGlue: { targetId: P.root, event: 'end' },
      }),
    ])
    const split: Play = {
      ...withBranchPoint,
      branches: [
        branch(P.root, null, { branchAt: 3, branchAtGlue: { targetId: uuid(10), event: 'end' } }),
        branch(P.optA, P.root, { isDefault: true }),
        branch(P.optB, P.root),
      ],
    }
    const line = [P.root, P.optA]
    const inTrunk = windowSchematic(split, line, 0, settings, createCaches()).glueLinks
    expect(inTrunk).toEqual([])
    const end = windowSchematic(split, line, 100, settings, createCaches())
    expect(end.glueLinks.map((l) => l.ownerId)).toEqual([uuid(11)])
    expect(end.glueLinks[0]?.to).toBeNull()
  })
})

describe('report of the actions of a line (SPEC 6.7, D-113, D-145)', () => {
  const p = play([
    run(uuid(10), A(1), [
      { x: 50, y: 30 },
      { x: 70, y: 30, speed: 'sprint' },
    ]),
    pass(uuid(20), A(1), A(2), 4),
    run(uuid(11), A(2), [{ x: 45, y: 25 }], { start: 1 }),
    // Asked just before the reception: it waits for it (tolerance, D-110).
    kick(uuid(21), A(2), { point: { x: 70, y: 10 } }, 4.7),
    run(uuid(12), A(2), [{ x: 30, y: 25 }], { start: 1.5 }),
    breakdown(uuid(30), A(1), A(3), A(4), 9),
  ])
  const report = lineReport(p, LINE, settings, createCaches())
  const rows = report.rows

  it('lists every action of the line, sorted by start then array order', () => {
    expect(rows.map((r) => r.actionId)).toEqual([
      uuid(10),
      uuid(11),
      uuid(12),
      uuid(20),
      uuid(21),
      uuid(30),
    ])
    expect(report.line).toEqual(LINE)
    expect(report.duration).toBeCloseTo(
      evaluate(p, LINE, 1e9, settings, createCaches()).duration,
      12,
    )
  })

  it('gives the details of a run, its segments in km/h-ready m/s', () => {
    const r = rowOf(rows, uuid(10))
    if (r.kind !== 'run') throw new Error('not a run')
    expect(r.applied).toBe(true)
    expect(r.delay).toBe(0)
    expect(r.length).toBeCloseTo(30, 6)
    expect(r.duration).toBeCloseTo(r.end - r.start, 12)
    expect(r.meanSpeed).toBeCloseTo(30 / r.duration, 9)
    expect(r.peakSpeed).toBeCloseTo(5.5, 6)
    expect(r.segments.map((s) => [s.index, s.source, s.target, s.fast])).toEqual([
      [0, 'run', 4, false],
      [1, 'sprint', 5.5, true],
    ])
    expect(r.segments[0]?.length).toBeCloseTo(10, 6)
  })

  it('keeps a run without player in the list, as not applied', () => {
    const lost = play([run(uuid(13), uuid(777), [{ x: 1, y: 1 }], { start: 2 })])
    expect(lineReport(lost, LINE, settings, createCaches()).rows).toMatchObject([
      { kind: 'run', actionId: uuid(13), applied: false, start: 2, end: 2 },
    ])
  })

  it('gives the release, the arrival, the distance and the flight of a pass and a kick', () => {
    const thePass = rowOf(rows, uuid(20))
    const theKick = rowOf(rows, uuid(21))
    if (thePass.kind !== 'pass' || theKick.kind !== 'kick') throw new Error('wrong kinds')
    expect(thePass).toMatchObject({
      fromId: A(1),
      toId: A(2),
      applied: true,
      plannedT: 4,
      start: 4,
    })
    // The fixed point on a moving receiver, within 2 ms (SPEC 5.4).
    expect(thePass.flight).toBeCloseTo(thePass.distance / 12, 2)
    expect(theKick).toMatchObject({ plannedT: 4.7, receiverId: null, applied: true })
    expect(theKick.point).toEqual({ x: 70, y: 10 })
    expect(theKick.start).toBeCloseTo(thePass.end, 12)
    expect(theKick.flight).toBeCloseTo(3.5, 12)
  })

  it('gives the formation and the ball out of a breakdown', () => {
    expect(rowOf(rows, uuid(30))).toMatchObject({
      kind: 'breakdown',
      breakdownKind: 'ruck',
      start: 9,
      end: 12,
      tackledId: A(1),
    })
  })

  it('leaves out the actions of the other options and an unknown line', () => {
    expect(lineReport(p, [uuid(4242)], settings, createCaches()).rows).toEqual([])
  })
})

describe('fast parts and speed badges (D-112, D-115)', () => {
  it('cuts the trace and the schematic of a run by speed', () => {
    const p = play([
      run(uuid(10), A(1), [
        { x: 50, y: 30 },
        { x: 70, y: 30, speed: 'sprint' },
        { x: 75, y: 30 },
      ]),
    ])
    const schematic = windowSchematic(p, LINE, 0, settings, createCaches())
    const parts = schematic.runs[0]?.parts ?? []
    expect(parts.map((part) => part.fast)).toEqual([false, true, false])
    expect(parts[1]?.points[0]).toEqual({ x: 50, y: 30 })
    expect(parts[1]?.points.at(-1)).toEqual({ x: 70, y: 30 })
    // During playback: only what has been run.
    const t = 3
    const trace = evaluate(p, LINE, t, settings, createCaches()).traces[0]
    expect(trace?.parts.map((part) => part.fast)).toEqual([false])
    expect(trace?.parts[0]?.points.at(-1)).toEqual(trace?.points.at(-1))
  })

  it('places a badge in the middle of a segment beyond a threshold, once entered', () => {
    const p = play([
      run(uuid(10), A(1), [
        { x: 50, y: 30 },
        { x: 90, y: 30, speed: 6.5 },
      ]),
    ])
    const schematic = windowSchematic(p, LINE, 0, settings, createCaches())
    const badges = schematic.speedBadges
    expect(badges.map((b) => [b.actionId, b.segment, b.level])).toEqual([[uuid(10), 1, 'warning']])
    // In the middle of the segment, by arc length (to the millimetre of the length table).
    expect(badges[0]?.pos.x).toBeCloseTo(70, 2)
    expect(badges[0]?.pos.y).toBeCloseTo(30, 9)
    const early = evaluate(p, LINE, 1, settings, createCaches())
    const later = evaluate(p, LINE, 6, settings, createCaches())
    expect(early.speedBadges).toEqual([])
    expect(later.speedBadges.map((b) => b.level)).toEqual(['warning'])
  })
})
