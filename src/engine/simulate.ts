// Chronological simulation of a line (SPEC 5.2, 5.3, 5.4, 10.3, 10.4, D-079, D-094): releases and
// formations are processed in time order; between two of them, flight arrivals, breakdown ends and
// loose-ball pickups are resolved. A run is built at its start, from the position of its player at
// that instant, when something first needs her position: this settles the freeze by a breakdown,
// the wait after an overlap, the relay and the launch. A flight reads the future of its receiver,
// which nothing can change: no breakdown applies while the ball flies. The glues are resolved around
// it (`glue.ts`): it receives their instants, levers and fields. Pure: the result depends only on
// the inputs.
import { PASS_RECEIPT_TOLERANCE, RELAY_OFFSET } from '../config/defaults'
import { solvePassArrival } from './pass'
import { copy, distance } from './vec'
import type { EngineSettings } from '../model/settings'
import type { Issue, IssueTarget } from '../model/issues'
import {
  attackDirection,
  isBall,
  isPlayer,
  isReceiverTarget,
  type Action,
  type BreakdownAction,
  type Id,
  type KickAction,
  type PassAction,
  type Play,
  type PlayerEntity,
  type RunAction,
  type Vec2,
} from '../model/types'
import { findPickup, isForwardPass, kickFlightTime, velocityBefore } from './ballEvents'
import {
  launchOf,
  motionAt,
  motionEnd,
  motionPosition,
  motionSpeed,
  relayMotion,
  runMotion,
  type MotionContext,
  type RunMotion,
  type RunSpec,
} from './motion'
import type {
  BallHolder,
  BallSegment,
  CompiledBranch,
  CompiledBreakdown,
  CompiledKick,
  CompiledPass,
  GainLineChange,
} from './timeline'

const SIMULTANEOUS_EPSILON = 1e-9

/** Instants at which the speed of a receiver is read against the ball during a flight (SPEC 5.4). */
const FLIGHT_SAMPLES = 8

const NO_RUN: ReadonlySet<Id> = new Set()

/** An action of the line, with the instant it asks for once in its branch (SPEC 4.3). */
export interface LineAction {
  /** The action, with the field of its right edge adapted when it is glued (SPEC 5.8). */
  action: Action
  /** Rank in the array of the play: it breaks ties. */
  index: number
  /** Rank of its branch in the line. */
  branchIndex: number
  planned: number
  /** Left edge glued: a release has no tolerance (SPEC 5.4). */
  glued: boolean
  /** Release glued to a target never reached: ignored and signalled (SPEC 5.4, 5.8). */
  unreached: boolean
  /** Pass whose receiver meets it, glued to its arrival: it arrives then, at her point (SPEC 5.8). */
  meetAt: number | null
  /** Levers, imposed duration and end at speed of a run; the launch is decided at its start. */
  spec: Omit<RunSpec, 'launch'>
  /** The run that this one prolongs when it really starts at its end (SPEC 5.2). */
  prolongs: Id | null
}

/** What every simulation of a play starts from. */
export interface LineSetup {
  /** Players with a starting position. */
  players: readonly PlayerEntity[]
  startPositions: Readonly<Record<Id, Vec2>>
  holderAtStart: BallHolder
}

export interface SimulationInput extends LineSetup {
  branches: readonly CompiledBranch[]
  actions: readonly LineAction[]
  settings: EngineSettings
  context: MotionContext
  /** By pass: the runs that depend on its arrival, left out of what it reads (D-152). */
  arrivalDependents: ReadonlyMap<Id, ReadonlySet<Id>>
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

export function lineSetup(play: Play): LineSetup {
  const players = play.entities.filter(isPlayer).filter((p) => play.setup.positions[p.id])
  const startPositions: Record<Id, Vec2> = {}
  for (const p of players) {
    const pos = play.setup.positions[p.id]
    if (pos) startPositions[p.id] = copy(pos)
  }
  return { players, startPositions, holderAtStart: initialHolder(play) }
}

export interface LineSimulation {
  /** In start order. */
  motions: RunMotion[]
  passes: CompiledPass[]
  kicks: CompiledKick[]
  breakdowns: CompiledBreakdown[]
  ball: BallSegment[]
  gainLine: GainLineChange[]
  duration: number
  issues: Issue[]
}

type BallAction = PassAction | KickAction | BreakdownAction

type LiveHolder = BallHolder | { kind: 'flight' } | { kind: 'breakdown' }

/** A release or a formation still to come. */
interface QueuedEvent {
  t: number
  index: number
  action: BallAction
  /** Instant asked for, kept when a release waits for a reception (tolerance, D-110). */
  planned: number
  postponed: boolean
  glued: boolean
  unreached: boolean
  meetAt: number | null
}

/** A run not built yet. */
interface PendingRun {
  run: RunAction
  index: number
  branchIndex: number
  planned: number
  /** Not before this instant: `planned`, or the arrival of a flight at a branch point (D-139 Q2). */
  ready: number
  spec: Omit<RunSpec, 'launch'>
  prolongs: Id | null
}

const byReadiness = (a: PendingRun, b: PendingRun): number => a.ready - b.ready || a.index - b.index

const targetOf = (action: Action): IssueTarget => ({
  kind: 'action',
  id: action.id,
  branchId: action.branchId,
})

export function simulateLine(input: SimulationInput): LineSimulation {
  const { actions, branches, holderAtStart, settings, startPositions, context } = input
  const { arrivalDependents } = input
  const players = new Map(input.players.map((p) => [p.id, p]))
  const playerIds = input.players.map((p) => p.id)
  const issues: Issue[] = []
  const passes: CompiledPass[] = []
  const kicks: CompiledKick[] = []
  const breakdowns: CompiledBreakdown[] = []
  const ball: BallSegment[] = [segmentOf(holderAtStart, 0)]
  const gainLine: GainLineChange[] = []
  const queue: QueuedEvent[] = []

  /** Motions built so far by player, in start order. */
  const motionsOf = new Map<Id, RunMotion[]>()
  /** Runs still to build by player, in the order they are ready. */
  const waiting = new Map<Id, PendingRun[]>()
  const pendingOf = new Map<Id, PendingRun>()
  /** Instant of the ball out of the breakdown each participant is held in, the latest one. */
  const heldUntil = new Map<Id, number>()
  /**
   * While a flight is aimed, the runs set aside: those of the receiver beyond this rank of the line
   * (D-139 Q2), and those that depend on its arrival (D-152).
   */
  let aiming: { receiverId: Id; lastIndex: number | null; excluded: ReadonlySet<Id> } | null = null

  for (const line of actions) {
    const { action, index, branchIndex, planned, glued, unreached, meetAt, spec, prolongs } = line
    if (action.type === 'run') {
      if (!players.has(action.entityId)) continue
      const entry = { run: action, index, branchIndex, planned, ready: planned, spec, prolongs }
      pendingOf.set(action.id, entry)
      waiting.set(action.entityId, [...(waiting.get(action.entityId) ?? []), entry])
    } else if (action.type === 'groupRun') {
      issues.push({
        code: 'unsupportedAction',
        severity: 'warning',
        target: targetOf(action),
        params: { type: action.type },
      })
    } else {
      queue.push({ t: planned, index, action, planned, postponed: false, glued, unreached, meetAt })
    }
  }
  for (const entries of waiting.values()) entries.sort(byReadiness)

  /** Position from the motions built so far. */
  const builtPosition = (id: Id, t: number): Vec2 | undefined => {
    const motion = motionAt(motionsOf.get(id) ?? [], id, t)
    if (motion) return motionPosition(motion, t)
    const start = startPositions[id]
    return start ? copy(start) : undefined
  }

  /** Builds a run from where its player is once she is free (SPEC 5.2, 5.3, 4.3). */
  const depart = (entry: PendingRun): void => {
    const id = entry.run.entityId
    const motions = motionsOf.get(id) ?? []
    motionsOf.set(id, motions)
    const last = motions[motions.length - 1]
    const free = Math.max(last ? motionEnd(last) : 0, heldUntil.get(id) ?? 0)
    const start = Math.max(entry.ready, free)
    const from = builtPosition(id, start)
    if (!from) return
    // Read in the model, and it really starts at the end of the run before (SPEC 5.2).
    const launch =
      entry.prolongs !== null &&
      last?.actionId === entry.prolongs &&
      last.endsAtSpeed &&
      last.until === null &&
      Math.abs(start - motionEnd(last)) <= SIMULTANEOUS_EPSILON
        ? launchOf(last)
        : null
    const spec = { ...entry.spec, launch }
    motions.push(runMotion(entry.run, from, entry.planned, start, spec, context))
  }

  const setAside = (entry: PendingRun): boolean => {
    if (!aiming) return false
    if (aiming.excluded.has(entry.run.id)) return true
    return (
      aiming.receiverId === entry.run.entityId &&
      aiming.lastIndex !== null &&
      entry.branchIndex > aiming.lastIndex
    )
  }

  /** Builds the runs of a player ready at t, in the order they are ready. */
  const buildRuns = (id: Id, t: number): void => {
    const entries = waiting.get(id)
    if (!entries) return
    let i = 0
    while (i < entries.length) {
      const entry = entries[i] as PendingRun
      if (entry.ready > t) return
      if (setAside(entry)) {
        i++
        continue
      }
      entries.splice(i, 1)
      depart(entry)
    }
  }

  const at = (id: Id, t: number): Vec2 | undefined => {
    buildRuns(id, t)
    return builtPosition(id, t)
  }

  /** Puts a built run back with the runs to build, to build it again later. */
  const unbuild = (motion: RunMotion): void => {
    const entry = pendingOf.get(motion.actionId)
    const entries = waiting.get(motion.entityId)
    if (!entry || !entries) return
    entries.push(entry)
    entries.sort(byReadiness)
  }

  /** Puts back the runs of a player that start after `t`: built too early, by reading ahead. */
  const unbuildAfter = (id: Id, t: number): void => {
    const motions = motionsOf.get(id) ?? []
    for (let last = motions.at(-1); last && last.start > t; last = motions.at(-1)) {
      motions.pop()
      unbuild(last)
    }
  }

  /** Rank in the line of the first branch point after t, null when none is left (D-139 Q2). */
  const nextBranchPoint = (t: number): number | null => {
    const index = branches.findIndex((branch) => branch.branchAt !== null && branch.branchAt > t)
    return index < 0 ? null : index
  }

  /**
   * Reads for a flight, without the runs of the receiver that belong to an option of the next branch
   * point: the flight only depends on the trunk (SPEC 5.2, D-139 Q2); and without the runs that
   * depend on its arrival (D-152).
   */
  const aimed = <T>(
    receiverId: Id,
    releaseT: number,
    excluded: ReadonlySet<Id>,
    read: () => T,
  ): T => {
    aiming = { receiverId, lastIndex: nextBranchPoint(releaseT), excluded }
    const result = read()
    aiming = null
    return result
  }

  /** The runs set aside by `aimed` that would start in flight wait for the arrival (D-139 Q2). */
  const waitForArrival = (receiverId: Id, releaseT: number, arrivalT: number): void => {
    const branchPoint = nextBranchPoint(releaseT)
    const entries = waiting.get(receiverId)
    if (branchPoint === null || !entries) return
    for (const entry of entries) {
      if (entry.branchIndex > branchPoint && entry.ready < arrivalT) entry.ready = arrivalT
    }
    entries.sort(byReadiness)
  }

  // Live ball state, advanced event by event.
  let holder: LiveHolder = holderAtStart
  let flight: { arrivalT: number; toId: Id | null; to: Vec2 } | null = null
  let exit: { t: number; relayerId: Id } | null = null
  let looseSince = 0
  const releases: number[] = []

  /** Resolves the first transition at or before te; false when there is none. */
  const advanceOne = (te: number): boolean => {
    if (flight && flight.arrivalT <= te) {
      const landed = flight
      flight = null
      if (landed.toId !== null) {
        holder = { kind: 'carried', carrierId: landed.toId }
        ball.push({ kind: 'carried', start: landed.arrivalT, carrierId: landed.toId })
      } else {
        holder = { kind: 'loose', pos: copy(landed.to) }
        looseSince = landed.arrivalT
        ball.push({ kind: 'loose', start: landed.arrivalT, pos: copy(landed.to) })
      }
      return true
    }
    if (exit && exit.t <= te) {
      const out = exit
      exit = null
      holder = { kind: 'carried', carrierId: out.relayerId }
      ball.push({ kind: 'carried', start: out.t, carrierId: out.relayerId })
      return true
    }
    if (holder.kind === 'loose' && looseSince <= te) {
      const found = findPickup(holder.pos, looseSince, te, playerIds, at)
      if (found) {
        holder = { kind: 'carried', carrierId: found.id }
        ball.push({ kind: 'carried', start: found.t, carrierId: found.id })
        return true
      }
      looseSince = te
    }
    return false
  }

  const carries = (id: Id): boolean => holder.kind === 'carried' && holder.carrierId === id
  const simultaneous = (t: number): boolean =>
    releases.some((r) => Math.abs(r - t) <= SIMULTANEOUS_EPSILON)

  /** Reception of the ball by a player still to come, or null (D-110). */
  const upcomingReception = (id: Id): number | null => {
    if (flight && flight.toId === id) return flight.arrivalT
    if (exit && exit.relayerId === id) return exit.t
    return null
  }

  /**
   * A release by a player who receives the ball a little later waits for it (tolerance, D-110):
   * the event is put back at the reception. True when postponed.
   */
  const postpone = (event: QueuedEvent, playerId: Id): boolean => {
    if (event.postponed || event.glued || carries(playerId)) return false
    const reception = upcomingReception(playerId)
    if (reception === null || reception > event.t + PASS_RECEIPT_TOLERANCE) return false
    queue.push({ ...event, t: reception, postponed: true })
    return true
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
    ball.push({
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

  /** The ball goes slower than its receiver during its flight (SPEC 5.4). */
  const slowerThanReceiver = (
    id: Id,
    speed: number,
    releaseT: number,
    arrivalT: number,
  ): boolean => {
    const motions = motionsOf.get(id) ?? []
    for (let k = 0; k <= FLIGHT_SAMPLES; k++) {
      const t = releaseT + ((arrivalT - releaseT) * k) / FLIGHT_SAMPLES
      const motion = motionAt(motions, id, t)
      if (motion && motionSpeed(motion, t) > speed) return true
    }
    return false
  }

  const handlePass = (action: PassAction, event: QueuedEvent): void => {
    const releaseT = event.t
    const target = targetOf(action)
    const passer = players.get(action.fromId)
    const receiver = players.get(action.toId)
    if (!passer || !receiver) return
    if (postpone(event, passer.id)) return
    const excluded = arrivalDependents.get(action.id) ?? NO_RUN
    const [from, receiverAtRelease] = aimed(receiver.id, releaseT, excluded, () => [
      at(passer.id, releaseT),
      at(receiver.id, releaseT),
    ])
    if (!from || !receiverAtRelease) return
    const compiled = {
      actionId: action.id,
      branchId: action.branchId,
      fromId: passer.id,
      toId: receiver.id,
      plannedT: event.planned,
      releaseT,
      from,
    }
    const ignored = (code: 'simultaneousPass' | 'passerWithoutBall'): void => {
      issues.push({ code, severity: 'error', target })
      passes.push({
        ...compiled,
        arrivalT: releaseT,
        to: receiverAtRelease,
        applied: false,
        forward: false,
      })
    }
    if (event.unreached) {
      ignored('passerWithoutBall')
      return
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
    const { arrivalT, to } = aimed(receiver.id, releaseT, excluded, () => {
      const arrival =
        event.meetAt ??
        solvePassArrival(from, releaseT, speed, (t) => at(receiver.id, t) ?? receiverAtRelease)
      return { arrivalT: arrival, to: at(receiver.id, arrival) ?? receiverAtRelease }
    })
    unbuildAfter(receiver.id, arrivalT)
    waitForArrival(receiver.id, releaseT, arrivalT)
    if (slowerThanReceiver(receiver.id, speed, releaseT, arrivalT)) {
      issues.push({ code: 'ballSlowerThanReceiver', severity: 'warning', target })
    }
    // Speed of the passer when she lets go, read before any run she starts then (D-085).
    const forward = isForwardPass(
      from,
      to,
      releaseT,
      arrivalT,
      velocityBefore((t) => at(passer.id, t), releaseT),
      passer.team,
    )
    if (forward) issues.push({ code: 'forwardPass', severity: 'warning', target })
    passes.push({ ...compiled, arrivalT, to, applied: true, forward })
    startFlight(action.id, 'pass', from, to, releaseT, arrivalT, receiver.id)
  }

  const handleKick = (action: KickAction, event: QueuedEvent): void => {
    const releaseT = event.t
    const target = targetOf(action)
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
      const id = receiver.id
      receiverId = id
      to = aimed(id, releaseT, NO_RUN, () => at(id, arrivalT))
    } else {
      to = copy(action.target.point)
    }
    if (!to) return
    const compiled: CompiledKick = {
      actionId: action.id,
      branchId: action.branchId,
      kickerId: kicker.id,
      kind: action.kind,
      receiverId,
      plannedT: event.planned,
      releaseT,
      arrivalT,
      from,
      to,
      applied: false,
    }
    /** Not applied: the runs read ahead for its target are built again in their order. */
    const ignored = (code: 'simultaneousPass' | 'kickerWithoutBall'): void => {
      if (receiverId !== null) unbuildAfter(receiverId, releaseT)
      issues.push({ code, severity: 'error', target })
      kicks.push(compiled)
    }
    if (event.unreached) {
      ignored('kickerWithoutBall')
      return
    }
    if (simultaneous(releaseT)) {
      ignored('simultaneousPass')
      return
    }
    releases.push(releaseT)
    if (!carries(kicker.id)) {
      ignored('kickerWithoutBall')
      return
    }
    if (receiverId !== null) {
      unbuildAfter(receiverId, arrivalT)
      waitForArrival(receiverId, releaseT, arrivalT)
    }
    kicks.push({ ...compiled, applied: true })
    startFlight(action.id, 'kick', from, to, releaseT, arrivalT, receiverId)
  }

  /** Stops a participant at the formation; her runs not started wait for the exit (D-079). */
  const freezeAt = (entityId: Id, formation: number, ballOut: number): void => {
    heldUntil.set(entityId, ballOut)
    const motions = motionsOf.get(entityId) ?? []
    for (let i = motions.length - 1; i >= 0; i--) {
      const motion = motions[i] as RunMotion
      if (motion.start >= formation) {
        motions.splice(i, 1)
        unbuild(motion)
      } else if (motionEnd(motion) > formation + SIMULTANEOUS_EPSILON) {
        if (motion.source === 'run') {
          issues.push({
            code: 'runCutByBreakdown',
            severity: 'warning',
            target: { kind: 'action', id: motion.actionId, branchId: motion.branchId },
          })
        }
        motion.until = formation
      }
    }
  }

  const handleBreakdown = (action: BreakdownAction, formation: number): void => {
    const target = targetOf(action)
    const tackled = players.get(action.tackledId)
    const support = players.get(action.supportId)
    const relayer = players.get(action.relayerId)
    if (!tackled || !support || !relayer) return
    if (new Set([tackled.id, support.id, relayer.id]).size < 3) return
    const pos = at(tackled.id, formation)
    if (!pos || !at(support.id, formation) || !at(relayer.id, formation)) return
    const compiled: CompiledBreakdown = {
      actionId: action.id,
      branchId: action.branchId,
      kind: action.kind,
      tackledId: tackled.id,
      supportId: support.id,
      relayerId: relayer.id,
      start: formation,
      end: formation + action.duration,
      pos: copy(pos),
      applied: false,
    }
    if (!carries(tackled.id)) {
      issues.push({ code: 'tackledWithoutBall', severity: 'error', target })
      breakdowns.push(compiled)
      return
    }
    for (const id of [tackled.id, support.id, relayer.id]) {
      freezeAt(id, formation, compiled.end)
    }
    // The relayer joins the relay position at sprint pace, then waits (SPEC 10.3, D-079).
    const relayFrom = builtPosition(relayer.id, formation) ?? pos
    const relayTo = { x: pos.x - RELAY_OFFSET * attackDirection(tackled.team), y: pos.y }
    if (distance(relayFrom, relayTo) > SIMULTANEOUS_EPSILON) {
      const { motion, late } = relayMotion(action, relayFrom, relayTo, formation, context)
      motionsOf.set(relayer.id, [...(motionsOf.get(relayer.id) ?? []), motion])
      if (late) {
        issues.push({ code: 'relayerLate', severity: 'warning', target, params: late })
      }
    }
    breakdowns.push({ ...compiled, applied: true })
    holder = { kind: 'breakdown' }
    exit = { t: compiled.end, relayerId: relayer.id }
    ball.push({
      kind: 'breakdown',
      start: formation,
      end: compiled.end,
      pos: copy(pos),
      actionId: action.id,
    })
    gainLine.push({ t: formation, x: pos.x })
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
      // A glued event comes with its target, a reception included, whatever the rounding (SPEC 5.4).
      if (advanceOne(next.glued ? next.t + SIMULTANEOUS_EPSILON : next.t)) continue
      queue.splice(queue.indexOf(next), 1)
      const action = next.action
      if (action.type === 'pass') handlePass(action, next)
      else if (action.type === 'kick') handleKick(action, next)
      else handleBreakdown(action, next.t)
    }
  }

  const allMotions = (): RunMotion[] => [...motionsOf.values()].flat()

  // Duration of the line = the latest end of its applied actions, 0 without action (SPEC 5.1); a
  // breakdown lasts until the ball comes out (SPEC 10.3).
  const lineEnd = (): number => {
    let end = 0
    for (const motion of allMotions()) end = Math.max(end, motionEnd(motion))
    for (const p of passes) if (p.applied) end = Math.max(end, p.arrivalT)
    for (const k of kicks) if (k.applied) end = Math.max(end, k.arrivalT)
    for (const b of breakdowns) if (b.applied) end = Math.max(end, b.end)
    return end
  }

  drain()
  for (const id of playerIds) buildRuns(id, Infinity)
  const duration = lineEnd()
  while (advanceOne(duration)) {
    // Every transition up to the end of the line.
  }

  const rank = new Map(actions.map(({ action, index }) => [action.id, index]))
  const motions = allMotions().sort(
    (a, b) => a.start - b.start || (rank.get(a.actionId) ?? 0) - (rank.get(b.actionId) ?? 0),
  )
  return { motions, passes, kicks, breakdowns, ball, gainLine, duration, issues }
}

function segmentOf(holder: BallHolder, start: number): BallSegment {
  if (holder.kind === 'carried') return { kind: 'carried', start, carrierId: holder.carrierId }
  if (holder.kind === 'loose') return { kind: 'loose', start, pos: copy(holder.pos) }
  return { kind: 'none', start }
}
