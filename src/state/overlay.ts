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
  cursor: Vec2 | null
  selectionBox: Bounds | null
}

export function buildOverlay(input: OverlayInput): EditorOverlay {
  const { schematic, selection, tool, cursor } = input
  const selectedPlayers = schematic.players
    .filter((p) => selection.players.includes(p.id))
    .map((p) => p.pos)
  const selectedPaths: Vec2[][] = [
    ...schematic.runs.filter((r) => selection.actions.includes(r.actionId)).map((r) => r.points),
    ...schematic.passes
      .filter((p) => selection.actions.includes(p.actionId))
      .map((p) => [p.from, p.to]),
  ]
  const handles = tool === 'select' ? schematic.runs.flatMap((r) => r.waypoints) : []
  let preview: Vec2[] | null = null
  if (tool === 'run') preview = runToolPreview(input.runDraft, cursor)
  if (tool === 'pass' && input.passFromId && cursor) {
    const from = schematic.players.find((p) => p.id === input.passFromId)?.pos
    if (from) preview = [from, cursor]
  }
  if (tool === 'pass' && input.passFromId && !cursor) {
    const from = schematic.players.find((p) => p.id === input.passFromId)?.pos
    if (from) selectedPlayers.push(from)
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
