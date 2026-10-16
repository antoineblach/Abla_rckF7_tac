// Graphic themes (SPEC 13.2). « Écran » and « Contraste fort » are editor themes; « Impression
// couleur » and « Impression N&B » are export themes only (lot 2, D-062).
import { THEME_VALUES } from '../config/defaults'
import type { ThemeId } from '../model/settings'
import type { Team } from '../model/types'

/** Every theme the renderer knows: the editor themes plus the print themes of the exports. */
export type RenderThemeId = ThemeId | 'printColor' | 'printBw'

export const RENDER_THEME_IDS: readonly RenderThemeId[] = [
  'screen',
  'highContrast',
  'printColor',
  'printBw',
]

type Widen<T> = T extends null
  ? string | null
  : T extends string
    ? string
    : T extends number
      ? number
      : T extends readonly number[]
        ? readonly number[]
        : T

export type Theme = { readonly id: RenderThemeId } & {
  readonly [K in keyof (typeof THEME_VALUES)['screen']]: Widen<(typeof THEME_VALUES)['screen'][K]>
}

export const THEMES: Record<RenderThemeId, Theme> = {
  screen: { id: 'screen', ...THEME_VALUES.screen },
  highContrast: { id: 'highContrast', ...THEME_VALUES.highContrast },
  printColor: { id: 'printColor', ...THEME_VALUES.printColor },
  printBw: { id: 'printBw', ...THEME_VALUES.printBw },
}

/** Fill of a token: the player colour, unless the theme fixes one per team (N&B, D-062). */
export function tokenFill(theme: Theme, team: Team, playerColor: string): string {
  return (team === 'A' ? theme.tokenFillA : theme.tokenFillB) ?? playerColor
}

/** Colour of a run: the player colour, unless the theme fixes one (N&B, D-062). */
export function runColor(theme: Theme, playerColor: string): string {
  return theme.runColor ?? playerColor
}

function parseHex(color: string): [number, number, number] | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(color)
  if (!match?.[1]) return null
  const n = Number.parseInt(match[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (rgb: [number, number, number]): string =>
  `#${rgb
    .map((c) =>
      Math.round(Math.min(255, Math.max(0, c)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`

/** Flat colour between `a` (k = 0) and `b` (k = 1): fading without transparency. */
export function mixColors(a: string, b: string, k: number): string {
  const ca = parseHex(a)
  const cb = parseHex(b)
  if (!ca || !cb) return a
  return toHex([
    ca[0] + (cb[0] - ca[0]) * k,
    ca[1] + (cb[1] - ca[1]) * k,
    ca[2] + (cb[2] - ca[2]) * k,
  ])
}

/** Black or white, whichever reads best on the given background (WCAG relative luminance). */
export function readableTextColor(background: string): string {
  const rgb = parseHex(background)
  if (!rgb) return '#ffffff'
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }) as [number, number, number]
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  // Contrast with white: 1.05 / (L + 0.05); with black: (L + 0.05) / 0.05.
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? '#ffffff' : '#000000'
}
