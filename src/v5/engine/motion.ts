// Motions of a line (SPEC 5.2, 5.3): the curve, the speed profile and the instants of a run built
// from the position of its player at its start, or of the relayer joining a breakdown (SPEC 10.3).
// Pure: the result depends only on the inputs.
import { ARC_LENGTH_SAMPLES_PER_SEGMENT } from '../../config/defaults'
import {
  buildProfile,
  distanceAt,
  segmentPeak,
  solveLevers,
  speedAt,
  timeAtSegmentEnd,
  withDuration,
  type SpeedProfile,
} from '../../engine/profile'
import { buildSpline, pointAtDistance, type Spline } from '../../engine/spline'
import { copy } from '../../engine/vec'
import { canonicalJson } from '../../model/canonical'
import type { EngineSettings } from '../../model/settings'
import { speedOf } from '../../model/speed'
import type { BreakdownAction, Id, RunAction, Vec2 } from '../model/types'
import type { EvalCaches } from './caches'

/**
 * Peak speed, acceleration or braking beyond the orange (warning) or the red (danger) threshold
 * (SPEC 5.9, D-132).
 */
export type SpeedLevel = 'warning' | 'danger'

/** Acceleration or braking of a spline segment beyond a threshold (D-132). */
export interface AccelAlert {
  /** Spline segment. */
  segment: number
  kind: 'accel' | 'brake'
  level: SpeedLevel
  /** Peak acceleration, or peak braking as a positive value, in m/s². */
  peak: number
  /** Arc length of its badge, clear of the ends of the segment (D-132). */
  badgeAt: number
}

export interface RunMotion {
  actionId: Id
  entityId: Id
  /** Branch of the action: its issues target it. */
  branchId: Id
  /** Instant asked for: `start`, moved to the branch point when before it (SPEC 4.3). */
  planned: number
  /** Absolute start: `planned`, later when it has to wait (SPEC 5.2, 5.3). */
  start: number
  /** Duration of the speed profile. */
  duration: number
  spline: Spline
  profile: SpeedProfile
  waypoints: Vec2[]
  /** Absolute instant from which the motion is frozen by a breakdown (D-079), null otherwise. */
  until: number | null
  /** A run drawn by the user, or the relayer joining the breakdown (generated, D-079). */
  source: 'run' | 'relay'
  /** Target speed of each spline segment, levers included, in m/s. */
  targets: number[]
  /** Factor on the target speeds (imposed duration, relayer: f × k, D-130), 1 otherwise. */
  factor: number
  /** Factor on the accelerations (k², D-130), 1 otherwise. */
  accelFactor: number
  /** Spline segments at the sprint pace of the settings or faster: drawn thicker (D-115). */
  fastSegments: boolean[]
  /** Spline segments whose peak is beyond a speed threshold (SPEC 5.9), else null. */
  speedLevels: (SpeedLevel | null)[]
  /** Peak accelerations and brakings beyond a threshold, by spline segment (D-132). */
  accelAlerts: AccelAlert[]
}

/** Curve, profile and factors of a run, whatever its start instant. */
interface RunShape {
  spline: Spline
  profile: SpeedProfile
  targets: number[]
  factor: number
  accelFactor: number
  fastSegments: boolean[]
}

/** What the motions of a compilation share. */
export interface MotionContext {
  settings: EngineSettings
  caches: EvalCaches
  /** Shapes of this compilation, by run and start position: one profile per distinct request. */
  shapes: Map<string, RunShape>
}

function getSpline(points: Vec2[], caches: EvalCaches): Spline {
  const key = canonicalJson(points)
  const cached = caches.splines.get(key)
  if (cached) return cached
  const spline = buildSpline(points, ARC_LENGTH_SAMPLES_PER_SEGMENT)
  caches.splines.set(key, spline)
  return spline
}

/** Segments at the sprint pace of the settings or faster (D-115). */
function fastOf(targets: readonly number[], settings: EngineSettings): boolean[] {
  return targets.map((v) => v >= settings.paces.sprint - 1e-9)
}

/** Factor on target speeds where lever 2 takes over: the fastest at the top speed (D-130). */
function switchFactorOf(targets: readonly number[], settings: EngineSettings): number {
  return Math.max(1, settings.motion.topSpeed / Math.max(...targets, 1e-9))
}

/** The curve of a run with its levers: a common factor and a time scale (D-130). */
function shapeWithLevers(
  spline: Spline,
  inputTargets: readonly number[],
  factor: number,
  timeScale: number,
  { settings }: MotionContext,
): RunShape {
  const scaled = spline.sourceSegments.map((index) => (inputTargets[index] ?? 0) * factor)
  const profile = buildProfile({
    spline,
    targets: scaled,
    boundScale: scaled.map(() => timeScale),
    startSpeed: 0,
    endsAtSpeed: false,
    motion: settings.motion,
    sprint: settings.paces.sprint,
  })
  const targets = scaled.map((v) => v * timeScale)
  return {
    spline,
    profile,
    targets,
    factor: factor * timeScale,
    accelFactor: timeScale * timeScale,
    fastSegments: fastOf(targets, settings),
  }
}

/** The shape of a run from a position, its imposed duration met exactly (D-107, D-129). */
function runShape(run: RunAction, from: Vec2, context: MotionContext): RunShape {
  const key = `${run.id}|${from.x}|${from.y}`
  const known = context.shapes.get(key)
  if (known) return known
  const { settings, caches } = context
  const spline = getSpline([from, ...run.waypoints.map((w) => ({ x: w.x, y: w.y }))], caches)
  const inputTargets = run.waypoints.map((w) => speedOf(w.speed ?? run.pace, settings.paces))
  const build = (factor: number, timeScale: number) =>
    shapeWithLevers(spline, inputTargets, factor, timeScale, context)
  let shape = build(1, 1)
  const imposed = run.durationOverride
  if (imposed !== undefined) {
    const solution = solveLevers(
      (factor, timeScale) => build(factor, timeScale).profile,
      (profile) => profile.duration,
      imposed,
      switchFactorOf(inputTargets, settings),
    )
    // Beyond the bounds of the search, the whole profile is scaled in time (D-136).
    shape = {
      ...build(solution.factor, solution.timeScale),
      profile: withDuration(solution.profile, imposed),
    }
  }
  context.shapes.set(key, shape)
  return shape
}

/** Motion of a run starting at `start` from `from`. */
export function runMotion(
  run: RunAction,
  from: Vec2,
  planned: number,
  start: number,
  context: MotionContext,
): RunMotion {
  const shape = runShape(run, from, context)
  return {
    actionId: run.id,
    entityId: run.entityId,
    branchId: run.branchId,
    planned,
    start,
    duration: shape.profile.duration,
    spline: shape.spline,
    profile: shape.profile,
    waypoints: run.waypoints.map(copy),
    until: null,
    source: 'run',
    targets: shape.targets,
    factor: shape.factor,
    accelFactor: shape.accelFactor,
    fastSegments: shape.fastSegments,
    speedLevels: [],
    accelAlerts: [],
  }
}

/**
 * The relayer moving to the relay position at sprint pace, faster when late (D-079, D-130). `late`
 * gives her peak speed and the factor of her accelerations when she cannot arrive in time.
 */
export function relayMotion(
  action: BreakdownAction,
  from: Vec2,
  to: Vec2,
  formation: number,
  context: MotionContext,
): { motion: RunMotion; late: { speed: number; accel: number } | null } {
  const { settings, caches } = context
  const spline = getSpline([from, to], caches)
  const sprint = settings.paces.sprint
  const build = (factor: number, timeScale: number): SpeedProfile =>
    buildProfile({
      spline,
      targets: [sprint * factor],
      boundScale: [timeScale],
      startSpeed: 0,
      endsAtSpeed: false,
      motion: settings.motion,
      sprint,
    })
  let factor = 1
  let timeScale = 1
  let profile = build(1, 1)
  let late: { speed: number; accel: number } | null = null
  if (profile.duration > action.duration) {
    const solution = solveLevers(
      build,
      (p) => p.duration,
      action.duration,
      switchFactorOf([sprint], settings),
    )
    factor = solution.factor
    timeScale = solution.timeScale
    // Too far at sprint pace: she still arrives at the exit (D-079, D-136).
    profile = withDuration(solution.profile, action.duration)
    late = { speed: segmentPeak(profile, 0), accel: timeScale * timeScale }
  }
  const speed = sprint * factor * timeScale
  return {
    motion: {
      actionId: action.id,
      entityId: action.relayerId,
      branchId: action.branchId,
      planned: formation,
      start: formation,
      duration: profile.duration,
      spline,
      profile,
      waypoints: [copy(to)],
      until: null,
      source: 'relay',
      targets: [speed],
      factor: factor * timeScale,
      accelFactor: timeScale * timeScale,
      fastSegments: fastOf([speed], settings),
      speedLevels: [],
      accelAlerts: [],
    },
    late,
  }
}

/** Instant at which a motion stops: its end, or the breakdown that freezes it. */
export function motionEnd(motion: RunMotion): number {
  const end = motion.start + motion.duration
  return motion.until === null ? end : Math.min(end, motion.until)
}

/** Arc length covered by a motion at absolute time t (frozen after `until`). */
export function motionDistance(motion: RunMotion, t: number): number {
  const time = motion.until === null ? t : Math.min(t, motion.until)
  return distanceAt(motion.profile, time - motion.start)
}

/** Progress of a motion along its curve at absolute time t, in [0, 1]. */
export function motionProgress(motion: RunMotion, t: number): number {
  const length = motion.spline.length
  if (length <= 0) return t < motion.start ? 0 : 1
  return motionDistance(motion, t) / length
}

/** Position of a motion at absolute time t. */
export function motionPosition(motion: RunMotion, t: number): Vec2 {
  return pointAtDistance(motion.spline, motionDistance(motion, t))
}

/** Speed of a motion at absolute time t, in m/s (0 before it, after it and once frozen). */
export function motionSpeed(motion: RunMotion, t: number): number {
  if (motion.until !== null && t >= motion.until) return 0
  return speedAt(motion.profile, t - motion.start)
}

/** Velocity of a motion at absolute time t (speed along the direction of the curve). */
export function motionVelocity(motion: RunMotion, t: number): Vec2 {
  const speed = motionSpeed(motion, t)
  if (speed <= 0) return { x: 0, y: 0 }
  const { samples, cumulative } = motion.spline
  const s = motionDistance(motion, t)
  let k = 0
  while (k < cumulative.length - 2 && (cumulative[k + 1] ?? 0) <= s) k++
  const a = samples[k]
  const b = samples[k + 1]
  if (!a || !b) return { x: 0, y: 0 }
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  return len > 0
    ? { x: ((b.x - a.x) / len) * speed, y: ((b.y - a.y) / len) * speed }
    : { x: 0, y: 0 }
}

/** Instant, relative to the start of a motion, at which it reaches waypoint `index`. */
export function waypointTime(motion: Pick<RunMotion, 'spline' | 'profile'>, index: number): number {
  let segment = -1
  motion.spline.sourceSegments.forEach((source, j) => {
    if (source <= index) segment = j
  })
  return segment < 0 ? 0 : timeAtSegmentEnd(motion.profile, segment)
}

/**
 * The motion that gives the position of an entity at t, among motions in start order: the latest
 * started at t, or her first one before it starts (it stands at her position until then).
 */
export function motionAt(
  motions: readonly RunMotion[],
  entityId: Id,
  t: number,
): RunMotion | undefined {
  let current: RunMotion | undefined
  for (const motion of motions) {
    if (motion.entityId !== entityId) continue
    if (!current || motion.start <= t) current = motion
  }
  return current
}
