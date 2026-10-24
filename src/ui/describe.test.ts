// Descriptions and rows of the list of the actions (SPEC 6.7, D-113, D-117).
import { describe, expect, it } from 'vitest'
import { phaseReport } from '../engine/actionReport'
import { createCaches } from '../engine/caches'
import type { RunSyncResult } from '../engine/timeline'
import { setRunSync, updatePass } from '../editor/commands'
import { defaultSettings, engineSettingsOf } from '../model/settings'
import type { Play } from '../model/types'
import { P, run, setPiecesPlay, sevenVsSevenWithOptions, uuid } from '../test/builders'
import {
  actionDetails,
  actorName,
  releaseRealText,
  rendezVousText,
  syncResultText,
  syncTargetText,
  timeTicks,
} from './describe'
import { actionRows, barGeometry } from './phases/actionRows'

const settings = engineSettingsOf(defaultSettings())

function rowsOf(play: Play, phaseId = P.t1) {
  const report = phaseReport(play, phaseId, settings, createCaches())
  if (!report) throw new Error('no report')
  return actionRows(play, report, [])
}

describe('descriptions (D-108, D-110)', () => {
  const play = sevenVsSevenWithOptions()

  it('names players and the targets of the links', () => {
    expect(actorName(play, P.A(4))).toBe('A 4')
    expect(actorName(play, uuid(999))).toBe('?')
    expect(syncTargetText(play, { actionId: uuid(200), event: 'runEnd' })).toBe(
      'fin de la course de A 4',
    )
    expect(syncTargetText(play, { actionId: uuid(200), event: 'runPoint', index: 0 })).toBe(
      'point 1 de la course de A 4',
    )
    expect(syncTargetText(play, { actionId: uuid(202), event: 'arrival' })).toBe(
      'arrivée de la passe A 4 → A 5',
    )
    expect(syncTargetText(play, { actionId: uuid(202), event: 'release' })).toBe(
      'lâcher de la passe A 4 → A 5',
    )
    expect(syncTargetText(play, { actionId: uuid(999), event: 'runEnd' })).toBe('action supprimée')
    const pieces = setPiecesPlay()
    const ruck = pieces.phases[0]?.actions.find((a) => a.type === 'breakdown')
    const kick = pieces.phases.flatMap((p) => p.actions).find((a) => a.type === 'kick')
    if (!ruck || !kick) throw new Error('no set pieces')
    expect(syncTargetText(pieces, { actionId: ruck.id, event: 'formation' })).toBe(
      'formation du ruck sur A 4',
    )
    expect(syncTargetText(pieces, { actionId: kick.id, event: 'arrival' })).toMatch(
      /^réception du jeu au pied de A \d$/,
    )
  })

  it('gives the rendez-vous point and the result of a link', () => {
    expect(rendezVousText({ target: { actionId: 'x', event: 'runEnd' }, adjust: 'delay' })).toBe(
      'Fin',
    )
    expect(
      rendezVousText({ target: { actionId: 'x', event: 'runEnd' }, adjust: 'delay', at: 1 }),
    ).toBe('Point 2')
    const base: RunSyncResult = {
      adjust: 'delay',
      delay: 0.84,
      factor: 1,
      status: 'ok',
      targetT: 3,
      meetPoint: { x: 0, y: 0 },
      targetPoint: { x: 1, y: 1 },
    }
    expect(syncResultText(base)).toBe('Délai calculé : 0,8 s.')
    expect(syncResultText({ ...base, status: 'late' })).toBe('Départ immédiat : arrivée en retard.')
    expect(syncResultText({ ...base, adjust: 'speed', factor: 1.123 })).toBe('Vitesses × 1,12.')
    expect(syncResultText({ ...base, adjust: 'speed', factor: 1.5, status: 'capped' })).toBe(
      'Vitesses × 1,50, plafonnées au seuil rouge.',
    )
    expect(syncResultText({ ...base, status: 'unreached' })).toBe(
      'Cible jamais atteinte : lien ignoré.',
    )
    expect(syncResultText(null)).toBe('Lien ignoré.')
  })

  it('graduates the time scale every 1, 2 or 5 s', () => {
    expect(timeTicks(3.5)).toEqual([0, 1, 2, 3])
    expect(timeTicks(14)).toEqual([0, 2, 4, 6, 8, 10, 12, 14])
    expect(timeTicks(26)).toEqual([0, 5, 10, 15, 20, 25])
  })
})

describe('rows of the list (SPEC 6.7)', () => {
  it('sorts by start, names type and actors, keeps the bars inside the phase', () => {
    const { rows, duration } = rowsOf(sevenVsSevenWithOptions())
    expect(rows.map((r) => r.title)).toEqual(['Course A 4', 'Course A 5', 'Passe A 4 → A 5'])
    expect(rows.map((r) => r.start)).toEqual([...rows.map((r) => r.start)].sort((a, b) => a - b))
    for (const row of rows) {
      const bar = barGeometry(row, duration)
      expect(bar.left).toBeGreaterThanOrEqual(0)
      expect(bar.left + bar.width).toBeLessThanOrEqual(1 + 1e-9)
    }
    expect(barGeometry({ start: 1, end: 2 }, 0)).toEqual({ left: 0, width: 0 })
  })

  it('details a run: segments, speeds in km/h and m/s, link and « Finit lancée »', () => {
    const linked = setRunSync(sevenVsSevenWithOptions(), uuid(201), {
      target: { actionId: uuid(200), event: 'runEnd' },
      adjust: 'delay',
    }).play
    const row = rowsOf(linked).rows.find((r) => r.actionId === uuid(201))
    if (!row) throw new Error('no row')
    expect(row.summary).toMatch(/^\d+,\d m, pointe \d+,\d m\/s \(\d+,\d km\/h\)$/)
    expect(row.details).toContain('Joueuse : A 5')
    expect(row.details.filter((d) => d.startsWith('Segment '))).toHaveLength(2)
    expect(row.details.find((d) => d.startsWith('Segment 1'))).toMatch(
      /^Segment 1 : allure de la course \(Sprint\), 5,5 m\/s \(19,8 km\/h\), pointe /,
    )
    expect(row.details.find((d) => d.startsWith('Calée sur'))).toMatch(
      /^Calée sur : fin de la course de A 4 \(Fin\) ; /,
    )
  })

  it('marks an ignored action and details the release of a pass', () => {
    const base = sevenVsSevenWithOptions()
    const twice: Play = {
      ...base,
      phases: base.phases.map((p) =>
        p.id === P.t1
          ? { ...p, actions: [...p.actions, run(uuid(209), P.A(4), [{ x: 50, y: 30 }])] }
          : p,
      ),
    }
    const { rows } = rowsOf(twice)
    expect(rows.find((r) => r.actionId === uuid(209))?.ignored).toBe(true)
    expect(rows.find((r) => r.actionId === uuid(200))?.ignored).toBe(false)
    const pass = rows.find((r) => r.kind === 'pass')
    expect(pass?.details).toContain('Lâcher : à un instant fixe (0,8 s)')
    const onReceipt = rowsOf(updatePass(base, uuid(202), { release: 'onReceipt', delay: 0.3 }))
    const later = onReceipt.rows.find((r) => r.kind === 'pass')
    expect(later?.details).toContain('Lâcher : à la réception (+ 0,3 s)')
  })

  it('says when a fixed release waited for the reception (D-110)', () => {
    const report = phaseReport(sevenVsSevenWithOptions(), P.t1, settings, createCaches())
    const pass = report?.rows.find((r) => r.kind === 'pass')
    if (pass?.kind !== 'pass') throw new Error('no pass')
    expect(releaseRealText({ ...pass, plannedT: pass.start - 0.2 })).toMatch(
      /\(attend la réception\)$/,
    )
    expect(releaseRealText({ ...pass, plannedT: pass.start })).not.toMatch(/attend/)
    expect(actionDetails(sevenVsSevenWithOptions(), pass, null, 0.8)).toContain('Passeuse : A 4')
  })
})
