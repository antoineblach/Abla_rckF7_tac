import { expect, test, type Page } from '@playwright/test'
import { save } from './support/editorActions'
import { stubFolderPicker } from './support/folderStub'
import { focusWindow, listFolder, readFolderFile, writeFolderFile } from './support/opfs'

/** Creates a saved play in the stubbed folder and returns its file name. */
async function setupPlay(page: Page): Promise<string> {
  await stubFolderPicker(page)
  await page.goto('./')
  await page
    .getByTestId('degraded-banner')
    .getByRole('button', { name: 'Choisir un dossier' })
    .click()
  await page.getByRole('button', { name: 'Nouvelle combinaison' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '7 contre 7 en ligne' }).click()
  await save(page)
  const [file] = await listFolder(page, 'combinaisons')
  if (!file) throw new Error('no file')
  return file
}

/** Version written by the other computer. */
async function remoteEdit(page: Page, file: string, notes: string): Promise<string> {
  const play = JSON.parse(await readFolderFile(page, `combinaisons/${file}`)) as Record<
    string,
    unknown
  >
  const text = `${JSON.stringify({ ...play, notes, updatedAt: '2030-01-01T10:00:00.000Z' }, null, 2)}\n`
  await writeFolderFile(page, `combinaisons/${file}`, text)
  return text
}

const notesField = (page: Page) =>
  page.getByRole('complementary', { name: 'Inspecteur' }).getByLabel('Notes', { exact: true })

test('reloads silently a play changed on the other computer (SPEC 8.4)', async ({ page }) => {
  const file = await setupPlay(page)
  await remoteEdit(page, file, 'Modifiée sur le PC 2')
  await focusWindow(page)
  await expect(page.getByText('Combinaison rechargée depuis le dossier.')).toBeVisible()
  await expect(notesField(page)).toHaveValue('Modifiée sur le PC 2')
})

test('asks when a newer version arrives during an unsaved local change', async ({ page }) => {
  const file = await setupPlay(page)
  await notesField(page).fill('Ma version')
  await notesField(page).blur()
  await remoteEdit(page, file, 'Version du PC 2')
  await focusWindow(page)
  const dialog = page.getByRole('dialog', { name: 'Version plus récente dans le dossier' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button')).toHaveText([
    'Garder la version du dossier',
    'Garder la mienne',
    'Garder les deux',
  ])
  await dialog.getByRole('button', { name: 'Garder les deux' }).click()
  await expect(page.getByRole('button', { name: /^Ouvrir Nouvelle combinaison/ })).toHaveCount(2)
  await expect(
    page.getByRole('button', { name: 'Ouvrir Nouvelle combinaison (copie)' }),
  ).toBeVisible()
})

test('detects a conflict copy with the same id, and « Garder les deux » keeps both', async ({
  page,
}) => {
  const file = await setupPlay(page)
  const text = await readFolderFile(page, `combinaisons/${file}`)
  await writeFolderFile(
    page,
    `combinaisons/${file.replace('.combi.json', ' (1).combi.json')}`,
    text,
  )
  await focusWindow(page)
  const issues = page.getByRole('list', { name: 'Fichiers à vérifier' })
  await expect(issues).toContainText('Copie de conflit')
  await issues.getByRole('button', { name: 'Garder les deux' }).click()
  await expect(issues).toBeHidden()
  await expect(page.getByRole('button', { name: /^Ouvrir Nouvelle combinaison/ })).toHaveCount(2)
  expect(await listFolder(page, '_corbeille')).toHaveLength(1)
})

test('reports a corrupted file without modifying nor moving it', async ({ page }) => {
  await setupPlay(page)
  await writeFolderFile(page, 'combinaisons/abimee--x.combi.json', '{ "schemaVersion": 1, ')
  await focusWindow(page)
  await expect(page.getByRole('list', { name: 'Fichiers à vérifier' })).toContainText(
    'abimee--x.combi.json',
  )
  await page.waitForTimeout(2500)
  expect(await readFolderFile(page, 'combinaisons/abimee--x.combi.json')).toBe(
    '{ "schemaVersion": 1, ',
  )
  expect(await listFolder(page, '_corbeille')).toEqual([])
})

test('deleting a play moves its file to the trash', async ({ page }) => {
  const file = await setupPlay(page)
  await page.getByRole('button', { name: 'Supprimer', exact: true }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Déplacer dans la corbeille' }).click()
  await expect(page.getByText('Aucune combinaison.')).toBeVisible()
  expect(await listFolder(page, 'combinaisons')).toEqual([])
  const trash = await listFolder(page, '_corbeille')
  expect(trash).toHaveLength(1)
  expect(trash[0]?.endsWith(file)).toBe(true)
})
