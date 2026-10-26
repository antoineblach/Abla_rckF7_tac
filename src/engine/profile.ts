// Speed profile of a run along its curve (SPEC 5.3, D-105, D-135) computed on the samples of the
// spline. Cap at each sample: target speed of its segment, and the lateral acceleration in turns;
// forward pass with the acceleration a(v) = a0 (1 − v / vmax) of the sprint model of Samozino et
// al. (2016), backward pass with a bounded braking; each interval is then run at the constant
// acceleration between its two speeds. Position, speed and the instant of passage at a point are
// closed forms: a continuous playback and a direct jump to t give the same state.
// Pure and deterministic.
import {
  MIN_CORNER_SPEED,
  PROFILE_NEWTON_ITERATIONS,
  SPEED_FACTOR_SEARCH,
  TOP_SPEED_TARGET_RATIO,
} from '../config/defaults'
import type { MotionSettings } from '../model/settings'
import type { Vec2 } from '../model/types'
import type { Spline } from './spline'

export interface ProfileInput {
  spline: Spline
  /** Target (peak) speed of each spline segment, in m/s. */
  targets: readonly number[]
  /**
   * Time scale k of each spline segment, 1 when absent (D-130): its target speed, asymptote and
   * lowest corner speed ×k, its accelerations (start, braking, lateral) ×k². A run scaled as a
   * whole is the same run played k times faster.
   */
  boundScale?: readonly number[]
  /** Speed at the start (0, or the end speed of the run it prolongs, D-106). */
  startSpeed: number
  /** Ends at the cap of its last sample instead of stopping (« Finit lancée »). */
  endsAtSpeed: boolean
  motion: MotionSettings
  /** Sprint pace: a slower target starts with a proportionally lower acceleration (D-135). */
  sprint: number
}

export interface SpeedProfile {
  /** Arc length at each sample (the cumulative lengths of the spline). */
  readonly s: readonly number[]
  /** Speed at each sample. */
  readonly v: readonly number[]
  /** Time from the start of the motion at each sample. */
  readonly t: readonly number[]
  readonly duration: number
  readonly length: number
  readonly samplesPerSegment: number
}

/** Curvature at sample k, from the circle through three neighbouring samples (0 at the ends). */
function curvatureAt(samples: readonly Vec2[], k: number): number {
  const a = samples[k - 1]
  const b = samples[k]
  const c = samples[k + 1]
  if (!a || !b || !c) return 0
  const ab = Math.hypot(b.x - a.x, b.y - a.y)
  const bc = Math.hypot(c.x - b.x, c.y - b.y)
  const ca = Math.hypot(a.x - c.x, a.y - c.y)
  const product = ab * bc * ca
  if (product <= 1e-12) return 0
  const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
  return (2 * Math.abs(cross)) / product
}

/** Bounds of a spline segment, time scale included. */
interface SegmentBounds {
  target: number
  /** Acceleration from rest a0. */
  accel: number
  /** Asymptote vmax of the acceleration. */
  asymptote: number
  decel: number
  lateralAccel: number
  minCornerSpeed: number
}

function segmentBounds(input: ProfileInput, segment: number): SegmentBounds {
  const { motion } = input
  const target = input.targets[segment] ?? 0
  const k = input.boundScale?.[segment] ?? 1
  // Walk and jog start more gently (Q14); a target near the top speed raises the asymptote (Q13).
  const startRatio = input.sprint > 0 ? Math.min(1, target / input.sprint) : 1
  return {
    target: target * k,
    accel: motion.accel * startRatio * k * k,
    asymptote: Math.max(motion.topSpeed, target / TOP_SPEED_TARGET_RATIO) * k,
    decel: motion.decel * k * k,
    lateralAccel: motion.lateralAccel * k * k,
    minCornerSpeed: MIN_CORNER_SPEED * k,
  }
}

/** Cap of a sample of curvature kappa within a segment: its target, slower in a turn. */
function capOf(bounds: SegmentBounds, kappa: number): number {
  const corner = kappa > 0 ? Math.sqrt(bounds.lateralAccel / kappa) : Infinity
  return Math.min(bounds.target, Math.max(bounds.minCornerSpeed, corner))
}

/**
 * Speed at the end of an interval of length ds run from speed v0 at the acceleration
 * a(v) = a0 (1 − v / vmax), zero beyond vmax, without exceeding the cap (D-135).
 */
function accelerate(v0: number, ds: number, cap: number, a0: number, vmax: number): number {
  if (cap <= v0 || v0 >= vmax || a0 <= 0 || ds <= 0) return Math.min(cap, v0)
  // Distance from v0 to v1: tau (vmax ln((vmax − v0) / (vmax − v1)) − (v1 − v0)), tau = vmax / a0.
  const span = (vmax * vmax) / a0
  if (cap < vmax && span * (Math.log((vmax - v0) / (vmax - cap)) - (cap - v0) / vmax) <= ds) {
    return cap
  }
  // Newton on w = ln((vmax − v1) / vmax): the distance is span (w0 − w − e^w0 + e^w), convex and
  // decreasing in w. Started on the side of the faster speeds (the constant acceleration a(v0)
  // overshoots, a(v) decreasing), it converges monotonically.
  const w0 = Math.log1p(-v0 / vmax)
  const e0 = 1 - v0 / vmax
  const estimate = Math.sqrt(v0 * v0 + 2 * a0 * e0 * ds)
  const lowest = w0 - e0 - ds / span
  let w = estimate < vmax ? Math.max(lowest, Math.log1p(-estimate / vmax)) : lowest
  for (let i = 0; i < PROFILE_NEWTON_ITERATIONS; i++) {
    const ew = Math.exp(w)
    w -= (span * (w0 - w - e0 + ew) - ds) / (span * (ew - 1))
  }
  return Math.min(cap, -vmax * Math.expm1(w))
}

export function buildProfile(input: ProfileInput): SpeedProfile {
  const { spline } = input
  const s = spline.cumulative
  const n = s.length
  const perSegment = spline.samplesPerSegment
  if (n < 2 || spline.length <= 0) {
    return {
      s: n === 0 ? [0] : s,
      v: new Array<number>(Math.max(1, n)).fill(0),
      t: new Array<number>(Math.max(1, n)).fill(0),
      duration: 0,
      length: 0,
      samplesPerSegment: perSegment,
    }
  }
  const last = n - 1
  const segments = Math.max(1, input.targets.length)
  const bounds = Array.from({ length: segments }, (_, j) => segmentBounds(input, j))
  /** Segment of interval k, from sample k to sample k + 1. */
  const segmentOf = (k: number): SegmentBounds =>
    bounds[Math.min(Math.floor(k / perSegment), segments - 1)] ?? segmentBounds(input, 0)
  const caps: number[] = []
  for (let k = 0; k < n; k++) {
    const kappa = curvatureAt(spline.samples, k === 0 ? 1 : k === last ? last - 1 : k)
    const own = capOf(segmentOf(Math.min(k, last - 1)), kappa)
    // At a waypoint, the slower of both segments.
    caps.push(
      k > 0 && k < last && k % perSegment === 0
        ? Math.min(own, capOf(segmentOf(k - 1), kappa))
        : own,
    )
  }
  const v = new Array<number>(n).fill(0)
  v[0] = Math.max(0, input.startSpeed)
  for (let k = 0; k < last; k++) {
    const ds = (s[k + 1] ?? 0) - (s[k] ?? 0)
    const { accel, asymptote } = segmentOf(k)
    v[k + 1] = accelerate(v[k] ?? 0, ds, caps[k + 1] ?? 0, accel, asymptote)
  }
  if (!input.endsAtSpeed) v[last] = 0
  // The imposed start speed wins over braking (continuity, D-106).
  for (let k = last - 1; k >= 1; k--) {
    const ds = (s[k + 1] ?? 0) - (s[k] ?? 0)
    v[k] = Math.min(v[k] ?? 0, Math.sqrt((v[k + 1] ?? 0) ** 2 + 2 * segmentOf(k).decel * ds))
  }
  const t = [0]
  for (let k = 0; k < last; k++) {
    const ds = (s[k + 1] ?? 0) - (s[k] ?? 0)
    const sum = (v[k] ?? 0) + (v[k + 1] ?? 0)
    t.push((t[k] ?? 0) + (sum > 0 ? (2 * ds) / sum : 0))
  }
  return {
    s,
    v,
    t,
    duration: t[last] ?? 0,
    length: spline.length,
    samplesPerSegment: perSegment,
  }
}

/** Interval k such that t[k] <= time < t[k + 1] (clamped). */
function intervalAtTime(profile: SpeedProfile, time: number): number {
  const t = profile.t
  let lo = 0
  let hi = t.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if ((t[mid] ?? 0) <= time) lo = mid
    else hi = mid
  }
  return lo
}

/** Constant acceleration of interval k. */
function accelOf(profile: SpeedProfile, k: number): number {
  const ds = (profile.s[k + 1] ?? 0) - (profile.s[k] ?? 0)
  if (ds <= 0) return 0
  return ((profile.v[k + 1] ?? 0) ** 2 - (profile.v[k] ?? 0) ** 2) / (2 * ds)
}

/** Arc length covered `time` seconds after the start of the motion (clamped). */
export function distanceAt(profile: SpeedProfile, time: number): number {
  if (time <= 0 || profile.length <= 0) return 0
  if (time >= profile.duration) return profile.length
  const k = intervalAtTime(profile, time)
  const tau = time - (profile.t[k] ?? 0)
  const s = (profile.s[k] ?? 0) + (profile.v[k] ?? 0) * tau + 0.5 * accelOf(profile, k) * tau * tau
  return Math.min(Math.max(s, profile.s[k] ?? 0), profile.s[k + 1] ?? profile.length)
}

/** Speed `time` seconds after the start of the motion (0 before and after it). */
export function speedAt(profile: SpeedProfile, time: number): number {
  if (time < 0 || time > profile.duration || profile.length <= 0) return 0
  if (time === profile.duration) return profile.v[profile.v.length - 1] ?? 0
  const k = intervalAtTime(profile, time)
  const tau = time - (profile.t[k] ?? 0)
  return Math.max(0, (profile.v[k] ?? 0) + accelOf(profile, k) * tau)
}

/** Time from the start of the motion at which arc length `distance` is reached (inverse). */
export function timeAtDistance(profile: SpeedProfile, distance: number): number {
  const s = profile.s
  if (distance <= 0) return 0
  if (distance >= profile.length) return profile.duration
  let lo = 0
  let hi = s.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if ((s[mid] ?? 0) <= distance) lo = mid
    else hi = mid
  }
  const delta = distance - (s[lo] ?? 0)
  const v0 = profile.v[lo] ?? 0
  // Stable root of s0 + v0 tau + a tau² / 2 = distance.
  const root = Math.sqrt(Math.max(0, v0 * v0 + 2 * accelOf(profile, lo) * delta))
  const denominator = v0 + root
  return (profile.t[lo] ?? 0) + (denominator > 0 ? (2 * delta) / denominator : 0)
}

/** Time from the start of the motion at which it reaches the end of spline segment `segment`. */
export function timeAtSegmentEnd(profile: SpeedProfile, segment: number): number {
  const k = Math.min((segment + 1) * profile.samplesPerSegment, profile.t.length - 1)
  return profile.t[k] ?? profile.duration
}

/** Highest speed reached on spline segment `segment` (its peak, SPEC 5.9). */
export function segmentPeak(profile: SpeedProfile, segment: number): number {
  const first = segment * profile.samplesPerSegment
  const last = Math.min(first + profile.samplesPerSegment, profile.v.length - 1)
  let peak = 0
  for (let k = first; k <= last; k++) peak = Math.max(peak, profile.v[k] ?? 0)
  return peak
}

/** Speed at the end of the motion: 0, or the speed of a run ending at speed. */
export function endSpeedOf(profile: SpeedProfile): number {
  return profile.v[profile.v.length - 1] ?? 0
}

export interface LeverSolution {
  /** Common factor f on the target speeds (lever 1). */
  factor: number
  /** Time scale k of the same segments (lever 2), 1 when lever 1 is enough. */
  timeScale: number
  profile: SpeedProfile
  /**
   * 'met': the wanted instant is met; 'beyond': too late even at the largest time scale;
   * 'slowest': too early even at the smallest factor.
   */
  status: 'met' | 'beyond' | 'slowest'
}

/**
 * Two levers so that `timeOf(profile)` equals `wanted` (D-130); the time decreases with each.
 * Lever 1, a common factor f on the target speeds, bounds unchanged: alone to slow down, and to
 * speed up until `switchFactor`, where the fastest target reaches the top speed of the player.
 * Lever 2 beyond, the time scale k >= 1 of the segments (`ProfileInput.boundScale`). Bisection on
 * log f, then on log k, with a fixed number of iterations.
 */
export function solveLevers(
  build: (factor: number, timeScale: number) => SpeedProfile,
  timeOf: (profile: SpeedProfile) => number,
  wanted: number,
  switchFactor: number,
): LeverSolution {
  const { iterations, minFactor, maxTimeScale } = SPEED_FACTOR_SEARCH
  const top = Math.max(switchFactor, minFactor)
  /** Bisection between e^lo (too late) and e^hi (in time) of `at`; returns the side in time. */
  const bisect = (lo: number, hi: number, at: (x: number) => SpeedProfile): number => {
    for (let i = 0; i < iterations; i++) {
      const mid = (lo + hi) / 2
      if (timeOf(at(Math.exp(mid))) > wanted) lo = mid
      else hi = mid
    }
    return Math.exp(hi)
  }
  /** The solution found, stretched by the few 1e-15 s the bisection leaves. */
  const exact = (factor: number, timeScale: number): LeverSolution => {
    const found = build(factor, timeScale)
    const time = timeOf(found)
    const profile = time > 0 ? scaleTime(found, wanted / time) : found
    return { factor, timeScale, profile, status: 'met' }
  }
  if (timeOf(build(top, 1)) <= wanted) {
    const slowest = build(minFactor, 1)
    if (timeOf(slowest) < wanted) {
      return { factor: minFactor, timeScale: 1, profile: slowest, status: 'slowest' }
    }
    return exact(
      bisect(Math.log(minFactor), Math.log(top), (f) => build(f, 1)),
      1,
    )
  }
  const fastest = build(top, maxTimeScale)
  if (timeOf(fastest) > wanted) {
    return { factor: top, timeScale: maxTimeScale, profile: fastest, status: 'beyond' }
  }
  return exact(
    top,
    bisect(0, Math.log(maxTimeScale), (k) => build(top, k)),
  )
}

/** Profile stretched to last exactly `duration` (a solved factor or a late relayer). */
export function withDuration(profile: SpeedProfile, duration: number): SpeedProfile {
  if (profile.duration <= 0) return profile
  const scaled = scaleTime(profile, duration / profile.duration)
  const t = [...scaled.t]
  t[t.length - 1] = duration
  return { ...scaled, t, duration }
}

/** Profile run `ratio` times slower: times multiplied, speeds divided by the ratio. */
export function scaleTime(profile: SpeedProfile, ratio: number): SpeedProfile {
  return {
    ...profile,
    t: profile.t.map((t) => t * ratio),
    v: profile.v.map((v) => v / ratio),
    duration: profile.duration * ratio,
  }
}
