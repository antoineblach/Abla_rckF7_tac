import { describe, expect, it } from 'vitest'
import type { Vec2 } from '../model/types'
import { solvePassArrival } from './pass'
import { distance } from './vec'

/** Actual flight speed when the ball ends on the receiver at the computed arrival time. */
const flightSpeed = (
  from: Vec2,
  releaseT: number,
  arrival: number,
  receiver: (t: number) => Vec2,
) => distance(from, receiver(arrival)) / (arrival - releaseT)

describe('pass arrival by fixed point (SPEC 5.4)', () => {
  it('meets a receiver running across the pass, flight speed within 1 %', () => {
    const from = { x: 0, y: 0 }
    const receiver = (t: number) => ({ x: 7 * t, y: 10 })
    const arrival = solvePassArrival(from, 0, 12, receiver)
    // Exact solution: 12 t = sqrt(49 t² + 100).
    expect(arrival).toBeCloseTo(Math.sqrt(100 / 95), 1)
    expect(Math.abs(flightSpeed(from, 0, arrival, receiver) - 12) / 12).toBeLessThan(0.01)
  })

  it('converges for a receiver sprinting straight away, flight speed within 5 %', () => {
    // Worst case of a 7 m/s receiver: convergence ratio 7/12 per iteration.
    const from = { x: 0, y: 0 }
    const receiver = (t: number) => ({ x: 0, y: 10 + 7 * t })
    const residuals = [1, 2, 3, 4, 5].map((n) =>
      Math.abs(solvePassArrival(from, 0, 12, receiver, n) - 2),
    )
    for (let i = 1; i < residuals.length; i++) {
      expect(residuals[i]).toBeLessThan(residuals[i - 1] ?? Infinity)
    }
    const arrival = solvePassArrival(from, 0, 12, receiver)
    expect(Math.abs(flightSpeed(from, 0, arrival, receiver) - 12) / 12).toBeLessThan(0.05)
  })

  it('is immediate for a still receiver and a null speed', () => {
    expect(solvePassArrival({ x: 0, y: 0 }, 1, 12, () => ({ x: 12, y: 0 }))).toBeCloseTo(2, 12)
    expect(solvePassArrival({ x: 0, y: 0 }, 1, 0, () => ({ x: 12, y: 0 }))).toBe(1)
  })
})
