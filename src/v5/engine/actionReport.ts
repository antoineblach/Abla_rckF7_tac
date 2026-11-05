// Report of the actions of a line for the list of the editor (SPEC 6.7, D-113, D-145): one row per
// action, sorted by start then array order, with its absolute start and end and the details of its
// type. Pure.
import { segmentPeak } from '../../engine/profile'
import { distance } from '../../engine/vec'
import type { EngineSettings } from '../../model/settings'
import type { BreakdownKind, Id, Pace, Play, RunAction, SpeedValue, Vec2 } from '../model/types'
import type { EvalCaches } from './caches'
import {
  motionDistance,
  motionEnd,
  type AccelAlert,
  type RunMotion,
  type SpeedLevel,
} from './motion'
import { compileLine, type CompiledGlue } from './timeline'

/** Speed of a segment: the pace of the run, a pace of its own, or a typed speed (D-114). */
export type SegmentSpeedSource = 'run' | Pace | 'custom'

export interface SegmentReport {
  /** Input segment: from point index - 1 (the start for 0) to point index. */
  index: number
  length: number
  source: SegmentSpeedSource
  /** Target (peak) speed, factor included, in m/s. */
  target: number
  /** Peak speed reached, in m/s. */
  peak: number
  level: SpeedLevel | null
  fast: boolean
  /** Peak acceleration beyond a threshold (D-132), null below. */
  accel: AccelReport | null
  /** Peak braking beyond a threshold (D-132), null below. */
  brake: AccelReport | null
}

/** Peak acceleration or braking (positive) of a segment, in m/s², and its level (D-132). */
export interface AccelReport {
  peak: number
  level: SpeedLevel
}

export interface RunReport {
  kind: 'run'
  actionId: Id
  entityId: Id
  branchId: Id
  /** Absolute start and end. */
  start: number
  end: number
  /** False for a run that cannot be played (missing player). */
  applied: boolean
  /** « Départ retardé » : the start is later than the instant asked for by this delay, else 0. */
  delay: number
  /** Pace of the run: a named pace or a typed speed in m/s (D-133). */
  pace: SpeedValue
  /** Length of the drawn curve. */
  length: number
  duration: number
  meanSpeed: number
  peakSpeed: number
  segments: SegmentReport[]
  /** Factors of the levers on the target speeds and the accelerations (D-130), 1 otherwise. */
  factor: number
  accelFactor: number
  /** Frozen by a breakdown at this instant, null otherwise. */
  cutAt: number | null
  /** Ends at speed: the next run of the player is glued to its end, without gap (SPEC 5.2). */
  endsAtSpeed: boolean
  /** Ends at speed and is not stopped by a breakdown. */
  atSpeed: boolean
  /** Starts at speed, prolonging the run before it (SPEC 5.2). */
  prolongs: boolean
  startGlue: CompiledGlue | null
  endGlue: CompiledGlue | null
}

export interface PassReport {
  kind: 'pass'
  actionId: Id
  branchId: Id
  fromId: Id
  toId: Id
  /** Instant asked for; `start` waits for a reception within the tolerance (D-110). */
  plannedT: number
  /** Absolute release and arrival. */
  start: number
  end: number
  applied: boolean
  distance: number
  flight: number
  forward: boolean
  startGlue: CompiledGlue | null
  endGlue: CompiledGlue | null
}

export interface KickReport {
  kind: 'kick'
  actionId: Id
  branchId: Id
  kickerId: Id
  receiverId: Id | null
  /** Target point of a kick to a point, else null. */
  point: Vec2 | null
  plannedT: number
  start: number
  end: number
  applied: boolean
  distance: number
  flight: number
  startGlue: CompiledGlue | null
  endGlue: CompiledGlue | null
}

export interface BreakdownReport {
  kind: 'breakdown'
  actionId: Id
  branchId: Id
  breakdownKind: BreakdownKind
  tackledId: Id
  relayerId: Id
  /** Absolute formation and ball out. */
  start: number
  end: number
  applied: boolean
  startGlue: CompiledGlue | null
  endGlue: CompiledGlue | null
}

export type ActionReport = RunReport | PassReport | KickReport | BreakdownReport

export interface LineReport {
  line: Id[]
  duration: number
  rows: ActionReport[]
}

function accelReport(
  motion: RunMotion,
  segment: number,
  kind: AccelAlert['kind'],
): AccelReport | null {
  const alert = motion.accelAlerts.find((a) => a.segment === segment && a.kind === kind)
  return alert ? { peak: alert.peak, level: alert.level } : null
}

function segmentsOf(run: RunAction, motion: RunMotion): SegmentReport[] {
  const { spline, profile } = motion
  return run.waypoints.map((waypoint, index) => {
    const j = spline.sourceSegments.indexOf(index)
    const source: SegmentSpeedSource =
      waypoint.speed === undefined
        ? 'run'
        : typeof waypoint.speed === 'number'
          ? 'custom'
          : waypoint.speed
    if (j < 0) {
      return {
        index,
        length: 0,
        source,
        target: 0,
        peak: 0,
        level: null,
        fast: false,
        accel: null,
        brake: null,
      }
    }
    const from = spline.cumulative[j * spline.samplesPerSegment] ?? 0
    const to = spline.cumulative[(j + 1) * spline.samplesPerSegment] ?? spline.length
    return {
      index,
      length: to - from,
      source,
      target: motion.targets[j] ?? 0,
      peak: segmentPeak(profile, j),
      level: motion.speedLevels[j] ?? null,
      fast: motion.fastSegments[j] ?? false,
      accel: accelReport(motion, j, 'accel'),
      brake: accelReport(motion, j, 'brake'),
    }
  })
}

type EdgeReports = Pick<RunReport, 'startGlue' | 'endGlue'>

function runReport(run: RunAction, motion: RunMotion, edges: EdgeReports): RunReport {
  const end = motionEnd(motion)
  const covered = motionDistance(motion, Infinity)
  const duration = Math.max(0, end - motion.start)
  let peakSpeed = 0
  const { s, v } = motion.profile
  for (let k = 0; k < v.length && (s[k] ?? Infinity) <= covered; k++) {
    peakSpeed = Math.max(peakSpeed, v[k] ?? 0)
  }
  return {
    kind: 'run',
    actionId: run.id,
    entityId: run.entityId,
    branchId: run.branchId,
    start: motion.start,
    end,
    applied: true,
    delay: motion.start - motion.planned,
    pace: run.pace,
    length: motion.spline.length,
    duration,
    meanSpeed: duration > 0 ? covered / duration : 0,
    peakSpeed,
    segments: segmentsOf(run, motion),
    factor: motion.factor,
    accelFactor: motion.accelFactor,
    cutAt: motion.until === null || motion.until >= end ? null : motion.until,
    endsAtSpeed: motion.endsAtSpeed,
    atSpeed: motion.endsAtSpeed && motion.until === null,
    prolongs: motion.launch !== null,
    ...edges,
  }
}

/** A run without motion stays listed, to be selected and removed. */
function unplayedRun(run: RunAction, edges: EdgeReports): RunReport {
  return {
    kind: 'run',
    actionId: run.id,
    entityId: run.entityId,
    branchId: run.branchId,
    start: run.start,
    end: run.start,
    applied: false,
    delay: 0,
    pace: run.pace,
    length: 0,
    duration: 0,
    meanSpeed: 0,
    peakSpeed: 0,
    segments: [],
    factor: 1,
    accelFactor: 1,
    cutAt: null,
    endsAtSpeed: false,
    atSpeed: false,
    prolongs: false,
    ...edges,
  }
}

/** The report of the actions of a line. */
export function lineReport(
  play: Play,
  line: readonly Id[],
  settings: EngineSettings,
  caches: EvalCaches,
): LineReport {
  const compiled = compileLine(play, line, settings, caches)
  const rows: { row: ActionReport; index: number }[] = []
  play.actions.forEach((a, index) => {
    if (!compiled.line.includes(a.branchId)) return
    const push = (row: ActionReport) => rows.push({ row, index })
    const glueOf = (kind: 'start' | 'end'): CompiledGlue | null =>
      compiled.glues.find((g) => g.ownerId === a.id && g.kind === kind) ?? null
    const edges: EdgeReports = { startGlue: glueOf('start'), endGlue: glueOf('end') }
    switch (a.type) {
      case 'run': {
        const motion = compiled.motions.find((m) => m.source === 'run' && m.actionId === a.id)
        push(motion ? runReport(a, motion, edges) : unplayedRun(a, edges))
        return
      }
      case 'pass': {
        const p = compiled.passes.find((x) => x.actionId === a.id)
        if (!p) return
        push({
          kind: 'pass',
          actionId: a.id,
          branchId: a.branchId,
          fromId: p.fromId,
          toId: p.toId,
          plannedT: p.plannedT,
          start: p.releaseT,
          end: p.arrivalT,
          applied: p.applied,
          distance: distance(p.from, p.to),
          flight: p.arrivalT - p.releaseT,
          forward: p.forward,
          ...edges,
        })
        return
      }
      case 'kick': {
        const k = compiled.kicks.find((x) => x.actionId === a.id)
        if (!k) return
        push({
          kind: 'kick',
          actionId: a.id,
          branchId: a.branchId,
          kickerId: k.kickerId,
          receiverId: k.receiverId,
          point: k.receiverId === null ? { x: k.to.x, y: k.to.y } : null,
          plannedT: k.plannedT,
          start: k.releaseT,
          end: k.arrivalT,
          applied: k.applied,
          distance: distance(k.from, k.to),
          flight: k.arrivalT - k.releaseT,
          ...edges,
        })
        return
      }
      case 'breakdown': {
        const b = compiled.breakdowns.find((x) => x.actionId === a.id)
        if (!b) return
        push({
          kind: 'breakdown',
          actionId: a.id,
          branchId: a.branchId,
          breakdownKind: b.kind,
          tackledId: b.tackledId,
          relayerId: b.relayerId,
          start: b.start,
          end: b.end,
          applied: b.applied,
          ...edges,
        })
        return
      }
      case 'groupRun':
        // Lot 5, declared only.
        return
    }
  })
  rows.sort((a, b) => a.row.start - b.row.start || a.index - b.index)
  return { line: [...compiled.line], duration: compiled.duration, rows: rows.map((r) => r.row) }
}
