// Settings stored in reglages.json at the root of the folder, synchronised between the two
// computers (SPEC 4.4). Lot 1 content: paces, pass speed, theme (DECISIONS Q26).
import { z } from 'zod'
import { PACE_DEFAULTS, PASS_SPEED_DEFAULT } from '../config/defaults'
import type { Pace } from './types'

export type ThemeId = 'screen' | 'highContrast'

export const THEME_IDS: readonly ThemeId[] = ['screen', 'highContrast']

export interface Settings {
  schemaVersion: 1
  paces: Record<Pace, number>
  passSpeed: number
  theme: ThemeId
}

/** Values the engine depends on (DECISIONS Q3). */
export type EngineSettings = Pick<Settings, 'paces' | 'passSpeed'>

export const settingsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  paces: z.strictObject({
    walk: z.number().positive(),
    jog: z.number().positive(),
    sprint: z.number().positive(),
  }),
  passSpeed: z.number().positive(),
  theme: z.enum(['screen', 'highContrast']),
})

export function defaultSettings(): Settings {
  return {
    schemaVersion: 1,
    paces: { ...PACE_DEFAULTS },
    passSpeed: PASS_SPEED_DEFAULT,
    theme: 'screen',
  }
}

export function engineSettingsOf(settings: Settings): EngineSettings {
  return { paces: settings.paces, passSpeed: settings.passSpeed }
}
