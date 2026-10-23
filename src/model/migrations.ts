// Successive migrations up to the current schema version (SPEC 4.4, 4.5).
// Each step validates the data against the schema of its own version, then migrates it;
// the result is finally validated against the current schema.
import type { z } from 'zod'
import { playSchemaV3, type PlayFileV3 } from './schema'
import { playSchemaV0, type PlayFileV0 } from './schemaV0'
import { playSchemaV1, type PlayFileV1 } from './schemaV1'
import { playSchemaV2, type PlayFileV2 } from './schemaV2'
import type { Play } from './types'

export const CURRENT_SCHEMA_VERSION = 3

export interface SchemaIssue {
  path: string
  message: string
}

export type UpgradeError =
  | { code: 'notAnObject' }
  | { code: 'missingVersion' }
  | { code: 'futureVersion'; version: number }
  | { code: 'unknownVersion'; version: number }
  | { code: 'invalid'; version: number; issues: SchemaIssue[] }

export type UpgradeResult =
  { ok: true; play: Play; fromVersion: number } | { ok: false; error: UpgradeError }

interface MigrationStep {
  from: number
  schema: z.ZodType
  migrate: (data: never) => unknown
}

function migrateV0toV1(v0: PlayFileV0): PlayFileV1 {
  return {
    schemaVersion: 1,
    id: v0.id,
    createdAt: v0.createdAt,
    updatedAt: v0.updatedAt,
    name: v0.name,
    category: v0.category,
    notes: '',
    attackingTeam: v0.attacking,
    field: { ...v0.field, view: { kind: 'full' } },
    entities: v0.entities.map((entity) =>
      entity.kind === 'player' ? { ...entity, defenseMode: 'manual' as const } : entity,
    ),
    setup: v0.setup,
    phases: v0.phases.map((phase) => ({
      ...phase,
      instruction: '',
      actions: phase.actions.map((action) =>
        action.type === 'run'
          ? {
              id: action.id,
              type: action.type,
              entityId: action.entityId,
              waypoints: action.waypoints,
              pace: action.speed,
              delay: action.delay,
            }
          : action,
      ),
    })),
  }
}

/** Lot 3 (D-094): version 2 only adds kicks and breakdowns; the content is unchanged. */
function migrateV1toV2(v1: PlayFileV1): PlayFileV2 {
  return { ...v1, schemaVersion: 2 }
}

type PhaseV2 = PlayFileV2['phases'][number]
type RunV2 = Extract<PhaseV2['actions'][number], { type: 'run' }>

/** First run of an entity in a phase: the one the engine applies (D-013). */
function firstRunOf(phase: PhaseV2, entityId: string): RunV2 | undefined {
  for (const action of phase.actions) {
    if (action.type === 'run' && action.entityId === entityId) return action
  }
  return undefined
}

/**
 * Lot 3 bis (D-104): content unchanged, plus « Finit lancée » on every run that every option of
 * the next phase prolongs (same player, her first run of the phase, delay 0), so that existing
 * plays do not stop at phase boundaries. Structural rule, without the engine.
 */
function migrateV2toV3(v2: PlayFileV2): PlayFileV3 {
  const prolonged = new Set<string>()
  for (const phase of v2.phases) {
    const children = v2.phases.filter((child) => child.parentId === phase.id)
    if (children.length === 0) continue
    for (const action of phase.actions) {
      if (action.type !== 'run' || firstRunOf(phase, action.entityId) !== action) continue
      const continued = children.every((child) => firstRunOf(child, action.entityId)?.delay === 0)
      if (continued) prolonged.add(action.id)
    }
  }
  return {
    ...v2,
    schemaVersion: 3,
    phases: v2.phases.map((phase) => ({
      ...phase,
      actions: phase.actions.map((action) =>
        action.type === 'run' && prolonged.has(action.id)
          ? { ...action, endsAtSpeed: true as const }
          : action,
      ),
    })),
  }
}

const STEPS: readonly MigrationStep[] = [
  { from: 0, schema: playSchemaV0, migrate: migrateV0toV1 },
  { from: 1, schema: playSchemaV1, migrate: migrateV1toV2 },
  { from: 2, schema: playSchemaV2, migrate: migrateV2toV3 },
]

export function toSchemaIssues(error: z.ZodError): SchemaIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((part) => String(part)).join('.'),
    message: issue.message,
  }))
}

/** Integer `schemaVersion` of raw file data, refused when above `current` (DECISIONS Q24). */
export function readSchemaVersion(
  raw: unknown,
  current: number,
): { ok: true; version: number } | { ok: false; error: UpgradeError } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: { code: 'notAnObject' } }
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return { ok: false, error: { code: 'missingVersion' } }
  }
  if (version > current) return { ok: false, error: { code: 'futureVersion', version } }
  return { ok: true, version }
}

/** Validates and migrates raw file data (already parsed from JSON) to the current Play. */
export function upgradePlay(raw: unknown): UpgradeResult {
  const read = readSchemaVersion(raw, CURRENT_SCHEMA_VERSION)
  if (!read.ok) return read
  const version = read.version
  let data: unknown = raw
  for (let v = version; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = STEPS.find((candidate) => candidate.from === v)
    if (!step) return { ok: false, error: { code: 'unknownVersion', version } }
    const parsed = step.schema.safeParse(data)
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: 'invalid', version: v, issues: toSchemaIssues(parsed.error) },
      }
    }
    data = step.migrate(parsed.data as never)
  }
  const current = playSchemaV3.safeParse(data)
  if (!current.success) {
    return {
      ok: false,
      error: {
        code: 'invalid',
        version: CURRENT_SCHEMA_VERSION,
        issues: toSchemaIssues(current.error),
      },
    }
  }
  return { ok: true, play: current.data, fromVersion: version }
}
