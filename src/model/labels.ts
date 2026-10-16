// French labels of the model, shared by the interface and the exports (SPEC 4.1, 6.4, 9).
import { branchPoints, findPhase, phaseLabelParts, type PhaseLabelParts } from './phaseTree'
import type { Id, Play, PlayCategory } from './types'

export const CATEGORY_LABELS: Record<PlayCategory, string> = {
  scrum: 'Mêlée',
  lineout: 'Touche',
  restart: "Coup d'envoi / renvoi",
  phasePlay: 'Ruck / jeu courant',
  drill: 'Exercice',
}

/** « Temps n », « Temps n, option B », or the label typed by the user (SPEC 6.4). */
export function phaseLabel(parts: PhaseLabelParts): string {
  if (parts.custom) return parts.custom
  const base = `Temps ${parts.depth}`
  return parts.option ? `${base}, option ${parts.option}` : base
}

export function phaseLabelOf(play: Play, phaseId: Id): string {
  return phaseLabel(phaseLabelParts(play, phaseId))
}

/**
 * Title of an option: « Option B : <condition> », « Option B » without condition (D-058, D-063).
 * With `withPhase`, prefixed by its phase number: « Temps 4, option B : <condition> ».
 */
export function optionTitle(play: Play, phaseId: Id, withPhase = false): string {
  const parts = phaseLabelParts(play, phaseId)
  const condition = findPhase(play, phaseId)?.condition.trim() ?? ''
  const option = `option ${parts.option ?? 'A'}`
  const titled = condition === '' ? option : `${option} : ${condition}`
  return withPhase ? `Temps ${parts.depth}, ${titled}` : capitalize(titled)
}

/** True when the option titles need their phase number (several branch points, D-058). */
export function optionTitlesNeedPhase(play: Play): boolean {
  return branchPoints(play).length > 1
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
