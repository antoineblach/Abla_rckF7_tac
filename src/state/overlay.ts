// Builds the editor overlay (selection, handles, previews) from the editor state.
import type { Bounds } from '../engine/bounds'
import type { PhaseSchematic } from '../engine/evaluate'
import type { Selection } from '../editor/selection'
import { runToolPreview, type RunDraft } from '../editor/tools/runTool'
import type { ToolId } from '../editor/tools/types'
import type { Id, Vec2 } from '../model/types'
import type { EditorOverlay } from '../render/overlay'

export interface OverlayInput {
  schematic: PhaseSchematic
  selection: Selection
  tool: ToolId
  runDraft: RunDraft | null
  passFromId: Id | null
  kickFromId: Id | null
  cursor: Vec2 | null
  selectionBox: Bounds | null
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
  }
}
