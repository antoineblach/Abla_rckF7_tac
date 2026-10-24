// Speed profile of a run along its curve (SPEC 5.3, D-105): generalised trapezoid computed on the
// samples of the spline. Cap at each sample: target speed of its segment, and the lateral
// acceleration in turns; forward pass (bounded acceleration), backward pass (bounded braking);
// time of each interval at constant acceleration. Position, speed and the instant of passage at a
// point are closed forms: a continuous playback and a direct jump to t give the same state.
// Pure and deterministic.
import { MIN_CORNER_SPEED, SPEED_FACTOR_SEARCH } from '../config/defaults'
import type { MotionSettings } from '../model/settings'
import type { Vec2 } from '../model/types'
import type { Spline } from './spline'

export interface ProfileInput {
  spline: Spline
  /** Target (peak) speed of each spline segment, in m/s. */
  targets: readonly number[]
  /** Speed at the start (0, or the end speed of the run it prolongs, D-106). */
  startSpeed: number
  /** Ends at the cap of its last sample instead of stopping (« Finit lancée »). */
  endsAtSpeed: boolean
  motion: MotionSettings
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

/** Target speed at sample k: its segment, the slower of both at a waypoint. */
function targetAt(targets: readonly number[], perSegment: number, k: number, last: number): number {
  const segments = targets.length
  if (segments === 0) return 0
  if (k >= last) return targets[segments - 1] ?? 0
  const segment = Math.floor(k / perSegment)
  const own = targets[segment] ?? 0
  if (k % perSegment === 0 && segment > 0) return Math.min(own, targets[segment - 1] ?? own)
  return own
}

export function buildProfile(input: ProfileInput): SpeedProfile {
  const { spline, targets, motion } = input
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
  const caps: number[] = []
  for (let k = 0; k < n; k++) {
    const kappa = curvatureAt(spline.samples, k === 0 ? 1 : k === last ? last - 1 : k)
    const corner = kappa > 0 ? Math.sqrt(motion.lateralAccel / kappa) : Infinity
    caps.push(Math.min(targetAt(targets, perSegment, k, last), Math.max(MIN_CORNER_SPEED, corner)))
  }
  const v = new Array<number>(n).fill(0)
  v[0] = Math.max(0, input.startSpeed)
  for (let k = 0; k < last; k++) {
    const ds = (s[k + 1] ?? 0) - (s[k] ?? 0)
    v[k + 1] = Math.min(caps[k + 1] ?? 0, Math.sqrt((v[k] ?? 0) ** 2 + 2 * motion.accel * ds))
  }
  if (!input.endsAtSpeed) v[last] = 0
  // The imposed start speed wins over braking (continuity, D-106).
  for (let k = last - 1; k >= 1; k--) {
    const ds = (s[k + 1] ?? 0) - (s[k] ?? 0)
    v[k] = Math.min(v[k] ?? 0, Math.sqrt((v[k + 1] ?? 0) ** 2 + 2 * motion.decel * ds))
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

export interface FactorSolution {
  factor: number
  profile: SpeedProfile
  /** 'slow': not reachable in time even at `maxFactor`; 'fast': too early even at the minimum. */
  capped: 'none' | 'slow' | 'fast'
}

/**
 * Common factor on target speeds so that `timeOf(profile)` equals `wanted` (SPEC 5.3). The time
 * decreases with the factor; bisection on its logarithm with a fixed number of iterations, between
 * the minimum factor and `maxFactor` (the cap of the red threshold).
 */
export function solveFactor(
  build: (factor: number) => SpeedProfile,
  timeOf: (profile: SpeedProfile) => number,
  wanted: number,
  maxFactor: number,
): FactorSolution {
  const top = Math.max(maxFactor, SPEED_FACTOR_SEARCH.minFactor)
  const fastest = build(top)
  if (timeOf(fastest) >= wanted) {
    const capped = timeOf(fastest) > wanted + 1e-9 ? 'slow' : 'none'
    return { factor: top, profile: fastest, capped }
  }
  let lo = Math.log(SPEED_FACTOR_SEARCH.minFactor)
  let hi = Math.log(top)
  const slowest = build(Math.exp(lo))
  if (timeOf(slowest) < wanted) {
    return { factor: Math.exp(lo), profile: slowest, capped: 'fast' }
  }
  for (let i = 0; i < SPEED_FACTOR_SEARCH.iterations; i++) {
    const mid = (lo + hi) / 2
    if (timeOf(build(Math.exp(mid))) > wanted) lo = mid
    else hi = mid
  }
  const factor = Math.exp(hi)
  const found = build(factor)
  const time = timeOf(found)
  // The bisection stops a few 1e-15 s away: stretch the time by as much, so that the wanted
  // instant is met exactly (speeds change by the same negligible ratio).
  return { factor, profile: time > 0 ? scaleTime(found, wanted / time) : found, capped: 'none' }
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
