import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { basePlay, fourVsTwoNoBall, sevenVsSevenWithOptions, uuid } from '../test/builders'
import { canonicalJson } from './canonical'
import { playSchemaV1 } from './schema'

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url), 'utf8'))

describe('schema v1', () => {
  it('accepts valid plays', () => {
    for (const play of [basePlay(), sevenVsSevenWithOptions(), fourVsTwoNoBall()]) {
      expect(playSchemaV1.safeParse(play).success).toBe(true)
    }
  })

  it('accepts the frozen v1 fixture, identical to the builder', () => {
    const data = fixture('play-v1-7v7-options.json')
    expect(playSchemaV1.safeParse(data).success).toBe(true)
    expect(canonicalJson(data)).toBe(canonicalJson(sevenVsSevenWithOptions()))
  })

  it('reports the path of an error', () => {
    const play = sevenVsSevenWithOptions() as unknown as {
      phases: { actions: { pace?: string }[] }[]
    }
    const action = play.phases[0]?.actions[0]
    if (action) action.pace = 'gallop'
    const result = playSchemaV1.safeParse(play)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path.join('.')).toBe('phases.0.actions.0.pace')
  })

  it('rejects unknown keys (DECISIONS Q24)', () => {
    expect(playSchemaV1.safeParse({ ...basePlay(), extra: true }).success).toBe(false)
  })

  it('rejects types of lots 3 to 5 (DECISIONS Q4)', () => {
    const kick = {
      id: uuid(1),
      type: 'kick',
      kickerId: uuid(2),
      kind: 'long',
      target: { point: { x: 1, y: 1 } },
      delay: 0,
    }
    const play = basePlay()
    const withKick = { ...play, phases: [{ ...play.phases[0], actions: [kick] }] }
    expect(playSchemaV1.safeParse(withKick).success).toBe(false)
    const withDefense = { ...play, defenseSettings: { system: '7' } }
    expect(playSchemaV1.safeParse(withDefense).success).toBe(false)
    const cone = {
      id: uuid(3),
      kind: 'equipment',
      type: 'cone',
      color: '#ffffff',
      position: { x: 0, y: 0 },
    }
    expect(playSchemaV1.safeParse({ ...play, entities: [cone] }).success).toBe(false)
  })

  it('rejects non-UUID identifiers and infinite numbers', () => {
    expect(playSchemaV1.safeParse({ ...basePlay(), id: 'a/b' }).success).toBe(false)
    const play = basePlay({
      field: { length: Infinity, width: 70, inGoal: 10, view: { kind: 'full' } },
    })
    expect(playSchemaV1.safeParse(play).success).toBe(false)
  })
})
