// Reading a placement preset file (SPEC 10.1, D-092): JSON, then versioned zod validation.
// Never modifies anything.
import { upgradePreset, type PlacementPreset } from '../model/preset'
import type { ReadError } from './readPlay'
import { parseJson } from './serialize'

export type ReadPresetResult =
  { ok: true; preset: PlacementPreset } | { ok: false; error: ReadError }

export function readPresetText(text: string): ReadPresetResult {
  const parsed = parseJson(text)
  if (!parsed.ok) return { ok: false, error: { code: 'json', message: parsed.message } }
  const upgraded = upgradePreset(parsed.value)
  return upgraded.ok ? { ok: true, preset: upgraded.preset } : { ok: false, error: upgraded.error }
}
