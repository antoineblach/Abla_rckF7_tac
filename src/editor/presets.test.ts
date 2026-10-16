import { describe, expect, it } from 'vitest'
import type { PlacementPreset } from '../model/preset'
import { isPlayer, type Play, type Team } from '../model/types'
import {
  basePlay,
  lineoutPreset,
  P,
  player,
  preset,
  sequentialIds,
  sevenVsSevenWithOptions,
  uuid,
} from '../test/builders'
import {
  applyPreset,
  categoryOfPreset,
  lineoutAnchorAllowed,
  placedPositions,
  presetFrame,
  presetFromPlacement,
  presetPreviewPlay,
  snapAnchor,
  toLocal,
  toWorld,
  type OpenSideChoice,
} from './presets'

const FIELD = { length: 100, width: 70 }

// Scrum: attack 9 just behind the mark, attack 10 deeper towards the open side; defence 9.
const scrum = (): PlacementPreset =>
  preset({
    type: 'scrum',
    name: 'Mêlée',
    positions: [
      { role: 'attack', number: 9, forward: -1, openSide: 0.5 },
      { role: 'attack', number: 10, forward: -5, openSide: 8 },
      { role: 'defense', number: 9, forward: 1, openSide: 0.5 },
    ],
    ball: { forward: -1, openSide: 0.5, carrierRole: 'attack', carrierNumber: 9 },
  })

function emptyPlay(attackingTeam: Team): Play {
  return basePlay({
    attackingTeam,
    entities: [],
    setup: { positions: {}, ballCarrierId: null, ballPosition: null },
  })
}

function placed(play: Play, team: Team, number: number) {
  const entity = play.entities.find((e) => isPlayer(e) && e.team === team && e.number === number)
  return entity ? play.setup.positions[entity.id] : undefined
}

describe('local frame of a preset (SPEC 10.1, D-088)', () => {
  it('applies to the four cases: open side left or right, A or B attacking', () => {
    const anchor = { x: 50, y: 20 }
    const cases: [Team, OpenSideChoice, { x: number; y: number }, { x: number; y: number }][] = [
      // [attacking team, open side, attack 10, defence 9]
      ['A', 'left', { x: 45, y: 12 }, { x: 51, y: 19.5 }],
      ['A', 'right', { x: 45, y: 28 }, { x: 51, y: 20.5 }],
      ['B', 'left', { x: 55, y: 28 }, { x: 49, y: 20.5 }],
      ['B', 'right', { x: 55, y: 12 }, { x: 49, y: 19.5 }],
    ]
    for (const [team, side, attack10, defense9] of cases) {
      const frame = presetFrame('scrum', anchor, FIELD, team, side)
      const { play } = applyPreset(emptyPlay(team), scrum(), frame, sequentialIds())
      const other: Team = team === 'A' ? 'B' : 'A'
      expect(placed(play, team, 10)).toEqual(attack10)
      expect(placed(play, other, 9)).toEqual(defense9)
      const carrier = play.entities.find((e) => e.id === play.setup.ballCarrierId)
      expect(isPlayer(carrier) && carrier.team === team && carrier.number).toBe(9)
    }
  })

  it('opens towards the widest side by default, right of the attack at the exact centre', () => {
    expect(presetFrame('ruck', { x: 50, y: 20 }, FIELD, 'A', 'auto').openSideY).toBe(1)
    expect(presetFrame('ruck', { x: 50, y: 50 }, FIELD, 'A', 'auto').openSideY).toBe(-1)
    expect(presetFrame('ruck', { x: 50, y: 35 }, FIELD, 'A', 'auto').openSideY).toBe(1)
    expect(presetFrame('ruck', { x: 50, y: 35 }, FIELD, 'B', 'auto').openSideY).toBe(-1)
  })

  it('opens a lineout towards the field, whatever the choice', () => {
    for (const choice of ['auto', 'left', 'right'] as const) {
      expect(presetFrame('lineout', { x: 30, y: 0 }, FIELD, 'A', choice).openSideY).toBe(1)
      expect(presetFrame('lineout', { x: 30, y: 70 }, FIELD, 'B', choice).openSideY).toBe(-1)
    }
  })

  it('converts between local and world coordinates both ways', () => {
    const frame = presetFrame('free', { x: 30, y: 40 }, FIELD, 'B', 'left')
    const p = { x: 21.5, y: 47.25 }
    expect(toWorld(frame, toLocal(frame, p))).toEqual(p)
  })
})

describe('anchors (SPEC 10.1, D-088)', () => {
  it('refuses a lineout anchor less than 5 m from a goal line', () => {
    expect(lineoutAnchorAllowed(4.9, FIELD)).toBe(false)
    expect(lineoutAnchorAllowed(5, FIELD)).toBe(true)
    expect(lineoutAnchorAllowed(95, FIELD)).toBe(true)
    expect(lineoutAnchorAllowed(95.1, FIELD)).toBe(false)
    expect(lineoutAnchorAllowed(-3, FIELD)).toBe(false)
    // Reduced field: the far goal line moves.
    expect(lineoutAnchorAllowed(89, { length: 94 })).toBe(true)
    expect(lineoutAnchorAllowed(89.5, { length: 94 })).toBe(false)
  })

  it('snaps a lineout anchor on the nearest touchline, on the grid, and refuses it near a goal', () => {
    expect(snapAnchor('lineout', { x: 30.4, y: 12 }, FIELD)).toEqual({
      ok: true,
      anchor: { x: 30, y: 0 },
    })
    expect(snapAnchor('lineout', { x: 30.6, y: 50 }, FIELD)).toEqual({
      ok: true,
      anchor: { x: 31, y: 70 },
    })
    expect(snapAnchor('lineout', { x: 4.4, y: 3 }, FIELD)).toEqual({
      ok: false,
      reason: 'lineoutNearGoal',
      anchor: { x: 4, y: 0 },
    })
    expect(snapAnchor('lineout', { x: 4.6, y: 3 }, FIELD)).toEqual({
      ok: true,
      anchor: { x: 5, y: 0 },
    })
    expect(snapAnchor('lineout', { x: 96, y: 66 }, FIELD).ok).toBe(false)
  })

  it('snaps a restart on the centre of the halfway line or a 22 m line, else on the grid', () => {
    expect(snapAnchor('restart', { x: 51, y: 36.5 }, FIELD)).toEqual({
      ok: true,
      anchor: { x: 50, y: 35 },
    })
    expect(snapAnchor('restart', { x: 23.5, y: 40.4 }, FIELD)).toEqual({
      ok: true,
      anchor: { x: 22, y: 40 },
    })
    expect(snapAnchor('restart', { x: 77, y: 10.6 }, FIELD)).toEqual({
      ok: true,
      anchor: { x: 78, y: 11 },
    })
    expect(snapAnchor('restart', { x: 60.3, y: 29.6 }, FIELD)).toEqual({
      ok: true,
      anchor: { x: 60, y: 30 },
    })
  })

  it('snaps scrum, ruck and free anchors on the 1 m grid', () => {
    for (const type of ['scrum', 'ruck', 'free'] as const) {
      expect(snapAnchor(type, { x: 12.4, y: 33.6 }, FIELD)).toEqual({
        ok: true,
        anchor: { x: 12, y: 34 },
      })
    }
  })
})

describe('saving and applying presets (SPEC 10.1, D-087, D-089)', () => {
  it('gives back the same placement when saved and applied at the same anchor and side', () => {
    const play = sevenVsSevenWithOptions()
    const frame = presetFrame('free', { x: 45, y: 35 }, play.field, play.attackingTeam, 'right')
    const ids = play.entities.filter(isPlayer).map((e) => e.id)
    const saved = presetFromPlacement(play, ids, true, frame)
    expect(saved.positions).toHaveLength(14)
    expect(saved.ball).toEqual({
      forward: -5,
      openSide: 0,
      carrierRole: 'attack',
      carrierNumber: 4,
    })
    const result = applyPreset(play, { type: 'free', ...saved }, frame, sequentialIds())
    expect(result.play).toEqual(play)
    expect(result.moved).toHaveLength(14)
    expect(result.created).toEqual([])
  })

  it('moves the associated players, creates the missing ones and leaves the others (role and number)', () => {
    const play = basePlay({
      entities: [player(P.A(9), 'A', 9), player(P.A(1), 'A', 1), player(uuid(60), 'B', 4)],
      setup: {
        positions: {
          [P.A(9)]: { x: 1, y: 1 },
          [P.A(1)]: { x: 2, y: 2 },
          [uuid(60)]: { x: 3, y: 3 },
        },
        ballCarrierId: null,
        ballPosition: null,
      },
    })
    const frame = presetFrame('scrum', { x: 50, y: 20 }, FIELD, 'A', 'right')
    const result = applyPreset(play, scrum(), frame, sequentialIds(700))
    expect(result.moved).toEqual([P.A(9)])
    expect(result.created).toEqual([uuid(700), uuid(701)])
    expect(result.play.setup.positions[P.A(9)]).toEqual({ x: 49, y: 20.5 })
    expect(result.play.setup.positions[P.A(1)]).toEqual({ x: 2, y: 2 })
    expect(result.play.setup.positions[uuid(60)]).toEqual({ x: 3, y: 3 })
    expect(result.play.entities.find((e) => e.id === uuid(701))).toEqual({
      id: uuid(701),
      kind: 'player',
      team: 'B',
      number: 9,
      color: '#E69F00',
      defenseMode: 'manual',
    })
    // A ball is added for the preset, carried by the attack 9.
    expect(result.play.entities.filter((e) => e.kind === 'ball')).toHaveLength(1)
    expect(result.play.setup.ballCarrierId).toBe(P.A(9))
    expect(result.play.category).toBe('scrum')
  })

  it('associates duplicated numbers in order (D-089)', () => {
    const play = basePlay({
      entities: [player(uuid(1), 'A', 10), player(uuid(2), 'A', 10)],
      setup: {
        positions: { [uuid(1)]: { x: 1, y: 1 }, [uuid(2)]: { x: 2, y: 2 } },
        ballCarrierId: null,
        ballPosition: null,
      },
    })
    const twoTens = preset({
      type: 'free',
      positions: [
        { role: 'attack', number: 10, forward: 0, openSide: 0 },
        { role: 'attack', number: 10, forward: 0, openSide: 5 },
        { role: 'attack', number: 10, forward: 0, openSide: 10 },
      ],
    })
    const frame = presetFrame('free', { x: 50, y: 20 }, FIELD, 'A', 'right')
    const result = applyPreset(play, twoTens, frame, sequentialIds(700))
    expect(result.moved).toEqual([uuid(1), uuid(2)])
    expect(result.created).toEqual([uuid(700)])
    expect(result.play.setup.positions[uuid(2)]).toEqual({ x: 50, y: 25 })
  })

  it('combines an attack preset and a defence preset, each touching its own roles only', () => {
    const attack = preset({
      type: 'scrum',
      positions: [{ role: 'attack', number: 9, forward: -1, openSide: 0 }],
    })
    const defense = preset({
      type: 'scrum',
      positions: [{ role: 'defense', number: 9, forward: 1, openSide: 0 }],
    })
    const frame = presetFrame('scrum', { x: 50, y: 20 }, FIELD, 'A', 'right')
    const ids = sequentialIds(700)
    const first = applyPreset(emptyPlay('A'), attack, frame, ids).play
    const second = applyPreset(first, defense, frame, ids).play
    expect(placed(second, 'A', 9)).toEqual({ x: 49, y: 20 })
    expect(placed(second, 'B', 9)).toEqual({ x: 51, y: 20 })
    expect(second.entities).toHaveLength(2)
  })

  it('keeps the ball of the play when the preset has none; puts it on the ground otherwise', () => {
    const play = sevenVsSevenWithOptions()
    const frame = presetFrame('free', { x: 50, y: 35 }, FIELD, 'A', 'right')
    const noBall = preset({
      type: 'free',
      positions: [{ role: 'defense', number: 1, forward: 3, openSide: 0 }],
    })
    expect(applyPreset(play, noBall, frame, sequentialIds()).play.setup.ballCarrierId).toBe(P.A(4))
    const ground = preset({ type: 'free', positions: [], ball: { forward: 2, openSide: 1 } })
    const setup = applyPreset(play, ground, frame, sequentialIds()).play.setup
    expect(setup.ballCarrierId).toBeNull()
    expect(setup.ballPosition).toEqual({ x: 52, y: 36 })
  })

  it('records the ball on the ground when the carrier is not among the saved players', () => {
    const play = sevenVsSevenWithOptions()
    const frame = presetFrame('free', { x: 45, y: 35 }, play.field, 'A', 'right')
    const defenders = play.entities.filter((e) => isPlayer(e) && e.team === 'B').map((e) => e.id)
    const saved = presetFromPlacement(play, defenders, true, frame)
    expect(saved.positions.every((p) => p.role === 'defense')).toBe(true)
    expect(saved.ball).toEqual({ forward: -5, openSide: 0 })
    expect(presetFromPlacement(play, defenders, false, frame).ball).toBeNull()
  })

  it('sets the category of the play from the type of the preset (D-087)', () => {
    expect(categoryOfPreset('scrum')).toBe('scrum')
    expect(categoryOfPreset('lineout')).toBe('lineout')
    expect(categoryOfPreset('restart')).toBe('restart')
    expect(categoryOfPreset('ruck')).toBe('phasePlay')
    expect(categoryOfPreset('free')).toBeNull()
    const drill = { ...emptyPlay('A'), category: 'drill' as const }
    const frame = presetFrame('free', { x: 50, y: 35 }, FIELD, 'A', 'right')
    expect(applyPreset(drill, preset({ type: 'free' }), frame, sequentialIds()).play.category).toBe(
      'drill',
    )
  })

  it('places the ghost tokens and builds a thumbnail play', () => {
    const frame = presetFrame('lineout', { x: 40, y: 0 }, FIELD, 'B', 'auto')
    const ghosts = placedPositions(lineoutPreset(), frame, 'B')
    expect(ghosts[0]).toEqual({ team: 'B', number: 2, pos: { x: 40.5, y: -1 } })
    const preview = presetPreviewPlay(lineoutPreset(), basePlay(), sequentialIds())
    expect(preview.entities.filter(isPlayer)).toHaveLength(7)
    expect(preview.attackingTeam).toBe('A')
    expect(preview.setup.ballCarrierId).not.toBeNull()
  })
})
