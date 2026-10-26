// Report of the actions of a phase for the list of the editor (SPEC 6.7, D-113): one row per
// action, sorted by start then array order, with its start and end relative to the phase and the
// details of its type. Read on the compilation of the path to the phase, which is the same in
// every line through it (SPEC 5.2). Pure.
import { pathToPhase } from '../model/phaseTree'
import type { EngineSettings } from '../model/settings'
import type { BreakdownKind, Id, Pace, Play, RunAction, Vec2 } from '../model/types'
import type { EvalCaches } from './caches'
import { segmentPeak } from './profile'
import {
  compileLine,
  motionDistance,
  motionEnd,
  type AccelAlert,
  type RunMotion,
  type RunSyncResult,
  type SpeedLevel,
} from './timeline'
import { distance } from './vec'

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
  /** Start and end, relative to the start of the phase. */
  start: number
  end: number
  /** False for a second run of the player in the phase, or a run ignored after a breakdown. */
  applied: boolean
  pace: Pace
  /** Length of the drawn curve. */
  length: number
  duration: number
  meanSpeed: number
  peakSpeed: number
  segments: SegmentReport[]
  sync: RunSyncResult | null
  /** « Finit lancée » set, and in effect (ends at speed with the phase). */
  endsAtSpeed: boolean
  atSpeed: boolean
  /** « Finit lancée » without effect: wait before the next phase, in seconds. */
  launchWait: number | null
  /** Starts at speed, prolonging a run of the previous phase (D-106). */
  prolongs: boolean
  /** Frozen by a breakdown at this instant (relative), null otherwise. */
  cutAt: number | null
}

export interface ReleaseReport {
  releaseMode: 'fixed' | 'onReceipt'
  /** Planned instant of a fixed release (relative), null on receipt. */
  plannedT: number | null
}

export interface PassReport extends ReleaseReport {
  kind: 'pass'
  actionId: Id
  fromId: Id
  toId: Id
  /** Release and arrival, relative to the start of the phase. */
  start: number
  end: number
  applied: boolean
  distance: number
  flight: number
  forward: boolean
}

export interface KickReport extends ReleaseReport {
  kind: 'kick'
  actionId: Id
  kickerId: Id
  receiverId: Id | null
  /** Target point of a kick to a point, else null. */
  point: Vec2 | null
  start: number
  end: number
  applied: boolean
  distance: number
  flight: number
}

export interface BreakdownReport {
  kind: 'breakdown'
  actionId: Id
  breakdownKind: BreakdownKind
  tackledId: Id
  relayerId: Id
  /** Formation and ball out, relative to the start of the phase. */
  start: number
  end: number
  applied: boolean
}

export type ActionReport = RunReport | PassReport | KickReport | BreakdownReport

export interface PhaseReport {
  phaseId: Id
  /** Absolute start of the phase on its path. */
  start: number
  duration: number
  rows: ActionReport[]
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

function accelReport(
  motion: RunMotion,
  segment: number,
  kind: AccelAlert['kind'],
): AccelReport | null {
  const alert = motion.accelAlerts.find((a) => a.segment === segment && a.kind === kind)
  return alert ? { peak: alert.peak, level: alert.level } : null
}

function runReport(
  run: RunAction,
  motion: RunMotion,
  phaseStart: number,
  applied: boolean,
): RunReport {
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
    start: motion.start - phaseStart,
    end: end - phaseStart,
    applied,
    pace: run.pace,
    length: motion.spline.length,
    duration,
    meanSpeed: duration > 0 ? covered / duration : 0,
    peakSpeed,
    segments: segmentsOf(run, motion),
    sync: motion.sync,
    endsAtSpeed: run.endsAtSpeed === true,
    atSpeed: motion.endsAtSpeed && motion.until === null,
    launchWait: motion.launchWait,
    prolongs: motion.prolongs,
    cutAt: motion.until === null || motion.until >= end ? null : motion.until - phaseStart,
  }
}

/** The report of the actions of a phase, or null for an unknown phase. */
export function phaseReport(
  play: Play,
  phaseId: Id,
  settings: EngineSettings,
  caches: EvalCaches,
): PhaseReport | null {
  const source = play.phases.find((p) => p.id === phaseId)
  const compiled = compileLine(play, pathToPhase(play, phaseId), settings, caches)
  const phase = compiled.phases[compiled.phases.length - 1]
  if (!source || !phase || phase.phaseId !== phaseId) return null
  const start = phase.start
  const rows: { row: ActionReport; index: number }[] = []
  source.actions.forEach((a, index) => {
    const push = (row: ActionReport) => rows.push({ row, index })
    switch (a.type) {
      case 'run': {
        const motion = phase.motions.find((m) => m.source === 'run' && m.actionId === a.id)
        const ignored = phase.ignoredRuns.find((m) => m.actionId === a.id)
        if (motion) push(runReport(a, motion, start, true))
        else if (ignored) push(runReport(a, ignored, start, false))
        else {
          // A second run of the player in the phase (D-013): never played.
          push({
            kind: 'run',
            actionId: a.id,
            entityId: a.entityId,
            start: a.delay,
            end: a.delay,
            applied: false,
            pace: a.pace,
            length: 0,
            duration: 0,
            meanSpeed: 0,
            peakSpeed: 0,
            segments: [],
            sync: null,
            endsAtSpeed: a.endsAtSpeed === true,
            atSpeed: false,
            launchWait: null,
            prolongs: false,
            cutAt: null,
          })
        }
        return
      }
      case 'pass': {
        const p = phase.passes.find((x) => x.actionId === a.id)
        if (!p) return
        push({
          kind: 'pass',
          actionId: a.id,
          fromId: p.fromId,
          toId: p.toId,
          start: p.releaseT - start,
          end: p.arrivalT - start,
          applied: p.applied,
          distance: distance(p.from, p.to),
          flight: p.arrivalT - p.releaseT,
          forward: p.forward,
          releaseMode: p.releaseMode,
          plannedT: p.plannedT === null ? null : p.plannedT - start,
        })
        return
      }
      case 'kick': {
        const k = phase.kicks.find((x) => x.actionId === a.id)
        if (!k) return
        push({
          kind: 'kick',
          actionId: a.id,
          kickerId: k.kickerId,
          receiverId: k.receiverId,
          point: k.receiverId === null ? { x: k.to.x, y: k.to.y } : null,
          start: k.releaseT - start,
          end: k.arrivalT - start,
          applied: k.applied,
          distance: distance(k.from, k.to),
          flight: k.arrivalT - k.releaseT,
          releaseMode: k.releaseMode,
          plannedT: k.plannedT === null ? null : k.plannedT - start,
        })
        return
      }
      case 'breakdown': {
        const b = phase.breakdowns.find((x) => x.actionId === a.id)
        if (!b) return
        push({
          kind: 'breakdown',
          actionId: a.id,
          breakdownKind: b.kind,
          tackledId: b.tackledId,
          relayerId: b.relayerId,
          start: b.start - start,
          end: b.end - start,
          applied: b.applied,
        })
        return
      }
      case 'groupRun':
        // Lot 5, declared only.
        return
    }
  })
  rows.sort((a, b) => a.row.start - b.row.start || a.index - b.index)
  return { phaseId, start, duration: phase.end - start, rows: rows.map((r) => r.row) }
}
