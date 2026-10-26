import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ACCEL_ALERT_DEFAULTS,
  DECEL_ALERT_DEFAULTS,
  EXPORT_PREFS_DEFAULT,
  LEGACY_MOTION,
  MOTION_DEFAULTS,
  PACE_DEFAULTS,
  PASS_SPEED_DEFAULT,
  SPEED_ALERT_DEFAULTS,
} from '../config/defaults'
import {
  CURRENT_SETTINGS_VERSION,
  defaultSettings,
  engineSettingsOf,
  migrateSettingsV1toV2,
  migrateSettingsV3toV4,
  readSettings,
  settingsSchema,
  settingsSchemaV1,
  settingsSchemaV2,
  settingsSchemaV3,
} from './settings'

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url), 'utf8'))

const v1Fixture = fixture('reglages-v1.json')
const v2Fixture = fixture('reglages-v2.json')
const v3Fixture = fixture('reglages-v3.json')

describe('settings', () => {
  it('defaults to the values of SPEC section 14', () => {
    const settings = defaultSettings()
    expect(settings.paces).toEqual({ walk: 2, jog: 4, sprint: 5.5 })
    expect(settings.paces).toEqual(PACE_DEFAULTS)
    expect(settings.motion).toEqual({ accel: 5.2, decel: 4, lateralAccel: 4, topSpeed: 24 / 3.6 })
    expect(settings.motion).toEqual(MOTION_DEFAULTS)
    expect(settings.speedAlert.warning * 3.6).toBeCloseTo(20, 12)
    expect(settings.speedAlert.danger * 3.6).toBeCloseTo(25, 12)
    expect(settings.speedAlert).toEqual(SPEED_ALERT_DEFAULTS)
    expect(settings.accelAlert).toEqual({ warning: 6, danger: 8 })
    expect(settings.accelAlert).toEqual(ACCEL_ALERT_DEFAULTS)
    expect(settings.decelAlert).toEqual({ warning: 5, danger: 7 })
    expect(settings.decelAlert).toEqual(DECEL_ALERT_DEFAULTS)
    expect(engineSettingsOf(settings)).toEqual({
      paces: settings.paces,
      passSpeed: settings.passSpeed,
      motion: settings.motion,
      speedAlert: settings.speedAlert,
      accelAlert: settings.accelAlert,
      decelAlert: settings.decelAlert,
    })
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
    const motion = { ...MOTION_DEFAULTS, decel: 0 }
    expect(settingsSchema.safeParse({ ...defaultSettings(), motion }).success).toBe(false)
    const speedAlert = { ...SPEED_ALERT_DEFAULTS, extra: 1 }
    expect(settingsSchema.safeParse({ ...defaultSettings(), speedAlert }).success).toBe(false)
    const accelAlert = { ...ACCEL_ALERT_DEFAULTS, danger: -1 }
    expect(settingsSchema.safeParse({ ...defaultSettings(), accelAlert }).success).toBe(false)
    expect(settingsSchema.safeParse({ ...defaultSettings(), motion: LEGACY_MOTION }).success).toBe(
      false,
    )
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
  it('reads the version 1 fixture and migrates it to version 4, keeping every value', () => {
    expect(settingsSchemaV1.safeParse(v1Fixture).success).toBe(true)
    const result = readSettings(v1Fixture)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fromVersion).toBe(1)
    expect(result.sprintReset).toBe(false)
    expect(result.motionReset).toEqual([])
    expect(result.settings).toEqual({
      schemaVersion: 4,
      paces: { walk: 1.8, jog: 4.5, sprint: 7.5 },
      passSpeed: 11,
      motion: MOTION_DEFAULTS,
      speedAlert: SPEED_ALERT_DEFAULTS,
      accelAlert: ACCEL_ALERT_DEFAULTS,
      decelAlert: DECEL_ALERT_DEFAULTS,
      theme: 'highContrast',
      export: defaultSettings().export,
    })
    expect(settingsSchema.safeParse(result.settings).success).toBe(true)
  })

  it('migrates the version 2 fixture: former default sprint replaced, once (D-111)', () => {
    expect(settingsSchemaV2.safeParse(v2Fixture).success).toBe(true)
    const result = readSettings(v2Fixture)
    // Calibrated motion without a message of its own (D-134).
    expect(result).toEqual({
      ok: true,
      fromVersion: 2,
      sprintReset: true,
      motionReset: [],
      settings: {
        schemaVersion: 4,
        paces: { walk: 2, jog: 4, sprint: 5.5 },
        passSpeed: 12,
        motion: MOTION_DEFAULTS,
        speedAlert: SPEED_ALERT_DEFAULTS,
        accelAlert: ACCEL_ALERT_DEFAULTS,
        decelAlert: DECEL_ALERT_DEFAULTS,
        theme: 'screen',
        export: EXPORT_PREFS_DEFAULT,
      },
    })
    // Once written in version 4, it is read as it is: no new reset.
    if (!result.ok) return
    expect(readSettings(JSON.parse(JSON.stringify(result.settings)))).toMatchObject({
      ok: true,
      sprintReset: false,
      motionReset: [],
    })
  })

  it('migrates the version 3 fixture: former default motion replaced, listed (D-134)', () => {
    expect(settingsSchemaV3.safeParse(v3Fixture).success).toBe(true)
    expect((v3Fixture as { motion: unknown }).motion).toEqual(LEGACY_MOTION)
    const result = readSettings(v3Fixture)
    // Braking and lateral acceleration keep their value, equal to the calibrated one: only the
    // acceleration is listed in the message.
    expect(result).toEqual({
      ok: true,
      fromVersion: 3,
      sprintReset: false,
      motionReset: ['accel'],
      settings: {
        schemaVersion: 4,
        paces: PACE_DEFAULTS,
        passSpeed: 12,
        motion: MOTION_DEFAULTS,
        speedAlert: SPEED_ALERT_DEFAULTS,
        accelAlert: ACCEL_ALERT_DEFAULTS,
        decelAlert: DECEL_ALERT_DEFAULTS,
        theme: 'screen',
        export: EXPORT_PREFS_DEFAULT,
      },
    })
    if (!result.ok) return
    expect(readSettings(JSON.parse(JSON.stringify(result.settings)))).toMatchObject({
      ok: true,
      motionReset: [],
    })
  })

  it('keeps the motion values chosen by the coach in version 3 (D-134)', () => {
    const chosen = {
      ...(v3Fixture as object),
      motion: { accel: 3.5, decel: 4.5, lateralAccel: 4 },
      speedAlert: { warning: 5, danger: 6 },
    }
    const result = readSettings(chosen)
    expect(result).toMatchObject({ ok: true, motionReset: [] })
    if (!result.ok) return
    expect(result.settings.motion).toEqual({
      accel: 3.5,
      decel: 4.5,
      lateralAccel: 4,
      topSpeed: MOTION_DEFAULTS.topSpeed,
    })
    expect(result.settings.speedAlert).toEqual({ warning: 5, danger: 6 })
  })

  it('migrates version 3 without sharing objects with its content', () => {
    const v3 = settingsSchemaV3.parse(v3Fixture)
    const { settings } = migrateSettingsV3toV4(v3)
    settings.paces.walk = 3
    settings.speedAlert.warning = 1
    settings.export.gif.quality = 'high'
    expect(v3.paces.walk).toBe(2)
    expect(v3.speedAlert.warning).toBe(SPEED_ALERT_DEFAULTS.warning)
    expect(v3.export.gif.quality).toBe('standard')
  })

  it('keeps a sprint pace chosen by the coach (D-111)', () => {
    const chosen = { ...(v2Fixture as object), paces: { walk: 2, jog: 4, sprint: 6.5 } }
    const result = readSettings(chosen)
    expect(result).toMatchObject({ ok: true, sprintReset: false })
    if (!result.ok) return
    expect(result.settings.paces.sprint).toBe(6.5)
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
    expect(result).toEqual({
      ok: true,
      settings,
      fromVersion: CURRENT_SETTINGS_VERSION,
      sprintReset: false,
      motionReset: [],
    })
  })

  it('reports a newer version as such, without reading it (D-024)', () => {
    const result = readSettings({ ...defaultSettings(), schemaVersion: 5, newKey: true })
    expect(result).toEqual({ ok: false, future: true, message: 'schemaVersion 5' })
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
    expect(readSettings({ ...(v2Fixture as object), motion: MOTION_DEFAULTS })).toMatchObject({
      ok: false,
      future: false,
    })
    expect(readSettings({ ...defaultSettings(), motion: undefined })).toMatchObject({
      ok: false,
      future: false,
    })
    expect(readSettings({ ...(v3Fixture as object), motion: MOTION_DEFAULTS })).toMatchObject({
      ok: false,
      future: false,
    })
    expect(
      readSettings({ ...(v3Fixture as object), accelAlert: ACCEL_ALERT_DEFAULTS }),
    ).toMatchObject({ ok: false, future: false })
    for (const raw of [null, [], 'reglages', 2, { schemaVersion: 1.5 }]) {
      expect(readSettings(raw)).toMatchObject({ ok: false, future: false })
    }
  })
})
