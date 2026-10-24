// Deterministic play builders for tests. Never imported by the application.
import { BREAKDOWN_DURATION_DEFAULT, STARTING_PLACEMENT, TEAM_COLORS } from '../config/defaults'
import type { IdFactory } from '../model/ids'
import type { PlacementPreset } from '../model/preset'
import type {
  Action,
  BallEntity,
  BreakdownAction,
  Id,
  KickAction,
  KickTarget,
  PassAction,
  Phase,
  Play,
  PlayerEntity,
  RunAction,
  Team,
  Vec2,
  Waypoint,
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
  waypoints: Waypoint[],
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

export function kick(
  id: Id,
  kickerId: Id,
  target: KickTarget,
  delay: number,
  extra: Partial<KickAction> = {},
): KickAction {
  return { id, type: 'kick', kickerId, kind: 'long', target, delay, ...extra }
}

export function breakdown(
  id: Id,
  tackledId: Id,
  supportId: Id,
  relayerId: Id,
  delay: number,
  extra: Partial<BreakdownAction> = {},
): BreakdownAction {
  return {
    id,
    type: 'breakdown',
    kind: 'ruck',
    tackledId,
    supportId,
    relayerId,
    delay,
    duration: BREAKDOWN_DURATION_DEFAULT,
    ...extra,
  }
}

export function preset(extra: Partial<PlacementPreset> = {}): PlacementPreset {
  return {
    schemaVersion: 1,
    id: uuid(8000),
    name: 'Touche à 4',
    type: 'lineout',
    positions: [],
    ball: null,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...extra,
  }
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
    schemaVersion: 3,
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

/**
 * Set pieces of lot 3, source of the frozen fixture `play-v2-lot3.json` (never change it: the
 * fixture must stay equal to it). 7 v 7 in line, ball on the ground next to A4.
 * T1: A4 picks the ball up at once, runs into contact; ruck (support A5, relayer A3, guard).
 * T2: A3 passes to A2 who runs forward (forward pass).
 * T3 option A (default): A2 kicks long to a point. T3 option B: maul on A2 (support A1,
 * relayer A3, jackal), then T4: A3 kicks a restart to B7.
 */
export function setPiecesPlay(): Play {
  const play = sevenVsSevenWithOptions()
  return {
    ...play,
    name: 'Ruck puis jeu au pied',
    setup: { ...play.setup, ballCarrierId: null, ballPosition: { x: 40.5, y: 35 } },
    phases: [
      phase(P.t1, null, [
        run(uuid(400), P.A(4), [{ x: 46, y: 36 }], { durationOverride: 1.5 }),
        run(uuid(401), P.A(5), [{ x: 45, y: 37 }], { durationOverride: 1.5 }),
        breakdown(uuid(402), P.A(4), P.A(5), P.A(3), 1.5, { contest: 'guard' }),
      ]),
      phase(P.t2, P.t1, [
        run(uuid(410), P.A(2), [{ x: 50, y: 18 }], { pace: 'sprint' }),
        pass(uuid(411), P.A(3), P.A(2), 0.2),
      ]),
      phase(P.t3a, P.t2, [kick(uuid(420), P.A(2), { point: { x: 75, y: 12 } }, 0.5)], {
        isDefault: true,
        condition: 'Ailière adverse montée',
        instruction: 'Par-dessus',
      }),
      phase(
        P.t3b,
        P.t2,
        [
          run(uuid(430), P.A(1), [{ x: 49, y: 13 }], { pace: 'sprint' }),
          breakdown(uuid(431), P.A(2), P.A(1), P.A(3), 0.5, {
            kind: 'maul',
            contest: 'jackal',
            duration: 2.5,
          }),
        ],
        { condition: 'Défense en retrait', instruction: 'Maul' },
      ),
      phase(uuid(104), P.t3b, [
        kick(uuid(440), P.A(3), { receiverId: P.B(7) }, 0.2, { kind: 'restart', flightTime: 2.5 }),
      ]),
    ],
  }
}

/**
 * Realistic runs of lot 3 bis, source of the frozen fixture `play-v3-lot3bis.json` (never change
 * it: the fixture must stay equal to it). 7 v 7 in line, A4 carries the ball.
 * T1: A4 runs (sprint to her second point) and ends at speed, prolonged in T2; A5 runs, her end
 * on the end of A4's run (delayed start); A2 meets A4's first point at her first point; A6 has an
 * imposed duration; A4 passes to A5.
 * T2: A4 goes on; A5 passes to A6, whose first point meets the arrival (adjusted speed); A6
 * passes on receipt to A7, whose run starts with the release (delayed start) and ends at speed.
 * T3 option A (default): A7 goes on, ruck on A7 (support A6, relayer A5); A3 reaches her point at
 * the formation; A5 kicks on receipt to B4. T3 option B: A7 does not go on; she kicks to a point,
 * A6 reaches the landing point with the ball (adjusted speed).
 */
export function realisticRunsPlay(): Play {
  const play = sevenVsSevenWithOptions()
  const t1Run4 = uuid(500)
  const t2Pass = uuid(511)
  const t2PassOn = uuid(513)
  const t3aRuck = uuid(521)
  const t3bKick = uuid(530)
  return {
    ...play,
    name: 'Courses réalistes',
    phases: [
      phase(P.t1, null, [
        run(
          t1Run4,
          P.A(4),
          [
            { x: 44, y: 36 },
            { x: 46, y: 40, speed: 'sprint' },
          ],
          { endsAtSpeed: true },
        ),
        run(
          uuid(501),
          P.A(5),
          [
            { x: 42, y: 48 },
            { x: 47, y: 50, speed: 6.2 },
          ],
          { sync: { target: { actionId: t1Run4, event: 'runEnd' }, adjust: 'delay' } },
        ),
        run(
          uuid(502),
          P.A(2),
          [
            { x: 43, y: 20 },
            { x: 48, y: 22 },
          ],
          {
            pace: 'walk',
            sync: {
              target: { actionId: t1Run4, event: 'runPoint', index: 0 },
              at: 0,
              adjust: 'delay',
            },
          },
        ),
        run(uuid(503), P.A(6), [{ x: 44, y: 58 }], { durationOverride: 2.5 }),
        pass(uuid(504), P.A(4), P.A(5), 0.8),
      ]),
      phase(P.t2, P.t1, [
        run(uuid(510), P.A(4), [{ x: 50, y: 42 }], { pace: 'sprint' }),
        pass(t2Pass, P.A(5), P.A(6), 0.3),
        run(
          uuid(512),
          P.A(6),
          [
            { x: 50, y: 60 },
            { x: 54, y: 62 },
          ],
          {
            sync: { target: { actionId: t2Pass, event: 'arrival' }, at: 0, adjust: 'speed' },
          },
        ),
        pass(t2PassOn, P.A(6), P.A(7), 0.2, { release: 'onReceipt' }),
        run(uuid(514), P.A(7), [{ x: 52, y: 66 }], {
          pace: 'sprint',
          endsAtSpeed: true,
          sync: { target: { actionId: t2PassOn, event: 'release' }, adjust: 'delay' },
        }),
      ]),
      phase(
        P.t3a,
        P.t2,
        [
          run(uuid(520), P.A(7), [{ x: 60, y: 66 }], { pace: 'sprint' }),
          breakdown(t3aRuck, P.A(7), P.A(6), P.A(5), 1.5),
          run(uuid(522), P.A(3), [{ x: 55, y: 50 }], {
            sync: { target: { actionId: t3aRuck, event: 'formation' }, adjust: 'delay' },
          }),
          kick(uuid(523), P.A(5), { receiverId: P.B(4) }, 0.3, { release: 'onReceipt' }),
        ],
        { isDefault: true, condition: 'Ailière seule', instruction: 'On va au contact' },
      ),
      phase(
        P.t3b,
        P.t2,
        [
          kick(t3bKick, P.A(7), { point: { x: 75, y: 60 } }, 0.5),
          run(uuid(531), P.A(6), [{ x: 74, y: 60 }], {
            pace: 'sprint',
            sync: { target: { actionId: t3bKick, event: 'arrival' }, adjust: 'speed' },
          }),
        ],
        { condition: 'Défense montée', instruction: 'Par-dessus' },
      ),
    ],
  }
}

/** Placement preset of a lineout, source of the frozen fixture `preset-v1-touche.json`. */
export function lineoutPreset(): PlacementPreset {
  return preset({
    positions: [
      { role: 'attack', number: 2, forward: -0.5, openSide: -1 },
      { role: 'attack', number: 1, forward: -0.5, openSide: 6 },
      { role: 'attack', number: 3, forward: -0.5, openSide: 8 },
      { role: 'attack', number: 4, forward: -4, openSide: 10 },
      { role: 'defense', number: 1, forward: 0.5, openSide: 6 },
      { role: 'defense', number: 3, forward: 0.5, openSide: 8 },
      { role: 'defense', number: 2, forward: 2, openSide: 2 },
    ],
    ball: { forward: -0.5, openSide: -1, carrierRole: 'attack', carrierNumber: 2 },
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

/** Ids of the lot 3 bis speeds scene (speedsPlay). */
export const SPEEDS = {
  A1: uuid(1),
  A2: uuid(2),
  A3: uuid(3),
  T1: uuid(100),
  RUN_FAST: uuid(200),
  RUN_WARNING: uuid(201),
  RUN_LINKED: uuid(202),
  PASS: uuid(203),
} as const

/**
 * One phase (lot 3 bis): A1 walks, then sprints, then runs at 7 m/s (25,2 km/h, red badge); A2 runs
 * at 6 m/s (21,6 km/h, orange badge); A3 jogs, synchronised on the end of the run of A2; a pass
 * from A1 to A2.
 */
export function speedsPlay(): Play {
  const { A1, A2, A3 } = SPEEDS
  return basePlay({
    entities: [player(A1, 'A', 1), player(A2, 'A', 2), player(A3, 'A', 3), ball(uuid(20))],
    setup: {
      positions: { [A1]: { x: 40, y: 30 }, [A2]: { x: 38, y: 40 }, [A3]: { x: 36, y: 20 } },
      ballCarrierId: A1,
      ballPosition: null,
    },
    phases: [
      phase(SPEEDS.T1, null, [
        run(SPEEDS.RUN_FAST, A1, [
          { x: 50, y: 30, speed: 'walk' },
          { x: 70, y: 30, speed: 'sprint' },
          { x: 95, y: 30, speed: 7 },
        ]),
        run(SPEEDS.RUN_WARNING, A2, [{ x: 70, y: 42, speed: 6 }]),
        run(SPEEDS.RUN_LINKED, A3, [{ x: 60, y: 18 }], {
          sync: { target: { actionId: SPEEDS.RUN_WARNING, event: 'runEnd' }, adjust: 'delay' },
        }),
        pass(SPEEDS.PASS, A1, A2, 1),
      ]),
    ],
  })
}
