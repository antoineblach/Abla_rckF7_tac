import { describe, expect, it } from 'vitest'
import { buildSpline, endDirection, pathUpToDistance, pointAtDistance } from './spline'
import { distance } from './vec'

const SAMPLES = 64

describe('centripetal Catmull-Rom spline', () => {
  it('passes through every control point', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: -3 },
      { x: 25, y: 10 },
    ]
    const spline = buildSpline(points, SAMPLES)
    for (let i = 0; i < points.length; i++) {
      const sample = spline.samples[i * SAMPLES]
      expect(sample?.x).toBeCloseTo(points[i]?.x ?? NaN, 9)
      expect(sample?.y).toBeCloseTo(points[i]?.y ?? NaN, 9)
    }
  })

  it('is a straight segment for two points', () => {
    const spline = buildSpline(
      [
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ],
      SAMPLES,
    )
    expect(spline.length).toBeCloseTo(5, 9)
    const mid = pointAtDistance(spline, 2.5)
    expect(mid.x).toBeCloseTo(1.5, 9)
    expect(mid.y).toBeCloseTo(2, 9)
  })

  it('keeps a constant speed along the curve, deviation below 2 % (SPEC 5.3)', () => {
    // Sharp turns on purpose.
    const spline = buildSpline(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 5, y: 3 },
        { x: 6, y: 3.5 },
      ],
      SAMPLES,
    )
    const steps = 400
    const expected = spline.length / steps
    let worst = 0
    let previous = pointAtDistance(spline, 0)
    for (let i = 1; i <= steps; i++) {
      const current = pointAtDistance(spline, (spline.length * i) / steps)
      worst = Math.max(worst, Math.abs(distance(previous, current) - expected) / expected)
      previous = current
    }
    expect(worst).toBeLessThan(0.02)
  })

  it('removes consecutive duplicates and handles a single point', () => {
    const spline = buildSpline(
      [
        { x: 1, y: 1 },
        { x: 1, y: 1 },
        { x: 4, y: 5 },
      ],
      SAMPLES,
    )
    expect(spline.points).toHaveLength(2)
    expect(spline.length).toBeCloseTo(5, 9)
    const single = buildSpline([{ x: 2, y: 2 }], SAMPLES)
    expect(single.length).toBe(0)
    expect(pointAtDistance(single, 3)).toEqual({ x: 2, y: 2 })
  })

  it('clamps distances and returns the traversed polyline', () => {
    const spline = buildSpline(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      SAMPLES,
    )
    expect(pointAtDistance(spline, -1)).toEqual({ x: 0, y: 0 })
    expect(pointAtDistance(spline, 99)).toEqual({ x: 10, y: 0 })
    const half = pathUpToDistance(spline, 5)
    expect(half[0]).toEqual({ x: 0, y: 0 })
    expect(half[half.length - 1]?.x).toBeCloseTo(5, 9)
    expect(endDirection(spline)).toEqual({ x: 1, y: 0 })
  })

  it('gives the input segment of each spline segment, duplicates removed (D-114)', () => {
    const spline = buildSpline(
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 4 },
      ],
      SAMPLES,
    )
    expect(spline.sourceSegments).toEqual([1, 3])
    expect(buildSpline([{ x: 1, y: 1 }], SAMPLES).sourceSegments).toEqual([])
  })

  it('starts in the imposed direction, through the same points (tangent junction, D-106)', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 10 },
    ]
    const plain = buildSpline(points, SAMPLES)
    const joined = buildSpline(points, SAMPLES, { x: 2, y: 0 })
    expect(joined.startDirection).toEqual({ x: 1, y: 0 })
    // It leaves along +x, where the plain curve leaves towards its first point.
    const first = joined.samples[1] ?? { x: NaN, y: NaN }
    expect(Math.abs(first.y / first.x)).toBeLessThan(0.05)
    const plainFirst = plain.samples[1] ?? { x: NaN, y: NaN }
    expect(plainFirst.y / plainFirst.x).toBeGreaterThan(0.5)
    // Same points, same second segment, smooth at the first waypoint.
    expect(pointAtDistance(joined, joined.length)).toEqual({ x: 20, y: 10 })
    expect(joined.samples[SAMPLES]).toEqual({ x: 10, y: 10 })
    expect(joined.samples.slice(SAMPLES)).toEqual(plain.samples.slice(SAMPLES))
    const k = SAMPLES
    const a = joined.samples[k - 1] ?? { x: NaN, y: NaN }
    const b = joined.samples[k] ?? { x: NaN, y: NaN }
    const c = joined.samples[k + 1] ?? { x: NaN, y: NaN }
    const turn = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x)
    expect(Math.abs(turn)).toBeLessThan(0.05)
    // A null or zero direction changes nothing.
    expect(buildSpline(points, SAMPLES, { x: 0, y: 0 })).toEqual(plain)
  })
})
