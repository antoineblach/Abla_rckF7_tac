// Business validation of a play, in addition to zod (SPEC 4.3).
import { FIELD_LIMITS, INSTRUCTION_RECOMMENDED_LENGTH } from '../config/defaults'
import type { Issue } from './issues'
import { childrenOf, findPhase } from './phaseTree'
import { isPlayer, type Entity, type Id, type Play } from './types'

export function validatePlay(play: Play): Issue[] {
  return [
    ...checkUniqueIds(play),
    ...checkBall(play),
    ...checkTree(play),
    ...checkActions(play),
    ...checkSetup(play),
    ...checkNumbers(play),
    ...checkField(play),
    ...checkInstructions(play),
  ]
}

function checkUniqueIds(play: Play): Issue[] {
  const issues: Issue[] = []
  const seen = new Set<Id>([play.id])
  const visit = (id: Id, issue: Issue): void => {
    if (seen.has(id)) issues.push(issue)
    seen.add(id)
  }
  for (const entity of play.entities) {
    visit(entity.id, {
      code: 'duplicateId',
      severity: 'error',
      target: { kind: 'entity', id: entity.id },
      params: { id: entity.id },
    })
  }
  for (const phase of play.phases) {
    visit(phase.id, {
      code: 'duplicateId',
      severity: 'error',
      target: { kind: 'phase', id: phase.id },
      params: { id: phase.id },
    })
    for (const action of phase.actions) {
      visit(action.id, {
        code: 'duplicateId',
        severity: 'error',
        target: { kind: 'action', id: action.id, phaseId: phase.id },
        params: { id: action.id },
      })
    }
  }
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
  const roots = play.phases.filter((phase) => phase.parentId === null)
  if (roots.length === 0) {
    issues.push({ code: 'noRoot', severity: 'error', target: { kind: 'play' } })
  } else if (roots.length > 1) {
    for (const extra of roots.slice(1)) {
      issues.push({
        code: 'multipleRoots',
        severity: 'error',
        target: { kind: 'phase', id: extra.id },
      })
    }
  }
  for (const phase of play.phases) {
    if (phase.parentId !== null && !findPhase(play, phase.parentId)) {
      issues.push({
        code: 'missingParent',
        severity: 'error',
        target: { kind: 'phase', id: phase.id },
        params: { id: phase.parentId },
      })
    }
  }
  // Cycles: walking up from any phase must reach a root.
  const reported = new Set<Id>()
  for (const phase of play.phases) {
    const seen = new Set<Id>()
    let current = phase
    while (current.parentId !== null) {
      if (seen.has(current.id)) {
        if (!reported.has(current.id)) {
          reported.add(current.id)
          issues.push({
            code: 'cycle',
            severity: 'error',
            target: { kind: 'phase', id: current.id },
          })
        }
        break
      }
      seen.add(current.id)
      const parent = findPhase(play, current.parentId)
      if (!parent) break
      current = parent
    }
  }
  // Among siblings, exactly one default when there are at least two.
  const parents = new Set(play.phases.map((phase) => phase.parentId))
  for (const parentId of parents) {
    const siblings = childrenOf(play, parentId)
    if (siblings.length < 2) continue
    const defaults = siblings.filter((sibling) => sibling.isDefault).length
    if (defaults !== 1) {
      for (const sibling of siblings) {
        issues.push({
          code: 'defaultCount',
          severity: 'error',
          target: { kind: 'phase', id: sibling.id },
          params: { count: defaults },
        })
      }
    }
  }
  return issues
}

function checkActions(play: Play): Issue[] {
  const issues: Issue[] = []
  const byId = new Map<Id, Entity>(play.entities.map((entity) => [entity.id, entity]))
  for (const phase of play.phases) {
    for (const action of phase.actions) {
      const target = { kind: 'action', id: action.id, phaseId: phase.id } as const
      if (action.type === 'run') {
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
  return play.phases
    .filter((phase) => phase.instruction.length > INSTRUCTION_RECOMMENDED_LENGTH)
    .map((phase) => ({
      code: 'instructionTooLong' as const,
      severity: 'warning' as const,
      target: { kind: 'phase' as const, id: phase.id },
      params: { length: phase.instruction.length, max: INSTRUCTION_RECOMMENDED_LENGTH },
    }))
}
