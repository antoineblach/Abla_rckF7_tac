import { expect, test } from '@playwright/test'
import { createSevenVsSeven, save } from './support/editorActions'
import { readKv, writeKv } from './support/idb'
import { importMixedPack, OBSOLETE_MESSAGE, V4_PLAY_ID, V4_PLAY_TEXT } from './support/refusal'

// Plays of version 4 in degraded mode (D-139, D-174, SPEC 4.4): the browser library and the draft
// keep their entry as it is, with a message; in a pack, only the version 5 plays are imported.

const PLAY_KEY = `abla-rck7:play:${V4_PLAY_ID}`
const DRAFT_KEY = 'abla-rck7:draft'

test.beforeEach(async ({ page }) => {
  await page.goto('./')
})

test('a version 4 play of the browser library: message, entry identical after a save', async ({
  page,
}) => {
  await writeKv(page, PLAY_KEY, V4_PLAY_TEXT)
  await page.reload()
  const issues = page.getByRole('list', { name: 'Fichiers à vérifier' })
  await expect(issues).toContainText(V4_PLAY_ID)
  await expect(issues).toContainText(OBSOLETE_MESSAGE)
  await expect(page.getByRole('button', { name: /^Ouvrir / })).toHaveCount(0)

  await createSevenVsSeven(page, 'Autre')
  await save(page)
  await expect(page.getByRole('button', { name: /^Ouvrir / })).toHaveCount(1)
  expect(await readKv(page, PLAY_KEY)).toBe(V4_PLAY_TEXT)
})

test('a version 4 draft: message at start-up, no restoration, entry kept until a change', async ({
  page,
}) => {
  await writeKv(page, DRAFT_KEY, V4_PLAY_TEXT)
  await page.reload()
  await expect(
    page.getByText(
      'Le brouillon de ce navigateur vient d’une version antérieure de l’outil : il n’est pas restauré, et sera remplacé à la prochaine modification.',
    ),
  ).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await readKv(page, DRAFT_KEY)).toBe(V4_PLAY_TEXT)
})

test('a pack mixing versions 4 and 5: only the version 5 play is imported', async ({ page }) => {
  await importMixedPack(page)
})
