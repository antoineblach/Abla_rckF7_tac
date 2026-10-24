// Settings stored in reglages.json at the root of the folder, synchronised between the two
// computers (SPEC 4.4). Version 1 (lot 1): paces, pass speed, theme (DECISIONS Q26).
// Version 2 (lot 2): export preferences (D-068, D-069). Version 3 (lot 3 bis): speed profile and
// speed thresholds; a sprint pace equal to the former default becomes the new one (D-105, D-111).
// A settings file of a newer version is reported and never rewritten (as D-024 for plays).
import { z } from 'zod'
import {
  EXPORT_PREFS_DEFAULT,
  LEGACY_SPRINT_PACE,
  MOTION_DEFAULTS,
  PACE_DEFAULTS,
  PASS_SPEED_DEFAULT,
  SPEED_ALERT_DEFAULTS,
} from '../config/defaults'
import type { Pace } from './types'

/** Themes of the editor. The print themes are export themes only (D-062). */
export type ThemeId = 'screen' | 'highContrast'

export const THEME_IDS: readonly ThemeId[] = ['screen', 'highContrast']

export type ExportOrientation = 'portrait' | 'landscape' | 'square'
/** « GIF enchaîné » or « un GIF par option » (SPEC 9.2). */
export type GifLinesMode = 'chained' | 'perLeaf'
/** Slow then real speed, slow only, real only (SPEC 9.2). */
export type GifSpeedMode = 'both' | 'slow' | 'real'
export type GifQuality = 'standard' | 'high'
/** Themes offered for GIFs (D-062). */
export type GifThemeId = 'highContrast' | 'screen' | 'printBw'
export type PdfLayout = 'print' | 'phone'
/** « Couleur » uses the « Impression couleur » theme, « Noir et blanc » « Impression N&B » (D-062). */
export type PdfColor = 'color' | 'bw'

export interface GifExportPrefs {
  orientation: ExportOrientation
  lines: GifLinesMode
  speed: GifSpeedMode
  quality: GifQuality
  theme: GifThemeId
  /** Unchanged pixels coded as transparent (D-069). */
  optimizeUnchanged: boolean
}

export interface PdfExportPrefs {
  layout: PdfLayout
  color: PdfColor
}

export interface ExportPrefs {
  gif: GifExportPrefs
  pdf: PdfExportPrefs
}

/** Speed profile of the runs, in m/s² (SPEC 5.3, D-105). */
export interface MotionSettings {
  accel: number
  decel: number
  lateralAccel: number
}

/** Thresholds on the peak speed of a run segment, in m/s (SPEC 5.9, D-111). */
export interface SpeedAlertSettings {
  /** Orange: warning beyond it. */
  warning: number
  /** Red: error beyond it; also the cap of the speed factor (SPEC 5.3). */
  danger: number
}

export interface Settings {
  schemaVersion: 3
  paces: Record<Pace, number>
  passSpeed: number
  motion: MotionSettings
  speedAlert: SpeedAlertSettings
  theme: ThemeId
  export: ExportPrefs
}

export const CURRENT_SETTINGS_VERSION = 3

/** Values the engine depends on (DECISIONS Q3, D-105, D-111). */
export type EngineSettings = Pick<Settings, 'paces' | 'passSpeed' | 'motion' | 'speedAlert'>

const pacesSchema = z.strictObject({
  walk: z.number().positive(),
  jog: z.number().positive(),
  sprint: z.number().positive(),
})

/** reglages.json version 1 (lot 1). */
export const settingsSchemaV1 = z.strictObject({
  schemaVersion: z.literal(1),
  paces: pacesSchema,
  passSpeed: z.number().positive(),
  theme: z.enum(['screen', 'highContrast']),
})

export type SettingsFileV1 = z.infer<typeof settingsSchemaV1>

const exportPrefsSchema = z.strictObject({
  gif: z.strictObject({
    orientation: z.enum(['portrait', 'landscape', 'square']),
    lines: z.enum(['chained', 'perLeaf']),
    speed: z.enum(['both', 'slow', 'real']),
    quality: z.enum(['standard', 'high']),
    theme: z.enum(['highContrast', 'screen', 'printBw']),
    optimizeUnchanged: z.boolean(),
  }),
  pdf: z.strictObject({
    layout: z.enum(['print', 'phone']),
    color: z.enum(['color', 'bw']),
  }),
})

/** reglages.json version 2 (lot 2). */
export const settingsSchemaV2 = z.strictObject({
  schemaVersion: z.literal(2),
  paces: pacesSchema,
  passSpeed: z.number().positive(),
  theme: z.enum(['screen', 'highContrast']),
  export: exportPrefsSchema,
})

export type SettingsFileV2 = z.infer<typeof settingsSchemaV2>

/** reglages.json version 3 (lot 3 bis). */
export const settingsSchema = z.strictObject({
  schemaVersion: z.literal(3),
  paces: pacesSchema,
  passSpeed: z.number().positive(),
  motion: z.strictObject({
    accel: z.number().positive(),
    decel: z.number().positive(),
    lateralAccel: z.number().positive(),
  }),
  speedAlert: z.strictObject({
    warning: z.number().positive(),
    danger: z.number().positive(),
  }),
  theme: z.enum(['screen', 'highContrast']),
  export: exportPrefsSchema,
})

export function defaultExportPrefs(): ExportPrefs {
  return { gif: { ...EXPORT_PREFS_DEFAULT.gif }, pdf: { ...EXPORT_PREFS_DEFAULT.pdf } }
}

export function defaultSettings(): Settings {
  return {
    schemaVersion: 3,
    paces: { ...PACE_DEFAULTS },
    passSpeed: PASS_SPEED_DEFAULT,
    motion: { ...MOTION_DEFAULTS },
    speedAlert: { ...SPEED_ALERT_DEFAULTS },
    theme: 'screen',
    export: defaultExportPrefs(),
  }
}

export function migrateSettingsV1toV2(v1: SettingsFileV1): SettingsFileV2 {
  return {
    schemaVersion: 2,
    paces: { ...v1.paces },
    passSpeed: v1.passSpeed,
    theme: v1.theme,
    export: defaultExportPrefs(),
  }
}

/**
 * Version 3 (D-105, D-111): default speed profile and thresholds; a sprint pace equal to the
 * former default (7 m/s) becomes the new default, every other value is kept.
 */
export function migrateSettingsV2toV3(v2: SettingsFileV2): {
  settings: Settings
  sprintReset: boolean
} {
  const sprintReset = v2.paces.sprint === LEGACY_SPRINT_PACE
  return {
    sprintReset,
    settings: {
      schemaVersion: 3,
      paces: { ...v2.paces, sprint: sprintReset ? PACE_DEFAULTS.sprint : v2.paces.sprint },
      passSpeed: v2.passSpeed,
      motion: { ...MOTION_DEFAULTS },
      speedAlert: { ...SPEED_ALERT_DEFAULTS },
      theme: v2.theme,
      export: { gif: { ...v2.export.gif }, pdf: { ...v2.export.pdf } },
    },
  }
}

export type SettingsReadResult =
  | {
      ok: true
      settings: Settings
      fromVersion: number
      /** The migration replaced the former default sprint pace (message to show once, D-111). */
      sprintReset: boolean
    }
  | { ok: false; future: boolean; message: string }

/** Validates and migrates the content of reglages.json (already parsed from JSON). */
export function readSettings(raw: unknown): SettingsReadResult {
  const version =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? (raw as { schemaVersion?: unknown }).schemaVersion
      : undefined
  if (typeof version === 'number' && Number.isInteger(version)) {
    if (version > CURRENT_SETTINGS_VERSION) {
      return { ok: false, future: true, message: `schemaVersion ${version}` }
    }
    if (version === 1 || version === 2) {
      let v2: SettingsFileV2
      if (version === 1) {
        const v1 = settingsSchemaV1.safeParse(raw)
        if (!v1.success) {
          return { ok: false, future: false, message: v1.error.issues[0]?.message ?? '' }
        }
        v2 = migrateSettingsV1toV2(v1.data)
      } else {
        const parsed = settingsSchemaV2.safeParse(raw)
        if (!parsed.success) {
          return { ok: false, future: false, message: parsed.error.issues[0]?.message ?? '' }
        }
        v2 = parsed.data
      }
      const migrated = migrateSettingsV2toV3(v2)
      return { ok: true, ...migrated, fromVersion: version }
    }
  }
  const current = settingsSchema.safeParse(raw)
  if (!current.success) {
    return { ok: false, future: false, message: current.error.issues[0]?.message ?? '' }
  }
  return {
    ok: true,
    settings: current.data,
    fromVersion: CURRENT_SETTINGS_VERSION,
    sprintReset: false,
  }
}

export function engineSettingsOf(settings: Settings): EngineSettings {
  return {
    paces: settings.paces,
    passSpeed: settings.passSpeed,
    motion: settings.motion,
    speedAlert: settings.speedAlert,
  }
}
