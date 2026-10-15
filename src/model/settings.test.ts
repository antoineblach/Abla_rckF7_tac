import { describe, expect, it } from 'vitest'
import { PACE_DEFAULTS, PASS_SPEED_DEFAULT } from '../config/defaults'
import { defaultSettings, settingsSchema } from './settings'

describe('settings', () => {
  it('defaults to the values of SPEC section 14', () => {
    const settings = defaultSettings()
    expect(settings.paces).toEqual({ walk: 2, jog: 4, sprint: 7 })
    expect(settings.paces).toEqual(PACE_DEFAULTS)
    expect(settings.passSpeed).toBe(12)
    expect(settings.passSpeed).toBe(PASS_SPEED_DEFAULT)
    expect(settingsSchema.safeParse(settings).success).toBe(true)
  })

  it('rejects invalid values and unknown keys', () => {
    expect(settingsSchema.safeParse({ ...defaultSettings(), passSpeed: 0 }).success).toBe(false)
    expect(settingsSchema.safeParse({ ...defaultSettings(), extra: 1 }).success).toBe(false)
  })
})
