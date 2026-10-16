// Placement presets (SPEC 10.1, D-087 to D-089): local frame at an anchor, anchor snapping by
// type, saving a placement, applying a preset. Pure: identifiers come from an IdFactory.
import {
  FIELD_DEFAULTS,
  FIELD_MARKINGS,
  PRESET_ANCHOR,
  SNAP_GRID_STEP,
  TEAM_COLORS,
} from '../config/defaults'
import type { IdFactory } from '../model/ids'
import type {
  PlacementPreset,
  PresetBall,
  PresetPosition,
  PresetRole,
  PresetType,
} from '../model/preset'
import {
  attackDirection,
  isBall,
  isPlayer,
  otherTeam,
  type Id,
  type Play,
  type PlayCategory,
  type PlayerEntity,
  type Team,
  type Vec2,
} from '../model/types'
import { snapToGrid } from './snap'

/** Choice of the open side (D-088): the widest side, or left or right of the attacking team. */
export type OpenSideChoice = 'auto' | 'left' | 'right'

/** Local frame at an anchor: world = anchor + (forward × forwardX, openSide × openSideY). */
export interface PresetFrame {
  anchor: Vec2
  /** Sign of x for « forward »: the attack direction of the attacking team. */
  forwardX: 1 | -1
  /** Sign of y for « towards the open side » (towards the field for a lineout). */
  openSideY: 1 | -1
}

/**
 * Frame of a preset at an anchor (SPEC 10.1, D-088). Left and right are seen by the attacking
 * team facing the opposing goal line: for A (towards +x) the left touchline is y = 0.
 */
export function presetFrame(
  type: PresetType,
  anchor: Vec2,
  field: { width: number },
  attackingTeam: Team,
  choice: OpenSideChoice,
): PresetFrame {
  const forwardX = attackDirection(attackingTeam)
  const right: 1 | -1 = forwardX
  const left: 1 | -1 = forwardX === 1 ? -1 : 1
  let openSideY: 1 | -1
  if (type === 'lineout') {
    // Towards the field, from the touchline of the anchor.
    openSideY = anchor.y <= field.width / 2 ? 1 : -1
  } else if (choice === 'left') {
    openSideY = left
  } else if (choice === 'right') {
    openSideY = right
  } else {
    const towardsPlus = field.width - anchor.y
    const towardsMinus = anchor.y
    openSideY = towardsPlus > towardsMinus ? 1 : towardsPlus < towardsMinus ? -1 : right
  }
  return { anchor: { x: anchor.x, y: anchor.y }, forwardX, openSideY }
}

export function toWorld(frame: PresetFrame, local: { forward: number; openSide: number }): Vec2 {
  return {
    x: frame.anchor.x + local.forward * frame.forwardX,
    y: frame.anchor.y + local.openSide * frame.openSideY,
  }
}

export function toLocal(frame: PresetFrame, p: Vec2): { forward: number; openSide: number } {
  return {
    forward: (p.x - frame.anchor.x) * frame.forwardX,
    openSide: (p.y - frame.anchor.y) * frame.openSideY,
  }
}

export type AnchorResult =
  | { ok: true; anchor: Vec2 }
  /** Lineout less than 5 m from a goal line (established): refused; `anchor` is shown only. */
  | { ok: false; reason: 'lineoutNearGoal'; anchor: Vec2 }

/** True when a mark of touch at abscissa x is at least 5 m from both goal lines (SPEC 10.1). */
export function lineoutAnchorAllowed(x: number, field: { length: number }): boolean {
  const min = PRESET_ANCHOR.lineoutMinFromGoal
  return x >= min && x <= field.length - min
}

const round = (value: number): number => Math.round(value / SNAP_GRID_STEP) * SNAP_GRID_STEP

/**
 * Anchor of a preset under the pointer, snapped by type whatever the grid button (D-088): grid
 * for scrum, ruck and free; nearest touchline for a lineout; centre of the halfway line or a
 * 22 m line when close, otherwise the grid, for a restart.
 */
export function snapAnchor(
  type: PresetType,
  pointer: Vec2,
  field: { length: number; width: number },
): AnchorResult {
  if (type === 'lineout') {
    const anchor = { x: round(pointer.x), y: pointer.y <= field.width / 2 ? 0 : field.width }
    return lineoutAnchorAllowed(anchor.x, field)
      ? { ok: true, anchor }
      : { ok: false, reason: 'lineoutNearGoal', anchor }
  }
  if (type === 'restart') {
    const capture = PRESET_ANCHOR.restartCapture
    const centre = { x: field.length / 2, y: field.width / 2 }
    if (Math.hypot(pointer.x - centre.x, pointer.y - centre.y) <= capture) {
      return { ok: true, anchor: centre }
    }
    const line22 = FIELD_MARKINGS.line22FromGoal
    for (const x of [line22, field.length - line22]) {
      if (Math.abs(pointer.x - x) <= capture)
        return { ok: true, anchor: { x, y: round(pointer.y) } }
    }
  }
  return { ok: true, anchor: snapToGrid(pointer, SNAP_GRID_STEP) }
}

const roleOf = (player: PlayerEntity, attackingTeam: Team): PresetRole =>
  player.team === attackingTeam ? 'attack' : 'defense'

const teamOf = (role: PresetRole, attackingTeam: Team): Team =>
  role === 'attack' ? attackingTeam : otherTeam(attackingTeam)

/**
 * Positions and ball of a preset taken from the starting placement of the given players
 * (SPEC 10.1, D-089). With `includeBall`, the ball is recorded with its carrier when she is among
 * the players, otherwise on the ground where it stands.
 */
export function presetFromPlacement(
  play: Play,
  playerIds: readonly Id[],
  includeBall: boolean,
  frame: PresetFrame,
): Pick<PlacementPreset, 'positions' | 'ball'> {
  const chosen = new Set(playerIds)
  const positions: PresetPosition[] = []
  for (const entity of play.entities) {
    if (!isPlayer(entity) || !chosen.has(entity.id)) continue
    const pos = play.setup.positions[entity.id]
    if (!pos) continue
    positions.push({
      role: roleOf(entity, play.attackingTeam),
      number: entity.number,
      ...toLocal(frame, pos),
    })
  }
  let ball: PresetBall | null = null
  if (includeBall && play.entities.some(isBall)) {
    const { ballCarrierId, ballPosition } = play.setup
    const carrier = play.entities.find((e) => e.id === ballCarrierId)
    const carrierPos = ballCarrierId === null ? undefined : play.setup.positions[ballCarrierId]
    if (isPlayer(carrier) && carrierPos) {
      ball = chosen.has(carrier.id)
        ? {
            ...toLocal(frame, carrierPos),
            carrierRole: roleOf(carrier, play.attackingTeam),
            carrierNumber: carrier.number,
          }
        : toLocal(frame, carrierPos)
    } else if (ballPosition) {
      ball = toLocal(frame, ballPosition)
    }
  }
  return { positions, ball }
}

/** Category given to the play by the type of an applied preset; null keeps it (D-087). */
export function categoryOfPreset(type: PresetType): PlayCategory | null {
  switch (type) {
    case 'scrum':
      return 'scrum'
    case 'lineout':
      return 'lineout'
    case 'restart':
      return 'restart'
    case 'ruck':
      return 'phasePlay'
    case 'free':
      return null
  }
}

/** A position of a preset placed in the world, for the ghost tokens of the editor. */
export interface PlacedPosition {
  team: Team
  number: number
  pos: Vec2
}

export function placedPositions(
  preset: Pick<PlacementPreset, 'positions'>,
  frame: PresetFrame,
  attackingTeam: Team,
): PlacedPosition[] {
  return preset.positions.map((p) => ({
    team: teamOf(p.role, attackingTeam),
    number: p.number,
    pos: toWorld(frame, p),
  }))
}

export interface ApplyResult {
  play: Play
  moved: Id[]
  created: Id[]
}

/**
 * Applies a preset (SPEC 10.1): players associated by role and number are moved, missing ones
 * created (team colour, manual defence), the others are unchanged. The k-th position of a number
 * goes to the k-th player of that number (D-089). The ball follows the preset when it has one.
 */
export function applyPreset(
  play: Play,
  preset: Pick<PlacementPreset, 'type' | 'positions' | 'ball'>,
  frame: PresetFrame,
  ids: IdFactory,
): ApplyResult {
  const entities = [...play.entities]
  const positions = { ...play.setup.positions }
  const moved: Id[] = []
  const created: Id[] = []
  const assigned = new Map<string, Id[]>()
  const used = new Set<Id>()
  for (const p of preset.positions) {
    const team = teamOf(p.role, play.attackingTeam)
    const existing = entities.find(
      (e): e is PlayerEntity =>
        isPlayer(e) && e.team === team && e.number === p.number && !used.has(e.id),
    )
    let id: Id
    if (existing) {
      id = existing.id
      moved.push(id)
    } else {
      id = ids()
      entities.push({
        id,
        kind: 'player',
        team,
        number: p.number,
        color: TEAM_COLORS[team],
        defenseMode: 'manual',
      })
      created.push(id)
    }
    used.add(id)
    positions[id] = toWorld(frame, p)
    const key = `${p.role}:${String(p.number)}`
    assigned.set(key, [...(assigned.get(key) ?? []), id])
  }
  let setup = { ...play.setup, positions }
  if (preset.ball) {
    if (!entities.some(isBall)) entities.push({ id: ids(), kind: 'ball' })
    const { carrierRole, carrierNumber } = preset.ball
    let carrierId: Id | null = null
    if (carrierRole !== undefined && carrierNumber !== undefined) {
      const team = teamOf(carrierRole, play.attackingTeam)
      carrierId =
        assigned.get(`${carrierRole}:${String(carrierNumber)}`)?.[0] ??
        entities.find((e) => isPlayer(e) && e.team === team && e.number === carrierNumber)?.id ??
        null
    }
    setup =
      carrierId !== null && positions[carrierId]
        ? { ...setup, ballCarrierId: carrierId, ballPosition: null }
        : { ...setup, ballCarrierId: null, ballPosition: toWorld(frame, preset.ball) }
  }
  const category = categoryOfPreset(preset.type) ?? play.category
  return { play: { ...play, category, entities, setup }, moved, created }
}

/** Anchor of the thumbnail of a preset on a default field, by type. */
function previewAnchor(type: PresetType): Vec2 {
  const { length, width } = FIELD_DEFAULTS
  switch (type) {
    case 'lineout':
      return { x: length / 2, y: 0 }
    case 'scrum':
    case 'ruck':
      return { x: length / 2, y: width / 3 }
    case 'restart':
    case 'free':
      return { x: length / 2, y: width / 2 }
  }
}

/** A play holding only the preset, A attacking, for its thumbnail (SPEC 10.1). */
export function presetPreviewPlay(preset: PlacementPreset, base: Play, ids: IdFactory): Play {
  const empty: Play = {
    ...base,
    attackingTeam: 'A',
    field: { ...FIELD_DEFAULTS, view: { kind: 'full' } },
    entities: [],
    setup: { positions: {}, ballCarrierId: null, ballPosition: null },
    phases: base.phases.filter((p) => p.parentId === null).map((p) => ({ ...p, actions: [] })),
  }
  const frame = presetFrame(preset.type, previewAnchor(preset.type), FIELD_DEFAULTS, 'A', 'auto')
  return applyPreset(empty, preset, frame, ids).play
}
