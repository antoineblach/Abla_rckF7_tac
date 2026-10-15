// Deterministic play builders for tests. Never imported by the application.
import { STARTING_PLACEMENT, TEAM_COLORS } from '../config/defaults'
import type { IdFactory } from '../model/ids'
import type {
  Action,
  BallEntity,
  Id,
  PassAction,
  Phase,
  Play,
  PlayerEntity,
  RunAction,
  Team,
  Vec2,
} from '../model/types'

/** Valid deterministic UUID v4 number n. */
export function uuid(n: number): Id {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
}

/** Sequential identifier factory starting at `start`. */
export function sequentialIds(start = 1000): IdFactory {
  let next = start
  return () => uuid(next++)
}

export const FIXED_DATE = '2026-10-14T12:00:00.000Z'

export function player(id: Id, team: Team, number: number): PlayerEntity {
  return { id, kind: 'player', team, number, color: TEAM_COLORS[team], defenseMode: 'manual' }
}

export function ball(id: Id): BallEntity {
  return { id, kind: 'ball' }
}

export function run(
  id: Id,
  entityId: Id,
  waypoints: Vec2[],
  extra: Partial<RunAction> = {},
): RunAction {
  return { id, type: 'run', entityId, waypoints, pace: 'jog', delay: 0, ...extra }
}

export function pass(
  id: Id,
  fromId: Id,
  toId: Id,
  delay: number,
  extra: Partial<PassAction> = {},
): PassAction {
  return { id, type: 'pass', fromId, toId, delay, ...extra }
}

export function phase(
  id: Id,
  parentId: Id | null,
  actions: Action[],
  extra: Partial<Phase> = {},
): Phase {
  return {
    id,
    parentId,
    label: '',
    condition: '',
    instruction: '',
    isDefault: false,
    actions,
    ...extra,
  }
}

export function basePlay(extra: Partial<Play> = {}): Play {
  return {
    schemaVersion: 1,
    id: uuid(9999),
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    name: 'Essai',
    category: 'phasePlay',
    notes: '',
    attackingTeam: 'A',
    field: { length: 100, width: 70, inGoal: 10, view: { kind: 'full' } },
    entities: [],
    setup: { positions: {}, ballCarrierId: null, ballPosition: null },
    phases: [phase(uuid(9000), null, [])],
    ...extra,
  }
}

/** Ids of the 7 v 7 scenario: A1..A7 = 1..7, B1..B7 = 11..17, ball = 20. */
export const P = {
  A: (n: number): Id => uuid(n),
  B: (n: number): Id => uuid(10 + n),
  ball: uuid(20),
  t1: uuid(100),
  t2: uuid(101),
  t3a: uuid(102),
  t3b: uuid(103),
}

/**
 * Acceptance scenario of lot 1: 7 v 7 in line, trunk of 2 phases, 2 options at phase 3.
 * A4 carries the ball. T1: A4 runs and passes to A5 who runs. T2: A5 passes to A6.
 * T3 option A (default): A6 runs then passes to A7. T3 option B: A6 passes back to A5 who runs.
 */
export function sevenVsSevenWithOptions(): Play {
  const entities: (PlayerEntity | BallEntity)[] = []
  const positions: Record<Id, Vec2> = {}
  const { attackLineX, defenseLineX, firstY, spacingY } = STARTING_PLACEMENT
  for (let n = 1; n <= 7; n++) {
    entities.push(player(P.A(n), 'A', n))
    positions[P.A(n)] = { x: attackLineX, y: firstY + (n - 1) * spacingY }
  }
  for (let n = 1; n <= 7; n++) {
    entities.push(player(P.B(n), 'B', n))
    positions[P.B(n)] = { x: defenseLineX, y: firstY + (n - 1) * spacingY }
  }
  entities.push(ball(P.ball))
  return basePlay({
    name: 'Croisée au centre',
    entities,
    setup: { positions, ballCarrierId: P.A(4), ballPosition: null },
    phases: [
      phase(P.t1, null, [
        run(
          uuid(200),
          P.A(4),
          [
            { x: 44, y: 36 },
            { x: 46, y: 40 },
          ],
          { pace: 'jog' },
        ),
        run(
          uuid(201),
          P.A(5),
          [
            { x: 42, y: 48 },
            { x: 47, y: 50 },
          ],
          { pace: 'sprint' },
        ),
        pass(uuid(202), P.A(4), P.A(5), 0.8),
      ]),
      phase(P.t2, P.t1, [
        run(uuid(210), P.A(6), [{ x: 45, y: 58 }], { pace: 'jog', delay: 0.2 }),
        pass(uuid(211), P.A(5), P.A(6), 0.5),
      ]),
      phase(
        P.t3a,
        P.t2,
        [
          run(
            uuid(220),
            P.A(6),
            [
              { x: 52, y: 60 },
              { x: 58, y: 62 },
            ],
            { pace: 'sprint' },
          ),
          run(uuid(221), P.A(7), [{ x: 55, y: 66 }], { pace: 'sprint' }),
          pass(uuid(222), P.A(6), P.A(7), 1),
        ],
        { isDefault: true, condition: 'Défense en retrait', instruction: 'On fixe et on donne' },
      ),
      phase(
        P.t3b,
        P.t2,
        [
          run(uuid(230), P.A(5), [{ x: 52, y: 52 }], { pace: 'sprint' }),
          pass(uuid(231), P.A(6), P.A(5), 0.3),
        ],
        { condition: 'Défense montée', instruction: 'Retour intérieur' },
      ),
    ],
  })
}

/** Drill without ball: 4 attackers against 2 defenders (SPEC 4.3, RECETTE lot 1). */
export function fourVsTwoNoBall(): Play {
  const entities: PlayerEntity[] = []
  const positions: Record<Id, Vec2> = {}
  for (let n = 1; n <= 4; n++) {
    entities.push(player(P.A(n), 'A', n))
    positions[P.A(n)] = { x: 20, y: 20 + n * 5 }
  }
  for (let n = 1; n <= 2; n++) {
    entities.push(player(P.B(n), 'B', n))
    positions[P.B(n)] = { x: 30, y: 25 + n * 5 }
  }
  return basePlay({
    name: 'Atelier 4 contre 2',
    category: 'drill',
    entities,
    setup: { positions, ballCarrierId: null, ballPosition: null },
    phases: [
      phase(P.t1, null, [
        run(uuid(300), P.A(1), [{ x: 30, y: 22 }]),
        run(uuid(301), P.B(1), [{ x: 25, y: 28 }], { pace: 'sprint' }),
      ]),
    ],
  })
}
