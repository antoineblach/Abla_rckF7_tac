// Placement modes (SPEC 10.1, 10.2, D-088 to D-091, D-096): preview under the pointer and effect
// of a click, for applying a preset, saving one and moving a whole play.
import { describe, expect, it } from 'vitest'
import { validatePlay } from '../model/validate'
import { isPlayer, type Play } from '../model/types'
import { lineoutPreset, P, preset, sequentialIds, sevenVsSevenWithOptions } from '../test/builders'
import {
  defaultIncludeBall,
  defaultPresetType,
  placementClick,
  placementPreview,
  presetToSave,
  wholePlacementIds,
  type PlacementMode,
  type SavePresetRequest,
} from './placementMode'
import { createPlayForPreset } from './placements'
import { applyPreset, presetFrame, presetFromPlacement, presetThumbnail } from './presets'
import { translatePlay } from './transform'

const NOW = new Date(2026, 9, 16, 14, 0, 0)

const apply = (openSide: 'auto' | 'left' | 'right' = 'auto'): PlacementMode => ({
  kind: 'applyPreset',
  preset: lineoutPreset(),
  openSide,
})

describe('applying a preset (SPEC 10.1, D-088)', () => {
  it('shows the ghost tokens of the preset and the axes of its frame at the snapped anchor', () => {
    const play = sevenVsSevenWithOptions()
    const preview = placementPreview(apply(), play, { x: 30.4, y: 64 })
    // Nearest touchline y = 70, x on the grid; towards the field: openSide = -y.
    expect(preview.anchor).toEqual({
      pos: { x: 30, y: 70 },
      refused: false,
      axes: { forward: { x: 1, y: 0 }, openSide: { x: 0, y: -1 } },
    })
    expect(preview.refused).toBe(false)
    expect(preview.ghosts).toHaveLength(7)
    expect(preview.ghosts[0]).toEqual({ team: 'A', number: 2, pos: { x: 29.5, y: 71 } })
    expect(preview.ghosts.find((g) => g.team === 'B')).toEqual({
      team: 'B',
      number: 1,
      pos: { x: 30.5, y: 64 },
    })
  })

  it('hides the ghosts and refuses the click less than 5 m from a goal line', () => {
    const play = sevenVsSevenWithOptions()
    const preview = placementPreview(apply(), play, { x: 96, y: 2 })
    expect(preview).toEqual({
      ghosts: [],
      anchor: { pos: { x: 96, y: 0 }, refused: true, axes: null },
      path: null,
      refused: true,
    })
    expect(placementClick(apply(), play, { x: 96, y: 2 }, sequentialIds())).toEqual({
      kind: 'refused',
    })
  })

  it('applies the preset at the anchor of the click, the open side chosen in the banner', () => {
    const play = sevenVsSevenWithOptions()
    const mode: PlacementMode = {
      kind: 'applyPreset',
      preset: preset({
        type: 'scrum',
        positions: [{ role: 'attack', number: 10, forward: -5, openSide: 8 }],
      }),
      openSide: 'left',
    }
    const step = placementClick(mode, play, { x: 50.2, y: 20.4 }, sequentialIds())
    const frame = presetFrame('scrum', { x: 50, y: 20 }, play.field, 'A', 'left')
    expect(step).toEqual({
      kind: 'edit',
      play: applyPreset(play, mode.preset, frame, sequentialIds()).play,
    })
    if (step.kind !== 'edit') throw new Error('edit expected')
    // A 10 is created: 5 m behind, 8 m towards the left of A (y = 0 side).
    const a10 = step.play.entities.find((e) => isPlayer(e) && e.team === 'A' && e.number === 10)
    expect(a10 && step.play.setup.positions[a10.id]).toEqual({ x: 45, y: 12 })
    expect(step.play.category).toBe('scrum')
  })

  it('shows nothing while the pointer is outside the field', () => {
    expect(placementPreview(apply(), sevenVsSevenWithOptions(), null)).toEqual({
      ghosts: [],
      anchor: null,
      path: null,
      refused: false,
    })
  })
})

describe('saving a preset (SPEC 10.1, D-089)', () => {
  const request: SavePresetRequest = {
    name: 'Défense en ligne',
    type: 'free',
    playerIds: [P.B(1), P.B(2)],
    includeBall: false,
  }

  it('draws only the anchor and its axes, then gives the content in the local frame', () => {
    const play = sevenVsSevenWithOptions()
    const mode: PlacementMode = { kind: 'savePreset', request, openSide: 'right' }
    const preview = placementPreview(mode, play, { x: 49.6, y: 10.2 })
    expect(preview.ghosts).toEqual([])
    expect(preview.anchor).toEqual({
      pos: { x: 50, y: 10 },
      refused: false,
      axes: { forward: { x: 1, y: 0 }, openSide: { x: 0, y: 1 } },
    })
    const frame = presetFrame('free', { x: 50, y: 10 }, play.field, 'A', 'right')
    expect(placementClick(mode, play, { x: 49.6, y: 10.2 }, sequentialIds())).toEqual({
      kind: 'save',
      content: presetFromPlacement(play, request.playerIds, false, frame),
    })
  })

  it('refuses a lineout anchor near a goal line, as for applying', () => {
    const mode: PlacementMode = {
      kind: 'savePreset',
      request: { ...request, type: 'lineout' },
      openSide: 'auto',
    }
    expect(
      placementClick(mode, sevenVsSevenWithOptions(), { x: 3, y: 1 }, sequentialIds()),
    ).toEqual({ kind: 'refused' })
  })

  it('proposes the type from the category and the ball from the content (D-089)', () => {
    expect(defaultPresetType('scrum')).toBe('scrum')
    expect(defaultPresetType('lineout')).toBe('lineout')
    expect(defaultPresetType('restart')).toBe('restart')
    expect(defaultPresetType('phasePlay')).toBe('free')
    expect(defaultPresetType('drill')).toBe('free')
    const play = sevenVsSevenWithOptions()
    expect(wholePlacementIds(play)).toHaveLength(14)
    expect(defaultIncludeBall(play, wholePlacementIds(play), true)).toBe(true)
    expect(defaultIncludeBall(play, [P.A(4)], false)).toBe(true)
    expect(defaultIncludeBall(play, [P.A(3), P.B(4)], false)).toBe(false)
    const noBall: Play = {
      ...play,
      entities: play.entities.filter((e) => e.kind !== 'ball'),
      setup: { ...play.setup, ballCarrierId: null },
    }
    expect(defaultIncludeBall(noBall, wholePlacementIds(noBall), true)).toBe(false)
  })

  it('builds a new preset, or updates one keeping its id, name, type and dates', () => {
    const content = {
      positions: [{ role: 'attack' as const, number: 4, forward: 0, openSide: 0 }],
      ball: null,
    }
    expect(presetToSave(request, content, null, 'id-1', NOW)).toEqual({
      schemaVersion: 1,
      id: 'id-1',
      name: 'Défense en ligne',
      type: 'free',
      positions: content.positions,
      ball: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    })
    const existing = lineoutPreset()
    expect(presetToSave(request, content, existing, 'id-1', NOW)).toEqual({
      ...existing,
      positions: content.positions,
      ball: null,
    })
  })
})

describe('moving a whole play by two clicks (SPEC 10.2, D-090)', () => {
  it('takes the start point, then previews the starting tokens moved, then translates', () => {
    const play = sevenVsSevenWithOptions()
    const start: PlacementMode = { kind: 'movePlay', from: null }
    expect(placementPreview(start, play, { x: 40, y: 35 }).anchor).toEqual({
      pos: { x: 40, y: 35 },
      refused: false,
      axes: null,
    })
    const step = placementClick(start, play, { x: 40, y: 35 }, sequentialIds())
    expect(step).toEqual({ kind: 'continue', mode: { kind: 'movePlay', from: { x: 40, y: 35 } } })
    if (step.kind !== 'continue') throw new Error('continue expected')
    const preview = placementPreview(step.mode, play, { x: 45, y: 30 })
    expect(preview.path).toEqual([
      { x: 40, y: 35 },
      { x: 45, y: 30 },
    ])
    expect(preview.ghosts).toHaveLength(14)
    expect(preview.ghosts.find((g) => g.team === 'A' && g.number === 4)?.pos).toEqual({
      x: 45,
      y: 30,
    })
    expect(placementClick(step.mode, play, { x: 45, y: 30 }, sequentialIds())).toEqual({
      kind: 'edit',
      play: translatePlay(play, { x: 5, y: -5 }),
    })
    // The same point twice changes nothing.
    const same = placementClick(step.mode, play, { x: 40, y: 35 }, sequentialIds())
    expect(same.kind === 'edit' && same.play).toBe(play)
  })
})

describe('new play from a preset and thumbnails (D-091, SPEC 10.1)', () => {
  it('creates a play without players, with a ball only when asked', () => {
    const withBall = createPlayForPreset(true, sequentialIds(), NOW)
    expect(withBall.entities).toEqual([{ id: expect.any(String) as string, kind: 'ball' }])
    expect(withBall.setup).toEqual({ positions: {}, ballCarrierId: null, ballPosition: null })
    expect(withBall.phases).toHaveLength(1)
    expect(withBall.name).toBe('Nouvelle combinaison')
    expect(createPlayForPreset(false, sequentialIds(), NOW).entities).toEqual([])
    expect(validatePlay(createPlayForPreset(false, sequentialIds(), NOW))).toEqual([])
    // Laid by its anchor, the preset creates the players and places the ball.
    const frame = presetFrame('lineout', { x: 40, y: 0 }, withBall.field, 'A', 'auto')
    const laid = applyPreset(withBall, lineoutPreset(), frame, sequentialIds(700)).play
    expect(laid.entities.filter(isPlayer)).toHaveLength(7)
    expect(laid.entities.filter((e) => e.kind === 'ball')).toHaveLength(1)
    expect(laid.setup.ballCarrierId).not.toBeNull()
    expect(laid.category).toBe('lineout')
  })

  it('frames a thumbnail on the tokens of the preset, with the margin of the automatic framing', () => {
    const { play, frame } = presetThumbnail(lineoutPreset())
    expect(play.entities.filter(isPlayer)).toHaveLength(7)
    // Lineout at the middle of the left touchline: tokens from y = -1 to y = 10, x from 46 to 52.
    expect(frame).toEqual({ min: { x: 41, y: -6 }, max: { x: 57, y: 15 } })
    const empty = presetThumbnail(preset({ positions: [] }))
    expect(empty.frame).toEqual({ min: { x: 0, y: 0 }, max: { x: 100, y: 70 } })
    expect(presetThumbnail(lineoutPreset())).toEqual(presetThumbnail(lineoutPreset()))
  })
})
