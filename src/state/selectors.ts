// Derived data for display, computed by the engine and the model (never in React components).
import { phaseSchematic } from '../engine/evaluate'
import { engineIssues } from '../engine/validate'
import { issueKey, type Issue } from '../model/issues'
import { childrenOf, findPhase, phaseLabelParts, type PhaseLabelParts } from '../model/phaseTree'
import type { Settings } from '../model/settings'
import { engineSettingsOf } from '../model/settings'
import type { Action, Id, Phase, Play } from '../model/types'
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
