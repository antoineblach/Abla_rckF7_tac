import { describe, expect, it } from 'vitest'
import { createCaches } from '../engine/caches'
import { compileLine, type CompiledLine } from '../engine/timeline'
import { defaultSettings, engineSettingsOf } from '../model/settings'
import { P, sevenVsSevenWithOptions } from '../test/builders'
import { autoFrame } from './framing'
import {
  backToBranchPoint,
  chooseOption,
  initialTransport,
  nextPhase,
  pause,
  phaseIndexAtTime,
  play,
  previousPhase,
  seek,
  showPhase,
  tick,
  type LineTiming,
  type TransportState,
} from './transport'

const settings = engineSettingsOf(defaultSettings())
const scenario = sevenVsSevenWithOptions()
const LINE_A = [P.t1, P.t2, P.t3a]
const LINE_B = [P.t1, P.t2, P.t3b]

function timingOf(line: string[]): { timing: LineTiming; compiled: CompiledLine } {
  const compiled = compileLine(scenario, line, settings, createCaches())
  return {
    compiled,
    timing: {
      phaseIds: compiled.phases.map((p) => p.phaseId),
      starts: compiled.phases.map((p) => p.start),
      ends: compiled.phases.map((p) => p.end),
      duration: compiled.duration,
    },
  }
}

/** Runs ticks of 1/60 s until playback stops (or a safety limit). */
function runUntilStopped(state: TransportState, timing: LineTiming): TransportState {
  let s = state
  for (let i = 0; i < 10_000 && s.playing; i++) s = tick(s, 1 / 60, timing, scenario)
  return s
}

describe('transport (SPEC 7, D-011)', () => {
  const { timing } = timingOf(LINE_A)
  const t2End = timing.ends[1] ?? 0

  it('stops at the branch point when « S’arrêter aux options » is on', () => {
    const stopped = runUntilStopped(play(initialTransport(LINE_A), timing), timing)
    expect(stopped.t).toBe(t2End)
    expect(stopped.waitingAt).toBe(P.t2)
    // Choosing option B resumes on line B.
    const chosen = chooseOption(stopped, scenario, P.t3b)
    expect(chosen.line).toEqual(LINE_B)
    expect(chosen.playing).toBe(true)
    const b = timingOf(LINE_B).timing
    const end = runUntilStopped(chosen, b)
    expect(end.t).toBe(b.duration)
    expect(end.playing).toBe(false)
  })

  it('follows the default option when « S’arrêter aux options » is off', () => {
    const state = { ...initialTransport(LINE_A), stopAtOptions: false }
    const end = runUntilStopped(play(state, timing), timing)
    expect(end.t).toBe(timing.duration)
    expect(end.waitingAt).toBeNull()
  })

  it('pauses between phases independently of the options', () => {
    const state = { ...initialTransport(LINE_A), pauseBetweenPhases: true, stopAtOptions: false }
    const first = runUntilStopped(play(state, timing), timing)
    expect(first.t).toBe(timing.ends[0])
    const second = runUntilStopped(play(first, timing), timing)
    expect(second.t).toBe(t2End)
    expect(second.waitingAt).toBeNull()
  })

  it('plays at 0.5x, 1x and 2x, loops, and restarts from 0 at the end', () => {
    const base = { ...initialTransport(LINE_A), stopAtOptions: false }
    for (const speed of [0.5, 1, 2] as const) {
      const s = tick(play({ ...base, speed }, timing), 0.1, timing, scenario)
      expect(s.t).toBeCloseTo(0.1 * speed, 12)
    }
    const looping = { ...base, loop: true, t: timing.duration - 0.01, playing: true }
    expect(tick(looping, 0.1, timing, scenario)).toMatchObject({ t: 0, playing: true })
    const atEnd = { ...base, t: timing.duration }
    expect(play(atEnd, timing).t).toBe(0)
    expect(pause(play(base, timing)).playing).toBe(false)
  })

  it('jumps to the previous and next phase, and seeks', () => {
    const state = seek(initialTransport(LINE_A), 0.3, timing)
    const next = nextPhase(state, timing)
    expect(next.t).toBe(timing.starts[1])
    expect(previousPhase(next, timing).t).toBe(timing.starts[0])
    const inside = seek(state, (timing.starts[1] ?? 0) + 0.5, timing)
    expect(previousPhase(inside, timing).t).toBe(timing.starts[1])
    expect(seek(state, 999, timing).t).toBe(timing.duration)
    expect(phaseIndexAtTime(timing, timing.duration)).toBe(2)
  })

  it('returns to the branch point to play another option', () => {
    const end = seek({ ...initialTransport(LINE_A) }, timing.duration, timing)
    const back = backToBranchPoint(end, timing, scenario)
    expect(back).toMatchObject({ t: t2End, playing: false, waitingAt: P.t2 })
  })

  it('shows a selected phase at its start, on its default line (D-010)', () => {
    const startOf = (line: string[]) => timingOf(line).timing.starts[line.length - 1] ?? 0
    const shown = showPhase(initialTransport(LINE_A), scenario, P.t3b, (line) => {
      const idx = line.indexOf(P.t3b)
      return timingOf(line).timing.starts[idx] ?? 0
    })
    expect(shown.line).toEqual(LINE_B)
    expect(shown.t).toBe(startOf(LINE_B))
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
