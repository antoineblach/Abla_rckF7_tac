// French descriptions of the actions of a line, shared by the list of the actions and the inspector
// (SPEC 6.5, 6.7, D-113, D-117, D-145): actors, glues and their result, release, segment speeds.
// Pure formatting of model and engine data; speeds in m/s and km/h.
import type {
  ActionReport,
  KickReport,
  PassReport,
  RunReport,
  SegmentReport,
} from '../engine/actionReport'
import type { CompiledGlue, SpeedLevel } from '../engine/timeline'
import { findBranch } from '../model/branches'
import { BREAKDOWN_KIND_LABELS, sequenceLabelOf } from '../model/labels'
import { isPlayer, type GlueRef, type Id, type Play, type SpeedValue } from '../model/types'
import { decimal, formatAccel, formatMeters, formatSeconds, formatSpeed } from '../../ui/format'
import { PACE_LABELS } from './strings'

/** Below this, a start was not delayed. */
const DELAY_EPSILON = 1e-6

/** « A 4 »: team and number of a player, or « ? ». */
export function actorName(play: Play, id: Id): string {
  const player = play.entities.find((e) => e.id === id)
  return isPlayer(player) ? `${player.team} ${String(player.number)}` : '?'
}

/** « fin de la course de A 3 », « arrivée de la passe A 4 → A 5 »... (SPEC 5.8). */
export function glueTargetText(play: Play, glue: Pick<GlueRef, 'targetId' | 'event'>): string {
  const { targetId, event } = glue
  const starts = event === 'start'
  const name = (id: Id) => actorName(play, id)
  const action = play.actions.find((a) => a.id === targetId)
  if (action) {
    switch (action.type) {
      case 'run':
        if (typeof event !== 'string') {
          return `point ${String(event.point + 1)} de la course de ${name(action.entityId)}`
        }
        return `${starts ? 'départ' : 'fin'} de la course de ${name(action.entityId)}`
      case 'pass': {
        const what = `la passe ${name(action.fromId)} → ${name(action.toId)}`
        return starts ? `lâcher de ${what}` : `arrivée de ${what}`
      }
      case 'kick': {
        const what = `du jeu au pied de ${name(action.kickerId)}`
        return starts ? `frappe ${what}` : `réception ${what}`
      }
      case 'breakdown': {
        const what = `du ${BREAKDOWN_KIND_LABELS[action.kind].toLowerCase()} sur ${name(action.tackledId)}`
        return starts ? `formation ${what}` : `sortie de balle ${what}`
      }
      case 'groupRun':
        return 'action d’un lot ultérieur'
    }
  }
  if (play.sequences.some((s) => s.id === targetId)) {
    return `${starts ? 'début' : 'fin'} de la séquence « ${sequenceLabelOf(play, targetId)} »`
  }
  return findBranch(play, targetId) ? 'embranchement' : 'cible supprimée'
}

/** « vitesses × 1,25, accélérations × 1,60 »: factors of the levers (D-130). */
export function factorsText(factor: number, accelFactor: number): string {
  const accel = accelFactor > 1 ? `, accélérations × ${decimal(accelFactor, 2)}` : ''
  return `vitesses × ${decimal(factor, 2)}${accel}`
}

/** What a glue gives when it does not simply hold, null when it does (SPEC 5.8). */
export function glueStatusText(glue: CompiledGlue): string | null {
  switch (glue.status) {
    case 'ok':
      return null
    case 'late':
      return 'départ à la borne'
    case 'beforeStart':
      return 'cible avant le départ, arrivée en retard'
    case 'unreached':
      return 'cible jamais atteinte, collage ignoré'
  }
}

/** The stored glue of a compiled edge: the event and the gap are not compiled. */
function storedGlue(play: Play, glue: CompiledGlue): GlueRef | undefined {
  const owner = play.actions.find((a) => a.id === glue.ownerId)
  return glue.kind === 'start' ? owner?.startGlue : owner?.endGlue
}

/** « fin de la course de A 4 + 0,2 s » and the result: what an edge is glued to (SPEC 5.8). */
export function glueText(play: Play, glue: CompiledGlue): string {
  const stored = storedGlue(play, glue)
  if (!stored) return 'cible supprimée'
  const gap = stored.offset ? ` + ${formatSeconds(stored.offset)}` : ''
  const status = glueStatusText(glue)
  return `${glueTargetText(play, stored)}${gap}${status ? ` (${status})` : ''}`
}

/**
 * « Durée imposée : vitesses × 0,80. »: factors of an imposed duration (D-130), null when they are
 * 1 or when a glue gives them: a right edge that applies (SPEC 5.8).
 */
export function durationFactorsText(run: RunReport): string | null {
  const { endGlue } = run
  if (endGlue && endGlue.status !== 'unreached') return null
  if (Math.abs(run.factor - 1) < 5e-3 && run.accelFactor <= 1) return null
  return `Durée imposée : ${factorsText(run.factor, run.accelFactor)}.`
}

/** « Vitesses × 1,12. »: factors given by a right edge glued (solver of SPEC 5.3), null at 1. */
export function glueFactorsText(run: RunReport): string | null {
  const { endGlue } = run
  if (!endGlue || endGlue.status === 'unreached') return null
  if (Math.abs(run.factor - 1) < 5e-3 && run.accelFactor <= 1) return null
  const factors = factorsText(run.factor, run.accelFactor)
  return `${factors.charAt(0).toUpperCase()}${factors.slice(1)}.`
}

/** « Trot », or « vitesse saisie » for a speed in m/s (D-133). */
export function speedValueLabel(value: SpeedValue): string {
  return typeof value === 'number' ? 'vitesse saisie' : PACE_LABELS[value]
}

/** « Trot », « Sprint », « allure de la course (Trot) », « saisie ». */
export function segmentSourceText(segment: SegmentReport, run: RunReport): string {
  if (segment.source === 'run') return `allure de la course (${speedValueLabel(run.pace)})`
  if (segment.source === 'custom') return 'vitesse saisie'
  return PACE_LABELS[segment.source]
}

/**
 * « Segment 2 : Sprint, 5,5 m/s (19,8 km/h), pointe 5,1 m/s (18,4 km/h) », then the peak
 * acceleration and braking beyond a threshold (D-132): « , accélération 6,4 m/s² ».
 */
export function segmentText(segment: SegmentReport, run: RunReport): string {
  const accel = segment.accel ? `, accélération ${formatAccel(segment.accel.peak)}` : ''
  const brake = segment.brake ? `, freinage ${formatAccel(segment.brake.peak)}` : ''
  return `Segment ${String(segment.index + 1)} : ${segmentSourceText(segment, run)}, ${formatSpeed(segment.target)}, pointe ${formatSpeed(segment.peak)}${accel}${brake}`
}

/** Most severe level of a segment: speed, acceleration or braking (D-132). */
export function segmentLevel(segment: SegmentReport): SpeedLevel | null {
  const levels = [segment.level, segment.accel?.level, segment.brake?.level]
  if (levels.includes('danger')) return 'danger'
  return levels.includes('warning') ? 'warning' : null
}

/** « Finit lancée »: the next run of the player is glued to its end, without gap (SPEC 5.2). */
export function launchText(run: RunReport): string | null {
  if (!run.endsAtSpeed) return null
  return run.atSpeed ? 'Finit lancée' : 'Finit lancée : arrêtée par le regroupement'
}

/** « collé à l’arrivée de la passe A 4 → A 5 + 0,2 s », « à 1,2 s ». */
export function releaseModeText(play: Play, report: PassReport | KickReport): string {
  if (report.startGlue) return `collé à ${glueText(play, report.startGlue)}`
  return `à ${formatSeconds(report.plannedT)}`
}

/** Real release instant, with the tolerance of a release not glued when it waited (D-110). */
export function releaseRealText(report: PassReport | KickReport): string {
  const real = `Lâcher réel : ${formatSeconds(report.start)}`
  const waited = report.startGlue === null && report.start > report.plannedT + DELAY_EPSILON
  return waited ? `${real} (attend la réception)` : real
}

/** Title of a row of the list: type and actors. */
export function actionTitle(play: Play, row: ActionReport): string {
  const name = (id: Id) => actorName(play, id)
  switch (row.kind) {
    case 'run':
      return `Course ${name(row.entityId)}`
    case 'pass':
      return `Passe ${name(row.fromId)} → ${name(row.toId)}`
    case 'kick':
      return `Pied ${name(row.kickerId)} → ${row.receiverId === null ? 'point' : name(row.receiverId)}`
    case 'breakdown':
      return `${BREAKDOWN_KIND_LABELS[row.breakdownKind]} sur ${name(row.tackledId)}`
  }
}

/** Main details of a row, on one line. */
export function actionSummary(row: ActionReport): string {
  switch (row.kind) {
    case 'run':
      return `${formatMeters(row.length)}, pointe ${formatSpeed(row.peakSpeed)}`
    case 'pass':
    case 'kick':
      return `lâcher ${formatSeconds(row.start)}, ${formatMeters(row.distance)}, vol ${formatSeconds(row.flight)}`
    case 'breakdown':
      return `formation ${formatSeconds(row.start)}, sortie ${formatSeconds(row.end)}`
  }
}

/** The glued right edge of a block, on one line. */
function endGlueLines(play: Play, row: ActionReport): string[] {
  return row.endGlue ? [`Fin collée à : ${glueText(play, row.endGlue)}`] : []
}

/** Every detail of a row (tooltip), one line each (SPEC 6.7). */
export function actionDetails(play: Play, row: ActionReport): string[] {
  const name = (id: Id) => actorName(play, id)
  const span = `${formatSeconds(row.start)} → ${formatSeconds(row.end)}`
  switch (row.kind) {
    case 'run': {
      const lines = [
        `Joueuse : ${name(row.entityId)}`,
        `Longueur : ${formatMeters(row.length)}`,
        `Départ et arrivée : ${span}`,
        `Durée : ${formatSeconds(row.duration)}`,
        `Vitesse moyenne : ${formatSpeed(row.meanSpeed)}`,
        `Vitesse de pointe : ${formatSpeed(row.peakSpeed)}`,
        ...row.segments.map((segment) => segmentText(segment, row)),
      ]
      const factors = durationFactorsText(row) ?? glueFactorsText(row)
      if (factors) lines.push(factors)
      if (row.delay > DELAY_EPSILON) lines.push(`Départ retardé de ${formatSeconds(row.delay)}`)
      if (row.startGlue) lines.push(`Départ collé à : ${glueText(play, row.startGlue)}`)
      lines.push(...endGlueLines(play, row))
      const launch = launchText(row)
      if (launch) lines.push(launch)
      if (row.prolongs) lines.push('Part lancée, dans le prolongement de la course précédente')
      if (row.cutAt !== null)
        lines.push(`Arrêtée par le regroupement à ${formatSeconds(row.cutAt)}`)
      if (!row.applied) lines.push('Course ignorée')
      return lines
    }
    case 'pass':
      return [
        `Passeuse : ${name(row.fromId)}`,
        `Receveuse : ${name(row.toId)}`,
        `Lâcher : ${releaseModeText(play, row)}`,
        releaseRealText(row),
        `Arrivée : ${formatSeconds(row.end)}`,
        ...endGlueLines(play, row),
        `Distance : ${formatMeters(row.distance)}`,
        `Temps de vol : ${formatSeconds(row.flight)}`,
        ...(row.forward ? ['En-avant probable'] : []),
        ...(row.applied ? [] : ['Passe ignorée']),
      ]
    case 'kick':
      return [
        `Frappeuse : ${name(row.kickerId)}`,
        `Cible : ${
          row.receiverId === null
            ? `point (${decimal(row.point?.x ?? 0)} ; ${decimal(row.point?.y ?? 0)})`
            : name(row.receiverId)
        }`,
        `Lâcher : ${releaseModeText(play, row)}`,
        releaseRealText(row),
        ...endGlueLines(play, row),
        `Distance : ${formatMeters(row.distance)}`,
        `Temps de vol : ${formatSeconds(row.flight)}`,
        ...(row.applied ? [] : ['Jeu au pied ignoré']),
      ]
    case 'breakdown':
      return [
        `Type : ${BREAKDOWN_KIND_LABELS[row.breakdownKind]}`,
        `Plaquée : ${name(row.tackledId)}`,
        `Formation : ${formatSeconds(row.start)}`,
        ...(row.startGlue ? [`Formation collée à : ${glueText(play, row.startGlue)}`] : []),
        `Sortie de balle : ${formatSeconds(row.end)}`,
        ...endGlueLines(play, row),
        ...(row.applied ? [] : ['Regroupement ignoré']),
      ]
  }
}

/** Graduations of the time scale, in seconds: every 1, 2 or 5 s depending on the duration. */
export function timeTicks(duration: number): number[] {
  const step = duration <= 10 ? 1 : duration <= 20 ? 2 : 5
  const ticks: number[] = []
  for (let t = 0; t <= duration + 1e-9; t += step) ticks.push(t)
  return ticks
}
