import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { basePlay, phase, uuid } from '../test/builders'
import { CATEGORY_LABELS, optionTitle, optionTitlesNeedPhase, phaseLabelOf } from './labels'
import type { Play } from './types'

const fixture = JSON.parse(
  readFileSync(new URL('../test/fixtures/play-v1-7v7-options.json', import.meta.url), 'utf8'),
) as Play
const [t1, t2, t3a, t3b] = fixture.phases.map((p) => p.id) as [string, string, string, string]

describe('labels (SPEC 4.1, 6.4)', () => {
  it('labels categories and phases in French', () => {
    expect(CATEGORY_LABELS[fixture.category]).toBe('Ruck / jeu courant')
    expect([t1, t2, t3a, t3b].map((id) => phaseLabelOf(fixture, id))).toEqual([
      'Temps 1',
      'Temps 2',
      'Temps 3, option A',
      'Temps 3, option B',
    ])
  })

  it('titles an option by its condition, with its phase when needed (D-058, D-063)', () => {
    expect(optionTitle(fixture, t3a)).toBe('Option A : Défense en retrait')
    expect(optionTitle(fixture, t3b)).toBe('Option B : Défense montée')
    expect(optionTitle(fixture, t3b, true)).toBe('Temps 3, option B : Défense montée')
    expect(optionTitlesNeedPhase(fixture)).toBe(false)
  })

  it('titles an option without condition by its letter only', () => {
    const play = basePlay({
      phases: [
        phase(uuid(1), null, []),
        phase(uuid(2), uuid(1), [], { isDefault: true }),
        phase(uuid(3), uuid(1), [], { condition: '   ' }),
        phase(uuid(4), uuid(2), []),
        phase(uuid(5), uuid(2), []),
      ],
    })
    expect(optionTitle(play, uuid(3))).toBe('Option B')
    expect(optionTitle(play, uuid(5), true)).toBe('Temps 3, option B')
    expect(optionTitlesNeedPhase(play)).toBe(true)
  })
})
