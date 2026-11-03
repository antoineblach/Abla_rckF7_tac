// Frozen version 3 of the file format (lot 3 bis), kept to validate files before their migration to
// version 4 (SPEC 4.5, D-133). It differs from version 4 only by the pace of its runs (a named pace,
// no typed speed). The shared building blocks of schema.ts are reused while they are identical in
// both versions; a later change to one of them must first be copied here.
import { z } from 'zod'
import {
  breakdownSchema,
  categorySchema,
  entitySchema,
  fieldSchema,
  idSchema,
  isoDateSchema,
  kickSchema,
  paceSchema,
  passSchema,
  runSyncSchema,
  setupSchema,
  teamSchema,
  waypointSchema,
} from './schema'

/** Run of version 3. */
export const runSchemaV3 = z.strictObject({
  id: idSchema,
  type: z.literal('run'),
  entityId: idSchema,
  waypoints: z.array(waypointSchema).min(1),
  pace: paceSchema,
  durationOverride: z.number().positive().optional(),
  delay: z.number().nonnegative(),
  endsAtSpeed: z.literal(true).optional(),
  sync: runSyncSchema.optional(),
})

const actionSchemaV3 = z.discriminatedUnion('type', [
  runSchemaV3,
  passSchema,
  kickSchema,
  breakdownSchema,
])

const phaseSchemaV3 = z.strictObject({
  id: idSchema,
  parentId: idSchema.nullable(),
  label: z.string(),
  condition: z.string(),
  instruction: z.string(),
  isDefault: z.boolean(),
  actions: z.array(actionSchemaV3),
})

export const playSchemaV3 = z.strictObject({
  schemaVersion: z.literal(3),
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
  phases: z.array(phaseSchemaV3),
})

export type PlayFileV3 = z.infer<typeof playSchemaV3>
