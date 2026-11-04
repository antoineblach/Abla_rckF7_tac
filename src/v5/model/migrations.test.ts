import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { basePlay, friseFixturePlay, uuid } from '../test/builders'
import { CURRENT_SCHEMA_VERSION, readSchemaVersion, upgradePlay } from './migrations'

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../test/fixtures/${name}`, import.meta.url), 'utf8'))

/** Files of the earlier versions, written here: their fixtures disappear with the switch to v5. */
const OBSOLETE_FILES: Record<number, () => Record<string, unknown>> = {
  0: () => ({
    schemaVersion: 0,
    id: uuid(1),
    name: 'Version 0',
    attacking: 'A',
    phases: [],
  }),
  1: () => ({ ...v4File(), schemaVersion: 1 }),
  2: () => ({ ...v4File(), schemaVersion: 2 }),
  3: () => ({ ...v4File(), schemaVersion: 3 }),
  4: v4File,
}

function v4File(): Record<string, unknown> {
  const { branches: _branches, actions: _actions, sequences: _sequences, ...common } = basePlay()
  return {
    ...common,
    schemaVersion: 4,
    phases: [
      {
        id: uuid(100),
        parentId: null,
        label: '',
        condition: '',
        instruction: '',
        isDefault: false,
        actions: [],
      },
    ],
  }
}

describe('reading a play (SPEC 4.4, 4.5)', () => {
  it('is at version 5', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(5)
  })

  it('reads the frozen v5 fixture without changing it', () => {
    expect(upgradePlay(fixture('play-v5-frise.json'))).toEqual({
      ok: true,
      play: friseFixturePlay(),
      fromVersion: 5,
    })
  })

  it('leaves a current play unchanged', () => {
    const play = basePlay()
    expect(upgradePlay(play)).toEqual({ ok: true, play, fromVersion: 5 })
  })

  it('refuses every version below 5, never migrated (D-139)', () => {
    for (const [version, file] of Object.entries(OBSOLETE_FILES)) {
      expect(upgradePlay(file())).toEqual({
        ok: false,
        error: { code: 'obsoleteVersion', version: Number(version) },
      })
    }
    expect(upgradePlay({ schemaVersion: -1 })).toEqual({
      ok: false,
      error: { code: 'obsoleteVersion', version: -1 },
    })
  })

  it('refuses an old version whatever its content, even an otherwise valid v5 body', () => {
    expect(upgradePlay({ ...basePlay(), schemaVersion: 4 })).toEqual({
      ok: false,
      error: { code: 'obsoleteVersion', version: 4 },
    })
  })

  it('does not modify its input', () => {
    for (const file of [...Object.values(OBSOLETE_FILES).map((make) => make()), basePlay()]) {
      const copy = JSON.stringify(file)
      upgradePlay(file)
      expect(JSON.stringify(file)).toBe(copy)
    }
  })

  it('refuses a file from a newer version (DECISIONS Q24)', () => {
    expect(upgradePlay({ ...basePlay(), schemaVersion: 6 })).toEqual({
      ok: false,
      error: { code: 'futureVersion', version: 6 },
    })
  })

  it('refuses data without version', () => {
    expect(upgradePlay({ name: 'x' })).toEqual({ ok: false, error: { code: 'missingVersion' } })
    expect(upgradePlay({ schemaVersion: '5' })).toEqual({
      ok: false,
      error: { code: 'missingVersion' },
    })
    expect(upgradePlay({ schemaVersion: 4.5 })).toEqual({
      ok: false,
      error: { code: 'missingVersion' },
    })
    expect(upgradePlay([])).toEqual({ ok: false, error: { code: 'notAnObject' } })
    expect(upgradePlay(null)).toEqual({ ok: false, error: { code: 'notAnObject' } })
  })

  it('reports an invalid v5 file with the path of the error', () => {
    const result = upgradePlay({ ...basePlay(), branches: 'aucune' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatchObject({
      code: 'invalid',
      version: 5,
      issues: [{ path: 'branches' }],
    })
  })

  it('keeps readSchemaVersion neutral: presets and settings keep their own versions', () => {
    expect(readSchemaVersion({ schemaVersion: 1 }, 4)).toEqual({ ok: true, version: 1 })
    expect(readSchemaVersion({ schemaVersion: 5 }, 4)).toEqual({
      ok: false,
      error: { code: 'futureVersion', version: 5 },
    })
  })
})
