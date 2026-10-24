// Interface texts, in French, without em dash (CLAUDE.md conventions).
import type { Issue } from '../model/issues'
import type { Pace } from '../model/types'
import type { ReadError } from '../io/readPlay'
import type { EditorNotice } from '../state/editorStore'
import type { ToolId } from '../editor/tools/types'
import { formatKmh, formatSeconds } from './format'

export { CATEGORY_LABELS, phaseLabel } from '../model/labels'

export const PACE_LABELS: Record<Pace, string> = { walk: 'Marche', jog: 'Trot', sprint: 'Sprint' }

export const TOOL_LABELS: Record<ToolId, { label: string; key: string }> = {
  select: { label: 'Sélection', key: 'V' },
  placeA: { label: 'Placer A', key: 'A' },
  placeB: { label: 'Placer B', key: 'B' },
  run: { label: 'Course', key: 'R' },
  pass: { label: 'Passe', key: 'P' },
  kick: { label: 'Jeu au pied', key: 'J' },
  breakdown: { label: 'Regroupement', key: 'G' },
}

export const NOTICES: Record<Exclude<EditorNotice, null>, string> = {
  inheritedPosition:
    'Position héritée du temps précédent : sélectionnez le temps 1 pour modifier le placement, ou déplacez les points de passage.',
  readOnly: 'Combinaison en lecture seule : résolvez d’abord la copie de conflit.',
  rootOption: 'Le premier temps ne peut pas avoir d’option.',
  notLeaf:
    'Ce temps a déjà une suite : utilisez « Insérer un temps après » ou « Créer une option ».',
  breakdownNoBall:
    'Regroupement : cliquez une joueuse qui a le ballon dans ce temps (la porteuse plaquée).',
  breakdownTeammates: 'Regroupement : il faut deux coéquipières pour le soutien et le relayeur.',
  syncSelf: 'Une course ne peut pas être calée sur elle-même : cliquez une autre action.',
  syncCycle: 'Lien refusé : il créerait une boucle de liens. Cliquez une autre action.',
  syncInvalid: 'Cette action ne peut pas servir de cible : cliquez une autre action.',
  syncLinkRemoved: 'Le point portait un lien de synchronisation : le lien a été retiré.',
}

/** « 1,2 s » from a number of seconds carried by an issue. */
function seconds(value: string | number | undefined): string {
  return typeof value === 'number' ? formatSeconds(value) : '?'
}

/** « 23,4 km/h » from a speed in m/s carried by an issue. */
function kmh(value: string | number | undefined): string {
  return typeof value === 'number' ? formatKmh(value) : '?'
}

export function issueMessage(issue: Issue): string {
  const p = issue.params ?? {}
  switch (issue.code) {
    case 'duplicateId':
      return 'Identifiant en double.'
    case 'multipleBalls':
      return 'Plusieurs ballons dans la combinaison.'
    case 'noRoot':
      return 'Aucun temps de départ.'
    case 'multipleRoots':
      return 'Plusieurs temps de départ.'
    case 'missingParent':
      return 'Temps rattaché à un temps inexistant.'
    case 'cycle':
      return 'Boucle dans l’arbre des temps.'
    case 'defaultCount':
      return 'Il faut exactement une option par défaut.'
    case 'missingEntity':
      return 'Action liée à une joueuse supprimée.'
    case 'runTargetNotPlayer':
      return 'Une course ne concerne qu’une joueuse.'
    case 'passEndpointNotPlayer':
      return 'Une passe relie deux joueuses.'
    case 'ballCarrierMissing':
      return 'La porteuse du ballon au départ n’existe pas.'
    case 'ballCarrierWithoutBall':
      return 'Porteuse indiquée mais aucun ballon.'
    case 'ballNotPlaced':
      return 'Ballon sans porteuse au départ.'
    case 'positionMissing':
      return 'Joueuse sans placement de départ.'
    case 'duplicateNumber':
      return `Numéro ${p.number ?? ''} en double dans l’équipe ${p.team ?? ''}.`
    case 'fieldOutOfRange':
      return `Dimension hors de la Règle 1 (${p.min ?? ''} à ${p.max ?? ''} m).`
    case 'instructionTooLong':
      return `Consigne longue (${p.length ?? ''} caractères, ${p.max ?? ''} conseillés) : peu lisible sur un téléphone.`
    case 'twoRunsSamePhase':
      return 'Deux courses de la même joueuse dans ce temps : seule la première est jouée.'
    case 'passToOpponent':
      return 'Passe vers l’autre équipe.'
    case 'passerWithoutBall':
      return 'La passeuse n’a pas le ballon au moment du lâcher.'
    case 'simultaneousPass':
      return 'Deux passes ou jeux au pied au même instant : seul le premier est joué.'
    case 'unsupportedAction':
      return 'Action d’un lot ultérieur, ignorée.'
    case 'actorNotPlayer':
      return 'Un jeu au pied ou un regroupement ne concerne que des joueuses.'
    case 'kickSelfTarget':
      return 'La frappeuse ne peut pas être sa propre receveuse.'
    case 'breakdownDuplicate':
      return 'Plaquée, soutien et relayeur doivent être trois joueuses différentes.'
    case 'breakdownTeam':
      return 'Le soutien et le relayeur sont des coéquipières de la plaquée.'
    case 'kickerWithoutBall':
      return 'La frappeuse n’a pas le ballon au moment de la frappe : jeu au pied ignoré.'
    case 'tackledWithoutBall':
      return 'La plaquée n’a pas le ballon à la formation : regroupement ignoré.'
    case 'runCutByBreakdown':
      return 'Course arrêtée par le regroupement : la suite se dessine dans le temps suivant.'
    case 'relayerLate':
      return 'Relayeur trop loin : il n’arrive au ballon qu’à la sortie, en accélérant.'
    case 'forwardPass':
      return 'En-avant probable : la passe part vers l’avant depuis les mains.'
    case 'syncTargetMissing':
      return 'Lien de synchronisation : cible supprimée, lien ignoré.'
    case 'syncTargetInvalid':
      return p.reason === 'unreached'
        ? 'Lien de synchronisation : la cible n’a jamais lieu (action ignorée ou point non atteint), lien ignoré.'
        : 'Lien de synchronisation invalide (cible ou point inexistant) : lien ignoré.'
    case 'syncCycle':
      return 'Liens de synchronisation en boucle : liens ignorés.'
    case 'syncLate':
      return `Synchronisation impossible : départ immédiat, arrivée en retard de ${seconds(p.late)}.`
    case 'syncSpeedCapped':
      return p.needed === undefined
        ? 'Synchronisation impossible : la cible arrive avant le départ de la course ; vitesse plafonnée au seuil rouge.'
        : `Synchronisation impossible : il faudrait ${kmh(p.needed)} de moyenne ; vitesse plafonnée au seuil rouge.`
    case 'durationCapped':
      return `Durée imposée inatteignable (accélérations, seuil rouge) : la course dure ${seconds(p.duration)}.`
    case 'runSpeedHigh':
      return `Segment ${p.segment ?? ''} : ${kmh(p.speed)}, au-delà du seuil orange.`
    case 'runSpeedTooHigh':
      return `Segment ${p.segment ?? ''} : ${kmh(p.speed)}, au-delà du seuil rouge : irréaliste.`
    case 'runNotContinued':
      return `Course lancée non prolongée dans ${p.phase ?? 'le temps suivant'} : arrêt net à la fin du temps.`
  }
}

export function readErrorMessage(error: ReadError): string {
  switch (error.code) {
    case 'json':
      return 'Fichier illisible (JSON invalide).'
    case 'notAnObject':
      return 'Contenu inattendu.'
    case 'missingVersion':
      return 'Version du format absente.'
    case 'futureVersion':
      return 'Fichier créé par une version plus récente de l’outil : recharger la page.'
    case 'unknownVersion':
      return `Version du format inconnue (${error.version}).`
    case 'invalid':
      return `Contenu invalide : ${error.issues
        .slice(0, 3)
        .map((i) => i.path || 'racine')
        .join(', ')}.`
  }
}

export const TEXT = {
  appTitle: 'Combinaisons rugby à 7',
  degradedFirefox: 'Synchronisation par dossier disponible dans Chrome',
  noFolderChrome: 'Aucun dossier choisi : la bibliothèque reste dans ce navigateur.',
  chooseFolder: 'Choisir un dossier',
  reauthorize: 'Réautoriser le dossier',
  needsPermission: 'Le dossier n’est plus autorisé.',
  reloaded: 'Combinaison rechargée depuis le dossier.',
  saveError: 'Enregistrement impossible.',
  // Synchronisation log (D-100).
  copySyncLog: 'Copier le journal de synchronisation',
  syncLogCopied: 'Journal de synchronisation copié.',
  syncLogNotCopied: 'Le journal n’a pas pu être copié dans le presse-papiers.',
  invalidSettings:
    'reglages.json est invalide : il ne sera pas modifié, valeurs par défaut utilisées.',
  exportCancelled: 'Export annulé : aucun fichier écrit.',
  exportFailed: (message: string) => `Export impossible. ${message}`,
  futureSettings:
    'reglages.json a été créé par une version plus récente de l’outil : recharger la page. Il ne sera pas modifié.',
  newPlay: 'Nouvelle combinaison',
  imported: (n: number) => (n > 1 ? `${n} combinaisons importées.` : 'Combinaison importée.'),
  importFailed: (n: number) =>
    `${n} élément${n > 1 ? 's' : ''} invalide${n > 1 ? 's' : ''} ignoré${n > 1 ? 's' : ''}.`,
  browserContent: (plays: number, presets: number) => {
    const p = (n: number) => (n > 1 ? 's' : '')
    const what =
      presets === 0
        ? `${plays} combinaison${p(plays)} enregistrée${p(plays)}`
        : plays === 0
          ? `${presets} modèle${p(presets)} de placement enregistré${p(presets)}`
          : `${plays} combinaison${p(plays)} et ${presets} modèle${p(presets)} de placement enregistrés`
    return `${what} dans ce navigateur. Les copier dans le dossier choisi ?`
  },
  copied: (n: number, presets = 0) =>
    presets === 0
      ? `${n} combinaison${n > 1 ? 's' : ''} copiée${n > 1 ? 's' : ''} dans le dossier.`
      : `${n} combinaison${n > 1 ? 's' : ''} et ${presets} modèle${presets > 1 ? 's' : ''} copiés dans le dossier.`,
  deleted: 'Combinaison déplacée dans la corbeille.',
  // Placement presets and placements (lot 3, D-092, D-096).
  presetSaved: (name: string) => `Modèle « ${name} » enregistré.`,
  presetUpdated: (name: string) => `Modèle « ${name} » mis à jour.`,
  presetDuplicated: 'Modèle dupliqué.',
  presetRenamed: 'Modèle renommé.',
  presetDeleted: 'Modèle déplacé dans la corbeille.',
  presetChanged:
    'Ce modèle a été modifié ou retiré sur l’autre ordinateur : la liste est relue, recommencez.',
  presetReadOnly: 'Ce modèle est en lecture seule : résolvez d’abord la copie de conflit.',
  presetError: 'Action impossible sur le modèle.',
  placementApply: (name: string) => `Modèle « ${name} » : cliquez le point d’ancrage.`,
  placementSave: (name: string) => `Enregistrer « ${name} » : cliquez le point d’ancrage.`,
  placementAxes: 'Flèches : avant, côté ouvert.',
  placementMoveStart: 'Déplacer la combinaison : cliquez le point de départ.',
  placementMoveEnd: 'Déplacer la combinaison : cliquez le point d’arrivée.',
  placementRefused: 'Marque de touche à moins de 5 m d’une ligne de but : refusée.',
  placementEscape: 'Échap pour annuler.',
  // Lot 3 bis (D-109, D-111).
  syncPick: (what: string) => `Caler la ${what} : cliquez la cible.`,
  sprintReset:
    'Allure sprint ramenée de 7 à 5,5 m/s (19,8 km/h), nouvelle valeur par défaut. Modifiable dans les réglages.',
} as const

/** « Côté ouvert » of a preset, seen by the attacking team facing the opposing goal (D-088). */
export const OPEN_SIDE_LABELS = { auto: 'Auto', left: 'Gauche', right: 'Droite' } as const

/** File size as Windows shows it, in French (D-072): « 850 Ko », « 1,2 Mo ». */
export function formatSize(bytes: number): string {
  const mo = bytes / (1024 * 1024)
  if (mo >= 1) return `${mo.toFixed(1).replace('.', ',')} Mo`
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`
}
