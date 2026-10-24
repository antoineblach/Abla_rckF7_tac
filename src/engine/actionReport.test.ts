import { describe, expect, it } from 'vitest'
import { defaultSettings, engineSettingsOf, type EngineSettings } from '../model/settings'
import type { Action, Id, Play } from '../model/types'
import {
  basePlay,
  ball,
  breakdown,
  kick,
  P,
  pass,
  phase,
  player,
  realisticRunsPlay,
  run,
  uuid,
} from '../test/builders'
import { phaseReport, type ActionReport } from './actionReport'
import { createCaches } from './caches'
import { evaluate, phaseSchematic } from './evaluate'
import { compileLine } from './timeline'

const settings: EngineSettings = engineSettingsOf(defaultSettings())
const A = (n: number): Id => uuid(n)
const T1 = uuid(100)
const T2 = uuid(101)

function play(t1: Action[], t2: Action[] = []): Play {
  const positions: Record<Id, { x: number; y: number }> = {}
  for (let n = 1; n <= 4; n++) positions[A(n)] = { x: 40, y: 35 - 5 * n }
  return basePlay({
    entities: [...[1, 2, 3, 4].map((n) => player(A(n), 'A', n)), ball(uuid(90))],
    setup: { positions, ballCarrierId: A(1), ballPosition: null },
    phases: [phase(T1, null, t1), phase(T2, T1, t2)],
  })
}

function rowOf(rows: ActionReport[], id: Id): ActionReport {
  const row = rows.find((r) => r.actionId === id)
  if (!row) throw new Error(`no row ${id}`)
  return row
}

describe('report of the actions of a phase (SPEC 6.7, D-113)', () => {
  const p = play(
    [
      run(uuid(10), A(1), [
        { x: 50, y: 30 },
        { x: 70, y: 30, speed: 'sprint' },
      ]),
      pass(uuid(20), A(1), A(2), 4),
      run(uuid(11), A(2), [{ x: 45, y: 25 }], { delay: 1 }),
      kick(uuid(21), A(2), { point: { x: 70, y: 10 } }, 0, { release: 'onReceipt' }),
      run(uuid(12), A(2), [{ x: 30, y: 25 }]),
    ],
    [breakdown(uuid(30), A(1), A(3), A(4), 0.5)],
  )
  const report = phaseReport(p, T1, settings, createCaches())
  if (!report) throw new Error('no report')
  const rows = report.rows

  it('lists every action, sorted by start then array order', () => {
    expect(rows.map((r) => r.actionId)).toEqual([uuid(10), uuid(12), uuid(11), uuid(20), uuid(21)])
    const phase1 = compileLine(p, [T1], settings, createCaches()).phases[0]
    expect(report.duration).toBeCloseTo((phase1?.end ?? 0) - (phase1?.start ?? 0), 12)
    expect(report.start).toBe(0)
  })

  it('gives the details of a run, its segments in km/h-ready m/s', () => {
    const r = rowOf(rows, uuid(10))
    if (r.kind !== 'run') throw new Error('not a run')
    expect(r.applied).toBe(true)
    expect(r.length).toBeCloseTo(30, 6)
    expect(r.duration).toBeCloseTo(r.end - r.start, 12)
    expect(r.meanSpeed).toBeCloseTo(30 / r.duration, 9)
    expect(r.peakSpeed).toBeCloseTo(5.5, 6)
    expect(r.segments.map((s) => [s.index, s.source, s.target, s.fast])).toEqual([
      [0, 'run', 4, false],
      [1, 'sprint', 5.5, true],
    ])
    expect(r.segments[0]?.length).toBeCloseTo(10, 6)
    expect(r.sync).toBeNull()
  })

  it('marks the second run of a player as not applied', () => {
    const r = rowOf(rows, uuid(12))
    expect(r).toMatchObject({ kind: 'run', applied: false, start: 0, end: 0 })
  })

  it('gives the release, the arrival, the distance and the flight of a pass and a kick', () => {
    const thePass = rowOf(rows, uuid(20))
    const theKick = rowOf(rows, uuid(21))
    if (thePass.kind !== 'pass' || theKick.kind !== 'kick') throw new Error('wrong kinds')
    expect(thePass).toMatchObject({ fromId: A(1), toId: A(2), applied: true, plannedT: 4 })
    expect(thePass.releaseMode).toBe('fixed')
    expect(thePass.flight).toBeCloseTo(thePass.distance / 12, 6)
    expect(theKick).toMatchObject({ releaseMode: 'onReceipt', plannedT: null, receiverId: null })
    expect(theKick.point).toEqual({ x: 70, y: 10 })
    expect(theKick.start).toBeCloseTo(thePass.end, 12)
    expect(theKick.flight).toBeCloseTo(3.5, 12)
  })

  it('gives the formation and the ball out of a breakdown', () => {
    const next = phaseReport(p, T2, settings, createCaches())
    expect(next?.rows[0]).toMatchObject({
      kind: 'breakdown',
      breakdownKind: 'ruck',
      start: 0.5,
      end: 3.5,
      tackledId: A(1),
    })
  })

  it('reports the links, the runs at speed and the waits of the lot 3 bis fixture', () => {
    const fixture = realisticRunsPlay()
    const t1 = phaseReport(fixture, P.t1, settings, createCaches())
    const linked = rowOf(t1?.rows ?? [], uuid(501))
    if (linked.kind !== 'run') throw new Error('not a run')
    expect(linked.sync).toMatchObject({ adjust: 'delay', status: 'ok' })
    const launched = rowOf(t1?.rows ?? [], uuid(500))
    expect(launched).toMatchObject({ endsAtSpeed: true, atSpeed: false })
    if (launched.kind === 'run') expect(launched.launchWait).toBeGreaterThan(0)
    expect(phaseReport(fixture, uuid(4242), settings, createCaches())).toBeNull()
  })
})

describe('fast parts, speed badges and links (D-112, D-115, SPEC 5.8)', () => {
  it('cuts the trace and the schematic of a run by speed', () => {
    const p = play([
      run(uuid(10), A(1), [
        { x: 50, y: 30 },
        { x: 70, y: 30, speed: 'sprint' },
        { x: 75, y: 30 },
      ]),
    ])
    const schematic = phaseSchematic(p, T1, settings, createCaches())
    const parts = schematic?.runs[0]?.parts ?? []
    expect(parts.map((part) => part.fast)).toEqual([false, true, false])
    expect(parts[1]?.points[0]).toEqual({ x: 50, y: 30 })
    expect(parts[1]?.points.at(-1)).toEqual({ x: 70, y: 30 })
    // During playback: only what has been run.
    const t = 3
    const trace = evaluate(p, [T1], t, settings, createCaches()).traces[0]
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
    const schematic = phaseSchematic(p, T1, settings, createCaches())
    const badges = schematic?.speedBadges ?? []
    expect(badges.map((b) => [b.actionId, b.segment, b.level])).toEqual([[uuid(10), 1, 'warning']])
    // In the middle of the segment, by arc length (to the millimetre of the length table).
    expect(badges[0]?.pos.x).toBeCloseTo(70, 2)
    expect(badges[0]?.pos.y).toBeCloseTo(30, 9)
    const early = evaluate(p, [T1], 1, settings, createCaches())
    const later = evaluate(p, [T1], 6, settings, createCaches())
    expect(early.speedBadges).toEqual([])
    expect(later.speedBadges.map((b) => b.level)).toEqual(['warning'])
  })

  it('gives the points of a link in the schematic', () => {
    const p = play([
      run(uuid(10), A(1), [{ x: 70, y: 30 }]),
      run(uuid(11), A(2), [{ x: 50, y: 25 }], {
        sync: { target: { actionId: uuid(10), event: 'runEnd' }, adjust: 'delay' },
      }),
    ])
    const links = phaseSchematic(p, T1, settings, createCaches())?.syncLinks ?? []
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({
      actionId: uuid(11),
      targetActionId: uuid(10),
      from: { x: 50, y: 25 },
      to: { x: 70, y: 30 },
    })
    expect(links[0]?.result.status).toBe('ok')
  })
})
