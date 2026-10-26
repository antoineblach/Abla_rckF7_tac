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

/**
 * Paces in m/s (SPEC 5.3), peak speeds of the speed profile. HYPOTHÈSE: walk 2, jog 4,
 * sprint 5.5 (19.8 km/h, below the orange threshold; 7 before lot 3 bis, D-111), adjustable in
 * reglages.json.
 */
export const PACE_DEFAULTS = {
  walk: 2,
  jog: 4,
  sprint: 5.5,
} as const

/** Default sprint pace of lots 1 to 3, replaced by the new default when reglages.json moves to
 * version 3 (D-111). */
export const LEGACY_SPRINT_PACE = 7

/**
 * Speed profile of the runs of an amateur player (SPEC 5.3, D-105, D-135), adjustable in
 * reglages.json: acceleration a(v) = accel · (1 − v / topSpeed) from rest, braking and lateral
 * acceleration in turns in m/s², top speed in m/s. Sources and figures: plan of lot 3bis-1, B.1.
 */
export const MOTION_DEFAULTS = {
  // SOURCE: https://www.frontiersin.org/articles/10.3389/fspor.2023.1120162/full (France women's
  // sevens, 10, 20 and 50 m, times + 0.5 s after Haugen: elite 6.2 m/s², tau 1.28 s).
  // HYPOTHÈSE: amateur player, same tau as the elite: 6.67 / 1.28 = 5.2 m/s².
  accel: 5.2,
  // SOURCE: https://pmc.ncbi.nlm.nih.gov/articles/PMC11246955/ (mean maximal braking 4.0 to 4.5).
  decel: 4,
  // HYPOTHÈSE, no source found: radius 5 m at 4.5 m/s (16 km/h).
  lateralAccel: 4,
  // HYPOTHÈSE: 24 km/h, 0.84 times the elite (28.6 km/h), below the red threshold (D-111).
  topSpeed: 24 / 3.6,
} as const

/** Default speed profile of lot 3 bis (reglages.json version 3), replaced by the calibrated one
 * when reglages.json moves to version 4 (D-134). */
export const LEGACY_MOTION = {
  accel: 3,
  decel: 4,
  lateralAccel: 4,
} as const

/**
 * HYPOTHÈSE (D-135, Q13): a segment whose target speed exceeds this fraction of the top speed
 * accelerates towards target / ratio instead of the top speed, so that its target is reached.
 */
export const TOP_SPEED_TARGET_RATIO = 0.95

/** Newton iterations for the speed at the end of an accelerating interval (D-135). */
export const PROFILE_NEWTON_ITERATIONS = 5

/** HYPOTHÈSE: lowest speed of a run in a tight turn, in m/s (SPEC 5.3, D-105). */
export const MIN_CORNER_SPEED = 1

/**
 * HYPOTHÈSE, choice of the coach: thresholds on the peak speed of a run segment, in m/s
 * (SPEC 5.9, D-111): orange beyond 20 km/h, red beyond 25 km/h. Adjustable in reglages.json.
 */
export const SPEED_ALERT_DEFAULTS = {
  warning: 20 / 3.6,
  danger: 25 / 3.6,
} as const

/**
 * HYPOTHÈSE: thresholds on the peak acceleration of a run segment, in m/s² (D-132, D-135):
 * orange at the level of the elite (6.2), red beyond the top of its range (7.8). Adjustable in
 * reglages.json.
 */
export const ACCEL_ALERT_DEFAULTS = {
  warning: 6,
  danger: 8,
} as const

/**
 * HYPOTHÈSE: thresholds on the peak braking of a run segment, in m/s² (D-132, D-135): orange
 * above the mean maximal braking (4.0 to 4.5), red at the measured peak (6.6 to 7.4).
 * SOURCE: https://pmc.ncbi.nlm.nih.gov/articles/PMC11246955/
 */
export const DECEL_ALERT_DEFAULTS = {
  warning: 5,
  danger: 7,
} as const

/**
 * Speed factor solver (SPEC 5.3): bisection on the logarithm of the factor, with a fixed number
 * of iterations (determinism), between `minFactor` and the cap of the red threshold.
 */
export const SPEED_FACTOR_SEARCH = {
  iterations: 50,
  minFactor: 1e-3,
} as const

/**
 * HYPOTHÈSE: a pass or a kick released at a fixed instant waits for a reception arriving at most
 * this late, in seconds (SPEC 5.4, D-110).
 */
export const PASS_RECEIPT_TOLERANCE = 0.5

/** Pass speed in m/s (SPEC 5.4). HYPOTHÈSE, adjustable in reglages.json. */
export const PASS_SPEED_DEFAULT = 12

/** Fixed-point iterations to solve a pass arrival (SPEC 5.4 asks for 3 to 5). */
export const PASS_FIXED_POINT_ITERATIONS = 5

/** Minimum arc-length samples per spline segment (SPEC 5.3). */
export const ARC_LENGTH_SAMPLES_PER_SEGMENT = 64

// ---------------------------------------------------------------------------
// Set pieces (lot 3, SPEC 5.7, 10).

/**
 * HYPOTHÈSE: forward component, in m/s, of the ball speed relative to the passer above which a
 * pass is flagged « en avant probable » (SPEC 5.7, 14).
 */
export const FORWARD_PASS_THRESHOLD = 0.5

/** Default duration of a ruck or a maul, in seconds. Established, given by the user (SPEC 10.3). */
export const BREAKDOWN_DURATION_DEFAULT = 3

/** HYPOTHÈSE: relay position, in metres behind the ball on the side of its team (SPEC 10.3). */
export const RELAY_OFFSET = 1

/** HYPOTHÈSE: default kick flight times in seconds (SPEC 10.4): restart 3.0, long 3.5. */
export const KICK_FLIGHT_TIME = {
  restart: 3,
  long: 3.5,
} as const

/** HYPOTHÈSE: size factor of the ball at the apex of a kick (SPEC 10.4). */
export const KICK_APEX_SCALE = 1.8

/** HYPOTHÈSE: distance in metres under which a player picks up a loose ball (SPEC 10.4). */
export const LOOSE_BALL_PICKUP_DISTANCE = 1

/**
 * Search of the pickup of a loose ball (D-094): fixed time step in seconds, then bisection.
 * HYPOTHÈSE: 1/100 s; at 7 m/s a player moves 7 cm per step, far less than the 2 m diameter of
 * the pickup disc.
 */
export const PICKUP_SEARCH = {
  step: 0.01,
  bisections: 20,
} as const

/** Anchors of placement presets (SPEC 10.1, D-088). */
export const PRESET_ANCHOR = {
  // SOURCE: https://passport.world.rugby/laws-of-the-game/laws-by-number/18-touch-quick-throw-and-lineout/
  // (the mark of touch is not less than 5 m from the goal line)
  lineoutMinFromGoal: 5,
  // HYPOTHÈSE: distance under which a restart anchor snaps to the centre of the halfway line or
  // to a 22 m line (D-088).
  restartCapture: 3,
} as const

/** HYPOTHÈSE: recommended maximum length of an instruction, GIF legibility on a phone (SPEC 6.4). */
export const INSTRUCTION_RECOMMENDED_LENGTH = 60

/** HYPOTHÈSE: margin of the automatic framing, in metres (SPEC 7). */
export const AUTO_FRAME_MARGIN = 5

/** HYPOTHÈSE: automatic save delay after the last change, in seconds (SPEC 8.3). */
export const AUTOSAVE_DELAY_SECONDS = 2

/** HYPOTHÈSE: folder rescan period while the window is visible, in seconds (SPEC 8.3). */
export const FOLDER_RESCAN_PERIOD_SECONDS = 30

/**
 * HYPOTHÈSE: versions written by the page remembered per play and per preset (D-098), at least
 * 100 s of continuous editing with one save every 2 s.
 */
export const OWN_WRITES_KEPT = 50

/** Events kept by the synchronisation log, chosen by the user (D-100). */
export const SYNC_LOG_SIZE = 200

/** Undo levels (SPEC 6.3). */
export const UNDO_LEVELS = 100

/** HYPOTHÈSE: longest press of the space bar counted as a tap (play or pause), in ms (D-116). */
export const SPACE_TAP_MAX_MS = 500

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
 * stroke at least 3 px at scale 1 (SPEC 13.2). The two print themes are export themes only
 * (D-062). A `null` colour stands for the colour of the player.
 * Lot 3 (D-084): kicks in long dashes (`kickDash`), ground shadow of a kicked ball offset towards
 * the bottom right by up to `kickShadowOffset` at the apex, ring and label of a ruck or a maul,
 * badge of a forward pass (editor and player only, never exported, D-086).
 * Lot 3 bis: segments at the sprint pace or faster drawn `fastRunWidth` wide (D-115); orange and
 * red badges of the speed thresholds (editor and player only, never exported, D-112).
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
    passColor: '#ffffff',
    runColor: null,
    tokenFillA: null,
    tokenFillB: null,
    badgeBackground: '#ffe36e',
    badgeText: '#000000',
    kickWidth: 2.5,
    kickDash: [12, 7],
    kickShadow: '#1f4426',
    kickShadowOffset: 9,
    breakdownColor: '#ffe36e',
    breakdownWidth: 2,
    forwardFill: '#ffe36e',
    forwardText: '#000000',
    fastRunWidth: 4.5,
    speedWarningFill: '#ff9f1c',
    speedWarningText: '#000000',
    speedDangerFill: '#d7191c',
    speedDangerText: '#ffffff',
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
    passColor: '#ffffff',
    runColor: null,
    tokenFillA: null,
    tokenFillB: null,
    badgeBackground: '#ffeb3b',
    badgeText: '#000000',
    kickWidth: 4,
    kickDash: [14, 8],
    kickShadow: '#00230a',
    kickShadowOffset: 11,
    breakdownColor: '#ffeb3b',
    breakdownWidth: 3,
    forwardFill: '#ffeb3b',
    forwardText: '#000000',
    fastRunWidth: 6.5,
    speedWarningFill: '#ff9100',
    speedWarningText: '#000000',
    speedDangerFill: '#ff1744',
    speedDangerText: '#ffffff',
  },
  // « Impression couleur » (D-062): white background, grey field lines, team colours kept.
  printColor: {
    background: '#ffffff',
    grass: '#ffffff',
    inGoal: '#eef3ee',
    fieldLine: '#9e9e9e',
    fieldLineWidth: 2,
    postRadius: 3.5,
    tokenRadius: 13,
    tokenStroke: '#000000',
    tokenStrokeWidth: 2,
    font: '"Atkinson Hyperlegible", sans-serif',
    tokenFontSize: 14,
    runWidth: 3,
    passWidth: 3,
    passDash: [0.1, 6],
    arrowSize: 11,
    fadeTowardsGrass: 0.6,
    ghost: '#c4c4c4',
    ghostWidth: 2,
    error: '#d7191c',
    ballFill: '#ffffff',
    ballStroke: '#000000',
    ballStrokeWidth: 2,
    ballLength: 13,
    ballWidth: 9,
    gainLine: '#555555',
    gainLineWidth: 1.5,
    gainLineDash: [6, 5],
    gainArrowSize: 9,
    bannerBackground: '#000000',
    bannerText: '#ffffff',
    bannerFontSize: 17,
    bannerPadding: 9,
    selection: '#000000',
    selectionWidth: 3,
    handleRadius: 6,
    handleFill: '#ffffff',
    handleStroke: '#000000',
    passColor: '#000000',
    runColor: null,
    tokenFillA: null,
    tokenFillB: null,
    badgeBackground: '#ffffff',
    badgeText: '#000000',
    kickWidth: 3,
    kickDash: [12, 7],
    kickShadow: '#bdbdbd',
    kickShadowOffset: 10,
    breakdownColor: '#000000',
    breakdownWidth: 2,
    forwardFill: '#ffe36e',
    forwardText: '#000000',
    fastRunWidth: 5,
    speedWarningFill: '#ff9f1c',
    speedWarningText: '#000000',
    speedDangerFill: '#d7191c',
    speedDangerText: '#ffffff',
  },
  // « Impression N&B » (SPEC 9.3, D-062): greys only; team A filled black, team B hollow
  // whatever the player colour; black solid runs, dotted passes, previous phases light grey;
  // white field with mid grey lines, very light grey in-goals, thin black dashed gain line.
  printBw: {
    background: '#ffffff',
    grass: '#ffffff',
    inGoal: '#efefef',
    fieldLine: '#8c8c8c',
    fieldLineWidth: 2,
    postRadius: 3.5,
    tokenRadius: 13,
    tokenStroke: '#000000',
    tokenStrokeWidth: 2,
    font: '"Atkinson Hyperlegible", sans-serif',
    tokenFontSize: 14,
    runWidth: 3,
    passWidth: 3,
    passDash: [0.1, 6],
    arrowSize: 11,
    fadeTowardsGrass: 0.7,
    ghost: '#c8c8c8',
    ghostWidth: 2,
    error: '#6e6e6e',
    ballFill: '#ffffff',
    ballStroke: '#000000',
    ballStrokeWidth: 2,
    ballLength: 13,
    ballWidth: 9,
    gainLine: '#000000',
    gainLineWidth: 1.5,
    gainLineDash: [6, 5],
    gainArrowSize: 9,
    bannerBackground: '#000000',
    bannerText: '#ffffff',
    bannerFontSize: 17,
    bannerPadding: 9,
    selection: '#000000',
    selectionWidth: 3,
    handleRadius: 6,
    handleFill: '#ffffff',
    handleStroke: '#000000',
    passColor: '#000000',
    runColor: '#000000',
    tokenFillA: '#000000',
    tokenFillB: '#ffffff',
    badgeBackground: '#ffffff',
    badgeText: '#000000',
    kickWidth: 3,
    kickDash: [12, 7],
    kickShadow: '#bdbdbd',
    kickShadowOffset: 10,
    breakdownColor: '#000000',
    breakdownWidth: 2,
    forwardFill: '#000000',
    forwardText: '#ffffff',
    fastRunWidth: 5,
    speedWarningFill: '#ffffff',
    speedWarningText: '#000000',
    speedDangerFill: '#000000',
    speedDangerText: '#ffffff',
  },
} as const

/**
 * HYPOTHÈSE: sizes of the export dressing (cards, header, badge; D-060), in CSS pixels at scale 1,
 * scaled like the theme sizes.
 */
export const CAPTION_SIZES = {
  headerHeight: 30,
  headerFontSize: 17,
  badgeFontSize: 14,
  badgeHeight: 21,
  badgePaddingX: 7,
  sideMargin: 10,
  cardTitleFontSize: 26,
  cardSubtitleFontSize: 18,
  cardMaxLines: 4,
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
  // HYPOTHÈSE: lines of an instruction under a thumbnail (ellipsis beyond).
  instructionMaxLines: 3,
} as const

/**
 * Text sizes of the PDF pages in points. HYPOTHÈSE: print sizes. Phone sizes follow the
 * legibility rule (D-061): a 100 mm page read across 64 mm needs 2.5 × 100 / 64 = 3.9 mm, that is
 * 11.1 pt at least. Token numbers of the thumbnails are just above an integer number of points,
 * as the jsPDF context floors font sizes (D-071): 7 pt in print, 12 pt on the phone.
 */
export const PDF_TEXT = {
  print: {
    title: 16,
    subtitle: 10,
    body: 9,
    rowTitle: 10,
    footer: 8,
    thumbTokenNumber: 7.05,
    bookTitle: 28,
    bookSubtitle: 14,
  },
  phone: {
    title: 18,
    subtitle: 13,
    body: 11.5,
    rowTitle: 13,
    footer: 11.5,
    thumbTokenNumber: 12.05,
    bookTitle: 22,
    bookSubtitle: 14,
  },
} as const

/** HYPOTHÈSE: delay before a worker that does not acknowledge a cancellation is terminated. */
export const EXPORT_CANCEL_TIMEOUT_MS = 1000

/** HYPOTHÈSE: smallest interval between two progress messages of the export worker. */
export const EXPORT_PROGRESS_INTERVAL_MS = 50
