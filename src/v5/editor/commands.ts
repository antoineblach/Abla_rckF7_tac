// Editing commands: pure transformations of a play (SPEC 6, 5.8, D-139). Each command returns a new
// play (never mutates its input); an impossible command returns the play unchanged and the caller may
// tell the user why. New actions are laid at the cursor, in the branch of the line there (SPEC 6.3);
// the tools lay the glues of SPEC 6.2. No command creates a branch or a sequence before frise-2
// (D-142), nor cuts a run (D-144).
import {
  BREAKDOWN_DURATION_DEFAULT,
  CURSOR_ON_EDGE_TOLERANCE,
  DUPLICATE_OFFSET,
  TEAM_COLORS,
} from '../../config/defaults'
import type { IdFactory } from '../../model/ids'
import type { EngineSettings } from '../../model/settings'
import type { EvalCaches } from '../engine/caches'
import { resolvePlay, type PlayResolution } from '../engine/glue'
import { motionEnd } from '../engine/motion'
import { compileLine, positionAt, type CompiledLine } from '../engine/timeline'
import { defaultLineThrough, pathToBranch } from '../model/branches'
import {
  createsCycle,
  edgeKey,
  glueEdges,
  glueProblem,
  type GlueEdge,
  type GlueEdgeKind,
} from '../model/syncGraph'
import {
  isPlayer,
  isReceiverTarget,
  PACES,
  type Action,
  type BreakdownContest,
  type BreakdownKind,
  type DefenseMode,
  type EndGlue,
  type FieldView,
  type GlueKeep,
  type GlueRef,
  type Id,
  type KickKind,
  type KickTarget,
  type Play,
  type PlayCategory,
  type PlayerEntity,
  type RunAction,
  type SegmentSpeed,
  type SpeedValue,
  type Team,
  type Timed,
  type Vec2,
} from '../model/types'

export interface CommandContext {
  ids: IdFactory
  settings: EngineSettings
  caches: EvalCaches
}

/** Where a new action is laid: the displayed line and the instant of the cursor (SPEC 6.3). */
export interface Cursor {
  line: readonly Id[]
  t: number
}

const EPSILON = 1e-9

const clone = (play: Play): Play => structuredClone(play)

function mapActions(play: Play, fn: (action: Action) => Action | null): Play {
  return {
    ...play,
    actions: play.actions.flatMap((action) => {
      const result = fn(action)
      return result ? [result] : []
    }),
  }
}

// ---------------------------------------------------------------------------
// Players

/** Smallest positive number not used in the team (SPEC 6.2 « numéro suivant libre »). */
export function nextFreeNumber(play: Play, team: Team): number {
  const used = new Set(
    play.entities
      .filter(isPlayer)
      .filter((p) => p.team === team)
      .map((p) => p.number),
  )
  let n = 1
  while (used.has(n)) n++
  return n
}

/** Places a player: the click sets her starting placement, whatever the cursor (D-009). */
export function addPlayer(
  play: Play,
  team: Team,
  pos: Vec2,
  ctx: Pick<CommandContext, 'ids'>,
): { play: Play; id: Id } {
  const id = ctx.ids()
  const entity: PlayerEntity = {
    id,
    kind: 'player',
    team,
    number: nextFreeNumber(play, team),
    color: TEAM_COLORS[team],
    defenseMode: 'manual',
  }
  return {
    id,
    play: {
      ...play,
      entities: [...play.entities, entity],
      setup: {
        ...play.setup,
        positions: { ...play.setup.positions, [id]: { x: pos.x, y: pos.y } },
      },
    },
  }
}

/** Moves starting placements (at t = 0 only, D-009, SPEC 6.3). */
export function moveSetupPositions(play: Play, ids: readonly Id[], delta: Vec2): Play {
  const positions = { ...play.setup.positions }
  for (const id of ids) {
    const pos = positions[id]
    if (pos) positions[id] = { x: pos.x + delta.x, y: pos.y + delta.y }
  }
  return { ...play, setup: { ...play.setup, positions } }
}

export function setSetupPosition(play: Play, id: Id, pos: Vec2): Play {
  if (!(id in play.setup.positions)) return play
  return {
    ...play,
    setup: { ...play.setup, positions: { ...play.setup.positions, [id]: { x: pos.x, y: pos.y } } },
  }
}

function involves(action: Action, gone: ReadonlySet<Id>): boolean {
  switch (action.type) {
    case 'run':
      return gone.has(action.entityId)
    case 'pass':
      return gone.has(action.fromId) || gone.has(action.toId)
    case 'kick':
      return (
        gone.has(action.kickerId) ||
        (isReceiverTarget(action.target) && gone.has(action.target.receiverId))
      )
    case 'breakdown':
      return [action.tackledId, action.supportId, action.relayerId].some((id) => gone.has(id))
    case 'groupRun':
      return false
  }
}

/**
 * Deletes players with their runs and the passes, kicks and breakdowns involving them, in every
 * branch (D-014, D-139). The edges glued to these actions are frozen (SPEC 5.8).
 */
export function deletePlayers(
  play: Play,
  ids: readonly Id[],
  ctx: Pick<CommandContext, 'settings' | 'caches'>,
): { play: Play; frozen: number } {
  const gone = new Set(ids)
  if (gone.size === 0) return { play, frozen: 0 }
  const actions = play.actions.filter((action) => involves(action, gone)).map((a) => a.id)
  const removed = deleteActions(play, actions, ctx)
  const positions = Object.fromEntries(
    Object.entries(removed.play.setup.positions).filter(([id]) => !gone.has(id)),
  )
  const { ballCarrierId } = removed.play.setup
  return {
    frozen: removed.frozen,
    play: {
      ...removed.play,
      entities: removed.play.entities.filter((e) => !gone.has(e.id)),
      setup: {
        ...removed.play.setup,
        positions,
        ballCarrierId: ballCarrierId !== null && gone.has(ballCarrierId) ? null : ballCarrierId,
      },
    },
  }
}

/** Ctrl+D: copies of the selected players, next free numbers, lateral offset, no actions (D-015). */
export function duplicatePlayers(
  play: Play,
  ids: readonly Id[],
  ctx: Pick<CommandContext, 'ids'>,
): { play: Play; ids: Id[] } {
  let result = play
  const created: Id[] = []
  for (const id of ids) {
    const source = result.entities.find((e) => e.id === id)
    const pos = result.setup.positions[id]
    if (!isPlayer(source) || !pos) continue
    const added = addPlayer(result, source.team, { x: pos.x, y: pos.y + DUPLICATE_OFFSET }, ctx)
    result = updatePlayer(added.play, added.id, {
      color: source.color,
      defenseMode: source.defenseMode,
    })
    created.push(added.id)
  }
  return { play: result, ids: created }
}

export interface PlayerPatch {
  number?: number
  color?: string
  defenseMode?: DefenseMode
}

export function updatePlayer(play: Play, id: Id, patch: PlayerPatch): Play {
  return {
    ...play,
    entities: play.entities.map((e) => (e.id === id && isPlayer(e) ? { ...e, ...patch } : e)),
  }
}

// ---------------------------------------------------------------------------
// Ball (D-007)

export function addBall(play: Play, ctx: Pick<CommandContext, 'ids'>): Play {
  if (play.entities.some((e) => e.kind === 'ball')) return play
  return { ...play, entities: [...play.entities, { id: ctx.ids(), kind: 'ball' }] }
}

export function removeBall(play: Play): Play {
  return {
    ...play,
    entities: play.entities.filter((e) => e.kind !== 'ball'),
    setup: { ...play.setup, ballCarrierId: null, ballPosition: null },
  }
}

/** « Porteuse au départ »: gives the ball to a player at the start (adds the ball if needed). */
export function setBallCarrier(play: Play, id: Id | null, ctx: Pick<CommandContext, 'ids'>): Play {
  if (id === null) return { ...play, setup: { ...play.setup, ballCarrierId: null } }
  if (!isPlayer(play.entities.find((e) => e.id === id))) return play
  const withBall = addBall(play, ctx)
  return { ...withBall, setup: { ...withBall.setup, ballCarrierId: id, ballPosition: null } }
}

/** « Poser le ballon au sol »: ball on the ground at the start (lot 3, D-083). */
export function setBallOnGround(play: Play, pos: Vec2, ctx: Pick<CommandContext, 'ids'>): Play {
  const withBall = addBall(play, ctx)
  return {
    ...withBall,
    setup: { ...withBall.setup, ballCarrierId: null, ballPosition: { x: pos.x, y: pos.y } },
  }
}

/** Moves the ball on the ground at the start (at t = 0 only, like the placements, D-009). */
export function moveBallPosition(play: Play, pos: Vec2): Play {
  if (!play.setup.ballPosition || play.setup.ballCarrierId !== null) return play
  return { ...play, setup: { ...play.setup, ballPosition: { x: pos.x, y: pos.y } } }
}

// ---------------------------------------------------------------------------
// Laying an action at the cursor (SPEC 6.2, 6.3)

function compiledAt(play: Play, cursor: Cursor, ctx: CommandContext): CompiledLine {
  return compileLine(play, cursor.line, ctx.settings, ctx.caches)
}

/**
 * Branch of a new action: the one of the line at t; at the exact instant of a branch point, the
 * displayed option (SPEC 6.3). Undefined when the line does not hold.
 */
export function branchAtCursor(
  play: Play,
  cursor: Cursor,
  ctx: Pick<CommandContext, 'settings' | 'caches'>,
): Id | undefined {
  const { branches } = compileLine(play, cursor.line, ctx.settings, ctx.caches)
  return branches.filter((branch) => branch.start <= cursor.t + EPSILON).at(-1)?.id
}

/** Runs of a player in a line, drawn by the user. */
const runsOf = (compiled: CompiledLine, entityId: Id) =>
  compiled.motions.filter((m) => m.source === 'run' && m.entityId === entityId)

/** What a player can do with the ball from the cursor on. */
type BallOutlook =
  /** She has it at the cursor. */
  | { kind: 'holds' }
  /** She first gets it there by a pass, a kick or a breakdown exit (SPEC 5.4). */
  | { kind: 'reception'; actionId: Id; t: number }
  /** She first gets it there from the ground: a pickup is not a reception (D-119). */
  | { kind: 'pickup'; t: number }
  /** Nothing is coming to her. */
  | { kind: 'none' }

/**
 * Ball of a player from t on, in the compiled line. A reception out of `branchId` and its ancestors
 * could not be a target (SPEC 4.3): it counts for nothing, nor what follows it.
 */
function ballOutlook(
  play: Play,
  compiled: CompiledLine,
  playerId: Id,
  branchId: Id,
  t: number,
): BallOutlook {
  const { ball } = compiled
  const current = ball.filter((segment) => segment.start <= t + EPSILON).at(-1)
  if (current?.kind === 'carried' && current.carrierId === playerId) return { kind: 'holds' }
  const next = ball.findIndex(
    (s) => s.start > t + EPSILON && s.kind === 'carried' && s.carrierId === playerId,
  )
  const segment = ball[next]
  if (!segment) return { kind: 'none' }
  const before = ball[next - 1]
  if (before?.kind !== 'flight' && before?.kind !== 'breakdown') {
    return { kind: 'pickup', t: segment.start }
  }
  return reachable(play, before.actionId, branchId)
    ? { kind: 'reception', actionId: before.actionId, t: segment.start }
    : { kind: 'none' }
}

function reachable(play: Play, actionId: Id, branchId: Id): boolean {
  const action = play.actions.find((candidate) => candidate.id === actionId)
  return action !== undefined && pathToBranch(play, branchId).includes(action.branchId)
}

/**
 * Next reception traced for a player that the engine ignores for now, her passer having no ball yet:
 * it is what she waits for (SPEC 6.2).
 */
function ignoredReception(
  play: Play,
  compiled: CompiledLine,
  playerId: Id,
  branchId: Id,
  t: number,
): Id | null {
  const receptions = [
    ...compiled.passes.filter((pass) => pass.toId === playerId),
    ...compiled.kicks.filter((kick) => kick.receiverId === playerId),
  ]
    .filter((thrown) => !thrown.applied && thrown.arrivalT >= t - EPSILON)
    .filter((thrown) => reachable(play, thrown.actionId, branchId))
    .sort((a, b) => a.arrivalT - b.arrivalT)
  return receptions[0]?.actionId ?? null
}

/**
 * Release laid by the pass and kick tools (SPEC 6.2): at the cursor when she has the ball; else glued
 * to her next reception, gap 0; at the instant of a pickup; at the cursor, ignored and signalled,
 * when nothing is traced.
 */
function toolRelease(
  play: Play,
  compiled: CompiledLine,
  cursor: Cursor,
  playerId: Id,
  branchId: Id,
): Pick<Timed, 'start' | 'startGlue'> {
  const outlook = ballOutlook(play, compiled, playerId, branchId, cursor.t)
  switch (outlook.kind) {
    case 'holds':
      return { start: cursor.t }
    case 'pickup':
      return { start: outlook.t }
    case 'reception':
      return { start: outlook.t, startGlue: { targetId: outlook.actionId, event: 'end' } }
    case 'none': {
      const waited = ignoredReception(play, compiled, playerId, branchId, cursor.t)
      return waited === null
        ? { start: cursor.t }
        : { start: cursor.t, startGlue: { targetId: waited, event: 'end' } }
    }
  }
}

/** Release of a player that waits for a reception: ignored for want of a ball, not glued. */
interface WaitingRelease {
  id: Id
  plannedT: number
}

function waitingReleases(play: Play, compiled: CompiledLine, playerId: Id): WaitingRelease[] {
  const noBall = new Set(
    compiled.issues.flatMap((issue) =>
      (issue.code === 'passerWithoutBall' || issue.code === 'kickerWithoutBall') &&
      issue.target.kind === 'action'
        ? [issue.target.id]
        : [],
    ),
  )
  const notGlued = (id: Id): boolean =>
    noBall.has(id) && !play.actions.find((action) => action.id === id)?.startGlue
  return [
    ...compiled.passes
      .filter((pass) => pass.fromId === playerId && notGlued(pass.actionId))
      .map((pass) => ({ id: pass.actionId, plannedT: pass.plannedT })),
    ...compiled.kicks
      .filter((kick) => kick.kickerId === playerId && notGlued(kick.actionId))
      .map((kick) => ({ id: kick.actionId, plannedT: kick.plannedT })),
  ].sort((a, b) => a.plannedT - b.plannedT)
}

/**
 * A reception just traced: the first release of her receiver that waited for a ball and comes before
 * its arrival is glued to it (SPEC 6.2).
 */
function glueWaitingRelease(
  play: Play,
  waiting: readonly WaitingRelease[],
  reception: Id,
  cursor: Cursor,
  ctx: CommandContext,
): Play {
  const compiled = compiledAt(play, cursor, ctx)
  const thrown = [...compiled.passes, ...compiled.kicks].find((t) => t.actionId === reception)
  if (!thrown) return play
  const first = waiting.find((release) => release.plannedT <= thrown.arrivalT + EPSILON)
  if (!first) return play
  const glue: GlueRef = { targetId: reception, event: 'end' }
  return setGlue(play, { kind: 'start', ownerId: first.id, glue }).play
}

// ---------------------------------------------------------------------------
// Runs and passes

/**
 * First point of a run laid at the cursor: the position of the player at t, or at the end of the run
 * she is on: the new run waits for it (SPEC 4.3, D-144).
 */
export function runAnchor(
  play: Play,
  cursor: Cursor,
  entityId: Id,
  ctx: Pick<CommandContext, 'settings' | 'caches'>,
): Vec2 | undefined {
  const compiled = compileLine(play, cursor.line, ctx.settings, ctx.caches)
  const running = runsOf(compiled, entityId).find(
    (m) => m.start <= cursor.t && cursor.t < motionEnd(m),
  )
  return positionAt(compiled, entityId, running ? motionEnd(running) : cursor.t)
}

/**
 * Adds a run at the cursor (SPEC 6.2): glued to the previous run of the player when the cursor is on
 * its end. During a run of hers, the fallback of SPEC 4.3 delays it, with its alert (D-144).
 */
export function addRun(
  play: Play,
  cursor: Cursor,
  entityId: Id,
  waypoints: readonly Vec2[],
  ctx: CommandContext,
): { play: Play; actionId: Id | null } {
  const branchId = branchAtCursor(play, cursor, ctx)
  if (
    branchId === undefined ||
    waypoints.length === 0 ||
    !isPlayer(play.entities.find((e) => e.id === entityId))
  ) {
    return { play, actionId: null }
  }
  const actionId = ctx.ids()
  const previous = runsOf(compiledAt(play, cursor, ctx), entityId).find(
    (m) => Math.abs(motionEnd(m) - cursor.t) <= CURSOR_ON_EDGE_TOLERANCE,
  )
  const glue: GlueRef | null = previous ? { targetId: previous.actionId, event: 'end' } : null
  const usable = glue !== null && glueProblem(play, actionId, branchId, glue) === null
  const run: RunAction = {
    id: actionId,
    type: 'run',
    branchId,
    start: cursor.t,
    entityId,
    waypoints: waypoints.map((p) => ({ x: p.x, y: p.y })),
    pace: 'jog',
    ...(usable ? { startGlue: glue } : {}),
  }
  return { actionId, play: { ...play, actions: [...play.actions, run] } }
}

/** Drags a waypoint; its segment speed is kept (D-114). */
export function moveWaypoint(play: Play, actionId: Id, index: number, pos: Vec2): Play {
  return mapActions(play, (action) => {
    if (
      action.id !== actionId ||
      action.type !== 'run' ||
      index < 0 ||
      index >= action.waypoints.length
    )
      return action
    const waypoints = action.waypoints.map((p, i) =>
      i === index ? { ...p, x: pos.x, y: pos.y } : p,
    )
    return { ...action, waypoints }
  })
}

function findAction(play: Play, id: Id): Action | undefined {
  return play.actions.find((action) => action.id === id)
}

function findRun(play: Play, id: Id): RunAction | undefined {
  const action = findAction(play, id)
  return action?.type === 'run' ? action : undefined
}

/** The point indices aimed at a run, after the removal of its point `index`. */
function shiftPointTargets(play: Play, runId: Id, index: number): Play {
  const shift = <G extends GlueRef>(glue: G): G =>
    glue.targetId !== runId || typeof glue.event === 'string' || glue.event.point <= index
      ? glue
      : { ...glue, event: { point: glue.event.point - 1 } }
  const shifted = <T extends Timed>(block: T): T => {
    const next = { ...block }
    if (next.startGlue) next.startGlue = shift(next.startGlue)
    if (next.endGlue) next.endGlue = shift(next.endGlue)
    return next
  }
  return {
    ...play,
    branches: play.branches.map((branch) =>
      branch.branchAtGlue ? { ...branch, branchAtGlue: shift(branch.branchAtGlue) } : branch,
    ),
    actions: play.actions.map(shifted),
    sequences: play.sequences.map(shifted),
  }
}

/**
 * Right click on a point: removes it; removing the last point removes the run (D-015). The edges
 * glued to this point, or to the run it removes, are frozen (SPEC 5.8), `frozen` counts them for the
 * message; the indices of the later points they aim at are shifted.
 */
export function deleteWaypoint(
  play: Play,
  actionId: Id,
  index: number,
  ctx: Pick<CommandContext, 'settings' | 'caches'>,
): { play: Play; frozen: number } {
  const run = findRun(play, actionId)
  if (!run || index < 0 || index >= run.waypoints.length) return { play, frozen: 0 }
  if (run.waypoints.length === 1) return deleteActions(play, [actionId], ctx)
  const edges = glueEdges(play).filter(({ glue }) => {
    const { event } = glue
    return glue.targetId === actionId && typeof event !== 'string' && event.point === index
  })
  const frozen = shiftPointTargets(freezeEdges(play, edges, ctx), actionId, index)
  return {
    frozen: edges.length,
    play: mapActions(frozen, (action) =>
      action.id === actionId && action.type === 'run'
        ? { ...action, waypoints: action.waypoints.filter((_, i) => i !== index) }
        : action,
    ),
  }
}

/** Speed of segment `index` of a run (the segment arriving at point `index`); null: run pace. */
export function setSegmentSpeed(
  play: Play,
  actionId: Id,
  index: number,
  speed: SegmentSpeed | null,
): Play {
  if (typeof speed === 'number' && !(speed > 0 && Number.isFinite(speed))) return play
  // Nothing to change: the same play, so that no empty undo step is recorded.
  const point = findRun(play, actionId)?.waypoints[index]
  if (!point || (speed === null ? point.speed === undefined : point.speed === speed)) return play
  return mapActions(play, (action) => {
    if (action.id !== actionId || action.type !== 'run') return action
    const waypoints = action.waypoints.map((p, i) => {
      if (i !== index) return p
      const next = { ...p }
      if (speed === null) delete next.speed
      else next.speed = speed
      return next
    })
    return { ...action, waypoints }
  })
}

/** Adds a pass; its release follows the ball of the passer (SPEC 6.2). */
export function addPass(
  play: Play,
  cursor: Cursor,
  fromId: Id,
  toId: Id,
  ctx: CommandContext,
): { play: Play; actionId: Id | null } {
  const branchId = branchAtCursor(play, cursor, ctx)
  const from = play.entities.find((e) => e.id === fromId)
  const to = play.entities.find((e) => e.id === toId)
  if (branchId === undefined || fromId === toId || !isPlayer(from) || !isPlayer(to)) {
    return { play, actionId: null }
  }
  const compiled = compiledAt(play, cursor, ctx)
  const waiting = waitingReleases(play, compiled, toId)
  const release = toolRelease(play, compiled, cursor, fromId, branchId)
  const actionId = ctx.ids()
  const added: Play = {
    ...play,
    actions: [...play.actions, { id: actionId, type: 'pass', branchId, fromId, toId, ...release }],
  }
  return { actionId, play: glueWaitingRelease(added, waiting, actionId, cursor, ctx) }
}

export interface RunPatch {
  /** A named pace, or a speed in m/s > 0 (D-133). */
  pace?: SpeedValue
  /** null clears the imposed duration. */
  durationOverride?: number | null
}

export interface PassPatch {
  /** null returns to the speed of the settings. */
  ballSpeed?: number | null
}

function isSpeedValue(value: SpeedValue): boolean {
  return typeof value === 'number' ? value > 0 && Number.isFinite(value) : PACES.includes(value)
}

/** The duration of a block adapts to its glued right edge (SPEC 5.8). */
function durationAdapts(block: Timed): boolean {
  return block.endGlue !== undefined && (block.endGlue.keep === 'start' || !!block.startGlue)
}

/**
 * Pace and imposed duration: the last gesture wins (SPEC 5.3). Choosing a pace removes the imposed
 * duration; a pace or an imposed duration removes a right edge whose duration adapts. An invalid
 * value, or nothing to change: the same play, so that no empty undo step is recorded.
 */
export function updateRun(play: Play, actionId: Id, patch: RunPatch): Play {
  const run = findRun(play, actionId)
  if (!run) return play
  const next = { ...run }
  const { pace, durationOverride } = patch
  if (pace !== undefined && isSpeedValue(pace)) {
    next.pace = pace
    delete next.durationOverride
    if (durationAdapts(next)) delete next.endGlue
  }
  if (durationOverride === null) delete next.durationOverride
  else if (durationOverride !== undefined && durationOverride > 0) {
    next.durationOverride = durationOverride
    if (durationAdapts(next)) delete next.endGlue
  }
  const same =
    next.pace === run.pace &&
    next.durationOverride === run.durationOverride &&
    next.endGlue === run.endGlue
  return same ? play : mapActions(play, (action) => (action.id === actionId ? next : action))
}

export function updatePass(play: Play, actionId: Id, patch: PassPatch): Play {
  return mapActions(play, (action) => {
    if (action.id !== actionId || action.type !== 'pass') return action
    const next = { ...action }
    if (patch.ballSpeed === null) delete next.ballSpeed
    else if (patch.ballSpeed !== undefined && patch.ballSpeed > 0) next.ballSpeed = patch.ballSpeed
    return next
  })
}

/**
 * « Départ » of an action, >= 0. Computed, thus unchanged, when a glue sets it: left edge, or a right
 * edge that makes it slide (SPEC 6.5).
 */
export function setStart(play: Play, actionId: Id, start: number): Play {
  const action = findAction(play, actionId)
  if (!action || !Number.isFinite(start) || action.startGlue || action.endGlue?.keep === 'duration')
    return play
  const value = Math.max(0, start)
  if (value === action.start) return play
  return mapActions(play, (a) => (a.id === actionId ? { ...a, start: value } : a))
}

export function deleteActions(
  play: Play,
  ids: readonly Id[],
  ctx: Pick<CommandContext, 'settings' | 'caches'>,
): { play: Play; frozen: number } {
  const gone = new Set(ids)
  if (!play.actions.some((action) => gone.has(action.id))) return { play, frozen: 0 }
  const edges = glueEdges(play).filter(
    (edge) => gone.has(edge.glue.targetId) && !gone.has(edge.ownerId),
  )
  return {
    frozen: edges.length,
    play: mapActions(freezeEdges(play, edges, ctx), (action) =>
      gone.has(action.id) ? null : action,
    ),
  }
}

// ---------------------------------------------------------------------------
// Glues (SPEC 5.8, D-143)

/** Why a glue was refused: its own block, a target out of the line, a cycle, an unusable target. */
export type GlueRefusal = 'self' | 'line' | 'cycle' | 'invalid'

export type GlueRequest =
  { kind: 'start'; ownerId: Id; glue: GlueRef } | { kind: 'end'; ownerId: Id; glue: EndGlue }

/**
 * Glues an edge of an action. Refused when it targets its own block, leaves the line, cannot apply or
 * closes a cycle. A duration that now adapts removes the imposed duration (SPEC 5.3).
 */
export function setGlue(
  play: Play,
  request: GlueRequest,
): { play: Play; refused: GlueRefusal | null } {
  const owner = findAction(play, request.ownerId)
  if (!owner) return { play, refused: 'invalid' }
  const problem = glueProblem(play, owner.id, owner.branchId, request.glue)
  if (problem === 'self' || problem === 'line') return { play, refused: problem }
  if (problem) return { play, refused: 'invalid' }
  const keep = request.kind === 'end' ? request.glue.keep : null
  const edge: GlueEdge = { ...request, branchId: owner.branchId, keep }
  if (createsCycle(play, edge)) return { play, refused: 'cycle' }
  return {
    refused: null,
    play: mapActions(play, (action) => {
      if (action.id !== owner.id) return action
      const next =
        request.kind === 'start'
          ? { ...action, startGlue: request.glue }
          : { ...action, endGlue: request.glue }
      if (next.type === 'run' && durationAdapts(next)) delete next.durationOverride
      return next
    }),
  }
}

/** Duration of a run once its glues are resolved. */
function resolvedDuration(
  play: Play,
  run: RunAction,
  ctx: Pick<CommandContext, 'settings' | 'caches'>,
): number | undefined {
  const line = defaultLineThrough(play, run.branchId)
  const { motions } = compileLine(play, line, ctx.settings, ctx.caches)
  return motions.find((m) => m.source === 'run' && m.actionId === run.id)?.duration
}

/** The edge has moved its block: its status says that the values it computed apply. */
function moved(resolution: PlayResolution, edge: GlueEdge): boolean {
  const status = resolution.statuses.get(edgeKey(edge))
  return status === 'ok' || status === 'late'
}

/** An action with this edge frozen at the values `play` resolves. */
function frozenAction(
  play: Play,
  action: Action,
  edge: GlueEdge,
  resolution: PlayResolution,
  ctx: Pick<CommandContext, 'settings' | 'caches'>,
): Action {
  const state = resolution.actions.get(action.id)
  const next = { ...action }
  const applies = state !== undefined && moved(resolution, edge)
  if (edge.kind === 'start') {
    delete next.startGlue
    if (applies) next.start = state.start
    // Both edges glued, the duration was adapting: it goes on, or the block would slide.
    if (next.endGlue) next.endGlue = { ...next.endGlue, keep: 'start' }
    return next
  }
  delete next.endGlue
  if (!state) return next
  if (!applies) {
    if (next.type === 'run' && state.ignoreImposed) delete next.durationOverride
    return next
  }
  next.start = state.start
  const adapted = state.action
  if (next.type === 'run') {
    const duration = state.levers ? resolvedDuration(play, next, ctx) : undefined
    if (duration !== undefined) next.durationOverride = duration
  } else if (next.type === 'pass' && adapted.type === 'pass') {
    if (adapted.ballSpeed !== undefined) next.ballSpeed = adapted.ballSpeed
  } else if (next.type === 'kick' && adapted.type === 'kick') {
    if (adapted.flightTime !== undefined) next.flightTime = adapted.flightTime
  } else if (next.type === 'breakdown' && adapted.type === 'breakdown') {
    next.duration = adapted.duration
  }
  return next
}

/**
 * Freezes edges at their computed values: the blocks do not move (SPEC 5.8). Whatever the edge holds
 * on: action, sequence or branch point. An edge that does not apply keeps its stored values.
 */
function freezeEdges(
  play: Play,
  edges: readonly GlueEdge[],
  ctx: Pick<CommandContext, 'settings' | 'caches'>,
): Play {
  if (edges.length === 0) return play
  const resolution = resolvePlay(play, ctx.settings, ctx.caches)
  let result = play
  for (const edge of edges) {
    if (edge.kind === 'branchAt') {
      const instant = resolution.branchAt.get(edge.ownerId)
      result = {
        ...result,
        branches: result.branches.map((branch) => {
          if (branch.id !== edge.ownerId) return branch
          const next = { ...branch }
          delete next.branchAtGlue
          if (instant !== undefined) next.branchAt = instant
          return next
        }),
      }
      continue
    }
    const resolved = resolution.sequences.get(edge.ownerId)
    result = {
      ...result,
      actions: result.actions.map((action) =>
        action.id === edge.ownerId ? frozenAction(play, action, edge, resolution, ctx) : action,
      ),
      sequences: result.sequences.map((sequence) => {
        if (sequence.id !== edge.ownerId) return sequence
        const next = { ...sequence }
        if (edge.kind === 'start') {
          delete next.startGlue
          if (next.endGlue) next.endGlue = { ...next.endGlue, keep: 'start' }
        } else delete next.endGlue
        return resolved && moved(resolution, edge) ? { ...next, ...resolved } : next
      }),
    }
  }
  return result
}

/** « Décoller »: the edge is frozen at its computed value (SPEC 5.8). */
export function removeGlue(
  play: Play,
  ownerId: Id,
  kind: GlueEdgeKind,
  ctx: Pick<CommandContext, 'settings' | 'caches'>,
): Play {
  const edges = glueEdges(play).filter((edge) => edge.ownerId === ownerId && edge.kind === kind)
  return freezeEdges(play, edges, ctx)
}

/** « Le bloc glisse » or « Le bloc s'étire »; a duration that now adapts removes the imposed one. */
export function setKeep(play: Play, actionId: Id, keep: GlueKeep): Play {
  const action = findAction(play, actionId)
  if (!action?.endGlue || action.endGlue.keep === keep) return play
  const endGlue = { ...action.endGlue, keep }
  return mapActions(play, (a) => {
    if (a.id !== actionId) return a
    const next = { ...a, endGlue }
    if (next.type === 'run' && durationAdapts(next)) delete next.durationOverride
    return next
  })
}

/** Gap of a glued edge, >= 0; 0 is the default and is not stored (SPEC 5.8). */
export function setOffset(play: Play, actionId: Id, kind: 'start' | 'end', offset: number): Play {
  const action = findAction(play, actionId)
  const glue = kind === 'start' ? action?.startGlue : action?.endGlue
  if (!glue || !Number.isFinite(offset)) return play
  const value = Math.max(0, offset)
  if (value === (glue.offset ?? 0)) return play
  const set = <G extends GlueRef>(current: G): G => {
    const next = { ...current }
    if (value === 0) delete next.offset
    else next.offset = value
    return next
  }
  return mapActions(play, (a) => {
    if (a.id !== actionId) return a
    const next = { ...a }
    if (kind === 'start' && next.startGlue) next.startGlue = set(next.startGlue)
    if (kind === 'end' && next.endGlue) next.endGlue = set(next.endGlue)
    return next
  })
}

// ---------------------------------------------------------------------------
// Kicks (SPEC 10.4)

/**
 * Adds a kick to a receiver or to a point; its release is laid like a pass; a restart in a play of
 * category restart, a long kick otherwise (D-093 tools, SPEC 10.4, 6.2).
 */
export function addKick(
  play: Play,
  cursor: Cursor,
  kickerId: Id,
  target: KickTarget,
  ctx: CommandContext,
): { play: Play; actionId: Id | null } {
  const branchId = branchAtCursor(play, cursor, ctx)
  const kicker = play.entities.find((e) => e.id === kickerId)
  if (branchId === undefined || !isPlayer(kicker)) return { play, actionId: null }
  if (isReceiverTarget(target)) {
    const receiver = play.entities.find((e) => e.id === target.receiverId)
    if (!isPlayer(receiver) || receiver.id === kickerId) return { play, actionId: null }
  }
  const compiled = compiledAt(play, cursor, ctx)
  const waiting = isReceiverTarget(target) ? waitingReleases(play, compiled, target.receiverId) : []
  const release = toolRelease(play, compiled, cursor, kickerId, branchId)
  const actionId = ctx.ids()
  const kind: KickKind = play.category === 'restart' ? 'restart' : 'long'
  const copy: KickTarget = isReceiverTarget(target)
    ? { receiverId: target.receiverId }
    : { point: { x: target.point.x, y: target.point.y } }
  const added: Play = {
    ...play,
    actions: [
      ...play.actions,
      { id: actionId, type: 'kick', branchId, kickerId, kind, target: copy, ...release },
    ],
  }
  return { actionId, play: glueWaitingRelease(added, waiting, actionId, cursor, ctx) }
}

export interface KickPatch {
  kind?: KickKind
  /** null returns to the default flight time of the kind. */
  flightTime?: number | null
  target?: KickTarget
}

export function updateKick(play: Play, actionId: Id, patch: KickPatch): Play {
  return mapActions(play, (action) => {
    if (action.id !== actionId || action.type !== 'kick') return action
    const next = { ...action }
    if (patch.kind !== undefined) next.kind = patch.kind
    if (patch.flightTime === null) delete next.flightTime
    else if (patch.flightTime !== undefined && patch.flightTime > 0)
      next.flightTime = patch.flightTime
    if (patch.target !== undefined) {
      const target = patch.target
      if (isReceiverTarget(target)) {
        if (target.receiverId !== action.kickerId) next.target = { receiverId: target.receiverId }
      } else {
        next.target = { point: { x: target.point.x, y: target.point.y } }
      }
    }
    return next
  })
}

/** Moves the target point of a kick to a point (drag in the editor). */
export function moveKickTarget(play: Play, actionId: Id, pos: Vec2): Play {
  return mapActions(play, (action) =>
    action.id === actionId && action.type === 'kick' && !isReceiverTarget(action.target)
      ? { ...action, target: { point: { x: pos.x, y: pos.y } } }
      : action,
  )
}

// ---------------------------------------------------------------------------
// Breakdowns (SPEC 10.3)

export type BreakdownProposal =
  | { ok: true; start: number; glue: GlueRef | null; supportId: Id; relayerId: Id }
  | { ok: false; reason: 'noBall' | 'teammates' }

/** Has the player the ball at t in the line? */
function holdsAt(compiled: CompiledLine, playerId: Id, t: number): boolean {
  const segment = compiled.ball.filter((s) => s.start <= t + EPSILON).at(-1)
  return segment?.kind === 'carried' && segment.carrierId === playerId
}

/**
 * Proposal when a breakdown is laid on a player (SPEC 6.2, D-081): formation glued to the end of her
 * run in progress at the cursor or starting there, or to her next reception if later; at the cursor
 * without either. Support = the closest teammate at that instant, relayer = the second closest.
 * Refused when she has no ball at the formation or fewer than two teammates.
 */
export function proposeBreakdown(
  play: Play,
  cursor: Cursor,
  tackledId: Id,
  ctx: CommandContext,
): BreakdownProposal {
  const tackled = play.entities.find((e) => e.id === tackledId)
  const branchId = branchAtCursor(play, cursor, ctx)
  if (!isPlayer(tackled) || branchId === undefined) return { ok: false, reason: 'noBall' }
  const compiled = compiledAt(play, cursor, ctx)
  const { t } = cursor
  const running = runsOf(compiled, tackledId)
    .filter((m) => m.start <= t + EPSILON && t <= motionEnd(m) + CURSOR_ON_EDGE_TOLERANCE)
    .at(-1)
  const reception = ballOutlook(play, compiled, tackledId, branchId, t)
  const runEnd = running ? motionEnd(running) : null
  let start = t
  let glue: GlueRef | null = null
  if (reception.kind === 'reception' && (runEnd === null || reception.t > runEnd)) {
    start = reception.t
    glue = { targetId: reception.actionId, event: 'end' }
  } else if (running && runEnd !== null) {
    start = runEnd
    glue = { targetId: running.actionId, event: 'end' }
  }
  if (!holdsAt(compiled, tackledId, start)) return { ok: false, reason: 'noBall' }
  const at = positionAt(compiled, tackledId, start)
  if (!at) return { ok: false, reason: 'noBall' }
  const mates = play.entities
    .filter((e): e is PlayerEntity => isPlayer(e) && e.team === tackled.team && e.id !== tackledId)
    .flatMap((e) => {
      const pos = positionAt(compiled, e.id, start)
      return pos ? [{ id: e.id, d: Math.hypot(pos.x - at.x, pos.y - at.y) }] : []
    })
    .sort((a, b) => a.d - b.d)
  const [support, relayer] = mates
  if (!support || !relayer) return { ok: false, reason: 'teammates' }
  return { ok: true, start, glue, supportId: support.id, relayerId: relayer.id }
}

/** Lays a ruck on a player with the proposed formation, support and relayer (SPEC 6.2, D-081). */
export function addBreakdown(
  play: Play,
  cursor: Cursor,
  tackledId: Id,
  ctx: CommandContext,
): { play: Play; actionId: Id | null; refused: 'noBall' | 'teammates' | null } {
  const proposal = proposeBreakdown(play, cursor, tackledId, ctx)
  const branchId = branchAtCursor(play, cursor, ctx)
  if (!proposal.ok) return { play, actionId: null, refused: proposal.reason }
  if (branchId === undefined) return { play, actionId: null, refused: 'noBall' }
  const actionId = ctx.ids()
  const { start, glue, supportId, relayerId } = proposal
  return {
    actionId,
    refused: null,
    play: {
      ...play,
      actions: [
        ...play.actions,
        {
          id: actionId,
          type: 'breakdown',
          branchId,
          start,
          ...(glue ? { startGlue: glue } : {}),
          kind: 'ruck',
          tackledId,
          supportId,
          relayerId,
          duration: BREAKDOWN_DURATION_DEFAULT,
        },
      ],
    },
  }
}

export interface BreakdownPatch {
  kind?: BreakdownKind
  supportId?: Id
  relayerId?: Id
  duration?: number
  /** null returns to the defence setting (« Par défaut », D-078). */
  contest?: BreakdownContest | null
}

export function updateBreakdown(play: Play, actionId: Id, patch: BreakdownPatch): Play {
  return mapActions(play, (action) => {
    if (action.id !== actionId || action.type !== 'breakdown') return action
    const next = { ...action }
    if (patch.kind !== undefined) next.kind = patch.kind
    if (patch.supportId !== undefined) next.supportId = patch.supportId
    if (patch.relayerId !== undefined) next.relayerId = patch.relayerId
    if (patch.duration !== undefined && patch.duration > 0) next.duration = patch.duration
    if (patch.contest === null) delete next.contest
    else if (patch.contest !== undefined) next.contest = patch.contest
    return next
  })
}

// ---------------------------------------------------------------------------
// Play (SPEC 6.5)

export interface PlayPatch {
  name?: string
  category?: PlayCategory
  notes?: string
  attackingTeam?: Team
}

export function updatePlayMeta(play: Play, patch: PlayPatch): Play {
  return { ...play, ...patch }
}

export function updateField(
  play: Play,
  patch: { length?: number; width?: number; inGoal?: number; view?: FieldView },
): Play {
  return { ...play, field: { ...play.field, ...patch } }
}

export { clone as clonePlay }
