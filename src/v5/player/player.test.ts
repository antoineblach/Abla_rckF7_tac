import { describe, expect, it } from 'vitest'
import { defaultSettings, engineSettingsOf } from '../../model/settings'
import { createCaches } from '../engine/caches'
import { compileLine, type CompiledLine } from '../engine/timeline'
import type { Play } from '../model/types'
import { basePlay, branch, P, player, run, sevenVsSevenWithOptions, uuid } from '../test/builders'
import { autoFrame } from './framing'
import {
  backToBranchPoint,
  chooseOption,
  initialTransport,
  lineTiming,
  nextEdge,
  pause,
  play,
  previousEdge,
  seek,
  showLine,
  tick,
  type LineTiming,
  type TransportState,
} from './transport'

const settings = engineSettingsOf(defaultSettings())
const scenario = sevenVsSevenWithOptions()
const LINE_A = [P.root, P.optA]
const LINE_B = [P.root, P.optB]

function timingOf(
  line: string[],
  source: Play = scenario,
): { timing: LineTiming; compiled: CompiledLine } {
  const compiled = compileLine(source, line, settings, createCaches())
  return { compiled, timing: lineTiming(compiled) }
}

/** Runs ticks of 1/60 s until playback stops (or a safety limit). */
function runUntilStopped(state: TransportState, timing: LineTiming): TransportState {
  let s = state
  for (let i = 0; i < 10_000 && s.playing; i++) s = tick(s, 1 / 60, timing)
  return s
}

describe('transport (SPEC 7, D-011, D-146)', () => {
  const { timing, compiled } = timingOf(LINE_A)
  const branchAt = compiled.branches[0]?.branchAt ?? NaN

  it('reads the branch points and the edges of the blocks from the compiled line', () => {
    expect(timing.branchPoints).toEqual([{ branchId: P.root, t: branchAt }])
    expect(timing.duration).toBe(compiled.duration)
    expect(timing.edges[0]).toBe(0)
    expect(timing.edges.at(-1)).toBe(compiled.duration)
    for (const span of Object.values(compiled.blocks)) {
      expect(timing.edges).toContain(span.start)
      expect(timing.edges).toContain(span.end)
    }
    expect([...timing.edges].sort((a, b) => a - b)).toEqual(timing.edges)
    expect(new Set(timing.edges).size).toBe(timing.edges.length)
  })

  it('stops at the branch point when « S’arrêter aux options » is on', () => {
    const stopped = runUntilStopped(play(initialTransport(LINE_A), timing), timing)
    expect(stopped.t).toBe(branchAt)
    expect(stopped.waitingAt).toBe(P.root)
    expect(stopped.playing).toBe(false)
    // Choosing option B resumes on line B, from the same instant.
    const chosen = chooseOption(stopped, scenario, P.optB)
    expect(chosen.line).toEqual(LINE_B)
    expect(chosen.playing).toBe(true)
    expect(chosen.t).toBe(branchAt)
    expect(chosen.waitingAt).toBeNull()
    const b = timingOf(LINE_B).timing
    const end = runUntilStopped(chosen, b)
    expect(end.t).toBe(b.duration)
    expect(end.playing).toBe(false)
  })

  it('does not stop again when playback starts at the branch point', () => {
    const atPoint = seek(initialTransport(LINE_A), branchAt, timing)
    const end = runUntilStopped(play(atPoint, timing), timing)
    expect(end.t).toBe(timing.duration)
    expect(end.waitingAt).toBeNull()
  })

  it('follows the default option when « S’arrêter aux options » is off', () => {
    const state = { ...initialTransport(LINE_A), stopAtOptions: false }
    const end = runUntilStopped(play(state, timing), timing)
    expect(end.t).toBe(timing.duration)
    expect(end.waitingAt).toBeNull()
  })

  it('plays at 0.5x, 1x and 2x, loops, and restarts from 0 at the end', () => {
    const base = { ...initialTransport(LINE_A), stopAtOptions: false }
    for (const speed of [0.5, 1, 2] as const) {
      const s = tick(play({ ...base, speed }, timing), 0.1, timing)
      expect(s.t).toBeCloseTo(0.1 * speed, 12)
    }
    const looping = { ...base, loop: true, t: timing.duration - 0.01, playing: true }
    expect(tick(looping, 0.1, timing)).toMatchObject({ t: 0, playing: true })
    const atEnd = { ...base, t: timing.duration }
    expect(play(atEnd, timing).t).toBe(0)
    expect(pause(play(base, timing)).playing).toBe(false)
  })

  it('does not move while paused, nor for a null or negative time step', () => {
    const paused = initialTransport(LINE_A)
    expect(tick(paused, 1, timing)).toBe(paused)
    const playing = play(paused, timing)
    expect(tick(playing, 0, timing)).toBe(playing)
    expect(tick(playing, -1, timing)).toBe(playing)
  })

  it('jumps to the neighbouring edge of a block, and seeks (D-146)', () => {
    const [, second, third] = timing.edges as [number, number, number]
    const first = nextEdge(initialTransport(LINE_A), timing)
    expect(first.t).toBe(second)
    expect(nextEdge(first, timing).t).toBe(third)
    // Between two edges: forward to the next one, back to the previous one.
    const inside = seek(first, (second + third) / 2, timing)
    expect(nextEdge(inside, timing).t).toBe(third)
    expect(previousEdge(inside, timing).t).toBe(second)
    // From an edge, the previous edge is the one before it.
    expect(previousEdge(first, timing).t).toBe(0)
    // Bounded by the line.
    expect(previousEdge(initialTransport(LINE_A), timing).t).toBe(0)
    const end = seek(first, 999, timing)
    expect(end.t).toBe(timing.duration)
    expect(nextEdge(end, timing).t).toBe(timing.duration)
  })

  it('leaves the wait for an option on any jump', () => {
    const waiting = runUntilStopped(play(initialTransport(LINE_A), timing), timing)
    expect(waiting.waitingAt).not.toBeNull()
    expect(nextEdge(waiting, timing).waitingAt).toBeNull()
    expect(previousEdge(waiting, timing).waitingAt).toBeNull()
    expect(seek(waiting, 0, timing).waitingAt).toBeNull()
  })

  it('returns to the branch point to play another option', () => {
    const end = seek(initialTransport(LINE_A), timing.duration, timing)
    const back = backToBranchPoint(end, timing)
    expect(back).toMatchObject({ t: branchAt, playing: false, waitingAt: P.root })
    // Not before the branch point: nothing to go back to.
    const before = seek(initialTransport(LINE_A), branchAt / 2, timing)
    expect(backToBranchPoint(before, timing)).toBe(before)
  })

  it('shows another line with the cursor within its duration (D-142)', () => {
    const b = timingOf(LINE_B).timing
    const at = seek(initialTransport(LINE_A), 3, timing)
    expect(showLine(at, LINE_B, b)).toMatchObject({ line: LINE_B, t: 3, playing: false })
    const end = { ...seek(at, timing.duration, timing), playing: true }
    expect(timing.duration).toBeGreaterThan(b.duration)
    expect(showLine(end, LINE_B, b)).toMatchObject({ t: b.duration, playing: false })
  })
})

describe('branch point at or after the end of the line (D-153)', () => {
  const a1 = uuid(1)
  const withBranchAt = (branchAt: number): Play =>
    basePlay({
      entities: [player(a1, 'A', 1)],
      setup: { positions: { [a1]: { x: 40, y: 35 } }, ballCarrierId: null, ballPosition: null },
      branches: [
        branch(P.root, null, { branchAt }),
        branch(P.optA, P.root, { isDefault: true }),
        branch(P.optB, P.root),
      ],
      actions: [run(uuid(200), a1, [{ x: 44, y: 35 }])],
    })
  const LINE = [P.root, P.optA]
  const duration = timingOf(LINE, withBranchAt(50)).timing.duration

  it('never reaches a branch point after the last action', () => {
    const { timing } = timingOf(LINE, withBranchAt(duration + 1))
    expect(timing.branchPoints).toEqual([])
    const end = runUntilStopped(play(initialTransport(LINE), timing), timing)
    expect(end.t).toBe(duration)
    expect(end.waitingAt).toBeNull()
  })

  it('stops at a branch point exactly at the end of the line', () => {
    const { timing } = timingOf(LINE, withBranchAt(duration))
    const end = runUntilStopped(play(initialTransport(LINE), timing), timing)
    expect(end).toMatchObject({ t: duration, playing: false, waitingAt: P.root })
  })
})

describe('automatic framing (SPEC 7)', () => {
  it('is the bounding box of the line plus 5 m', () => {
    const { compiled } = timingOf(LINE_A)
    const frame = autoFrame(compiled)
    expect(frame?.min).toEqual({ x: 35, y: 0 })
    expect(frame?.max.y).toBe(71)
  })
})
