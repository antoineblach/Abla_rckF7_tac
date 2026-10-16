// Compilation of a line (path from the root): phase start times and durations, entity motions,
// ball possession, passes, kicks and breakdowns (SPEC 5.1 to 5.7, 10.3, 10.4, D-079, D-094).
// Pure: the result depends only on the inputs.
//
// Ball events of a phase (passes, kicks, breakdown formations) are processed in chronological
// order; between two events, flight arrivals, breakdown ends and loose-ball pickups are resolved.
// A breakdown only applies when the tackled player holds the ball, so no flight is in progress:
// it changes motions only after its formation, and everything computed before stays exact.
import { ARC_LENGTH_SAMPLES_PER_SEGMENT, RELAY_OFFSET } from '../config/defaults'
import { canonicalJson, contentHash } from '../model/canonical'
import type { Issue } from '../model/issues'
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
import { buildSpline, pointAtDistance, type Spline } from './spline'
import { copy, distance } from './vec'

const SIMULTANEOUS_EPSILON = 1e-9

export interface RunMotion {
  actionId: Id
  entityId: Id
  /** Absolute start time (phase start + delay). */
  start: number
  duration: number
  spline: Spline
  waypoints: Vec2[]
  /** Absolute instant from which the motion is frozen by a breakdown (D-079), null otherwise. */
  until: number | null
  /** A run drawn by the user, or the relayer joining the breakdown (generated, D-079). */
  source: 'run' | 'relay'
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

function getSpline(points: Vec2[], caches: EvalCaches): Spline {
  const key = canonicalJson(points)
  const cached = caches.splines.get(key)
  if (cached) return cached
  const spline = buildSpline(points, ARC_LENGTH_SAMPLES_PER_SEGMENT)
  caches.splines.set(key, spline)
  return spline
}

/** Instant at which a motion stops: its end, or the breakdown that freezes it. */
export function motionEnd(motion: RunMotion): number {
  const end = motion.start + motion.duration
  return motion.until === null ? end : Math.min(end, motion.until)
}

/** Progress of a motion along its curve at absolute time t, in [0, 1]. */
export function motionProgress(motion: RunMotion, t: number): number {
  const time = motion.until === null ? t : Math.min(t, motion.until)
  if (motion.duration <= 0) return time < motion.start ? 0 : 1
  return Math.min(1, Math.max(0, (time - motion.start) / motion.duration))
}

/** Position of a motion at absolute time t. */
export function motionPosition(motion: RunMotion, t: number): Vec2 {
  return pointAtDistance(motion.spline, motionProgress(motion, t) * motion.spline.length)
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

  // Runs: at most one per entity; the first one in array order applies (DECISIONS Q13).
  const motions: RunMotion[] = []
  const events: { action: BallAction; index: number }[] = []
  phase.actions.forEach((action, index) => {
    const target = { kind: 'action', id: action.id, phaseId } as const
    if (action.type === 'run') {
      const run: RunAction = action
      const startPos = startPositions[run.entityId]
      if (!players.has(run.entityId) || !startPos) return
      if (motions.some((m) => m.entityId === run.entityId)) {
        issues.push({
          code: 'twoRunsSamePhase',
          severity: 'error',
          target,
          params: { id: run.entityId },
        })
        return
      }
      const spline = getSpline([startPos, ...run.waypoints], caches)
      const speed = settings.paces[run.pace]
      const duration = run.durationOverride ?? (speed > 0 ? spline.length / speed : 0)
      motions.push({
        actionId: run.id,
        entityId: run.entityId,
        start: start + run.delay,
        duration,
        spline,
        waypoints: run.waypoints,
        until: null,
        source: 'run',
      })
    } else if (action.type === 'pass' || action.type === 'kick' || action.type === 'breakdown') {
      events.push({ action, index })
    } else {
      issues.push({
        code: 'unsupportedAction',
        severity: 'warning',
        target,
        params: { type: action.type },
      })
    }
  })

  const draft: CompiledPhase = {
    phaseId,
    start,
    end: start,
    instruction: phase.instruction,
    startPositions,
    endPositions: {},
    motions,
    ignoredRuns: [],
    passes: [],
    kicks: [],
    breakdowns: [],
    ball: [segmentOf(holderAtStart, start)],
    holderAtStart,
    holderAtEnd: holderAtStart,
  }
  const at = (id: Id, t: number): Vec2 | undefined => positionInPhase(draft, id, t)
  const playerIds = play.entities
    .filter(isPlayer)
    .map((p) => p.id)
    .filter((id) => startPositions[id] !== undefined)

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
      issues.push({ code, severity: 'error', target })
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
      issues.push({ code: 'passToOpponent', severity: 'error', target })
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
    if (forward) issues.push({ code: 'forwardPass', severity: 'warning', target })
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
      issues.push({ code: 'simultaneousPass', severity: 'error', target })
      draft.kicks.push(compiled)
      return
    }
    releases.push(releaseT)
    if (!carries(kicker.id)) {
      issues.push({ code: 'kickerWithoutBall', severity: 'error', target })
      draft.kicks.push(compiled)
      return
    }
    draft.kicks.push({ ...compiled, applied: true })
    startFlight(action.id, 'kick', from, to, releaseT, arrivalT, receiverId)
  }

  /** Freezes the motions of a breakdown participant at the formation (D-079). */
  const freezeAt = (entityId: Id, tf: number): void => {
    for (const motion of [...draft.motions]) {
      if (motion.entityId !== entityId || motionEnd(motion) <= tf + SIMULTANEOUS_EPSILON) continue
      if (motion.source === 'run') {
        issues.push({
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
      issues.push({ code: 'tackledWithoutBall', severity: 'error', target })
      draft.breakdowns.push(compiled)
      return
    }
    for (const id of [tackled.id, support.id, relayer.id]) freezeAt(id, tf)
    // The relayer joins the relay position at sprint pace, then waits (SPEC 10.3, D-079).
    const relayFrom = at(relayer.id, tf) ?? pos
    const relayTo = { x: pos.x - RELAY_OFFSET * attackDirection(tackled.team), y: pos.y }
    const gap = distance(relayFrom, relayTo)
    const sprint = settings.paces.sprint
    let travel = sprint > 0 ? gap / sprint : action.duration
    if (travel > action.duration) {
      travel = action.duration
      issues.push({ code: 'relayerLate', severity: 'warning', target })
    }
    if (gap > SIMULTANEOUS_EPSILON) {
      draft.motions.push({
        actionId: action.id,
        entityId: relayer.id,
        start: tf,
        duration: travel,
        spline: getSpline([relayFrom, relayTo], caches),
        waypoints: [relayTo],
        until: null,
        source: 'relay',
      })
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
    gainLine.push({ t: tf, x: pos.x })
  }

  // Events in chronological order (stable on array order).
  events.sort((a, b) => a.action.delay - b.action.delay || a.index - b.index)
  for (const { action } of events) {
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
  const endPositions: Record<Id, Vec2> = {}
  for (const id of Object.keys(startPositions)) {
    const pos = positionInPhase(draft, id, end)
    if (pos) endPositions[id] = pos
  }
  draft.endPositions = endPositions
  return draft
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
