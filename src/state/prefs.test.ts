import { afterEach, describe, expect, it, vi } from 'vitest'
import { takeMotionResetNotice, takeSprintResetNotice } from './prefs'

function stubStorage(): Map<string, string> {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  })
  return data
}

describe('messages of the settings migrations, once per computer (D-121, D-134)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the sprint and the motion messages once each, independently', () => {
    stubStorage()
    expect(takeMotionResetNotice()).toBe(true)
    expect(takeMotionResetNotice()).toBe(false)
    expect(takeSprintResetNotice()).toBe(true)
    expect(takeSprintResetNotice()).toBe(false)
    expect(takeMotionResetNotice()).toBe(false)
  })

  it('shows them again on another computer (another storage)', () => {
    stubStorage()
    expect(takeMotionResetNotice()).toBe(true)
    stubStorage()
    expect(takeMotionResetNotice()).toBe(true)
  })

  it('shows them, rather than never, when the storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(takeMotionResetNotice()).toBe(true)
    expect(takeSprintResetNotice()).toBe(true)
  })
})
