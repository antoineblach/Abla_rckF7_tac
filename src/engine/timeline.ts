// Compilation of a line, a path from the root to a leaf (SPEC 5.1 to 5.8, 10.3, 10.4, D-139): the
// glues resolved over the whole tree, then one simulation over the whole line give the motions of
// each player and the ball; the instants of its branch points, its sequences and its intervals are
// resolved around it. Pure: the result depends only on the inputs.
import { copy } from './vec'
import { contentHash } from '../model/canonical'
import type { EngineSettings } from '../model/settings'
import type { Issue, IssueTarget } from '../model/issues'
import { sequenceLabelOf } from '../model/labels'
import {
  isBall,
  type BreakdownKind,
  type Id,
  type KickKind,
  type Play,
  type PlayerEntity,
  type Team,
  type Vec2,
} from '../model/types'
import type { EvalCaches } from './caches'
import {
  compiledGlues,
  lineActions,
  lineBranches,
  plannedInBranch,
  resolvePlay,
  type CompiledGlue,
  type PlayResolution,
} from './glue'
import { notContinuedIssues } from './launch'
import { motionAt, motionPosition, motionEnd, type RunMotion } from './motion'
import { accelAlertsOf, speedIssues, speedLevelsOf } from './runAlerts'
import type { LineInterval } from './sceneState'
import { simulateLine, type LineSimulation } from './simulate'

export type { CompiledGlue, GlueStatus } from './glue'
export type { AccelAlert, RunMotion, SpeedLevel } from './motion'

export interface CompiledPass {
  actionId: Id
  branchId: Id
  fromId: Id
  toId: Id
  /** Instant asked for; `releaseT` waits for a reception within the tolerance (D-110). */
  plannedT: number
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
  branchId: Id
  kickerId: Id
  kind: KickKind
  /** Receiver, or null for a kick to a point. */
  receiverId: Id | null
  /** Instant asked for; `releaseT` waits for a reception within the tolerance (D-110). */
  plannedT: number
  releaseT: number
  arrivalT: number
  from: Vec2
  to: Vec2
  /** False when the kick is ignored (kicker without ball, simultaneous release). */
  applied: boolean
}

export interface CompiledBreakdown {
  actionId: Id
  branchId: Id
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

/** Ball state from `start` until the start of the next segment of the line. */
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

/** A branch of the line, with its resolved instants. */
export interface CompiledBranch {
  id: Id
  /** The branch point it comes from, 0 for the root. */
  start: number
  /** Its branch point, null when it does not divide in the line. */
  branchAt: number | null
}

/** A sequence of the line after the fallbacks of SPEC 4.3. */
export interface CompiledSequence {
  id: Id
  branchId: Id
  start: number
  end: number
  /** Label typed by the user, or « Séquence n » (D-154). */
  label: string
  instruction: string
}

/** Actual start and end of a block. */
export interface BlockSpan {
  start: number
  end: number
}

export interface CompiledLine {
  line: Id[]
  duration: number
  players: PlayerEntity[]
  hasBall: boolean
  startPositions: Record<Id, Vec2>
  /** Applied motions in start order, several per player, relay moves included. */
  motions: RunMotion[]
  passes: CompiledPass[]
  kicks: CompiledKick[]
  breakdowns: CompiledBreakdown[]
  /** Ball segments in chronological order; the first one starts at 0. */
  ball: BallSegment[]
  branches: CompiledBranch[]
  sequences: CompiledSequence[]
  /** In time order (SPEC 5.1). */
  intervals: LineInterval[]
  /** Actual span of the actions and sequences of the line, by id. */
  blocks: Record<Id, BlockSpan>
  /** Glued edges of the line that apply, resolved (SPEC 5.8). */
  glues: CompiledGlue[]
  /** Gain line changes in time order; empty without ball (SPEC 5.6). */
  gainLine: GainLineChange[]
  attackingTeam: Team
  field: { length: number; width: number; inGoal: number }
  issues: Issue[]
}

/** Position of an entity at absolute time t on a compiled line. */
export function positionAt(compiled: CompiledLine, entityId: Id, t: number): Vec2 | undefined {
  const motion = motionAt(compiled.motions, entityId, t)
  if (motion) return motionPosition(motion, t)
  const start = compiled.startPositions[entityId]
  return start ? copy(start) : undefined
}

/**
 * Rank of the interval at t, -1 before the first one and in a gap where no action starts. The end
 * of an interval belongs to it when no other one starts there (end of the line).
 */
export function intervalIndexAt(compiled: CompiledLine, t: number): number {
  let index = -1
  compiled.intervals.forEach((interval, i) => {
    if (interval.start <= t) index = i
  })
  const interval = compiled.intervals[index]
  return interval && t <= interval.end ? index : -1
}

/** Abscissa of the gain line at t: the ball at t = 0, then each ruck or maul (SPEC 5.6). */
export function gainLineAt(compiled: CompiledLine, t: number): number | null {
  let x: number | null = null
  for (const change of compiled.gainLine) if (change.t <= t) x = change.x
  return x
}

/**
 * Sequences of the line after the fallbacks of SPEC 4.3, in time order: an option does not start
 * before its branch point, a sequence is cut at the branch point it crosses, the second of two
 * overlapping sequences starts at the end of the first. One left empty is dropped, like a sequence
 * whose end is not after its start (D-155), signalled here when an edge is glued.
 */
function resolveSequences(
  play: Play,
  branches: readonly CompiledBranch[],
  resolution: PlayResolution,
  issues: Issue[],
): CompiledSequence[] {
  const inBranches: CompiledSequence[] = []
  for (const sequence of play.sequences) {
    const branch = branches.find((candidate) => candidate.id === sequence.branchId)
    if (!branch) continue
    const target: IssueTarget = { kind: 'sequence', id: sequence.id, branchId: sequence.branchId }
    const span = resolution.sequences.get(sequence.id) ?? sequence
    if (span.end <= span.start) {
      if (sequence.startGlue || sequence.endGlue) {
        issues.push({ code: 'sequenceEndBeforeStart', severity: 'error', target })
      }
      continue
    }
    const start = plannedInBranch(span.start, branch, target, issues)
    let end = span.end
    if (branch.branchAt !== null && start < branch.branchAt && end > branch.branchAt + 1e-9) {
      issues.push({
        code: 'sequenceCrossesBranch',
        severity: 'warning',
        target,
        params: { branchAt: branch.branchAt },
      })
      end = branch.branchAt
    }
    if (end <= start) continue
    inBranches.push({
      id: sequence.id,
      branchId: sequence.branchId,
      start,
      end,
      label: sequenceLabelOf(play, sequence.id),
      instruction: sequence.instruction,
    })
  }
  inBranches.sort((a, b) => a.start - b.start)
  const sequences: CompiledSequence[] = []
  let latestEnd = 0
  for (const sequence of inBranches) {
    const start = Math.max(sequence.start, latestEnd)
    if (start > sequence.start) {
      issues.push({
        code: 'sequenceOverlap',
        severity: 'warning',
        target: { kind: 'sequence', id: sequence.id, branchId: sequence.branchId },
      })
    }
    if (sequence.end <= start) continue
    sequences.push({ ...sequence, start })
    latestEnd = sequence.end
  }
  return sequences
}

/**
 * Intervals of the line (SPEC 5.1): its sequences, and the gaps between them, cut at the branch
 * points, where at least one action starts. The last gap goes up to the end of the line, or to the
 * start of its last action when that one is ignored after it.
 */
function lineIntervals(
  branches: readonly CompiledBranch[],
  sequences: readonly CompiledSequence[],
  actionStarts: readonly number[],
  duration: number,
): LineInterval[] {
  const intervals: LineInterval[] = sequences.map((sequence) => ({
    start: sequence.start,
    end: sequence.end,
    branchId: sequence.branchId,
    sequenceId: sequence.id,
    label: sequence.label,
    instruction: sequence.instruction,
  }))
  const horizon = Math.max(duration, ...actionStarts)
  const addGap = (branchId: Id, from: number, to: number): void => {
    const end = Math.min(to, horizon)
    // Nothing follows a gap that reaches the end of the line: its end belongs to it.
    const closed = to > horizon
    const hasStart = actionStarts.some((s) => s >= from && (s < end || (closed && s === end)))
    if (from <= end && hasStart) {
      intervals.push({ start: from, end, branchId, sequenceId: null, label: '', instruction: '' })
    }
  }
  branches.forEach((branch, i) => {
    const next = branches[i + 1]
    const spanEnd = next ? next.start : Infinity
    let cursor = branch.start
    for (const sequence of sequences) {
      if (sequence.end <= cursor || sequence.start >= spanEnd) continue
      if (sequence.start > cursor) addGap(branch.id, cursor, sequence.start)
      cursor = sequence.end
    }
    if (cursor < spanEnd) addGap(branch.id, cursor, spanEnd)
  })
  return intervals.sort((a, b) => a.start - b.start)
}

/** Actual spans of the actions (the sequences are added by the caller). */
function actionSpans(simulation: LineSimulation): Record<Id, BlockSpan> {
  const blocks: Record<Id, BlockSpan> = {}
  for (const motion of simulation.motions) {
    if (motion.source === 'run') {
      blocks[motion.actionId] = { start: motion.start, end: motionEnd(motion) }
    }
  }
  for (const p of simulation.passes) blocks[p.actionId] = { start: p.releaseT, end: p.arrivalT }
  for (const k of simulation.kicks) blocks[k.actionId] = { start: k.releaseT, end: k.arrivalT }
  for (const b of simulation.breakdowns) blocks[b.actionId] = { start: b.start, end: b.end }
  return blocks
}

/** Compiles a line without cache. `line` is a path from the root; it stops at the first wrong step. */
export function compileLineUncached(
  play: Play,
  line: readonly Id[],
  settings: EngineSettings,
  caches: EvalCaches,
): CompiledLine {
  const resolution = resolvePlay(play, settings, caches)
  const { setup, context, launched, prolongs, prolongedBy, analysis } = resolution
  const { players, startPositions, holderAtStart } = setup
  const issues: Issue[] = []
  const branches = lineBranches(play, line, resolution.branchAt, issues)
  const actions = lineActions(play, branches, resolution.actions, launched, prolongs, issues)
  const simulation = simulateLine({
    ...setup,
    branches,
    actions,
    settings,
    context,
    arrivalDependents: analysis.arrivalDependents,
    followers: resolution.followers,
  })
  const lineIds = branches.map((branch) => branch.id)
  issues.push(...simulation.issues)
  for (const issue of resolution.issues) {
    const { target } = issue
    const branchId = target.kind === 'branch' ? target.id : 'branchId' in target && target.branchId
    if (branchId !== false && lineIds.includes(branchId)) issues.push(issue)
  }
  issues.push(...notContinuedIssues(play, lineIds, simulation.motions, prolongedBy))
  for (const motion of simulation.motions) {
    motion.speedLevels = speedLevelsOf(motion, settings)
    motion.accelAlerts = accelAlertsOf(motion, settings)
    if (motion.source !== 'run') continue
    if (motion.start > motion.planned + 1e-9) {
      issues.push({
        code: 'runStartDelayed',
        severity: 'warning',
        target: { kind: 'action', id: motion.actionId, branchId: motion.branchId },
        params: { delay: motion.start - motion.planned },
      })
    }
    issues.push(...speedIssues(motion))
  }
  const sequences = resolveSequences(play, branches, resolution, issues)
  const blocks = actionSpans(simulation)
  const actionStarts = Object.values(blocks).map((span) => span.start)
  for (const sequence of sequences)
    blocks[sequence.id] = { start: sequence.start, end: sequence.end }
  const gainLine: GainLineChange[] = []
  if (holderAtStart.kind === 'carried') {
    const pos = startPositions[holderAtStart.carrierId]
    if (pos) gainLine.push({ t: 0, x: pos.x })
  } else if (holderAtStart.kind === 'loose') {
    gainLine.push({ t: 0, x: holderAtStart.pos.x })
  }
  gainLine.push(...simulation.gainLine)
  return {
    line: lineIds,
    duration: simulation.duration,
    players: [...players],
    hasBall: play.entities.some(isBall),
    startPositions: { ...startPositions },
    motions: simulation.motions,
    passes: simulation.passes,
    kicks: simulation.kicks,
    breakdowns: simulation.breakdowns,
    ball: simulation.ball,
    branches,
    sequences,
    intervals: lineIntervals(branches, sequences, actionStarts, simulation.duration),
    blocks,
    glues: compiledGlues(play, settings, lineIds, resolution, simulation),
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
