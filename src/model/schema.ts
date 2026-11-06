// zod schemas of the file format, schemaVersion 5 (SPEC 4.1, 4.4, D-139). Objects are strict: an
// unknown key makes the file invalid, so that it is never rewritten without that key (DECISIONS
// Q24). Types of lots 4 and 5 are rejected (DECISIONS Q4). Earlier versions are refused (4.4).
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

/** A named pace, or a speed in m/s (D-114, D-133). */
export const speedValueSchema = z.union([paceSchema, z.number().positive()])

/** Speed of a segment. */
export const segmentSpeedSchema = speedValueSchema

export const waypointSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  speed: segmentSpeedSchema.optional(),
})

const instantSchema = z.number().nonnegative()

const glueShape = {
  targetId: idSchema,
  event: z.union([
    z.enum(['start', 'end']),
    z.strictObject({ point: z.number().int().nonnegative() }),
  ]),
  offset: z.number().nonnegative().optional(),
}

export const glueRefSchema = z.strictObject(glueShape)

export const endGlueSchema = z.strictObject({
  ...glueShape,
  keep: z.enum(['start', 'duration']),
})

/** Fields common to all actions and to the sequences. */
const timedShape = {
  id: idSchema,
  branchId: idSchema,
  start: instantSchema,
  startGlue: glueRefSchema.optional(),
  endGlue: endGlueSchema.optional(),
}

export const runSchema = z.strictObject({
  ...timedShape,
  type: z.literal('run'),
  entityId: idSchema,
  waypoints: z.array(waypointSchema).min(1),
  pace: speedValueSchema,
  durationOverride: z.number().positive().optional(),
})

export const passSchema = z.strictObject({
  ...timedShape,
  type: z.literal('pass'),
  fromId: idSchema,
  toId: idSchema,
  ballSpeed: z.number().positive().optional(),
})

export const kickSchema = z.strictObject({
  ...timedShape,
  type: z.literal('kick'),
  kickerId: idSchema,
  kind: z.enum(['restart', 'long']),
  target: z.union([
    z.strictObject({ receiverId: idSchema }),
    z.strictObject({ point: vec2Schema }),
  ]),
  flightTime: z.number().positive().optional(),
})

export const breakdownSchema = z.strictObject({
  ...timedShape,
  type: z.literal('breakdown'),
  kind: z.enum(['ruck', 'maul']),
  tackledId: idSchema,
  supportId: idSchema,
  relayerId: idSchema,
  duration: z.number().positive(),
  contest: z.enum(['guard', 'jackal']).optional(),
})

export const actionSchema = z.discriminatedUnion('type', [
  runSchema,
  passSchema,
  kickSchema,
  breakdownSchema,
])

export const sequenceSchema = z.strictObject({
  ...timedShape,
  end: instantSchema,
  label: z.string(),
  instruction: z.string(),
})

export const branchSchema = z.strictObject({
  id: idSchema,
  parentId: idSchema.nullable(),
  branchAt: instantSchema.optional(),
  branchAtGlue: glueRefSchema.optional(),
  label: z.string(),
  condition: z.string(),
  isDefault: z.boolean(),
})

export const setupSchema = z.strictObject({
  positions: z.record(idSchema, vec2Schema),
  ballCarrierId: idSchema.nullable(),
  ballPosition: vec2Schema.nullable(),
})

export const playSchemaV5 = z.strictObject({
  schemaVersion: z.literal(5),
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
  branches: z.array(branchSchema),
  actions: z.array(actionSchema),
  sequences: z.array(sequenceSchema),
})

export type PlayFileV5 = z.infer<typeof playSchemaV5>

// Compile-time check: every valid v5 file is a Play.
export const asPlay = (file: PlayFileV5): Play => file
