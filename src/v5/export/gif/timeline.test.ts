import { describe, expect, it } from 'vitest'
import { defaultSettings, engineSettingsOf, type GifLinesMode } from '../../../model/settings'
import { createCaches } from '../../engine/caches'
import { compileLine } from '../../engine/timeline'
import { allLines } from '../../model/branches'
import type { Play } from '../../model/types'
import {
  basePlay,
  branch,
  P,
  player,
  run,
  sevenVsSevenWithOptions,
  uuid,
} from '../../test/builders'
import { TWO_POINTS, twoBranchPointsPlay } from '../../test/exportFixtures'
import { paletteSample } from './encode'
import {
  frameDelaysCs,
  gifTargets,
  gifTimeline,
  segmentSteps,
  timelineDurationCs,
  type GifItem,
  type GifTarget,
} from './timeline'

const settings = engineSettingsOf(defaultSettings())
const fixture = sevenVsSevenWithOptions()

const cards = (items: GifItem[]) =>
  items.filter((i): i is Extract<GifItem, { kind: 'card' }> => i.kind === 'card')
const sceneT = (item: GifItem | undefined): number => (item?.kind === 'scene' ? item.t : -1)
const targetOf = (play: Play, mode: GifLinesMode, index = 0): GifTarget => {
  const target = gifTargets(play, mode)[index]
  if (!target) throw new Error('no GIF target')
  return target
}

const scenes = (items: GifItem[]) =>
  items.filter((i): i is Extract<GifItem, { kind: 'scene' }> => i.kind === 'scene')

describe('GIF plan (SPEC 9.2, D-058, D-059)', () => {
  it('counts the images of a chained two-speed GIF as computed', () => {
    const caches = createCaches()
    const fps = 12
    const [lineA, lineB] = allLines(fixture) as [string[], string[]]
    const compiledA = compileLine(fixture, lineA, settings, caches)
    const compiledB = compileLine(fixture, lineB, settings, caches)
    const resumeB = compiledB.branches[1]?.start ?? 0
    expect(resumeB).toBeGreaterThan(0)
    // Each segment: ⌈D·f/s⌉ + 1 images; one option card per pass; title and speed cards.
    const pass = (s: number) =>
      Math.ceil((compiledA.duration * fps) / s) +
      1 +
      1 +
      Math.ceil(((compiledB.duration - resumeB) * fps) / s) +
      1
    const items = gifTimeline(
      fixture,
      targetOf(fixture, 'chained', 0),
      'both',
      fps,
      settings,
      caches,
    )
    expect(items.length).toBe(1 + pass(0.5) + 1 + pass(1))
    expect(cards(items).map((c) => c.card)).toEqual(['title', 'option', 'speed', 'option'])
    expect(cards(items).map((c) => c.title)).toEqual([
      'Croisée au centre',
      'Option B : Défense montée',
      'Vitesse réelle',
      'Option B : Défense montée',
    ])
  })

  it('gives the cards, holds and final pause their durations, at an exact frame rate', () => {
    for (const fps of [12, 15, 8]) {
      const items = gifTimeline(
        fixture,
        targetOf(fixture, 'chained', 0),
        'both',
        fps,
        settings,
        createCaches(),
      )
      expect(items[0]?.delayCs).toBe(150)
      for (const [i, item] of items.entries()) {
        if (item.kind !== 'card') continue
        if (item.card === 'option') expect(item.delayCs).toBe(200)
        if (item.card === 'speed') expect(item.delayCs).toBe(100)
        // The last image before every card (except the title) is held 1 s (D-059).
        if (i > 0) expect(items[i - 1]?.delayCs).toBe(100)
      }
      expect(items[items.length - 1]?.delayCs).toBe(200)
      // Within a segment, the delays add up to the exact duration of its images.
      let segment: number[] = []
      const segments: number[][] = []
      for (const item of items) {
        if (item.kind === 'scene') segment.push(item.delayCs)
        else if (segment.length > 0) {
          segments.push(segment)
          segment = []
        }
      }
      segments.push(segment)
      for (const images of segments) {
        const moving = images.slice(0, -1)
        expect(moving.reduce((a, b) => a + b, 0)).toBe(Math.round((moving.length * 100) / fps))
        for (const d of moving) expect([Math.floor(100 / fps), Math.ceil(100 / fps)]).toContain(d)
      }
    }
  })

  it('computes cumulated delays and tolerant segment lengths', () => {
    expect(frameDelaysCs(12, 12).reduce((a, b) => a + b, 0)).toBe(100)
    expect(frameDelaysCs(12, 12).slice(0, 6)).toEqual([8, 9, 8, 8, 9, 8])
    expect(frameDelaysCs(15, 15).reduce((a, b) => a + b, 0)).toBe(100)
    expect(segmentSteps(2, 12, 1)).toBe(24)
    expect(segmentSteps(2.0000000001, 12, 1)).toBe(24)
    expect(segmentSteps(2, 12, 0.5)).toBe(48)
    expect(segmentSteps(0, 12, 1)).toBe(0)
  })

  it('resumes each option at the instant of the branch point where it leaves the previous line', () => {
    const caches = createCaches()
    const items = gifTimeline(
      fixture,
      targetOf(fixture, 'chained', 0),
      'real',
      12,
      settings,
      caches,
    )
    const card = items.findIndex((i) => i.kind === 'card' && i.card === 'option')
    const resumed = items[card + 1]
    const lineB = allLines(fixture)[1] ?? []
    expect(resumed).toMatchObject({ kind: 'scene', line: lineB })
    const compiledB = compileLine(fixture, lineB, settings, caches)
    expect(sceneT(resumed)).toBeCloseTo(compiledB.branches[0]?.branchAt ?? -1, 9)
    expect(lineB).toContain(P.optB)
    expect(allLines(fixture)[0]).toContain(P.optA)

    const play = twoBranchPointsPlay()
    const two = gifTimeline(play, targetOf(play, 'chained', 0), 'real', 12, settings, caches)
    const optionCards = two.flatMap((item, i) =>
      item.kind === 'card' && item.card === 'option' ? [i] : [],
    )
    // Without the prefix « À 4,5 s, » until frise-4.
    expect(optionCards.map((i) => (two[i]?.kind === 'card' ? two[i].title : ''))).toEqual([
      'Option B : Montée',
      'Option B : Serré',
    ])
    const deep = compileLine(
      play,
      [TWO_POINTS.root, TWO_POINTS.large, TWO_POINTS.deep],
      settings,
      caches,
    )
    const resumedAt = optionCards.map((i) => sceneT(two[i + 1]))
    expect(resumedAt[0]).toBeCloseTo(deep.branches[1]?.branchAt ?? -1, 9)
    expect(resumedAt[1]).toBeCloseTo(deep.branches[0]?.branchAt ?? -1, 9)
  })

  it('bounds the resumption by the duration of the option (D-153)', () => {
    const a1 = uuid(1)
    const play = basePlay({
      name: 'Option vide',
      entities: [player(a1, 'A', 1)],
      setup: { positions: { [a1]: { x: 40, y: 35 } }, ballCarrierId: null, ballPosition: null },
      branches: [
        branch(P.root, null, { branchAt: 50 }),
        branch(P.optA, P.root, { isDefault: true }),
        branch(P.optB, P.root),
      ],
      actions: [run(uuid(200), a1, [{ x: 44, y: 35 }])],
    })
    const caches = createCaches()
    const duration = compileLine(play, [P.root, P.optB], settings, caches).duration
    const items = gifTimeline(play, targetOf(play, 'chained', 0), 'real', 12, settings, caches)
    const card = items.findIndex((i) => i.kind === 'card' && i.card === 'option')
    // A single image after the card: the end of the line, held.
    expect(items.slice(card + 1).map(sceneT)).toEqual([duration])
    expect(items.at(-1)?.delayCs).toBe(200)
  })

  it('plays the slow speed only or the real speed only, without a speed card', () => {
    const target = targetOf(fixture, 'chained', 0)
    for (const [mode, speed] of [
      ['slow', 0.5],
      ['real', 1],
    ] as const) {
      const items = gifTimeline(fixture, target, mode, 12, settings, createCaches())
      expect(cards(items).some((c) => c.card === 'speed')).toBe(false)
      expect(new Set(scenes(items).map((s) => s.speed))).toEqual(new Set([speed]))
    }
    const both = gifTimeline(fixture, target, 'both', 12, settings, createCaches())
    const slow = gifTimeline(fixture, target, 'slow', 12, settings, createCaches())
    const real = gifTimeline(fixture, target, 'real', 12, settings, createCaches())
    expect(both.length).toBe(slow.length + real.length)
    expect(timelineDurationCs(both)).toBeGreaterThan(timelineDurationCs(real))
  })

  it('makes one GIF per leaf, without option card, the option as the title subtitle', () => {
    const targets = gifTargets(fixture, 'perLeaf')
    expect(targets.map((t) => t.kind)).toEqual(['leaf', 'leaf'])
    const subtitles = targets.map((target) => {
      const items = gifTimeline(fixture, target, 'both', 12, settings, createCaches())
      expect(cards(items).filter((c) => c.card === 'option')).toHaveLength(0)
      expect(new Set(scenes(items).map((s) => s.line.join()))).toEqual(
        new Set([target.lines[0]?.join()]),
      )
      return items[0]?.kind === 'card' ? items[0].subtitle : ''
    })
    expect(subtitles).toEqual(['Option A : Défense en retrait', 'Option B : Défense montée'])
    const play = twoBranchPointsPlay()
    const deep = gifTimeline(
      play,
      targetOf(play, 'perLeaf', 1),
      'real',
      12,
      settings,
      createCaches(),
    )
    expect(deep[0]?.kind === 'card' ? deep[0].subtitle : '').toBe(
      'Option A : Large ; Option B : Montée',
    )
  })

  it('makes a single GIF for a play with one line, whatever the mode', () => {
    const single = basePlay({ id: uuid(77) })
    expect(gifTargets(single, 'chained')).toEqual([{ kind: 'single', lines: allLines(single) }])
    expect(gifTargets(single, 'perLeaf')).toEqual([{ kind: 'single', lines: allLines(single) }])
    const items = gifTimeline(
      single,
      targetOf(single, 'chained', 0),
      'real',
      12,
      settings,
      createCaches(),
    )
    expect(items.map((i) => i.kind)).toEqual(['card', 'scene'])
    expect(items[1]?.delayCs).toBe(200)
  })

  it('samples the palette on the first card of each kind and twelve scenes at most', () => {
    const items = gifTimeline(
      fixture,
      targetOf(fixture, 'chained', 0),
      'both',
      12,
      settings,
      createCaches(),
    )
    const sample = paletteSample(items)
    const sampledCards = sample.filter((i) => items[i]?.kind === 'card')
    const sampledScenes = sample.filter((i) => items[i]?.kind === 'scene')
    expect(sampledCards.map((i) => (items[i]?.kind === 'card' ? items[i].card : ''))).toEqual([
      'title',
      'option',
      'speed',
    ])
    expect(sampledScenes).toHaveLength(12)
    expect(sampledScenes[0]).toBe(items.findIndex((i) => i.kind === 'scene'))
    expect(sampledScenes[11]).toBe(items.length - 1)
  })
})
