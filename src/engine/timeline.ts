// Compilation of a line (path from the root): phase start times and durations, entity motions,
// ball possession and passes (SPEC 5.1 to 5.4). Pure: the result depends only on the inputs.
import { ARC_LENGTH_SAMPLES_PER_SEGMENT } from '../config/defaults'
import { canonicalJson, contentHash } from '../model/canonical'
import type { Issue } from '../model/issues'
import { findPhase } from '../model/phaseTree'
import type { EngineSettings } from '../model/settings'
import {
  isBall,
  isPlayer,
  type Id,
  type PassAction,
  type Play,
  type PlayerEntity,
  type RunAction,
  type Team,
  type Vec2,
} from '../model/types'
import type { EvalCaches } from './caches'
import { solvePassArrival } from './pass'
import { buildSpline, pointAtDistance, type Spline } from './spline'
import { copy } from './vec'

const SIMULTANEOUS_EPSILON = 1e-9

export interface RunMotion {
  actionId: Id
  entityId: Id
  /** Absolute start time (phase start + delay). */
  start: number
  duration: number
  spline: Spline
  waypoints: Vec2[]
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
}

export type BallHolder =
  { kind: 'carried'; carrierId: Id } | { kind: 'loose'; pos: Vec2 } | { kind: 'none' }

export interface CompiledPhase {
  phaseId: Id
  start: number
  end: number
  instruction: string
  startPositions: Record<Id, Vec2>
  endPositions: Record<Id, Vec2>
  /** Applied runs, at most one per entity. */
  motions: RunMotion[]
  passes: CompiledPass[]
  holderAtStart: BallHolder
  holderAtEnd: BallHolder
}

export interface CompiledLine {
  line: Id[]
  phases: CompiledPhase[]
  duration: number
  players: PlayerEntity[]
  hasBall: boolean
  gainLineX: number | null
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

/** Position of a motion at absolute time t. */
export function motionPosition(motion: RunMotion, t: number): Vec2 {
  if (motion.duration <= 0)
    return t < motion.start
      ? pointAtDistance(motion.spline, 0)
      : pointAtDistance(motion.spline, motion.spline.length)
  const progress = Math.min(1, Math.max(0, (t - motion.start) / motion.duration))
  return pointAtDistance(motion.spline, progress * motion.spline.length)
}

/** Position of an entity at absolute time t inside a compiled phase. */
export function positionInPhase(phase: CompiledPhase, entityId: Id, t: number): Vec2 | undefined {
  const motion = phase.motions.find((m) => m.entityId === entityId)
  if (motion) return motionPosition(motion, t)
  const start = phase.startPositions[entityId]
  return start ? copy(start) : undefined
}

function compilePhase(
  play: Play,
  phaseId: Id,
  start: number,
  startPositions: Record<Id, Vec2>,
  holderAtStart: BallHolder,
  settings: EngineSettings,
  caches: EvalCaches,
  issues: Issue[],
): CompiledPhase | null {
  const phase = findPhase(play, phaseId)
  if (!phase) return null
  const players = new Map<Id, PlayerEntity>()
  for (const entity of play.entities) if (isPlayer(entity)) players.set(entity.id, entity)

  // Runs: at most one per entity; the first one in array order applies (DECISIONS Q13).
  const motions: RunMotion[] = []
  const passes: PassAction[] = []
  for (const action of phase.actions) {
    const target = { kind: 'action', id: action.id, phaseId } as const
    if (action.type === 'run') {
      const run: RunAction = action
      const startPos = startPositions[run.entityId]
      if (!players.has(run.entityId) || !startPos) continue
      if (motions.some((m) => m.entityId === run.entityId)) {
        issues.push({
          code: 'twoRunsSamePhase',
          severity: 'error',
          target,
          params: { id: run.entityId },
        })
        continue
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
      })
    } else if (action.type === 'pass') {
      passes.push(action)
    } else {
      issues.push({
        code: 'unsupportedAction',
        severity: 'warning',
        target,
        params: { type: action.type },
      })
    }
  }

  const draft: CompiledPhase = {
    phaseId,
    start,
    end: start,
    instruction: phase.instruction,
    startPositions,
    endPositions: {},
    motions,
    passes: [],
    holderAtStart,
    holderAtEnd: holderAtStart,
  }

  // Passes in release order (stable on array order). Possession is simulated pass by pass.
  const ordered = passes
    .map((action, index) => ({ action, index }))
    .sort((a, b) => a.action.delay - b.action.delay || a.index - b.index)
  let holder: BallHolder = holderAtStart
  let lastApplied: CompiledPass | null = null
  const releases: number[] = []
  for (const { action } of ordered) {
    const target = { kind: 'action', id: action.id, phaseId } as const
    const passer = players.get(action.fromId)
    const receiver = players.get(action.toId)
    if (!passer || !receiver) continue
    const releaseT = start + action.delay
    const from = positionInPhase(draft, passer.id, releaseT)
    const receiverAtRelease = positionInPhase(draft, receiver.id, releaseT)
    if (!from || !receiverAtRelease) continue
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
      })
    }
    if (releases.some((r) => Math.abs(r - releaseT) <= SIMULTANEOUS_EPSILON)) {
      ignored('simultaneousPass')
      continue
    }
    releases.push(releaseT)
    const inFlight = lastApplied !== null && releaseT < lastApplied.arrivalT
    if (inFlight || holder.kind !== 'carried' || holder.carrierId !== passer.id) {
      ignored('passerWithoutBall')
      continue
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
      (t) => positionInPhase(draft, receiver.id, t) ?? receiverAtRelease,
    )
    const to = positionInPhase(draft, receiver.id, arrivalT) ?? receiverAtRelease
    const compiled: CompiledPass = {
      actionId: action.id,
      fromId: passer.id,
      toId: receiver.id,
      releaseT,
      arrivalT,
      from,
      to,
      applied: true,
    }
    draft.passes.push(compiled)
    lastApplied = compiled
    holder = { kind: 'carried', carrierId: receiver.id }
  }

  // Phase duration = max(delay + duration) of its actions, 0 without action (SPEC 5.1).
  let end = start
  for (const motion of motions) end = Math.max(end, motion.start + motion.duration)
  for (const p of draft.passes) if (p.applied) end = Math.max(end, p.arrivalT)
  draft.end = end
  draft.holderAtEnd = holder
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
  const holderAtZero = holder
  let time = 0
  let current = positions
  for (const phaseId of line) {
    const compiled = compilePhase(play, phaseId, time, current, holder, settings, caches, issues)
    if (!compiled) break
    phases.push(compiled)
    time = compiled.end
    current = compiled.endPositions
    holder = compiled.holderAtEnd
  }
  let gainLineX: number | null = null
  if (holderAtZero.kind === 'carried') gainLineX = positions[holderAtZero.carrierId]?.x ?? null
  else if (holderAtZero.kind === 'loose') gainLineX = holderAtZero.pos.x
  return {
    line: phases.map((p) => p.phaseId),
    phases,
    duration: time,
    players,
    hasBall: play.entities.some(isBall),
    gainLineX,
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
