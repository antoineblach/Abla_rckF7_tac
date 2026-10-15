// Successive migrations up to the current schema version (SPEC 4.4, 4.5).
// Each step validates the data against the schema of its own version, then migrates it;
// the result is finally validated against the current schema.
import type { z } from 'zod'
import { playSchemaV1, type PlayFileV1 } from './schema'
import { playSchemaV0, type PlayFileV0 } from './schemaV0'
import type { Play } from './types'

export const CURRENT_SCHEMA_VERSION = 1

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

const STEPS: readonly MigrationStep[] = [{ from: 0, schema: playSchemaV0, migrate: migrateV0toV1 }]

function toSchemaIssues(error: z.ZodError): SchemaIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((part) => String(part)).join('.'),
    message: issue.message,
  }))
}

/** Validates and migrates raw file data (already parsed from JSON) to the current Play. */
export function upgradePlay(raw: unknown): UpgradeResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: { code: 'notAnObject' } }
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return { ok: false, error: { code: 'missingVersion' } }
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    return { ok: false, error: { code: 'futureVersion', version } }
  }
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
  const current = playSchemaV1.safeParse(data)
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
