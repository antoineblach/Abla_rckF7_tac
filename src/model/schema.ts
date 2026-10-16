// zod schemas of the file format, schemaVersion 2 (SPEC 4.1, 4.4; lot 3: kicks and breakdowns,
// D-094). Objects are strict: an unknown key makes the file invalid, so that it is never
// rewritten without that key (DECISIONS Q24). Types of lots 4 and 5 are rejected (DECISIONS Q4).
// The frozen version 1 is in schemaV1.ts.
import { z } from 'zod'
import type { Play } from './types'

export const idSchema = z.uuid()
export const vec2Schema = z.strictObject({ x: z.number(), y: z.number() })
export const teamSchema = z.enum(['A', 'B'])
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)
export const isoDateSchema = z.iso.datetime({ offset: true })
export const paceSchema = z.enum(['walk', 'jog', 'sprint'])
export const categorySchema = z.enum(['scrum', 'lineout', 'restart', 'phasePlay', 'drill'])

export const fieldViewSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('full') }),
  z.strictObject({ kind: z.literal('half'), side: z.enum(['attack', 'defense']) }),
  z.strictObject({ kind: z.literal('frame'), min: vec2Schema, max: vec2Schema }),
])

export const fieldSchema = z.strictObject({
  length: z.number().positive(),
  width: z.number().positive(),
  inGoal: z.number().nonnegative(),
  view: fieldViewSchema,
})

const playerSchema = z.strictObject({
  id: idSchema,
  kind: z.literal('player'),
  team: teamSchema,
  number: z.number().int().min(0).max(999),
  color: colorSchema,
  defenseMode: z.enum(['manual', 'auto']),
})

const ballSchema = z.strictObject({ id: idSchema, kind: z.literal('ball') })

export const entitySchema = z.discriminatedUnion('kind', [playerSchema, ballSchema])

export const runSchema = z.strictObject({
  id: idSchema,
  type: z.literal('run'),
  entityId: idSchema,
  waypoints: z.array(vec2Schema).min(1),
  pace: paceSchema,
  durationOverride: z.number().positive().optional(),
  delay: z.number().nonnegative(),
})

export const passSchema = z.strictObject({
  id: idSchema,
  type: z.literal('pass'),
  fromId: idSchema,
  toId: idSchema,
  delay: z.number().nonnegative(),
  ballSpeed: z.number().positive().optional(),
})

const kickSchema = z.strictObject({
  id: idSchema,
  type: z.literal('kick'),
  kickerId: idSchema,
  kind: z.enum(['restart', 'long']),
  target: z.union([
    z.strictObject({ receiverId: idSchema }),
    z.strictObject({ point: vec2Schema }),
  ]),
  delay: z.number().nonnegative(),
  flightTime: z.number().positive().optional(),
})

const breakdownSchema = z.strictObject({
  id: idSchema,
  type: z.literal('breakdown'),
  kind: z.enum(['ruck', 'maul']),
  tackledId: idSchema,
  supportId: idSchema,
  relayerId: idSchema,
  delay: z.number().nonnegative(),
  duration: z.number().positive(),
  contest: z.enum(['guard', 'jackal']).optional(),
})

export const actionSchema = z.discriminatedUnion('type', [
  runSchema,
  passSchema,
  kickSchema,
  breakdownSchema,
])

export const phaseSchema = z.strictObject({
  id: idSchema,
  parentId: idSchema.nullable(),
  label: z.string(),
  condition: z.string(),
  instruction: z.string(),
  isDefault: z.boolean(),
  actions: z.array(actionSchema),
})

export const setupSchema = z.strictObject({
  positions: z.record(idSchema, vec2Schema),
  ballCarrierId: idSchema.nullable(),
  ballPosition: vec2Schema.nullable(),
})

export const playSchemaV2 = z.strictObject({
  schemaVersion: z.literal(2),
  id: idSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  name: z.string(),
  category: categorySchema,
  notes: z.string(),
  attackingTeam: teamSchema,
  field: fieldSchema,
  entities: z.array(entitySchema),
  setup: setupSchema,
  phases: z.array(phaseSchema),
})

export type PlayFileV2 = z.infer<typeof playSchemaV2>

// Compile-time check: every valid v2 file is a Play.
export const asPlay = (file: PlayFileV2): Play => file
