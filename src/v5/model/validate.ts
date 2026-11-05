// Business validation of a play, in addition to zod (SPEC 4.3). Instants are read as stored: an
// edge that is glued, or that a glued branch point delimits, is checked by the engine on its
// resolved instant. Cycles of glues are checked with the dependency graph.
import { FIELD_LIMITS, INSTRUCTION_RECOMMENDED_LENGTH } from '../../config/defaults'
import { allLines, childrenOf, findBranch } from './branches'
import type { Issue, IssueTarget } from './issues'
import { analyseGlues, glueProblem } from './syncGraph'
import {
  isPlayer,
  isReceiverTarget,
  type Action,
  type Branch,
  type Entity,
  type GlueRef,
  type Id,
  type Play,
  type Sequence,
  type Timed,
} from './types'

export function validatePlay(play: Play): Issue[] {
  return [
    ...checkUniqueIds(play),
    ...checkBall(play),
    ...checkTree(play),
    ...checkBranchPoints(play),
    ...checkActions(play),
    ...checkBranchRefs(play),
    ...checkBranchBounds(play),
    ...checkSequences(play),
    ...checkGlues(play),
    ...checkSetup(play),
    ...checkNumbers(play),
    ...checkField(play),
    ...checkInstructions(play),
  ]
}

const actionTarget = (action: Action): IssueTarget => ({
  kind: 'action',
  id: action.id,
  branchId: action.branchId,
})

const sequenceTarget = (sequence: Sequence): IssueTarget => ({
  kind: 'sequence',
  id: sequence.id,
  branchId: sequence.branchId,
})

function checkUniqueIds(play: Play): Issue[] {
  const issues: Issue[] = []
  const seen = new Set<Id>([play.id])
  const visit = (id: Id, target: IssueTarget): void => {
    if (seen.has(id)) {
      issues.push({ code: 'duplicateId', severity: 'error', target, params: { id } })
    }
    seen.add(id)
  }
  for (const entity of play.entities) visit(entity.id, { kind: 'entity', id: entity.id })
  for (const branch of play.branches) visit(branch.id, { kind: 'branch', id: branch.id })
  for (const action of play.actions) visit(action.id, actionTarget(action))
  for (const sequence of play.sequences) visit(sequence.id, sequenceTarget(sequence))
  return issues
}

function checkBall(play: Play): Issue[] {
  const balls = play.entities.filter((entity) => entity.kind === 'ball')
  const issues: Issue[] = []
  if (balls.length > 1) {
    issues.push({
      code: 'multipleBalls',
      severity: 'error',
      target: { kind: 'play' },
      params: { count: balls.length },
    })
  }
  const { ballCarrierId, ballPosition } = play.setup
  if (balls.length === 0 && (ballCarrierId !== null || ballPosition !== null)) {
    issues.push({ code: 'ballCarrierWithoutBall', severity: 'error', target: { kind: 'play' } })
  }
  if (balls.length > 0 && ballCarrierId === null && ballPosition === null) {
    issues.push({ code: 'ballNotPlaced', severity: 'warning', target: { kind: 'play' } })
  }
  if (ballCarrierId !== null) {
    const carrier = play.entities.find((entity) => entity.id === ballCarrierId)
    if (!isPlayer(carrier)) {
      issues.push({
        code: 'ballCarrierMissing',
        severity: 'error',
        target: { kind: 'play' },
        params: { id: ballCarrierId },
      })
    }
  }
  return issues
}

function checkTree(play: Play): Issue[] {
  const issues: Issue[] = []
  const roots = play.branches.filter((branch) => branch.parentId === null)
  if (roots.length === 0) {
    issues.push({ code: 'noRoot', severity: 'error', target: { kind: 'play' } })
  } else if (roots.length > 1) {
    for (const extra of roots.slice(1)) {
      issues.push({
        code: 'multipleRoots',
        severity: 'error',
        target: { kind: 'branch', id: extra.id },
      })
    }
  }
  for (const branch of play.branches) {
    if (branch.parentId !== null && !findBranch(play, branch.parentId)) {
      issues.push({
        code: 'missingParent',
        severity: 'error',
        target: { kind: 'branch', id: branch.id },
        params: { id: branch.parentId },
      })
    }
  }
  // Cycles: walking up from any branch must reach a root.
  const reported = new Set<Id>()
  for (const branch of play.branches) {
    const seen = new Set<Id>()
    let current = branch
    while (current.parentId !== null) {
      if (seen.has(current.id)) {
        if (!reported.has(current.id)) {
          reported.add(current.id)
          issues.push({
            code: 'cycle',
            severity: 'error',
            target: { kind: 'branch', id: current.id },
          })
        }
        break
      }
      seen.add(current.id)
      const parent = findBranch(play, current.parentId)
      if (!parent) break
      current = parent
    }
  }
  return issues
}

/** `branchAt` if and only if it has children, increasing, two options and one default at least. */
function checkBranchPoints(play: Play): Issue[] {
  const issues: Issue[] = []
  for (const branch of play.branches) {
    const target: IssueTarget = { kind: 'branch', id: branch.id }
    const children = childrenOf(play, branch.id)
    if (children.length === 0) {
      if (branch.branchAt !== undefined || branch.branchAtGlue !== undefined) {
        issues.push({ code: 'branchAtUnexpected', severity: 'error', target })
      }
      continue
    }
    if (branch.branchAt === undefined) {
      issues.push({ code: 'branchAtMissing', severity: 'error', target })
    }
    if (children.length === 1) {
      issues.push({ code: 'tooFewOptions', severity: 'error', target })
      continue
    }
    const defaults = children.filter((child) => child.isDefault).length
    if (defaults !== 1) {
      for (const child of children) {
        issues.push({
          code: 'defaultCount',
          severity: 'error',
          target: { kind: 'branch', id: child.id },
          params: { count: defaults },
        })
      }
    }
  }
  for (const branch of play.branches) {
    if (branch.parentId === null) continue
    const parent = findBranch(play, branch.parentId)
    const own = storedBranchAt(branch)
    const previous = parent && storedBranchAt(parent)
    if (own !== null && previous !== undefined && previous !== null && own <= previous) {
      issues.push({
        code: 'branchAtNotIncreasing',
        severity: 'error',
        target: { kind: 'branch', id: branch.id },
      })
    }
  }
  return issues
}

/** Stored instant of a branch point that is not glued, else null. */
function storedBranchAt(branch: Branch): number | null {
  return branch.branchAt !== undefined && branch.branchAtGlue === undefined ? branch.branchAt : null
}

function checkActions(play: Play): Issue[] {
  const issues: Issue[] = []
  const byId = new Map<Id, Entity>(play.entities.map((entity) => [entity.id, entity]))
  for (const action of play.actions) {
    const target = actionTarget(action)
    // Every actor of a kick or a breakdown is an existing player (lot 3).
    const actors = (ids: Id[]): void => {
      for (const id of ids) {
        const entity = byId.get(id)
        if (!entity) {
          issues.push({ code: 'missingEntity', severity: 'error', target, params: { id } })
        } else if (!isPlayer(entity)) {
          issues.push({ code: 'actorNotPlayer', severity: 'error', target, params: { id } })
        }
      }
    }
    if (action.type === 'kick') {
      const receiverId = isReceiverTarget(action.target) ? action.target.receiverId : null
      actors(receiverId === null ? [action.kickerId] : [action.kickerId, receiverId])
      if (receiverId === action.kickerId) {
        issues.push({ code: 'kickSelfTarget', severity: 'error', target })
      }
    } else if (action.type === 'breakdown') {
      const ids = [action.tackledId, action.supportId, action.relayerId]
      actors(ids)
      if (new Set(ids).size < ids.length) {
        issues.push({ code: 'breakdownDuplicate', severity: 'error', target })
      }
      const tackled = byId.get(action.tackledId)
      for (const id of [action.supportId, action.relayerId]) {
        const teammate = byId.get(id)
        if (isPlayer(tackled) && isPlayer(teammate) && teammate.team !== tackled.team) {
          issues.push({ code: 'breakdownTeam', severity: 'error', target, params: { id } })
        }
      }
    } else if (action.type === 'run') {
      const entity = byId.get(action.entityId)
      if (!entity) {
        issues.push({
          code: 'missingEntity',
          severity: 'error',
          target,
          params: { id: action.entityId },
        })
      } else if (!isPlayer(entity)) {
        issues.push({ code: 'runTargetNotPlayer', severity: 'error', target })
      }
    } else if (action.type === 'pass') {
      for (const id of [action.fromId, action.toId]) {
        const entity = byId.get(id)
        if (!entity) {
          issues.push({ code: 'missingEntity', severity: 'error', target, params: { id } })
        } else if (!isPlayer(entity)) {
          issues.push({
            code: 'passEndpointNotPlayer',
            severity: 'error',
            target,
            params: { id },
          })
        }
      }
    }
  }
  return issues
}

/** An action or a sequence references an existing branch. */
function checkBranchRefs(play: Play): Issue[] {
  const issues: Issue[] = []
  const visit = (block: Timed, target: IssueTarget): void => {
    if (findBranch(play, block.branchId)) return
    issues.push({
      code: 'missingBranch',
      severity: 'error',
      target,
      params: { id: block.branchId },
    })
  }
  for (const action of play.actions) visit(action, actionTarget(action))
  for (const sequence of play.sequences) visit(sequence, sequenceTarget(sequence))
  return issues
}

/** An action or a sequence stays in its branch; the engine falls back and signals it (SPEC 4.3). */
function checkBranchBounds(play: Play): Issue[] {
  const issues: Issue[] = []
  const visit = (block: Timed, target: IssueTarget): void => {
    if (block.startGlue) return
    const branch = findBranch(play, block.branchId)
    if (!branch) return
    const parent = branch.parentId === null ? undefined : findBranch(play, branch.parentId)
    const from = parent ? storedBranchAt(parent) : null
    if (from !== null && block.start < from) {
      issues.push({
        code: 'startsBeforeBranch',
        severity: 'warning',
        target,
        params: { branchAt: from },
      })
    }
    const until = storedBranchAt(branch)
    if (until !== null && block.start >= until) {
      issues.push({
        code: 'startsAfterBranch',
        severity: 'warning',
        target,
        params: { branchAt: until },
      })
    }
  }
  for (const action of play.actions) visit(action, actionTarget(action))
  for (const sequence of play.sequences) visit(sequence, sequenceTarget(sequence))
  return issues
}

/** A sequence is not empty, does not cross a branch point, does not overlap another one. */
function checkSequences(play: Play): Issue[] {
  const issues: Issue[] = []
  for (const sequence of play.sequences) {
    if (sequence.startGlue || sequence.endGlue) continue
    const target = sequenceTarget(sequence)
    if (sequence.end <= sequence.start) {
      issues.push({ code: 'sequenceEndBeforeStart', severity: 'error', target })
      continue
    }
    const branch = findBranch(play, sequence.branchId)
    const until = branch ? storedBranchAt(branch) : null
    if (until !== null && sequence.start < until && sequence.end > until) {
      issues.push({
        code: 'sequenceCrossesBranch',
        severity: 'warning',
        target,
        params: { branchAt: until },
      })
    }
  }
  const reported = new Set<Id>()
  for (const line of allLines(play)) {
    const inLine = play.sequences
      .filter((s) => line.includes(s.branchId) && !s.startGlue && !s.endGlue && s.end > s.start)
      .map((sequence, order) => ({ sequence, order }))
      .sort((a, b) => a.sequence.start - b.sequence.start || a.order - b.order)
    let latestEnd = 0
    for (const { sequence } of inLine) {
      if (sequence.start < latestEnd && !reported.has(sequence.id)) {
        reported.add(sequence.id)
        issues.push({
          code: 'sequenceOverlap',
          severity: 'warning',
          target: sequenceTarget(sequence),
        })
      }
      latestEnd = Math.max(latestEnd, sequence.end)
    }
  }
  return issues
}

/** Glues: target, line, event and waypoint (SPEC 4.3, 5.8). */
function checkGlues(play: Play): Issue[] {
  const issues: Issue[] = []
  const visit = (
    target: IssueTarget,
    ownerId: Id,
    edgeBranchId: Id,
    glue: GlueRef | undefined,
    key: 'start' | 'end' | 'branchAt',
  ): void => {
    if (!glue) return
    const problem = glueProblem(play, ownerId, edgeBranchId, glue)
    if (problem === null) return
    issues.push(
      problem === 'missing'
        ? { code: 'glueTargetMissing', severity: 'error', target, key }
        : {
            code: 'glueTargetInvalid',
            severity: 'error',
            target,
            key,
            params: { reason: problem },
          },
    )
  }
  const visitBlock = (block: Timed, target: IssueTarget): void => {
    visit(target, block.id, block.branchId, block.startGlue, 'start')
    visit(target, block.id, block.branchId, block.endGlue, 'end')
  }
  for (const branch of play.branches) {
    visit({ kind: 'branch', id: branch.id }, branch.id, branch.id, branch.branchAtGlue, 'branchAt')
  }
  for (const action of play.actions) visitBlock(action, actionTarget(action))
  for (const sequence of play.sequences) visitBlock(sequence, sequenceTarget(sequence))
  for (const edge of analyseGlues(play).cyclic) {
    const { ownerId, branchId, kind } = edge
    const isSequence = play.sequences.some((sequence) => sequence.id === ownerId)
    const target: IssueTarget =
      kind === 'branchAt'
        ? { kind: 'branch', id: ownerId }
        : { kind: isSequence ? 'sequence' : 'action', id: ownerId, branchId }
    issues.push({ code: 'glueCycle', severity: 'error', target, key: kind })
  }
  return issues
}

function checkSetup(play: Play): Issue[] {
  const issues: Issue[] = []
  for (const entity of play.entities) {
    if (isPlayer(entity) && !(entity.id in play.setup.positions)) {
      issues.push({
        code: 'positionMissing',
        severity: 'error',
        target: { kind: 'entity', id: entity.id },
      })
    }
  }
  return issues
}

function checkNumbers(play: Play): Issue[] {
  const issues: Issue[] = []
  const seen = new Map<string, Id>()
  for (const entity of play.entities) {
    if (!isPlayer(entity)) continue
    const key = `${entity.team}:${entity.number}`
    if (seen.has(key)) {
      issues.push({
        code: 'duplicateNumber',
        severity: 'warning',
        target: { kind: 'entity', id: entity.id },
        params: { team: entity.team, number: entity.number },
      })
    } else {
      seen.set(key, entity.id)
    }
  }
  return issues
}

function checkField(play: Play): Issue[] {
  const issues: Issue[] = []
  for (const key of ['length', 'width', 'inGoal'] as const) {
    const value = play.field[key]
    const { min, max } = FIELD_LIMITS[key]
    if (value < min || value > max) {
      issues.push({
        code: 'fieldOutOfRange',
        severity: 'warning',
        target: { kind: 'play' },
        params: { dimension: key, value, min, max },
      })
    }
  }
  return issues
}

function checkInstructions(play: Play): Issue[] {
  return play.sequences
    .filter((sequence) => sequence.instruction.length > INSTRUCTION_RECOMMENDED_LENGTH)
    .map((sequence) => ({
      code: 'instructionTooLong' as const,
      severity: 'warning' as const,
      target: sequenceTarget(sequence),
      params: { length: sequence.instruction.length, max: INSTRUCTION_RECOMMENDED_LENGTH },
    }))
}
