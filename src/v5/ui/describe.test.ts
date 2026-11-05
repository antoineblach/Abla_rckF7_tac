// Descriptions of the actions of a line (SPEC 5.8, 6.7, D-113, D-117). Rows of the list: `actionRows`,
// ported with the interface.
import { describe, expect, it } from 'vitest'
import { lineReport, type RunReport } from '../engine/actionReport'
import { createCaches } from '../engine/caches'
import type { CompiledGlue } from '../engine/timeline'
import { defaultSettings, engineSettingsOf } from '../../model/settings'
import type { Play } from '../model/types'
import {
  friseFixturePlay,
  P,
  pass,
  realisticRunsPlay,
  run,
  setPiecesPlay,
  sevenVsSevenWithOptions,
  uuid,
} from '../test/builders'
import {
  actionDetails,
  actionSummary,
  actionTitle,
  actorName,
  durationFactorsText,
  glueFactorsText,
  glueStatusText,
  glueTargetText,
  glueText,
  launchText,
  releaseModeText,
  releaseRealText,
  segmentLevel,
  segmentSourceText,
  segmentText,
  speedValueLabel,
  timeTicks,
} from './describe'

const settings = engineSettingsOf(defaultSettings())
const OPT_A = [P.root, P.optA]

const rowsOf = (play: Play, line: readonly string[] = OPT_A) =>
  lineReport(play, line, settings, createCaches()).rows

function rowOf(play: Play, id: string, line: readonly string[] = OPT_A) {
  const row = rowsOf(play, line).find((r) => r.actionId === id)
  if (!row) throw new Error(`no row ${id}`)
  return row
}

function runRow(play: Play, id: string, line: readonly string[] = OPT_A): RunReport {
  const row = rowOf(play, id, line)
  if (row.kind !== 'run') throw new Error(`not a run ${id}`)
  return row
}

describe('names and targets (SPEC 5.8)', () => {
  const play = sevenVsSevenWithOptions()

  it('names players and the events of a run, a pass, a kick, a breakdown', () => {
    expect(actorName(play, P.A(4))).toBe('A 4')
    expect(actorName(play, uuid(999))).toBe('?')
    const at = (targetId: string, event: 'start' | 'end' | { point: number }) =>
      glueTargetText(play, { targetId, event })
    expect(at(uuid(200), 'end')).toBe('fin de la course de A 4')
    expect(at(uuid(200), 'start')).toBe('départ de la course de A 4')
    expect(at(uuid(200), { point: 0 })).toBe('point 1 de la course de A 4')
    expect(at(uuid(202), 'end')).toBe('arrivée de la passe A 4 → A 5')
    expect(at(uuid(202), 'start')).toBe('lâcher de la passe A 4 → A 5')
    expect(at(uuid(999), 'end')).toBe('cible supprimée')
    const pieces = setPiecesPlay()
    const piece = (targetId: string, event: 'start' | 'end') =>
      glueTargetText(pieces, { targetId, event })
    expect(piece(uuid(402), 'start')).toBe('formation du ruck sur A 4')
    expect(piece(uuid(402), 'end')).toBe('sortie de balle du ruck sur A 4')
    expect(piece(uuid(420), 'start')).toBe('frappe du jeu au pied de A 2')
    expect(piece(uuid(420), 'end')).toBe('réception du jeu au pied de A 2')
  })

  it('names the sequences and the branch points', () => {
    const fixture = friseFixturePlay()
    expect(glueTargetText(fixture, { targetId: uuid(600), event: 'end' })).toBe(
      'fin de la séquence « Lancement »',
    )
    expect(glueTargetText(fixture, { targetId: uuid(600), event: 'start' })).toBe(
      'début de la séquence « Lancement »',
    )
    expect(glueTargetText(fixture, { targetId: P.root, event: 'end' })).toBe('embranchement')
  })
})

describe('glues (SPEC 5.8)', () => {
  const glue: CompiledGlue = {
    ownerId: uuid(1),
    kind: 'start',
    targetId: uuid(2),
    status: 'ok',
    targetT: 1,
    from: null,
    to: null,
  }

  it('says what a glue gives when it does not simply hold', () => {
    expect(glueStatusText(glue)).toBeNull()
    expect(glueStatusText({ ...glue, status: 'late' })).toBe('départ à la borne')
    expect(glueStatusText({ ...glue, status: 'beforeStart' })).toBe(
      'cible avant le départ, arrivée en retard',
    )
    expect(glueStatusText({ ...glue, status: 'unreached' })).toBe(
      'cible jamais atteinte, collage ignoré',
    )
  })

  it('names the target, its gap and its result', () => {
    const play = realisticRunsPlay()
    const onReceipt = rowOf(play, uuid(513))
    if (!onReceipt.startGlue) throw new Error('no glue')
    expect(glueText(play, onReceipt.startGlue)).toBe('arrivée de la passe A 5 → A 6 + 0,2 s')
    const run5 = rowOf(play, uuid(501))
    if (!run5.endGlue) throw new Error('no glue')
    expect(glueText(play, run5.endGlue)).toBe('fin de la course de A 4 (départ à la borne)')
    expect(glueText(play, { ...run5.endGlue, status: 'unreached' })).toBe(
      'fin de la course de A 4 (cible jamais atteinte, collage ignoré)',
    )
    expect(glueText(play, { ...run5.endGlue, status: 'ok' })).toBe('fin de la course de A 4')
    expect(glueText(play, { ...glue, ownerId: uuid(4242) })).toBe('cible supprimée')
  })
})

describe('runs (D-130, D-132, D-133)', () => {
  const play = sevenVsSevenWithOptions()
  /** A4 at (40, 35): 20 m at a jog. */
  const alone = (extra: Parameters<typeof run>[3]): Play => ({
    ...play,
    actions: [run(uuid(1), P.A(4), [{ x: 60, y: 35 }], extra)],
    sequences: [],
  })

  it('names a typed pace « vitesse saisie »', () => {
    expect(speedValueLabel('jog')).toBe('Trot')
    expect(speedValueLabel(4.5)).toBe('vitesse saisie')
    const report = runRow(alone({ pace: 4.5 }), uuid(1))
    if (!report.segments[0]) throw new Error('no segment')
    expect(report.pace).toBe(4.5)
    expect(segmentSourceText(report.segments[0], report)).toBe(
      'allure de la course (vitesse saisie)',
    )
  })

  it('gives the factors of an imposed duration and the accelerations of a segment', () => {
    const reportOf = (extra: Parameters<typeof run>[3]) => {
      const report = runRow(alone(extra), uuid(1))
      if (!report.segments[0]) throw new Error('no segment')
      return { report, segment: report.segments[0] }
    }
    const natural = reportOf({})
    expect(natural.report.factor).toBe(1)
    expect(durationFactorsText(natural.report)).toBeNull()
    expect(segmentLevel(natural.segment)).toBeNull()
    expect(segmentText(natural.segment, natural.report)).not.toMatch(/accélération|freinage/)

    // Far too short: both levers, beyond the red acceleration and braking thresholds.
    const forced = reportOf({ durationOverride: 1.5 })
    expect(forced.report.accelFactor).toBeGreaterThan(1)
    expect(durationFactorsText(forced.report)).toMatch(
      /^Durée imposée : vitesses × \d+,\d\d, accélérations × \d+,\d\d\.$/,
    )
    expect(forced.segment.accel?.level).toBe('danger')
    expect(segmentLevel(forced.segment)).toBe('danger')
    expect(segmentText(forced.segment, forced.report)).toMatch(
      /, accélération \d+,\d m\/s², freinage \d+,\d m\/s²$/,
    )
    expect(actionDetails(alone({ durationOverride: 1.5 }), forced.report)).toContain(
      durationFactorsText(forced.report),
    )

    // Longer than natural: one lever, slower speeds.
    const slow = reportOf({ durationOverride: 12 })
    expect(durationFactorsText(slow.report)).toMatch(/^Durée imposée : vitesses × 0,\d\d\.$/)
  })

  it('gives the factors of a right edge glued, not as an imposed duration', () => {
    const report = runRow(realisticRunsPlay(), uuid(512))
    expect(report.endGlue?.status).toBe('ok')
    expect(report.factor).not.toBe(1)
    expect(durationFactorsText(report)).toBeNull()
    expect(glueFactorsText(report)).toMatch(/^Vitesses × \d+,\d\d/)
    expect(glueFactorsText(runRow(alone({}), uuid(1)))).toBeNull()
  })

  it('says how a run ends and starts at speed (SPEC 5.2)', () => {
    const glued = realisticRunsPlay()
    const first = runRow(glued, uuid(500))
    expect(launchText(first)).toBe('Finit lancée')
    expect(launchText(runRow(glued, uuid(501)))).toBeNull()
    expect(launchText({ ...first, atSpeed: false })).toBe(
      'Finit lancée : arrêtée par le regroupement',
    )
    const details = actionDetails(glued, runRow(glued, uuid(510)))
    expect(details).toContain('Part lancée, dans le prolongement de la course précédente')
    expect(details).toContain('Départ collé à : fin de la course de A 4')
  })

  it('details a run: segments, speeds in km/h and m/s, glues, delay', () => {
    const glued = realisticRunsPlay()
    const row = runRow(glued, uuid(501))
    expect(actionTitle(glued, row)).toBe('Course A 5')
    expect(actionSummary(row)).toMatch(/^\d+,\d m, pointe \d+,\d m\/s \(\d+,\d km\/h\)$/)
    const details = actionDetails(glued, row)
    expect(details).toContain('Joueuse : A 5')
    expect(details.filter((d) => d.startsWith('Segment '))).toHaveLength(2)
    expect(details.find((d) => d.startsWith('Segment 1'))).toMatch(
      /^Segment 1 : allure de la course \(Trot\), /,
    )
    expect(details).toContain('Fin collée à : fin de la course de A 4 (départ à la borne)')

    const twice: Play = {
      ...play,
      actions: [
        run(uuid(1), P.A(4), [{ x: 60, y: 35 }]),
        run(uuid(2), P.A(4), [{ x: 70, y: 35 }], { start: 1 }),
      ],
      sequences: [],
    }
    const delayed = runRow(twice, uuid(2))
    expect(delayed.delay).toBeGreaterThan(0)
    expect(actionDetails(twice, delayed).find((d) => d.startsWith('Départ retardé'))).toMatch(
      /^Départ retardé de \d+,\d s$/,
    )
  })

  it('details a run that is not played', () => {
    const missing: Play = {
      ...play,
      actions: [run(uuid(1), uuid(4242), [{ x: 60, y: 35 }])],
      sequences: [],
    }
    const row = runRow(missing, uuid(1))
    expect(row.applied).toBe(false)
    expect(actionDetails(missing, row)).toContain('Course ignorée')
  })
})

describe('passes and kicks (D-110)', () => {
  it('details the release of a pass, at an instant or glued', () => {
    const play = realisticRunsPlay()
    const free = rowOf(play, uuid(504))
    if (free.kind !== 'pass') throw new Error('no pass')
    expect(releaseModeText(play, free)).toBe('à 0,8 s')
    expect(actionTitle(play, free)).toBe('Passe A 4 → A 5')
    expect(actionSummary(free)).toMatch(/^lâcher 0,8 s, \d+,\d m, vol \d+,\d s$/)
    expect(actionDetails(play, free)).toContain('Passeuse : A 4')
    const glued = rowOf(play, uuid(513))
    if (glued.kind !== 'pass') throw new Error('no pass')
    expect(releaseModeText(play, glued)).toBe('collé à arrivée de la passe A 5 → A 6 + 0,2 s')
    expect(actionDetails(play, glued)).toContain(
      'Lâcher : collé à arrivée de la passe A 5 → A 6 + 0,2 s',
    )
  })

  it('says when a release not glued waited for the reception', () => {
    const play = sevenVsSevenWithOptions()
    const row = rowOf(play, uuid(202))
    if (row.kind !== 'pass') throw new Error('no pass')
    expect(releaseRealText({ ...row, plannedT: row.start - 0.2 })).toMatch(
      /\(attend la réception\)$/,
    )
    expect(releaseRealText({ ...row, plannedT: row.start })).not.toMatch(/attend/)
    expect(
      releaseRealText({
        ...row,
        plannedT: row.start - 0.2,
        startGlue: {
          ownerId: uuid(202),
          kind: 'start',
          targetId: uuid(200),
          status: 'ok',
          targetT: row.start,
          from: null,
          to: null,
        },
      }),
    ).not.toMatch(/attend/)
  })

  it('details an ignored pass and the right edge of a pass', () => {
    const base = sevenVsSevenWithOptions()
    const ignored: Play = {
      ...base,
      actions: [pass(uuid(1), P.A(1), P.A(2), 0)],
      sequences: [],
    }
    const row = rowOf(ignored, uuid(1))
    expect(row.applied).toBe(false)
    expect(actionDetails(ignored, row)).toContain('Passe ignorée')
    const fixture = friseFixturePlay()
    const glued = rowOf(fixture, uuid(556), [P.root, P.optB, P.optB1])
    expect(actionDetails(fixture, glued)).toContain('Fin collée à : fin de la course de A 5')
  })

  it('details a kick to a point and to a receiver', () => {
    const pieces = setPiecesPlay()
    const toPoint = rowOf(pieces, uuid(420))
    expect(actionTitle(pieces, toPoint)).toBe('Pied A 2 → point')
    expect(actionDetails(pieces, toPoint)).toContain('Cible : point (75,0 ; 12,0)')
    const toPlayer = rowOf(pieces, uuid(440), [P.root, P.optB])
    expect(actionTitle(pieces, toPlayer)).toBe('Pied A 3 → B 7')
    expect(actionDetails(pieces, toPlayer)).toContain('Cible : B 7')
  })
})

describe('breakdowns and scale', () => {
  it('details a breakdown and its glued edges', () => {
    const pieces = setPiecesPlay()
    const row = rowOf(pieces, uuid(402))
    expect(actionTitle(pieces, row)).toBe('Ruck sur A 4')
    expect(actionSummary(row)).toMatch(/^formation \d+,\d s, sortie \d+,\d s$/)
    expect(actionDetails(pieces, row)).toContain('Plaquée : A 4')
    const fixture = friseFixturePlay()
    const maul = rowOf(fixture, uuid(552), [P.root, P.optB, P.optB2])
    const details = actionDetails(fixture, maul)
    expect(details).toContain('Formation collée à : arrivée de la passe A 6 → A 5')
    expect(details).toContain('Fin collée à : fin de la course de A 3')
  })

  it('graduates the time scale every 1, 2 or 5 s', () => {
    expect(timeTicks(3.5)).toEqual([0, 1, 2, 3])
    expect(timeTicks(14)).toEqual([0, 2, 4, 6, 8, 10, 12, 14])
    expect(timeTicks(26)).toEqual([0, 5, 10, 15, 20, 25])
  })
})
