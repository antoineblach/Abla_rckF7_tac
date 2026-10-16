// Frozen version 1 of the file format (lots 1 and 2), kept to validate files before their
// migration to version 2 (SPEC 4.5, D-094). It differs from version 2 only by its actions: runs
// and passes. The shared building blocks of schema.ts are reused while they are identical in
// both versions; a later change to one of them must first be copied here.
import { z } from 'zod'
import {
  categorySchema,
  entitySchema,
  fieldSchema,
  idSchema,
  isoDateSchema,
  passSchema,
  runSchema,
  setupSchema,
  teamSchema,
} from './schema'

const actionSchemaV1 = z.discriminatedUnion('type', [runSchema, passSchema])

const phaseSchemaV1 = z.strictObject({
  id: idSchema,
  parentId: idSchema.nullable(),
  label: z.string(),
  condition: z.string(),
  instruction: z.string(),
  isDefault: z.boolean(),
  actions: z.array(actionSchemaV1),
})

export const playSchemaV1 = z.strictObject({
  schemaVersion: z.literal(1),
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
  phases: z.array(phaseSchemaV1),
})

export type PlayFileV1 = z.infer<typeof playSchemaV1>
