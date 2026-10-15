// Fictitious version 0 of the file format, provided to exercise the migration mechanism
// from lot 1 (SPEC 4.5). It differs from v1 by: `attacking` instead of `attackingTeam`,
// no `notes`, no field `view`, no phase `instruction`, no player `defenseMode`,
// and `speed` instead of `pace` on runs.
import { z } from 'zod'
import {
  categorySchema,
  colorSchema,
  idSchema,
  isoDateSchema,
  paceSchema,
  teamSchema,
  vec2Schema,
} from './schema'

const playerSchemaV0 = z.strictObject({
  id: idSchema,
  kind: z.literal('player'),
  team: teamSchema,
  number: z.number().int().min(0).max(999),
  color: colorSchema,
})

const entitySchemaV0 = z.discriminatedUnion('kind', [
  playerSchemaV0,
  z.strictObject({ id: idSchema, kind: z.literal('ball') }),
])

const actionSchemaV0 = z.discriminatedUnion('type', [
  z.strictObject({
    id: idSchema,
    type: z.literal('run'),
    entityId: idSchema,
    waypoints: z.array(vec2Schema).min(1),
    speed: paceSchema,
    delay: z.number().nonnegative(),
  }),
  z.strictObject({
    id: idSchema,
    type: z.literal('pass'),
    fromId: idSchema,
    toId: idSchema,
    delay: z.number().nonnegative(),
  }),
])

export const playSchemaV0 = z.strictObject({
  schemaVersion: z.literal(0),
  id: idSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  name: z.string(),
  category: categorySchema,
  attacking: teamSchema,
  field: z.strictObject({
    length: z.number().positive(),
    width: z.number().positive(),
    inGoal: z.number().nonnegative(),
  }),
  entities: z.array(entitySchemaV0),
  setup: z.strictObject({
    positions: z.record(idSchema, vec2Schema),
    ballCarrierId: idSchema.nullable(),
    ballPosition: vec2Schema.nullable(),
  }),
  phases: z.array(
    z.strictObject({
      id: idSchema,
      parentId: idSchema.nullable(),
      label: z.string(),
      condition: z.string(),
      isDefault: z.boolean(),
      actions: z.array(actionSchemaV0),
    }),
  ),
})

export type PlayFileV0 = z.infer<typeof playSchemaV0>
