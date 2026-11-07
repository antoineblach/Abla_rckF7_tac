import { readFileSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'
import { OPTIONS_SCENARIO } from './editorActions'

// A play of an earlier version is refused, never migrated nor written (D-139, D-174, SPEC 4.4).

/** A play of version 4: the frozen fixture of lot 3bis-1, read from the root of the repository. */
export const V4_PLAY_TEXT = readFileSync('src/test/fixtures/play-v4-lot3bis1.json', 'utf8')
export const V4_PLAY_ID = (JSON.parse(V4_PLAY_TEXT) as { id: string }).id

export const OBSOLETE_MESSAGE =
  'Combinaison d’une version antérieure de l’outil (format 4) : refusée, elle n’est ni modifiée ni déplacée.'

/**
 * Alert of the refused file in the library: its message, and that the file is left as it is,
 * said once only (D-174).
 */
export async function expectRefusalAlert(page: Page, fileName: string): Promise<void> {
  const alert = page
    .getByRole('list', { name: 'Fichiers à vérifier' })
    .getByRole('listitem')
    .filter({ hasText: fileName })
  await expect(alert).toContainText(OBSOLETE_MESSAGE)
  const text = (await alert.textContent()) ?? ''
  expect(text.split('ni modifi').length - 1).toBe(1)
}

/** Import of a pack mixing the version 4 play and the version 5 scenario: only the latter enters. */
export async function importMixedPack(page: Page): Promise<void> {
  const pack: unknown[] = [
    JSON.parse(V4_PLAY_TEXT),
    JSON.parse(readFileSync(OPTIONS_SCENARIO, 'utf8')),
  ]
  await page.getByTestId('import-input').setInputFiles({
    name: 'melange.combipack.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(pack)),
  })
  await expect(page.getByText('Combinaison importée.')).toBeVisible()
  await expect(
    page.getByText('1 combinaison d’une version antérieure de l’outil refusée : non importée.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /^Ouvrir / })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Ouvrir Croisée test' })).toBeVisible()
}
