// Glues between edges and their dependency graph (SPEC 4.3, 5.8, D-139, D-152). Nodes: the left edge
// and the end event of each block (action or sequence), each branch point. The end of a block depends
// on its start; a glued edge on its target; the arrival of a pass on the runs of its passer and its
// receiver in its line, those that depend on this arrival themselves aside (D-152). A receiver glued
// to the arrival of her pass depends on its release and on the runs of the passer instead. Seen from
// here, a waypoint of a run is its end: both change with its speeds. A cycle always goes through a
// glue. Pure; shared by the validation, the engine and the commands.
import { findBranch, isBranchPoint, pathToBranch } from './branches'
import type { Action, GlueKeep, GlueRef, Id, Play, Sequence } from './types'

/** Why a glue cannot apply. */
export type GlueProblem =
  /** No action, sequence or branch with this id (« cible supprimée »). */
  | 'missing'
  /** The glue targets its own block. */
  | 'self'
  /** The target is neither in the branch of the edge nor in one of its ancestors. */
  | 'line'
  /** The event does not exist for this target. */
  | 'event'
  /** The waypoint of the target run does not exist. */
  | 'point'

/**
 * Problem of a glue, or null when usable. `ownerId` is the block of the edge (action, sequence or
 * branch), `edgeBranchId` the branch that holds the edge: its `branchId`, or the branch itself for
 * a branch point.
 */
export function glueProblem(
  play: Play,
  ownerId: Id,
  edgeBranchId: Id,
  glue: GlueRef,
): GlueProblem | null {
  if (glue.targetId === ownerId) return 'self'
  const line = pathToBranch(play, edgeBranchId)
  const action = play.actions.find((candidate) => candidate.id === glue.targetId)
  const block = action ?? play.sequences.find((candidate) => candidate.id === glue.targetId)
  if (block) {
    if (!line.includes(block.branchId)) return 'line'
    if (typeof glue.event === 'string') return null
    if (action?.type !== 'run') return 'event'
    return glue.event.point < action.waypoints.length ? null : 'point'
  }
  const branch = findBranch(play, glue.targetId)
  if (!branch) return 'missing'
  if (!line.includes(branch.id)) return 'line'
  return glue.event === 'end' && isBranchPoint(play, branch.id) ? null : 'event'
}

export type GlueEdgeKind = 'start' | 'end' | 'branchAt'

/** A glued edge of a play. */
export interface GlueEdge {
  kind: GlueEdgeKind
  /** Action, sequence or branch that holds the edge. */
  ownerId: Id
  /** Branch that holds the edge: its `branchId`, or the branch itself for a branch point. */
  branchId: Id
  glue: GlueRef
  /** Right edge only: the block slides or stretches (SPEC 5.8). */
  keep: GlueKeep | null
}

/** Every glued edge of a play: branch points, then the edges of the actions and the sequences. */
export function glueEdges(play: Play): GlueEdge[] {
  const edges: GlueEdge[] = []
  for (const branch of play.branches) {
    if (branch.branchAtGlue) {
      edges.push({
        kind: 'branchAt',
        ownerId: branch.id,
        branchId: branch.id,
        glue: branch.branchAtGlue,
        keep: null,
      })
    }
  }
  for (const block of [...play.actions, ...play.sequences]) {
    const { id: ownerId, branchId, startGlue, endGlue } = block
    if (startGlue) edges.push({ kind: 'start', ownerId, branchId, glue: startGlue, keep: null })
    if (endGlue) edges.push({ kind: 'end', ownerId, branchId, glue: endGlue, keep: endGlue.keep })
  }
  return edges
}

/** Key of an edge among the edges of a play. */
export function edgeKey(edge: Pick<GlueEdge, 'ownerId' | 'kind'>): string {
  return `${edge.ownerId}|${edge.kind}`
}

type NodeKey = string
type Graph = Map<NodeKey, NodeKey[]>

const startNode = (id: Id): NodeKey => `start:${id}`
const endNode = (id: Id): NodeKey => `end:${id}`
const branchNode = (id: Id): NodeKey => `branch:${id}`

function targetNode(play: Play, glue: GlueRef): NodeKey {
  if (findBranch(play, glue.targetId)) return branchNode(glue.targetId)
  return glue.event === 'start' ? startNode(glue.targetId) : endNode(glue.targetId)
}

/** The node a glued edge moves: a block that slides moves from its start (SPEC 5.8). */
function edgeNode(edge: GlueEdge, gluedStarts: ReadonlySet<Id>): NodeKey {
  if (edge.kind === 'branchAt') return branchNode(edge.ownerId)
  if (edge.kind === 'start') return startNode(edge.ownerId)
  const slides = edge.keep === 'duration' && !gluedStarts.has(edge.ownerId)
  return slides ? startNode(edge.ownerId) : endNode(edge.ownerId)
}

function addTo(graph: Graph, from: NodeKey, to: readonly NodeKey[]): void {
  const known = graph.get(from)
  if (known) known.push(...to)
  else graph.set(from, [...to])
}

/**
 * True when the right edge of a run is glued to the arrival of the pass its player receives: the
 * target is then the release plus the flight to her point, without depending on her run (SPEC 4.3,
 * 5.8).
 */
export function meetsOwnPass(play: Play, edge: GlueEdge): boolean {
  if (edge.kind !== 'end' || edge.glue.event !== 'end') return false
  const target = play.actions.find((action) => action.id === edge.glue.targetId)
  const owner = play.actions.find((action) => action.id === edge.ownerId)
  return target?.type === 'pass' && owner?.type === 'run' && owner.entityId === target.toId
}

/** Nodes that depend on `node`, itself included. */
function dependentsOf(graph: Graph, node: NodeKey): Set<NodeKey> {
  const reversed: Graph = new Map()
  for (const [from, deps] of graph) for (const dep of deps) addTo(reversed, dep, [from])
  const seen = new Set<NodeKey>([node])
  const stack = [node]
  for (let next = stack.pop(); next !== undefined; next = stack.pop()) {
    for (const dependent of reversed.get(next) ?? []) {
      if (seen.has(dependent)) continue
      seen.add(dependent)
      stack.push(dependent)
    }
  }
  return seen
}

/**
 * Component of each node, by strongly connected component (Tarjan). Nodes are visited in insertion
 * order (deterministic). Only the size of a component matters here.
 */
function componentsOf(graph: Graph): Map<NodeKey, NodeKey[]> {
  let next = 0
  const index = new Map<NodeKey, number>()
  const low = new Map<NodeKey, number>()
  const stack: NodeKey[] = []
  const onStack = new Set<NodeKey>()
  const result = new Map<NodeKey, NodeKey[]>()
  const visit = (node: NodeKey): void => {
    index.set(node, next)
    low.set(node, next)
    next++
    stack.push(node)
    onStack.add(node)
    for (const dep of graph.get(node) ?? []) {
      if (!index.has(dep)) {
        visit(dep)
        low.set(node, Math.min(low.get(node) ?? 0, low.get(dep) ?? 0))
      } else if (onStack.has(dep)) {
        low.set(node, Math.min(low.get(node) ?? 0, index.get(dep) ?? 0))
      }
    }
    if (low.get(node) !== index.get(node)) return
    const component: NodeKey[] = []
    for (;;) {
      const top = stack.pop()
      if (top === undefined) break
      onStack.delete(top)
      component.push(top)
      if (top === node) break
    }
    for (const member of component) result.set(member, component)
  }
  for (const node of graph.keys()) if (!index.has(node)) visit(node)
  return result
}

export interface GlueAnalysis {
  /** Edges that apply, in the order of their dependencies (targets first). */
  order: GlueEdge[]
  /** Edges of a cycle: ignored by the engine (SPEC 5.8). */
  cyclic: GlueEdge[]
  /** Blocks whose left edge applies: both edges glued, the start follows its glue (SPEC 5.8). */
  gluedStarts: ReadonlySet<Id>
  /** By pass: the runs of its passer and its receiver that depend on its arrival (D-152). */
  arrivalDependents: ReadonlyMap<Id, ReadonlySet<Id>>
}

function runsOf(play: Play, entityId: Id): Action[] {
  return play.actions.filter((action) => action.type === 'run' && action.entityId === entityId)
}

/** Stored instant of a block, used to order what the graph leaves free. */
const byStoredStart = <T extends { start: number }>(blocks: readonly T[]): T[] =>
  blocks
    .map((block, order) => ({ block, order }))
    .sort((a, b) => a.block.start - b.block.start || a.order - b.order)
    .map(({ block }) => block)

/**
 * What resolves better when done first, without being a dependency of the graph (the run before on
 * the same player, the ball event before, the breakdown that may stop a run): never a cycle, only the
 * order of the edges that the graph leaves free.
 */
function softOrder(play: Play, inLine: (branchId: Id, otherBranchId: Id) => boolean): Graph {
  const soft: Graph = new Map()
  const chain = (blocks: readonly (Action | Sequence)[]): void => {
    blocks.forEach((block, i) => {
      for (let j = i - 1; j >= 0; j--) {
        const previous = blocks[j]
        if (previous && inLine(block.branchId, previous.branchId)) {
          addTo(soft, startNode(block.id), [endNode(previous.id)])
          return
        }
      }
    })
  }
  const entities = new Set<Id>()
  for (const action of play.actions) if (action.type === 'run') entities.add(action.entityId)
  for (const id of entities) chain(byStoredStart(runsOf(play, id)))
  chain(byStoredStart(play.actions.filter((action) => action.type !== 'run')))
  for (const action of play.actions) {
    if (action.type !== 'breakdown') continue
    for (const id of [action.tackledId, action.supportId, action.relayerId]) {
      for (const run of runsOf(play, id)) {
        if (inLine(run.branchId, action.branchId)) {
          addTo(soft, endNode(run.id), [startNode(action.id)])
        }
      }
    }
  }
  return soft
}

function analyse(play: Play, edges: readonly GlueEdge[]): GlueAnalysis {
  const usable = edges.filter(
    (edge) => glueProblem(play, edge.ownerId, edge.branchId, edge.glue) === null,
  )
  const gluedStarts = new Set(usable.filter((e) => e.kind === 'start').map((e) => e.ownerId))
  const blocks = [...play.actions, ...play.sequences]

  /** What an edge reads; the runs of the passer come on top for a receiver (`ownMovers`). */
  const directTarget = (edge: GlueEdge): NodeKey =>
    meetsOwnPass(play, edge) ? startNode(edge.glue.targetId) : targetNode(play, edge.glue)

  // Chains of glues: what a run depends on through them (D-152).
  const chains: Graph = new Map()
  for (const block of blocks) addTo(chains, endNode(block.id), [startNode(block.id)])
  for (const edge of usable) addTo(chains, edgeNode(edge, gluedStarts), [directTarget(edge)])

  const paths = new Map<Id, readonly Id[]>()
  const pathOf = (branchId: Id): readonly Id[] => {
    const known = paths.get(branchId)
    if (known) return known
    const path = pathToBranch(play, branchId)
    paths.set(branchId, path)
    return path
  }
  const inLine = (branchId: Id, otherBranchId: Id): boolean =>
    pathOf(branchId).includes(otherBranchId)

  const movers: [NodeKey, NodeKey][] = []
  /** Runs of the passer that a receiver glued to the arrival reads (SPEC 4.3), by edge. */
  const ownMovers = new Map<GlueEdge, NodeKey[]>()
  const arrivalDependents = new Map<Id, ReadonlySet<Id>>()
  for (const action of play.actions) {
    if (action.type !== 'pass') continue
    const arrival = endNode(action.id)
    const dependents = dependentsOf(chains, arrival)
    const ids = new Set<Id>()
    const independentRuns = (entityId: Id): NodeKey[] =>
      runsOf(play, entityId).flatMap((run) => {
        if (dependents.has(endNode(run.id))) {
          ids.add(run.id)
          return []
        }
        return inLine(action.branchId, run.branchId) ? [endNode(run.id)] : []
      })
    const passerRuns = independentRuns(action.fromId)
    for (const run of [...passerRuns, ...independentRuns(action.toId)]) movers.push([arrival, run])
    for (const edge of usable) {
      if (edge.glue.targetId === action.id && meetsOwnPass(play, edge)) {
        ownMovers.set(edge, passerRuns)
      }
    }
    arrivalDependents.set(action.id, ids)
  }

  const full: Graph = new Map()
  for (const branch of play.branches) full.set(branchNode(branch.id), [])
  for (const [from, deps] of chains) addTo(full, from, deps)
  for (const [from, dep] of movers) addTo(full, from, [dep])
  for (const [edge, deps] of ownMovers) addTo(full, edgeNode(edge, gluedStarts), deps)

  const components = componentsOf(full)
  const isCyclic = (edge: GlueEdge): boolean => {
    const component = components.get(edgeNode(edge, gluedStarts))
    if (component === undefined || component.length <= 1) return false
    const deps = [directTarget(edge), ...(ownMovers.get(edge) ?? [])]
    return deps.some((dep) => component.includes(dep))
  }
  const cyclic = usable.filter(isCyclic)
  const applying = usable.filter((edge) => !isCyclic(edge))
  const appliedStarts = new Set(applying.filter((e) => e.kind === 'start').map((e) => e.ownerId))

  // Dependencies without the cycles: the graph left is acyclic.
  const hard: Graph = new Map()
  for (const branch of play.branches) hard.set(branchNode(branch.id), [])
  for (const block of blocks) {
    addTo(hard, startNode(block.id), [])
    addTo(hard, endNode(block.id), [startNode(block.id)])
  }
  for (const edge of applying) {
    const node = edgeNode(edge, appliedStarts)
    addTo(hard, node, [directTarget(edge), ...(ownMovers.get(edge) ?? [])])
  }
  for (const [from, dep] of movers) addTo(hard, from, [dep])

  const soft = softOrder(play, inLine)
  const byNode = new Map<NodeKey, GlueEdge[]>()
  for (const edge of applying) {
    const node = edgeNode(edge, appliedStarts)
    byNode.set(node, [...(byNode.get(node) ?? []), edge])
  }

  // Nodes in stored order; among those whose dependencies are done, the first one.
  const remaining: NodeKey[] = [
    ...byStoredStart(blocks).flatMap((block) => [startNode(block.id), endNode(block.id)]),
    ...play.branches.map((branch) => branchNode(branch.id)),
  ]
  const done = new Set<NodeKey>()
  const allDone = (deps: readonly NodeKey[] | undefined): boolean =>
    (deps ?? []).every((dep) => done.has(dep))
  const order: GlueEdge[] = []
  while (remaining.length > 0) {
    let pick = remaining.findIndex((n) => allDone(hard.get(n)) && allDone(soft.get(n)))
    if (pick < 0) pick = remaining.findIndex((n) => allDone(hard.get(n)))
    const [node] = remaining.splice(Math.max(pick, 0), 1)
    if (node === undefined) break
    done.add(node)
    order.push(...(byNode.get(node) ?? []))
  }
  return { order, cyclic, gluedStarts: appliedStarts, arrivalDependents }
}

/** The glues of a play: those that apply in the order of their dependencies, the cycles. */
export function analyseGlues(play: Play): GlueAnalysis {
  return analyse(play, glueEdges(play))
}

/** True when this glue, given to its edge, closes a cycle (refused when laid, SPEC 5.8). */
export function createsCycle(play: Play, edge: GlueEdge): boolean {
  const key = edgeKey(edge)
  const edges = [...glueEdges(play).filter((known) => edgeKey(known) !== key), edge]
  return analyse(play, edges).cyclic.some((known) => edgeKey(known) === key)
}
