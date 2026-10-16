// Plan of the images of a GIF (SPEC 9.2, D-058, D-059): cards, scene images sampled along the
// lines at each speed, and their delays in hundredths of a second. Pure.
//
// Chained GIF: title card; slow pass (trunk and option A, card « Option B : <condition> »,
// resumed at the branch point where B leaves A, option B...); « Vitesse réelle » card; the same
// pass at real speed; final hold. The last image of each line is held before the next card; a
// card or a held image is a single GIF image with a long delay.
import { GIF_DURATIONS, GIF_SLOW_SPEED } from '../../config/defaults'
import type { EvalCaches } from '../../engine/caches'
import { compileLine } from '../../engine/timeline'
import { optionTitle, optionTitlesNeedPhase } from '../../model/labels'
import { allLines, isBranchPoint } from '../../model/phaseTree'
import type { EngineSettings, GifLinesMode, GifSpeedMode } from '../../model/settings'
import type { Id, Play } from '../../model/types'
import { EXPORT_TEXT } from '../text'

export type GifCardKind = 'title' | 'option' | 'speed'

export type GifItem =
  | { kind: 'card'; card: GifCardKind; title: string; subtitle: string; delayCs: number }
  | { kind: 'scene'; line: Id[]; t: number; speed: number; delayCs: number }

/** Lines shown by one GIF file: the only line, every line chained, or one leaf (SPEC 9.2). */
export interface GifTarget {
  kind: 'single' | 'chained' | 'leaf'
  lines: Id[][]
}

/** The GIF files of an export: one, or one per leaf (« un GIF par option »). */
export function gifTargets(play: Play, mode: GifLinesMode): GifTarget[] {
  const lines = allLines(play)
  if (lines.length <= 1) return [{ kind: 'single', lines }]
  if (mode === 'chained') return [{ kind: 'chained', lines }]
  return lines.map((line) => ({ kind: 'leaf', lines: [line] }))
}

/** Playback speeds of the passes (D-058): slow then real, or only one of them. */
export function gifSpeeds(mode: GifSpeedMode): number[] {
  if (mode === 'slow') return [GIF_SLOW_SPEED]
  if (mode === 'real') return [1]
  return [GIF_SLOW_SPEED, 1]
}

const cs = (seconds: number): number => Math.round(seconds * 100)

/**
 * Delays of `count` images at `fps`, in hundredths of a second, rounded on the cumulated time so
 * that the frame rate stays exact on average (12 images/s: 8, 9, 8, 8, 9, 8...).
 */
export function frameDelaysCs(count: number, fps: number): number[] {
  return Array.from(
    { length: count },
    (_, f) => Math.round(((f + 1) * 100) / fps) - Math.round((f * 100) / fps),
  )
}

/** Number of intervals of a segment of `duration` seconds played at `speed` (tolerant rounding). */
export function segmentSteps(duration: number, fps: number, speed: number): number {
  return Math.max(0, Math.ceil((duration * fps) / speed - 1e-6))
}

/** Index of the first phase of `line` that is not in `previous` (where an option resumes). */
function divergence(line: readonly Id[], previous: readonly Id[]): number {
  let k = 0
  while (k < line.length && line[k] === previous[k]) k++
  return Math.min(k, line.length - 1)
}

/** Options chosen along a line, for the subtitle of the title card of a « GIF par option ». */
export function lineOptionsText(play: Play, line: readonly Id[]): string {
  const withPhase = optionTitlesNeedPhase(play)
  const parts: string[] = []
  for (let i = 1; i < line.length; i++) {
    const parent = line[i - 1]
    const id = line[i]
    if (parent === undefined || id === undefined || !isBranchPoint(play, parent)) continue
    parts.push(optionTitle(play, id, withPhase))
  }
  return parts.join(' ; ')
}

export function gifTimeline(
  play: Play,
  target: GifTarget,
  speedMode: GifSpeedMode,
  fps: number,
  settings: EngineSettings,
  caches: EvalCaches,
): GifItem[] {
  const subtitle =
    target.kind === 'leaf' && target.lines[0] ? lineOptionsText(play, target.lines[0]) : ''
  const items: GifItem[] = [
    {
      kind: 'card',
      card: 'title',
      title: play.name,
      subtitle,
      delayCs: cs(GIF_DURATIONS.titleCard),
    },
  ]
  const speeds = gifSpeeds(speedMode)
  const withPhase = optionTitlesNeedPhase(play)
  speeds.forEach((speed, passIndex) => {
    if (passIndex > 0) {
      items.push({
        kind: 'card',
        card: 'speed',
        title: speed < 1 ? EXPORT_TEXT.slow : EXPORT_TEXT.real,
        subtitle: '',
        delayCs: cs(GIF_DURATIONS.speedCard),
      })
    }
    target.lines.forEach((line, j) => {
      const compiled = compileLine(play, line, settings, caches)
      let t0 = 0
      const previous = j > 0 ? target.lines[j - 1] : undefined
      if (previous) {
        const k = divergence(line, previous)
        const resumed = line[k]
        if (resumed !== undefined) {
          items.push({
            kind: 'card',
            card: 'option',
            title: optionTitle(play, resumed, withPhase),
            subtitle: '',
            delayCs: cs(GIF_DURATIONS.optionCard),
          })
        }
        t0 = compiled.phases[k]?.start ?? 0
      }
      const steps = segmentSteps(compiled.duration - t0, fps, speed)
      const delays = frameDelaysCs(steps, fps)
      for (let f = 0; f <= steps; f++) {
        items.push({
          kind: 'scene',
          line,
          t: Math.min(compiled.duration, t0 + (f * speed) / fps),
          speed,
          delayCs: delays[f] ?? 0,
        })
      }
      // The last image is held: before the next card, or before the loop (final hold).
      const last = items[items.length - 1]
      const isLastOfAll = passIndex === speeds.length - 1 && j === target.lines.length - 1
      if (last)
        last.delayCs = cs(isLastOfAll ? GIF_DURATIONS.finalHold : GIF_DURATIONS.optionEndHold)
    })
  })
  // A play without phase: the title card alone, held before the loop.
  const only = items.length === 1 ? items[0] : undefined
  if (only) only.delayCs += cs(GIF_DURATIONS.finalHold)
  return items
}

/** Total duration of a GIF plan, in hundredths of a second. */
export function timelineDurationCs(items: readonly GifItem[]): number {
  return items.reduce((sum, item) => sum + item.delayCs, 0)
}
