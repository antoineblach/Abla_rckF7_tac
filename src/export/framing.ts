// Framing of the exports (SPEC 9.2, D-063): the bounding box of every line shown, plus the margin
// of the automatic framing, the same for every image of a GIF and every thumbnail of a play.
import { AUTO_FRAME_MARGIN } from '../config/defaults'
import { expandBounds, lineBounds, unionBounds, type Bounds } from '../engine/bounds'
import type { EvalCaches } from '../engine/caches'
import { compileLine } from '../engine/timeline'
import type { EngineSettings } from '../model/settings'
import type { Id, Play } from '../model/types'
import { frameForView } from '../render/viewport'

/** Bounding box of every line shown in the file, plus the automatic framing margin (SPEC 9.2). */
export function linesFrame(
  play: Play,
  lines: readonly (readonly Id[])[],
  settings: EngineSettings,
  caches: EvalCaches,
): Bounds {
  let bounds: Bounds | null = null
  for (const line of lines) {
    bounds = unionBounds(bounds, lineBounds(compileLine(play, line, settings, caches)))
  }
  return bounds
    ? expandBounds(bounds, AUTO_FRAME_MARGIN)
    : frameForView({ kind: 'full' }, play.field, play.attackingTeam)
}
