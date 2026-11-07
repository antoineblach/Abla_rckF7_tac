import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { imageAtEndOf, importOptionsScenario } from './support/editorActions'

const LINE_A = 'Option A : Défense en retrait'
const LINE_B = 'Option B : Défense montée'

test('degraded mode: the scenario with options in the browser library, exported and imported (SPEC 8.6)', async ({
  page,
}, testInfo) => {
  await page.goto('./')
  await expect(page.getByTestId('degraded-banner')).toHaveText(
    'Synchronisation par dossier disponible dans Chrome',
  )
  await expect(page.getByRole('button', { name: 'Choisir un dossier' })).toHaveCount(0)

  await importOptionsScenario(page)
  const beforeA = await imageAtEndOf(page, LINE_A)
  const beforeB = await imageAtEndOf(page, LINE_B)

  await page.reload()
  await page.getByRole('button', { name: 'Ouvrir Croisée test' }).click()
  expect(await imageAtEndOf(page, LINE_A)).toBe(beforeA)
  expect(await imageAtEndOf(page, LINE_B)).toBe(beforeB)

  // Export of one play and of the whole library.
  const playDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exporter', exact: true }).click()
  const playFile = await playDownload
  expect(playFile.suggestedFilename()).toMatch(/^croisee-test--[0-9a-f-]{36}\.combi\.json$/)
  const playPath = testInfo.outputPath(playFile.suggestedFilename())
  await playFile.saveAs(playPath)
  const packDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exporter tout' }).click()
  const packFile = await packDownload
  expect(packFile.suggestedFilename()).toBe('bibliotheque.combipack.json')
  const packPath = testInfo.outputPath(packFile.suggestedFilename())
  await packFile.saveAs(packPath)
  const pack = JSON.parse(readFileSync(packPath, 'utf8')) as { name: string }[]
  expect(pack.map((p) => p.name)).toEqual(['Croisée test'])

  // Delete (trash), then import the exported file: the play comes back identical.
  await page.getByRole('button', { name: 'Supprimer', exact: true }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Déplacer dans la corbeille' }).click()
  await expect(page.getByText('Aucune combinaison.')).toBeVisible()
  await page.getByTestId('import-input').setInputFiles(playPath)
  await expect(page.getByText('Combinaison importée.')).toBeVisible()
  await page.getByRole('button', { name: 'Ouvrir Croisée test' }).click()
  expect(await imageAtEndOf(page, LINE_A)).toBe(beforeA)

  // Importing the pack again: the id exists, « Garder les deux » makes a copy.
  await page.getByTestId('import-input').setInputFiles(packPath)
  const dialog = page.getByRole('dialog', { name: 'Combinaison déjà présente' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Garder les deux' }).click()
  await expect(page.getByRole('button', { name: 'Ouvrir Croisée test (copie)' })).toBeVisible()
})
