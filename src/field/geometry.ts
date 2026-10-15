// Field geometry in metres (SPEC 13.1, DECISIONS Q1 and Q2). On a reduced field, every line
// keeps its distance to its reference line (Law 1.3): only the gaps between lines shrink.
import { FIELD_MARKINGS } from '../config/defaults'
import type { Vec2 } from '../model/types'

export interface Segment {
  a: Vec2
  b: Vec2
}

export interface FieldDimensions {
  length: number
  width: number
  inGoal: number
}

export interface FieldMarkings {
  /** Playing area plus in-goals. */
  surface: { min: Vec2; max: Vec2 }
  inGoals: { min: Vec2; max: Vec2 }[]
  solid: Segment[]
  /** Dashed lines, already cut into dashes. */
  dashes: Segment[]
  halfwayMark: Segment
  /** Goal posts, two per goal line. */
  posts: Vec2[]
}

const seg = (ax: number, ay: number, bx: number, by: number): Segment => ({
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
})

/** Cuts a straight segment into dashes, starting with a dash at `a`. */
export function cutIntoDashes(line: Segment, dash: number, gap: number): Segment[] {
  const dx = line.b.x - line.a.x
  const dy = line.b.y - line.a.y
  const total = Math.hypot(dx, dy)
  if (total === 0 || dash <= 0) return []
  const ux = dx / total
  const uy = dy / total
  const result: Segment[] = []
  for (let s = 0; s < total; s += dash + gap) {
    const e = Math.min(total, s + dash)
    result.push(seg(line.a.x + ux * s, line.a.y + uy * s, line.a.x + ux * e, line.a.y + uy * e))
  }
  return result
}

export function fieldMarkings(field: FieldDimensions): FieldMarkings {
  const { length: L, width: W, inGoal: G } = field
  const m = FIELD_MARKINGS
  const half = L / 2
  const solid: Segment[] = [
    // Dead-ball lines.
    seg(-G, 0, -G, W),
    seg(L + G, 0, L + G, W),
    // Touch-in-goal lines.
    seg(-G, 0, 0, 0),
    seg(-G, W, 0, W),
    seg(L, 0, L + G, 0),
    seg(L, W, L + G, W),
    // Goal lines.
    seg(0, 0, 0, W),
    seg(L, 0, L, W),
    // 22-metre lines.
    seg(m.line22FromGoal, 0, m.line22FromGoal, W),
    seg(L - m.line22FromGoal, 0, L - m.line22FromGoal, W),
    // Halfway line.
    seg(half, 0, half, W),
    // Touchlines.
    seg(0, 0, L, 0),
    seg(0, W, L, W),
  ]
  const dashedLines: Segment[] = [
    seg(0, m.line5FromTouch, L, m.line5FromTouch),
    seg(0, W - m.line5FromTouch, L, W - m.line5FromTouch),
    seg(0, m.line15FromTouch, L, m.line15FromTouch),
    seg(0, W - m.line15FromTouch, L, W - m.line15FromTouch),
    seg(half - m.line10FromHalfway, 0, half - m.line10FromHalfway, W),
    seg(half + m.line10FromHalfway, 0, half + m.line10FromHalfway, W),
    seg(m.line5FromGoal, 0, m.line5FromGoal, W),
    seg(L - m.line5FromGoal, 0, L - m.line5FromGoal, W),
  ]
  const halfMark = m.halfwayMarkLength / 2
  const postOffset = m.goalPostSpacing / 2
  return {
    surface: { min: { x: -G, y: 0 }, max: { x: L + G, y: W } },
    inGoals: [
      { min: { x: -G, y: 0 }, max: { x: 0, y: W } },
      { min: { x: L, y: 0 }, max: { x: L + G, y: W } },
    ],
    solid,
    dashes: dashedLines.flatMap((line) => cutIntoDashes(line, m.dashLength, m.dashGap)),
    halfwayMark: seg(half - halfMark, W / 2, half + halfMark, W / 2),
    posts: [
      { x: 0, y: W / 2 - postOffset },
      { x: 0, y: W / 2 + postOffset },
      { x: L, y: W / 2 - postOffset },
      { x: L, y: W / 2 + postOffset },
    ],
  }
}

/** Abscissas of the main transverse lines, for tests and documentation. */
export function transverseLines(field: FieldDimensions): Record<string, number[]> {
  const m = FIELD_MARKINGS
  const half = field.length / 2
  return {
    goal: [0, field.length],
    line5: [m.line5FromGoal, field.length - m.line5FromGoal],
    line22: [m.line22FromGoal, field.length - m.line22FromGoal],
    line10: [half - m.line10FromHalfway, half + m.line10FromHalfway],
    halfway: [half],
  }
}
