import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  basePlay,
  kick,
  P,
  phase,
  run,
  setPiecesPlay,
  sevenVsSevenWithOptions,
  uuid,
} from '../test/builders'
import { CURRENT_SCHEMA_VERSION, upgradePlay } from './migrations'

const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url), 'utf8')) as Record<
    string,
    unknown
  >

const v0 = (): Record<string, unknown> => fixture('play-v0.json')

describe('migrations', () => {
  it('migrates the files of lots 1 and 2 (version 1) to version 3 without changing them', () => {
    const input = fixture('play-v1-7v7-options.json')
    const result = upgradePlay(input)
    expect(result).toEqual({ ok: true, play: sevenVsSevenWithOptions(), fromVersion: 1 })
    expect(CURRENT_SCHEMA_VERSION).toBe(3)
    expect(input.schemaVersion).toBe(1)
  })

  it('migrates the frozen lot 3 fixture (version 2) to version 3 without changing it', () => {
    const input = fixture('play-v2-lot3.json')
    expect(input.schemaVersion).toBe(2)
    expect(upgradePlay(input)).toEqual({ ok: true, play: setPiecesPlay(), fromVersion: 2 })
  })

  it('marks « Finit lancée » the runs that every option of the next phase prolongs (D-104)', () => {
    const v2 = {
      ...basePlay(),
      schemaVersion: 2,
      phases: [
        phase(uuid(1), null, [
          run(uuid(10), P.A(1), [{ x: 1, y: 1 }]),
          run(uuid(11), P.A(2), [{ x: 2, y: 2 }]),
          run(uuid(12), P.A(3), [{ x: 3, y: 3 }]),
          // A second run of A1 is not applied (D-013): never marked.
          run(uuid(13), P.A(1), [{ x: 4, y: 4 }]),
        ]),
        phase(uuid(2), uuid(1), [
          run(uuid(20), P.A(1), [{ x: 5, y: 5 }]),
          run(uuid(21), P.A(2), [{ x: 5, y: 5 }]),
          run(uuid(22), P.A(3), [{ x: 5, y: 5 }], { delay: 0.5 }),
          run(uuid(23), P.A(4), [{ x: 5, y: 5 }]),
        ]),
        phase(
          uuid(3),
          uuid(1),
          [
            // The first run of A1 starts at once: A1 is prolonged in both options.
            run(uuid(30), P.A(1), [{ x: 6, y: 6 }]),
            run(uuid(31), P.A(1), [{ x: 7, y: 7 }], { delay: 1 }),
            // A2 waits in this option: not prolonged.
            run(uuid(32), P.A(2), [{ x: 6, y: 6 }], { delay: 0.1 }),
          ],
          { isDefault: true },
        ),
      ],
    }
    const result = upgradePlay(v2)
    if (!result.ok) throw new Error('migration refused')
    const marked = result.play.phases
      .flatMap((p) => p.actions)
      .filter((a) => a.type === 'run' && a.endsAtSpeed === true)
      .map((a) => a.id)
    // Leaves (phases 2 and 3) are never marked.
    expect(marked).toEqual([uuid(10)])
    expect(result.play.schemaVersion).toBe(3)
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
    expect(play.schemaVersion).toBe(3)
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
    expect(upgradePlay({ ...basePlay(), schemaVersion: 4 })).toEqual({
      ok: false,
      error: { code: 'futureVersion', version: 4 },
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
