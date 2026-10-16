import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { basePlay, kick, P, sevenVsSevenWithOptions, uuid } from '../test/builders'
import { CURRENT_SCHEMA_VERSION, upgradePlay } from './migrations'

const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url), 'utf8')) as Record<
    string,
    unknown
  >

const v0 = (): Record<string, unknown> => fixture('play-v0.json')

describe('migrations', () => {
  it('migrates the files of lots 1 and 2 (version 1) to version 2 without changing them', () => {
    const input = fixture('play-v1-7v7-options.json')
    const result = upgradePlay(input)
    expect(result).toEqual({ ok: true, play: sevenVsSevenWithOptions(), fromVersion: 1 })
    expect(CURRENT_SCHEMA_VERSION).toBe(2)
    expect(input.schemaVersion).toBe(1)
  })

  it('reports a version 1 file holding a kick against the version 1 schema', () => {
    const play = sevenVsSevenWithOptions()
    const first = play.phases[0]
    if (!first) throw new Error('no phase')
    const input = {
      ...play,
      schemaVersion: 1,
      phases: [{ ...first, actions: [kick(uuid(1), P.A(4), { point: { x: 60, y: 30 } }, 0)] }],
    }
    const result = upgradePlay(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatchObject({ code: 'invalid', version: 1 })
  })

  it('migrates the fictitious version 0 fixture up to the current version', () => {
    const result = upgradePlay(v0())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const play = result.play
    expect(result.fromVersion).toBe(0)
    expect(play.schemaVersion).toBe(2)
    expect(play.attackingTeam).toBe('B')
    expect(play.notes).toBe('')
    expect(play.field.view).toEqual({ kind: 'full' })
    expect(play.phases[0]?.instruction).toBe('')
    expect(play.entities[0]).toMatchObject({ kind: 'player', defenseMode: 'manual' })
    expect(play.phases[0]?.actions[0]).toEqual({
      id: '00000000-0000-4000-8000-000000000200',
      type: 'run',
      entityId: '00000000-0000-4000-8000-000000000011',
      waypoints: [{ x: 40, y: 30 }],
      pace: 'sprint',
      delay: 0.5,
    })
    expect(play.updatedAt).toBe('2025-01-02T10:00:00.000Z')
  })

  it('does not modify its input', () => {
    const input = v0()
    const copy = JSON.stringify(input)
    upgradePlay(input)
    expect(JSON.stringify(input)).toBe(copy)
  })

  it('leaves a current play unchanged', () => {
    const play = basePlay()
    const result = upgradePlay(play)
    expect(result).toEqual({ ok: true, play, fromVersion: CURRENT_SCHEMA_VERSION })
  })

  it('reports an invalid version 0 file against the version 0 schema', () => {
    const input = { ...v0(), attacking: 'C' }
    const result = upgradePlay(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatchObject({ code: 'invalid', version: 0 })
  })

  it('refuses a file from a newer version (DECISIONS Q24)', () => {
    expect(upgradePlay({ ...basePlay(), schemaVersion: 3 })).toEqual({
      ok: false,
      error: { code: 'futureVersion', version: 3 },
    })
  })

  it('refuses data without version or of an unknown version', () => {
    expect(upgradePlay({ name: 'x' })).toEqual({ ok: false, error: { code: 'missingVersion' } })
    expect(upgradePlay([])).toEqual({ ok: false, error: { code: 'notAnObject' } })
    expect(upgradePlay({ schemaVersion: -1 })).toEqual({
      ok: false,
      error: { code: 'unknownVersion', version: -1 },
    })
  })
})
