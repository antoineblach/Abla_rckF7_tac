import { describe, expect, it } from 'vitest'
import { CAPTION_SIZES } from '../config/defaults'
import { createRecordingContext, paintEvents } from '../test/recordingCtx'
import {
  dressingHeightPx,
  drawCard,
  drawDressing,
  drawHeader,
  headerHeightPx,
  smallestTextCss,
} from './captions'
import { bannerHeightPx } from './primitives'
import { THEMES } from './themes'

const frame = { widthPx: 540, heightPx: 960, pixelRatio: 1.5 }
const theme = THEMES.highContrast

const fontSize = (font: unknown): number => Number(/(\d+(?:\.\d+)?)px/.exec(String(font))?.[1])

describe('export dressing (SPEC 9.2, D-060)', () => {
  it('draws the phase label on the left and the badge on the right of the header', () => {
    const { ctx, calls } = createRecordingContext()
    drawHeader(ctx, frame, theme, 'Temps 3, option B', 'Vitesse réelle')
    const events = paintEvents(calls)
    const band = events[0]
    expect(band?.kind).toBe('fillRect')
    expect(band?.args).toEqual([0, 0, 540, CAPTION_SIZES.headerHeight * 1.5])
    expect(band?.color).toBe(theme.bannerBackground)
    const badge = events.find((e) => e.kind === 'fillRect' && e.color === theme.badgeBackground)
    expect(badge).toBeDefined()
    const texts = events.filter((e) => e.kind === 'fillText')
    expect(texts.map((e) => e.args[0])).toEqual(['Vitesse réelle', 'Temps 3, option B'])
    const [badgeText, label] = texts
    expect(badgeText?.color).toBe(theme.badgeText)
    expect(label?.color).toBe(theme.bannerText)
    expect(label?.args[1]).toBe(CAPTION_SIZES.sideMargin * 1.5)
    expect(badgeText?.args[1] as number).toBeGreaterThan(540 / 2)
  })

  it('keeps the banner height whatever the instruction, so that the field never moves', () => {
    const heights = [
      '',
      'Fixer',
      'Une consigne bien plus longue qui tient sur deux lignes au moins, et même plus',
    ].map((instruction) => {
      const { ctx, calls } = createRecordingContext()
      drawDressing(ctx, frame, theme, 'Temps 1', 'Ralenti', instruction, 2)
      const banner = paintEvents(calls).find(
        (e) => e.kind === 'fillRect' && e.args[1] === headerHeightPx(frame),
      )
      return banner?.args[3]
    })
    expect(new Set(heights).size).toBe(1)
    expect(heights[0]).toBeCloseTo(bannerHeightPx(frame, theme, 2), 3)
    expect(dressingHeightPx(frame, theme, 2)).toBeCloseTo(
      headerHeightPx(frame) + bannerHeightPx(frame, theme, 2),
      9,
    )
    expect(dressingHeightPx(frame, theme, 0)).toBe(headerHeightPx(frame))
  })

  it('wraps a long card title on several lines, centred, with its subtitle', () => {
    const { ctx, calls } = createRecordingContext()
    drawCard(
      ctx,
      frame,
      theme,
      'Option B : la défense monte vite sur le centre, se resserre et laisse un grand espace ' +
        'au large, où la dernière attaquante arrive lancée pour prendre le ballon',
      'Temps 3',
    )
    const events = paintEvents(calls)
    expect(events[0]?.args).toEqual([0, 0, 540, 960])
    const texts = events.filter((e) => e.kind === 'fillText')
    expect(texts.length).toBeGreaterThanOrEqual(3)
    expect(texts.length).toBeLessThanOrEqual(CAPTION_SIZES.cardMaxLines + 2)
    expect(texts[texts.length - 1]?.args[0]).toBe('Temps 3')
    for (const text of texts) expect(text.args[1]).toBe(270)
    const ys = texts.map((e) => e.args[2] as number)
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(480, -1)
  })

  it('never writes a text smaller than the smallest text of the theme', () => {
    expect(smallestTextCss(THEMES.highContrast)).toBe(14)
    expect(smallestTextCss(THEMES.screen)).toBe(12)
    const { ctx, calls } = createRecordingContext()
    drawCard(ctx, frame, theme, 'Croisée au centre', 'Option B')
    drawDressing(ctx, frame, theme, 'Temps 2', 'Ralenti', 'Fixer puis passer', 2)
    const sizes = paintEvents(calls)
      .filter((e) => e.kind === 'fillText')
      .map((e) => fontSize(e.font))
    expect(sizes.length).toBeGreaterThan(0)
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(smallestTextCss(theme) * 1.5)
  })
})
