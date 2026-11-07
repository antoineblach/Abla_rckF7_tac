// Deterministic play builders for tests. Never imported by the application.
import { BREAKDOWN_DURATION_DEFAULT, STARTING_PLACEMENT, TEAM_COLORS } from '../config/defaults'
import type { IdFactory } from '../model/ids'
import type { PlacementPreset } from '../model/preset'
import type {
  Action,
  BallEntity,
  Branch,
  BreakdownAction,
  Id,
  KickAction,
  KickTarget,
  PassAction,
  Play,
  PlayerEntity,
  RunAction,
  Sequence,
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

/** Branch of the actions and sequences built without an explicit one. */
export const ROOT_BRANCH = uuid(100)

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
  return {
    id,
    type: 'run',
    branchId: ROOT_BRANCH,
    start: 0,
    entityId,
    waypoints,
    pace: 'jog',
    ...extra,
  }
}

export function pass(
  id: Id,
  fromId: Id,
  toId: Id,
  start: number,
  extra: Partial<PassAction> = {},
): PassAction {
  return { id, type: 'pass', branchId: ROOT_BRANCH, start, fromId, toId, ...extra }
}

export function kick(
  id: Id,
  kickerId: Id,
  target: KickTarget,
  start: number,
  extra: Partial<KickAction> = {},
): KickAction {
  return {
    id,
    type: 'kick',
    branchId: ROOT_BRANCH,
    start,
    kickerId,
    kind: 'long',
    target,
    ...extra,
  }
}

export function breakdown(
  id: Id,
  tackledId: Id,
  supportId: Id,
  relayerId: Id,
  start: number,
  extra: Partial<BreakdownAction> = {},
): BreakdownAction {
  return {
    id,
    type: 'breakdown',
    branchId: ROOT_BRANCH,
    start,
    kind: 'ruck',
    tackledId,
    supportId,
    relayerId,
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

export function branch(id: Id, parentId: Id | null, extra: Partial<Branch> = {}): Branch {
  return { id, parentId, label: '', condition: '', isDefault: false, ...extra }
}

export function sequence(
  id: Id,
  start: number,
  end: number,
  extra: Partial<Sequence> = {},
): Sequence {
  return { id, branchId: ROOT_BRANCH, start, end, label: '', instruction: '', ...extra }
}

export function basePlay(extra: Partial<Play> = {}): Play {
  return {
    schemaVersion: 5,
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
    branches: [branch(ROOT_BRANCH, null)],
    actions: [],
    sequences: [],
    ...extra,
  }
}

/** Ids of the 7 v 7 scenario: A1..A7 = 1..7, B1..B7 = 11..17, ball = 20. */
export const P = {
  A: (n: number): Id => uuid(n),
  B: (n: number): Id => uuid(10 + n),
  ball: uuid(20),
  root: ROOT_BRANCH,
  optA: uuid(102),
  optB: uuid(103),
  /** Options of the option B of `friseFixturePlay`. */
  optB1: uuid(105),
  optB2: uuid(106),
}

/**
 * Acceptance scenario of lot 1: 7 v 7 in line, a trunk, 2 options at 6.335 s.
 * A4 carries the ball. A4 runs and passes to A5 who runs; A5 passes to A6.
 * Option A (default): A6 runs then passes to A7. Option B: A6 passes back to A5 who runs.
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
  const optA = { branchId: P.optA }
  const optB = { branchId: P.optB }
  return basePlay({
    name: 'Croisée au centre',
    entities,
    setup: { positions, ballCarrierId: P.A(4), ballPosition: null },
    branches: [
      branch(P.root, null, { branchAt: 6.335 }),
      branch(P.optA, P.root, { isDefault: true, condition: 'Défense en retrait' }),
      branch(P.optB, P.root, { condition: 'Défense montée' }),
    ],
    actions: [
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
      run(uuid(210), P.A(6), [{ x: 45, y: 58 }], { pace: 'jog', start: 3.686 }),
      pass(uuid(211), P.A(5), P.A(6), 3.986),
      run(
        uuid(220),
        P.A(6),
        [
          { x: 52, y: 60 },
          { x: 58, y: 62 },
        ],
        { ...optA, pace: 'sprint', start: 6.335 },
      ),
      run(uuid(221), P.A(7), [{ x: 55, y: 66 }], { ...optA, pace: 'sprint', start: 6.335 }),
      pass(uuid(222), P.A(6), P.A(7), 7.335, optA),
      run(uuid(230), P.A(5), [{ x: 52, y: 52 }], { ...optB, pace: 'sprint', start: 6.335 }),
      pass(uuid(231), P.A(6), P.A(5), 6.635, optB),
    ],
    sequences: [
      sequence(uuid(240), 6.335, 10.577, { ...optA, instruction: 'On fixe et on donne' }),
      sequence(uuid(241), 6.335, 8.68, { ...optB, instruction: 'Retour intérieur' }),
    ],
  })
}

/**
 * Set pieces of lot 3. 7 v 7 in line, ball on the ground next to A4. A4 picks the ball up at once,
 * runs into contact; ruck at 1.5 s (support A5, relayer A3, guard). A3 passes to A2 who runs.
 * Option A (default): A2 kicks long to a point. Option B: maul on A2 (support A1, relayer A3,
 * jackal), then A3 kicks a restart to B7.
 */
export function setPiecesPlay(): Play {
  const play = sevenVsSevenWithOptions()
  const optA = { branchId: P.optA }
  const optB = { branchId: P.optB }
  return {
    ...play,
    name: 'Ruck puis jeu au pied',
    setup: { ...play.setup, ballCarrierId: null, ballPosition: { x: 40.5, y: 35 } },
    branches: [
      branch(P.root, null, { branchAt: 7.9 }),
      branch(P.optA, P.root, { isDefault: true, condition: 'Ailière adverse montée' }),
      branch(P.optB, P.root, { condition: 'Défense en retrait' }),
    ],
    actions: [
      run(uuid(400), P.A(4), [{ x: 46, y: 36 }], { durationOverride: 1.5 }),
      run(uuid(401), P.A(5), [{ x: 45, y: 37 }], { durationOverride: 1.5 }),
      breakdown(uuid(402), P.A(4), P.A(5), P.A(3), 1.5, { contest: 'guard' }),
      run(uuid(410), P.A(2), [{ x: 50, y: 18 }], { pace: 'sprint', start: 4.5 }),
      pass(uuid(411), P.A(3), P.A(2), 4.7),
      kick(uuid(420), P.A(2), { point: { x: 75, y: 12 } }, 8.4, optA),
      run(uuid(430), P.A(1), [{ x: 49, y: 13 }], { ...optB, pace: 'sprint', start: 7.9 }),
      breakdown(uuid(431), P.A(2), P.A(1), P.A(3), 8.4, {
        ...optB,
        kind: 'maul',
        contest: 'jackal',
        duration: 2.5,
      }),
      kick(uuid(440), P.A(3), { receiverId: P.B(7) }, 11.1, {
        ...optB,
        kind: 'restart',
        flightTime: 2.5,
      }),
    ],
    sequences: [
      sequence(uuid(421), 7.9, 11.9, { ...optA, instruction: 'Par-dessus' }),
      sequence(uuid(432), 7.9, 10.9, { ...optB, instruction: 'Maul' }),
    ],
  }
}

/**
 * The set pieces as they were played in lot 3, for the tests of the set pieces themselves: without
 * the imposed durations of the first runs, met exactly since lot 3bis-1 (6 m in 1.5 s, D-129). The
 * runs of A4 and A5 are cut by the ruck (D-079), which forms behind: the pass to A2 is forward.
 */
export function setPiecesScene(): Play {
  const play = setPiecesPlay()
  return {
    ...play,
    actions: [
      run(uuid(400), P.A(4), [{ x: 46, y: 36 }]),
      run(uuid(401), P.A(5), [{ x: 45, y: 37 }]),
      ...play.actions.slice(2),
    ],
  }
}

/**
 * Realistic runs, base of the frozen fixture `play-v5-frise.json` through `friseFixturePlay` (never
 * change it: the fixture must stay equal to it). The scene of lot 3 bis, 7 v 7 in line, A4 carries
 * the ball: 18 actions, the 16 of version 4 plus one run for each cut rendez-vous.
 * Trunk: A4 runs and goes on with a glued run; A5 ends with the end of A4's first run; A2 reaches
 * her first point with A4's first point, then goes on; A6 has an imposed duration; A4 passes to A5,
 * A5 to A6, whose first point meets the arrival; A6 passes on receipt to A7, who runs onto the ball.
 * The branch point is glued to the end of that run: the pass is not in flight there (D-139 Q2).
 * Option A (default): A7 goes on, ruck on A7 (support A6, relayer A5); A3 reaches her point at the
 * formation; A5 kicks on receipt to B4. Option B: A7 does not go on (D-139 Q1); she kicks to a
 * point, A6 reaches the landing point with the ball.
 * Glued edges keep a plausible last value in their `start` (SPEC 4.1).
 */
export function realisticRunsPlay(): Play {
  const play = sevenVsSevenWithOptions()
  const run4 = uuid(500)
  const run2 = uuid(502)
  const pass6 = uuid(511)
  const run6 = uuid(512)
  const passOn = uuid(513)
  const run7 = uuid(514)
  const ruck = uuid(521)
  const kickB = uuid(530)
  const optA = { branchId: P.optA }
  const optB = { branchId: P.optB }
  return {
    ...play,
    name: 'Courses réalistes',
    branches: [
      branch(P.root, null, { branchAt: 6.594, branchAtGlue: { targetId: run7, event: 'end' } }),
      branch(P.optA, P.root, { isDefault: true, condition: 'Ailière seule' }),
      branch(P.optB, P.root, { condition: 'Défense montée' }),
    ],
    actions: [
      run(run4, P.A(4), [
        { x: 44, y: 36 },
        { x: 46, y: 40, speed: 'sprint' },
      ]),
      run(
        uuid(501),
        P.A(5),
        [
          { x: 42, y: 48 },
          { x: 47, y: 50, speed: 6.2 },
        ],
        { start: 0.067, endGlue: { targetId: run4, event: 'end', keep: 'duration' } },
      ),
      run(run2, P.A(2), [{ x: 43, y: 20 }], {
        pace: 'walk',
        endGlue: { targetId: run4, event: { point: 0 }, keep: 'duration' },
      }),
      run(uuid(505), P.A(2), [{ x: 48, y: 22 }], {
        pace: 'walk',
        start: 1.7,
        startGlue: { targetId: run2, event: 'end' },
      }),
      run(uuid(503), P.A(6), [{ x: 44, y: 58 }], { durationOverride: 2.5 }),
      pass(uuid(504), P.A(4), P.A(5), 0.8),
      run(uuid(510), P.A(4), [{ x: 50, y: 42 }], {
        pace: 'sprint',
        start: 3.459,
        startGlue: { targetId: run4, event: 'end' },
      }),
      pass(pass6, P.A(5), P.A(6), 5.039),
      run(run6, P.A(6), [{ x: 50, y: 60 }], {
        start: 4.739,
        endGlue: { targetId: pass6, event: 'end', keep: 'start' },
      }),
      run(uuid(515), P.A(6), [{ x: 54, y: 62 }], {
        start: 5.909,
        startGlue: { targetId: run6, event: 'end' },
      }),
      pass(passOn, P.A(6), P.A(7), 6.109, {
        startGlue: { targetId: pass6, event: 'end', offset: 0.2 },
      }),
      run(run7, P.A(7), [{ x: 52, y: 66 }], {
        pace: 'sprint',
        start: 5.224,
        endGlue: { targetId: passOn, event: 'end', keep: 'duration' },
      }),
      run(uuid(520), P.A(7), [{ x: 60, y: 66 }], {
        ...optA,
        pace: 'sprint',
        start: 6.594,
        startGlue: { targetId: run7, event: 'end' },
      }),
      breakdown(ruck, P.A(7), P.A(6), P.A(5), 8.5, optA),
      run(uuid(522), P.A(3), [{ x: 55, y: 50 }], {
        ...optA,
        start: 6.594,
        endGlue: { targetId: ruck, event: 'start', keep: 'duration' },
      }),
      kick(uuid(523), P.A(5), { receiverId: P.B(4) }, 11.8, {
        ...optA,
        startGlue: { targetId: ruck, event: 'end', offset: 0.3 },
      }),
      kick(kickB, P.A(7), { point: { x: 75, y: 60 } }, 8.028, optB),
      run(uuid(531), P.A(6), [{ x: 74, y: 60 }], {
        ...optB,
        pace: 'sprint',
        start: 7.528,
        endGlue: { targetId: kickB, event: 'end', keep: 'start' },
      }),
    ],
    sequences: [
      sequence(uuid(602), 6.594, 11.5, {
        ...optA,
        instruction: 'On va au contact',
        startGlue: { targetId: P.root, event: 'end' },
        endGlue: { targetId: ruck, event: 'end', keep: 'duration' },
      }),
      sequence(uuid(603), 6.594, 11.528, {
        ...optB,
        instruction: 'Par-dessus',
        startGlue: { targetId: P.root, event: 'end' },
        endGlue: { targetId: kickB, event: 'end', keep: 'start' },
      }),
    ],
  }
}

/**
 * Source of the frozen fixture `play-v5-frise.json`, for the migrations of lots 4 and 5 (never
 * change it: the fixture must stay equal to it). The realistic runs, with typed paces, plus a
 * nested branch point and what covers the whole model: every event a glue can target (start and
 * end of a run, a pass, a kick, a breakdown and a sequence, waypoint of a run, branch point), left
 * and right edges of every kind of block, both `keep`, offsets, typed labels, maul and restart.
 */
export function friseFixturePlay(): Play {
  const play = realisticRunsPlay()
  const run4 = uuid(500)
  const passOn = uuid(513)
  const kickB = uuid(530)
  const seqStart = uuid(600)
  const seqOptB = uuid(603)
  const run5B1 = uuid(555)
  const run2B1 = uuid(557)
  const run3B2 = uuid(553)
  const passB2 = uuid(551)
  const optA = { branchId: P.optA }
  const optB = { branchId: P.optB }
  const optB1 = { branchId: P.optB1 }
  const optB2 = { branchId: P.optB2 }
  const typed = (action: Action): Action => {
    if (action.type === 'run' && (action.id === uuid(502) || action.id === uuid(505))) {
      return { ...action, pace: 3 }
    }
    if (action.type === 'run' && action.id === uuid(503)) return { ...action, pace: 5.5 }
    if (action.type === 'breakdown' && action.id === uuid(521)) {
      return { ...action, contest: 'guard' }
    }
    if (action.type === 'kick' && action.id === uuid(523)) return { ...action, flightTime: 3 }
    return action
  }
  return {
    ...play,
    name: 'Frise complète',
    notes: 'Fixture figée de la version 5.',
    field: { ...play.field, view: { kind: 'half', side: 'attack' } },
    branches: [
      branch(P.root, null, {
        branchAt: 6.594,
        branchAtGlue: { targetId: uuid(514), event: 'end' },
      }),
      branch(P.optA, P.root, { isDefault: true, condition: 'Ailière seule' }),
      branch(P.optB, P.root, {
        condition: 'Défense montée',
        label: 'Par-dessus',
        branchAt: 11.528,
        branchAtGlue: { targetId: kickB, event: 'end' },
      }),
      branch(P.optB1, P.optB, { isDefault: true, condition: 'Ballon capté' }),
      branch(P.optB2, P.optB, { condition: 'Ballon contesté' }),
    ],
    actions: [
      ...play.actions.map(typed),
      // Trunk: start of a run with an offset, release of a pass.
      run(uuid(541), P.A(3), [{ x: 42, y: 25 }], {
        start: 0.5,
        startGlue: { targetId: run4, event: 'start', offset: 0.5 },
      }),
      run(uuid(540), P.A(1), [{ x: 44, y: 10 }], {
        start: 6.109,
        startGlue: { targetId: passOn, event: 'start' },
      }),
      // Option A: branch point.
      run(uuid(544), P.A(4), [{ x: 56, y: 44 }], {
        ...optA,
        start: 6.794,
        startGlue: { targetId: P.root, event: 'end', offset: 0.2 },
      }),
      // Option B: release of a kick, start of a sequence.
      run(uuid(542), P.A(5), [{ x: 55, y: 51 }], {
        ...optB,
        start: 8.028,
        startGlue: { targetId: kickB, event: 'start' },
      }),
      run(uuid(543), P.A(2), [{ x: 60, y: 24 }], {
        ...optB,
        pace: 'walk',
        start: 6.594,
        startGlue: { targetId: seqOptB, event: 'start' },
      }),
      // Nested option B1: pass and kick with a glued right edge.
      run(uuid(550), P.A(6), [{ x: 85, y: 58 }], {
        ...optB1,
        pace: 6,
        start: 11.528,
        startGlue: { targetId: uuid(531), event: 'end' },
      }),
      run(run5B1, P.A(5), [{ x: 70, y: 52 }], { ...optB1, start: 11.528 }),
      pass(uuid(556), P.A(6), P.A(5), 14, {
        ...optB1,
        endGlue: { targetId: run5B1, event: 'end', keep: 'duration' },
      }),
      run(run2B1, P.A(2), [{ x: 88, y: 30 }], { ...optB1, start: 16 }),
      kick(uuid(554), P.A(5), { point: { x: 90, y: 30 } }, 16, {
        ...optB1,
        kind: 'restart',
        flightTime: 3,
        endGlue: { targetId: run2B1, event: 'end', keep: 'start' },
      }),
      // Nested option B2: nested branch point, maul with both edges glued.
      pass(passB2, P.A(6), P.A(5), 11.828, {
        ...optB2,
        ballSpeed: 12,
        startGlue: { targetId: P.optB, event: 'end', offset: 0.3 },
      }),
      run(run3B2, P.A(3), [{ x: 60, y: 42 }], { ...optB2, start: 12.5 }),
      breakdown(uuid(552), P.A(5), P.A(1), P.A(2), 13.578, {
        ...optB2,
        kind: 'maul',
        contest: 'jackal',
        duration: 2.5,
        startGlue: { targetId: passB2, event: 'end' },
        endGlue: { targetId: run3B2, event: 'end', keep: 'start' },
      }),
    ],
    sequences: [
      sequence(seqStart, 0, 3.459, {
        label: 'Lancement',
        instruction: 'On fixe le premier rideau',
        endGlue: { targetId: run4, event: 'end', keep: 'start' },
      }),
      sequence(uuid(601), 3.459, 6.594, {
        startGlue: { targetId: seqStart, event: 'end' },
        endGlue: { targetId: P.root, event: 'end', keep: 'start' },
      }),
      ...play.sequences,
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
    actions: [
      run(uuid(300), P.A(1), [{ x: 30, y: 22 }]),
      run(uuid(301), P.B(1), [{ x: 25, y: 28 }], { pace: 'sprint' }),
    ],
  })
}

/** Source of `e2e/fixtures/options.combi.json`: the scenario with options of the e2e tests. */
export function optionsScenarioPlay(): Play {
  return { ...sevenVsSevenWithOptions(), id: uuid(9100), name: 'Croisée test' }
}

/**
 * One player, options inside an option: the trunk « Fixer », then « Large » (default, itself with
 * an unnamed default option and « Montée ») or « Serré ». Times from rest at a jog: 4 m in 2.159 s.
 */
function doubleOptionPlay(): Play {
  const A1 = P.A(1)
  const large = uuid(120)
  const tight = uuid(121)
  const wide = uuid(122)
  const up = uuid(123)
  return basePlay({
    id: uuid(9002),
    name: 'Double option',
    entities: [player(A1, 'A', 1)],
    setup: { positions: { [A1]: { x: 40, y: 35 } }, ballCarrierId: null, ballPosition: null },
    branches: [
      branch(P.root, null, { branchAt: 2.2 }),
      branch(large, P.root, { isDefault: true, condition: 'Large', branchAt: 4.4 }),
      branch(tight, P.root, { condition: 'Serré' }),
      branch(wide, large, { isDefault: true }),
      branch(up, large, { condition: 'Montée' }),
    ],
    actions: [
      run(uuid(400), A1, [{ x: 44, y: 35 }]),
      run(uuid(401), A1, [{ x: 48, y: 35 }], { branchId: large, start: 2.2 }),
      run(uuid(402), A1, [{ x: 44, y: 39 }], { branchId: tight, start: 2.2 }),
      run(uuid(403), A1, [{ x: 52, y: 35 }], { branchId: wide, start: 4.4 }),
      run(uuid(404), A1, [{ x: 48, y: 39 }], { branchId: up, start: 4.4 }),
    ],
    sequences: [sequence(uuid(410), 0, 2.2, { instruction: 'Fixer' })],
  })
}

/**
 * Source of `e2e/fixtures/cahier.combipack.json`: five plays for the playbook, one with three
 * options, one with options inside an option, one without ball.
 */
export function playbookPlays(): Play[] {
  const centre = sevenVsSevenWithOptions()
  const optC = uuid(104)
  const threeOptions: Play = {
    ...centre,
    id: uuid(9001),
    name: 'Trois options « au large »',
    branches: [...centre.branches, branch(optC, P.root, { condition: 'Défense glissée' })],
    actions: [
      ...centre.actions,
      run(uuid(232), P.A(7), [{ x: 52, y: 68 }], { branchId: optC, pace: 'sprint', start: 6.335 }),
    ],
    sequences: [
      ...centre.sequences,
      sequence(uuid(242), 6.335, 10.091, { branchId: optC, instruction: 'Jeu au large' }),
    ],
  }
  return [
    centre,
    threeOptions,
    doubleOptionPlay(),
    { ...fourVsTwoNoBall(), id: uuid(9003) },
    { ...centre, id: uuid(9004), name: 'Croisée côté fermé', category: 'scrum' },
  ]
}

/** Ids of the lot 3 bis speeds scene (speedsPlay). */
export const SPEEDS = {
  A1: uuid(1),
  A2: uuid(2),
  A3: uuid(3),
  RUN_FAST: uuid(200),
  RUN_WARNING: uuid(201),
  RUN_LINKED: uuid(202),
  PASS: uuid(203),
} as const

/**
 * Lot 3 bis: A1 walks, then sprints, then runs at 7 m/s (25,2 km/h, red badge); A2 runs at 6 m/s
 * (21,6 km/h, orange badge); A3 jogs, her end glued to the end of the run of A2; a pass from A1
 * to A2.
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
    actions: [
      run(SPEEDS.RUN_FAST, A1, [
        { x: 50, y: 30, speed: 'walk' },
        { x: 70, y: 30, speed: 'sprint' },
        { x: 95, y: 30, speed: 7 },
      ]),
      run(SPEEDS.RUN_WARNING, A2, [{ x: 70, y: 42, speed: 6 }]),
      run(SPEEDS.RUN_LINKED, A3, [{ x: 60, y: 18 }], {
        endGlue: { targetId: SPEEDS.RUN_WARNING, event: 'end', keep: 'duration' },
      }),
      pass(SPEEDS.PASS, A1, A2, 1),
    ],
  })
}

/** Ids of the lot 3bis-1 acceleration scene (accelPlay). */
export const ACCELS = {
  A1: uuid(1),
  A2: uuid(2),
  RUN_RED: uuid(200),
  RUN_ORANGE: uuid(201),
} as const

/**
 * Lot 3bis-1 (D-132): two 20 m sprints from rest to rest with an imposed duration, sped up beyond
 * the bounds (red speed badge each). A1 in 3.5 s: acceleration 10.5 and braking 8.1 m/s², red
 * diamonds; A2 in 4.2 s: 7.3 and 5.6 m/s², orange diamonds.
 */
export function accelPlay(): Play {
  const { A1, A2 } = ACCELS
  return basePlay({
    entities: [player(A1, 'A', 1), player(A2, 'A', 2)],
    setup: {
      positions: { [A1]: { x: 40, y: 25 }, [A2]: { x: 40, y: 35 } },
      ballCarrierId: null,
      ballPosition: null,
    },
    actions: [
      run(ACCELS.RUN_RED, A1, [{ x: 60, y: 25 }], { pace: 'sprint', durationOverride: 3.5 }),
      run(ACCELS.RUN_ORANGE, A2, [{ x: 60, y: 35 }], { pace: 'sprint', durationOverride: 4.2 }),
    ],
  })
}
