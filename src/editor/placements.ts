// Starting placements of a new play (SPEC 6.6, DECISIONS Q8 / D-008).
import { FIELD_DEFAULTS, STARTING_PLACEMENT, TEAM_COLORS } from '../config/defaults'
import type { IdFactory } from '../model/ids'
import type { Entity, Id, Play, Team, Vec2 } from '../model/types'

export type StartingPlacement = 'teamA' | 'sevenVsSeven'

export const NEW_PLAY_NAME = 'Nouvelle combinaison'

export function createNewPlay(placement: StartingPlacement, ids: IdFactory, now: Date): Play {
  const { playersPerTeam, attackLineX, defenseLineX, firstY, spacingY, ballCarrierNumber } =
    STARTING_PLACEMENT
  const entities: Entity[] = []
  const positions: Record<Id, Vec2> = {}
  let carrier: Id | null = null
  const line = (team: Team, x: number) => {
    for (let n = 1; n <= playersPerTeam; n++) {
      const id = ids()
      entities.push({
        id,
        kind: 'player',
        team,
        number: n,
        color: TEAM_COLORS[team],
        defenseMode: 'manual',
      })
      positions[id] = { x, y: firstY + (n - 1) * spacingY }
      if (team === 'A' && n === ballCarrierNumber) carrier = id
    }
  }
  line('A', attackLineX)
  if (placement === 'sevenVsSeven') line('B', defenseLineX)
  entities.push({ id: ids(), kind: 'ball' })
  const stamp = now.toISOString()
  return {
    schemaVersion: 2,
    id: ids(),
    createdAt: stamp,
    updatedAt: stamp,
    name: NEW_PLAY_NAME,
    category: 'phasePlay',
    notes: '',
    attackingTeam: 'A',
    field: { ...FIELD_DEFAULTS, view: { kind: 'full' } },
    entities,
    setup: { positions, ballCarrierId: carrier, ballPosition: null },
    phases: [
      {
        id: ids(),
        parentId: null,
        label: '',
        condition: '',
        instruction: '',
        isDefault: false,
        actions: [],
      },
    ],
  }
}
