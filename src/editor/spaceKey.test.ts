// Space bar automaton (D-116): short press plays or pauses, held with a drag pans, repeat ignored.
import { describe, expect, it } from 'vitest'
import { SPACE_TAP_MAX_MS } from '../config/defaults'
import { spaceHeld, spaceStep, SPACE_UP, type SpaceEvent, type SpaceState } from './spaceKey'

function run(events: SpaceEvent[]): { state: SpaceState; toggles: number } {
  let state = SPACE_UP
  let toggles = 0
  for (const event of events) {
    const step = spaceStep(state, event)
    state = step.state
    if (step.toggle) toggles++
  }
  return { state, toggles }
}

describe('space bar (D-116)', () => {
  it('plays or pauses on a short press released without a drag', () => {
    const result = run([
      { kind: 'press', t: 1000, repeat: false },
      { kind: 'release', t: 1000 + SPACE_TAP_MAX_MS - 1 },
    ])
    expect(result).toEqual({ state: SPACE_UP, toggles: 1 })
  })

  it('does nothing on a long press', () => {
    const result = run([
      { kind: 'press', t: 0, repeat: false },
      { kind: 'release', t: SPACE_TAP_MAX_MS },
    ])
    expect(result.toggles).toBe(0)
  })

  it('pans without playing when a drag started while held', () => {
    let state = spaceStep(SPACE_UP, { kind: 'press', t: 0, repeat: false }).state
    expect(spaceHeld(state)).toBe(true)
    state = spaceStep(state, { kind: 'drag' }).state
    const released = spaceStep(state, { kind: 'release', t: 100 })
    expect(released.toggle).toBe(false)
    expect(spaceHeld(released.state)).toBe(false)
  })

  it('ignores key repeat: the press keeps its first instant', () => {
    const result = run([
      { kind: 'press', t: 0, repeat: false },
      { kind: 'press', t: 300, repeat: true },
      { kind: 'press', t: 450, repeat: false },
      { kind: 'release', t: SPACE_TAP_MAX_MS + 10 },
    ])
    expect(result.toggles).toBe(0)
  })

  it('ignores a release or a drag without press, and a reset releases without toggling', () => {
    expect(run([{ kind: 'release', t: 10 }]).toggles).toBe(0)
    expect(spaceStep(SPACE_UP, { kind: 'drag' }).state).toBe(SPACE_UP)
    const reset = run([
      { kind: 'press', t: 0, repeat: false },
      { kind: 'reset' },
      { kind: 'release', t: 10 },
    ])
    expect(reset).toEqual({ state: SPACE_UP, toggles: 0 })
  })

  it('counts two short presses as two toggles', () => {
    const result = run([
      { kind: 'press', t: 0, repeat: false },
      { kind: 'release', t: 80 },
      { kind: 'press', t: 200, repeat: false },
      { kind: 'release', t: 260 },
    ])
    expect(result.toggles).toBe(2)
  })
})
