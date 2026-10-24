// Derived data for display, computed by the engine and the model (never in React components).
import { phaseReport, type ActionReport, type PhaseReport } from '../engine/actionReport'
import { phaseSchematic } from '../engine/evaluate'
import { compileLine } from '../engine/timeline'
import type { SyncPick } from '../editor/syncPick'
import { engineIssues } from '../engine/validate'
import { issueKey, type Issue } from '../model/issues'
import { childrenOf, findPhase, phaseLabelParts, type PhaseLabelParts } from '../model/phaseTree'
import type { Settings } from '../model/settings'
import { engineSettingsOf } from '../model/settings'
import {
  isPlayer,
  type Action,
  type Id,
  type Phase,
  type Play,
  type PlayerEntity,
  type Vec2,
} from '../model/types'
import { validatePlay } from '../model/validate'
import { appCaches } from './settingsStore'

/** Business and engine issues of the whole play, without duplicates (SPEC 4.3). */
export function playIssues(play: Play, settings: Settings): Issue[] {
  const seen = new Set<string>()
  const result: Issue[] = []
  for (const issue of [
    ...validatePlay(play),
    ...engineIssues(play, engineSettingsOf(settings), appCaches),
  ]) {
    const key = issueKey(issue)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(issue)
    }
  }
  return result
}

export function findAction(play: Play, actionId: Id): { action: Action; phase: Phase } | null {
  for (const phase of play.phases) {
    const action = phase.actions.find((a) => a.id === actionId)
    if (action) return { action, phase }
  }
  return null
}

/** Computed duration of a run (length / pace, or the imposed duration). */
export function runDuration(
  play: Play,
  phaseId: Id,
  actionId: Id,
  settings: Settings,
): number | null {
  const schematic = phaseSchematic(play, phaseId, engineSettingsOf(settings), appCaches)
  return schematic?.runs.find((r) => r.actionId === actionId)?.duration ?? null
}

export function labelParts(play: Play, phaseId: Id): PhaseLabelParts {
  return phaseLabelParts(play, phaseId)
}

export function siblingsOf(play: Play, phaseId: Id): Phase[] {
  const phase = findPhase(play, phaseId)
  return phase ? childrenOf(play, phase.parentId) : []
}

export function phaseDurationAt(play: Play, phaseId: Id, settings: Settings): number {
  const schematic = phaseSchematic(play, phaseId, engineSettingsOf(settings), appCaches)
  return schematic ? schematic.phaseEnd - schematic.phaseStart : 0
}

/** Landing point of a kick (receiver position at arrival, or its target point), or null. */
export function kickLanding(
  play: Play,
  phaseId: Id,
  actionId: Id,
  settings: Settings,
): Vec2 | null {
  const schematic = phaseSchematic(play, phaseId, engineSettingsOf(settings), appCaches)
  return schematic?.kicks.find((k) => k.actionId === actionId)?.to ?? null
}

/** Players of the same team as `id`, without her, for the lists of the inspector (lot 3). */
export function teammatesOf(play: Play, id: Id): PlayerEntity[] {
  const player = play.entities.find((e) => e.id === id)
  if (!isPlayer(player)) return []
  return play.entities.filter(
    (e): e is PlayerEntity => isPlayer(e) && e.team === player.team && e.id !== id,
  )
}

/**
 * Phase shown by the list of the actions (SPEC 6.7): the selected phase in edit mode, the phase
 * at t of the line during playback.
 */
export function displayedPhaseId(
  play: Play,
  playing: boolean,
  line: readonly Id[],
  t: number,
  selectedPhaseId: Id | null,
  settings: Settings,
): Id | null {
  if (!playing) return selectedPhaseId
  const compiled = compileLine(play, line, engineSettingsOf(settings), appCaches)
  let phaseId: Id | null = compiled.phases[0]?.phaseId ?? selectedPhaseId
  for (const phase of compiled.phases) if (phase.start <= t) phaseId = phase.phaseId
  return phaseId
}

/** Report of the actions of a phase (D-113), or null. */
export function phaseReportOf(play: Play, phaseId: Id, settings: Settings): PhaseReport | null {
  return phaseReport(play, phaseId, engineSettingsOf(settings), appCaches)
}

/** Report of one action of a phase, or null. */
export function actionReportOf(
  play: Play,
  phaseId: Id,
  actionId: Id,
  settings: Settings,
): ActionReport | null {
  return phaseReportOf(play, phaseId, settings)?.rows.find((r) => r.actionId === actionId) ?? null
}

/** « course de A 5 (fin) », « course de A 5 (point 2) »: the run of « Caler sur… » (D-109). */
export function syncPickPrompt(play: Play, pick: SyncPick): string {
  const found = findAction(play, pick.runId)
  const who = found?.action.type === 'run' ? playerName(play, found.action.entityId) : '?'
  const where = pick.at === undefined ? 'fin' : `point ${String(pick.at + 1)}`
  return `course de ${who} (${where})`
}

/** « A 4 »: team and number of a player, or « ? ». */
export function playerName(play: Play, id: Id): string {
  const player = play.entities.find((e) => e.id === id)
  return isPlayer(player) ? `${player.team} ${String(player.number)}` : '?'
}
