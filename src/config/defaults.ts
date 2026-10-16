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

/** HYPOTHÈSE: pointer movement, in CSS pixels, before a press on a player or a waypoint becomes a
 * drag; below it, a click selects without moving anything (D-051). */
export const DRAG_THRESHOLD_PX = 4

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

/** HYPOTHÈSE: margin around the field in the « terrain complet » view, in metres. */
export const FULL_VIEW_MARGIN = 2

/** HYPOTHÈSE: aspect ratios of the orientation preview (prepares the GIF formats of lot 2). */
export const ORIENTATION_ASPECT = {
  landscape: 16 / 9,
  portrait: 9 / 16,
  square: 1,
} as const

/**
 * Graphic themes (SPEC 13.2). Sizes in CSS pixels at scale 1; flat colours only.
 * HYPOTHÈSE: every colour and size below. « Contraste fort »: saturated flat colours and every
 * stroke at least 3 px at scale 1 (SPEC 13.2).
 */
export const THEME_VALUES = {
  screen: {
    background: '#24502c',
    grass: '#3f8a4a',
    inGoal: '#37793f',
    fieldLine: '#ffffff',
    fieldLineWidth: 1.5,
    postRadius: 2.5,
    tokenRadius: 11,
    tokenStroke: '#ffffff',
    tokenStrokeWidth: 1.5,
    font: '"Atkinson Hyperlegible", sans-serif',
    tokenFontSize: 12,
    runWidth: 2.5,
    passWidth: 2.5,
    passDash: [0.1, 5],
    arrowSize: 9,
    fadeTowardsGrass: 0.55,
    ghost: '#c8d6c9',
    ghostWidth: 1.5,
    error: '#d7191c',
    ballFill: '#ffffff',
    ballStroke: '#202020',
    ballStrokeWidth: 1.5,
    ballLength: 11,
    ballWidth: 7,
    gainLine: '#ffe36e',
    gainLineWidth: 1.5,
    gainLineDash: [6, 5],
    gainArrowSize: 8,
    bannerBackground: '#1b1b1b',
    bannerText: '#ffffff',
    bannerFontSize: 15,
    bannerPadding: 8,
    selection: '#ffe36e',
    selectionWidth: 2,
    handleRadius: 5,
    handleFill: '#ffffff',
    handleStroke: '#1b1b1b',
  },
  highContrast: {
    background: '#002b0b',
    grass: '#0a6b24',
    inGoal: '#075a1d',
    fieldLine: '#ffffff',
    fieldLineWidth: 3,
    postRadius: 3.5,
    tokenRadius: 13,
    tokenStroke: '#000000',
    tokenStrokeWidth: 3,
    font: '"Atkinson Hyperlegible", sans-serif',
    tokenFontSize: 14,
    runWidth: 4,
    passWidth: 4,
    passDash: [0.1, 7],
    arrowSize: 12,
    fadeTowardsGrass: 0.5,
    ghost: '#d9e7da',
    ghostWidth: 3,
    error: '#ff1744',
    ballFill: '#ffffff',
    ballStroke: '#000000',
    ballStrokeWidth: 3,
    ballLength: 13,
    ballWidth: 9,
    gainLine: '#ffeb3b',
    gainLineWidth: 3,
    gainLineDash: [8, 6],
    gainArrowSize: 11,
    bannerBackground: '#000000',
    bannerText: '#ffeb3b',
    bannerFontSize: 17,
    bannerPadding: 9,
    selection: '#ffeb3b',
    selectionWidth: 3,
    handleRadius: 6,
    handleFill: '#ffffff',
    handleStroke: '#000000',
  },
} as const

// ---------------------------------------------------------------------------
// Exports (lot 2, SPEC 9).

/** Default export preferences of reglages.json. Choice of the user (D-068, D-069). */
export const EXPORT_PREFS_DEFAULT = {
  gif: {
    orientation: 'portrait',
    lines: 'chained',
    speed: 'both',
    quality: 'standard',
    theme: 'highContrast',
    optimizeUnchanged: true,
  },
  pdf: { layout: 'print', color: 'color' },
} as const

/**
 * GIF sizes in pixels and frame rates (SPEC 9.2). HYPOTHÈSE: standard 540 px on the short side at
 * 12 frames per second; « haute qualité » 720 px at 15 frames per second.
 */
export const GIF_FORMATS = {
  standard: {
    portrait: { width: 540, height: 960 },
    landscape: { width: 960, height: 540 },
    square: { width: 720, height: 720 },
    fps: 12,
  },
  high: {
    portrait: { width: 720, height: 1280 },
    landscape: { width: 1280, height: 720 },
    square: { width: 960, height: 960 },
    fps: 15,
  },
} as const

/** Slow speed of GIFs (SPEC 9.2: ralenti 0,5x). */
export const GIF_SLOW_SPEED = 0.5

/** Durations in seconds of the GIF dressing (SPEC 9.2, D-059). */
export const GIF_DURATIONS = {
  // Title card: SPEC 9.2.
  titleCard: 1.5,
  // HYPOTHÈSE: option card « Option B : <condition> » (D-059).
  optionCard: 2,
  // HYPOTHÈSE: short card between the slow and the real speed passes (D-059).
  speedCard: 1,
  // Choice of the user: last image of each option held before the next card (D-059).
  optionEndHold: 1,
  // Final image held before the loop: SPEC 9.2.
  finalHold: 2,
} as const

/** HYPOTHÈSE: number of scene images sampled, with every card, to compute the GIF palette. */
export const GIF_PALETTE_SAMPLE_FRAMES = 12

/** HYPOTHÈSE: frame rate of the « version allégée » of a GIF above the weight warning (D-067). */
export const GIF_LIGHT_FPS = 8

/**
 * HYPOTHÈSE: weight above which a GIF triggers a warning and the offer of a lighter version
 * (SPEC 9.2: 8 Mo). Mo counted as 1024 x 1024 bytes, as Windows displays file sizes.
 */
export const GIF_WEIGHT_WARNING_BYTES = 8 * 1024 * 1024

/**
 * Legibility on a 6 inch phone (SPEC 9.2, D-061). HYPOTHÈSE: 19.5:9 screen, so 64 mm wide in
 * portrait and 138 mm along its long side (phone turned for landscape images); text at least
 * 2.5 mm high (body size).
 */
export const LEGIBILITY = {
  phoneWidthMm: 64,
  phoneLongSideMm: 138,
  minTextMm: 2.5,
} as const

/** PDF page layout in millimetres (SPEC 9.3, D-063, D-064). */
export const PDF_LAYOUT = {
  // A4 landscape (« Impression »).
  print: { width: 297, height: 210 },
  // HYPOTHÈSE: width of the « Téléphone » pages; their height follows the content.
  phoneWidth: 100,
  // HYPOTHÈSE: page margins.
  margin: 10,
  phoneMargin: 5,
  // HYPOTHÈSE: largest thumbnail width; SPEC 9.3 (HYPOTHÈSE): smallest legible width, 60 mm.
  thumbMax: 90,
  thumbMin: 60,
  // HYPOTHÈSE: gap between thumbnails.
  thumbGap: 6,
  // HYPOTHÈSE: bounds of the height / width ratio of the thumbnails (D-063).
  thumbRatio: { min: 0.45, max: 1 },
  // HYPOTHÈSE: largest phone page height before continuing on a new page (PDF limit 5 m).
  phoneMaxHeight: 5000,
} as const

/**
 * Text sizes of the PDF pages in points. HYPOTHÈSE: print sizes; phone sizes follow the
 * legibility rule (D-061) on a 100 mm page: 2.5 / 64 of the width, about 11 pt for the body.
 * Token numbers of the print thumbnails: just above 7 pt, as jsPDF floors font sizes (D-071).
 */
export const PDF_TEXT = {
  print: { title: 16, subtitle: 10, body: 9, rowTitle: 10, footer: 8, thumbTokenNumber: 7.05 },
  phone: { title: 18, subtitle: 12, body: 11.1, rowTitle: 12, footer: 9 },
} as const

/** HYPOTHÈSE: delay before a worker that does not acknowledge a cancellation is terminated. */
export const EXPORT_CANCEL_TIMEOUT_MS = 1000

/** HYPOTHÈSE: smallest interval between two progress messages of the export worker. */
export const EXPORT_PROGRESS_INTERVAL_MS = 50
