import { describe, expect, it } from 'vitest'
import { speedOf } from './speed'

describe('speedOf', () => {
  const paces = { walk: 1.5, jog: 3, sprint: 6 }

  it('reads a named pace in the settings and keeps a typed speed', () => {
    expect(speedOf('walk', paces)).toBe(1.5)
    expect(speedOf('sprint', paces)).toBe(6)
    expect(speedOf(4.2, paces)).toBe(4.2)
  })
})
