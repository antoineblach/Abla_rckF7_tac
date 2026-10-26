// Compilation of a line (path from the root): phase start times and durations, entity motions,
// ball possession, passes, kicks and breakdowns (SPEC 5.1 to 5.7, 10.3, 10.4, D-079, D-094).
// Pure: the result depends only on the inputs.
//
// Runs follow a speed profile (profile.ts, SPEC 5.3, D-105): bounded acceleration and braking,
// speed limited in turns, a target speed per segment. A run « Finit lancée » ends at speed when it
// ends with its phase, and the run that prolongs it in the next phase of the line starts at that
// speed in its arrival direction (SPEC 5.2, D-106): the phase is compiled with the runs at speed,
// then again with a normal braking for those that end before the end of the phase.
//
// A run linked to another action of its phase (SPEC 5.8, D-108) is adjusted in the order of the
// dependencies of the links: the instant of its target is read on a simulation of the phase.
//
// Ball events of a phase (fixed releases, breakdown formations, releases on receipt queued by the
// receptions, D-110) are processed in chronological order; between two events, flight arrivals,
// breakdown ends and loose-ball pickups are resolved.
// A breakdown only applies when the tackled player holds the ball, so no flight is in progress:
// it changes motions only after its formation, and everything computed before stays exact.
import {
  ARC_LENGTH_SAMPLES_PER_SEGMENT,
  PASS_RECEIPT_TOLERANCE,
  RELAY_OFFSET,
} from '../config/defaults'
import { canonicalJson, contentHash } from '../model/canonical'
import type { Issue } from '../model/issues'
import { phaseLabelOf } from '../model/labels'
import { findPhase } from '../model/phaseTree'
import type { EngineSettings } from '../model/settings'
import { analyseSyncs, meetsOwnPass } from '../model/syncGraph'
import {
  attackDirection,
  isBall,
  isPlayer,
  isReceiverTarget,
  type BreakdownAction,
  type BreakdownKind,
  type Id,
  type KickAction,
  type KickKind,
  type PassAction,
  type Play,
  type PlayerEntity,
  type RunAction,
  type RunSync,
  type Team,
  type Vec2,
} from '../model/types'
import { findPickup, isForwardPass, kickFlightTime, velocityBefore } from './ballEvents'
import type { EvalCaches } from './caches'
import { solvePassArrival } from './pass'
import {
  buildProfile,
  distanceAt,
  endSpeedOf,
  segmentPeak,
  solveFactor,
  speedAt,
  timeAtSegmentEnd,
  withDuration,
  type SpeedProfile,
} from './profile'
import { buildSpline, endDirection, pointAtDistance, type Spline } from './spline'
import { copy, distance } from './vec'

const SIMULTANEOUS_EPSILON = 1e-9

/** Largest speed factor of the relayer, who must reach the relay position by the exit (D-079). */
const RELAY_MAX_FACTOR = 1000

export interface RunMotion {
  actionId: Id
  entityId: Id
  /** Absolute start time (phase start + effective delay). */
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
  /** Target speed of each spline segment, factor included, in m/s. */
  targets: number[]
  /** Common factor applied to the target speeds (imposed duration, D-107), 1 otherwise. */
  factor: number
  /** Ends at speed with its phase (« Finit lancée » with effect, D-106). */
  endsAtSpeed: boolean
  /** « Finit lancée » without effect: wait before the next phase, in seconds; null otherwise. */
  launchWait: number | null
  /** Starts at the end speed of the run it prolongs (D-106). */
  prolongs: boolean
  /** Its synchronisation link, resolved (SPEC 5.8); null without link or when it cannot apply. */
  sync: RunSyncResult | null
  /** Spline segments at the sprint pace of the settings or faster: drawn thicker (D-115). */
  fastSegments: boolean[]
  /** Spline segments whose peak is beyond a speed threshold (SPEC 5.9), else null. */
  speedLevels: (SpeedLevel | null)[]
}

/** Peak speed beyond the orange (warning) or the red (danger) threshold (SPEC 5.9). */
export type SpeedLevel = 'warning' | 'danger'

/** A synchronisation link once resolved (SPEC 5.8, D-108). */
export interface RunSyncResult {
  adjust: 'delay' | 'speed'
  /** Delay of the run: computed (« Départ différé ») or stored. */
  delay: number
  /** Common factor on the segments before the rendez-vous (« Vitesse ajustée »), or 1. */
  factor: number
  /** 'late': delay below 0, started at once; 'capped': speed capped at the red threshold. */
  status: 'ok' | 'late' | 'capped' | 'unreached'
  /** Absolute instant of the target, null when it is never reached. */
  targetT: number | null
  /** Point of the run that meets the target (rendez-vous or end). */
  meetPoint: Vec2
  /** Point of the target, null when it is never reached. */
  targetPoint: Vec2 | null
}

/** Release of a pass or a kick (D-110). */
export interface ReleaseInfo {
  releaseMode: 'fixed' | 'onReceipt'
  /** Planned instant of a fixed release (start + delay), null for a release on receipt. */
  plannedT: number | null
}

export interface CompiledPass extends ReleaseInfo {
  actionId: Id
  fromId: Id
  toId: Id
  /** Absolute release and arrival times. */
  releaseT: number
  arrivalT: number
  from: Vec2
  to: Vec2
  /** False when the pass is ignored (passer without ball, simultaneous pass). */
  applied: boolean
  /** « En avant probable » (SPEC 5.7). */
  forward: boolean
}

export interface CompiledKick extends ReleaseInfo {
  actionId: Id
  kickerId: Id
  kind: KickKind
  /** Receiver, or null for a kick to a point. */
  receiverId: Id | null
  releaseT: number
  arrivalT: number
  from: Vec2
  to: Vec2
  /** False when the kick is ignored (kicker without ball, simultaneous release). */
  applied: boolean
}

export interface CompiledBreakdown {
  actionId: Id
  kind: BreakdownKind
  tackledId: Id
  supportId: Id
  relayerId: Id
  /** Absolute formation and exit times. */
  start: number
  end: number
  /** Point of the tackled player at formation: ball position and gain line (SPEC 10.3). */
  pos: Vec2
  /** False when the tackled player has no ball at formation (D-079). */
  applied: boolean
}

/** Ball state from `start` until the start of the next segment of the phase. */
export type BallSegment =
  | { kind: 'carried'; start: number; carrierId: Id }
  | {
      kind: 'flight'
      start: number
      end: number
      from: Vec2
      to: Vec2
      toId: Id | null
      actionId: Id
      via: 'pass' | 'kick'
    }
  | { kind: 'loose'; start: number; pos: Vec2 }
  | { kind: 'breakdown'; start: number; end: number; pos: Vec2; actionId: Id }
  | { kind: 'none'; start: number }

export type BallHolder =
  { kind: 'carried'; carrierId: Id } | { kind: 'loose'; pos: Vec2 } | { kind: 'none' }

/** The gain line moves to x at instant t (SPEC 5.6). */
export interface GainLineChange {
  t: number
  x: number
}

/** A run ending at speed with its phase, which the next phase may prolong (D-106). */
export interface LaunchedRun {
  actionId: Id
  phaseId: Id
  speed: number
  /** Unit direction of arrival. */
  direction: Vec2
}

export interface CompiledPhase {
  phaseId: Id
  start: number
  end: number
  instruction: string
  startPositions: Record<Id, Vec2>
  endPositions: Record<Id, Vec2>
  /** Applied motions: at most one run per entity, possibly frozen, then relay moves. */
  motions: RunMotion[]
  /** Runs of breakdown participants starting after the formation: ignored (D-079). */
  ignoredRuns: RunMotion[]
  passes: CompiledPass[]
  kicks: CompiledKick[]
  breakdowns: CompiledBreakdown[]
  /** Ball segments in chronological order; the first one starts with the phase. */
  ball: BallSegment[]
  holderAtStart: BallHolder
  holderAtEnd: BallHolder
  /** Runs ending at speed with the phase, by entity (D-106). */
  launched: Record<Id, LaunchedRun>
}

export interface CompiledLine {
  line: Id[]
  phases: CompiledPhase[]
  duration: number
  players: PlayerEntity[]
  hasBall: boolean
  /** Gain line changes in time order; empty without ball (SPEC 5.6). */
  gainLine: GainLineChange[]
  attackingTeam: Team
  field: { length: number; width: number; inGoal: number }
  issues: Issue[]
}

function getSpline(points: Vec2[], direction: Vec2 | null, caches: EvalCaches): Spline {
  const key = canonicalJson(direction ? { points, direction } : points)
  const cached = caches.splines.get(key)
  if (cached) return cached
  const spline = buildSpline(points, ARC_LENGTH_SAMPLES_PER_SEGMENT, direction)
  caches.splines.set(key, spline)
  return spline
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

/** Position of an entity at absolute time t inside a compiled phase. */
export function positionInPhase(phase: CompiledPhase, entityId: Id, t: number): Vec2 | undefined {
  // The motions of an entity are in start order: its first one, then the latest started at t.
  let current: RunMotion | undefined
  for (const motion of phase.motions) {
    if (motion.entityId !== entityId) continue
    if (!current || motion.start <= t) current = motion
  }
  if (current) return motionPosition(current, t)
  const start = phase.startPositions[entityId]
  return start ? copy(start) : undefined
}

type LiveHolder = BallHolder | { kind: 'flight' } | { kind: 'breakdown' }

type BallAction = PassAction | KickAction | BreakdownAction

function settledHolder(holder: LiveHolder): BallHolder {
  return holder.kind === 'flight' || holder.kind === 'breakdown' ? { kind: 'none' } : holder
}

function segmentOf(holder: BallHolder, start: number): BallSegment {
  if (holder.kind === 'carried') return { kind: 'carried', start, carrierId: holder.carrierId }
  if (holder.kind === 'loose') return { kind: 'loose', start, pos: copy(holder.pos) }
  return { kind: 'none', start }
}

/** The motion with another profile of the same curve (a solved factor, D-107). */
function withProfile(motion: RunMotion, profile: SpeedProfile): RunMotion {
  return { ...motion, profile, duration: profile.duration }
}

/** Target speed of each input segment of a run: its own, or the pace of the run (D-114). */
function runTargets(run: RunAction, settings: EngineSettings): number[] {
  return run.waypoints.map((w) => {
    if (w.speed === undefined) return settings.paces[run.pace]
    return typeof w.speed === 'number' ? w.speed : settings.paces[w.speed]
  })
}

/** Target speeds of the spline segments (zero-length input segments are dropped). */
function splineTargets(spline: Spline, inputTargets: readonly number[]): number[] {
  return spline.sourceSegments.map((index) => inputTargets[index] ?? 0)
}

interface RunPlan {
  run: RunAction
  points: Vec2[]
  inputTargets: number[]
  /** Run ending at speed in the previous phase that this run may prolong (D-106). */
  launchCandidate: LaunchedRun | null
  /** The link of the run applies (usable and outside any cycle, D-108). */
  linked: boolean
}

interface MotionSpec {
  delay: number
  /** Ends at speed (« Finit lancée » kept for this compilation). */
  endsAtSpeed: boolean
  /** Prolonged run ending at speed (start speed and direction, D-106), or null. */
  launch: LaunchedRun | null
  /** Common factor on the target speeds. */
  factor: number
  /** Last input segment the factor applies to; null: every segment. */
  factorUpTo: number | null
}

interface CompiledDraft {
  phase: CompiledPhase
  issues: Issue[]
  gainLine: GainLineChange[]
}

/** Event of the ball queue: a fixed release or formation, or a release on receipt (D-110). */
interface QueuedEvent {
  t: number
  index: number
  action: BallAction
  /** Planned instant of a fixed release, null for a release on receipt or a formation. */
  planned: number | null
  /** Already postponed to a reception (tolerance of a fixed release, D-110). */
  postponed: boolean
}

/** Instant, relative to the start of a motion, at which it reaches waypoint `index`. */
export function waypointTime(motion: Pick<RunMotion, 'spline' | 'profile'>, index: number): number {
  let segment = -1
  motion.spline.sourceSegments.forEach((source, j) => {
    if (source <= index) segment = j
  })
  return segment < 0 ? 0 : timeAtSegmentEnd(motion.profile, segment)
}

/** Arc length from the start of a run to its rendez-vous point (`at`, or its end). */
function meetDistance(spline: Spline, at: number | undefined): number {
  if (at === undefined) return spline.length
  let segment = -1
  spline.sourceSegments.forEach((source, j) => {
    if (source <= at) segment = j
  })
  if (segment < 0) return 0
  const k = Math.min((segment + 1) * spline.samplesPerSegment, spline.cumulative.length - 1)
  return spline.cumulative[k] ?? spline.length
}

/** Instant, relative to the start of a motion, of its rendez-vous point (`at`, or its end). */
function meetTime(motion: Pick<RunMotion, 'spline' | 'profile'>, at: number | undefined): number {
  return at === undefined ? motion.profile.duration : waypointTime(motion, at)
}

function compilePhase(
  play: Play,
  phaseId: Id,
  start: number,
  startPositions: Record<Id, Vec2>,
  holderAtStart: BallHolder,
  previous: CompiledPhase | null,
  settings: EngineSettings,
  caches: EvalCaches,
  issues: Issue[],
  gainLine: GainLineChange[],
): CompiledPhase | null {
  const phase = findPhase(play, phaseId)
  if (!phase) return null
  const players = new Map<Id, PlayerEntity>()
  for (const entity of play.entities) if (isPlayer(entity)) players.set(entity.id, entity)
  const playerIds = play.entities
    .filter(isPlayer)
    .map((p) => p.id)
    .filter((id) => startPositions[id] !== undefined)
  const analysis = analyseSyncs(phase)
  const launched = previous?.launched ?? {}

  // Runs: at most one per entity; the first one in array order applies (DECISIONS Q13).
  const plans: RunPlan[] = []
  const fixed: QueuedEvent[] = []
  const onReceipt: { action: PassAction | KickAction; index: number }[] = []
  const staticIssues: Issue[] = []
  phase.actions.forEach((action, index) => {
    const target = { kind: 'action', id: action.id, phaseId } as const
    if (action.type === 'run') {
      const startPos = startPositions[action.entityId]
      if (!players.has(action.entityId) || !startPos) return
      if (plans.some((p) => p.run.entityId === action.entityId)) {
        staticIssues.push({
          code: 'twoRunsSamePhase',
          severity: 'error',
          target,
          params: { id: action.entityId },
        })
        return
      }
      plans.push({
        run: action,
        points: [startPos, ...action.waypoints.map((w) => ({ x: w.x, y: w.y }))],
        inputTargets: runTargets(action, settings),
        launchCandidate: launched[action.entityId] ?? null,
        linked: analysis.order.includes(action.id),
      })
    } else if ((action.type === 'pass' || action.type === 'kick') && action.release) {
      onReceipt.push({ action, index })
    } else if (action.type === 'pass' || action.type === 'kick' || action.type === 'breakdown') {
      const t = start + action.delay
      fixed.push({
        t,
        index,
        action,
        planned: action.type === 'breakdown' ? null : t,
        postponed: false,
      })
    } else {
      staticIssues.push({
        code: 'unsupportedAction',
        severity: 'warning',
        target,
        params: { type: action.type },
      })
    }
  })

  /** Motion of a run with a common speed factor. */
  const motionOf = (plan: RunPlan, spec: MotionSpec): RunMotion => {
    const spline = getSpline(plan.points, spec.launch?.direction ?? null, caches)
    const scaled = plan.inputTargets.map((v, i) =>
      spec.factorUpTo === null || i <= spec.factorUpTo ? v * spec.factor : v,
    )
    const targets = splineTargets(spline, scaled)
    const profile = buildProfile({
      spline,
      targets,
      startSpeed: spec.launch?.speed ?? 0,
      endsAtSpeed: spec.endsAtSpeed,
      motion: settings.motion,
      sprint: settings.paces.sprint,
    })
    return {
      actionId: plan.run.id,
      entityId: plan.run.entityId,
      start: start + spec.delay,
      duration: profile.duration,
      spline,
      profile,
      waypoints: plan.run.waypoints.map(copy),
      until: null,
      source: 'run',
      targets,
      factor: spec.factor,
      endsAtSpeed: spec.endsAtSpeed,
      launchWait: null,
      prolongs: spec.launch !== null,
      sync: null,
      fastSegments: fastOf(targets, settings),
      speedLevels: [],
    }
  }

  /** Motion of a run, the imposed duration solved by a common factor (D-107). */
  const runMotion = (plan: RunPlan, spec: MotionSpec, out: Issue[]): RunMotion => {
    const imposed = plan.run.durationOverride
    // A link with an adjusted speed replaces the imposed duration (D-107).
    if (imposed === undefined || (plan.linked && plan.run.sync?.adjust === 'speed')) {
      return motionOf(plan, spec)
    }
    const fastest = Math.max(...plan.inputTargets, 1e-9)
    const solution = solveFactor(
      (factor) => motionOf(plan, { ...spec, factor, factorUpTo: null }).profile,
      (profile) => profile.duration,
      imposed,
      settings.speedAlert.danger / fastest,
    )
    const profile =
      solution.capped === 'none' ? withDuration(solution.profile, imposed) : solution.profile
    const motion = withProfile(
      motionOf(plan, { ...spec, factor: solution.factor, factorUpTo: null }),
      profile,
    )
    if (solution.capped === 'slow') {
      out.push({
        code: 'durationCapped',
        severity: 'warning',
        target: { kind: 'action', id: plan.run.id, phaseId },
        params: { duration: motion.duration },
      })
    }
    return motion
  }

  /** Motion of a run before its link is resolved: stored delay and speeds. */
  const baseSpec = (plan: RunPlan, atSpeed: ReadonlySet<Id>): MotionSpec => ({
    delay: plan.run.delay,
    endsAtSpeed: atSpeed.has(plan.run.id),
    launch: plan.run.delay <= SIMULTANEOUS_EPSILON ? plan.launchCandidate : null,
    factor: 1,
    factorUpTo: null,
  })

  /** Ball events of the phase on the given run motions (relays and freezes added). */
  const simulate = (
    runMotions: RunMotion[],
    localIssues: Issue[],
    localGainLine: GainLineChange[],
  ): CompiledPhase => {
    const draft: CompiledPhase = {
      phaseId,
      start,
      end: start,
      instruction: phase.instruction,
      startPositions,
      endPositions: {},
      motions: runMotions.map((m) => ({ ...m, until: null })),
      ignoredRuns: [],
      passes: [],
      kicks: [],
      breakdowns: [],
      ball: [segmentOf(holderAtStart, start)],
      holderAtStart,
      holderAtEnd: holderAtStart,
      launched: {},
    }
    const at = (id: Id, t: number): Vec2 | undefined => positionInPhase(draft, id, t)

    // Live ball state, advanced event by event.
    let holder: LiveHolder = holderAtStart
    let flight: { arrivalT: number; toId: Id | null; to: Vec2 } | null = null
    let exit: { t: number; relayerId: Id } | null = null
    let looseSince = start
    const releases: number[] = []
    const queue: QueuedEvent[] = fixed.map((e) => ({ ...e }))
    // Releases on receipt waiting for a reception of their player, in array order (D-110).
    const waiting = new Map<Id, { action: PassAction | KickAction; index: number }[]>()
    for (const entry of onReceipt) {
      const playerId = entry.action.type === 'pass' ? entry.action.fromId : entry.action.kickerId
      waiting.set(playerId, [...(waiting.get(playerId) ?? []), entry])
    }

    /** A player receives the ball: her next release on receipt is due after its delay. */
    const received = (playerId: Id, t: number): void => {
      const next = waiting.get(playerId)?.shift()
      if (!next) return
      queue.push({
        t: t + next.action.delay,
        index: next.index,
        action: next.action,
        planned: null,
        postponed: false,
      })
    }

    /** Resolves the first transition at or before te; false when there is none. */
    const advanceOne = (te: number): boolean => {
      if (flight && flight.arrivalT <= te) {
        const landed = flight
        flight = null
        if (landed.toId !== null) {
          holder = { kind: 'carried', carrierId: landed.toId }
          draft.ball.push({ kind: 'carried', start: landed.arrivalT, carrierId: landed.toId })
          received(landed.toId, landed.arrivalT)
        } else {
          holder = { kind: 'loose', pos: copy(landed.to) }
          looseSince = landed.arrivalT
          draft.ball.push({ kind: 'loose', start: landed.arrivalT, pos: copy(landed.to) })
        }
        return true
      }
      if (exit && exit.t <= te) {
        const out = exit
        exit = null
        holder = { kind: 'carried', carrierId: out.relayerId }
        draft.ball.push({ kind: 'carried', start: out.t, carrierId: out.relayerId })
        received(out.relayerId, out.t)
        return true
      }
      if (holder.kind === 'loose' && looseSince <= te) {
        const found = findPickup(holder.pos, looseSince, te, playerIds, at)
        if (found) {
          holder = { kind: 'carried', carrierId: found.id }
          draft.ball.push({ kind: 'carried', start: found.t, carrierId: found.id })
          return true
        }
        looseSince = te
      }
      return false
    }

    const carries = (id: Id): boolean => holder.kind === 'carried' && holder.carrierId === id
    const simultaneous = (t: number): boolean =>
      releases.some((r) => Math.abs(r - t) <= SIMULTANEOUS_EPSILON)

    /** Reception of the ball by a player still to come in the phase, or null (D-110). */
    const upcomingReception = (id: Id): number | null => {
      if (flight && flight.toId === id) return flight.arrivalT
      if (exit && exit.relayerId === id) return exit.t
      return null
    }

    /**
     * A fixed release by a player who receives the ball a little later waits for it (tolerance,
     * D-110): the event is put back at the reception. True when postponed.
     */
    const postpone = (event: QueuedEvent, playerId: Id): boolean => {
      if (event.planned === null || event.postponed || carries(playerId)) return false
      const reception = upcomingReception(playerId)
      if (reception === null || reception > event.t + PASS_RECEIPT_TOLERANCE) return false
      queue.push({ ...event, t: reception, postponed: true })
      return true
    }

    /** Release on receipt never triggered: ignored and signalled, never played (D-110). */
    const unreceived = (action: PassAction | KickAction): void => {
      const releaseT = start + action.delay
      const target = { kind: 'action', id: action.id, phaseId } as const
      const fromId = action.type === 'pass' ? action.fromId : action.kickerId
      const from = at(fromId, releaseT)
      if (!players.has(fromId) || !from) return
      const release = { releaseMode: 'onReceipt' as const, plannedT: null }
      if (action.type === 'pass') {
        const to = at(action.toId, releaseT)
        if (!players.has(action.toId) || !to) return
        localIssues.push({ code: 'passerWithoutBall', severity: 'error', target })
        draft.passes.push({
          actionId: action.id,
          fromId,
          toId: action.toId,
          releaseT,
          arrivalT: releaseT,
          from,
          to,
          applied: false,
          forward: false,
          ...release,
        })
        return
      }
      const receiverId = isReceiverTarget(action.target) ? action.target.receiverId : null
      const to =
        'point' in action.target
          ? copy(action.target.point)
          : at(action.target.receiverId, releaseT)
      if (!to) return
      localIssues.push({ code: 'kickerWithoutBall', severity: 'error', target })
      draft.kicks.push({
        actionId: action.id,
        kickerId: fromId,
        kind: action.kind,
        receiverId,
        releaseT,
        arrivalT: releaseT + kickFlightTime(action),
        from,
        to,
        applied: false,
        ...release,
      })
    }

    const startFlight = (
      actionId: Id,
      via: 'pass' | 'kick',
      from: Vec2,
      to: Vec2,
      releaseT: number,
      arrivalT: number,
      toId: Id | null,
    ): void => {
      holder = { kind: 'flight' }
      flight = { arrivalT, toId, to: copy(to) }
      draft.ball.push({
        kind: 'flight',
        start: releaseT,
        end: arrivalT,
        from: copy(from),
        to: copy(to),
        toId,
        actionId,
        via,
      })
    }

    const handlePass = (action: PassAction, event: QueuedEvent): void => {
      const releaseT = event.t
      const target = { kind: 'action', id: action.id, phaseId } as const
      const passer = players.get(action.fromId)
      const receiver = players.get(action.toId)
      if (!passer || !receiver) return
      if (postpone(event, passer.id)) return
      const from = at(passer.id, releaseT)
      const receiverAtRelease = at(receiver.id, releaseT)
      if (!from || !receiverAtRelease) return
      const release = {
        releaseMode: action.release === 'onReceipt' ? ('onReceipt' as const) : ('fixed' as const),
        plannedT: event.planned,
      }
      const ignored = (code: 'simultaneousPass' | 'passerWithoutBall'): void => {
        localIssues.push({ code, severity: 'error', target })
        draft.passes.push({
          actionId: action.id,
          fromId: passer.id,
          toId: receiver.id,
          releaseT,
          arrivalT: releaseT,
          from,
          to: receiverAtRelease,
          applied: false,
          forward: false,
          ...release,
        })
      }
      if (simultaneous(releaseT)) {
        ignored('simultaneousPass')
        return
      }
      releases.push(releaseT)
      if (!carries(passer.id)) {
        ignored('passerWithoutBall')
        return
      }
      if (passer.team !== receiver.team) {
        // Executed as drawn, but signalled (DECISIONS Q13).
        localIssues.push({ code: 'passToOpponent', severity: 'error', target })
      }
      const speed = action.ballSpeed ?? settings.passSpeed
      const arrivalT = solvePassArrival(
        from,
        releaseT,
        speed,
        (t) => at(receiver.id, t) ?? receiverAtRelease,
      )
      const to = at(receiver.id, arrivalT) ?? receiverAtRelease
      // Speed of the passer when she lets go, read on the parent phase at the very start (D-085).
      const passerAt = (t: number): Vec2 | undefined =>
        t < start && previous ? positionInPhase(previous, passer.id, t) : at(passer.id, t)
      const forward = isForwardPass(
        from,
        to,
        releaseT,
        arrivalT,
        velocityBefore(passerAt, releaseT),
        passer.team,
      )
      if (forward) localIssues.push({ code: 'forwardPass', severity: 'warning', target })
      draft.passes.push({
        actionId: action.id,
        fromId: passer.id,
        toId: receiver.id,
        releaseT,
        arrivalT,
        from,
        to,
        applied: true,
        forward,
        ...release,
      })
      startFlight(action.id, 'pass', from, to, releaseT, arrivalT, receiver.id)
    }

    const handleKick = (action: KickAction, event: QueuedEvent): void => {
      const releaseT = event.t
      const target = { kind: 'action', id: action.id, phaseId } as const
      const kicker = players.get(action.kickerId)
      if (!kicker) return
      if (postpone(event, kicker.id)) return
      const from = at(kicker.id, releaseT)
      if (!from) return
      const arrivalT = releaseT + kickFlightTime(action)
      let receiverId: Id | null = null
      let to: Vec2 | undefined
      if (isReceiverTarget(action.target)) {
        const receiver = players.get(action.target.receiverId)
        if (!receiver) return
        receiverId = receiver.id
        to = at(receiver.id, arrivalT)
      } else {
        to = copy(action.target.point)
      }
      if (!to) return
      const compiled: CompiledKick = {
        actionId: action.id,
        kickerId: kicker.id,
        kind: action.kind,
        receiverId,
        releaseT,
        arrivalT,
        from,
        to,
        applied: false,
        releaseMode: action.release === 'onReceipt' ? 'onReceipt' : 'fixed',
        plannedT: event.planned,
      }
      if (simultaneous(releaseT)) {
        localIssues.push({ code: 'simultaneousPass', severity: 'error', target })
        draft.kicks.push(compiled)
        return
      }
      releases.push(releaseT)
      if (!carries(kicker.id)) {
        localIssues.push({ code: 'kickerWithoutBall', severity: 'error', target })
        draft.kicks.push(compiled)
        return
      }
      draft.kicks.push({ ...compiled, applied: true })
      startFlight(action.id, 'kick', from, to, releaseT, arrivalT, receiverId)
    }

    /** Freezes the motions of a breakdown participant at the formation (D-079). */
    const freezeAt = (entityId: Id, tf: number): void => {
      for (const motion of [...draft.motions]) {
        if (motion.entityId !== entityId || motionEnd(motion) <= tf + SIMULTANEOUS_EPSILON) {
          continue
        }
        if (motion.source === 'run') {
          localIssues.push({
            code: 'runCutByBreakdown',
            severity: 'warning',
            target: { kind: 'action', id: motion.actionId, phaseId },
          })
        }
        motion.until = tf
        if (motion.start >= tf) {
          // Not started at the formation: entirely ignored (its applied part is empty).
          draft.motions.splice(draft.motions.indexOf(motion), 1)
          if (motion.source === 'run') draft.ignoredRuns.push(motion)
        }
      }
    }

    /** Relayer moving to the relay position at sprint pace, faster when late (D-079). */
    const relayMotion = (
      action: BreakdownAction,
      relayerId: Id,
      from: Vec2,
      to: Vec2,
      tf: number,
    ): RunMotion => {
      const spline = getSpline([from, to], null, caches)
      const sprint = settings.paces.sprint
      const build = (factor: number): SpeedProfile =>
        buildProfile({
          spline,
          targets: [sprint * factor],
          startSpeed: 0,
          endsAtSpeed: false,
          motion: settings.motion,
          sprint: settings.paces.sprint,
        })
      let factor = 1
      let profile = build(1)
      if (profile.duration > action.duration) {
        const solution = solveFactor(build, (p) => p.duration, action.duration, RELAY_MAX_FACTOR)
        factor = solution.factor
        // Too far even with bounded accelerations: she still arrives at the exit (D-079).
        profile = withDuration(solution.profile, action.duration)
        localIssues.push({
          code: 'relayerLate',
          severity: 'warning',
          target: { kind: 'action', id: action.id, phaseId },
        })
      }
      return {
        actionId: action.id,
        entityId: relayerId,
        start: tf,
        duration: profile.duration,
        spline,
        profile,
        waypoints: [copy(to)],
        until: null,
        source: 'relay',
        targets: [sprint * factor],
        factor,
        endsAtSpeed: false,
        launchWait: null,
        prolongs: false,
        sync: null,
        fastSegments: fastOf([sprint * factor], settings),
        speedLevels: [],
      }
    }

    const handleBreakdown = (action: BreakdownAction, tf: number): void => {
      const target = { kind: 'action', id: action.id, phaseId } as const
      const tackled = players.get(action.tackledId)
      const support = players.get(action.supportId)
      const relayer = players.get(action.relayerId)
      if (!tackled || !support || !relayer) return
      if (new Set([tackled.id, support.id, relayer.id]).size < 3) return
      const pos = at(tackled.id, tf)
      if (!pos || !at(support.id, tf) || !at(relayer.id, tf)) return
      const compiled: CompiledBreakdown = {
        actionId: action.id,
        kind: action.kind,
        tackledId: tackled.id,
        supportId: support.id,
        relayerId: relayer.id,
        start: tf,
        end: tf + action.duration,
        pos: copy(pos),
        applied: false,
      }
      if (!carries(tackled.id)) {
        localIssues.push({ code: 'tackledWithoutBall', severity: 'error', target })
        draft.breakdowns.push(compiled)
        return
      }
      for (const id of [tackled.id, support.id, relayer.id]) freezeAt(id, tf)
      // The relayer joins the relay position at sprint pace, then waits (SPEC 10.3, D-079).
      const relayFrom = at(relayer.id, tf) ?? pos
      const relayTo = { x: pos.x - RELAY_OFFSET * attackDirection(tackled.team), y: pos.y }
      if (distance(relayFrom, relayTo) > SIMULTANEOUS_EPSILON) {
        draft.motions.push(relayMotion(action, relayer.id, relayFrom, relayTo, tf))
      }
      draft.breakdowns.push({ ...compiled, applied: true })
      holder = { kind: 'breakdown' }
      exit = { t: compiled.end, relayerId: relayer.id }
      draft.ball.push({
        kind: 'breakdown',
        start: tf,
        end: compiled.end,
        pos: copy(pos),
        actionId: action.id,
      })
      localGainLine.push({ t: tf, x: pos.x })
    }

    /** Events in chronological order (stable on array order); transitions are resolved first. */
    const drain = (): void => {
      for (;;) {
        let next: QueuedEvent | undefined
        for (const event of queue) {
          if (!next || event.t < next.t || (event.t === next.t && event.index < next.index)) {
            next = event
          }
        }
        if (!next) return
        // A reception may queue a release on receipt before `next`: look again.
        if (advanceOne(next.t)) continue
        queue.splice(queue.indexOf(next), 1)
        const action = next.action
        if (action.type === 'pass') handlePass(action, next)
        else if (action.type === 'kick') handleKick(action, next)
        else handleBreakdown(action, next.t)
      }
    }

    // Phase duration = max(delay + duration) of its applied actions, 0 without action (SPEC 5.1);
    // a breakdown lasts until the ball comes out (SPEC 10.3). Transitions up to the end may still
    // trigger releases on receipt, which may make the phase longer.
    const phaseEnd = (): number => {
      let end = start
      for (const motion of draft.motions) end = Math.max(end, motionEnd(motion))
      for (const p of draft.passes) if (p.applied) end = Math.max(end, p.arrivalT)
      for (const k of draft.kicks) if (k.applied) end = Math.max(end, k.arrivalT)
      for (const b of draft.breakdowns) if (b.applied) end = Math.max(end, b.end)
      return end
    }
    let end: number
    do {
      drain()
      end = phaseEnd()
      while (advanceOne(end)) {
        // Every transition up to the end of the phase.
      }
    } while (queue.length > 0)
    // A release on receipt whose player never received the ball: ignored (D-110, D-013).
    for (const entries of waiting.values()) {
      for (const { action } of entries) unreceived(action)
    }
    draft.end = end
    // Every flight and breakdown is over at the end of the phase: advanceOne resolved them.
    draft.holderAtEnd = settledHolder(holder)
    return draft
  }

  /** Instant and point of the target of a link on a simulation of the phase, or null. */
  const targetOf = (
    probe: CompiledPhase,
    plan: RunPlan,
    sync: RunSync,
  ): { t: number; point: Vec2 } | null => {
    const target = sync.target
    switch (target.event) {
      case 'runEnd':
      case 'runPoint': {
        const m = probe.motions.find((x) => x.source === 'run' && x.actionId === target.actionId)
        if (!m) return null
        if (target.event === 'runEnd') {
          const t = motionEnd(m)
          return { t, point: motionPosition(m, t) }
        }
        const t = m.start + waypointTime(m, target.index)
        if (m.until !== null && t > m.until + SIMULTANEOUS_EPSILON) return null
        const point = m.waypoints[target.index]
        return point ? { t, point: copy(point) } : null
      }
      case 'release':
      case 'arrival': {
        const pass = probe.passes.find((p) => p.actionId === target.actionId)
        const kick = probe.kicks.find((k) => k.actionId === target.actionId)
        const thrown = pass ?? kick
        if (!thrown?.applied) return null
        if (target.event === 'release') return { t: thrown.releaseT, point: copy(thrown.from) }
        // The receiver meets the pass she receives: it arrives at the rendez-vous (D-108).
        if (pass && meetsOwnPass(phase, plan.run, sync)) {
          const meet = plan.run.waypoints[sync.at ?? plan.run.waypoints.length - 1]
          const action = phase.actions.find((a) => a.id === target.actionId)
          const speed =
            (action?.type === 'pass' ? action.ballSpeed : undefined) ?? settings.passSpeed
          if (!meet || speed <= 0) return null
          const point = { x: meet.x, y: meet.y }
          return { t: pass.releaseT + distance(pass.from, point) / speed, point }
        }
        return { t: thrown.arrivalT, point: copy(thrown.to) }
      }
      case 'formation': {
        const b = probe.breakdowns.find((x) => x.actionId === target.actionId)
        return b?.applied ? { t: b.start, point: copy(b.pos) } : null
      }
    }
  }

  /** The run adjusted to its link (SPEC 5.8, D-108), or with its stored values when unreached. */
  const resolveLink = (
    plan: RunPlan,
    sync: RunSync,
    spec: MotionSpec,
    probe: CompiledPhase,
    out: Issue[],
  ): RunMotion => {
    const target = targetOf(probe, plan, sync)
    const issueTarget = { kind: 'action', id: plan.run.id, phaseId } as const
    const meetIndex = sync.at ?? plan.run.waypoints.length - 1
    const meetPoint = copy(plan.run.waypoints[meetIndex] ?? plan.points[0] ?? { x: 0, y: 0 })
    if (!target) {
      out.push({
        code: 'syncTargetInvalid',
        severity: 'error',
        target: issueTarget,
        params: { reason: 'unreached' },
      })
      const motion = runMotion(plan, spec, out)
      motion.sync = {
        adjust: sync.adjust,
        delay: spec.delay,
        factor: 1,
        status: 'unreached',
        targetT: null,
        meetPoint,
        targetPoint: null,
      }
      return motion
    }
    if (sync.adjust === 'delay') {
      // Prolonging a run at speed first; if she has to wait, from rest (D-106).
      const delayWith = (launch: LaunchedRun | null) => {
        const m = runMotion(plan, { ...spec, delay: 0, launch }, [])
        return target.t - start - meetTime(m, sync.at)
      }
      let launch = plan.launchCandidate
      let delay = delayWith(launch)
      if (launch && delay > SIMULTANEOUS_EPSILON) {
        launch = null
        delay = delayWith(null)
      }
      let status: 'ok' | 'late' = 'ok'
      if (delay < -SIMULTANEOUS_EPSILON) {
        status = 'late'
        out.push({
          code: 'syncLate',
          severity: 'warning',
          target: issueTarget,
          params: { late: -delay },
        })
      }
      delay = Math.max(0, delay)
      const motion = runMotion(plan, { ...spec, delay, launch }, out)
      motion.sync = {
        adjust: 'delay',
        delay,
        factor: motion.factor,
        status,
        targetT: target.t,
        meetPoint,
        targetPoint: target.point,
      }
      return motion
    }
    // Adjusted speed: a common factor on the segments before the rendez-vous (D-108).
    const wanted = target.t - start - spec.delay
    const upTo = meetIndex
    const fastest = Math.max(...plan.inputTargets.slice(0, upTo + 1), 1e-9)
    const maxFactor = settings.speedAlert.danger / fastest
    const build = (factor: number) => motionOf(plan, { ...spec, factor, factorUpTo: upTo })
    const spline = build(1).spline
    let factor = maxFactor
    let profile = build(maxFactor).profile
    let capped = wanted <= 0
    if (!capped) {
      const solution = solveFactor(
        (f) => build(f).profile,
        (p) => meetTime({ spline, profile: p }, sync.at),
        wanted,
        maxFactor,
      )
      factor = solution.factor
      profile = solution.profile
      capped = solution.capped === 'slow'
    }
    const motion = withProfile(build(factor), profile)
    if (capped) {
      // Average speed needed over the way to the rendez-vous (none for a target before the start).
      out.push({
        code: 'syncSpeedCapped',
        severity: 'warning',
        target: issueTarget,
        ...(wanted > 0 ? { params: { needed: meetDistance(spline, sync.at) / wanted } } : {}),
      })
    }
    motion.sync = {
      adjust: 'speed',
      delay: spec.delay,
      factor,
      status: capped ? 'capped' : 'ok',
      targetT: target.t,
      meetPoint,
      targetPoint: target.point,
    }
    return motion
  }

  /** Compiles the phase with the runs at speed listed in `atSpeed`. */
  const compileWith = (atSpeed: ReadonlySet<Id>): CompiledDraft => {
    const localIssues: Issue[] = [...staticIssues]
    const localGainLine: GainLineChange[] = []
    const motions = plans.map((plan) =>
      runMotion(plan, baseSpec(plan, atSpeed), plan.linked ? [] : localIssues),
    )
    // Links in the order of their dependencies: each target read on a simulation (D-108).
    for (const runId of analysis.order) {
      const index = plans.findIndex((p) => p.run.id === runId)
      const plan = plans[index]
      const sync = plan?.run.sync
      if (!plan || !sync) continue
      const probe = simulate(motions, [], [])
      motions[index] = resolveLink(plan, sync, baseSpec(plan, atSpeed), probe, localIssues)
    }
    const draft = simulate(motions, localIssues, localGainLine)
    return { phase: draft, issues: localIssues, gainLine: localGainLine }
  }

  // Compilation with every « Finit lancée » run at speed; a run that ends before the end of the
  // phase (the player waits for the other actions) or is frozen by a breakdown brakes normally
  // instead, and the phase is compiled again. A braking run never goes back to speed: at most one
  // more compilation per such run (D-106).
  const flagged = new Set(plans.filter((p) => p.run.endsAtSpeed === true).map((p) => p.run.id))
  const braking = new Set<Id>()
  const waits = new Map<Id, number>()
  let result = compileWith(flagged)
  for (let pass = 0; pass < flagged.size; pass++) {
    let changed = false
    for (const motion of result.phase.motions) {
      if (!motion.endsAtSpeed || braking.has(motion.actionId)) continue
      const stop = motionEnd(motion)
      if (motion.until !== null) {
        braking.add(motion.actionId)
        changed = true
      } else if (stop < result.phase.end - SIMULTANEOUS_EPSILON) {
        braking.add(motion.actionId)
        waits.set(motion.actionId, result.phase.end - stop)
        changed = true
      }
    }
    if (!changed) break
    result = compileWith(new Set([...flagged].filter((id) => !braking.has(id))))
  }
  for (const motion of result.phase.motions) {
    const wait = waits.get(motion.actionId)
    if (wait !== undefined && motion.source === 'run') motion.launchWait = wait
  }
  const draft = result.phase
  // Runs of the previous phase ending at speed, not prolonged here: they stop short (D-106).
  for (const [entityId, launch] of Object.entries(launched)) {
    const prolonged = draft.motions.some((m) => m.entityId === entityId && m.prolongs)
    if (!prolonged) {
      result.issues.push({
        code: 'runNotContinued',
        severity: 'warning',
        target: { kind: 'action', id: launch.actionId, phaseId: launch.phaseId },
        params: { phase: phaseLabelOf(play, phaseId) },
        key: phaseId,
      })
    }
  }
  for (const motion of draft.motions) {
    motion.speedLevels = speedLevelsOf(motion, settings)
    if (motion.source === 'run') result.issues.push(...speedIssues(motion, phaseId))
    if (motion.source === 'run' && motion.endsAtSpeed && motion.until === null) {
      const speed = endSpeedOf(motion.profile)
      const direction = endDirection(motion.spline)
      if (speed > 0 && direction) {
        draft.launched[motion.entityId] = { actionId: motion.actionId, phaseId, speed, direction }
      }
    }
  }
  const endPositions: Record<Id, Vec2> = {}
  for (const id of Object.keys(startPositions)) {
    const pos = positionInPhase(draft, id, draft.end)
    if (pos) endPositions[id] = pos
  }
  draft.endPositions = endPositions
  issues.push(...result.issues)
  gainLine.push(...result.gainLine)
  return draft
}

/** Peak speeds of the segments of a run beyond the thresholds (SPEC 5.9, D-111). */
function speedIssues(motion: RunMotion, phaseId: Id): Issue[] {
  const result: Issue[] = []
  motion.spline.sourceSegments.forEach((source, segment) => {
    const level = motion.speedLevels[segment]
    if (!level) return
    result.push({
      code: level === 'danger' ? 'runSpeedTooHigh' : 'runSpeedHigh',
      severity: level === 'danger' ? 'error' : 'warning',
      target: { kind: 'action', id: motion.actionId, phaseId },
      params: { segment: source + 1, speed: segmentPeak(motion.profile, segment) },
      key: String(source),
    })
  })
  return result
}

/** Level of the peak speed of each spline segment of a motion (SPEC 5.9, D-111). */
function speedLevelsOf(motion: RunMotion, settings: EngineSettings): (SpeedLevel | null)[] {
  const { warning, danger } = settings.speedAlert
  // A run frozen by a breakdown is judged on the part it runs only.
  const reach = motion.until === null ? Infinity : motionDistance(motion, motion.until)
  const { s, v, samplesPerSegment } = motion.profile
  return motion.spline.sourceSegments.map((_, segment) => {
    let peak = 0
    const first = segment * samplesPerSegment
    const last = Math.min(first + samplesPerSegment, v.length - 1)
    for (let k = first; k <= last && (s[k] ?? Infinity) <= reach; k++)
      peak = Math.max(peak, v[k] ?? 0)
    return peak > danger ? 'danger' : peak > warning ? 'warning' : null
  })
}

/** Segments at the sprint pace of the settings or faster (D-115). */
function fastOf(targets: readonly number[], settings: EngineSettings): boolean[] {
  return targets.map((v) => v >= settings.paces.sprint - 1e-9)
}

function initialHolder(play: Play): BallHolder {
  if (!play.entities.some(isBall)) return { kind: 'none' }
  const { ballCarrierId, ballPosition } = play.setup
  const carrier = play.entities.find((e) => e.id === ballCarrierId)
  if (ballCarrierId !== null && isPlayer(carrier) && play.setup.positions[ballCarrierId]) {
    return { kind: 'carried', carrierId: ballCarrierId }
  }
  if (ballPosition) return { kind: 'loose', pos: copy(ballPosition) }
  return { kind: 'none' }
}

/** Abscissa of the gain line at t: the ball at t = 0, then each ruck or maul (SPEC 5.6). */
export function gainLineAt(compiled: CompiledLine, t: number): number | null {
  let x: number | null = null
  for (const change of compiled.gainLine) if (change.t <= t) x = change.x
  return x
}

/** Compiles a line without cache. `line` is a path from the root; it stops at the first unknown phase. */
export function compileLineUncached(
  play: Play,
  line: readonly Id[],
  settings: EngineSettings,
  caches: EvalCaches,
): CompiledLine {
  const players = play.entities.filter(isPlayer).filter((p) => play.setup.positions[p.id])
  const positions: Record<Id, Vec2> = {}
  for (const p of players) {
    const pos = play.setup.positions[p.id]
    if (pos) positions[p.id] = copy(pos)
  }
  const issues: Issue[] = []
  const phases: CompiledPhase[] = []
  let holder = initialHolder(play)
  const gainLine: GainLineChange[] = []
  if (holder.kind === 'carried') {
    const pos = positions[holder.carrierId]
    if (pos) gainLine.push({ t: 0, x: pos.x })
  } else if (holder.kind === 'loose') {
    gainLine.push({ t: 0, x: holder.pos.x })
  }
  let time = 0
  let current = positions
  let previous: CompiledPhase | null = null
  for (const phaseId of line) {
    const compiled = compilePhase(
      play,
      phaseId,
      time,
      current,
      holder,
      previous,
      settings,
      caches,
      issues,
      gainLine,
    )
    if (!compiled) break
    phases.push(compiled)
    time = compiled.end
    current = compiled.endPositions
    holder = compiled.holderAtEnd
    previous = compiled
  }
  return {
    line: phases.map((p) => p.phaseId),
    phases,
    duration: time,
    players,
    hasBall: play.entities.some(isBall),
    gainLine,
    attackingTeam: play.attackingTeam,
    field: { length: play.field.length, width: play.field.width, inGoal: play.field.inGoal },
    issues,
  }
}

/** Compiles a line, cached by a hash of (play, line, settings) (SPEC 3.3.1). */
export function compileLine(
  play: Play,
  line: readonly Id[],
  settings: EngineSettings,
  caches: EvalCaches,
): CompiledLine {
  const key = contentHash({ play, line, settings })
  const cached = caches.lines.get(key)
  if (cached) return cached
  const compiled = compileLineUncached(play, line, settings, caches)
  caches.lines.set(key, compiled)
  return compiled
}
