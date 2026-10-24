// Moving or flipping a whole play (SPEC 10.2, D-090): the same transformation applies to the
// starting positions, the ball on the ground, the waypoints, the kick target points and the
// saved free frame; waypoints keep their segment speed (D-114). Pure.
import type { Action, FieldView, Play, Vec2 } from '../model/types'

function mapAction(action: Action, f: (p: Vec2) => Vec2): Action {
  switch (action.type) {
    case 'run':
      return { ...action, waypoints: action.waypoints.map((w) => ({ ...w, ...f(w) })) }
    case 'kick':
      return 'point' in action.target
        ? { ...action, target: { point: f(action.target.point) } }
        : action
    case 'pass':
    case 'breakdown':
      return action
    case 'groupRun':
      // Lot 5, declared only: rejected by the file schema until then.
      return action
  }
}

function mapView(view: FieldView, f: (p: Vec2) => Vec2): FieldView {
  if (view.kind !== 'frame') return view
  const a = f(view.min)
  const b = f(view.max)
  return {
    kind: 'frame',
    min: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
    max: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
  }
}

/** Applies a point mapping to every position of a play. */
export function mapPlayPoints(play: Play, f: (p: Vec2) => Vec2): Play {
  const positions: Record<string, Vec2> = {}
  for (const [id, pos] of Object.entries(play.setup.positions)) positions[id] = f(pos)
  return {
    ...play,
    field: { ...play.field, view: mapView(play.field.view, f) },
    setup: {
      ...play.setup,
      positions,
      ballPosition: play.setup.ballPosition ? f(play.setup.ballPosition) : null,
    },
    phases: play.phases.map((phase) => ({
      ...phase,
      actions: phase.actions.map((action) => mapAction(action, f)),
    })),
  }
}

/** « Déplacer la combinaison »: translation by `delta` (D-090). */
export function translatePlay(play: Play, delta: Vec2): Play {
  return mapPlayPoints(play, (p) => ({ x: p.x + delta.x, y: p.y + delta.y }))
}

/**
 * « Retourner »: left-right symmetry about the axis of the field, y becoming width − y; the
 * attack direction is unchanged (D-090).
 */
export function mirrorPlay(play: Play): Play {
  const width = play.field.width
  return mapPlayPoints(play, (p) => ({ x: p.x, y: width - p.y }))
}
