import {
  addPhaseAfter,
  canAddPhaseAfter,
  canCreateOption,
  createOption,
  duplicatePhase,
  insertPhaseAfter,
} from '../../editor/commands'
import { layoutPhaseTree } from '../../editor/phaseLayout'
import { descendantsOf, findPhase } from '../../model/phaseTree'
import type { Id, Play } from '../../model/types'
import { commandContext } from '../../state/editorActions'
import { applyEdit, selectPhase, useEditorStore } from '../../state/editorStore'
import { pushDialog } from '../../state/libraryState'
import { labelParts } from '../../state/selectors'
import { phaseLabel } from '../strings'

const NODE_W = 150
const NODE_H = 44
const GAP_X = 28
const GAP_Y = 12

/** Adds a phase with a command returning the new id, then selects it. */
function createAndSelect(fn: (play: Play) => { play: Play; phaseId: Id | null }): void {
  const created: { id: Id | null } = { id: null }
  applyEdit((play) => {
    const result = fn(play)
    created.id = result.phaseId
    return result.play
  })
  if (created.id) selectPhase(created.id)
}

/** Phase tree (SPEC 6.4): horizontal trunk, options stacked below their branch point. */
export function PhaseTree() {
  const play = useEditorStore((s) => s.play)
  const selectedId = useEditorStore((s) => s.selectedPhaseId)
  const readOnly = useEditorStore((s) => s.readOnly)
  if (!play) return <section className="phase-tree" aria-label="Arbre des temps" />
  const layout = layoutPhaseTree(play)
  const byId = new Map(layout.nodes.map((n) => [n.id, n]))
  const width = layout.columns * (NODE_W + GAP_X)
  const height = layout.rows * (NODE_H + GAP_Y)
  const selected = selectedId ? findPhase(play, selectedId) : undefined
  const ctx = commandContext()

  return (
    <section className="phase-tree" aria-label="Arbre des temps">
      <div className="phase-tree__actions" role="toolbar" aria-label="Actions sur le temps">
        <button
          type="button"
          disabled={readOnly || !selected || !canAddPhaseAfter(play, selected.id)}
          onClick={() => {
            if (selected) createAndSelect((p) => addPhaseAfter(p, selected.id, ctx))
          }}
        >
          Ajouter un temps
        </button>
        <button
          type="button"
          disabled={readOnly || !selected}
          onClick={() => {
            if (selected) createAndSelect((p) => insertPhaseAfter(p, selected.id, ctx))
          }}
        >
          Insérer un temps après
        </button>
        <button
          type="button"
          disabled={readOnly || !selected || !canCreateOption(play, selected.id)}
          onClick={() => {
            if (selected) createAndSelect((p) => createOption(p, selected.id, ctx))
          }}
        >
          Créer une option à partir d’ici
        </button>
        <button
          type="button"
          disabled={readOnly || !selected || !canCreateOption(play, selected.id)}
          onClick={() => {
            if (selected) createAndSelect((p) => duplicatePhase(p, selected.id, ctx))
          }}
        >
          Dupliquer
        </button>
        <button
          type="button"
          disabled={readOnly || !selected || selected.parentId === null}
          onClick={() => {
            if (!selected) return
            pushDialog({
              kind: 'confirmDeletePhase',
              phaseId: selected.id,
              label: phaseLabel(labelParts(play, selected.id)),
              descendants: descendantsOf(play, selected.id).length,
            })
          }}
        >
          Supprimer
        </button>
      </div>
      <div className="phase-tree__scroll">
        <div className="phase-tree__canvas" style={{ width, height }}>
          <svg className="phase-tree__links" width={width} height={height} aria-hidden="true">
            {layout.nodes.map((node) => {
              const parent = node.parentId ? byId.get(node.parentId) : undefined
              if (!parent) return null
              const x1 = parent.column * (NODE_W + GAP_X) + NODE_W
              const y1 = parent.row * (NODE_H + GAP_Y) + NODE_H / 2
              const x2 = node.column * (NODE_W + GAP_X)
              const y2 = node.row * (NODE_H + GAP_Y) + NODE_H / 2
              const mid = x1 + GAP_X / 2
              return (
                <polyline
                  key={node.id}
                  points={`${x1},${y1} ${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                />
              )
            })}
          </svg>
          {layout.nodes.map((node) => {
            const phase = findPhase(play, node.id)
            if (!phase) return null
            const label = phaseLabel(labelParts(play, node.id))
            const classes = ['phase-node']
            if (node.id === selectedId) classes.push('phase-node--selected')
            if (phase.isDefault && labelParts(play, node.id).option)
              classes.push('phase-node--default')
            return (
              <button
                key={node.id}
                type="button"
                className={classes.join(' ')}
                style={{
                  left: node.column * (NODE_W + GAP_X),
                  top: node.row * (NODE_H + GAP_Y),
                  width: NODE_W,
                  height: NODE_H,
                }}
                aria-pressed={node.id === selectedId}
                title={phase.condition || label}
                onClick={() => {
                  selectPhase(node.id)
                }}
              >
                <span className="phase-node__label">{label}</span>
                {phase.condition ? (
                  <span className="phase-node__condition">{phase.condition}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
