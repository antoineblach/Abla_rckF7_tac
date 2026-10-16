import type { Id } from './types'

// Invalidities never stop the program: they are listed and shown on the element concerned
// (SPEC 4.3). Messages are produced by the interface from the code and parameters.

export type IssueSeverity = 'error' | 'warning'

export type IssueTarget =
  | { kind: 'play' }
  | { kind: 'entity'; id: Id }
  | { kind: 'phase'; id: Id }
  | { kind: 'action'; id: Id; phaseId: Id }

export type IssueCode =
  // Business validation (SPEC 4.3)
  | 'duplicateId'
  | 'multipleBalls'
  | 'noRoot'
  | 'multipleRoots'
  | 'missingParent'
  | 'cycle'
  | 'defaultCount'
  | 'missingEntity'
  | 'runTargetNotPlayer'
  | 'passEndpointNotPlayer'
  | 'ballCarrierMissing'
  | 'ballCarrierWithoutBall'
  | 'ballNotPlaced'
  | 'positionMissing'
  | 'duplicateNumber'
  | 'fieldOutOfRange'
  | 'instructionTooLong'
  // Business validation of kicks and breakdowns (lot 3, SPEC 10.3, 10.4)
  | 'actorNotPlayer'
  | 'kickSelfTarget'
  | 'breakdownDuplicate'
  | 'breakdownTeam'
  // Engine validation (SPEC 5.3, 5.4)
  | 'twoRunsSamePhase'
  | 'passToOpponent'
  | 'passerWithoutBall'
  | 'simultaneousPass'
  | 'unsupportedAction'
  // Engine validation of lot 3 (SPEC 5.7, 10.3, 10.4, D-079, D-083)
  | 'kickerWithoutBall'
  | 'tackledWithoutBall'
  | 'runCutByBreakdown'
  | 'relayerLate'
  | 'forwardPass'

export interface Issue {
  code: IssueCode
  severity: IssueSeverity
  target: IssueTarget
  params?: Record<string, string | number>
}

export function issueKey(issue: Issue): string {
  const target = issue.target.kind === 'play' ? 'play' : `${issue.target.kind}:${issue.target.id}`
  return `${issue.code}@${target}`
}
