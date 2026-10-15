// evaluate(play, branchPath, t, settings, caches) -> SceneState (SPEC 3.3.1, DECISIONS Q3).
// Pure: no clock, no randomness, no global state. Traces are computed from the geometry,
// never accumulated frame by frame (SPEC 5.5).
import { pathToPhase } from '../model/phaseTree'
import type { EngineSettings } from '../model/settings'
import type { Id, Play, Vec2 } from '../model/types'
import type { EvalCaches } from './caches'
import type { BallState, PassTrace, RunTrace, ScenePlayer, SceneState } from './sceneState'
import { pathUpToDistance } from './spline'
import {
  compileLine,
  motionPosition,
  positionInPhase,
  type CompiledLine,
  type CompiledPhase,
  type RunMotion,
} from './timeline'
import { copy, lerp } from './vec'

/** Index of the phase displayed at t: the last phase starting at or before t. */
export function phaseIndexAt(compiled: CompiledLine, t: number): number {
  let index = compiled.phases.length > 0 ? 0 : -1
  for (let i = 0; i < compiled.phases.length; i++) {
    if ((compiled.phases[i] as CompiledPhase).start <= t) index = i
  }
  return index
}

function clampTime(compiled: CompiledLine, t: number): number {
  if (!Number.isFinite(t) || t < 0) return 0
  return Math.min(t, compiled.duration)
}

function ballAt(
  compiled: CompiledLine,
  phase: CompiledPhase | undefined,
  t: number,
): BallState | null {
  if (!compiled.hasBall || !phase) return null
  // Last applied pass released at or before t.
  const applied = phase.passes.filter((p) => p.applied && p.releaseT <= t)
  const last = applied[applied.length - 1]
  if (last) {
    if (t < last.arrivalT) {
      const span = last.arrivalT - last.releaseT
      const k = span > 0 ? (t - last.releaseT) / span : 1
      return {
        kind: 'inFlight',
        from: copy(last.from),
        to: copy(last.to),
        releaseT: last.releaseT,
        arrivalT: last.arrivalT,
        toId: last.toId,
        pos: lerp(last.from, last.to, k),
      }
    }
    const pos = positionInPhase(phase, last.toId, t)
    return pos ? { kind: 'carried', carrierId: last.toId, pos } : null
  }
  const holder = phase.holderAtStart
  if (holder.kind === 'carried') {
    const pos = positionInPhase(phase, holder.carrierId, t)
    return pos ? { kind: 'carried', carrierId: holder.carrierId, pos } : null
  }
  if (holder.kind === 'loose') return { kind: 'loose', pos: copy(holder.pos) }
  return null
}

function runTrace(motion: RunMotion, phaseId: Id, current: boolean, t: number): RunTrace | null {
  if (t < motion.start) return null
  const progress = motion.duration > 0 ? Math.min(1, (t - motion.start) / motion.duration) : 1
  const points = pathUpToDistance(motion.spline, progress * motion.spline.length)
  if (points.length < 2) return null
  return { actionId: motion.actionId, entityId: motion.entityId, phaseId, current, points }
}

/** Samples a compiled line at time t. */
export function sampleLine(compiled: CompiledLine, rawT: number): SceneState {
  const t = clampTime(compiled, rawT)
  const index = phaseIndexAt(compiled, t)
  const phase = index >= 0 ? compiled.phases[index] : undefined
  const players: ScenePlayer[] = []
  for (const p of compiled.players) {
    const pos = phase ? positionInPhase(phase, p.id, t) : undefined
    if (pos) players.push({ id: p.id, team: p.team, number: p.number, color: p.color, pos })
  }
  const traces: RunTrace[] = []
  const passTraces: PassTrace[] = []
  for (let i = 0; i <= index; i++) {
    const ph = compiled.phases[i] as CompiledPhase
    const current = i === index
    for (const motion of ph.motions) {
      const trace = runTrace(motion, ph.phaseId, current, t)
      if (trace) traces.push(trace)
    }
    for (const p of ph.passes) {
      if (!p.applied || p.releaseT > t) continue
      const completed = t >= p.arrivalT
      const span = p.arrivalT - p.releaseT
      const to = completed || span <= 0 ? copy(p.to) : lerp(p.from, p.to, (t - p.releaseT) / span)
      passTraces.push({
        actionId: p.actionId,
        phaseId: ph.phaseId,
        current,
        from: copy(p.from),
        to,
        completed,
      })
    }
  }
  return {
    t,
    duration: compiled.duration,
    line: [...compiled.line],
    phaseIndex: index,
    phaseId: phase?.phaseId ?? null,
    phaseStart: phase?.start ?? 0,
    phaseEnd: phase?.end ?? 0,
    instruction: phase?.instruction ?? '',
    attackingTeam: compiled.attackingTeam,
    field: { ...compiled.field },
    players,
    ball: ballAt(compiled, phase, t),
    traces,
    passTraces,
    gainLineX: compiled.gainLineX,
    issues: [...compiled.issues],
  }
}

export function evaluate(
  play: Play,
  branchPath: readonly Id[],
  t: number,
  settings: EngineSettings,
  caches: EvalCaches,
): SceneState {
  return sampleLine(compileLine(play, branchPath, settings, caches), t)
}

// ---------------------------------------------------------------------------
// Schematic data of a phase at rest (editor, thumbnails, renderSchematic).

export interface SchematicRun {
  actionId: Id
  entityId: Id
  phaseId: Id
  /** Sampled curve from the start position through the waypoints. */
  points: Vec2[]
  /** Stored waypoints (the start point is not stored, SPEC 5.2). */
  waypoints: Vec2[]
  duration: number
}

export interface SchematicPass {
  actionId: Id
  phaseId: Id
  fromId: Id
  toId: Id
  from: Vec2
  to: Vec2
  applied: boolean
}

export interface PhaseSchematic {
  phaseId: Id
  /** Path from the root to the phase. */
  path: Id[]
  players: ScenePlayer[]
  /** Ball at the start of the phase. */
  ball: BallState | null
  runs: SchematicRun[]
  passes: SchematicPass[]
  ancestorRuns: SchematicRun[]
  ancestorPasses: SchematicPass[]
  gainLineX: number | null
  attackingTeam: SceneState['attackingTeam']
  field: SceneState['field']
  phaseStart: number
  phaseEnd: number
  instruction: string
}

function schematicRuns(phase: CompiledPhase): SchematicRun[] {
  return phase.motions.map((m) => ({
    actionId: m.actionId,
    entityId: m.entityId,
    phaseId: phase.phaseId,
    points: m.spline.samples.map(copy),
    waypoints: m.waypoints.map(copy),
    duration: m.duration,
  }))
}

function schematicPasses(phase: CompiledPhase): SchematicPass[] {
  return phase.passes.map((p) => ({
    actionId: p.actionId,
    phaseId: phase.phaseId,
    fromId: p.fromId,
    toId: p.toId,
    from: copy(p.from),
    to: copy(p.to),
    applied: p.applied,
  }))
}

/** Positions at the start of a phase, its actions, and the actions of its ancestors (SPEC 6.3). */
export function phaseSchematic(
  play: Play,
  phaseId: Id,
  settings: EngineSettings,
  caches: EvalCaches,
): PhaseSchematic | null {
  const path = pathToPhase(play, phaseId)
  if (path.length === 0) return null
  const compiled = compileLine(play, path, settings, caches)
  const phase = compiled.phases[compiled.phases.length - 1]
  if (!phase || phase.phaseId !== phaseId) return null
  const players: ScenePlayer[] = []
  for (const p of compiled.players) {
    const pos = phase.startPositions[p.id]
    if (pos)
      players.push({ id: p.id, team: p.team, number: p.number, color: p.color, pos: copy(pos) })
  }
  let ball: BallState | null = null
  if (compiled.hasBall) {
    const holder = phase.holderAtStart
    if (holder.kind === 'carried') {
      const pos = phase.startPositions[holder.carrierId]
      if (pos) ball = { kind: 'carried', carrierId: holder.carrierId, pos: copy(pos) }
    } else if (holder.kind === 'loose') {
      ball = { kind: 'loose', pos: copy(holder.pos) }
    }
  }
  const ancestors = compiled.phases.slice(0, -1)
  return {
    phaseId,
    path,
    players,
    ball,
    runs: schematicRuns(phase),
    passes: schematicPasses(phase),
    ancestorRuns: ancestors.flatMap(schematicRuns),
    ancestorPasses: ancestors.flatMap((a) => schematicPasses(a).filter((p) => p.applied)),
    gainLineX: compiled.gainLineX,
    attackingTeam: compiled.attackingTeam,
    field: { ...compiled.field },
    phaseStart: phase.start,
    phaseEnd: phase.end,
    instruction: phase.instruction,
  }
}

/** Position of every player at the start of a phase (used by editing commands). */
export function positionsAtPhaseStart(
  play: Play,
  phaseId: Id,
  settings: EngineSettings,
  caches: EvalCaches,
): Record<Id, Vec2> {
  const schematic = phaseSchematic(play, phaseId, settings, caches)
  const result: Record<Id, Vec2> = {}
  for (const p of schematic?.players ?? []) result[p.id] = p.pos
  return result
}

/** Instant at which an entity obtains the ball in a phase, relative to the phase start, or null. */
export function ballObtainedAt(
  play: Play,
  phaseId: Id,
  entityId: Id,
  settings: EngineSettings,
  caches: EvalCaches,
): number | null {
  const path = pathToPhase(play, phaseId)
  const compiled = compileLine(play, path, settings, caches)
  const phase = compiled.phases[compiled.phases.length - 1]
  if (!phase || phase.phaseId !== phaseId) return null
  if (phase.holderAtStart.kind === 'carried' && phase.holderAtStart.carrierId === entityId) return 0
  const incoming = phase.passes.find((p) => p.applied && p.toId === entityId)
  return incoming ? incoming.arrivalT - phase.start : null
}

export { motionPosition }
