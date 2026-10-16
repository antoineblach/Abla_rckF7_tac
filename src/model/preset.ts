// Placement presets (SPEC 10.1, D-087 to D-089): file format version 1 and versioned reading.
// Positions are stored by role and number in a local frame: `forward` along the attack direction
// of the attacking team, `openSide` towards the open side (towards the field for a lineout).
import { z } from 'zod'
import { readSchemaVersion, toSchemaIssues, type UpgradeError } from './migrations'
import { idSchema, isoDateSchema } from './schema'
import type { Id } from './types'

export type PresetType = 'scrum' | 'lineout' | 'restart' | 'ruck' | 'free'

export const PRESET_TYPES: readonly PresetType[] = ['scrum', 'lineout', 'restart', 'ruck', 'free']

/** Attack = the attacking team of the play, defence = the other one (SPEC 10.1). */
export type PresetRole = 'attack' | 'defense'

export interface PresetPosition {
  role: PresetRole
  number: number
  forward: number
  openSide: number
}

export interface PresetBall {
  forward: number
  openSide: number
  carrierRole?: PresetRole
  carrierNumber?: number
}

export interface PlacementPreset {
  schemaVersion: 1
  id: Id
  name: string
  type: PresetType
  positions: PresetPosition[]
  ball: PresetBall | null
  createdAt: string
  updatedAt: string
}

export const CURRENT_PRESET_VERSION = 1

const roleSchema = z.enum(['attack', 'defense'])
const numberSchema = z.number().int().min(0).max(999)

const presetBallSchema = z
  .strictObject({
    forward: z.number(),
    openSide: z.number(),
    carrierRole: roleSchema.optional(),
    carrierNumber: numberSchema.optional(),
  })
  .refine((ball) => (ball.carrierRole === undefined) === (ball.carrierNumber === undefined), {
    message: 'carrierRole and carrierNumber go together',
  })

export const presetSchemaV1 = z.strictObject({
  schemaVersion: z.literal(1),
  id: idSchema,
  name: z.string(),
  type: z.enum(['scrum', 'lineout', 'restart', 'ruck', 'free']),
  positions: z.array(
    z.strictObject({
      role: roleSchema,
      number: numberSchema,
      forward: z.number(),
      openSide: z.number(),
    }),
  ),
  ball: presetBallSchema.nullable(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

export type PresetFileV1 = z.infer<typeof presetSchemaV1>

// Compile-time check: every valid v1 file is a PlacementPreset.
export const asPreset = (file: PresetFileV1): PlacementPreset => file

export type PresetUpgradeResult =
  { ok: true; preset: PlacementPreset; fromVersion: number } | { ok: false; error: UpgradeError }

/** Validates raw file data (already parsed from JSON); a newer version is refused (D-024). */
export function upgradePreset(raw: unknown): PresetUpgradeResult {
  const read = readSchemaVersion(raw, CURRENT_PRESET_VERSION)
  if (!read.ok) return read
  if (read.version !== CURRENT_PRESET_VERSION) {
    return { ok: false, error: { code: 'unknownVersion', version: read.version } }
  }
  const parsed = presetSchemaV1.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'invalid', version: read.version, issues: toSchemaIssues(parsed.error) },
    }
  }
  return { ok: true, preset: parsed.data, fromVersion: read.version }
}
