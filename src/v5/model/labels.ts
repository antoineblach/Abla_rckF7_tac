// French labels of the model, shared by the interface and the exports (SPEC 4.1, 6.5, 9).
import type { PresetType } from '../../model/preset'
import { branchLabelParts, findBranch } from './branches'
import type { BreakdownContest, BreakdownKind, Id, KickKind, Play, PlayCategory } from './types'

export const CATEGORY_LABELS: Record<PlayCategory, string> = {
  scrum: 'Mêlée',
  lineout: 'Touche',
  restart: "Coup d'envoi / renvoi",
  phasePlay: 'Ruck / jeu courant',
  drill: 'Exercice',
}

/** Types of placement presets (SPEC 10.1). */
export const PRESET_TYPE_LABELS: Record<PresetType, string> = {
  scrum: 'Mêlée',
  lineout: 'Touche',
  restart: "Coup d'envoi / renvoi",
  ruck: 'Ruck',
  free: 'Libre',
}

export const KICK_KIND_LABELS: Record<KickKind, string> = {
  restart: "Coup d'envoi / renvoi",
  long: 'Long / recentrage',
}

export const BREAKDOWN_KIND_LABELS: Record<BreakdownKind, string> = {
  ruck: 'Ruck',
  maul: 'Maul',
}

/** Defence at the breakdown (D-078); absent: the defence setting of lot 4 applies. */
export const CONTEST_LABELS: Record<BreakdownContest | 'default', string> = {
  default: 'Par défaut',
  guard: 'Garde',
  jackal: 'Gratteur',
}

/** « Option A », or the label typed by the user (D-012); empty for a branch without sibling. */
export function branchLabelOf(play: Play, branchId: Id): string {
  const parts = branchLabelParts(play, branchId)
  if (parts.custom) return parts.custom
  return parts.option ? `Option ${parts.option}` : ''
}

/** Title of an option: « Option B : <condition> », « Option B » without condition (D-058, D-063). */
export function optionTitle(play: Play, branchId: Id): string {
  const letter = branchLabelParts(play, branchId).option ?? 'A'
  const condition = findBranch(play, branchId)?.condition.trim() ?? ''
  return condition === '' ? `Option ${letter}` : `Option ${letter} : ${condition}`
}

/** Options chosen along a line, from the root: « Option A : Large ; Option B » (SPEC 9.2). */
export function lineOptionsText(play: Play, line: readonly Id[]): string {
  return line
    .filter((id, i) => i > 0 && branchLabelParts(play, id).option !== null)
    .map((id) => optionTitle(play, id))
    .join(' ; ')
}

/**
 * Header of a GIF image (SPEC 9.2): « Sortie de mêlée, option B », « Option B » without sequence,
 * empty in the trunk without sequence.
 */
export function sceneHeaderLabel(play: Play, sequenceLabel: string, branchId: Id): string {
  const parts = branchLabelParts(play, branchId)
  if (sequenceLabel === '') return branchLabelOf(play, branchId)
  if (parts.custom) return `${sequenceLabel}, ${parts.custom}`
  return parts.option ? `${sequenceLabel}, option ${parts.option}` : sequenceLabel
}

/**
 * The label typed by the user, or « Séquence n » (SPEC 4.1): n is the rank of the sequence in the
 * array, from 1 (D-154).
 */
export function sequenceLabelOf(play: Play, sequenceId: Id): string {
  const index = play.sequences.findIndex((sequence) => sequence.id === sequenceId)
  const typed = play.sequences[index]?.label.trim() ?? ''
  return typed === '' ? `Séquence ${index + 1}` : typed
}
