import { expect, test, type Page } from '@playwright/test'
import {
  buildScenario,
  canvas,
  imageAtEndOf,
  importOptionsScenario,
  save,
  seekStart,
} from './support/editorActions'
import { stubFolderPicker } from './support/folderStub'
import { listFolder, readFolderFile } from './support/opfs'

interface StoredPlay {
  schemaVersion: number
  branches: { condition: string }[]
  actions: { id: string; type: string; startGlue?: { targetId: string; event: unknown } }[]
}

async function chooseFolder(page: Page): Promise<void> {
  await page
    .getByTestId('degraded-banner')
    .getByRole('button', { name: 'Choisir un dossier' })
    .click()
  await expect(page.getByText('Dossier : Rugby7')).toBeVisible()
}

async function storedPlay(page: Page): Promise<StoredPlay> {
  const files = (await listFolder(page, 'combinaisons')).filter((f) => f.endsWith('.combi.json'))
  expect(files).toHaveLength(1)
  return JSON.parse(await readFolderFile(page, `combinaisons/${files[0] ?? ''}`)) as StoredPlay
}

test.beforeEach(async ({ page }) => {
  await stubFolderPicker(page)
  await page.goto('./')
})

test('folder mode: create a line, save, reload, same image (lot 1 acceptance)', async ({
  page,
}) => {
  await expect(page.getByTestId('degraded-banner')).toContainText('Aucun dossier choisi')
  await chooseFolder(page)
  expect(await listFolder(page)).toEqual([
    '_corbeille',
    'combinaisons',
    'exports',
    'modeles',
    'reglages.json',
  ])

  await buildScenario(page, 'Croisée test')
  await save(page)
  const files = await listFolder(page, 'combinaisons')
  expect(files).toHaveLength(1)
  expect(files[0]).toMatch(/^croisee-test--[0-9a-f-]{36}\.combi\.json$/)
  const stored = await storedPlay(page)
  expect(stored.schemaVersion).toBe(5)
  expect(stored.actions.map((a) => a.type)).toEqual(['run', 'run', 'pass', 'run', 'pass', 'run'])
  // The last run of A6 starts from the end of her first run, glued to it (SPEC 6.2).
  expect(stored.actions[5]?.startGlue).toEqual({ targetId: stored.actions[3]?.id, event: 'end' })

  const before = await imageAtEndOf(page)
  await page.reload()
  await expect(page.getByText('Dossier : Rugby7')).toBeVisible()
  await page.getByRole('button', { name: 'Ouvrir Croisée test' }).click()
  expect(await imageAtEndOf(page)).toBe(before)
})

test('folder mode: a play with options, each line read, reload, option chosen during playback', async ({
  page,
}) => {
  await chooseFolder(page)
  await importOptionsScenario(page)
  await expect
    .poll(async () => (await storedPlay(page)).branches.map((b) => b.condition).sort())
    .toEqual(['', 'Défense en retrait', 'Défense montée'])

  const beforeA = await imageAtEndOf(page, 'Option A : Défense en retrait')
  const beforeB = await imageAtEndOf(page, 'Option B : Défense montée')
  expect(beforeA).not.toBe(beforeB)

  // Reload: the folder is accessible again and the play reads identically, options included.
  await page.reload()
  await expect(page.getByText('Dossier : Rugby7')).toBeVisible()
  await page.getByRole('button', { name: 'Ouvrir Croisée test' }).click()
  expect(await imageAtEndOf(page, 'Option A : Défense en retrait')).toBe(beforeA)
  expect(await imageAtEndOf(page, 'Option B : Défense montée')).toBe(beforeB)

  // Playback: pause at the branch point, one button per option, choice, back to the branch point.
  await seekStart(page)
  await page.getByRole('combobox', { name: 'Vitesse' }).selectOption('2')
  await page.getByRole('button', { name: 'Lecture', exact: true }).click()
  const chooser = page.getByRole('group', { name: 'Point d’option' })
  await expect(chooser).toBeVisible({ timeout: 15_000 })
  await expect(chooser.getByRole('button')).toHaveText([
    'Option A : Défense en retrait',
    'Option B : Défense montée',
  ])
  await chooser.getByRole('button', { name: 'Option B : Défense montée' }).click()
  const line = page.getByRole('combobox', { name: 'Ligne' })
  await expect(line.locator('option:checked')).toHaveText('Option B : Défense montée')
  await expect(page.getByRole('button', { name: 'Lecture', exact: true })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('button', { name: 'Revenir au point d’option' }).click()
  await expect(chooser).toBeVisible()
  await chooser.getByRole('button', { name: 'Option A : Défense en retrait' }).click()
  await expect(line.locator('option:checked')).toHaveText('Option A : Défense en retrait')
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
