import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EXPORT_PREFS_DEFAULT, PACE_DEFAULTS, PASS_SPEED_DEFAULT } from '../config/defaults'
import {
  CURRENT_SETTINGS_VERSION,
  defaultSettings,
  migrateSettingsV1toV2,
  readSettings,
  settingsSchema,
  settingsSchemaV1,
} from './settings'

const v1Fixture = JSON.parse(
  readFileSync(new URL('../test/fixtures/reglages-v1.json', import.meta.url), 'utf8'),
) as unknown

describe('settings', () => {
  it('defaults to the values of SPEC section 14', () => {
    const settings = defaultSettings()
    expect(settings.paces).toEqual({ walk: 2, jog: 4, sprint: 7 })
    expect(settings.paces).toEqual(PACE_DEFAULTS)
    expect(settings.passSpeed).toBe(12)
    expect(settings.passSpeed).toBe(PASS_SPEED_DEFAULT)
    expect(settingsSchema.safeParse(settings).success).toBe(true)
  })

  it('defaults the export preferences to the choices of D-068 and D-069', () => {
    expect(defaultSettings().export).toEqual({
      gif: {
        orientation: 'portrait',
        lines: 'chained',
        speed: 'both',
        quality: 'standard',
        theme: 'highContrast',
        optimizeUnchanged: true,
      },
      pdf: { layout: 'print', color: 'color' },
    })
    expect(defaultSettings().export).toEqual(EXPORT_PREFS_DEFAULT)
  })

  it('returns independent copies of the defaults', () => {
    const a = defaultSettings()
    a.export.gif.quality = 'high'
    a.paces.walk = 1
    expect(defaultSettings().export.gif.quality).toBe('standard')
    expect(defaultSettings().paces.walk).toBe(2)
  })

  it('rejects invalid values and unknown keys', () => {
    expect(settingsSchema.safeParse({ ...defaultSettings(), passSpeed: 0 }).success).toBe(false)
    expect(settingsSchema.safeParse({ ...defaultSettings(), extra: 1 }).success).toBe(false)
    const badExport = { ...defaultSettings().export, gif: { ...defaultSettings().export.gif } }
    expect(
      settingsSchema.safeParse({
        ...defaultSettings(),
        export: { ...badExport, gif: { ...badExport.gif, fps: 30 } },
      }).success,
    ).toBe(false)
    expect(
      settingsSchema.safeParse({
        ...defaultSettings(),
        export: { ...badExport, pdf: { layout: 'a3', color: 'color' } },
      }).success,
    ).toBe(false)
  })
})

describe('reglages.json versions (SPEC 4.4, 4.5, D-068)', () => {
  it('reads the version 1 fixture and migrates it to version 2, keeping every value', () => {
    expect(settingsSchemaV1.safeParse(v1Fixture).success).toBe(true)
    const result = readSettings(v1Fixture)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fromVersion).toBe(1)
    expect(result.settings).toEqual({
      schemaVersion: 2,
      paces: { walk: 1.8, jog: 4.5, sprint: 7.5 },
      passSpeed: 11,
      theme: 'highContrast',
      export: defaultSettings().export,
    })
    expect(settingsSchema.safeParse(result.settings).success).toBe(true)
  })

  it('migrates without sharing objects with the version 1 content', () => {
    const v1 = settingsSchemaV1.parse(v1Fixture)
    const migrated = migrateSettingsV1toV2(v1)
    migrated.paces.walk = 3
    expect(v1.paces.walk).toBe(1.8)
  })

  it('reads the current version unchanged (round trip)', () => {
    const settings = {
      ...defaultSettings(),
      theme: 'highContrast' as const,
      export: {
        gif: {
          ...defaultSettings().export.gif,
          orientation: 'square' as const,
          speed: 'real' as const,
        },
        pdf: { layout: 'phone' as const, color: 'bw' as const },
      },
    }
    const result = readSettings(JSON.parse(JSON.stringify(settings)))
    expect(result).toEqual({ ok: true, settings, fromVersion: CURRENT_SETTINGS_VERSION })
  })

  it('reports a newer version as such, without reading it (D-024)', () => {
    const result = readSettings({ ...defaultSettings(), schemaVersion: 3, newKey: true })
    expect(result).toEqual({ ok: false, future: true, message: 'schemaVersion 3' })
  })

  it('reports invalid content of each version', () => {
    expect(readSettings({ ...(v1Fixture as object), passSpeed: -1 })).toMatchObject({
      ok: false,
      future: false,
    })
    expect(
      readSettings({ ...(v1Fixture as object), export: defaultSettings().export }),
    ).toMatchObject({ ok: false, future: false })
    expect(readSettings({ ...defaultSettings(), export: undefined })).toMatchObject({
      ok: false,
      future: false,
    })
    for (const raw of [null, [], 'reglages', 2, { schemaVersion: 1.5 }]) {
      expect(readSettings(raw)).toMatchObject({ ok: false, future: false })
    }
  })
})
