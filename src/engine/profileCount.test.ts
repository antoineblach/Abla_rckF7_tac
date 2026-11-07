// Guard on the compilation time, without a clock (D-150): the number of speed profiles built when
// every line of the reference scene is compiled. A drift of the compilation shows here on the slow
// CI runner, where an assertion in milliseconds would give false reds.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, engineSettingsOf } from '../model/settings'
import { allLines } from '../model/branches'
import { friseFixturePlay, realisticRunsPlay } from '../test/builders'
import { createCaches } from './caches'
import { compileLine } from './timeline'

const counter = vi.hoisted(() => ({ built: 0 }))

vi.mock('./profile', async (importOriginal) => {
  const original = await importOriginal<typeof import('./profile')>()
  return {
    ...original,
    buildProfile: (...args: Parameters<typeof original.buildProfile>) => {
      counter.built++
      return original.buildProfile(...args)
    },
  }
})

const settings = engineSettingsOf(defaultSettings())

/**
 * Measured 443: room for one more solution, which costs about 50 profiles (D-130). Was 392 before
 * D-177: a run absent from the simulation of its own edge moves the breakdown that its player
 * enters, and its relayer is solved once more (D-178).
 */
const REALISTIC_CAP = 490
/** Measured 560 (509 before D-177). */
const FIXTURE_CAP = 610

function profilesOf(play: ReturnType<typeof realisticRunsPlay>): number {
  counter.built = 0
  const caches = createCaches()
  for (const line of allLines(play)) compileLine(play, line, settings, caches)
  return counter.built
}

describe('profiles built by a compilation of every line (D-150)', () => {
  beforeEach(() => {
    counter.built = 0
  })

  it('stays under its cap on the reference scene', () => {
    expect(profilesOf(realisticRunsPlay())).toBeLessThanOrEqual(REALISTIC_CAP)
  })

  it('stays under its cap on the fixture, with its nested branch point', () => {
    expect(profilesOf(friseFixturePlay())).toBeLessThanOrEqual(FIXTURE_CAP)
  })

  it('builds nothing more for a line already resolved', () => {
    const play = realisticRunsPlay()
    const caches = createCaches()
    const [first, second] = allLines(play)
    compileLine(play, first ?? [], settings, caches)
    const built = counter.built
    compileLine(play, second ?? [], settings, caches)
    expect(counter.built).toBe(built)
  })
})
