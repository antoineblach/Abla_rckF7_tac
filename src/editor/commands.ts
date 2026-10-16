// Editing commands: pure transformations of a play (SPEC 6, DECISIONS Q7 to Q15).
// Each command returns a new play (never mutates its input); an impossible command returns
// the play unchanged and the caller may tell the user why.
import { BREAKDOWN_DURATION_DEFAULT, DUPLICATE_OFFSET, TEAM_COLORS } from '../config/defaults'
import type { EvalCaches } from '../engine/caches'
import { ballObtainedAt, compiledPhaseOf } from '../engine/evaluate'
import { motionEnd, positionInPhase } from '../engine/timeline'
import type { IdFactory } from '../model/ids'
import { childrenOf, descendantsOf, findPhase } from '../model/phaseTree'
import type { EngineSettings } from '../model/settings'
import {
  isPlayer,
  isReceiverTarget,
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

export function moveWaypoint(play: Play, actionId: Id, index: number, pos: Vec2): Play {
  return mapActions(play, (action) => {
    if (
      action.id !== actionId ||
      action.type !== 'run' ||
      index < 0 ||
      index >= action.waypoints.length
    )
      return action
    const waypoints = action.waypoints.map((p, i) => (i === index ? { x: pos.x, y: pos.y } : p))
    return { ...action, waypoints }
  })
}

/** Right click on a point: removes it; removing the last point removes the run (D-015). */
export function deleteWaypoint(play: Play, actionId: Id, index: number): Play {
  return mapActions(play, (action) => {
    if (action.id !== actionId || action.type !== 'run') return action
    const waypoints = action.waypoints.filter((_, i) => i !== index)
    return waypoints.length === 0 ? null : { ...action, waypoints }
  })
}

/** Adds a pass; its delay is the instant the passer obtains the ball in this phase (D-015). */
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
  const delay = ballObtainedAt(play, phaseId, fromId, ctx.settings, ctx.caches) ?? 0
  const actionId = ctx.ids()
  return {
    actionId,
    play: mapPhases(play, (p) =>
      p.id === phaseId
        ? {
            ...p,
            actions: [
              ...p.actions,
              { id: actionId, type: 'pass', fromId, toId, delay: Math.max(0, delay) },
            ],
          }
        : p,
    ),
  }
}

export interface RunPatch {
  pace?: Pace
  /** null clears the imposed duration. */
  durationOverride?: number | null
  delay?: number
}

export interface PassPatch {
  delay?: number
  /** null returns to the speed of the settings. */
  ballSpeed?: number | null
}

export function updateRun(play: Play, actionId: Id, patch: RunPatch): Play {
  return mapActions(play, (action) => {
    if (action.id !== actionId || action.type !== 'run') return action
    const next = { ...action }
    if (patch.pace !== undefined) next.pace = patch.pace
    if (patch.delay !== undefined) next.delay = Math.max(0, patch.delay)
    if (patch.durationOverride === null) delete next.durationOverride
    else if (patch.durationOverride !== undefined && patch.durationOverride > 0)
      next.durationOverride = patch.durationOverride
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
    return next
  })
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
 * Adds a kick to a receiver or to a point; its delay is the instant the kicker obtains the ball;
 * a restart in a play of category restart, a long kick otherwise (D-093 tools, SPEC 10.4).
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
  const delay = ballObtainedAt(play, phaseId, kickerId, ctx.settings, ctx.caches) ?? 0
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
      delay: Math.max(0, delay),
    }),
  }
}

export interface KickPatch {
  kind?: KickKind
  delay?: number
  /** null returns to the default flight time of the kind. */
  flightTime?: number | null
  target?: KickTarget
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

/** « Dupliquer »: a sibling with a copy of the actions (new ids), without descendants. */
export function duplicatePhase(
  play: Play,
  phaseId: Id,
  ctx: Pick<CommandContext, 'ids'>,
): { play: Play; phaseId: Id | null } {
  const phase = findPhase(play, phaseId)
  if (!phase || !canCreateOption(play, phaseId)) return { play, phaseId: null }
  const id = ctx.ids()
  const copy: Phase = {
    ...structuredClone(phase),
    id,
    isDefault: false,
    label: '',
    actions: phase.actions.map((a) => ({ ...structuredClone(a), id: ctx.ids() })),
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
