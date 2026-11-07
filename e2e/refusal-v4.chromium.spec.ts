import { expect, test } from '@playwright/test'
import { createSevenVsSeven, save } from './support/editorActions'
import { stubFolderPicker } from './support/folderStub'
import { listFolder, readFolderFile, writeFolderFile } from './support/opfs'
import { expectRefusalAlert, importMixedPack, V4_PLAY_ID, V4_PLAY_TEXT } from './support/refusal'

// Plays of version 4 in folder mode (D-139, D-174, SPEC 4.4): refused with their message, the file
// never modified nor moved; in a pack, only the version 5 plays are imported.

const V4_FILE = `combinaisons/allures-saisies--${V4_PLAY_ID}.combi.json`

test.beforeEach(async ({ page }) => {
  await stubFolderPicker(page)
  await page.goto('./')
})

test('a version 4 file of the folder: message, identical after a save, not in the trash', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await (await navigator.storage.getDirectory()).getDirectoryHandle('Rugby7', { create: true })
  })
  await writeFolderFile(page, V4_FILE, V4_PLAY_TEXT)
  await page
    .getByTestId('degraded-banner')
    .getByRole('button', { name: 'Choisir un dossier' })
    .click()
  await expect(page.getByText('Dossier : Rugby7')).toBeVisible()
  await expectRefusalAlert(page, `allures-saisies--${V4_PLAY_ID}.combi.json`)
  await expect(page.getByRole('button', { name: /^Ouvrir / })).toHaveCount(0)

  // Another play, saved with Ctrl+S: the version 4 file is still there, byte for byte.
  await createSevenVsSeven(page, 'Autre')
  await save(page)
  const plays = (await listFolder(page, 'combinaisons')).filter((f) => f.endsWith('.combi.json'))
  expect(plays).toHaveLength(2)
  expect(await readFolderFile(page, V4_FILE)).toBe(V4_PLAY_TEXT)
  // The trash holds only the former name of the new play (renamed « Autre »).
  const trash = await listFolder(page, '_corbeille')
  expect(trash.filter((name) => name.includes(V4_PLAY_ID))).toEqual([])
})

test('a pack mixing versions 4 and 5: only the version 5 play is imported', async ({ page }) => {
  await importMixedPack(page)
})
