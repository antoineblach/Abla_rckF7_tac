// Reading of a play at the current schema version (SPEC 4.4, 4.5). Version 5 has no migration: an
// earlier file is refused, never migrated (D-139). Later versions add their steps from version 5.
import type { z } from 'zod'
import { playSchemaV5 } from './schema'
import type { Play } from './types'

export const CURRENT_SCHEMA_VERSION = 5

/** Versions below it are refused (D-139). */
const FIRST_READABLE_VERSION = 5

export interface SchemaIssue {
  path: string
  message: string
}

export type UpgradeError =
  | { code: 'notAnObject' }
  | { code: 'missingVersion' }
  | { code: 'futureVersion'; version: number }
  | { code: 'unknownVersion'; version: number }
  | { code: 'obsoleteVersion'; version: number }
  | { code: 'invalid'; version: number; issues: SchemaIssue[] }

export type UpgradeResult =
  { ok: true; play: Play; fromVersion: number } | { ok: false; error: UpgradeError }

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

/** Validates raw file data (already parsed from JSON); a version below 5 is refused (D-139). */
export function upgradePlay(raw: unknown): UpgradeResult {
  const read = readSchemaVersion(raw, CURRENT_SCHEMA_VERSION)
  if (!read.ok) return read
  const version = read.version
  if (version < FIRST_READABLE_VERSION) {
    return { ok: false, error: { code: 'obsoleteVersion', version } }
  }
  const current = playSchemaV5.safeParse(raw)
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
