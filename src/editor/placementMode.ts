// Placement modes of the editor (SPEC 10.1, 10.2, D-088 to D-091, D-096): applying a preset,
// clicking the anchor of a preset being saved, moving the whole play by two clicks. Pure: the
// preview under the pointer (ghost tokens, anchor mark) and the effect of a click.
import type { IdFactory } from '../model/ids'
import type { PlacementPreset, PresetType } from '../model/preset'
import {
  isPlayer,
  type Id,
  type Play,
  type PlayCategory,
  type Team,
  type Vec2,
} from '../model/types'
import {
  applyPreset,
  placedPositions,
  presetFrame,
  presetFromPlacement,
  snapAnchor,
  type OpenSideChoice,
  type PresetFrame,
} from './presets'
import { translatePlay } from './transform'

/** What « Enregistrer un modèle » saves once the anchor is clicked (SPEC 10.1, D-089). */
export interface SavePresetRequest {
  /** Name shown in the banner (kept by « Mettre à jour »). */
  name: string
  type: PresetType
  /** Players whose starting placement is saved. */
  playerIds: Id[]
  includeBall: boolean
}

export type PlacementMode =
  | { kind: 'applyPreset'; preset: PlacementPreset; openSide: OpenSideChoice }
  | { kind: 'savePreset'; request: SavePresetRequest; openSide: OpenSideChoice }
  /** « Déplacer la combinaison »: start point, then end point (D-090). */
  | { kind: 'movePlay'; from: Vec2 | null }

export interface GhostPreview {
  team: Team
  number: number
  pos: Vec2
}

export interface AnchorPreview {
  pos: Vec2
  refused: boolean
  /** Unit vectors of « forward » and « towards the open side », or null. */
  axes: { forward: Vec2; openSide: Vec2 } | null
}

export interface PlacementPreview {
  ghosts: GhostPreview[]
  anchor: AnchorPreview | null
  /** Segment from the start point to the pointer while moving the play. */
  path: Vec2[] | null
  /** The anchor under the pointer is refused (lineout less than 5 m from a goal line). */
  refused: boolean
}

const NO_PREVIEW: PlacementPreview = { ghosts: [], anchor: null, path: null, refused: false }

type PresetMode = Exclude<PlacementMode, { kind: 'movePlay' }>

function typeOf(mode: PresetMode): PresetType {
  return mode.kind === 'applyPreset' ? mode.preset.type : mode.request.type
}

/** Frame of a preset mode at the pointer, or the refused anchor (lineout near a goal line). */
function frameAt(
  type: PresetType,
  openSide: OpenSideChoice,
  play: Play,
  pointer: Vec2,
): { ok: true; frame: PresetFrame } | { ok: false; anchor: Vec2 } {
  const snapped = snapAnchor(type, pointer, play.field)
  if (!snapped.ok) return { ok: false, anchor: snapped.anchor }
  return {
    ok: true,
    frame: presetFrame(type, snapped.anchor, play.field, play.attackingTeam, openSide),
  }
}

/** Players of the play at their starting positions. */
function startingTokens(play: Play): GhostPreview[] {
  const tokens: GhostPreview[] = []
  for (const entity of play.entities) {
    const pos = play.setup.positions[entity.id]
    if (isPlayer(entity) && pos) tokens.push({ team: entity.team, number: entity.number, pos })
  }
  return tokens
}

/** Preview under the pointer: ghost tokens and anchor mark (SPEC 10.1, D-088, D-090). */
export function placementPreview(
  mode: PlacementMode,
  play: Play,
  pointer: Vec2 | null,
): PlacementPreview {
  if (!pointer) return NO_PREVIEW
  if (mode.kind === 'movePlay') {
    const from = mode.from
    if (!from) return { ...NO_PREVIEW, anchor: { pos: pointer, refused: false, axes: null } }
    const dx = pointer.x - from.x
    const dy = pointer.y - from.y
    return {
      ghosts: startingTokens(play).map((t) => ({
        ...t,
        pos: { x: t.pos.x + dx, y: t.pos.y + dy },
      })),
      anchor: { pos: pointer, refused: false, axes: null },
      path: [from, pointer],
      refused: false,
    }
  }
  const at = frameAt(typeOf(mode), mode.openSide, play, pointer)
  if (!at.ok) {
    // Refused: ghosts hidden, the anchor drawn as a cross (D-088).
    return { ...NO_PREVIEW, anchor: { pos: at.anchor, refused: true, axes: null }, refused: true }
  }
  const { frame } = at
  return {
    ghosts:
      mode.kind === 'applyPreset' ? placedPositions(mode.preset, frame, play.attackingTeam) : [],
    anchor: {
      pos: frame.anchor,
      refused: false,
      axes: { forward: { x: frame.forwardX, y: 0 }, openSide: { x: 0, y: frame.openSideY } },
    },
    path: null,
    refused: false,
  }
}

export type PlacementStep =
  /** Click without effect (refused anchor). */
  | { kind: 'refused' }
  /** The mode goes on (start point of a move chosen). */
  | { kind: 'continue'; mode: PlacementMode }
  /** The play changes, as one undo step. */
  | { kind: 'edit'; play: Play }
  /** The anchor of a preset being saved: content in the local frame. */
  | { kind: 'save'; content: Pick<PlacementPreset, 'positions' | 'ball'> }

/** Effect of a click at `pos` (already snapped on the grid when it is on). */
export function placementClick(
  mode: PlacementMode,
  play: Play,
  pos: Vec2,
  ids: IdFactory,
): PlacementStep {
  if (mode.kind === 'movePlay') {
    if (!mode.from) return { kind: 'continue', mode: { kind: 'movePlay', from: pos } }
    const delta = { x: pos.x - mode.from.x, y: pos.y - mode.from.y }
    return {
      kind: 'edit',
      play: delta.x === 0 && delta.y === 0 ? play : translatePlay(play, delta),
    }
  }
  const at = frameAt(typeOf(mode), mode.openSide, play, pos)
  if (!at.ok) return { kind: 'refused' }
  if (mode.kind === 'applyPreset') {
    return { kind: 'edit', play: applyPreset(play, mode.preset, at.frame, ids).play }
  }
  const { playerIds, includeBall } = mode.request
  return { kind: 'save', content: presetFromPlacement(play, playerIds, includeBall, at.frame) }
}

/** Players saved by « Placement de départ entier »: every player with a starting position. */
export function wholePlacementIds(play: Play): Id[] {
  return play.entities.filter((e) => isPlayer(e) && play.setup.positions[e.id]).map((e) => e.id)
}

/**
 * « Inclure le ballon », checked by default when the whole placement is saved or when the carrier
 * is among the selected players (D-089); never without a ball.
 */
export function defaultIncludeBall(play: Play, playerIds: readonly Id[], whole: boolean): boolean {
  if (!play.entities.some((e) => e.kind === 'ball')) return false
  const carrier = play.setup.ballCarrierId
  return whole || (carrier !== null && playerIds.includes(carrier))
}

/** Type proposed by the dialog, from the category of the play (a mere default). */
export function defaultPresetType(category: PlayCategory): PresetType {
  switch (category) {
    case 'scrum':
      return 'scrum'
    case 'lineout':
      return 'lineout'
    case 'restart':
      return 'restart'
    case 'phasePlay':
    case 'drill':
      return 'free'
  }
}

/**
 * The preset to write: a new one, or the updated one keeping its id, name, type and dates (the
 * stored `updatedAt` confirms the version it started from, D-092).
 */
export function presetToSave(
  request: SavePresetRequest,
  content: Pick<PlacementPreset, 'positions' | 'ball'>,
  existing: PlacementPreset | null,
  id: Id,
  now: Date,
): PlacementPreset {
  if (existing) return { ...existing, positions: content.positions, ball: content.ball }
  const stamp = now.toISOString()
  return {
    schemaVersion: 1,
    id,
    name: request.name,
    type: request.type,
    positions: content.positions,
    ball: content.ball,
    createdAt: stamp,
    updatedAt: stamp,
  }
}
