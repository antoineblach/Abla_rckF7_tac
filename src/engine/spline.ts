// Centripetal Catmull-Rom spline (alpha 0.5) through the control points, reparameterised by
// arc length with a sampled length table (SPEC 5.3). Constant speed along the curve.
import type { Vec2 } from '../model/types'
import { distance, equals, lerp, sub } from './vec'

const ALPHA = 0.5

export interface Spline {
  /** Control points, consecutive duplicates removed. */
  readonly points: readonly Vec2[]
  /** Samples: `samplesPerSegment` per segment, plus the final point. */
  readonly samples: readonly Vec2[]
  /** Cumulative length at each sample (first is 0). */
  readonly cumulative: readonly number[]
  readonly samplesPerSegment: number
  readonly length: number
}

function dedupe(points: readonly Vec2[]): Vec2[] {
  const result: Vec2[] = []
  for (const point of points) {
    const last = result[result.length - 1]
    if (!last || !equals(last, point)) result.push({ x: point.x, y: point.y })
  }
  return result
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

export function buildSpline(input: readonly Vec2[], samplesPerSegment: number): Spline {
  const points = dedupe(input)
  const segments = Math.max(0, points.length - 1)
  const samples: Vec2[] = []
  const cumulative: number[] = []
  if (points.length === 0) {
    return { points, samples, cumulative, samplesPerSegment, length: 0 }
  }
  for (let segment = 0; segment < segments; segment++) {
    for (let j = 0; j < samplesPerSegment; j++) {
      samples.push(segmentPoint(points, segment, j / samplesPerSegment))
    }
  }
  samples.push(points[points.length - 1] as Vec2)
  let total = 0
  cumulative.push(0)
  for (let k = 1; k < samples.length; k++) {
    total += distance(samples[k - 1] as Vec2, samples[k] as Vec2)
    cumulative.push(total)
  }
  return { points, samples, cumulative, samplesPerSegment, length: total }
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
  return segmentPoint(points, segment, Math.min(1, u))
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
