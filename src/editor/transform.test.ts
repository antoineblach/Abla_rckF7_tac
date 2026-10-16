import { describe, expect, it } from 'vitest'
import { canonicalJson } from '../model/canonical'
import type { KickAction, Play, RunAction } from '../model/types'
import { setPiecesPlay, sevenVsSevenWithOptions } from '../test/builders'
import { mirrorPlay, translatePlay } from './transform'

const withFrame = (play: Play): Play => ({
  ...play,
  field: { ...play.field, view: { kind: 'frame', min: { x: 30, y: 4 }, max: { x: 80, y: 41.5 } } },
})

describe('moving and flipping a whole play (SPEC 10.2, D-090)', () => {
  it('flipping twice gives back the same play', () => {
    for (const play of [setPiecesPlay(), withFrame(sevenVsSevenWithOptions())]) {
      expect(canonicalJson(mirrorPlay(mirrorPlay(play)))).toBe(canonicalJson(play))
    }
  })

  it('moving then moving back gives back the same play', () => {
    for (const play of [setPiecesPlay(), withFrame(sevenVsSevenWithOptions())]) {
      const moved = translatePlay(play, { x: 12.5, y: -7 })
      expect(canonicalJson(translatePlay(moved, { x: -12.5, y: 7 }))).toBe(canonicalJson(play))
    }
  })

  it('keeps the identity within rounding for any values', () => {
    const play = translatePlay(sevenVsSevenWithOptions(), { x: 0.1, y: 0.37 })
    const back = translatePlay(translatePlay(play, { x: 3.3, y: -1.7 }), { x: -3.3, y: 1.7 })
    for (const [id, pos] of Object.entries(play.setup.positions)) {
      expect(back.setup.positions[id]?.x).toBeCloseTo(pos.x, 9)
      expect(back.setup.positions[id]?.y).toBeCloseTo(pos.y, 9)
    }
  })

  it('flips positions, waypoints, kick points, ground ball and frame, not the attack', () => {
    const play = withFrame(setPiecesPlay())
    const flipped = mirrorPlay(play)
    expect(flipped.attackingTeam).toBe(play.attackingTeam)
    expect(flipped.setup.ballPosition).toEqual({ x: 40.5, y: 35 })
    const first = Object.keys(play.setup.positions)[0] ?? ''
    expect(flipped.setup.positions[first]).toEqual({ x: 40, y: 65 })
    const runOf = (p: Play): RunAction | undefined =>
      p.phases[0]?.actions.find((a): a is RunAction => a.type === 'run')
    expect(runOf(flipped)?.waypoints).toEqual([{ x: 46, y: 34 }])
    const kickOf = (p: Play): KickAction | undefined =>
      p.phases.flatMap((ph) => ph.actions).find((a): a is KickAction => a.type === 'kick')
    expect(kickOf(flipped)?.target).toEqual({ point: { x: 75, y: 58 } })
    expect(flipped.field.view).toEqual({
      kind: 'frame',
      min: { x: 30, y: 28.5 },
      max: { x: 80, y: 66 },
    })
    // Breakdowns, passes and the receiver of a kick are not geometry.
    expect(
      flipped.phases.map((ph) => ph.actions.filter((a) => a.type !== 'run' && a.type !== 'kick')),
    ).toEqual(
      play.phases.map((ph) => ph.actions.filter((a) => a.type !== 'run' && a.type !== 'kick')),
    )
  })

  it('moves every point of the play by the same vector', () => {
    const moved = translatePlay(withFrame(setPiecesPlay()), { x: 5, y: -2 })
    expect(moved.setup.ballPosition).toEqual({ x: 45.5, y: 33 })
    expect(moved.field.view).toEqual({
      kind: 'frame',
      min: { x: 35, y: 2 },
      max: { x: 85, y: 39.5 },
    })
  })
})
