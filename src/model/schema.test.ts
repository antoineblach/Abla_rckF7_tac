import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  basePlay,
  breakdown,
  fourVsTwoNoBall,
  kick,
  P,
  pass,
  phase,
  realisticRunsPlay,
  run,
  setPiecesPlay,
  sevenVsSevenWithOptions,
  uuid,
} from '../test/builders'
import { canonicalJson } from './canonical'
import { playSchemaV3 } from './schema'
import { playSchemaV1 } from './schemaV1'
import { playSchemaV2 } from './schemaV2'
import type { Action, Play } from './types'

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url), 'utf8'))

function withActions(actions: unknown[]): unknown {
  const play = basePlay()
  return { ...play, phases: [{ ...play.phases[0], actions }] }
}

describe('schema v3', () => {
  it('accepts valid plays, kicks, breakdowns and lot 3 bis runs included', () => {
    for (const play of [
      basePlay(),
      sevenVsSevenWithOptions(),
      fourVsTwoNoBall(),
      setPiecesPlay(),
      realisticRunsPlay(),
    ]) {
      expect(playSchemaV3.safeParse(play).success).toBe(true)
    }
  })

  it('accepts the frozen v3 fixture, identical to the builder', () => {
    const data = fixture('play-v3-lot3bis.json')
    expect(playSchemaV3.safeParse(data).success).toBe(true)
    expect(canonicalJson(data)).toBe(canonicalJson(realisticRunsPlay()))
  })

  it('accepts segment speeds, links of every kind and releases on receipt (D-104)', () => {
    const target = uuid(1)
    const actions: unknown[] = [
      run(target, P.A(1), [
        { x: 1, y: 1, speed: 'walk' },
        { x: 2, y: 2, speed: 6.5 },
      ]),
      ...(['runEnd', 'release', 'arrival', 'formation'] as const).map((event, i) =>
        run(uuid(10 + i), P.A(2), [{ x: 3, y: 3 }], {
          sync: { target: { actionId: target, event }, adjust: 'speed' },
        }),
      ),
      run(
        uuid(20),
        P.A(3),
        [
          { x: 3, y: 3 },
          { x: 4, y: 4 },
        ],
        {
          endsAtSpeed: true,
          sync: {
            target: { actionId: target, event: 'runPoint', index: 1 },
            at: 1,
            adjust: 'delay',
          },
        },
      ),
      pass(uuid(21), P.A(1), P.A(2), 0, { release: 'onReceipt' }),
      kick(uuid(22), P.A(1), { point: { x: 1, y: 1 } }, 0.4, { release: 'onReceipt' }),
    ]
    expect(playSchemaV3.safeParse(withActions(actions)).success).toBe(true)
  })

  it('rejects malformed lot 3 bis fields', () => {
    const plain = run(uuid(1), P.A(1), [{ x: 1, y: 1 }])
    const link = { target: { actionId: uuid(2), event: 'runEnd' }, adjust: 'delay' }
    const invalid: unknown[] = [
      { ...plain, waypoints: [{ x: 1, y: 1, speed: 0 }] },
      { ...plain, waypoints: [{ x: 1, y: 1, speed: 'gallop' }] },
      { ...plain, waypoints: [{ x: 1, y: 1, pace: 'walk' }] },
      { ...plain, endsAtSpeed: false },
      { ...plain, sync: { ...link, adjust: 'both' } },
      { ...plain, sync: { ...link, at: -1 } },
      { ...plain, sync: { ...link, at: 0.5 } },
      { ...plain, sync: { ...link, target: { actionId: uuid(2), event: 'runPoint' } } },
      { ...plain, sync: { ...link, target: { actionId: uuid(2), event: 'runEnd', index: 0 } } },
      { ...plain, sync: { ...link, target: { actionId: uuid(2), event: 'tackle' } } },
      { ...pass(uuid(3), P.A(1), P.A(2), 0), release: 'fixed' },
      { ...kick(uuid(4), P.A(1), { point: { x: 1, y: 1 } }, 0), release: true },
    ]
    for (const action of invalid) {
      expect(playSchemaV3.safeParse(withActions([action])).success).toBe(false)
    }
  })

  it('reports the path of an error', () => {
    const play = sevenVsSevenWithOptions() as unknown as {
      phases: { actions: { pace?: string }[] }[]
    }
    const action = play.phases[0]?.actions[0]
    if (action) action.pace = 'gallop'
    const result = playSchemaV3.safeParse(play)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path.join('.')).toBe('phases.0.actions.0.pace')
  })

  it('rejects unknown keys (DECISIONS Q24)', () => {
    expect(playSchemaV3.safeParse({ ...basePlay(), extra: true }).success).toBe(false)
    const ruck = { ...breakdown(uuid(1), P.A(1), P.A(2), P.A(3), 0), tacklerId: P.B(1) }
    expect(playSchemaV3.safeParse(withActions([ruck])).success).toBe(false)
  })

  it('rejects malformed kicks and breakdowns', () => {
    const bothTargets = kick(uuid(1), P.A(1), { receiverId: P.A(2) }, 0)
    const invalid: unknown[] = [
      { ...bothTargets, target: { receiverId: P.A(2), point: { x: 1, y: 1 } } },
      { ...bothTargets, target: {} },
      { ...bothTargets, flightTime: 0 },
      { ...bothTargets, kind: 'grubber' },
      { ...breakdown(uuid(2), P.A(1), P.A(2), P.A(3), 0), duration: 0 },
      { ...breakdown(uuid(2), P.A(1), P.A(2), P.A(3), 0), contest: 'tackler' },
      { ...breakdown(uuid(2), P.A(1), P.A(2), P.A(3), -1) },
    ]
    for (const action of invalid) {
      expect(playSchemaV3.safeParse(withActions([action])).success).toBe(false)
    }
  })

  it('rejects types of lots 4 and 5 (DECISIONS Q4)', () => {
    const groupRun = {
      id: uuid(1),
      type: 'groupRun',
      entityIds: [uuid(2)],
      waypoints: [{ x: 1, y: 1 }],
      pace: 'jog',
      delay: 0,
    }
    expect(playSchemaV3.safeParse(withActions([groupRun])).success).toBe(false)
    const play = basePlay()
    const withDefense = { ...play, defenseSettings: { system: '7' } }
    expect(playSchemaV3.safeParse(withDefense).success).toBe(false)
    const cone = {
      id: uuid(3),
      kind: 'equipment',
      type: 'cone',
      color: '#ffffff',
      position: { x: 0, y: 0 },
    }
    expect(playSchemaV3.safeParse({ ...play, entities: [cone] }).success).toBe(false)
  })

  it('rejects non-UUID identifiers and infinite numbers', () => {
    expect(playSchemaV3.safeParse({ ...basePlay(), id: 'a/b' }).success).toBe(false)
    const play = basePlay({
      field: { length: Infinity, width: 70, inGoal: 10, view: { kind: 'full' } },
    })
    expect(playSchemaV3.safeParse(play).success).toBe(false)
  })
})

describe('frozen schema v2', () => {
  it('accepts the frozen v2 fixture, equal to the builder apart from its version', () => {
    const data = fixture('play-v2-lot3.json')
    expect(playSchemaV2.safeParse(data).success).toBe(true)
    expect(canonicalJson(data)).toBe(canonicalJson({ ...setPiecesPlay(), schemaVersion: 2 }))
  })

  it('rejects the fields of version 3', () => {
    const v2 = { ...basePlay(), schemaVersion: 2 }
    expect(playSchemaV2.safeParse(v2).success).toBe(true)
    const actions: Action[] = [
      run(uuid(1), P.A(1), [{ x: 1, y: 1, speed: 'walk' }]),
      run(uuid(1), P.A(1), [{ x: 1, y: 1 }], { endsAtSpeed: true }),
      run(uuid(1), P.A(1), [{ x: 1, y: 1 }], {
        sync: { target: { actionId: uuid(2), event: 'runEnd' }, adjust: 'delay' },
      }),
      pass(uuid(3), P.A(1), P.A(2), 0, { release: 'onReceipt' }),
      kick(uuid(4), P.A(1), { point: { x: 1, y: 1 } }, 0, { release: 'onReceipt' }),
    ]
    for (const action of actions) {
      const data = { ...v2, phases: [phase(uuid(9000), null, [action])] }
      expect(playSchemaV2.safeParse(data).success).toBe(false)
    }
    expect(playSchemaV3.safeParse(v2).success).toBe(false)
  })
})

describe('frozen schema v1', () => {
  it('accepts the frozen v1 fixture, equal to the builder apart from its version', () => {
    const data = fixture('play-v1-7v7-options.json')
    expect(playSchemaV1.safeParse(data).success).toBe(true)
    const expected: Omit<Play, 'schemaVersion'> & { schemaVersion: number } = {
      ...sevenVsSevenWithOptions(),
      schemaVersion: 1,
    }
    expect(canonicalJson(data)).toBe(canonicalJson(expected))
  })

  it('rejects kicks and breakdowns, which arrive with version 2', () => {
    const v1 = { ...basePlay(), schemaVersion: 1 }
    const actions: Action[] = [
      kick(uuid(1), P.A(1), { point: { x: 1, y: 1 } }, 0),
      breakdown(uuid(2), P.A(1), P.A(2), P.A(3), 0),
    ]
    for (const action of actions) {
      const data = { ...v1, phases: [phase(uuid(9000), null, [action])] }
      expect(playSchemaV1.safeParse(data).success).toBe(false)
    }
    expect(playSchemaV1.safeParse(v1).success).toBe(true)
  })
})
