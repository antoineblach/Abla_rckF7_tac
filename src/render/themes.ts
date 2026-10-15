// Graphic themes (SPEC 13.2). The « Impression N&B » theme arrives with lot 2.
import { THEME_VALUES } from '../config/defaults'
import type { ThemeId } from '../model/settings'

type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends readonly number[]
      ? readonly number[]
      : T

export type Theme = { readonly id: ThemeId } & {
  readonly [K in keyof (typeof THEME_VALUES)['screen']]: Widen<(typeof THEME_VALUES)['screen'][K]>
}

export const THEMES: Record<ThemeId, Theme> = {
  screen: { id: 'screen', ...THEME_VALUES.screen },
  highContrast: { id: 'highContrast', ...THEME_VALUES.highContrast },
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
