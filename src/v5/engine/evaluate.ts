// evaluate(play, branchPath, t, settings, caches) -> SceneState (SPEC 3.3.1, DECISIONS Q3).
// Pure: no clock, no randomness, no global state. Traces are computed from the geometry,
// never accumulated frame by frame (SPEC 5.5).
import { timeAtDistance, timeAtSegmentEnd } from '../../engine/profile'
import {
  inputSegmentEnds,
  partsBetween,
  pathFromDistance,
  pathUpToDistance,
  pointAtDistance,
} from '../../engine/spline'
import { copy, lerp } from '../../engine/vec'
import type { EngineSettings } from '../../model/settings'
import type { BreakdownKind, Id, Play, Vec2 } from '../model/types'
import { kickLift } from './ballEvents'
import type { EvalCaches } from './caches'
import { motionDistance, motionEnd, motionProgress, type RunMotion } from './motion'
import type {
  BallState,
  KickTrace,
  LineInterval,
  PassTrace,
  RunPart,
  RunTrace,
  SceneBreakdown,
  ScenePlayer,
  SceneState,
  SpeedBadge,
} from './sceneState'
import {
  compileLine,
  gainLineAt,
  intervalIndexAt,
  positionAt,
  type BallSegment,
  type CompiledGlue,
  type CompiledLine,
  type GlueStatus,
} from './timeline'

function clampTime(compiled: CompiledLine, t: number): number {
  if (!Number.isFinite(t) || t < 0) return 0
  return Math.min(t, compiled.duration)
}

/** Ball segment of a line at t: the last one started at or before t. */
function segmentAt(compiled: CompiledLine, t: number): BallSegment | undefined {
  let segment = compiled.ball[0]
  for (const s of compiled.ball) if (s.start <= t) segment = s
  return segment
}

function ballAt(compiled: CompiledLine, t: number): BallState | null {
  if (!compiled.hasBall) return null
  const segment = segmentAt(compiled, t)
  if (!segment) return null
  switch (segment.kind) {
    case 'carried': {
      const pos = positionAt(compiled, segment.carrierId, t)
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

function playersAt(compiled: CompiledLine, t: number): ScenePlayer[] {
  const players: ScenePlayer[] = []
  for (const p of compiled.players) {
    const pos = positionAt(compiled, p.id, t)
    if (pos) players.push({ id: p.id, team: p.team, number: p.number, color: p.color, pos })
  }
  return players
}

/** Parts of a motion between two arc lengths, fast segments flagged (D-115). */
function runParts(motion: RunMotion, from: number, to: number): RunPart[] {
  return partsBetween(motion.spline, from, to, motion.fastSegments).map((part) => ({
    points: part.points,
    fast: part.flag,
  }))
}

function runTrace(motion: RunMotion, current: boolean, t: number): RunTrace | null {
  if (t < motion.start) return null
  const progress = motionProgress(motion, t)
  const reached = progress * motion.spline.length
  const points = pathUpToDistance(motion.spline, reached)
  if (points.length < 2) return null
  return {
    actionId: motion.actionId,
    entityId: motion.entityId,
    branchId: motion.branchId,
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
  const index = intervalIndexAt(compiled, t)
  /** An action belongs to the interval it starts in (SPEC 5.1). */
  const inInterval = (start: number): boolean =>
    index >= 0 && intervalIndexAt(compiled, start) === index
  const traces: RunTrace[] = []
  const speedBadges: SpeedBadge[] = []
  for (const motion of compiled.motions) {
    const trace = runTrace(motion, inInterval(motion.start), t)
    if (trace) traces.push(trace)
    speedBadges.push(...speedBadgesOf(motion, t))
  }
  const passTraces: PassTrace[] = []
  for (const p of compiled.passes) {
    if (!p.applied || p.releaseT > t) continue
    const completed = t >= p.arrivalT
    const span = p.arrivalT - p.releaseT
    const to = completed || span <= 0 ? copy(p.to) : lerp(p.from, p.to, (t - p.releaseT) / span)
    passTraces.push({
      actionId: p.actionId,
      branchId: p.branchId,
      current: inInterval(p.releaseT),
      from: copy(p.from),
      to,
      target: copy(p.to),
      completed,
      forward: p.forward,
    })
  }
  const kickTraces: KickTrace[] = []
  for (const k of compiled.kicks) {
    if (!k.applied || k.releaseT > t) continue
    const completed = t >= k.arrivalT
    const span = k.arrivalT - k.releaseT
    const to = completed || span <= 0 ? copy(k.to) : lerp(k.from, k.to, (t - k.releaseT) / span)
    kickTraces.push({
      actionId: k.actionId,
      branchId: k.branchId,
      current: inInterval(k.releaseT),
      from: copy(k.from),
      to,
      target: copy(k.to),
      toPoint: k.receiverId === null,
      completed,
    })
  }
  const breakdowns: SceneBreakdown[] = []
  for (const b of compiled.breakdowns) {
    if (b.applied && b.start <= t && t < b.end) {
      breakdowns.push({ actionId: b.actionId, kind: b.kind, pos: copy(b.pos) })
    }
  }
  const interval = compiled.intervals[index] ?? null
  return {
    t,
    duration: compiled.duration,
    line: [...compiled.line],
    interval,
    instruction: interval?.instruction ?? '',
    attackingTeam: compiled.attackingTeam,
    field: { ...compiled.field },
    players: playersAt(compiled, t),
    ball: ballAt(compiled, t),
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
// Schematic data of a window at rest (editor, thumbnails, renderSchematic).

export interface SchematicRun {
  actionId: Id
  entityId: Id
  branchId: Id
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

export interface SchematicPass {
  actionId: Id
  branchId: Id
  fromId: Id
  toId: Id
  from: Vec2
  to: Vec2
  applied: boolean
  forward: boolean
}

export interface SchematicKick {
  actionId: Id
  branchId: Id
  kickerId: Id
  /** Receiver, or null for a kick to a point. */
  receiverId: Id | null
  from: Vec2
  to: Vec2
  applied: boolean
}

export interface SchematicBreakdown {
  actionId: Id
  branchId: Id
  kind: BreakdownKind
  tackledId: Id
  supportId: Id
  relayerId: Id
  /** Point of the tackled player at formation. */
  pos: Vec2
  applied: boolean
}

/**
 * A glue line of a block of the window (SPEC 5.8): from the point of the edge to the point of the
 * target; editor overlay only, never exported. The overlay draws it when the block or its target is
 * selected.
 */
export interface SchematicGlueLink {
  ownerId: Id
  targetId: Id
  kind: CompiledGlue['kind']
  from: Vec2
  /** Null when the target has no point on the field or is never reached. */
  to: Vec2 | null
  status: GlueStatus
}

/** The field at an instant at rest (SPEC 6.3): the window is the interval at that instant. */
export interface WindowSchematic {
  /** Path of the line. */
  line: Id[]
  t: number
  /** The interval at t, null in a gap where no action starts. */
  window: LineInterval | null
  players: ScenePlayer[]
  /** Ball at t. */
  ball: BallState | null
  /** Runs drawn by the user that start in the window, with their ignored part after a breakdown. */
  runs: SchematicRun[]
  /** Relayers joining a breakdown of the window (generated, not editable). */
  relays: SchematicRun[]
  passes: SchematicPass[]
  kicks: SchematicKick[]
  breakdowns: SchematicBreakdown[]
  /** Speeds, accelerations and brakings of the runs of the window beyond a threshold (editor). */
  speedBadges: SpeedBadge[]
  /** Glue lines of the blocks of the window (editor overlay, SPEC 5.8). */
  glueLinks: SchematicGlueLink[]
  /** Applied runs and relays that start before the window (applied parts only, grey). */
  earlierRuns: SchematicRun[]
  earlierPasses: SchematicPass[]
  earlierKicks: SchematicKick[]
  earlierBreakdowns: SchematicBreakdown[]
  /** Gain line in force at the start of the window (D-082). */
  gainLineX: number | null
  attackingTeam: SceneState['attackingTeam']
  field: SceneState['field']
  instruction: string
}

function schematicRun(motion: RunMotion): SchematicRun {
  const s = motionProgress(motion, Infinity) * motion.spline.length
  const cut = motion.until !== null && s < motion.spline.length
  return {
    actionId: motion.actionId,
    entityId: motion.entityId,
    branchId: motion.branchId,
    points: cut ? pathUpToDistance(motion.spline, s) : motion.spline.samples.map(copy),
    ignoredPoints: cut ? pathFromDistance(motion.spline, s) : [],
    waypoints: motion.waypoints.map(copy),
    duration: motion.duration,
    parts: runParts(motion, 0, cut ? s : motion.spline.length),
    segmentEnds: inputSegmentEnds(motion.spline, motion.waypoints.length),
  }
}

function schematicPass(compiled: CompiledLine['passes'][number]): SchematicPass {
  return {
    actionId: compiled.actionId,
    branchId: compiled.branchId,
    fromId: compiled.fromId,
    toId: compiled.toId,
    from: copy(compiled.from),
    to: copy(compiled.to),
    applied: compiled.applied,
    forward: compiled.forward,
  }
}

function schematicKick(compiled: CompiledLine['kicks'][number]): SchematicKick {
  return {
    actionId: compiled.actionId,
    branchId: compiled.branchId,
    kickerId: compiled.kickerId,
    receiverId: compiled.receiverId,
    from: copy(compiled.from),
    to: copy(compiled.to),
    applied: compiled.applied,
  }
}

function schematicBreakdown(compiled: CompiledLine['breakdowns'][number]): SchematicBreakdown {
  return {
    actionId: compiled.actionId,
    branchId: compiled.branchId,
    kind: compiled.kind,
    tackledId: compiled.tackledId,
    supportId: compiled.supportId,
    relayerId: compiled.relayerId,
    pos: copy(compiled.pos),
    applied: compiled.applied,
  }
}

function schematicGlueLinks(
  compiled: CompiledLine,
  inWindow: (start: number) => boolean,
): SchematicGlueLink[] {
  return compiled.glues.flatMap(({ ownerId, targetId, kind, from, to, status }) => {
    const block = compiled.blocks[ownerId]
    if (!from || !block || !inWindow(block.start)) return []
    return [{ ownerId, targetId, kind, from: copy(from), to: to ? copy(to) : null, status }]
  })
}

/**
 * The field of a line at t (SPEC 6.3, D-141): positions at t, actions of the interval at t in full,
 * earlier ones in grey, later ones absent.
 */
export function windowSchematic(
  play: Play,
  line: readonly Id[],
  rawT: number,
  settings: EngineSettings,
  caches: EvalCaches,
): WindowSchematic {
  const compiled = compileLine(play, line, settings, caches)
  const t = clampTime(compiled, rawT)
  const index = intervalIndexAt(compiled, t)
  const window = compiled.intervals[index] ?? null
  const inWindow = (start: number): boolean =>
    index >= 0 && intervalIndexAt(compiled, start) === index
  const earlier = (start: number): boolean =>
    !inWindow(start) && start < (window ? window.start : t + 1e-9)
  const runMotions = compiled.motions.filter((m) => m.source === 'run')
  const relayMotions = compiled.motions.filter((m) => m.source === 'relay')
  return {
    line: [...compiled.line],
    t,
    window,
    players: playersAt(compiled, t),
    ball: ballAt(compiled, t),
    runs: runMotions.filter((m) => inWindow(m.start)).map(schematicRun),
    relays: relayMotions.filter((m) => inWindow(m.start)).map(schematicRun),
    passes: compiled.passes.filter((p) => inWindow(p.releaseT)).map(schematicPass),
    kicks: compiled.kicks.filter((k) => inWindow(k.releaseT)).map(schematicKick),
    breakdowns: compiled.breakdowns.filter((b) => inWindow(b.start)).map(schematicBreakdown),
    speedBadges: compiled.motions
      .filter((m) => inWindow(m.start))
      .flatMap((m) => speedBadgesOf(m, Infinity)),
    glueLinks: schematicGlueLinks(compiled, inWindow),
    earlierRuns: compiled.motions
      .filter((m) => earlier(m.start))
      .map((m) => ({ ...schematicRun(m), ignoredPoints: [] })),
    earlierPasses: compiled.passes
      .filter((p) => p.applied && earlier(p.releaseT))
      .map(schematicPass),
    earlierKicks: compiled.kicks.filter((k) => k.applied && earlier(k.releaseT)).map(schematicKick),
    earlierBreakdowns: compiled.breakdowns
      .filter((b) => b.applied && earlier(b.start))
      .map(schematicBreakdown),
    gainLineX: gainLineAt(compiled, window ? window.start : t),
    attackingTeam: compiled.attackingTeam,
    field: { ...compiled.field },
    instruction: window?.instruction ?? '',
  }
}

/** Position of every player at t on a line (used by editing commands). */
export function positionsAt(
  play: Play,
  line: readonly Id[],
  t: number,
  settings: EngineSettings,
  caches: EvalCaches,
): Record<Id, Vec2> {
  const compiled = compileLine(play, line, settings, caches)
  const result: Record<Id, Vec2> = {}
  for (const p of playersAt(compiled, clampTime(compiled, t))) result[p.id] = p.pos
  return result
}

/**
 * First instant at which an entity holds the ball on a line, or null: she carries it at the start,
 * or receives it by a pass or a kick, a breakdown exit or a pickup.
 */
export function ballObtainedAt(
  play: Play,
  line: readonly Id[],
  entityId: Id,
  settings: EngineSettings,
  caches: EvalCaches,
): number | null {
  const compiled = compileLine(play, line, settings, caches)
  const obtained = compiled.ball.find((s) => s.kind === 'carried' && s.carrierId === entityId)
  return obtained ? obtained.start : null
}
