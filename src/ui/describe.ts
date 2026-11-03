// French descriptions of the actions of a phase, shared by the list of the actions and the
// inspector (SPEC 6.5, 6.7, D-113, D-117): actors, link target and result, release, segment
// speeds. Pure formatting of model and engine data; speeds in m/s and km/h.
import type {
  ActionReport,
  KickReport,
  PassReport,
  RunReport,
  SegmentReport,
} from '../engine/actionReport'
import type { RunSyncResult, SpeedLevel } from '../engine/timeline'
import { BREAKDOWN_KIND_LABELS } from '../model/labels'
import {
  isPlayer,
  type Id,
  type Play,
  type RunSync,
  type SpeedValue,
  type SyncTarget,
} from '../model/types'
import { decimal, formatAccel, formatMeters, formatSeconds, formatSpeed } from './format'
import { PACE_LABELS } from './strings'

/** « A 4 »: team and number of a player, or « ? ». */
export function actorName(play: Play, id: Id): string {
  const player = play.entities.find((e) => e.id === id)
  return isPlayer(player) ? `${player.team} ${String(player.number)}` : '?'
}

function findAction(play: Play, id: Id) {
  for (const phase of play.phases) {
    const action = phase.actions.find((a) => a.id === id)
    if (action) return action
  }
  return undefined
}

/** « fin de la course de A 3 », « arrivée de la passe A 4 → A 5 »... (D-108). */
export function syncTargetText(play: Play, target: SyncTarget): string {
  const action = findAction(play, target.actionId)
  if (!action) return 'action supprimée'
  const name = (id: Id) => actorName(play, id)
  switch (action.type) {
    case 'run':
      if (target.event === 'runPoint') {
        return `point ${String(target.index + 1)} de la course de ${name(action.entityId)}`
      }
      return `fin de la course de ${name(action.entityId)}`
    case 'pass': {
      const what = `la passe ${name(action.fromId)} → ${name(action.toId)}`
      return target.event === 'release' ? `lâcher de ${what}` : `arrivée de ${what}`
    }
    case 'kick': {
      const what = `du jeu au pied de ${name(action.kickerId)}`
      return target.event === 'release' ? `frappe ${what}` : `réception ${what}`
    }
    case 'breakdown':
      return `formation du ${BREAKDOWN_KIND_LABELS[action.kind].toLowerCase()} sur ${name(action.tackledId)}`
    case 'groupRun':
      return 'action d’un lot ultérieur'
  }
}

/** « Fin », « Point 2 »: rendez-vous point of a link. */
export function rendezVousText(sync: RunSync): string {
  return sync.at === undefined ? 'Fin' : `Point ${String(sync.at + 1)}`
}

/** « vitesses × 1,25, accélérations × 1,60 »: factors of the levers (D-130). */
export function factorsText(factor: number, accelFactor: number): string {
  const accel = accelFactor > 1 ? `, accélérations × ${decimal(accelFactor, 2)}` : ''
  return `vitesses × ${decimal(factor, 2)}${accel}`
}

/** Result of a link: computed delay, speed factor, or why it does not apply (D-108). */
export function syncResultText(result: RunSyncResult | null): string {
  if (!result) return 'Lien ignoré.'
  if (result.status === 'unreached') return 'Cible jamais atteinte : lien ignoré.'
  if (result.status === 'beforeStart') return 'Cible avant le départ : arrivée en retard.'
  const factors = factorsText(result.factor, result.accelFactor)
  if (result.adjust === 'speed') return `${factors.charAt(0).toUpperCase()}${factors.slice(1)}.`
  if (result.status === 'late') return `Départ immédiat, course accélérée : ${factors}.`
  return `Délai calculé : ${formatSeconds(result.delay)}.`
}

/**
 * « Durée imposée : vitesses × 0,80. »: factors of an imposed duration (D-130), null when they are
 * 1 or when the link gives them (vitesse ajustée, départ différé en retard).
 */
export function durationFactorsText(run: RunReport): string | null {
  const { sync } = run
  if (sync && (sync.adjust === 'speed' || sync.status === 'late')) return null
  if (Math.abs(run.factor - 1) < 5e-3 && run.accelFactor <= 1) return null
  return `Durée imposée : ${factorsText(run.factor, run.accelFactor)}.`
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

/** « Finit lancée », « Finit lancée : sans effet, attente de 1,2 s avant le temps suivant ». */
export function launchText(run: RunReport): string | null {
  if (!run.endsAtSpeed) return null
  if (run.launchWait !== null) {
    return `Finit lancée : sans effet, attente de ${formatSeconds(run.launchWait)} avant le temps suivant`
  }
  return 'Finit lancée'
}

/** « à un instant fixe (1,2 s) », « à la réception (+ 0,3 s) ». */
export function releaseModeText(report: PassReport | KickReport, delay: number): string {
  if (report.releaseMode === 'onReceipt') return `à la réception (+ ${formatSeconds(delay)})`
  return `à un instant fixe (${formatSeconds(report.plannedT ?? delay)})`
}

/** Real release instant, with the tolerance of a fixed release when it waited (D-110). */
export function releaseRealText(report: PassReport | KickReport): string {
  const real = `Lâcher réel : ${formatSeconds(report.start)}`
  const waited =
    report.releaseMode === 'fixed' &&
    report.plannedT !== null &&
    report.start > report.plannedT + 1e-6
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

/** Every detail of a row (tooltip), one line each (SPEC 6.7). */
export function actionDetails(
  play: Play,
  row: ActionReport,
  link: { sync: RunSync; delay: number } | null,
  delay: number,
): string[] {
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
      const factors = durationFactorsText(row)
      if (factors) lines.push(factors)
      if (link) {
        lines.push(
          `Calée sur : ${syncTargetText(play, link.sync.target)} (${rendezVousText(link.sync)}) ; ${syncResultText(row.sync)}`,
        )
      }
      const launch = launchText(row)
      if (launch) lines.push(launch)
      if (row.prolongs) lines.push('Part lancée, dans le prolongement du temps précédent')
      if (row.cutAt !== null)
        lines.push(`Arrêtée par le regroupement à ${formatSeconds(row.cutAt)}`)
      if (!row.applied) lines.push('Course ignorée')
      return lines
    }
    case 'pass':
      return [
        `Passeuse : ${name(row.fromId)}`,
        `Receveuse : ${name(row.toId)}`,
        `Lâcher : ${releaseModeText(row, delay)}`,
        releaseRealText(row),
        `Arrivée : ${formatSeconds(row.end)}`,
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
        `Lâcher : ${releaseModeText(row, delay)}`,
        releaseRealText(row),
        `Distance : ${formatMeters(row.distance)}`,
        `Temps de vol : ${formatSeconds(row.flight)}`,
        ...(row.applied ? [] : ['Jeu au pied ignoré']),
      ]
    case 'breakdown':
      return [
        `Type : ${BREAKDOWN_KIND_LABELS[row.breakdownKind]}`,
        `Plaquée : ${name(row.tackledId)}`,
        `Formation : ${formatSeconds(row.start)}`,
        `Sortie de balle : ${formatSeconds(row.end)}`,
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
