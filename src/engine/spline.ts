// Centripetal Catmull-Rom spline (alpha 0.5) through the control points, with a sampled arc
// length table (SPEC 5.3); the speed along the curve comes from the speed profile (profile.ts).
// A run that prolongs a run ending at speed starts in its arrival direction: its first segment is
// then a cubic Bézier curve whose tangents are that direction and the Catmull-Rom tangent at its
// first waypoint (D-106).
import type { Vec2 } from '../model/types'
import { distance, equals, lerp, sub } from './vec'

const ALPHA = 0.5

export interface Spline {
  /** Control points, consecutive duplicates removed. */
  readonly points: readonly Vec2[]
  /** Index of the input segment (from input point i to i + 1) of each spline segment. */
  readonly sourceSegments: readonly number[]
  /** Unit direction imposed at the start (tangent junction, D-106), or null. */
  readonly startDirection: Vec2 | null
  /** Samples: `samplesPerSegment` per segment, plus the final point. */
  readonly samples: readonly Vec2[]
  /** Cumulative length at each sample (first is 0). */
  readonly cumulative: readonly number[]
  readonly samplesPerSegment: number
  readonly length: number
}

/** Points without consecutive duplicates, with the input index of each kept point. */
function dedupe(points: readonly Vec2[]): { points: Vec2[]; indices: number[] } {
  const result: Vec2[] = []
  const indices: number[] = []
  points.forEach((point, index) => {
    const last = result[result.length - 1]
    if (!last || !equals(last, point)) {
      result.push({ x: point.x, y: point.y })
      indices.push(index)
    }
  })
  return { points: result, indices }
}

/** Control point i, with reflected phantom points beyond both ends. */
function controlPoint(points: readonly Vec2[], i: number): Vec2 {
  const n = points.length
  const first = points[0] as Vec2
  const last = points[n - 1] as Vec2
  if (i < 0) {
    const next = points[1] ?? first
    return { x: 2 * first.x - next.x, y: 2 * first.y - next.y }
  }
  if (i >= n) {
    const previous = points[n - 2] ?? last
    return { x: 2 * last.x - previous.x, y: 2 * last.y - previous.y }
  }
  return points[i] as Vec2
}

function knot(previous: number, a: Vec2, b: Vec2): number {
  const d = distance(a, b)
  return previous + Math.pow(d, ALPHA)
}

function mix(a: Vec2, b: Vec2, ta: number, tb: number, t: number): Vec2 {
  if (tb - ta === 0) return a
  return lerp(a, b, (t - ta) / (tb - ta))
}

/** Point of segment `segment` (between points[segment] and points[segment+1]) at local u in [0, 1]. */
export function segmentPoint(points: readonly Vec2[], segment: number, u: number): Vec2 {
  const p0 = controlPoint(points, segment - 1)
  const p1 = controlPoint(points, segment)
  const p2 = controlPoint(points, segment + 1)
  const p3 = controlPoint(points, segment + 2)
  const t0 = 0
  const t1 = knot(t0, p0, p1)
  const t2 = knot(t1, p1, p2)
  const t3 = knot(t2, p2, p3)
  if (t2 - t1 === 0) return p1
  const t = t1 + (t2 - t1) * u
  // Barry and Goldman pyramidal formulation.
  const a1 = mix(p0, p1, t0, t1, t)
  const a2 = mix(p1, p2, t1, t2, t)
  const a3 = mix(p2, p3, t2, t3, t)
  const b1 = mix(a1, a2, t0, t2, t)
  const b2 = mix(a2, a3, t1, t3, t)
  return mix(b1, b2, t1, t2, t)
}

/** Unit tangent of the Catmull-Rom curve at points[1] (start of its second segment). */
function tangentAtSecondPoint(points: readonly Vec2[]): Vec2 | null {
  const p0 = points[0]
  const p1 = points[1]
  if (!p0 || !p1) return null
  const ahead = points.length >= 3 ? segmentPoint(points, 1, 1e-4) : null
  const d = ahead ? sub(ahead, p1) : sub(p1, p0)
  const len = Math.hypot(d.x, d.y)
  if (len <= 1e-12) return null
  return { x: d.x / len, y: d.y / len }
}

/** First segment as a cubic Bézier curve leaving in `direction` (D-106). */
function junctionPoint(points: readonly Vec2[], direction: Vec2, u: number): Vec2 {
  const p0 = points[0] as Vec2
  const p3 = points[1] as Vec2
  const reach = distance(p0, p3) / 3
  const end = tangentAtSecondPoint(points) ?? direction
  const p1 = { x: p0.x + direction.x * reach, y: p0.y + direction.y * reach }
  const p2 = { x: p3.x - end.x * reach, y: p3.y - end.y * reach }
  const w = 1 - u
  const a = w * w * w
  const b = 3 * w * w * u
  const c = 3 * w * u * u
  const d = u * u * u
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  }
}

/** Point of spline segment `segment` at local u in [0, 1]. */
function curvePoint(spline: Pick<Spline, 'points' | 'startDirection'>, segment: number, u: number) {
  if (segment === 0 && spline.startDirection && spline.points.length >= 2) {
    return junctionPoint(spline.points, spline.startDirection, u)
  }
  return segmentPoint(spline.points, segment, u)
}

function unit(direction: Vec2 | null | undefined): Vec2 | null {
  if (!direction) return null
  const len = Math.hypot(direction.x, direction.y)
  return len > 1e-12 ? { x: direction.x / len, y: direction.y / len } : null
}

export function buildSpline(
  input: readonly Vec2[],
  samplesPerSegment: number,
  startDirection: Vec2 | null = null,
): Spline {
  const kept = dedupe(input)
  const points = kept.points
  const segments = Math.max(0, points.length - 1)
  const sourceSegments = kept.indices.slice(1).map((index) => index - 1)
  const direction = segments > 0 ? unit(startDirection) : null
  const samples: Vec2[] = []
  const cumulative: number[] = []
  if (points.length === 0) {
    return {
      points,
      sourceSegments,
      startDirection: direction,
      samples,
      cumulative,
      samplesPerSegment,
      length: 0,
    }
  }
  const shape = { points, startDirection: direction }
  for (let segment = 0; segment < segments; segment++) {
    for (let j = 0; j < samplesPerSegment; j++) {
      samples.push(curvePoint(shape, segment, j / samplesPerSegment))
    }
  }
  samples.push(points[points.length - 1] as Vec2)
  let total = 0
  cumulative.push(0)
  for (let k = 1; k < samples.length; k++) {
    total += distance(samples[k - 1] as Vec2, samples[k] as Vec2)
    cumulative.push(total)
  }
  return {
    points,
    sourceSegments,
    startDirection: direction,
    samples,
    cumulative,
    samplesPerSegment,
    length: total,
  }
}

/** Index k such that cumulative[k] <= s < cumulative[k + 1] (clamped). */
function sampleIndex(spline: Spline, s: number): number {
  const c = spline.cumulative
  let lo = 0
  let hi = c.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if ((c[mid] as number) <= s) lo = mid
    else hi = mid
  }
  return lo
}

/** Point at arc length s from the start (clamped to [0, length]). */
export function pointAtDistance(spline: Spline, s: number): Vec2 {
  const { points, samples, cumulative, samplesPerSegment, length } = spline
  const first = points[0]
  if (!first) return { x: 0, y: 0 }
  if (points.length === 1 || s <= 0) return { x: first.x, y: first.y }
  const last = points[points.length - 1] as Vec2
  if (s >= length) return { x: last.x, y: last.y }
  const k = sampleIndex(spline, s)
  const c0 = cumulative[k] as number
  const c1 = cumulative[k + 1] as number
  const fraction = c1 > c0 ? (s - c0) / (c1 - c0) : 0
  const segment = Math.floor(k / samplesPerSegment)
  if (segment >= points.length - 1)
    return lerp(samples[k] as Vec2, samples[k + 1] as Vec2, fraction)
  const u = (k - segment * samplesPerSegment + fraction) / samplesPerSegment
  return curvePoint(spline, segment, Math.min(1, u))
}

/** Polyline of the curve from the start up to arc length s (at least the start point). */
export function pathUpToDistance(spline: Spline, s: number): Vec2[] {
  const first = spline.samples[0]
  if (!first) return []
  if (s >= spline.length) return spline.samples.map((p) => ({ x: p.x, y: p.y }))
  const result: Vec2[] = []
  for (let k = 0; k < spline.samples.length; k++) {
    if ((spline.cumulative[k] as number) >= s) break
    const p = spline.samples[k] as Vec2
    result.push({ x: p.x, y: p.y })
  }
  result.push(pointAtDistance(spline, Math.max(0, s)))
  return result
}

/** Polyline of the curve from arc length s to its end (at least the point at s). */
export function pathFromDistance(spline: Spline, s: number): Vec2[] {
  if (spline.samples.length === 0) return []
  const result: Vec2[] = [pointAtDistance(spline, Math.max(0, s))]
  for (let k = 0; k < spline.samples.length; k++) {
    if ((spline.cumulative[k] as number) <= s) continue
    const p = spline.samples[k] as Vec2
    result.push({ x: p.x, y: p.y })
  }
  return result
}

/** Unit tangent direction at the end of the curve, for arrow heads; null when degenerate. */
export function endDirection(spline: Spline): Vec2 | null {
  const n = spline.samples.length
  if (n < 2) return null
  const end = spline.samples[n - 1] as Vec2
  for (let k = n - 2; k >= 0; k--) {
    const d = sub(end, spline.samples[k] as Vec2)
    const len = Math.hypot(d.x, d.y)
    if (len > 1e-6) return { x: d.x / len, y: d.y / len }
  }
  return null
}
