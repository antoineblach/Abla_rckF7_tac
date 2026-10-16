import { expect, test } from '@playwright/test'
import { buildScenario, canvas, imageAtEndOf, save, selectPhase } from './support/editorActions'
import { stubFolderPicker } from './support/folderStub'
import { listFolder, readFolderFile } from './support/opfs'

test.beforeEach(async ({ page }) => {
  await stubFolderPicker(page)
  await page.goto('./')
})

test('folder mode: create, save, reload and play each option (lot 1 acceptance)', async ({
  page,
}) => {
  await expect(page.getByTestId('degraded-banner')).toContainText('Aucun dossier choisi')
  await page
    .getByTestId('degraded-banner')
    .getByRole('button', { name: 'Choisir un dossier' })
    .click()
  await expect(page.getByText('Dossier : Rugby7')).toBeVisible()
  expect(await listFolder(page)).toEqual(['_corbeille', 'combinaisons', 'exports', 'reglages.json'])

  await buildScenario(page, 'Croisée test')
  await save(page)
  const files = await listFolder(page, 'combinaisons')
  expect(files).toHaveLength(1)
  expect(files[0]).toMatch(/^croisee-test--[0-9a-f-]{36}\.combi\.json$/)
  const stored = JSON.parse(await readFolderFile(page, `combinaisons/${files[0] ?? ''}`)) as {
    phases: { condition: string }[]
  }
  expect(stored.phases.map((p) => p.condition).sort()).toEqual([
    '',
    '',
    'Défense en retrait',
    'Défense montée',
  ])

  const beforeA = await imageAtEndOf(page, 'Temps 3, option A')
  const beforeB = await imageAtEndOf(page, 'Temps 3, option B')
  expect(beforeA).not.toBe(beforeB)

  // Reload: the folder is accessible again and the play reads identically, options included.
  await page.reload()
  await expect(page.getByText('Dossier : Rugby7')).toBeVisible()
  await page.getByRole('button', { name: 'Ouvrir Croisée test' }).click()
  expect(await imageAtEndOf(page, 'Temps 3, option A')).toBe(beforeA)
  expect(await imageAtEndOf(page, 'Temps 3, option B')).toBe(beforeB)

  // Playback: pause at the branch point, one button per option, choice, back to the branch point.
  await selectPhase(page, 'Temps 1')
  await page.getByRole('combobox', { name: 'Vitesse' }).selectOption('2')
  await page.getByRole('button', { name: 'Lecture' }).click()
  const chooser = page.getByRole('group', { name: 'Point d’option' })
  await expect(chooser).toBeVisible({ timeout: 15_000 })
  await expect(chooser.getByRole('button')).toHaveText([
    'Option A : Défense en retrait',
    'Option B : Défense montée',
  ])
  await chooser.getByRole('button', { name: 'Option B : Défense montée' }).click()
  await expect(page.getByTestId('current-phase')).toContainText('Temps 3, option B')
  await expect(page.getByRole('button', { name: 'Lecture' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Revenir au point d’option' }).click()
  await expect(chooser).toBeVisible()
  await chooser.getByRole('button', { name: 'Option A : Défense en retrait' }).click()
  await expect(page.getByTestId('current-phase')).toContainText('Temps 3, option A')
  await expect(canvas(page)).toHaveAttribute('data-mode', 'play')
})

test('renaming a play writes the new file and moves the old one to the trash', async ({ page }) => {
  await page
    .getByTestId('degraded-banner')
    .getByRole('button', { name: 'Choisir un dossier' })
    .click()
  await page.getByRole('button', { name: 'Nouvelle combinaison' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '7 contre 7 en ligne' }).click()
  await save(page)
  const inspector = page.getByRole('complementary', { name: 'Inspecteur' })
  const name = inspector.getByLabel('Nom', { exact: true })
  await name.fill('Sautée')
  await name.press('Enter')
  await save(page)
  const files = await listFolder(page, 'combinaisons')
  expect(files).toHaveLength(1)
  expect(files[0]).toMatch(/^sautee--/)
  const trash = await listFolder(page, '_corbeille')
  expect(trash).toHaveLength(1)
  expect(trash[0]).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}--nouvelle-combinaison--/)
})
