// Frozen version 2 of the file format (lot 3), kept to validate files before their migration to
// version 3 (SPEC 4.5, D-104). It differs from version 3 by its runs (plain waypoints, no
// « finit lancée », no synchronisation link) and by its passes and kicks (fixed release only).
// The shared building blocks of schema.ts are reused while they are identical in both versions;
// a later change to one of them must first be copied here.
import { z } from 'zod'
import {
  breakdownSchema,
  categorySchema,
  entitySchema,
  fieldSchema,
  idSchema,
  isoDateSchema,
  paceSchema,
  setupSchema,
  teamSchema,
  vec2Schema,
} from './schema'

/** Run of versions 1 and 2. */
export const runSchemaV2 = z.strictObject({
  id: idSchema,
  type: z.literal('run'),
  entityId: idSchema,
  waypoints: z.array(vec2Schema).min(1),
  pace: paceSchema,
  durationOverride: z.number().positive().optional(),
  delay: z.number().nonnegative(),
})

/** Pass of versions 1 and 2. */
export const passSchemaV2 = z.strictObject({
  id: idSchema,
  type: z.literal('pass'),
  fromId: idSchema,
  toId: idSchema,
  delay: z.number().nonnegative(),
  ballSpeed: z.number().positive().optional(),
})

const kickSchemaV2 = z.strictObject({
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

const actionSchemaV2 = z.discriminatedUnion('type', [
  runSchemaV2,
  passSchemaV2,
  kickSchemaV2,
  breakdownSchema,
])

const phaseSchemaV2 = z.strictObject({
  id: idSchema,
  parentId: idSchema.nullable(),
  label: z.string(),
  condition: z.string(),
  instruction: z.string(),
  isDefault: z.boolean(),
  actions: z.array(actionSchemaV2),
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
  phases: z.array(phaseSchemaV2),
})

export type PlayFileV2 = z.infer<typeof playSchemaV2>
