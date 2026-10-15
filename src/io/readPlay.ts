// Reading a play file: JSON, then zod validation and successive migrations, then business
// validation (SPEC 4.4). Never modifies anything.
import type { Issue } from '../model/issues'
import { upgradePlay, type UpgradeError } from '../model/migrations'
import type { Play } from '../model/types'
import { validatePlay } from '../model/validate'
import { parseJson } from './serialize'

export type ReadError = { code: 'json'; message: string } | UpgradeError

export type ReadPlayResult =
  { ok: true; play: Play; fromVersion: number; issues: Issue[] } | { ok: false; error: ReadError }

export function readPlayData(data: unknown): ReadPlayResult {
  const upgraded = upgradePlay(data)
  if (!upgraded.ok) return { ok: false, error: upgraded.error }
  return {
    ok: true,
    play: upgraded.play,
    fromVersion: upgraded.fromVersion,
    issues: validatePlay(upgraded.play),
  }
}

export function readPlayText(text: string): ReadPlayResult {
  const parsed = parseJson(text)
  if (!parsed.ok) return { ok: false, error: { code: 'json', message: parsed.message } }
  return readPlayData(parsed.value)
}
