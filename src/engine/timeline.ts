// Compilation of a line (path from the root): phase start times and durations, entity motions,
// ball possession, passes, kicks and breakdowns (SPEC 5.1 to 5.7, 10.3, 10.4, D-079, D-094).
// Pure: the result depends only on the inputs.
//
// Runs follow a speed profile (profile.ts, SPEC 5.3, D-105): bounded acceleration and braking,
// speed limited in turns, a target speed per segment. A run « Finit lancée » ends at speed when it
// ends with its phase, and the run that prolongs it in the next phase of the line starts at that
// speed in its arrival direction (SPEC 5.2, D-106): the phase is compiled once with the runs at
// speed, then again with a normal braking for those that ended before the end of the phase.
//
// Ball events of a phase (passes, kicks, breakdown formations) are processed in chronological
// order; between two events, flight arrivals, breakdown ends and loose-ball pickups are resolved.
// A breakdown only applies when the tackled player holds the ball, so no flight is in progress:
// it changes motions only after its formation, and everything computed before stays exact.
import { ARC_LENGTH_SAMPLES_PER_SEGMENT, RELAY_OFFSET } from '../config/defaults'
import { canonicalJson, contentHash } from '../model/canonical'
import type { Issue } from '../model/issues'
import { phaseLabelOf } from '../model/labels'
import { findPhase } from '../model/phaseTree'
import type { EngineSettings } from '../model/settings'
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
}

export interface CompiledPass {
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

export interface CompiledKick {
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
  /** Run prolonged from the previous phase: its end speed and direction (D-106). */
  launch: LaunchedRun | null
}

interface MotionOptions {
  delay: number
  /** Ends at speed (« Finit lancée » kept for this compilation). */
  endsAtSpeed: boolean
}

interface CompiledDraft {
  phase: CompiledPhase
  issues: Issue[]
  gainLine: GainLineChange[]
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

  // Runs: at most one per entity; the first one in array order applies (DECISIONS Q13).
  const plans: RunPlan[] = []
  const events: { action: BallAction; index: number }[] = []
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
        launch: null,
      })
    } else if (action.type === 'pass' || action.type === 'kick' || action.type === 'breakdown') {
      events.push({ action, index })
    } else {
      staticIssues.push({
        code: 'unsupportedAction',
        severity: 'warning',
        target,
        params: { type: action.type },
      })
    }
  })

  // Runs prolonging a run ending at speed in the previous phase of the line (D-106).
  const launched = previous?.launched ?? {}
  for (const [entityId, launch] of Object.entries(launched)) {
    const plan = plans.find((p) => p.run.entityId === entityId)
    if (plan && plan.run.delay <= SIMULTANEOUS_EPSILON) {
      plan.launch = launch
    } else {
      staticIssues.push({
        code: 'runNotContinued',
        severity: 'warning',
        target: { kind: 'action', id: launch.actionId, phaseId: launch.phaseId },
        params: { phase: phaseLabelOf(play, phaseId) },
        key: phaseId,
      })
    }
  }

  /** Motion of a run with a common speed factor. */
  const motionOf = (plan: RunPlan, options: MotionOptions, factor: number): RunMotion => {
    const spline = getSpline(plan.points, plan.launch?.direction ?? null, caches)
    const targets = splineTargets(spline, plan.inputTargets).map((v) => v * factor)
    const profile = buildProfile({
      spline,
      targets,
      startSpeed: plan.launch?.speed ?? 0,
      endsAtSpeed: options.endsAtSpeed,
      motion: settings.motion,
    })
    return {
      actionId: plan.run.id,
      entityId: plan.run.entityId,
      start: start + options.delay,
      duration: profile.duration,
      spline,
      profile,
      waypoints: plan.run.waypoints.map(copy),
      until: null,
      source: 'run',
      targets,
      factor,
      endsAtSpeed: options.endsAtSpeed,
      launchWait: null,
      prolongs: plan.launch !== null,
    }
  }

  /** Motion of a run, the imposed duration solved by a common factor (D-107). */
  const runMotion = (plan: RunPlan, options: MotionOptions, out: Issue[]): RunMotion => {
    const imposed = plan.run.durationOverride
    if (imposed === undefined) return motionOf(plan, options, 1)
    const fastest = Math.max(...plan.inputTargets, 1e-9)
    const solution = solveFactor(
      (factor) => motionOf(plan, options, factor).profile,
      (profile) => profile.duration,
      imposed,
      settings.speedAlert.danger / fastest,
    )
    const profile =
      solution.capped === 'none' ? withDuration(solution.profile, imposed) : solution.profile
    const motion = withProfile(motionOf(plan, options, solution.factor), profile)
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

  /** Compiles the phase with the runs at speed listed in `atSpeed`. */
  const compileWith = (atSpeed: ReadonlySet<Id>): CompiledDraft => {
    const localIssues: Issue[] = [...staticIssues]
    const localGainLine: GainLineChange[] = []
    const motions = plans.map((plan) =>
      runMotion(
        plan,
        { delay: plan.run.delay, endsAtSpeed: atSpeed.has(plan.run.id) },
        localIssues,
      ),
    )
    const draft = simulate(motions, localIssues, localGainLine)
    return { phase: draft, issues: localIssues, gainLine: localGainLine }
  }

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

    const advance = (te: number): void => {
      for (;;) {
        if (flight && flight.arrivalT <= te) {
          const landed = flight
          flight = null
          if (landed.toId !== null) {
            holder = { kind: 'carried', carrierId: landed.toId }
            draft.ball.push({ kind: 'carried', start: landed.arrivalT, carrierId: landed.toId })
          } else {
            holder = { kind: 'loose', pos: copy(landed.to) }
            looseSince = landed.arrivalT
            draft.ball.push({ kind: 'loose', start: landed.arrivalT, pos: copy(landed.to) })
          }
          continue
        }
        if (exit && exit.t <= te) {
          holder = { kind: 'carried', carrierId: exit.relayerId }
          draft.ball.push({ kind: 'carried', start: exit.t, carrierId: exit.relayerId })
          exit = null
          continue
        }
        if (holder.kind === 'loose') {
          const found = findPickup(holder.pos, looseSince, te, playerIds, at)
          if (found) {
            holder = { kind: 'carried', carrierId: found.id }
            draft.ball.push({ kind: 'carried', start: found.t, carrierId: found.id })
          } else {
            looseSince = te
          }
        }
        return
      }
    }

    const carries = (id: Id): boolean => holder.kind === 'carried' && holder.carrierId === id
    const simultaneous = (t: number): boolean =>
      releases.some((r) => Math.abs(r - t) <= SIMULTANEOUS_EPSILON)

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

    const handlePass = (action: PassAction, releaseT: number): void => {
      const target = { kind: 'action', id: action.id, phaseId } as const
      const passer = players.get(action.fromId)
      const receiver = players.get(action.toId)
      if (!passer || !receiver) return
      const from = at(passer.id, releaseT)
      const receiverAtRelease = at(receiver.id, releaseT)
      if (!from || !receiverAtRelease) return
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
      })
      startFlight(action.id, 'pass', from, to, releaseT, arrivalT, receiver.id)
    }

    const handleKick = (action: KickAction, releaseT: number): void => {
      const target = { kind: 'action', id: action.id, phaseId } as const
      const kicker = players.get(action.kickerId)
      if (!kicker) return
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

    // Events in chronological order (stable on array order).
    const sorted = [...events].sort((a, b) => a.action.delay - b.action.delay || a.index - b.index)
    for (const { action } of sorted) {
      const t = start + action.delay
      advance(t)
      if (action.type === 'pass') handlePass(action, t)
      else if (action.type === 'kick') handleKick(action, t)
      else handleBreakdown(action, t)
    }

    // Phase duration = max(delay + duration) of its applied actions, 0 without action (SPEC 5.1);
    // a breakdown lasts until the ball comes out (SPEC 10.3).
    let end = start
    for (const motion of draft.motions) end = Math.max(end, motionEnd(motion))
    for (const p of draft.passes) if (p.applied) end = Math.max(end, p.arrivalT)
    for (const k of draft.kicks) if (k.applied) end = Math.max(end, k.arrivalT)
    for (const b of draft.breakdowns) if (b.applied) end = Math.max(end, b.end)
    advance(end)
    draft.end = end
    // Every flight and breakdown is over at the end of the phase: advance() resolved them.
    draft.holderAtEnd = settledHolder(holder)
    return draft
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
  for (const motion of draft.motions) {
    if (motion.source === 'run') result.issues.push(...speedIssues(motion, phaseId, settings))
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
function speedIssues(motion: RunMotion, phaseId: Id, settings: EngineSettings): Issue[] {
  const result: Issue[] = []
  motion.spline.sourceSegments.forEach((source, segment) => {
    const peak = segmentPeak(motion.profile, segment)
    const { warning, danger } = settings.speedAlert
    if (peak <= warning) return
    result.push({
      code: peak > danger ? 'runSpeedTooHigh' : 'runSpeedHigh',
      severity: peak > danger ? 'error' : 'warning',
      target: { kind: 'action', id: motion.actionId, phaseId },
      params: { segment: source + 1, speed: peak },
      key: String(source),
    })
  })
  return result
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
