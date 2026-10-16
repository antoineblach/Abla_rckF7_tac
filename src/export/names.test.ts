import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GIF_FORMATS, LEGIBILITY } from '../config/defaults'
import { allLines } from '../model/phaseTree'
import type { ExportOrientation, GifQuality, GifSpeedMode } from '../model/settings'
import type { Play } from '../model/types'
import { basePlay, phase, uuid } from '../test/builders'
import { legiblePixelRatio, minTextSize, phoneScreenWidthMm } from './legibility'
import {
  gifFileName,
  gifVariant,
  leafLetters,
  numberedFileName,
  pdfFileName,
  type GifLines,
} from './names'
import { exportText } from './text'

const fixture = JSON.parse(
  readFileSync(new URL('../test/fixtures/play-v1-7v7-options.json', import.meta.url), 'utf8'),
) as Play

/** Two branch points: options A and B at phase 2, then options A and B at phase 3 under 2A. */
function twoBranchPoints(): Play {
  return basePlay({
    name: 'Double option',
    phases: [
      phase(uuid(1), null, []),
      phase(uuid(2), uuid(1), [], { isDefault: true, condition: 'Large' }),
      phase(uuid(3), uuid(1), [], { condition: 'Serré' }),
      phase(uuid(4), uuid(2), [], { isDefault: true }),
      phase(uuid(5), uuid(2), [], { condition: 'Montée' }),
    ],
  })
}

describe('GIF names (SPEC 9.1, D-066)', () => {
  const base = { orientation: 'portrait', quality: 'standard', speed: 'both' } as const

  it('follows the examples of the plan', () => {
    expect(gifFileName(fixture.name, { ...base, lines: { kind: 'chained' } })).toBe(
      'croisee-au-centre--portrait-enchaine.gif',
    )
    expect(
      gifFileName(fixture.name, {
        orientation: 'landscape',
        quality: 'high',
        lines: { kind: 'chained' },
        speed: 'real',
      }),
    ).toBe('croisee-au-centre--paysage-hd-enchaine-reel.gif')
    expect(
      gifFileName(fixture.name, {
        orientation: 'landscape',
        quality: 'high',
        lines: { kind: 'single' },
        speed: 'real',
      }),
    ).toBe('croisee-au-centre--paysage-hd-reel.gif')
    expect(
      gifVariant({ ...base, orientation: 'square', lines: { kind: 'single' }, speed: 'slow' }),
    ).toBe('carre-ralenti')
  })

  it('names one GIF per leaf by the letters of the options chosen from the root', () => {
    const lines = allLines(fixture)
    expect(lines.map((line) => leafLetters(fixture, line))).toEqual([['a'], ['b']])
    const lettersB = leafLetters(fixture, lines[1] ?? [])
    expect(gifFileName(fixture.name, { ...base, lines: { kind: 'leaf', letters: lettersB } })).toBe(
      'croisee-au-centre--portrait-option-b.gif',
    )
    const play = twoBranchPoints()
    expect(allLines(play).map((line) => leafLetters(play, line).join('-'))).toEqual([
      'a-a',
      'a-b',
      'b',
    ])
  })

  it('never gives the same name to two different variants', () => {
    const orientations: ExportOrientation[] = ['portrait', 'landscape', 'square']
    const qualities: GifQuality[] = ['standard', 'high']
    const speeds: GifSpeedMode[] = ['both', 'slow', 'real']
    const lineModes: GifLines[] = [
      { kind: 'single' },
      { kind: 'chained' },
      { kind: 'leaf', letters: ['a'] },
      { kind: 'leaf', letters: ['b'] },
      { kind: 'leaf', letters: ['a', 'b'] },
    ]
    const names = new Set<string>()
    let count = 0
    for (const orientation of orientations)
      for (const quality of qualities)
        for (const speed of speeds)
          for (const lines of lineModes) {
            names.add(gifFileName('Croisée', { orientation, quality, speed, lines }))
            count++
          }
    expect(names.size).toBe(count)
  })
})

describe('PDF names (D-066)', () => {
  it('names a play PDF and a playbook by their layout and colour', () => {
    expect(pdfFileName(fixture.name, { layout: 'print', color: 'color', book: false })).toBe(
      'croisee-au-centre--impression.pdf',
    )
    expect(pdfFileName(fixture.name, { layout: 'phone', color: 'bw', book: false })).toBe(
      'croisee-au-centre--telephone-nb.pdf',
    )
    expect(pdfFileName('Cahier de jeu', { layout: 'print', color: 'bw', book: true })).toBe(
      'cahier-de-jeu--cahier-impression-nb.pdf',
    )
    expect(pdfFileName('', { layout: 'phone', color: 'color', book: true })).toBe(
      'sans-nom--cahier-telephone.pdf',
    )
  })

  it('numbers a kept copy before the extension (« Garder les deux », D-065)', () => {
    expect(numberedFileName('croisee--portrait-enchaine.gif', 2)).toBe(
      'croisee--portrait-enchaine-2.gif',
    )
    expect(numberedFileName('croisee--impression.pdf', 3)).toBe('croisee--impression-3.pdf')
    expect(numberedFileName('sans-extension', 2)).toBe('sans-extension-2')
  })

  it('uses the short name of D-023', () => {
    expect(
      gifFileName('Œil « défense » à 7 !', {
        orientation: 'portrait',
        quality: 'standard',
        speed: 'both',
        lines: { kind: 'single' },
      }),
    ).toBe('oeil-defense-a-7--portrait.gif')
    const long = 'Une combinaison au nom vraiment beaucoup trop long pour un fichier'
    const name = pdfFileName(long, { layout: 'print', color: 'color', book: false })
    expect(name.split('--')[0]?.length).toBeLessThanOrEqual(40)
  })
})

describe('legibility (SPEC 9.2, D-061)', () => {
  it('reads portrait and square images across the phone width, landscape across its long side', () => {
    expect(phoneScreenWidthMm('portrait')).toBe(LEGIBILITY.phoneWidthMm)
    expect(phoneScreenWidthMm('square')).toBe(LEGIBILITY.phoneWidthMm)
    expect(phoneScreenWidthMm('landscape')).toBe(LEGIBILITY.phoneLongSideMm)
  })

  it('gives 21 px at least for a 540 px wide portrait GIF', () => {
    expect(minTextSize(540, 64)).toBeCloseTo(21.09, 2)
  })

  it('scales a theme so that its smallest text is legible, never below the screen sizes', () => {
    for (const quality of ['standard', 'high'] as const) {
      for (const orientation of ['portrait', 'landscape', 'square'] as const) {
        const { width } = GIF_FORMATS[quality][orientation]
        const screen = phoneScreenWidthMm(orientation)
        const ratio = legiblePixelRatio(width, screen, 14)
        expect(ratio).toBeGreaterThanOrEqual(1)
        expect(14 * ratio).toBeGreaterThanOrEqual(minTextSize(width, screen) - 1e-9)
      }
    }
    expect(legiblePixelRatio(100, 64, 14)).toBe(1)
  })
})

describe('export texts', () => {
  it('replaces the narrow no-break space, missing from the font, by a no-break space', () => {
    const narrow = String.fromCharCode(0x202f)
    const noBreak = String.fromCharCode(0xa0)
    expect(exportText(`Option${narrow}: « défense »${narrow}!`)).toBe(
      `Option${noBreak}: « défense »${noBreak}!`,
    )
    expect(exportText('l’option')).toBe('l’option')
  })
})
