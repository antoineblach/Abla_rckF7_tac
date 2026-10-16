// Texts written in the exports (names, conditions, instructions, notes). The embedded font covers
// French except the narrow no-break space U+202F: it becomes a no-break space U+00A0.
// The characters are built from their code points: raw invisible characters do not survive edits.
const NARROW_NO_BREAK_SPACE = String.fromCharCode(0x202f)
const NO_BREAK_SPACE = String.fromCharCode(0xa0)

export function exportText(text: string): string {
  return text.replaceAll(NARROW_NO_BREAK_SPACE, NO_BREAK_SPACE)
}

/** Fixed texts written in the exports (cards, badges, playbook pages), in French. */
export const EXPORT_TEXT = {
  slow: 'Ralenti',
  real: 'Vitesse réelle',
  selection: 'Sélection',
  defaultBookTitle: 'Cahier de jeu',
  contents: 'Sommaire',
  continued: '(suite)',
  playCount: (n: number) => (n > 1 ? `${n} combinaisons` : '1 combinaison'),
  page: (n: number) => `Page ${n}`,
}
