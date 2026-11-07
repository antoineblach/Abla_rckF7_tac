// Motions of a line (SPEC 5.2, 5.3): the curve, the speed profile and the instants of a run built
// from the position of its player at its start, or of the relayer joining a breakdown (SPEC 10.3).
// Pure: the result depends only on the inputs.
import { ARC_LENGTH_SAMPLES_PER_SEGMENT } from '../config/defaults'
import {
  admissibleStartSpeed,
  buildProfile,
  distanceAt,
  endSpeedOf,
  segmentPeak,
  solveLevers,
  speedAt,
  timeAtSegmentEnd,
  withDuration,
  type SpeedProfile,
} from './profile'
import { buildSpline, endDirection, pointAtDistance, type Spline } from './spline'
import { copy } from './vec'
import { canonicalJson } from '../model/canonical'
import type { EngineSettings } from '../model/settings'
import { speedOf } from '../model/speed'
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

/** Speed and direction a run starts with when it prolongs a run ending at speed (SPEC 5.2). */
export interface Launch {
  speed: number
  direction: Vec2
}

/** Levers of a run solved for a glued edge (SPEC 5.3, D-130). */
export interface RunLevers {
  factor: number
  timeScale: number
  /** Duration met exactly; null when the search stops at its slowest. */
  duration: number | null
}

/** What makes a run differ from its stored speeds (SPEC 5.2, 5.3, 5.8). */
export interface RunSpec {
  /** Levers solved for a glued edge: they replace an imposed duration. */
  levers: RunLevers | null
  /** The imposed duration does not apply (D-136). */
  ignoreImposed: boolean
  /** Ends at speed instead of stopping. */
  endsAtSpeed: boolean
  launch: Launch | null
  /** Highest arrival speed when it ends at speed (D-176), a bound in m/s, null otherwise. */
  arrivalCap: number | null
}

export const PLAIN_RUN: RunSpec = {
  levers: null,
  ignoreImposed: false,
  endsAtSpeed: false,
  launch: null,
  arrivalCap: null,
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
  /** Ends at speed: the next run of the player is glued to its end, without gap (SPEC 5.2). */
  endsAtSpeed: boolean
  /** Prolongs the run before it (SPEC 5.2), null when it starts from rest. */
  launch: Launch | null
  /** Highest arrival speed when it ends at speed (D-176), null otherwise and for a relayer. */
  arrivalCap: number | null
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

/** Curve and profile of a relayer joining a breakdown, whatever the formation instant. */
interface RelayShape {
  spline: Spline
  profile: SpeedProfile
  factor: number
  timeScale: number
  late: { speed: number; accel: number } | null
}

/** What the motions of a compilation share. */
export interface MotionContext {
  settings: EngineSettings
  caches: EvalCaches
  /** Shapes of this compilation, by run, start position and spec: one per distinct request. */
  shapes: Map<string, RunShape>
  /** Levers solved in this compilation, by the same key and the duration wanted. */
  solved: Map<string, RunLevers | null>
  /** Moves of a relayer in this compilation, by breakdown, positions and duration. */
  relays: Map<string, RelayShape>
}

export function createMotionContext(settings: EngineSettings, caches: EvalCaches): MotionContext {
  return { settings, caches, shapes: new Map(), solved: new Map(), relays: new Map() }
}

function getSpline(points: Vec2[], direction: Vec2 | null, caches: EvalCaches): Spline {
  const key = canonicalJson(direction ? { points, direction } : points)
  const cached = caches.splines.get(key)
  if (cached) return cached
  const spline = buildSpline(points, ARC_LENGTH_SAMPLES_PER_SEGMENT, direction)
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
  spec: RunSpec,
  { settings }: MotionContext,
): RunShape {
  const scaled = spline.sourceSegments.map((index) => (inputTargets[index] ?? 0) * factor)
  const profile = buildProfile({
    spline,
    targets: scaled,
    boundScale: scaled.map(() => timeScale),
    startSpeed: spec.launch?.speed ?? 0,
    endsAtSpeed: spec.endsAtSpeed,
    endSpeedCap: spec.arrivalCap,
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

/** Key of a run from a position with this spec, its levers aside. */
function specKey(run: RunAction, from: Vec2, spec: RunSpec): string {
  const { launch } = spec
  const launched = launch ? `${launch.speed}|${launch.direction.x}|${launch.direction.y}` : ''
  const ends = `${spec.endsAtSpeed}|${spec.arrivalCap}`
  return `${run.id}|${from.x}|${from.y}|${ends}|${spec.ignoreImposed}|${launched}`
}

/** The curve of a run from a position, and the target speeds drawn on it. */
function runCurve(
  run: RunAction,
  from: Vec2,
  direction: Vec2 | null,
  { settings, caches }: MotionContext,
): { spline: Spline; inputTargets: number[] } {
  return {
    spline: getSpline([from, ...run.waypoints.map((w) => ({ x: w.x, y: w.y }))], direction, caches),
    inputTargets: run.waypoints.map((w) => speedOf(w.speed ?? run.pace, settings.paces)),
  }
}

/**
 * Highest arrival speed of a run ending at speed (SPEC 5.2, D-176): the smallest admissible speed of
 * the runs that prolong it, each on its curve joined to this run, from its waypoints and its stored
 * speeds. It reads neither their start nor their levers, so it adds no edge to the dependency graph
 * (SPEC 4.3); in a chain, it goes from the last run to the first.
 */
export function arrivalCapOf(
  run: RunAction,
  from: Vec2,
  direction: Vec2 | null,
  followers: ReadonlyMap<Id, readonly RunAction[]>,
  context: MotionContext,
): number {
  const { motion, paces } = context.settings
  const { spline } = runCurve(run, from, direction, context)
  const end = spline.points[spline.points.length - 1] ?? from
  const arrival = endDirection(spline)
  let cap = Infinity
  for (const follower of followers.get(run.id) ?? []) {
    const curve = runCurve(follower, end, arrival, context)
    const chained = followers.has(follower.id)
    const admissible = admissibleStartSpeed({
      spline: curve.spline,
      targets: curve.spline.sourceSegments.map((index) => curve.inputTargets[index] ?? 0),
      endsAtSpeed: chained,
      endSpeedCap: chained ? arrivalCapOf(follower, end, arrival, followers, context) : null,
      motion,
      sprint: paces.sprint,
    })
    cap = Math.min(cap, admissible)
  }
  return cap
}

/**
 * The shape of a run from a position: its levers, or its imposed duration met exactly (D-107,
 * D-129), or its stored speeds.
 */
function runShape(run: RunAction, from: Vec2, spec: RunSpec, context: MotionContext): RunShape {
  const { levers } = spec
  const leversKey = levers ? `${levers.factor}|${levers.timeScale}|${levers.duration}` : ''
  const key = `${specKey(run, from, spec)}|${leversKey}`
  const known = context.shapes.get(key)
  if (known) return known
  const { spline, inputTargets } = runCurve(run, from, spec.launch?.direction ?? null, context)
  const build = (factor: number, timeScale: number) =>
    shapeWithLevers(spline, inputTargets, factor, timeScale, spec, context)
  let shape: RunShape
  const imposed = run.durationOverride
  if (levers) {
    const built = build(levers.factor, levers.timeScale)
    shape =
      levers.duration === null
        ? built
        : { ...built, profile: withDuration(built.profile, levers.duration) }
  } else if (imposed !== undefined && !spec.ignoreImposed) {
    const solution = solveLevers(
      (factor, timeScale) => build(factor, timeScale).profile,
      (profile) => profile.duration,
      imposed,
      switchFactorOf(inputTargets, context.settings),
    )
    // Beyond the bounds of the search, the whole profile is scaled in time (D-136).
    shape = {
      ...build(solution.factor, solution.timeScale),
      profile: withDuration(solution.profile, imposed),
    }
  } else {
    shape = build(1, 1)
  }
  context.shapes.set(key, shape)
  return shape
}

/**
 * The levers of a run from its stored speeds so that it lasts `duration` (SPEC 5.3, 5.8, D-136);
 * null beyond the bound of the search.
 */
export function solveRun(
  run: RunAction,
  from: Vec2,
  spec: RunSpec,
  duration: number,
  context: MotionContext,
): RunLevers | null {
  const key = `${specKey(run, from, spec)}|${duration}`
  const known = context.solved.get(key)
  if (known !== undefined) return known
  const { spline, inputTargets } = runCurve(run, from, spec.launch?.direction ?? null, context)
  const solution = solveLevers(
    (factor, timeScale) =>
      shapeWithLevers(spline, inputTargets, factor, timeScale, spec, context).profile,
    (profile) => profile.duration,
    duration,
    switchFactorOf(inputTargets, context.settings),
  )
  const levers =
    solution.status === 'beyond'
      ? null
      : {
          factor: solution.factor,
          timeScale: solution.timeScale,
          duration: solution.status === 'met' ? duration : null,
        }
  context.solved.set(key, levers)
  return levers
}

/** What a run that prolongs this one starts with; null when it ends at rest (SPEC 5.2). */
export function launchOf(previous: RunMotion): Launch | null {
  const speed = endSpeedOf(previous.profile)
  const direction = endDirection(previous.spline)
  return speed > 0 && direction ? { speed, direction } : null
}

/** Motion of a run starting at `start` from `from`. */
export function runMotion(
  run: RunAction,
  from: Vec2,
  planned: number,
  start: number,
  spec: RunSpec,
  context: MotionContext,
): RunMotion {
  const shape = runShape(run, from, spec, context)
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
    endsAtSpeed: spec.endsAtSpeed,
    launch: spec.launch,
    arrivalCap: spec.arrivalCap,
    fastSegments: shape.fastSegments,
    speedLevels: [],
    accelAlerts: [],
  }
}

function relayShape(
  action: BreakdownAction,
  from: Vec2,
  to: Vec2,
  context: MotionContext,
): RelayShape {
  const key = `${action.id}|${from.x}|${from.y}|${to.x}|${to.y}|${action.duration}`
  const known = context.relays.get(key)
  if (known) return known
  const { settings, caches } = context
  const spline = getSpline([from, to], null, caches)
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
  const profile = build(1, 1)
  let shape: RelayShape = { spline, profile, factor: 1, timeScale: 1, late: null }
  if (profile.duration > action.duration) {
    const solution = solveLevers(
      build,
      (p) => p.duration,
      action.duration,
      switchFactorOf([sprint], settings),
    )
    // Too far at sprint pace: she still arrives at the exit (D-079, D-136).
    const scaled = withDuration(solution.profile, action.duration)
    const { factor, timeScale } = solution
    const late = { speed: segmentPeak(scaled, 0), accel: timeScale * timeScale }
    shape = { spline, profile: scaled, factor, timeScale, late }
  }
  context.relays.set(key, shape)
  return shape
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
  const { settings } = context
  const { spline, profile, factor, timeScale, late } = relayShape(action, from, to, context)
  const speed = settings.paces.sprint * factor * timeScale
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
      endsAtSpeed: false,
      launch: null,
      arrivalCap: null,
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
