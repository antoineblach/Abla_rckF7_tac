// Editing commands: pure transformations of a play (SPEC 6, DECISIONS Q7 to Q15).
// Each command returns a new play (never mutates its input); an impossible command returns
// the play unchanged and the caller may tell the user why.
import { BREAKDOWN_DURATION_DEFAULT, DUPLICATE_OFFSET, TEAM_COLORS } from '../config/defaults'
import type { EvalCaches } from '../engine/caches'
import { ballObtainedAt, compiledPhaseOf } from '../engine/evaluate'
import { motionEnd, positionInPhase, type CompiledPhase } from '../engine/timeline'
import type { IdFactory } from '../model/ids'
import { childrenOf, descendantsOf, findPhase } from '../model/phaseTree'
import type { EngineSettings } from '../model/settings'
import { createsCycle, syncProblem } from '../model/syncGraph'
import {
  isPlayer,
  isReceiverTarget,
  PACES,
  type Action,
  type BreakdownContest,
  type BreakdownKind,
  type DefenseMode,
  type FieldView,
  type Id,
  type KickKind,
  type KickTarget,
  type Pace,
  type Phase,
  type Play,
  type PlayCategory,
  type PlayerEntity,
  type ReleaseMode,
  type RunAction,
  type RunSync,
  type SegmentSpeed,
  type Team,
  type Vec2,
} from '../model/types'

export interface CommandContext {
  ids: IdFactory
  settings: EngineSettings
  caches: EvalCaches
}

const clone = (play: Play): Play => structuredClone(play)

function mapPhases(play: Play, fn: (phase: Phase) => Phase): Play {
  return { ...play, phases: play.phases.map(fn) }
}

function mapActions(play: Play, fn: (action: Action, phase: Phase) => Action | null): Play {
  return mapPhases(play, (phase) => ({
    ...phase,
    actions: phase.actions.flatMap((action) => {
      const result = fn(action, phase)
      return result ? [result] : []
    }),
  }))
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

/** Places a player: the click sets her starting placement, whatever the displayed phase (D-009). */
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

/** Moves starting placements (root phase only, D-009). */
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

/**
 * Deletes players with their runs and the passes, kicks and breakdowns involving them, in every
 * phase (D-014, lot 3).
 */
export function deletePlayers(play: Play, ids: readonly Id[]): Play {
  const gone = new Set(ids)
  if (gone.size === 0) return play
  const positions = Object.fromEntries(
    Object.entries(play.setup.positions).filter(([id]) => !gone.has(id)),
  )
  const cleaned = mapActions(play, (action) => {
    if (action.type === 'run' && gone.has(action.entityId)) return null
    if (action.type === 'pass' && (gone.has(action.fromId) || gone.has(action.toId))) return null
    if (
      action.type === 'kick' &&
      (gone.has(action.kickerId) ||
        (isReceiverTarget(action.target) && gone.has(action.target.receiverId)))
    )
      return null
    if (
      action.type === 'breakdown' &&
      [action.tackledId, action.supportId, action.relayerId].some((id) => gone.has(id))
    )
      return null
    return action
  })
  return {
    ...cleaned,
    entities: play.entities.filter((e) => !gone.has(e.id)),
    setup: {
      ...play.setup,
      positions,
      ballCarrierId:
        play.setup.ballCarrierId !== null && gone.has(play.setup.ballCarrierId)
          ? null
          : play.setup.ballCarrierId,
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

/** Moves the ball on the ground at the start (root phase only, like the placements, D-009). */
export function moveBallPosition(play: Play, pos: Vec2): Play {
  if (!play.setup.ballPosition || play.setup.ballCarrierId !== null) return play
  return { ...play, setup: { ...play.setup, ballPosition: { x: pos.x, y: pos.y } } }
}

// ---------------------------------------------------------------------------
// Runs and passes

/** Adds a run, or extends the existing run of the player in this phase (D-015). */
export function addRun(
  play: Play,
  phaseId: Id,
  entityId: Id,
  waypoints: readonly Vec2[],
  ctx: Pick<CommandContext, 'ids'>,
): { play: Play; actionId: Id | null } {
  const phase = findPhase(play, phaseId)
  if (!phase || waypoints.length === 0 || !isPlayer(play.entities.find((e) => e.id === entityId))) {
    return { play, actionId: null }
  }
  const points = waypoints.map((p) => ({ x: p.x, y: p.y }))
  const existing = phase.actions.find((a) => a.type === 'run' && a.entityId === entityId)
  if (existing) {
    return {
      actionId: existing.id,
      play: mapActions(play, (action) =>
        action.id === existing.id && action.type === 'run'
          ? { ...action, waypoints: [...action.waypoints, ...points] }
          : action,
      ),
    }
  }
  const actionId = ctx.ids()
  return {
    actionId,
    play: mapPhases(play, (p) =>
      p.id === phaseId
        ? {
            ...p,
            actions: [
              ...p.actions,
              { id: actionId, type: 'run', entityId, waypoints: points, pace: 'jog', delay: 0 },
            ],
          }
        : p,
    ),
  }
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

function withoutSync(run: RunAction): RunAction {
  const next = { ...run }
  delete next.sync
  return next
}

/** Phase holding an action, and the action. */
function locateAction(play: Play, actionId: Id): { phase: Phase; action: Action } | null {
  for (const phase of play.phases) {
    const action = phase.actions.find((a) => a.id === actionId)
    if (action) return { phase, action }
  }
  return null
}

function locateRun(play: Play, runId: Id): { phase: Phase; run: RunAction } | null {
  const found = locateAction(play, runId)
  return found?.action.type === 'run' ? { phase: found.phase, run: found.action } : null
}

/**
 * Right click on a point: removes it; removing the last point removes the run (D-015). A link
 * carried by the point (rendez-vous of this run, or target of another run) is removed, and the
 * point indices of the other links of the run are shifted (D-108); `removedLinks` counts the
 * removed links for the message.
 */
export function deleteWaypoint(
  play: Play,
  actionId: Id,
  index: number,
): { play: Play; removedLinks: number } {
  const found = locateRun(play, actionId)
  if (!found || index < 0 || index >= found.run.waypoints.length) return { play, removedLinks: 0 }
  let removedLinks = 0
  const shift = (run: RunAction): RunAction => {
    let next = run
    const at = next.sync?.at
    if (next.id === actionId && next.sync && at !== undefined) {
      if (at === index) {
        removedLinks++
        next = withoutSync(next)
      } else if (at > index) {
        next = { ...next, sync: { ...next.sync, at: at - 1 } }
      }
    }
    const target = next.sync?.target
    if (next.sync && target?.event === 'runPoint' && target.actionId === actionId) {
      if (target.index === index) {
        removedLinks++
        next = withoutSync(next)
      } else if (target.index > index) {
        next = { ...next, sync: { ...next.sync, target: { ...target, index: target.index - 1 } } }
      }
    }
    return next
  }
  const result = mapActions(play, (action, phase) => {
    if (phase.id !== found.phase.id || action.type !== 'run') return action
    if (action.id !== actionId) return shift(action)
    const waypoints = action.waypoints.filter((_, i) => i !== index)
    // The run disappears with its own link; links aimed at it stay (« cible supprimée »).
    return waypoints.length === 0 ? null : shift({ ...action, waypoints })
  })
  return { play: result, removedLinks }
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
  const point = locateRun(play, actionId)?.run.waypoints[index]
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

/**
 * Release laid by the pass and kick tools (D-110, D-119): on receipt with no control time when the
 * player does not carry the ball at the start of the phase, unless she picks it up from the ground
 * (a pickup is not a reception): then at the instant she obtains it, as before (D-015).
 */
function toolRelease(
  play: Play,
  phaseId: Id,
  playerId: Id,
  ctx: CommandContext,
): { delay: number; release?: ReleaseMode } {
  const obtained = ballObtainedAt(play, phaseId, playerId, ctx.settings, ctx.caches)
  const phase = compiledPhaseOf(play, phaseId, ctx.settings, ctx.caches)
  const fixed = { delay: Math.max(0, obtained ?? 0) }
  if (!phase) return fixed
  const start = phase.holderAtStart
  if (start.kind === 'carried' && start.carrierId === playerId) return fixed
  if (picksUpBall(phase, playerId)) return fixed
  return { delay: 0, release: 'onReceipt' }
}

/** True when the player first obtains the ball in the phase from the ground (D-083). */
function picksUpBall(phase: CompiledPhase, playerId: Id): boolean {
  const index = phase.ball.findIndex((s) => s.kind === 'carried' && s.carrierId === playerId)
  return index > 0 && phase.ball[index - 1]?.kind === 'loose'
}

/** Adds a pass; its release follows the ball of the passer in the phase (D-015, D-110). */
export function addPass(
  play: Play,
  phaseId: Id,
  fromId: Id,
  toId: Id,
  ctx: CommandContext,
): { play: Play; actionId: Id | null } {
  const phase = findPhase(play, phaseId)
  const from = play.entities.find((e) => e.id === fromId)
  const to = play.entities.find((e) => e.id === toId)
  if (!phase || fromId === toId || !isPlayer(from) || !isPlayer(to)) return { play, actionId: null }
  const release = toolRelease(play, phaseId, fromId, ctx)
  const actionId = ctx.ids()
  return {
    actionId,
    play: mapPhases(play, (p) =>
      p.id === phaseId
        ? {
            ...p,
            actions: [...p.actions, { id: actionId, type: 'pass', fromId, toId, ...release }],
          }
        : p,
    ),
  }
}

export interface RunPatch {
  pace?: Pace
  /** null clears the imposed duration; a duration removes a link with an adjusted speed (D-107). */
  durationOverride?: number | null
  delay?: number
  /** « Finit lancée » (D-106). */
  endsAtSpeed?: boolean
}

export interface PassPatch {
  delay?: number
  /** null returns to the speed of the settings. */
  ballSpeed?: number | null
  /** null: release at a fixed instant (D-110). */
  release?: ReleaseMode | null
}

export function updateRun(play: Play, actionId: Id, patch: RunPatch): Play {
  return mapActions(play, (action) => {
    if (action.id !== actionId || action.type !== 'run') return action
    let next = { ...action }
    if (patch.pace !== undefined && PACES.includes(patch.pace)) next.pace = patch.pace
    if (patch.delay !== undefined) next.delay = Math.max(0, patch.delay)
    if (patch.durationOverride === null) delete next.durationOverride
    else if (patch.durationOverride !== undefined && patch.durationOverride > 0) {
      next.durationOverride = patch.durationOverride
      if (next.sync?.adjust === 'speed') next = withoutSync(next)
    }
    if (patch.endsAtSpeed === true) next.endsAtSpeed = true
    else if (patch.endsAtSpeed === false) delete next.endsAtSpeed
    return next
  })
}

export function updatePass(play: Play, actionId: Id, patch: PassPatch): Play {
  return mapActions(play, (action) => {
    if (action.id !== actionId || action.type !== 'pass') return action
    const next = { ...action }
    if (patch.delay !== undefined) next.delay = Math.max(0, patch.delay)
    if (patch.ballSpeed === null) delete next.ballSpeed
    else if (patch.ballSpeed !== undefined && patch.ballSpeed > 0) next.ballSpeed = patch.ballSpeed
    if (patch.release === null) delete next.release
    else if (patch.release !== undefined) next.release = patch.release
    return next
  })
}

// ---------------------------------------------------------------------------
// Synchronisation links (SPEC 5.8, D-108, D-109)

/** Why a link was refused: the run itself, a loop of links, or a target that cannot apply. */
export type SyncRefusal = 'self' | 'cycle' | 'invalid'

/**
 * Gives a link to a run (« Caler sur… »). Refused when it targets the run itself, when it closes
 * a loop of links, or when it cannot apply (target missing, incompatible, point out of range). A
 * link with an adjusted speed removes the imposed duration (D-107).
 */
export function setRunSync(
  play: Play,
  runId: Id,
  sync: RunSync,
): { play: Play; refused: SyncRefusal | null } {
  const found = locateRun(play, runId)
  if (!found) return { play, refused: 'invalid' }
  const problem = syncProblem(found.phase, found.run, sync)
  if (problem === 'self') return { play, refused: 'self' }
  if (problem) return { play, refused: 'invalid' }
  if (createsCycle(found.phase, runId, sync)) return { play, refused: 'cycle' }
  const copy: RunSync = structuredClone(sync)
  return {
    refused: null,
    play: mapActions(play, (action) => {
      if (action.id !== runId || action.type !== 'run') return action
      const next = { ...action, sync: copy }
      if (copy.adjust === 'speed') delete next.durationOverride
      return next
    }),
  }
}

export interface RunSyncPatch {
  /** Rendez-vous point; null: the end of the run. */
  at?: number | null
  adjust?: RunSync['adjust']
}

/** « Point de rendez-vous » and « Réglage » of a link; an adjusted speed removes the imposed duration. */
export function updateRunSync(play: Play, runId: Id, patch: RunSyncPatch): Play {
  return mapActions(play, (action) => {
    if (action.id !== runId || action.type !== 'run' || !action.sync) return action
    const sync = { ...action.sync }
    if (patch.at === null) delete sync.at
    else if (patch.at !== undefined) {
      if (patch.at < 0 || patch.at >= action.waypoints.length) return action
      sync.at = patch.at
    }
    if (patch.adjust !== undefined) sync.adjust = patch.adjust
    const next = { ...action, sync }
    if (sync.adjust === 'speed') delete next.durationOverride
    return next
  })
}

/**
 * « Retirer le lien »: a « Départ différé » link that applies leaves its computed delay as the
 * stored delay; otherwise the stored delay and speeds are kept (D-108).
 */
export function removeRunSync(play: Play, runId: Id, ctx: CommandContext): Play {
  const found = locateRun(play, runId)
  if (!found?.run.sync) return play
  const compiled = compiledPhaseOf(play, found.phase.id, ctx.settings, ctx.caches)
  const result = compiled?.motions.find((m) => m.actionId === runId)?.sync
  const frozen =
    found.run.sync.adjust === 'delay' && result && result.status !== 'unreached'
      ? Math.max(0, result.delay)
      : null
  return mapActions(play, (action) => {
    if (action.id !== runId || action.type !== 'run') return action
    const next = withoutSync(action)
    if (frozen !== null) next.delay = frozen
    return next
  })
}

/** First run of a player in a phase: the one the engine applies (D-013). */
function firstRunOf(phase: Phase, entityId: Id): RunAction | undefined {
  for (const action of phase.actions) {
    if (action.type === 'run' && action.entityId === entityId) return action
  }
  return undefined
}

/**
 * « Finit lancée » laid by the run tool (D-106): when every option of the phase now prolongs the
 * run of the player in the previous phase (her first run there, delay 0), that run ends at
 * speed. Never removes the flag.
 */
export function markProlongedRun(play: Play, phaseId: Id, entityId: Id): Play {
  const phase = findPhase(play, phaseId)
  if (!phase?.parentId) return play
  const parent = findPhase(play, phase.parentId)
  const parentRun = parent ? firstRunOf(parent, entityId) : undefined
  if (!parent || !parentRun || parentRun.endsAtSpeed) return play
  const options = childrenOf(play, parent.id)
  if (!options.every((option) => firstRunOf(option, entityId)?.delay === 0)) return play
  return updateRun(play, parentRun.id, { endsAtSpeed: true })
}

export function deleteActions(play: Play, ids: readonly Id[]): Play {
  const gone = new Set(ids)
  return mapActions(play, (action) => (gone.has(action.id) ? null : action))
}

// ---------------------------------------------------------------------------
// Kicks (SPEC 10.4)

function appendAction(play: Play, phaseId: Id, action: Action): Play {
  return mapPhases(play, (p) => (p.id === phaseId ? { ...p, actions: [...p.actions, action] } : p))
}

/**
 * Adds a kick to a receiver or to a point; its release follows the ball of the kicker in the
 * phase (D-015, D-110); a restart in a play of category restart, a long kick otherwise (D-093
 * tools, SPEC 10.4).
 */
export function addKick(
  play: Play,
  phaseId: Id,
  kickerId: Id,
  target: KickTarget,
  ctx: CommandContext,
): { play: Play; actionId: Id | null } {
  const phase = findPhase(play, phaseId)
  const kicker = play.entities.find((e) => e.id === kickerId)
  if (!phase || !isPlayer(kicker)) return { play, actionId: null }
  if (isReceiverTarget(target)) {
    const receiver = play.entities.find((e) => e.id === target.receiverId)
    if (!isPlayer(receiver) || receiver.id === kickerId) return { play, actionId: null }
  }
  const release = toolRelease(play, phaseId, kickerId, ctx)
  const actionId = ctx.ids()
  const kind: KickKind = play.category === 'restart' ? 'restart' : 'long'
  const copy: KickTarget = isReceiverTarget(target)
    ? { receiverId: target.receiverId }
    : { point: { x: target.point.x, y: target.point.y } }
  return {
    actionId,
    play: appendAction(play, phaseId, {
      id: actionId,
      type: 'kick',
      kickerId,
      kind,
      target: copy,
      ...release,
    }),
  }
}

export interface KickPatch {
  kind?: KickKind
  delay?: number
  /** null returns to the default flight time of the kind. */
  flightTime?: number | null
  target?: KickTarget
  /** null: release at a fixed instant (D-110). */
  release?: ReleaseMode | null
}

export function updateKick(play: Play, actionId: Id, patch: KickPatch): Play {
  return mapActions(play, (action) => {
    if (action.id !== actionId || action.type !== 'kick') return action
    const next = { ...action }
    if (patch.kind !== undefined) next.kind = patch.kind
    if (patch.delay !== undefined) next.delay = Math.max(0, patch.delay)
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
    if (patch.release === null) delete next.release
    else if (patch.release !== undefined) next.release = patch.release
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
  | { ok: true; delay: number; supportId: Id; relayerId: Id }
  | { ok: false; reason: 'noBall' | 'teammates' }

/**
 * Proposal when a breakdown is laid on a player (D-081): formation at the end of her run in the
 * phase, or when she receives the ball if later; support = the closest teammate at that instant,
 * relayer = the second closest. Refused when she has no ball in the phase or fewer than two
 * teammates.
 */
export function proposeBreakdown(
  play: Play,
  phaseId: Id,
  tackledId: Id,
  ctx: CommandContext,
): BreakdownProposal {
  const tackled = play.entities.find((e) => e.id === tackledId)
  const phase = compiledPhaseOf(play, phaseId, ctx.settings, ctx.caches)
  if (!isPlayer(tackled) || !phase) return { ok: false, reason: 'noBall' }
  const obtained = ballObtainedAt(play, phaseId, tackledId, ctx.settings, ctx.caches)
  if (obtained === null) return { ok: false, reason: 'noBall' }
  const run = phase.motions.find((m) => m.entityId === tackledId && m.source === 'run')
  const delay = Math.max(obtained, run ? motionEnd(run) - phase.start : 0)
  const t = phase.start + delay
  const at = positionInPhase(phase, tackledId, t)
  if (!at) return { ok: false, reason: 'noBall' }
  const mates = play.entities
    .filter((e): e is PlayerEntity => isPlayer(e) && e.team === tackled.team && e.id !== tackledId)
    .flatMap((e) => {
      const pos = positionInPhase(phase, e.id, t)
      return pos ? [{ id: e.id, d: Math.hypot(pos.x - at.x, pos.y - at.y) }] : []
    })
    .sort((a, b) => a.d - b.d)
  const [support, relayer] = mates
  if (!support || !relayer) return { ok: false, reason: 'teammates' }
  return { ok: true, delay, supportId: support.id, relayerId: relayer.id }
}

/** Lays a ruck on a player with the proposed support and relayer (D-081). */
export function addBreakdown(
  play: Play,
  phaseId: Id,
  tackledId: Id,
  ctx: CommandContext,
): { play: Play; actionId: Id | null; refused: 'noBall' | 'teammates' | null } {
  const proposal = proposeBreakdown(play, phaseId, tackledId, ctx)
  if (!proposal.ok) return { play, actionId: null, refused: proposal.reason }
  const actionId = ctx.ids()
  return {
    actionId,
    refused: null,
    play: appendAction(play, phaseId, {
      id: actionId,
      type: 'breakdown',
      kind: 'ruck',
      tackledId,
      supportId: proposal.supportId,
      relayerId: proposal.relayerId,
      delay: proposal.delay,
      duration: BREAKDOWN_DURATION_DEFAULT,
    }),
  }
}

export interface BreakdownPatch {
  kind?: BreakdownKind
  supportId?: Id
  relayerId?: Id
  delay?: number
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
    if (patch.delay !== undefined) next.delay = Math.max(0, patch.delay)
    if (patch.duration !== undefined && patch.duration > 0) next.duration = patch.duration
    if (patch.contest === null) delete next.contest
    else if (patch.contest !== undefined) next.contest = patch.contest
    return next
  })
}

// ---------------------------------------------------------------------------
// Phases (SPEC 6.4, D-012)

function emptyPhase(id: Id, parentId: Id | null, isDefault: boolean): Phase {
  return { id, parentId, label: '', condition: '', instruction: '', isDefault, actions: [] }
}

/** « Ajouter un temps »: a child of a leaf. Unavailable when the phase already has children. */
export function canAddPhaseAfter(play: Play, phaseId: Id): boolean {
  return findPhase(play, phaseId) !== undefined && childrenOf(play, phaseId).length === 0
}

export function addPhaseAfter(
  play: Play,
  phaseId: Id,
  ctx: Pick<CommandContext, 'ids'>,
): { play: Play; phaseId: Id | null } {
  if (!canAddPhaseAfter(play, phaseId)) return { play, phaseId: null }
  const id = ctx.ids()
  return {
    phaseId: id,
    play: { ...play, phases: [...play.phases, emptyPhase(id, phaseId, false)] },
  }
}

/** « Insérer un temps après »: an empty phase between the phase and its children, which move under it. */
export function insertPhaseAfter(
  play: Play,
  phaseId: Id,
  ctx: Pick<CommandContext, 'ids'>,
): { play: Play; phaseId: Id | null } {
  if (!findPhase(play, phaseId)) return { play, phaseId: null }
  const id = ctx.ids()
  const phases = play.phases.map((p) => (p.parentId === phaseId ? { ...p, parentId: id } : p))
  const index = phases.findIndex((p) => p.id === phaseId)
  phases.splice(index + 1, 0, emptyPhase(id, phaseId, false))
  return { phaseId: id, play: { ...play, phases } }
}

/** Options exist below a parent: unavailable on the root. */
export function canCreateOption(play: Play, phaseId: Id): boolean {
  const phase = findPhase(play, phaseId)
  return phase !== undefined && phase.parentId !== null
}

function addSibling(play: Play, phaseId: Id, sibling: Phase): Play {
  const phase = findPhase(play, phaseId)
  if (!phase) return play
  const siblings = childrenOf(play, phase.parentId)
  // A phase alone becomes option A, by default (D-012).
  const phases = play.phases.map((p) =>
    siblings.length === 1 && p.id === phase.id ? { ...p, isDefault: true } : p,
  )
  return { ...play, phases: [...phases, sibling] }
}

/** « Créer une option à partir d'ici »: an empty sibling. */
export function createOption(
  play: Play,
  phaseId: Id,
  ctx: Pick<CommandContext, 'ids'>,
): { play: Play; phaseId: Id | null } {
  const phase = findPhase(play, phaseId)
  if (!phase || !canCreateOption(play, phaseId)) return { play, phaseId: null }
  const id = ctx.ids()
  return { phaseId: id, play: addSibling(play, phaseId, emptyPhase(id, phase.parentId, false)) }
}

/**
 * « Dupliquer »: a sibling with a copy of the actions (new ids), without descendants; the links
 * between actions of the phase follow the copies (D-108).
 */
export function duplicatePhase(
  play: Play,
  phaseId: Id,
  ctx: Pick<CommandContext, 'ids'>,
): { play: Play; phaseId: Id | null } {
  const phase = findPhase(play, phaseId)
  if (!phase || !canCreateOption(play, phaseId)) return { play, phaseId: null }
  const id = ctx.ids()
  const newIds = new Map(phase.actions.map((a) => [a.id, ctx.ids()]))
  const copyOf = (action: Action): Action => {
    const copied = { ...structuredClone(action), id: newIds.get(action.id) ?? ctx.ids() }
    if (copied.type !== 'run' || !copied.sync) return copied
    const targetId = newIds.get(copied.sync.target.actionId)
    // A link aimed at an action missing from the phase stays as it is (« cible supprimée »).
    if (targetId === undefined) return copied
    return {
      ...copied,
      sync: { ...copied.sync, target: { ...copied.sync.target, actionId: targetId } },
    }
  }
  const copy: Phase = {
    ...structuredClone(phase),
    id,
    isDefault: false,
    label: '',
    actions: phase.actions.map(copyOf),
  }
  return { phaseId: id, play: addSibling(play, phaseId, copy) }
}

/** Deletes a phase and its descendants (after confirmation in the interface). Not the root. */
export function deletePhase(play: Play, phaseId: Id): Play {
  const phase = findPhase(play, phaseId)
  if (!phase || phase.parentId === null) return play
  const gone = new Set([phaseId, ...descendantsOf(play, phaseId)])
  let phases = play.phases.filter((p) => !gone.has(p.id))
  const siblings = phases.filter((p) => p.parentId === phase.parentId)
  if (phase.isDefault && siblings.length >= 1 && !siblings.some((s) => s.isDefault)) {
    const first = siblings[0]
    phases = phases.map((p) => (p.id === first?.id ? { ...p, isDefault: true } : p))
  }
  return { ...play, phases }
}

export function setDefaultOption(play: Play, phaseId: Id): Play {
  const phase = findPhase(play, phaseId)
  if (!phase || phase.parentId === null) return play
  return mapPhases(play, (p) =>
    p.parentId === phase.parentId ? { ...p, isDefault: p.id === phaseId } : p,
  )
}

export interface PhasePatch {
  label?: string
  condition?: string
  instruction?: string
}

export function updatePhase(play: Play, phaseId: Id, patch: PhasePatch): Play {
  return mapPhases(play, (p) => (p.id === phaseId ? { ...p, ...patch } : p))
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
