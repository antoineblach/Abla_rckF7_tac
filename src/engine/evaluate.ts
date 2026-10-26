// evaluate(play, branchPath, t, settings, caches) -> SceneState (SPEC 3.3.1, DECISIONS Q3).
// Pure: no clock, no randomness, no global state. Traces are computed from the geometry,
// never accumulated frame by frame (SPEC 5.5).
import { pathToPhase } from '../model/phaseTree'
import type { EngineSettings } from '../model/settings'
import type { BreakdownKind, Id, Play, Vec2 } from '../model/types'
import { kickLift } from './ballEvents'
import type { EvalCaches } from './caches'
import { timeAtDistance, timeAtSegmentEnd } from './profile'
import type {
  BallState,
  KickTrace,
  PassTrace,
  RunPart,
  RunTrace,
  SceneBreakdown,
  ScenePlayer,
  SceneState,
  SpeedBadge,
} from './sceneState'
import {
  inputSegmentEnds,
  partsBetween,
  pathFromDistance,
  pathUpToDistance,
  pointAtDistance,
} from './spline'
import {
  compileLine,
  gainLineAt,
  motionDistance,
  motionEnd,
  motionPosition,
  motionProgress,
  positionInPhase,
  type BallSegment,
  type CompiledLine,
  type CompiledPhase,
  type RunMotion,
  type RunSyncResult,
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

/** Ball segment of a phase at t: the last one started at or before t. */
function segmentAt(phase: CompiledPhase, t: number): BallSegment | undefined {
  let segment = phase.ball[0]
  for (const s of phase.ball) if (s.start <= t) segment = s
  return segment
}

function ballAt(
  compiled: CompiledLine,
  phase: CompiledPhase | undefined,
  t: number,
): BallState | null {
  if (!compiled.hasBall || !phase) return null
  const segment = segmentAt(phase, t)
  if (!segment) return null
  switch (segment.kind) {
    case 'carried': {
      const pos = positionInPhase(phase, segment.carrierId, t)
      return pos ? { kind: 'carried', carrierId: segment.carrierId, pos } : null
    }
    case 'flight': {
      const span = segment.end - segment.start
      const k = span > 0 ? Math.min(1, Math.max(0, (t - segment.start) / span)) : 1
      return {
        kind: 'inFlight',
        from: copy(segment.from),
        to: copy(segment.to),
        releaseT: segment.start,
        arrivalT: segment.end,
        toId: segment.toId,
        pos: lerp(segment.from, segment.to, k),
        via: segment.via,
        lift: segment.via === 'kick' ? kickLift(k) : 0,
      }
    }
    case 'loose':
      return { kind: 'loose', pos: copy(segment.pos) }
    case 'breakdown':
      return { kind: 'inBreakdown', pos: copy(segment.pos) }
    case 'none':
      return null
  }
}

/** Parts of a motion between two arc lengths, fast segments flagged (D-115). */
function runParts(motion: RunMotion, from: number, to: number): RunPart[] {
  return partsBetween(motion.spline, from, to, motion.fastSegments).map((part) => ({
    points: part.points,
    fast: part.flag,
  }))
}

function runTrace(motion: RunMotion, phaseId: Id, current: boolean, t: number): RunTrace | null {
  if (t < motion.start) return null
  const progress = motionProgress(motion, t)
  const reached = progress * motion.spline.length
  const points = pathUpToDistance(motion.spline, reached)
  if (points.length < 2) return null
  return {
    actionId: motion.actionId,
    entityId: motion.entityId,
    phaseId,
    current,
    completed: t >= motionEnd(motion),
    points,
    parts: runParts(motion, 0, reached),
  }
}

/**
 * Badges of the segments of a run beyond a speed threshold (SPEC 5.9, D-112), those entered at t,
 * then of its accelerations and brakings beyond a threshold (D-132), those whose point is reached
 * at t (every one reached by the run for t = Infinity).
 */
function speedBadgesOf(motion: RunMotion, t: number): SpeedBadge[] {
  if (motion.source !== 'run') return []
  const badges: SpeedBadge[] = []
  const { spline, profile } = motion
  const reach = motionDistance(motion, Infinity)
  motion.speedLevels.forEach((level, segment) => {
    if (!level) return
    const enters = motion.start + (segment === 0 ? 0 : timeAtSegmentEnd(profile, segment - 1))
    const from = spline.cumulative[segment * spline.samplesPerSegment] ?? 0
    if (t < enters || from > reach) return
    const to = spline.cumulative[(segment + 1) * spline.samplesPerSegment] ?? spline.length
    badges.push({
      actionId: motion.actionId,
      segment: spline.sourceSegments[segment] ?? segment,
      pos: pointAtDistance(spline, (from + Math.min(to, reach)) / 2),
      level,
      kind: 'speed',
    })
  })
  for (const alert of motion.accelAlerts) {
    if (t < motion.start + timeAtDistance(profile, alert.badgeAt)) continue
    badges.push({
      actionId: motion.actionId,
      segment: spline.sourceSegments[alert.segment] ?? alert.segment,
      pos: pointAtDistance(spline, alert.badgeAt),
      level: alert.level,
      kind: alert.kind,
    })
  }
  return badges
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
  const kickTraces: KickTrace[] = []
  const speedBadges: SpeedBadge[] = []
  for (let i = 0; i <= index; i++) {
    const ph = compiled.phases[i] as CompiledPhase
    const current = i === index
    for (const motion of ph.motions) {
      const trace = runTrace(motion, ph.phaseId, current, t)
      if (trace) traces.push(trace)
      speedBadges.push(...speedBadgesOf(motion, t))
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
        target: copy(p.to),
        completed,
        forward: p.forward,
      })
    }
    for (const k of ph.kicks) {
      if (!k.applied || k.releaseT > t) continue
      const completed = t >= k.arrivalT
      const span = k.arrivalT - k.releaseT
      const to = completed || span <= 0 ? copy(k.to) : lerp(k.from, k.to, (t - k.releaseT) / span)
      kickTraces.push({
        actionId: k.actionId,
        phaseId: ph.phaseId,
        current,
        from: copy(k.from),
        to,
        target: copy(k.to),
        toPoint: k.receiverId === null,
        completed,
      })
    }
  }
  const breakdowns: SceneBreakdown[] = []
  for (const b of phase?.breakdowns ?? []) {
    if (b.applied && b.start <= t && t < b.end) {
      breakdowns.push({ actionId: b.actionId, kind: b.kind, pos: copy(b.pos) })
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
    kickTraces,
    breakdowns,
    speedBadges,
    gainLineX: gainLineAt(compiled, t),
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
  /** Sampled curve from the start position through the waypoints, up to where it is applied. */
  points: Vec2[]
  /** Part of the curve ignored after a breakdown formation (D-079), empty otherwise. */
  ignoredPoints: Vec2[]
  /** Stored waypoints (the start point is not stored, SPEC 5.2). */
  waypoints: Vec2[]
  duration: number
  /** The applied curve cut by speed (fast segments drawn thicker, D-115). */
  parts: RunPart[]
  /** Arc length from the start at each waypoint: end of each input segment (D-114). */
  segmentEnds: number[]
}

/** A synchronisation link drawn in the editor overlay only (SPEC 5.8, D-108). */
export interface SchematicSyncLink {
  /** The linked run. */
  actionId: Id
  /** The action it is synchronised with. */
  targetActionId: Id
  /** Point of the run that meets the target, and point of the target (null when unreached). */
  from: Vec2
  to: Vec2 | null
  result: RunSyncResult
}

export interface SchematicPass {
  actionId: Id
  phaseId: Id
  fromId: Id
  toId: Id
  from: Vec2
  to: Vec2
  applied: boolean
  forward: boolean
}

export interface SchematicKick {
  actionId: Id
  phaseId: Id
  kickerId: Id
  /** Receiver, or null for a kick to a point. */
  receiverId: Id | null
  from: Vec2
  to: Vec2
  applied: boolean
}

export interface SchematicBreakdown {
  actionId: Id
  phaseId: Id
  kind: BreakdownKind
  tackledId: Id
  supportId: Id
  relayerId: Id
  /** Point of the tackled player at formation. */
  pos: Vec2
  applied: boolean
}

export interface PhaseSchematic {
  phaseId: Id
  /** Path from the root to the phase. */
  path: Id[]
  players: ScenePlayer[]
  /** Ball at the start of the phase. */
  ball: BallState | null
  /** Runs drawn by the user (with their ignored part after a breakdown). */
  runs: SchematicRun[]
  /** Relayers joining a breakdown (generated, not editable). */
  relays: SchematicRun[]
  passes: SchematicPass[]
  kicks: SchematicKick[]
  breakdowns: SchematicBreakdown[]
  /** Speeds, accelerations and brakings of the runs of the phase beyond a threshold (editor). */
  speedBadges: SpeedBadge[]
  /** Synchronisation links of the runs of the phase (editor overlay, D-108). */
  syncLinks: SchematicSyncLink[]
  /** Applied runs and relays of the ancestors (applied parts only). */
  ancestorRuns: SchematicRun[]
  ancestorPasses: SchematicPass[]
  ancestorKicks: SchematicKick[]
  ancestorBreakdowns: SchematicBreakdown[]
  /** Gain line in force at the start of the phase (D-082). */
  gainLineX: number | null
  attackingTeam: SceneState['attackingTeam']
  field: SceneState['field']
  phaseStart: number
  phaseEnd: number
  instruction: string
}

function schematicRun(motion: RunMotion, phaseId: Id): SchematicRun {
  const s = motionProgress(motion, Infinity) * motion.spline.length
  const cut = motion.until !== null && s < motion.spline.length
  return {
    actionId: motion.actionId,
    entityId: motion.entityId,
    phaseId,
    points: cut ? pathUpToDistance(motion.spline, s) : motion.spline.samples.map(copy),
    ignoredPoints: cut ? pathFromDistance(motion.spline, s) : [],
    waypoints: motion.waypoints.map(copy),
    duration: motion.duration,
    parts: runParts(motion, 0, cut ? s : motion.spline.length),
    segmentEnds: inputSegmentEnds(motion.spline, motion.waypoints.length),
  }
}

function schematicSyncLinks(play: Play, phase: CompiledPhase): SchematicSyncLink[] {
  const actions = play.phases.find((p) => p.id === phase.phaseId)?.actions ?? []
  return phase.motions.flatMap((motion) => {
    const action = actions.find((a) => a.id === motion.actionId)
    const result = motion.sync
    if (motion.source !== 'run' || action?.type !== 'run' || !action.sync || !result) return []
    return [
      {
        actionId: motion.actionId,
        targetActionId: action.sync.target.actionId,
        from: copy(result.meetPoint),
        to: result.targetPoint ? copy(result.targetPoint) : null,
        result,
      },
    ]
  })
}

function schematicRuns(phase: CompiledPhase): SchematicRun[] {
  return [...phase.motions.filter((m) => m.source === 'run'), ...phase.ignoredRuns].map((m) =>
    schematicRun(m, phase.phaseId),
  )
}

function schematicRelays(phase: CompiledPhase): SchematicRun[] {
  return phase.motions
    .filter((m) => m.source === 'relay')
    .map((m) => schematicRun(m, phase.phaseId))
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
    forward: p.forward,
  }))
}

function schematicKicks(phase: CompiledPhase): SchematicKick[] {
  return phase.kicks.map((k) => ({
    actionId: k.actionId,
    phaseId: phase.phaseId,
    kickerId: k.kickerId,
    receiverId: k.receiverId,
    from: copy(k.from),
    to: copy(k.to),
    applied: k.applied,
  }))
}

function schematicBreakdowns(phase: CompiledPhase): SchematicBreakdown[] {
  return phase.breakdowns.map((b) => ({
    actionId: b.actionId,
    phaseId: phase.phaseId,
    kind: b.kind,
    tackledId: b.tackledId,
    supportId: b.supportId,
    relayerId: b.relayerId,
    pos: copy(b.pos),
    applied: b.applied,
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
    relays: schematicRelays(phase),
    passes: schematicPasses(phase),
    kicks: schematicKicks(phase),
    breakdowns: schematicBreakdowns(phase),
    speedBadges: phase.motions.flatMap((m) => speedBadgesOf(m, Infinity)),
    syncLinks: schematicSyncLinks(play, phase),
    ancestorRuns: ancestors.flatMap((a) =>
      a.motions.map((m) => ({ ...schematicRun(m, a.phaseId), ignoredPoints: [] })),
    ),
    ancestorPasses: ancestors.flatMap((a) => schematicPasses(a).filter((p) => p.applied)),
    ancestorKicks: ancestors.flatMap((a) => schematicKicks(a).filter((k) => k.applied)),
    ancestorBreakdowns: ancestors.flatMap((a) => schematicBreakdowns(a).filter((b) => b.applied)),
    gainLineX: gainLineAt(compiled, phase.start),
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

/** Compiled phase reached by the path from the root to `phaseId` (editing commands), or null. */
export function compiledPhaseOf(
  play: Play,
  phaseId: Id,
  settings: EngineSettings,
  caches: EvalCaches,
): CompiledPhase | null {
  const compiled = compileLine(play, pathToPhase(play, phaseId), settings, caches)
  const phase = compiled.phases[compiled.phases.length - 1]
  return phase?.phaseId === phaseId ? phase : null
}

/**
 * Instant at which an entity obtains the ball in a phase, relative to the phase start, or null:
 * it carries it at the start, or receives it by a pass or a kick, a breakdown exit or a pickup.
 */
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
  const obtained = phase.ball.find((s) => s.kind === 'carried' && s.carrierId === entityId)
  return obtained ? obtained.start - phase.start : null
}

export { motionPosition }
