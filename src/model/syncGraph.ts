// Dependencies between the timings of the actions of a phase (SPEC 4.3, 5.8, D-108, D-110).
// Nodes: the motion of a run, the release and the arrival of a pass or a kick, the formation of
// a breakdown. A run with a link depends on its target; the arrival of a pass on its release and
// on the runs of its passer and receiver; the arrival of a kick on its release; a release on
// receipt on everything that may bring the ball to the player in the phase. Fixed releases and
// formations depend on nothing. A receiver whose run meets the arrival of the pass she receives
// depends only on its release and on the run of the passer: the ball arrives at the rendez-vous
// point when she gets there (D-108). Pure; shared by the validation, the engine and the commands.
import type { Action, Id, Phase, RunAction, RunSync, SyncTarget } from './types'

/** Why a link cannot apply. */
export type SyncProblem =
  /** No action with this id in the phase (« cible supprimée »). */
  | 'missing'
  /** The link targets its own run. */
  | 'self'
  /** The event does not exist for the type of the target action. */
  | 'event'
  /** The waypoint of the target run does not exist. */
  | 'index'
  /** The rendez-vous waypoint of the run does not exist. */
  | 'at'

/** Problem of a link (by default the link of the run) in its phase, or null when usable. */
export function syncProblem(
  phase: Phase,
  run: RunAction,
  sync: RunSync | undefined = run.sync,
): SyncProblem | null {
  if (!sync) return null
  if (sync.at !== undefined && sync.at >= run.waypoints.length) return 'at'
  const target = phase.actions.find((action) => action.id === sync.target.actionId)
  if (!target) return 'missing'
  if (target.id === run.id) return 'self'
  switch (sync.target.event) {
    case 'runEnd':
      return target.type === 'run' ? null : 'event'
    case 'runPoint':
      if (target.type !== 'run') return 'event'
      return sync.target.index < target.waypoints.length ? null : 'index'
    case 'release':
    case 'arrival':
      return target.type === 'pass' || target.type === 'kick' ? null : 'event'
    case 'formation':
      return target.type === 'breakdown' ? null : 'event'
  }
}

type NodeKey = string

const runNode = (id: Id): NodeKey => `run:${id}`

/**
 * True when the link makes the run of a receiver meet the arrival of the pass she receives: the
 * arrival is then computed at the rendez-vous point (release + distance / ball speed), without
 * depending on her run (D-108).
 */
export function meetsOwnPass(phase: Phase, run: RunAction, sync: RunSync): boolean {
  if (sync.target.event !== 'arrival') return false
  const targetId = sync.target.actionId
  const target = phase.actions.find((action) => action.id === targetId)
  return target?.type === 'pass' && target.toId === run.entityId
}

function targetNode(target: SyncTarget): NodeKey {
  switch (target.event) {
    case 'runEnd':
    case 'runPoint':
      return runNode(target.actionId)
    case 'release':
      return `release:${target.actionId}`
    case 'arrival':
      return `arrival:${target.actionId}`
    case 'formation':
      return `formation:${target.actionId}`
  }
}

/** First run of each entity in the phase: the one the engine applies (D-013). */
function firstRuns(actions: readonly Action[]): Map<Id, Id> {
  const result = new Map<Id, Id>()
  for (const action of actions) {
    if (action.type === 'run' && !result.has(action.entityId))
      result.set(action.entityId, action.id)
  }
  return result
}

/** Actions that may bring the ball to a player: passes and kicks to her, breakdowns she relays. */
function receptionSources(actions: readonly Action[], playerId: Id): NodeKey[] {
  const sources: NodeKey[] = []
  for (const action of actions) {
    if (action.type === 'pass' && action.toId === playerId) sources.push(`arrival:${action.id}`)
    if (action.type === 'kick' && 'receiverId' in action.target) {
      if (action.target.receiverId === playerId) sources.push(`arrival:${action.id}`)
    }
    if (action.type === 'breakdown' && action.relayerId === playerId) {
      sources.push(`formation:${action.id}`)
    }
  }
  return sources
}

/** Dependency graph of a phase, with `links` giving the link of each run (overrides allowed). */
function dependencies(
  phase: Phase,
  links: (run: RunAction) => RunSync | undefined,
): Map<NodeKey, NodeKey[]> {
  const graph = new Map<NodeKey, NodeKey[]>()
  const runs = firstRuns(phase.actions)
  const add = (from: NodeKey, to: NodeKey[]): void => {
    graph.set(from, [...(graph.get(from) ?? []), ...to])
  }
  for (const action of phase.actions) {
    switch (action.type) {
      case 'run': {
        const sync = links(action)
        if (!sync || syncProblem(phase, action, sync)) {
          add(runNode(action.id), [])
        } else if (meetsOwnPass(phase, action, sync)) {
          const targetId = sync.target.actionId
          const passer = phase.actions.find((a) => a.id === targetId)
          const passerRun = passer?.type === 'pass' ? runs.get(passer.fromId) : undefined
          add(runNode(action.id), [
            `release:${targetId}`,
            ...(passerRun === undefined ? [] : [runNode(passerRun)]),
          ])
        } else {
          add(runNode(action.id), [targetNode(sync.target)])
        }
        break
      }
      case 'pass': {
        const movers = [runs.get(action.fromId), runs.get(action.toId)].flatMap((id) =>
          id === undefined ? [] : [runNode(id)],
        )
        add(`arrival:${action.id}`, [`release:${action.id}`, ...movers])
        add(
          `release:${action.id}`,
          action.release === 'onReceipt' ? receptionSources(phase.actions, action.fromId) : [],
        )
        break
      }
      case 'kick':
        add(`arrival:${action.id}`, [`release:${action.id}`])
        add(
          `release:${action.id}`,
          action.release === 'onReceipt' ? receptionSources(phase.actions, action.kickerId) : [],
        )
        break
      case 'breakdown':
        add(`formation:${action.id}`, [])
        break
      case 'groupRun':
        // Lot 5, declared only.
        break
    }
  }
  return graph
}

/**
 * Strongly connected components (Tarjan), in an order where every component comes after the
 * components it depends on. Nodes are visited in insertion order (deterministic).
 */
function components(graph: Map<NodeKey, NodeKey[]>): NodeKey[][] {
  let next = 0
  const index = new Map<NodeKey, number>()
  const low = new Map<NodeKey, number>()
  const stack: NodeKey[] = []
  const onStack = new Set<NodeKey>()
  const result: NodeKey[][] = []
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
    if (low.get(node) === index.get(node)) {
      const component: NodeKey[] = []
      for (;;) {
        const top = stack.pop()
        if (top === undefined) break
        onStack.delete(top)
        component.push(top)
        if (top === node) break
      }
      result.push(component)
    }
  }
  for (const node of graph.keys()) if (!index.has(node)) visit(node)
  return result
}

export interface SyncAnalysis {
  /** Runs whose link applies, in dependency order (targets before the runs depending on them). */
  order: Id[]
  /** Runs whose link is part of a cycle (ignored by the engine, D-108). */
  cyclic: Set<Id>
  /** Links that cannot apply, by run. */
  problems: Map<Id, SyncProblem>
}

function analyse(phase: Phase, links: (run: RunAction) => RunSync | undefined): SyncAnalysis {
  const problems = new Map<Id, SyncProblem>()
  for (const action of phase.actions) {
    if (action.type !== 'run') continue
    const problem = syncProblem(phase, action, links(action))
    if (problem) problems.set(action.id, problem)
  }
  const linked = new Set(
    phase.actions
      .filter((a): a is RunAction => a.type === 'run' && links(a) !== undefined)
      .filter((run) => !problems.has(run.id))
      .map((run) => run.id),
  )
  const order: Id[] = []
  const cyclic = new Set<Id>()
  for (const component of components(dependencies(phase, links))) {
    const runs = component
      .filter((node) => node.startsWith('run:'))
      .map((node) => node.slice('run:'.length))
      .filter((id) => linked.has(id))
    // A component of several nodes is a cycle; it matters only when it goes through a link.
    if (component.length > 1) for (const id of runs) cyclic.add(id)
    else order.push(...runs)
  }
  return { order, cyclic, problems }
}

/** Links of the runs of a phase: usable ones in dependency order, cycles, problems. */
export function analyseSyncs(phase: Phase): SyncAnalysis {
  return analyse(phase, (run) => run.sync)
}

/** True when giving `sync` to the run would close a cycle of links (refused, D-109). */
export function createsCycle(phase: Phase, runId: Id, sync: RunSync): boolean {
  return analyse(phase, (run) => (run.id === runId ? sync : run.sync)).cyclic.has(runId)
}
