import type { Id } from './types'

// Invalidities never stop the program: they are listed and shown on the element concerned
// (SPEC 4.3). Messages are produced by the interface from the code and parameters.

export type IssueSeverity = 'error' | 'warning'

export type IssueTarget =
  | { kind: 'play' }
  | { kind: 'entity'; id: Id }
  | { kind: 'branch'; id: Id }
  | { kind: 'action'; id: Id; branchId: Id }
  | { kind: 'sequence'; id: Id; branchId: Id }

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
  // Business validation of branches and sequences (SPEC 4.3, D-139)
  | 'tooFewOptions'
  | 'branchAtMissing'
  | 'branchAtUnexpected'
  | 'branchAtNotIncreasing'
  | 'missingBranch'
  | 'startsBeforeBranch'
  | 'startsAfterBranch'
  | 'sequenceCrossesBranch'
  | 'sequenceOverlap'
  | 'sequenceEndBeforeStart'
  // Business validation of kicks and breakdowns (lot 3, SPEC 10.3, 10.4)
  | 'actorNotPlayer'
  | 'kickSelfTarget'
  | 'breakdownDuplicate'
  | 'breakdownTeam'
  // Engine validation (SPEC 5.3, 5.4)
  | 'passToOpponent'
  | 'passerWithoutBall'
  | 'simultaneousPass'
  | 'unsupportedAction'
  // « Départ retardé de x s » (SPEC 5.2, 5.3, 4.3, D-139)
  | 'runStartDelayed'
  // Engine validation of lot 3 (SPEC 5.7, 10.3, 10.4, D-079, D-083)
  | 'kickerWithoutBall'
  | 'tackledWithoutBall'
  | 'runCutByBreakdown'
  | 'relayerLate'
  | 'forwardPass'
  // Glues, business validation (SPEC 4.3, 5.8, D-139)
  | 'glueTargetMissing'
  | 'glueTargetInvalid'
  // Engine validation of lot 3 bis (SPEC 5.2, 5.3, 5.9)
  | 'runSpeedHigh'
  | 'runSpeedTooHigh'
  | 'runNotContinued'
  // Acceleration and braking alerts (lot 3bis-1, D-132)
  | 'runAccelHigh'
  | 'runAccelTooHigh'
  | 'runBrakeHigh'
  | 'runBrakeTooHigh'

export interface Issue {
  code: IssueCode
  severity: IssueSeverity
  target: IssueTarget
  params?: Record<string, string | number>
  /** Tells apart several issues of the same code on the same target (segment, option, edge). */
  key?: string
}

export function issueKey(issue: Issue): string {
  const target = issue.target.kind === 'play' ? 'play' : `${issue.target.kind}:${issue.target.id}`
  return issue.key === undefined
    ? `${issue.code}@${target}`
    : `${issue.code}@${target}#${issue.key}`
}
