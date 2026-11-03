// Settings stored in reglages.json at the root of the folder, synchronised between the two
// computers (SPEC 4.4). Version 1 (lot 1): paces, pass speed, theme (DECISIONS Q26).
// Version 2 (lot 2): export preferences (D-068, D-069). Version 3 (lot 3 bis): speed profile and
// speed thresholds; a sprint pace equal to the former default becomes the new one (D-105, D-111).
// Version 4 (lot 3bis-1): top speed of the player, acceleration and braking thresholds; a motion
// value equal to the former default becomes the calibrated one (D-134, D-135).
// A settings file of a newer version is reported and never rewritten (as D-024 for plays).
import { z } from 'zod'
import {
  ACCEL_ALERT_DEFAULTS,
  DECEL_ALERT_DEFAULTS,
  EXPORT_PREFS_DEFAULT,
  LEGACY_MOTION,
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

/** Speed profile of the runs (SPEC 5.3, D-105, D-135). */
export interface MotionSettings {
  /** Acceleration from rest a0, in m/s²: a(v) = accel · (1 − v / topSpeed). */
  accel: number
  /** Braking, in m/s². */
  decel: number
  /** Lateral acceleration in turns, in m/s². */
  lateralAccel: number
  /** Top speed of the player, in m/s (D-130, D-135). */
  topSpeed: number
}

/** Motion settings that were defaults before the calibration (D-134). */
export type LegacyMotionKey = keyof typeof LEGACY_MOTION

/** Thresholds on the peak speed of a run segment, in m/s (SPEC 5.9, D-111). */
export interface SpeedAlertSettings {
  /** Orange: warning beyond it. */
  warning: number
  /** Red: error beyond it; also the cap of the speed factor (SPEC 5.3). */
  danger: number
}

/** Thresholds on the peak acceleration or braking of a run segment, in m/s² (D-132). */
export interface AccelAlertSettings {
  /** Orange: warning beyond it. */
  warning: number
  /** Red: error beyond it. */
  danger: number
}

export interface Settings {
  schemaVersion: 4
  paces: Record<Pace, number>
  passSpeed: number
  motion: MotionSettings
  speedAlert: SpeedAlertSettings
  accelAlert: AccelAlertSettings
  decelAlert: AccelAlertSettings
  theme: ThemeId
  export: ExportPrefs
}

export const CURRENT_SETTINGS_VERSION = 4

/** Values the engine depends on (DECISIONS Q3, D-105, D-111, D-132). */
export type EngineSettings = Pick<
  Settings,
  'paces' | 'passSpeed' | 'motion' | 'speedAlert' | 'accelAlert' | 'decelAlert'
>

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

const thresholdsSchema = z.strictObject({
  warning: z.number().positive(),
  danger: z.number().positive(),
})

/** reglages.json version 3 (lot 3 bis). */
export const settingsSchemaV3 = z.strictObject({
  schemaVersion: z.literal(3),
  paces: pacesSchema,
  passSpeed: z.number().positive(),
  motion: z.strictObject({
    accel: z.number().positive(),
    decel: z.number().positive(),
    lateralAccel: z.number().positive(),
  }),
  speedAlert: thresholdsSchema,
  theme: z.enum(['screen', 'highContrast']),
  export: exportPrefsSchema,
})

export type SettingsFileV3 = z.infer<typeof settingsSchemaV3>

/** reglages.json version 4 (lot 3bis-1). */
export const settingsSchema = z.strictObject({
  schemaVersion: z.literal(4),
  paces: pacesSchema,
  passSpeed: z.number().positive(),
  motion: z.strictObject({
    accel: z.number().positive(),
    decel: z.number().positive(),
    lateralAccel: z.number().positive(),
    topSpeed: z.number().positive(),
  }),
  speedAlert: thresholdsSchema,
  accelAlert: thresholdsSchema,
  decelAlert: thresholdsSchema,
  theme: z.enum(['screen', 'highContrast']),
  export: exportPrefsSchema,
})

export function defaultExportPrefs(): ExportPrefs {
  return { gif: { ...EXPORT_PREFS_DEFAULT.gif }, pdf: { ...EXPORT_PREFS_DEFAULT.pdf } }
}

export function defaultSettings(): Settings {
  return {
    schemaVersion: 4,
    paces: { ...PACE_DEFAULTS },
    passSpeed: PASS_SPEED_DEFAULT,
    motion: { ...MOTION_DEFAULTS },
    speedAlert: { ...SPEED_ALERT_DEFAULTS },
    accelAlert: { ...ACCEL_ALERT_DEFAULTS },
    decelAlert: { ...DECEL_ALERT_DEFAULTS },
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
 * Version 3 (D-105, D-111): speed profile and thresholds of that version; a sprint pace equal to
 * the former default (7 m/s) becomes the new default, every other value is kept.
 */
export function migrateSettingsV2toV3(v2: SettingsFileV2): {
  settings: SettingsFileV3
  sprintReset: boolean
} {
  const sprintReset = v2.paces.sprint === LEGACY_SPRINT_PACE
  return {
    sprintReset,
    settings: {
      schemaVersion: 3,
      paces: { ...v2.paces, sprint: sprintReset ? PACE_DEFAULTS.sprint : v2.paces.sprint },
      passSpeed: v2.passSpeed,
      motion: { ...LEGACY_MOTION },
      speedAlert: { ...SPEED_ALERT_DEFAULTS },
      theme: v2.theme,
      export: { gif: { ...v2.export.gif }, pdf: { ...v2.export.pdf } },
    },
  }
}

const LEGACY_MOTION_KEYS: readonly LegacyMotionKey[] = ['accel', 'decel', 'lateralAccel']

/**
 * Version 4 (D-134): a motion value equal to the former default takes the calibrated default,
 * every other value is kept; top speed and acceleration thresholds by default. `motionReset`
 * lists the values that changed (equal defaults, such as braking, do not).
 */
export function migrateSettingsV3toV4(v3: SettingsFileV3): {
  settings: Settings
  motionReset: LegacyMotionKey[]
} {
  const motion: MotionSettings = { ...v3.motion, topSpeed: MOTION_DEFAULTS.topSpeed }
  const motionReset: LegacyMotionKey[] = []
  for (const key of LEGACY_MOTION_KEYS) {
    if (v3.motion[key] !== LEGACY_MOTION[key]) continue
    motion[key] = MOTION_DEFAULTS[key]
    if (LEGACY_MOTION[key] !== MOTION_DEFAULTS[key]) motionReset.push(key)
  }
  return {
    motionReset,
    settings: {
      schemaVersion: 4,
      paces: { ...v3.paces },
      passSpeed: v3.passSpeed,
      motion,
      speedAlert: { ...v3.speedAlert },
      accelAlert: { ...ACCEL_ALERT_DEFAULTS },
      decelAlert: { ...DECEL_ALERT_DEFAULTS },
      theme: v3.theme,
      export: { gif: { ...v3.export.gif }, pdf: { ...v3.export.pdf } },
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
      /** Motion values of version 3 replaced by the calibrated defaults (message, D-134). */
      motionReset: LegacyMotionKey[]
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
      const v3 = migrateSettingsV2toV3(v2)
      // Older files take the calibrated defaults without a message other than the sprint one.
      const { settings } = migrateSettingsV3toV4(v3.settings)
      return {
        ok: true,
        settings,
        fromVersion: version,
        sprintReset: v3.sprintReset,
        motionReset: [],
      }
    }
    if (version === 3) {
      const v3 = settingsSchemaV3.safeParse(raw)
      if (!v3.success) {
        return { ok: false, future: false, message: v3.error.issues[0]?.message ?? '' }
      }
      return { ok: true, ...migrateSettingsV3toV4(v3.data), fromVersion: 3, sprintReset: false }
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
    motionReset: [],
  }
}

export function engineSettingsOf(settings: Settings): EngineSettings {
  return {
    paces: settings.paces,
    passSpeed: settings.passSpeed,
    motion: settings.motion,
    speedAlert: settings.speedAlert,
    accelAlert: settings.accelAlert,
    decelAlert: settings.decelAlert,
  }
}
