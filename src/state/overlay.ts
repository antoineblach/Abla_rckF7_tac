// Builds the editor overlay (selection, handles, previews, links, hover) from the editor state.
import type { Bounds } from '../engine/bounds'
import type { PhaseSchematic } from '../engine/evaluate'
import { placementPreview, type PlacementMode } from '../editor/placementMode'
import type { Selection } from '../editor/selection'
import { runToolPreview, type RunDraft } from '../editor/tools/runTool'
import type { ToolId } from '../editor/tools/types'
import type { Id, Play, Vec2 } from '../model/types'
import {
  EMPTY_OVERLAY,
  type EditorOverlay,
  type OverlayHover,
  type OverlayLink,
} from '../render/overlay'

export interface OverlayInput {
  play: Play
  schematic: PhaseSchematic
  selection: Selection
  tool: ToolId
  runDraft: RunDraft | null
  passFromId: Id | null
  kickFromId: Id | null
  placement: PlacementMode | null
  cursor: Vec2 | null
  selectionBox: Bounds | null
  /** Action hovered in the list of the phase (D-113). */
  hoveredActionId: Id | null
}

/** Curves and points of an action of the displayed phase, haloed when hovered in the list. */
function hoverOf(schematic: PhaseSchematic, actionId: Id | null): OverlayHover | null {
  if (actionId === null) return null
  const paths: Vec2[][] = [
    ...[...schematic.runs, ...schematic.relays]
      .filter((r) => r.actionId === actionId)
      .map((r) => [...r.points, ...r.ignoredPoints]),
    ...schematic.passes.filter((p) => p.actionId === actionId).map((p) => [p.from, p.to]),
    ...schematic.kicks.filter((k) => k.actionId === actionId).map((k) => [k.from, k.to]),
  ]
  const points = schematic.breakdowns.filter((b) => b.actionId === actionId).map((b) => b.pos)
  return paths.length > 0 || points.length > 0 ? { paths, points } : null
}

/** Links drawn when the linked run or its target is selected (D-108); unreached targets skipped. */
function linksOf(schematic: PhaseSchematic, selection: Selection): OverlayLink[] {
  const links: OverlayLink[] = []
  for (const link of schematic.syncLinks) {
    const shown =
      selection.actions.includes(link.actionId) || selection.actions.includes(link.targetActionId)
    if (shown && link.to) links.push({ from: link.from, to: link.to })
  }
  return links
}

/** Only the halo of the action hovered in the list, over the scene during playback (D-113). */
export function hoverOverlay(schematic: PhaseSchematic, hoveredActionId: Id | null): EditorOverlay {
  return { ...EMPTY_OVERLAY, hover: hoverOf(schematic, hoveredActionId) }
}

export function buildOverlay(input: OverlayInput): EditorOverlay {
  const { schematic, selection, tool, cursor } = input
  const selected = (actionId: Id) => selection.actions.includes(actionId)
  const selectedPlayers = schematic.players
    .filter((p) => selection.players.includes(p.id))
    .map((p) => p.pos)
  // A selected breakdown is ringed like a selected player (lot 3).
  selectedPlayers.push(
    ...schematic.breakdowns.filter((b) => selected(b.actionId)).map((b) => b.pos),
  )
  const selectedPaths: Vec2[][] = [
    ...schematic.runs.filter((r) => selected(r.actionId)).map((r) => r.points),
    ...schematic.relays.filter((r) => selected(r.actionId)).map((r) => r.points),
    ...schematic.passes.filter((p) => selected(p.actionId)).map((p) => [p.from, p.to]),
    ...schematic.kicks.filter((k) => selected(k.actionId)).map((k) => [k.from, k.to]),
  ]
  if (input.placement) {
    // A placement shows its ghost tokens and its anchor, nothing of the tools (D-096).
    const placed = placementPreview(input.placement, input.play, cursor)
    return {
      selectedPlayers,
      selectedPaths,
      handles: [],
      selectionBox: null,
      preview: placed.path,
      ghosts: placed.ghosts.map((g) => ({ pos: g.pos, team: g.team, label: String(g.number) })),
      anchor: placed.anchor,
      syncLinks: [],
      hover: null,
    }
  }
  const handles =
    tool === 'select'
      ? [
          ...schematic.runs.flatMap((r) => r.waypoints),
          ...schematic.kicks.filter((k) => k.receiverId === null).map((k) => k.to),
        ]
      : []
  let preview: Vec2[] | null = null
  if (tool === 'run') preview = runToolPreview(input.runDraft, cursor)
  const fromId = tool === 'pass' ? input.passFromId : tool === 'kick' ? input.kickFromId : null
  if (fromId) {
    const from = schematic.players.find((p) => p.id === fromId)?.pos
    if (from && cursor) preview = [from, cursor]
    else if (from) selectedPlayers.push(from)
  }
  return {
    selectedPlayers,
    selectedPaths,
    handles,
    selectionBox: input.selectionBox,
    preview,
    ghosts: [],
    anchor: null,
    syncLinks: linksOf(schematic, selection),
    hover: hoverOf(schematic, input.hoveredActionId),
  }
}
