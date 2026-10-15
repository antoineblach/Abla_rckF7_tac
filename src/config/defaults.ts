// Default values of the tool. Every provisional value is marked HYPOTHÈSE,
// every sourced value carries SOURCE: <url> (CLAUDE.md rule 5, SPEC section 14).

/** Field dimensions in metres (SPEC 13.1). */
export const FIELD_DEFAULTS = {
  // SOURCE: https://passport.world.rugby/laws-of-the-game/laws-by-number/1-the-ground/ (within Law 1 limits)
  length: 100,
  width: 70,
  inGoal: 10,
} as const

/** Law 1 limits of the playing area, used by the inspector and by warnings (DECISIONS Q17). */
export const FIELD_LIMITS = {
  // SOURCE: https://passport.world.rugby/laws-of-the-game/laws-by-number/1-the-ground/
  length: { min: 94, max: 100 },
  width: { min: 68, max: 70 },
  inGoal: { min: 6, max: 22 },
} as const

/** Field markings in metres (SPEC 13.1, DECISIONS Q1 and Q2). */
export const FIELD_MARKINGS = {
  // SOURCE: https://passport.world.rugby/laws-of-the-game/laws-by-number/1-the-ground/
  line22FromGoal: 22,
  // SOURCE: https://passport.world.rugby/laws-of-the-game/laws-by-number/1-the-ground/
  line10FromHalfway: 10,
  // SOURCE: https://passport.world.rugby/laws-of-the-game/laws-by-number/1-the-ground/
  line5FromGoal: 5,
  // SOURCE: https://passport.world.rugby/laws-of-the-game/laws-by-number/1-the-ground/
  line5FromTouch: 5,
  // SOURCE: https://passport.world.rugby/laws-of-the-game/laws-by-number/1-the-ground/
  line15FromTouch: 15,
  // SOURCE: https://passport.world.rugby/laws-of-the-game/laws-by-number/1-the-ground/
  dashLength: 5,
  // HYPOTHÈSE: gap between dashes, not given by Law 1 (DECISIONS Q2).
  dashGap: 5,
  // SOURCE: https://passport.world.rugby/laws-of-the-game/laws-by-number/1-the-ground/
  halfwayMarkLength: 0.5,
  // HYPOTHÈSE: distance between goal posts, only readable on the Law 1 diagram (DECISIONS Q2).
  goalPostSpacing: 5.6,
} as const

/** Paces in m/s (SPEC 5.3). HYPOTHÈSE: walk 2, jog 4, sprint 7, adjustable in reglages.json. */
export const PACE_DEFAULTS = {
  walk: 2,
  jog: 4,
  sprint: 7,
} as const

/** Pass speed in m/s (SPEC 5.4). HYPOTHÈSE, adjustable in reglages.json. */
export const PASS_SPEED_DEFAULT = 12

/** Fixed-point iterations to solve a pass arrival (SPEC 5.4 asks for 3 to 5). */
export const PASS_FIXED_POINT_ITERATIONS = 5

/** Minimum arc-length samples per spline segment (SPEC 5.3). */
export const ARC_LENGTH_SAMPLES_PER_SEGMENT = 64

/** HYPOTHÈSE: recommended maximum length of an instruction, GIF legibility on a phone (SPEC 6.4). */
export const INSTRUCTION_RECOMMENDED_LENGTH = 60

/** HYPOTHÈSE: margin of the automatic framing, in metres (SPEC 7). */
export const AUTO_FRAME_MARGIN = 5

/** HYPOTHÈSE: automatic save delay after the last change, in seconds (SPEC 8.3). */
export const AUTOSAVE_DELAY_SECONDS = 2

/** HYPOTHÈSE: folder rescan period while the window is visible, in seconds (SPEC 8.3). */
export const FOLDER_RESCAN_PERIOD_SECONDS = 30

/** Undo levels (SPEC 6.3). */
export const UNDO_LEVELS = 100

/** Snap grid step in metres (SPEC 6.3). */
export const SNAP_GRID_STEP = 1

/** Keyboard nudges in metres (SPEC 6.2). */
export const NUDGE_STEP = 0.5
export const NUDGE_STEP_LARGE = 5

/** HYPOTHÈSE: lateral offset of players duplicated with Ctrl+D, in metres (DECISIONS Q15). */
export const DUPLICATE_OFFSET = 2

/**
 * Default team colours, distinguishable by colour-blind people (SPEC 6.3, 13.2).
 * SOURCE: https://jfly.uni-koeln.de/color/ (Okabe and Ito palette: blue and orange)
 */
export const TEAM_COLORS = {
  A: '#0072B2',
  B: '#E69F00',
} as const

/** Starting placements in metres (SPEC 6.6). HYPOTHÈSE validated by the user (DECISIONS Q8). */
export const STARTING_PLACEMENT = {
  playersPerTeam: 7,
  attackLineX: 40,
  defenseLineX: 50,
  firstY: 5,
  spacingY: 10,
  ballCarrierNumber: 4,
} as const
