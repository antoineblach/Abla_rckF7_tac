import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseJson, serialize } from '../io/serialize'
import { lineoutPreset, preset } from '../test/builders'
import { canonicalJson } from './canonical'
import { upgradePreset } from './preset'

const fixtureText = (): string =>
  readFileSync(new URL('../test/fixtures/preset-v1-touche.json', import.meta.url), 'utf8')

function read(text: string): ReturnType<typeof upgradePreset> {
  const parsed = parseJson(text)
  if (!parsed.ok) throw new Error(parsed.message)
  return upgradePreset(parsed.value)
}

describe('placement presets (SPEC 10.1)', () => {
  it('round-trips through the file format', () => {
    const original = lineoutPreset()
    const text = serialize(original)
    expect(read(text)).toEqual({ ok: true, preset: original, fromVersion: 1 })
    const again = read(text)
    if (!again.ok) throw new Error('unreadable')
    expect(serialize(again.preset)).toBe(text)
  })

  it('reads the frozen version 1 fixture, identical to the builder', () => {
    const result = read(fixtureText())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(canonicalJson(result.preset)).toBe(canonicalJson(lineoutPreset()))
  })

  it('accepts a preset without ball and a ball on the ground', () => {
    expect(upgradePreset(preset()).ok).toBe(true)
    expect(upgradePreset(preset({ ball: { forward: 1, openSide: 2 } })).ok).toBe(true)
  })

  it('rejects unknown keys and incomplete carriers', () => {
    expect(upgradePreset({ ...preset(), extra: 1 }).ok).toBe(false)
    const lonely = preset({ ball: { forward: 0, openSide: 0, carrierRole: 'attack' } })
    expect(upgradePreset(lonely).ok).toBe(false)
    const wrongType = { ...preset(), type: 'kickoff' }
    expect(upgradePreset(wrongType)).toMatchObject({ ok: false, error: { code: 'invalid' } })
    const badNumber = preset({
      positions: [{ role: 'attack', number: 1.5, forward: 0, openSide: 0 }],
    })
    expect(upgradePreset(badNumber).ok).toBe(false)
  })

  it('refuses a newer version and unknown versions (D-024)', () => {
    expect(upgradePreset({ ...preset(), schemaVersion: 2 })).toEqual({
      ok: false,
      error: { code: 'futureVersion', version: 2 },
    })
    expect(upgradePreset({ ...preset(), schemaVersion: 0 })).toEqual({
      ok: false,
      error: { code: 'unknownVersion', version: 0 },
    })
    expect(upgradePreset('modele')).toEqual({ ok: false, error: { code: 'notAnObject' } })
  })
})
