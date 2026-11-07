import { describe, expect, it } from 'vitest'
import {
  P,
  ROOT_BRANCH,
  basePlay,
  branch,
  friseFixturePlay,
  sequence,
  sevenVsSevenWithOptions,
  uuid,
} from '../test/builders'
import {
  branchLabelOf,
  CATEGORY_LABELS,
  lineOptionsText,
  optionTitle,
  sceneHeaderLabel,
  sequenceLabelOf,
} from './labels'

describe('labels of the exports (SPEC 9.2)', () => {
  const play = basePlay({
    branches: [
      branch(ROOT_BRANCH, null, { branchAt: 1 }),
      branch(uuid(1), ROOT_BRANCH, { isDefault: true, condition: 'Large', branchAt: 2 }),
      branch(uuid(2), ROOT_BRANCH, { label: 'Par-dessus' }),
      branch(uuid(3), uuid(1), { isDefault: true }),
      branch(uuid(4), uuid(1), { condition: 'Montée' }),
    ],
  })

  it('lists the options of a line, from the root', () => {
    expect(lineOptionsText(play, [ROOT_BRANCH])).toBe('')
    expect(lineOptionsText(play, [ROOT_BRANCH, uuid(1), uuid(4)])).toBe(
      'Option A : Large ; Option B : Montée',
    )
    expect(lineOptionsText(play, [ROOT_BRANCH, uuid(2)])).toBe('Option B')
  })

  it('heads a GIF image with the sequence and the option', () => {
    expect(sceneHeaderLabel(play, 'Sortie de mêlée', uuid(4))).toBe('Sortie de mêlée, option B')
    expect(sceneHeaderLabel(play, '', uuid(4))).toBe('Option B')
    expect(sceneHeaderLabel(play, 'Sortie de mêlée', ROOT_BRANCH)).toBe('Sortie de mêlée')
    expect(sceneHeaderLabel(play, '', ROOT_BRANCH)).toBe('')
    expect(sceneHeaderLabel(play, 'Sortie de mêlée', uuid(2))).toBe('Sortie de mêlée, Par-dessus')
    expect(sceneHeaderLabel(play, '', uuid(2))).toBe('Par-dessus')
  })
})

describe('labels (SPEC 4.1, 6.5)', () => {
  const play = sevenVsSevenWithOptions()

  it('labels categories and options in French', () => {
    expect(CATEGORY_LABELS[play.category]).toBe('Ruck / jeu courant')
    expect(branchLabelOf(play, P.root)).toBe('')
    expect(branchLabelOf(play, P.optA)).toBe('Option A')
    expect(branchLabelOf(play, P.optB)).toBe('Option B')
  })

  it('prefers the label typed by the user (D-012)', () => {
    const nested = friseFixturePlay()
    expect(branchLabelOf(nested, P.optB)).toBe('Par-dessus')
    expect(branchLabelOf(nested, P.optB1)).toBe('Option A')
  })

  it('titles an option by its condition (D-058, D-063)', () => {
    expect(optionTitle(play, P.optA)).toBe('Option A : Défense en retrait')
    expect(optionTitle(play, P.optB)).toBe('Option B : Défense montée')
  })

  it('titles an option without condition by its letter only', () => {
    const blank = basePlay({
      branches: [
        branch(uuid(1), null, { branchAt: 1 }),
        branch(uuid(2), uuid(1), { isDefault: true }),
        branch(uuid(3), uuid(1), { condition: '   ' }),
      ],
    })
    expect(optionTitle(blank, uuid(2))).toBe('Option A')
    expect(optionTitle(blank, uuid(3))).toBe('Option B')
  })

  it('labels a sequence by its typed label, or « Séquence n » in array order (D-154)', () => {
    const sequences = basePlay({
      sequences: [
        sequence(uuid(1), 0, 1),
        sequence(uuid(2), 1, 2, { label: 'Sortie de mêlée' }),
        sequence(uuid(3), 2, 3, { label: '  ' }),
      ],
    })
    expect(sequenceLabelOf(sequences, uuid(1))).toBe('Séquence 1')
    expect(sequenceLabelOf(sequences, uuid(2))).toBe('Sortie de mêlée')
    expect(sequenceLabelOf(sequences, uuid(3))).toBe('Séquence 3')
  })
})
