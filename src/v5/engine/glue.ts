// Resolution of the glues of a play (SPEC 4.3, 5.2, 5.8, D-139). Branch by branch from the trunk to
// the leaves, an edge is resolved with the actions of its branch and of its ancestors only, in the
// order of the dependency graph: the trunk is the same in every line by construction. For each edge,
// the line is simulated with the current values and the instant of the target is read there; then
// the block is adjusted. One compilation for the whole tree, shared by its lines; at most one more
// for the runs of the trunk whose next run really starts after their end (SPEC 5.2). Pure.
import { PASS_FIXED_POINT_ITERATIONS } from '../../config/defaults'
import { copy, distance } from '../../engine/vec'
import { contentHash } from '../../model/canonical'
import type { EngineSettings } from '../../model/settings'
import { childrenOf, findBranch, pathToBranch, rootBranch } from '../model/branches'
import type { Issue, IssueCode, IssueTarget } from '../model/issues'
import {
  analyseGlues,
  edgeKey,
  meetsOwnPass,
  type GlueAnalysis,
  type GlueEdge,
  type GlueEdgeKind,
} from '../model/syncGraph'
import type { Action, Id, Play, RunAction, Sequence, Vec2 } from '../model/types'
import { kickFlightTime } from './ballEvents'
import type { EvalCaches } from './caches'
import { prolongedRuns } from './launch'
import {
  createMotionContext,
  motionAt,
  motionEnd,
  motionPosition,
  runMotion,
  solveRun,
  waypointTime,
  type MotionContext,
  type RunLevers,
  type RunMotion,
  type RunSpec,
} from './motion'
import {
  lineSetup,
  simulateLine,
  type LineAction,
  type LineSetup,
  type LineSimulation,
} from './simulate'
import type { CompiledBranch } from './timeline'

const EPSILON = 1e-9

/**
 * 'ok': the edge is on its target. 'late': started at its bound (a run is sped up, another block
 * arrives late). 'beforeStart': the target is before the start, stored values, arriving late.
 * 'unreached': the target never happens, stored values.
 */
export type GlueStatus = 'ok' | 'late' | 'beforeStart' | 'unreached'

/** A glued edge of a line once resolved (SPEC 5.8). */
export interface CompiledGlue {
  ownerId: Id
  kind: GlueEdgeKind
  targetId: Id
  status: GlueStatus
  /** Instant of the target plus its gap, null when it is never reached. */
  targetT: number | null
  /** Point of the edge on the field; null for a sequence or a branch point. */
  from: Vec2 | null
  /** Point of the target; null when it has none or is never reached. */
  to: Vec2 | null
}

/** Current values of an action during the resolution. */
interface ActionState {
  /** The action, with the field of its right edge adapted (`ballSpeed`, `flightTime`, `duration`). */
  action: Action
  start: number
  glued: boolean
  unreached: boolean
  /** Pass: its receiver, glued to its arrival, reaches her point at this instant (SPEC 5.8). */
  meetAt: number | null
  levers: RunLevers | null
  ignoreImposed: boolean
}

interface SequenceState {
  start: number
  end: number
}

export interface PlayResolution {
  analysis: GlueAnalysis
  setup: LineSetup
  context: MotionContext
  actions: ReadonlyMap<Id, ActionState>
  sequences: ReadonlyMap<Id, SequenceState>
  /** Branch points glued and reached. */
  branchAt: ReadonlyMap<Id, number>
  statuses: ReadonlyMap<string, GlueStatus>
  /** Alerts of the edges, each on its block: a line takes those of its branches. */
  issues: readonly Issue[]
  /** Runs ending at speed. */
  launched: ReadonlySet<Id>
  /** By run, the run it may prolong. */
  prolongs: ReadonlyMap<Id, Id>
  /** By run ending at speed, the runs that really prolong it. */
  prolongedBy: ReadonlyMap<Id, readonly Id[]>
}

/**
 * Branches of the line with their instants, up to the first one that does not continue it. A branch
 * point not after the previous one stays at the previous one: an option never starts before a
 * branch point it comes from (D-158).
 */
export function lineBranches(
  play: Play,
  line: readonly Id[],
  branchAt: ReadonlyMap<Id, number>,
  issues: Issue[],
): CompiledBranch[] {
  const branches: CompiledBranch[] = []
  let latest = 0
  let previous: Id | null = null
  for (const id of line) {
    const branch = findBranch(play, id)
    if (!branch || branch.parentId !== previous) break
    const instant = branchAt.get(id) ?? branch.branchAt
    const stored = instant !== undefined && childrenOf(play, id).length > 0 ? instant : null
    const start = latest
    if (stored !== null) {
      if (branches.length > 0 && stored <= latest) {
        issues.push({
          code: 'branchAtNotIncreasing',
          severity: 'error',
          target: { kind: 'branch', id },
        })
      }
      latest = Math.max(latest, stored)
    }
    branches.push({ id, start, branchAt: stored === null ? null : latest })
    previous = id
  }
  return branches
}

/**
 * Instant asked for by a block once in its branch (SPEC 4.3): an option does not start before its
 * branch point; a block of the trunk from the branch point on stays common, signalled.
 */
export function plannedInBranch(
  instant: number,
  branch: CompiledBranch,
  target: IssueTarget,
  issues: Issue[],
): number {
  const planned = Math.max(instant, branch.start)
  if (instant < branch.start - EPSILON) {
    issues.push({
      code: 'startsBeforeBranch',
      severity: 'warning',
      target,
      params: { branchAt: branch.start },
    })
  }
  if (branch.branchAt !== null && planned >= branch.branchAt - EPSILON) {
    issues.push({
      code: 'startsAfterBranch',
      severity: 'warning',
      target,
      params: { branchAt: branch.branchAt },
    })
  }
  return planned
}

/** Actions of the line for the simulation, with their current values. */
export function lineActions(
  play: Play,
  branches: readonly CompiledBranch[],
  states: ReadonlyMap<Id, ActionState>,
  launched: ReadonlySet<Id>,
  prolongs: ReadonlyMap<Id, Id>,
  issues: Issue[],
): LineAction[] {
  const branchIndex = new Map(branches.map((branch, index) => [branch.id, index]))
  const actions: LineAction[] = []
  play.actions.forEach((stored, index) => {
    const rank = branchIndex.get(stored.branchId)
    const branch = rank === undefined ? undefined : branches[rank]
    const state = states.get(stored.id)
    if (rank === undefined || !branch || !state) return
    const target = { kind: 'action', id: stored.id, branchId: stored.branchId } as const
    actions.push({
      action: state.action,
      index,
      branchIndex: rank,
      planned: plannedInBranch(state.start, branch, target, issues),
      glued: state.glued,
      unreached: state.unreached,
      meetAt: state.meetAt,
      spec: {
        levers: state.levers,
        ignoreImposed: state.ignoreImposed,
        endsAtSpeed: launched.has(stored.id),
      },
      prolongs: prolongs.get(stored.id) ?? null,
    })
  })
  return actions
}

function positionIn(
  simulation: LineSimulation,
  setup: LineSetup,
  id: Id,
  t: number,
): Vec2 | undefined {
  const motion = motionAt(simulation.motions, id, t)
  if (motion) return motionPosition(motion, t)
  const start = setup.startPositions[id]
  return start ? copy(start) : undefined
}

const runMotionOf = (simulation: LineSimulation, id: Id): RunMotion | undefined =>
  simulation.motions.find((m) => m.source === 'run' && m.actionId === id)

/** Instant and point of an event of an action on a simulation, null when it never happens. */
function actionEvent(
  simulation: LineSimulation,
  target: Action,
  event: GlueEdge['glue']['event'],
): { t: number; point: Vec2 | null } | null {
  switch (target.type) {
    case 'run': {
      const motion = runMotionOf(simulation, target.id)
      if (!motion) return null
      if (event === 'start') return { t: motion.start, point: motionPosition(motion, motion.start) }
      if (event === 'end') {
        const t = motionEnd(motion)
        return { t, point: motionPosition(motion, t) }
      }
      const t = motion.start + waypointTime(motion, event.point)
      if (motion.until !== null && t > motion.until + EPSILON) return null
      const point = motion.waypoints[event.point]
      return point ? { t, point: copy(point) } : null
    }
    case 'pass':
    case 'kick': {
      const thrown =
        target.type === 'pass'
          ? simulation.passes.find((p) => p.actionId === target.id)
          : simulation.kicks.find((k) => k.actionId === target.id)
      if (!thrown?.applied) return null
      return event === 'start'
        ? { t: thrown.releaseT, point: copy(thrown.from) }
        : { t: thrown.arrivalT, point: copy(thrown.to) }
    }
    case 'breakdown': {
      const formed = simulation.breakdowns.find((b) => b.actionId === target.id)
      if (!formed?.applied) return null
      return { t: event === 'start' ? formed.start : formed.end, point: copy(formed.pos) }
    }
    case 'groupRun':
      return null
  }
}

/** What the reading of a target needs. */
interface TargetContext {
  play: Play
  settings: EngineSettings
  states: ReadonlyMap<Id, ActionState>
  sequences: ReadonlyMap<Id, SequenceState>
  branchAt: ReadonlyMap<Id, number>
}

/**
 * The target of an edge on a simulation, its gap aside; null when it never happens. A receiver glued
 * by her right edge to the arrival of the pass she receives: the ball arrives at her point when she
 * gets there (SPEC 5.8, D-108).
 */
function readTarget(
  edge: GlueEdge,
  context: TargetContext,
  simulation: () => LineSimulation,
): { t: number; point: Vec2 | null } | null {
  const { play, settings, states } = context
  const { glue } = edge
  const target = states.get(glue.targetId)?.action
  if (target) {
    const read = simulation()
    const owner = states.get(edge.ownerId)?.action
    if (target.type === 'pass' && owner?.type === 'run' && meetsOwnPass(play, edge)) {
      const thrown = read.passes.find((p) => p.actionId === target.id)
      const last = owner.waypoints[owner.waypoints.length - 1]
      const speed = target.ballSpeed ?? settings.passSpeed
      if (!thrown?.applied || !last || speed <= 0) return null
      const point = { x: last.x, y: last.y }
      return { t: thrown.releaseT + distance(thrown.from, point) / speed, point }
    }
    return actionEvent(read, target, glue.event)
  }
  const sequence = context.sequences.get(glue.targetId)
  if (sequence) return { t: glue.event === 'start' ? sequence.start : sequence.end, point: null }
  const branches = lineBranches(play, pathToBranch(play, glue.targetId), context.branchAt, [])
  const instant = branches[branches.length - 1]?.branchAt ?? null
  return instant === null ? null : { t: instant, point: null }
}

/** One pass over the branch tree. */
interface Walk {
  actions: Map<Id, ActionState>
  sequences: Map<Id, SequenceState>
  branchAt: Map<Id, number>
  statuses: Map<string, GlueStatus>
  issues: Issue[]
  prolongedBy: Map<Id, Id[]>
}

function initialStates(play: Play): Map<Id, ActionState> {
  const states = new Map<Id, ActionState>()
  for (const action of play.actions) {
    states.set(action.id, {
      action,
      start: action.start,
      glued: false,
      unreached: false,
      meetAt: null,
      levers: null,
      ignoreImposed: false,
    })
  }
  return states
}

function walkBranches(
  play: Play,
  settings: EngineSettings,
  analysis: GlueAnalysis,
  setup: LineSetup,
  context: MotionContext,
  launched: ReadonlySet<Id>,
  prolongs: ReadonlyMap<Id, Id>,
): Walk {
  const walk: Walk = {
    actions: initialStates(play),
    sequences: new Map(play.sequences.map((s) => [s.id, { start: s.start, end: s.end }])),
    branchAt: new Map(),
    statuses: new Map(),
    issues: [],
    prolongedBy: new Map(),
  }
  const { actions: states, sequences, branchAt, statuses, issues } = walk
  const targets: TargetContext = { play, settings, states, sequences, branchAt }

  const stretches = (edge: GlueEdge): boolean =>
    edge.keep === 'start' || analysis.gluedStarts.has(edge.ownerId)

  /**
   * Breakdowns whose formation is still to resolve: left out of the simulations. At its stored
   * instant, a formation would stop the runs of its players, the very target it may be glued to.
   */
  const unformed = new Set<Id>()
  for (const edge of analysis.order) {
    if (edge.kind === 'branchAt' || (edge.kind === 'end' && stretches(edge))) continue
    if (states.get(edge.ownerId)?.action.type === 'breakdown') unformed.add(edge.ownerId)
  }

  const simulate = (line: readonly Id[]): LineSimulation => {
    const ignored: Issue[] = []
    const branches = lineBranches(play, line, branchAt, ignored)
    const actions = lineActions(play, branches, states, launched, prolongs, ignored)
    return simulateLine({
      ...setup,
      branches,
      actions: actions.filter(({ action }) => !unformed.has(action.id)),
      settings,
      context,
      arrivalDependents: analysis.arrivalDependents,
    })
  }

  const report = (
    edge: GlueEdge,
    status: GlueStatus,
    code?: IssueCode,
    params?: Issue['params'],
  ): void => {
    statuses.set(edgeKey(edge), status)
    if (!code) return
    const { ownerId, branchId, kind } = edge
    const target: IssueTarget =
      kind === 'branchAt'
        ? { kind: 'branch', id: ownerId }
        : { kind: sequences.has(ownerId) ? 'sequence' : 'action', id: ownerId, branchId }
    const severity = code === 'glueTargetUnreached' ? 'error' : 'warning'
    issues.push({ code, severity, target, key: kind, ...(params ? { params } : {}) })
  }

  /** Start of the branch of a block: the bound of an action of an option (D-131). */
  const branchStartOf = (branchId: Id): number => {
    const branches = lineBranches(play, pathToBranch(play, branchId), branchAt, [])
    return branches[branches.length - 1]?.start ?? 0
  }

  /**
   * Right edge of a block whose right field is a length (kick, breakdown, sequence): the field adapts,
   * or the start follows and the field stays (SPEC 5.8).
   */
  const applyLength = (
    edge: GlueEdge,
    wanted: number,
    start: number,
    length: number,
    stretch: (length: number) => void,
    slide: (start: number) => void,
  ): boolean => {
    if (stretches(edge)) {
      if (wanted <= start + EPSILON) {
        report(edge, 'beforeStart', 'glueArrivesLate', {
          late: Math.max(0, start + length - wanted),
        })
        return false
      }
      stretch(wanted - start)
      report(edge, 'ok')
      return true
    }
    const bound = branchStartOf(edge.branchId)
    const candidate = wanted - length
    if (candidate < bound - EPSILON) {
      slide(bound)
      report(edge, 'late', 'glueArrivesLate', { late: bound - candidate })
    } else {
      slide(Math.max(candidate, bound))
      report(edge, 'ok')
    }
    return true
  }

  /** Right edge of a pass: its speed adapts, or its release by a fixed point (SPEC 5.4, 5.8). */
  const applyPassEnd = (
    edge: GlueEdge,
    state: ActionState,
    wanted: number,
    read: LineSimulation,
  ): boolean => {
    const { action } = state
    if (action.type !== 'pass') return false
    const speed = action.ballSpeed ?? settings.passSpeed
    const to = positionIn(read, setup, action.toId, wanted)
    if (!to || speed <= 0) return false
    const flightFrom = (release: number): number | null => {
      const from = positionIn(read, setup, action.fromId, release)
      return from ? distance(from, to) : null
    }
    if (stretches(edge)) {
      const release = read.passes.find((p) => p.actionId === action.id)?.releaseT ?? state.start
      const length = flightFrom(release)
      if (length === null) return false
      if (wanted <= release + EPSILON) {
        report(edge, 'beforeStart', 'glueArrivesLate', {
          late: Math.max(0, release + length / speed - wanted),
        })
        return false
      }
      report(edge, 'ok')
      if (length <= EPSILON) return false
      state.action = { ...action, ballSpeed: length / (wanted - release) }
      return true
    }
    let release = state.start
    for (let i = 0; i < PASS_FIXED_POINT_ITERATIONS; i++) {
      const length = flightFrom(Math.max(release, 0))
      if (length === null) return false
      release = wanted - length / speed
    }
    const bound = branchStartOf(edge.branchId)
    if (release < bound - EPSILON) {
      const length = flightFrom(bound)
      state.start = bound
      report(edge, 'late', 'glueArrivesLate', {
        late: length === null ? bound - release : bound + length / speed - wanted,
      })
    } else {
      state.start = Math.max(release, bound)
      report(edge, 'ok')
    }
    return true
  }

  /**
   * Right edge of a run (SPEC 5.8, D-131, D-136): the levers keep its start and it lasts until the
   * target, or it keeps its duration and its start follows; a start before its bound is at its bound,
   * with the levers from its stored speeds.
   */
  const applyRunEnd = (
    edge: GlueEdge,
    run: RunAction,
    state: ActionState,
    wanted: number,
    read: LineSimulation,
  ): boolean => {
    const motion = runMotionOf(read, run.id)
    const from = motion?.spline.points[0]
    if (!motion || !from) return false
    const spec: RunSpec = {
      levers: null,
      ignoreImposed: true,
      endsAtSpeed: motion.endsAtSpeed,
      launch: motion.launch,
    }
    const solved = (bound: number): RunLevers | null =>
      wanted > bound + EPSILON ? solveRun(run, from, spec, wanted - bound, context) : null
    /** She reaches her point on time: the pass she receives arrives there then (SPEC 5.8). */
    const onTime = (): void => {
      const pass = states.get(edge.glue.targetId)
      if (pass && meetsOwnPass(play, edge) && (edge.glue.offset ?? 0) <= EPSILON) {
        pass.meetAt = wanted
      }
    }
    if (stretches(edge)) {
      state.ignoreImposed = true
      const levers = solved(motion.start)
      if (levers) {
        state.levers = levers
        onTime()
        report(edge, 'ok')
      } else {
        const stored = runMotion(run, from, motion.planned, motion.start, spec, context)
        report(edge, 'beforeStart', 'glueArrivesLate', {
          late: Math.max(0, motionEnd(stored) - wanted),
        })
      }
      return true
    }
    const candidate = wanted - motion.duration
    const before = read.motions.filter((m) => m.entityId === run.entityId && m.start < motion.start)
    const previous = before[before.length - 1]
    const bound = Math.max(previous ? motionEnd(previous) : 0, branchStartOf(run.branchId))
    if (candidate >= bound - EPSILON) {
      state.start = Math.max(candidate, bound)
      onTime()
      report(edge, 'ok')
      return true
    }
    const levers = solved(bound)
    if (levers) {
      state.start = bound
      state.levers = levers
      state.ignoreImposed = true
      onTime()
      report(edge, 'late', 'glueStartedLate', { late: bound - candidate })
      return true
    }
    report(edge, 'beforeStart', 'glueArrivesLate', {
      late: Math.max(0, motionEnd(motion) - wanted),
    })
    return false
  }

  const applyEnd = (
    edge: GlueEdge,
    owner: Action | Sequence,
    wanted: number,
    read: () => LineSimulation,
  ): boolean => {
    const sequence = sequences.get(owner.id)
    if (sequence) {
      applyLength(
        edge,
        wanted,
        sequence.start,
        sequence.end - sequence.start,
        (length) => {
          sequence.end = sequence.start + length
        },
        (start) => {
          sequence.end = start + (sequence.end - sequence.start)
          sequence.start = start
        },
      )
      return false
    }
    const state = states.get(owner.id)
    if (!state) return false
    const action = state.action
    switch (action.type) {
      case 'run':
        return applyRunEnd(edge, action, state, wanted, read())
      case 'pass':
        return applyPassEnd(edge, state, wanted, read())
      case 'kick': {
        const release = read().kicks.find((k) => k.actionId === action.id)?.releaseT ?? state.start
        return applyLength(
          edge,
          wanted,
          release,
          kickFlightTime(action),
          (flightTime) => {
            state.action = { ...action, flightTime }
          },
          (start) => {
            state.start = start
          },
        )
      }
      case 'breakdown': {
        const formed = read().breakdowns.find((b) => b.actionId === action.id)?.start ?? state.start
        return applyLength(
          edge,
          wanted,
          formed,
          action.duration,
          (duration) => {
            state.action = { ...action, duration }
          },
          (start) => {
            state.start = start
          },
        )
      }
      case 'groupRun':
        return false
    }
  }

  /** Resolves an edge; true when what a simulation reads has changed. */
  const applyEdge = (edge: GlueEdge, read: () => LineSimulation): boolean => {
    const target = readTarget(edge, targets, read)
    const state = states.get(edge.ownerId)
    // Resolved or not, it comes back in the simulations.
    if (unformed.delete(edge.ownerId) && !target) {
      report(edge, 'unreached', 'glueTargetUnreached')
      return true
    }
    if (!target) {
      report(edge, 'unreached', 'glueTargetUnreached')
      if (edge.kind !== 'start' || !state) return false
      if (state.action.type !== 'pass' && state.action.type !== 'kick') return false
      state.glued = true
      state.unreached = true
      return true
    }
    const wanted = target.t + (edge.glue.offset ?? 0)
    if (edge.kind === 'branchAt') {
      branchAt.set(edge.ownerId, wanted)
      report(edge, 'ok')
      return false
    }
    const owner = state?.action ?? play.sequences.find((s) => s.id === edge.ownerId)
    if (!owner) return false
    if (edge.kind === 'end') return applyEnd(edge, owner, wanted, read)
    report(edge, 'ok')
    const sequence = sequences.get(edge.ownerId)
    if (sequence) {
      sequence.start = wanted
      return false
    }
    if (!state) return false
    state.start = wanted
    state.glued = true
    return true
  }

  const followers = new Map<Id, Id[]>()
  for (const id of prolongs.keys()) {
    const branchId = states.get(id)?.action.branchId
    if (branchId !== undefined) followers.set(branchId, [...(followers.get(branchId) ?? []), id])
  }

  const seen = new Set<Id>()
  const visit = (branchId: Id): void => {
    if (seen.has(branchId)) return
    seen.add(branchId)
    const line = pathToBranch(play, branchId)
    let current: LineSimulation | null = null
    const read = (): LineSimulation => (current ??= simulate(line))
    for (const edge of analysis.order) {
      if (edge.branchId === branchId && applyEdge(edge, read)) current = null
    }
    const inBranch = followers.get(branchId)
    if (inBranch) {
      const final = read()
      for (const id of inBranch) {
        const previous = prolongs.get(id)
        if (previous === undefined || !runMotionOf(final, id)?.launch) continue
        walk.prolongedBy.set(previous, [...(walk.prolongedBy.get(previous) ?? []), id])
      }
    }
    for (const child of childrenOf(play, branchId)) visit(child.id)
  }
  const root = rootBranch(play)
  if (root) visit(root.id)
  return walk
}

/** Resolves the glues of a play once, for all its lines. */
export function resolvePlay(
  play: Play,
  settings: EngineSettings,
  caches: EvalCaches,
): PlayResolution {
  const key = contentHash({ play, settings })
  const cached = caches.resolutions.get(key)
  if (cached) return cached
  const analysis = analyseGlues(play)
  const setup = lineSetup(play)
  const context = createMotionContext(settings, caches)
  const prolongs = prolongedRuns(play, analysis)
  let launched: ReadonlySet<Id> = new Set(prolongs.values())
  const walkWith = (ending: ReadonlySet<Id>): Walk =>
    walkBranches(play, settings, analysis, setup, context, ending, prolongs)
  let walk = walkWith(launched)
  // A run none of whose next runs really starts at its end brakes normally, and never goes back to
  // speed: this is the only second pass (SPEC 5.2).
  if ([...launched].some((id) => !walk.prolongedBy.has(id))) {
    launched = new Set(walk.prolongedBy.keys())
    walk = walkWith(launched)
  }
  const resolution: PlayResolution = {
    analysis,
    setup,
    context,
    actions: walk.actions,
    sequences: walk.sequences,
    branchAt: walk.branchAt,
    statuses: walk.statuses,
    issues: walk.issues,
    launched,
    prolongs,
    prolongedBy: walk.prolongedBy,
  }
  caches.resolutions.set(key, resolution)
  return resolution
}

/** Point of an edge on a simulation, null for a sequence or a branch point. */
function edgePoint(edge: GlueEdge, simulation: LineSimulation, states: PlayResolution['actions']) {
  const action = states.get(edge.ownerId)?.action
  if (!action || edge.kind === 'branchAt') return null
  return actionEvent(simulation, action, edge.kind === 'start' ? 'start' : 'end')?.point ?? null
}

/** The glued edges of a line, once its compilation is known. */
export function compiledGlues(
  play: Play,
  settings: EngineSettings,
  line: readonly Id[],
  resolution: PlayResolution,
  simulation: LineSimulation,
): CompiledGlue[] {
  const targets: TargetContext = {
    play,
    settings,
    states: resolution.actions,
    sequences: resolution.sequences,
    branchAt: resolution.branchAt,
  }
  return resolution.analysis.order
    .filter((edge) => line.includes(edge.branchId))
    .map((edge) => {
      const target = readTarget(edge, targets, () => simulation)
      const status = resolution.statuses.get(edgeKey(edge)) ?? 'unreached'
      return {
        ownerId: edge.ownerId,
        kind: edge.kind,
        targetId: edge.glue.targetId,
        status,
        targetT: target ? target.t + (edge.glue.offset ?? 0) : null,
        from: edgePoint(edge, simulation, resolution.actions),
        to: target?.point ?? null,
      }
    })
}
